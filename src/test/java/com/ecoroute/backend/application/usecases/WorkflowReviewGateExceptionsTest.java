package com.ecoroute.backend.application.usecases;

import com.ecoroute.backend.domain.exception.BusinessRuleException;
import com.ecoroute.backend.domain.model.BusinessWorkflow.*;
import com.ecoroute.backend.infrastructure.output.persistence.R2dbcBusinessWorkflowAdapter;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.springframework.r2dbc.core.DatabaseClient;
import reactor.core.publisher.Mono;
import reactor.test.StepVerifier;
import static org.mockito.Mockito.*;

/** Exercise real decision gates while replacing reads in memory, without SQL. */
class WorkflowReviewGateExceptionsTest {
    @ParameterizedTest(name="dispatchRequiresBothDecisions[{index}] approved={0},accepted={1}")
    @CsvSource({"false,false","false,true","true,false","true,true"})
    void dispatchRequiresBothDecisions(boolean approved,boolean accepted) {
        var db = mock(DatabaseClient.class);
        var adapter = spy(new R2dbcBusinessWorkflowAdapter(db));
        doReturn(Mono.just(new Review(21L,approved,accepted,100.0,null,null,null,null,null))).when(adapter).review(21L);
        var result = StepVerifier.create(adapter.requireDispatchReview(21L));
        if(approved && accepted) result.verifyComplete();
        else result.expectError(BusinessRuleException.class).verify();
        verifyNoInteractions(db);
    }
    @ParameterizedTest(name="assignmentRequiresEveryCommercialCheck[{index}] accepted={0},address={1},coverage={2}")
    @CsvSource({"false,true,true","true,false,true","true,true,false","true,true,true"})
    void assignmentRequiresEveryCommercialCheck(boolean accepted,boolean address,boolean coverage) {
        var db = mock(DatabaseClient.class);
        var adapter = spy(new R2dbcBusinessWorkflowAdapter(db));
        doReturn(Mono.just(new Confirmation(11L,null,accepted,address,coverage,"Acuerdo sintético","actor",null)))
                .when(adapter).confirmation(11L);
        var result = StepVerifier.create(adapter.requireConfirmed(11L));
        if(accepted && address && coverage) result.verifyComplete();
        else result.expectError(BusinessRuleException.class).verify();
        verifyNoInteractions(db);
    }
}
