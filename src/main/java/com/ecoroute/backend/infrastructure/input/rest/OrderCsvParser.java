package com.ecoroute.backend.infrastructure.input.rest;
import com.ecoroute.backend.domain.model.Order;
import jakarta.validation.Validator;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import java.util.*;

@Component
@RequiredArgsConstructor
public class OrderCsvParser {
    private final Validator validator;
    public List<Order> parse(String text) {
        List<List<String>> rows=records(text);
        if(rows.size()<2) throw new IllegalArgumentException("CSV vacío: incluya cabecera y pedidos");
        var required=List.of("trackingNumber","recipientName","deliveryAddress","latitude","longitude");
        if(rows.get(0).size()<5 || !rows.get(0).subList(0,5).equals(required))
            throw new IllegalArgumentException("Cabecera: trackingNumber,recipientName,deliveryAddress,latitude,longitude,externalReference,routeId,recipientPhone,recipientEmail,deliveryCity,deliveryDistrict");
        if(rows.size()>1001) throw new IllegalArgumentException("Máximo 1000 pedidos por importación");
        List<Order> result=new ArrayList<>();List<String> errors=new ArrayList<>();Set<String> tracks=new HashSet<>();
        for(int index=1;index<rows.size();index++) {
            var row=rows.get(index);if(row.stream().allMatch(String::isBlank))continue;
            try {
                if(row.size()<8 || row.size()>11) throw new IllegalArgumentException("se requieren entre 8 y 11 columnas, incluido teléfono");
                if(!cell(row,6).isBlank()) throw new IllegalArgumentException("registre sin routeId; confirme y asigne después");
                Double lat=number(cell(row,3)),lon=number(cell(row,4));
                if(lat!=null && (!Double.isFinite(lat)||lat < -90||lat>90) || lon!=null && (!Double.isFinite(lon)||lon < -180||lon>180))
                    throw new IllegalArgumentException("coordenadas inválidas");
                var request=new CreateOrderRequest(cell(row,0),nullable(cell(row,5)),null,null,cell(row,1),cell(row,7),
                    nullable(cell(row,8)),cell(row,2),nullable(cell(row,9)),nullable(cell(row,10)),lat,lon,0,null,null);
                var violations=validator.validate(request);
                if(!violations.isEmpty()) throw new IllegalArgumentException(violations.stream().map(v->v.getPropertyPath()+": "+v.getMessage()).sorted().reduce((a,b)->a+"; "+b).orElse("datos inválidos"));
                if(!tracks.add(request.trackingNumber())) throw new IllegalArgumentException("tracking duplicado en el archivo");
                result.add(OrderRestMapper.toDomain(request));
            } catch(IllegalArgumentException error) {errors.add("Fila "+(index+1)+": "+error.getMessage());}
        }
        if(!errors.isEmpty()) throw new IllegalArgumentException("No se importó ningún pedido. "+String.join(" | ",errors.subList(0,Math.min(30,errors.size()))));
        if(result.isEmpty()) throw new IllegalArgumentException("No hay pedidos para importar");
        return result;
    }
    private String cell(List<String> row,int index) {return index<row.size()?row.get(index).trim():"";}
    private String nullable(String value) {return value.isBlank()?null:value;}
    private Double number(String value) {return value.isBlank()?null:Double.valueOf(value);}
    /** RFC4180-style comma records: escaped quotes, embedded CRLF, trailing empty fields. */
    static List<List<String>> records(String input) {
        if(input==null)throw new IllegalArgumentException("CSV requerido");
        input=input.replaceFirst("^\\uFEFF","");
        List<List<String>> rows=new ArrayList<>();List<String> row=new ArrayList<>();StringBuilder field=new StringBuilder();
        boolean quoted=false,closed=false;
        for(int i=0;i<input.length();i++) {
            char c=input.charAt(i);
            if(quoted) {
                if(c=='"') {if(i+1<input.length() && input.charAt(i+1)=='"'){field.append('"');i++;}else{quoted=false;closed=true;}}
                else field.append(c);
            } else if(c==',' || c=='\n' || c=='\r') {
                row.add(field.toString());field.setLength(0);closed=false;
                if(c!=','){rows.add(row);row=new ArrayList<>();if(c=='\r'&&i+1<input.length()&&input.charAt(i+1)=='\n')i++;}
            } else if(c=='"') {
                if(field.length()>0 || closed)throw new IllegalArgumentException("Comillas inválidas en CSV");
                quoted=true;
            } else {
                if(closed)throw new IllegalArgumentException("Texto después del cierre de comillas CSV");
                field.append(c);
            }
        }
        if(quoted)throw new IllegalArgumentException("Comillas CSV sin cerrar");
        if(field.length()>0 || !row.isEmpty() || closed){row.add(field.toString());rows.add(row);}
        return rows;
    }
}
