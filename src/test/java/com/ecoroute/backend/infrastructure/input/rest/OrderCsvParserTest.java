package com.ecoroute.backend.infrastructure.input.rest;
import jakarta.validation.Validation;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;
class OrderCsvParserTest {
    final OrderCsvParser parser=new OrderCsvParser(Validation.buildDefaultValidatorFactory().getValidator());
    final String header="trackingNumber,recipientName,deliveryAddress,latitude,longitude,externalReference,routeId,recipientPhone,recipientEmail,deliveryCity,deliveryDistrict\r\n";
    @Test void quotedCommasAndEscapedQuotesArePreserved() {
        var result=parser.parse(header+"TRACK-001,Cliente,\"Av. Lima, local \"\"A\"\"\",-12.04,-77.04,,,999123456,,,\r\n");
        assertEquals(1,result.size());assertEquals("Av. Lima, local \"A\"",result.get(0).deliveryAddress());
        assertNull(result.get(0).routeId());assertNull(result.get(0).deliveryDistrict());
    }
    @Test void malformedRowRejectsEntireBatchWithRowNumber() {
        var error=assertThrows(IllegalArgumentException.class,()->parser.parse(header+"TRACK-001,Cliente,Lima,-12,-77,,,999123456,,,\nINVALID\n"));
        assertTrue(error.getMessage().contains("Fila 3"));assertTrue(error.getMessage().contains("ningún pedido"));
    }
    @Test void preassignedImportIsRejected() {
        assertThrows(IllegalArgumentException.class,()->parser.parse(header+"TRACK-001,Cliente,Lima,-12,-77,,15,999123456,,,\n"));
    }
    @Test void duplicateTrackingIsRejected() {
        String row="TRACK-001,Cliente,Lima,-12,-77,,,999123456,,,\n";
        assertThrows(IllegalArgumentException.class,()->parser.parse(header+row+row));
    }
    @Test void unterminatedQuotesAreRejected() {
        assertThrows(IllegalArgumentException.class,()->parser.parse(header+"TRACK-001,Cliente,\"Lima\n"));
    }
    @Test void invalidPhoneCannotBypassHttpValidation() {
        assertThrows(IllegalArgumentException.class,()->parser.parse(header+"TRACK-001,Cliente,Lima,-12,-77,,,123,,,\n"));
    }
}
