package com.ecoroute.backend.application.services;

import com.ecoroute.backend.domain.model.DeliveryProof;
import com.ecoroute.backend.domain.model.Order;
import com.lowagie.text.*;
import com.lowagie.text.Font;
import com.lowagie.text.Image;
import com.lowagie.text.pdf.PdfWriter;
import org.springframework.stereotype.Service;

import java.awt.*;
import java.io.ByteArrayOutputStream;
import java.time.format.DateTimeFormatter;

@Service
public class PdfService {

    public byte[] generateDeliveryReceipt(Order order, DeliveryProof proof) {
        return generateDeliveryReceipt(order,proof,null,null);
    }

    public byte[] generateDeliveryReceipt(Order order, DeliveryProof proof,byte[] photo,byte[] signature) {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        Document document = new Document(PageSize.A4);
        
        try {
            PdfWriter.getInstance(document, out);
            document.open();

            // Title
            Font titleFont = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 20, Color.BLUE);
            Paragraph title = new Paragraph("Comprobante de Entrega - EcoRoute", titleFont);
            title.setAlignment(Element.ALIGN_CENTER);
            document.add(title);
            document.add(new Paragraph(" "));

            // Order Info
            document.add(new Paragraph("Información del Pedido:", FontFactory.getFont(FontFactory.HELVETICA_BOLD, 12)));
            document.add(new Paragraph("Número de Tracking: " + order.trackingNumber()));
            document.add(new Paragraph("Referencia Externa: " + order.externalReference()));
            document.add(new Paragraph("Cliente: " + order.recipientName()));
            document.add(new Paragraph("Dirección: " + order.deliveryAddress()));
            document.add(new Paragraph(" "));

            // Delivery Info
            document.add(new Paragraph("Detalles de la Entrega:", FontFactory.getFont(FontFactory.HELVETICA_BOLD, 12)));
            document.add(new Paragraph("Fecha y Hora: " + proof.verifiedAt().format(DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm"))));
            document.add(new Paragraph("Recibido por: " + proof.receiverName()));
            document.add(new Paragraph("DNI: " + proof.receiverDni()));
            document.add(new Paragraph("Ubicación GPS: " + proof.latitude() + ", " + proof.longitude()));
            document.add(new Paragraph(" "));
            if(photo!=null) {
                document.add(new Paragraph("Fotografía de la entrega"));
                Image image=Image.getInstance(photo);image.scaleToFit(420,260);document.add(image);
                document.add(new Paragraph("SHA256 foto: "+sha256(photo),FontFactory.getFont(FontFactory.HELVETICA,8)));
            }
            if(signature!=null) {
                document.add(new Paragraph("Firma del receptor"));
                Image image=Image.getInstance(signature);image.scaleToFit(350,120);document.add(image);
                document.add(new Paragraph("SHA256 firma: "+sha256(signature),FontFactory.getFont(FontFactory.HELVETICA,8)));
            }
            document.add(new Paragraph("La fecha indicada corresponde a la recepción en servidor. Los hashes permiten verificar integridad; no equivalen a una firma digital certificada.",FontFactory.getFont(FontFactory.HELVETICA,8)));

            // Footer
            document.add(new Paragraph(" "));
            document.add(new Paragraph("Este es un documento generado automáticamente por el sistema EcoRoute.", 
                    FontFactory.getFont(FontFactory.HELVETICA, 8, Color.GRAY)));

            document.close();
        } catch (Exception e) {
            throw new RuntimeException("Error generating PDF", e);
        }
        
        return out.toByteArray();
    }
    private String sha256(byte[] bytes) throws java.security.NoSuchAlgorithmException {
        return java.util.HexFormat.of().formatHex(java.security.MessageDigest.getInstance("SHA-256").digest(bytes));
    }
}
