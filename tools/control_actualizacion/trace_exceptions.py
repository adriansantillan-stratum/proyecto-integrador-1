"""Read actual JUnit reports and emit only the assigned exception/trace artifacts.

python -B -X utf8 tools/control_actualizacion/trace_exceptions.py [--check]
No test execution, HTTP, SQL, ADB, Docker, old inventory writes or document edits.
"""
from __future__ import annotations
import argparse
from collections import Counter
import csv
import hashlib
import io
import json
import os
from pathlib import Path
import re
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "docs/control_actualizacion"
INV = "docs/control_actualizacion/inventario_trazabilidad.json"
HISTORICAL_INV = "docs/correccion_integral/inventario_trazabilidad.json"
JAVA = "src/main/java/com/ecoroute/backend/"
UNIT = "src/test/java/com/ecoroute/backend/application/usecases/"
JAVA_REPORTS = "build/exceptions_actualizacion/test-results/test"
WEB_REPORT = "build/exceptions_actualizacion/exceptions_web_junit.xml"
NEW_CLASSES = {"WorkflowExceptionUseCasesTest", "WorkflowDecisionExceptionsTest", "WorkflowActorExceptionsTest",
               "WorkflowReviewGateExceptionsTest", "ProofIdempotencyExceptionsTest"}

# Assertions are associated with narrow function boundaries, never a blanket BPMN PASS.
CASES = [
    ("EXC-01", "Asignación/reasignación e invalidación de planes", ["P02_A5", "P02_A6"], ["RF-19", "RF-23"],
     [("WorkflowExceptionUseCasesTest", "reassignmentInvalidatesBothPlansBeforeSavingSameOrder"),
      ("WorkflowExceptionUseCasesTest", "unconfirmedReassignmentDoesNotSubscribeInvalidationsOrSave"),
      ("WorkflowExceptionUseCasesTest", "dispatchedOrTerminalOrderCannotBeReassigned"),
      ("WorkflowExceptionUseCasesTest", "dispatchedSourceRouteCannotBeReassigned"),
      ("WorkflowReviewGateExceptionsTest", "assignmentRequiresEveryCommercialCheck"), ("WEB", "EXC-W01")],
     [("application/usecases/OrderUseCasesImpl.java", "assignOrder")],
     "Mismo ID/tracking; invalidar origen/destino antes de guardar; bloquear sin confirmación, con origen despachado o pedido ya despachado/terminal.",
     "Puertos y repositorios sustituidos: no demuestra bloqueo SQL, carrera concurrente, commit/rollback ni control UI de reasignación."),
    ("EXC-02", "Despacho bloqueado por revisión/aceptación", ["P02_A10", "P02_A12", "P02_A14"], ["RF-29", "RF-30", "RNF-31"],
     [("WorkflowReviewGateExceptionsTest", "dispatchRequiresBothDecisions"),
      ("WorkflowExceptionUseCasesTest", "dispatchWithoutReviewDoesNotSubscribePlanningOrSave"),
      ("WorkflowDecisionExceptionsTest", "ownerCannotAcceptUnapprovedPlan"), ("RouteUseCasesImplTest", "rejectEmptyDispatch")],
     [("application/usecases/RouteUseCasesImpl.java", "updateRouteStatus"),
      ("application/services/BusinessWorkflowService.java", "accept"),
      ("infrastructure/output/persistence/R2dbcBusinessWorkflowAdapter.java", "requireDispatchReview")],
     "Ambas decisiones requeridas; el rechazo impide suscribir planificación/guardado; dueño no acepta plan sin aprobar; vacío rechazado.",
     "RNF-31 queda relacionado, no probado: no se simulan fallos transaccionales ni se verifica rollback en BD."),
    ("EXC-03", "Cancelación de ruta y conservación de paradas", ["P02_A13", "P02_A14"], ["RF-23", "RNF-24"],
     [("WorkflowExceptionUseCasesTest", "cancellationWithOpenStopsIsRejected"),
      ("WorkflowExceptionUseCasesTest", "emptyRouteCancellationDoesNotCreateOrCancelOrders"),
      ("WorkflowExceptionUseCasesTest", "cancellationWithTerminalStopsPreservesTheirOutcomes"),
      ("WorkflowExceptionUseCasesTest", "closedRouteCannotRestart"), ("WEB", "EXC-W04")],
     [("application/usecases/RouteUseCasesImpl.java", "updateRouteStatus")],
     "Paradas abiertas bloquean CANCELLED; ruta vacía o con paradas terminales conserva sus pedidos; ruta cerrada no se reinicia.",
     "Cancelación técnica de ruta: no se equipara a desistimiento comercial P01 ni a cancelación de compra P09. El enum OrderStatus no define CANCELLED."),
    ("EXC-04", "RETRY crea otro intento y conserva original", ["P04_A5", "P04_A6"], ["RF-23", "RF-78", "RNF-24"],
     [("BusinessOperationsServiceTest", "retryNeverReopensOriginalOrder"),
      ("BusinessOperationsServiceTest", "closedJourneyRequiresReplan"), ("WEB", "EXC-W02")],
     [("application/services/BusinessOperationsService.java", "resolve")],
     "Nuevo pedido IN_TRANSIT vinculado; resultado original no se reabre; jornada cerrada exige replanificar.",
     "Aserciones de servicio con repositorios sustituidos; no prueba físicamente otro intento ni confirmación real del cliente."),
    ("EXC-05", "REPLAN exige nueva aceptación y revisión", ["P04_A7", "P02_A5"], ["RF-19", "RF-23", "RNF-29"],
     [("WorkflowDecisionExceptionsTest", "replanCreatesLinkedAssignedAttemptAndRevokesCommercialAcceptanceAndPlan"),
      ("WorkflowDecisionExceptionsTest", "replanRejectsAnAlreadyDispatchedDestinationWithoutCreatingAttempt"), ("WEB", "EXC-W03")],
     [("application/services/BusinessOperationsService.java", "resolve"), ("application/services/BusinessOperationsService.java", "copyConfirmation")],
     "Nuevo ASSIGNED en ruta PLANNED, tracking nuevo y vínculo original/intento; ventana no heredada, customerAccepted=false e invalidación destino.",
     "LinkAttempt se verifica como llamada, no como fila SQL instalada. RNF-29 no se certifica globalmente."),
    ("EXC-06", "Resolución repetida o cierre definitivo por actor", ["P04_A8", "P08_A6"], ["RF-06", "RF-23", "RNF-34"],
     [("BusinessOperationsServiceTest", "resolvedIncidentIsIdempotentForSameOutcome"),
      ("WorkflowDecisionExceptionsTest", "resolvedIncidentCannotChangeDecisionOrCreateAnotherAttempt"),
      ("WorkflowDecisionExceptionsTest", "dispatcherCannotCloseDefinitively"),
      ("WorkflowDecisionExceptionsTest", "managerCloseCasePreservesOrderAndDoesNotCreateAttempt"), ("WEB", "EXC-W05")],
     [("application/services/BusinessOperationsService.java", "resolve")],
     "Misma decisión devuelve resolución; decisión distinta rechazada; cierres definitivos requieren manager; CLOSE_CASE no muta pedido ni genera intento.",
     "El cargo Jefatura no equivale automáticamente a ADMIN. CLOSE_CASE carece de final BPMN propio; asociación a A8 es variante de control, no nodo nuevo."),
    ("EXC-07", "Permisos y propiedad de hoja", ["P02_A10", "P02_A12", "P04_A6", "P08_A6"], ["RF-06", "RNF-34"],
     [("WorkflowActorExceptionsTest", "anonymousCannotApproveOrResolve"),
      ("WorkflowActorExceptionsTest", "dispatcherCannotApproveManagementPlan"),
      ("WorkflowActorExceptionsTest", "administratorCannotImpersonateDriverAcceptance"),
      ("WorkflowActorExceptionsTest", "driverCannotResolveOperationalIncident"),
      ("WorkflowActorExceptionsTest", "administratorApprovalUsesAuthenticatedSubject"),
      ("WorkflowDecisionExceptionsTest", "driverCannotAcceptAnotherDriversSheet")],
     [("infrastructure/input/rest/BusinessWorkflowController.java", "approve"),
      ("infrastructure/input/rest/BusinessWorkflowController.java", "accept"),
      ("infrastructure/input/rest/BusinessOperationsController.java", "resolve"),
      ("application/services/BusinessWorkflowService.java", "accept")],
     "401 anónimo, 403 por rol, ADMIN no suplanta DRIVER, subject autenticado y bloqueo de hoja ajena.",
     "HTTP en memoria con SecurityConfig real y servicios/decoder sustituidos; no prueba firma JWT, proveedor Keycloak ni cuentas reales."),
    ("EXC-08", "POD duplicado o entrega sin prueba recuperable", ["P03_A8", "P03_A11", "P03_A12", "P03_A13"], ["RF-53", "RF-54", "RNF-29"],
     [("ProofIdempotencyExceptionsTest", "repeatedDeliveredRequestsReturnStoredProofWithoutSecondBusinessEffect"),
      ("ProofIdempotencyExceptionsTest", "deliveredWithoutStoredProofRequiresReconciliationAndDoesNotReupload"),
      ("DeliveryProofRulesTest", "deliveredRetryReturnsExistingProofWithoutUploads")],
     [("application/usecases/CreateDeliveryProofUseCaseImpl.java", "createDeliveryProof")],
     "Dos reenvíos DELIVERED retornan el POD existente sin segunda subida, cierre, auditoría o notificación; sin POD exige conciliación.",
     "Prepara estado entregado con repositorio simulado; no prueba primera subida S3, concurrencia, reinicio móvil ni almacenamiento físico."),
    ("EXC-09", "Cambios comerciales/ventana invalidan decisiones", ["P01_A6", "P01_A8b", "P02_A10", "P02_A12"], ["RF-17", "RF-19", "RF-29"],
     [("WorkflowDecisionExceptionsTest", "commercialChangeInvalidatesPlanAndPersistsAuthenticatedActor"),
      ("OrderUseCasesImplTest", "newDeliveryWindowRequiresFreshCustomerAcceptance"),
      ("OrderUseCasesImplTest", "noWindowChangeAfterDispatch")],
     [("application/services/BusinessWorkflowService.java", "confirm"), ("application/usecases/OrderUseCasesImpl.java", "changeDeliveryWindow")],
     "Cambio comercial invalida revisión y conserva actor; nueva ventana revoca aceptación previa; después de despacho se rechaza.",
     "Persistencia se observa en puertos sustituidos. No acredita comunicación ni aceptación humana del cliente."),
]


def sha(file): return hashlib.sha256((ROOT / file).read_bytes()).hexdigest()
def unique(items): return list(dict.fromkeys(items))
def read(file): return (ROOT / file).read_text(encoding="utf-8-sig")
def loc(file, pattern):
    match = re.search(pattern, read(file), re.M)
    assert match, (file, pattern)
    return {"file":file,"line":read(file)[:match.start()].count("\n")+1}
def link(label, file, line=None):
    target=Path(os.path.relpath(ROOT/file,OUT)).as_posix()
    return f"[{label}](<{target}{'#L'+str(line) if line else ''}>)"
def escaped(value): return str(value).replace('|','\\|').replace('\n',' ')


def reports():
    tests=[]; receipts=[]; suites=[]
    for path in sorted((ROOT/JAVA_REPORTS).glob("TEST-*.xml")):
        file=path.relative_to(ROOT).as_posix(); root=ET.parse(path).getroot()
        suite=root.attrib["name"]; short=suite.rsplit('.',1)[-1]
        source="src/test/java/"+suite.replace('.','/')+".java"
        receipts.append({"file":file,"sha256":sha(file)})
        suites.append({"suite":suite,"file":file,"tests":int(root.get('tests','0')),
                       "failures":int(root.get('failures','0')),"errors":int(root.get('errors','0')),
                       "timestampAsRecorded":root.get('timestamp')})
        for c in root.findall("testcase"):
            name=c.attrib["name"]; method=re.split(r"[\[(]",name)[0]
            source_ref=loc(source,r"\bvoid\s+"+re.escape(method)+r"\s*\(")
            status="FAIL" if c.find('failure') is not None else "ERROR" if c.find('error') is not None else "SKIPPED" if c.find('skipped') is not None else "PASS"
            tests.append({"id":suite+"::"+name,"suite":short,"name":name,"method":method,
                          "status":status,"statusBasis":"parsed_actual_junit_testcase",
                          "kind":"IN_MEMORY_HTTP_SECURITY" if short=="WorkflowActorExceptionsTest" else "LOCAL_UNIT_MOCKED_PORTS",
                          "newThisTask":short in NEW_CLASSES,"sourceEvidence":source_ref,
                          "executionEvidence":{"file":file,"testcaseName":name},"durationSeconds":c.get('time')})
    assert len(suites)==10, len(suites)
    root=ET.parse(ROOT/WEB_REPORT).getroot(); receipts.append({"file":WEB_REPORT,"sha256":sha(WEB_REPORT)})
    for c in root.iter("testcase"):
        source=Path(c.attrib["file"]).relative_to(ROOT).as_posix()
        name=c.attrib['name']; status="FAIL" if c.find('failure') is not None else "ERROR" if c.find('error') is not None else "SKIPPED" if c.find('skipped') is not None else "PASS"
        tests.append({"id":"WEB::"+name,"suite":"WEB","name":name,"method":name,
                      "status":status,"statusBasis":"parsed_actual_node_junit_testcase",
                      "kind":"WEB_SERVICE_IN_MEMORY_TRANSPORT" if name.startswith('EXC-W') else "EXISTING_WEB_LOCAL_UNIT_OR_SOURCE_CHECK",
                      "newThisTask":name.startswith('EXC-W'),"sourceEvidence":{"file":source},
                      "executionEvidence":{"file":WEB_REPORT,"testcaseName":name},"durationSeconds":c.get('time')})
    assert tests and len({t['id'] for t in tests})==len(tests)
    assert all(t['status']=='PASS' for t in tests), "No ocultar fallos de pruebas"
    return tests,receipts,suites


def build():
    inventory_raw=(ROOT/INV).read_bytes(); inv=json.loads(inventory_raw)
    tests,receipts,suites=reports()
    process_by_id={p['id']:p for p in inv['processes']}
    all_nodes={n['id']:n for p in inv['processes'] for n in p['nodes']}
    reqs={r['id']:r for r in inv['requirements']}
    exceptions=[]
    for eid,name,node_ids,requirement_ids,selectors,functions,assertion,limit in CASES:
        selected=[]
        for suite,prefix in selectors:
            matching=[t for t in tests if t['suite']==suite and (t['name'].startswith(prefix) if suite=='WEB' else t['method']==prefix)]
            assert matching,(eid,suite,prefix)
            selected.extend(matching)
        assert set(node_ids)<=all_nodes.keys() and set(requirement_ids)<=reqs.keys()
        function_refs=[{**loc(JAVA+file,r"^[ \t]*(?:public|private|protected)[ \t]+[^\n]+?\b"+re.escape(function)+r"\s*\("),"function":function} for file,function in functions]
        exceptions.append({"id":eid,"name":name,"nodeIds":node_ids,"processIds":unique(n.split('_')[0] for n in node_ids),
                           "relatedRequirementIds":requirement_ids,"requirementBasis":"editorial_scope_of_assertion_not_full_requirement_acceptance",
                           "functions":function_refs,"assertionScope":assertion,"limits":limit,
                           "testIds":unique(t['id'] for t in selected),"technicalResult":"PASS_FOR_LISTED_ASSERTIONS",
                           "resultBasis":"all_linked_executed_junit_cases_passed","nodeResult":None,
                           "businessAcceptance":"PENDING_IDENTIFIED_VALIDATOR"})
    snapshot={f['file']:f['sha256'] for f in inv['snapshot']['files']}
    nodes=[]
    for i,t in enumerate(inv['traces']):
        n=all_nodes[t['id']]; pid=t['processId']; p=process_by_id[pid]
        related=[e for e in exceptions if n['id'] in e['nodeIds']]
        links=t['links']
        screens=unique(s['screenId'] for entry in links for s in entry.get('screens',[]))
        source_files=unique([*screens,*[e['file'] for entry in links for e in entry.get('codeEvidence',[])]])
        freshness=[{'file':f,'currentSha256':sha(f),'inventorySha256':snapshot.get(f),
                    'matchesSnapshot':sha(f)==snapshot.get(f)} for f in source_files]
        routing=n['type'] in ('startEvent','endEvent','exclusiveGateway')
        nodes.append({"id":n['id'],"name":n['name'],"processId":pid,"processName":p['name'],"actor":n['actor'],"type":n['type'],
                      "classification":"ROUTING" if routing else n['mapping'],
                      "sourceEvidence":n['sourceEvidence'],"inventoryReference":{"file":INV,"jsonPointer":f"/traces/{i}"},
                      "processScopeRequirementIds":t['requirements'],"requirementBasis":t['requirementsBasis'],
                      "screenIds":screens,"unconnectedScreenCandidates":unique(s for entry in links for s in entry.get('unconnectedScreenCandidates',[])),
                      "endpoints":unique(entry['endpointId'] for entry in links if entry.get('endpointId')),
                      "functionIds":unique(entry['methodId'] for entry in links if entry.get('methodId')),
                      "staticLinks":[{"capability":entry['capability'],"endpointId":entry.get('endpointId'),"methodId":entry.get('methodId'),
                                      "codeEvidence":entry.get('codeEvidence',[]),"sourceReference":{"file":INV,"jsonPointer":f"/traces/{i}/links/{j}"}}
                                     for j,entry in enumerate(links)],
                      "exceptionIds":[e['id'] for e in related],"relatedExecutedTestIds":unique(test for e in related for test in e['testIds']),
                      "technicalStatus":"FUNCTION_BOUNDARY_ASSERTIONS_RELATED_NOT_NODE_PASS" if related else 'PENDING_BRANCH_EXECUTION' if routing else 'HUMAN_OR_EXTERNAL_EVIDENCE_REQUIRED' if n['mapping'] in ('manual','external') else 'STATIC_LINK_ONLY',
                      "nodeResult":None,"explicitUatIds":[u['id'] for u in inv['uatTests'] if n['id'] in u['nodeIds']],
                      "humanEvidenceRequired":n['mapping'] in ('manual','external'),
                      "humanEvidenceStatus":"PENDING" if n['mapping'] in ('manual','external') else "NOT_ASSESSED",
                      "uatExecutionThisTask":"NO_EJECUTADO","businessAcceptance":"PENDING_IDENTIFIED_VALIDATOR","sourceFreshness":freshness})
    gap={"id":"EX-GAP-UI-REASSIGN","status":"REPORTED_FOR_PRINCIPAL_COORDINATION_NO_PRODUCT_EDIT",
         "description":"Backend permite ASSIGNED→otra ruta PLANNED; OrderAssignment y canAssign solo ofrecen PENDING. Reasignación probada a nivel backend, sin control web equivalente para ASSIGNED.",
         "sourceEvidence":[loc('web-admin/src/utils/operation.ts',r"export function canAssign"),
                           loc('web-admin/src/pages/Orders.tsx',r"order.status === 'PENDING' &&"),
                           loc(JAVA+'application/usecases/OrderUseCasesImpl.java',r"public Mono<Order> assignOrder")],
         "action":"Principal decide/coordina un cambio de producto; este worker no lo implementa.","productEditedHere":False}
    evidence_files=unique([INV,HISTORICAL_INV,'tools/audit_e2e/trace_inventory.py','tools/control_actualizacion/exceptions.init.gradle',
                          *[t['sourceEvidence']['file'] for t in tests],
                          *[f['file'] for e in exceptions for f in e['functions']],
                          *[f['file'] for f in gap['sourceEvidence']],
                          'web-admin/src/services/orderService.ts','web-admin/src/services/routeService.ts','web-admin/src/services/incidentService.ts',
                          JAVA+'infrastructure/config/SecurityConfig.java',*[p['source'] for p in inv['processes']]])
    receipts.extend({'file':file,'sha256':sha(file)} for file in evidence_files)
    process_rows=[{"id":p['id'],"name":p['name'],"source":p['source'],"nodes":len(p['nodes']),
                   "actors":unique(l['actor'] for l in p['lanes']),
                   "relatedExceptionIds":[e['id'] for e in exceptions if p['id'] in e['processIds']],
                   "scope":"Narrow function assertions only" if any(p['id'] in e['processIds'] for e in exceptions) else 'STATIC_TRACE_NO_NEW_EXCEPTION_ASSERTIONS'} for p in inv['processes']]
    requirement_rows=[]
    for requirement in inv['requirements']:
        related=[e for e in exceptions if requirement['id'] in e['relatedRequirementIds']]
        requirement_rows.append({'id':requirement['id'],'description':requirement['description'],
                                 'sourceEvidence':requirement['sourceEvidence'],
                                 'processScopeNodeIds':requirement['traceNodeIds'],
                                 'processScopeIds':unique(n.split('_')[0] for n in requirement['traceNodeIds']),
                                 'relatedExceptionIds':[e['id'] for e in related],
                                 'relatedExecutedTestIds':unique(t for e in related for t in e['testIds']),
                                 'associationBasis':'explicit_narrow_exception_scope_or_original_static_process_mapping_not_requirement_acceptance',
                                 'status':'NARROW_ASSERTIONS_RELATED_FULL_REQUIREMENT_UNVERIFIED' if related else 'STATIC_SCOPE_ONLY' if requirement['traceNodeIds'] else 'NO_PROCESS_SCOPE_IN_GENERATOR',
                                 'requirementResult':None,'businessAcceptance':'PENDING_IDENTIFIED_VALIDATOR'})
    assert len(nodes)==199 and len(process_rows)==9 and len(reqs)==135
    mobile_files=['mobile-app/lib/core/network/map_tiles.dart',
                  'mobile-app/lib/features/routes/presentation/widgets/recoverable_tile_layer.dart',
                  'mobile-app/test/map_recovery_test.dart']
    receipts.extend({'file':file,'sha256':sha(file)} for file in mobile_files)
    mobile_support={"id":"MOBILE_ROUTES_MAP_SUPPORT","classification":"SUPPORT_COMPONENT_NOT_BUSINESS_SCREEN",
                    "processIds":["P03","P07"],"parentScreenId":"mobile-app/lib/features/routes/presentation/pages/routes_page.dart",
                    "nodeAssociationsProposed":["P03_A1","P07_A1","P07_A4","P07_A7"],
                    "associationBasis":"static_routes_page_import_and_widget_composition_not_individual_business_assertion",
                    "sourceEvidence":[loc(mobile_files[0],r'class CachedMapTileProvider'),
                                      loc(mobile_files[1],r'class RecoverableTileLayer'),
                                      loc(mobile_files[1],r'class MapAttribution'),
                                      loc('mobile-app/lib/features/routes/presentation/pages/routes_page.dart',r'const RecoverableTileLayer\(')],
                    "testSourceEvidence":{"file":mobile_files[2]},
                    "testNamesLocated":re.findall(r"(?:test|testWidgets)\('([^']+)'",read(mobile_files[2])),
                    "executionHere":"NOT_EXECUTED_BY_THIS_WORKER",
                    "principalReported":{"hostPassed":84,"hostIntentionallySkipped":8,"optInPassed":8,
                                         "source":"direct_user_message_from_principal","independentlyRerunHere":False,
                                         "analyze":"ISSUE_PENDING_PRINCIPAL_RESOLUTION","apk4005":"PRINCIPAL_WILL_VERIFY_NOT_ATTESTED_HERE"},
                    "limits":["Basemap recovery preserves independent route drawing; does not prove GPS accuracy or business delivery.",
                              "Viewed-tile cache is support; no offline area download or physical field acceptance inferred.",
                              "New components do not increase the nine business processes or 199 BPMN nodes."]}
    for node in nodes:
        node['supportComponentIds']=[mobile_support['id']] if node['id'] in mobile_support['nodeAssociationsProposed'] else []
    if (ROOT/'docs/control_actualizacion/trace_checks.json').is_file():
        receipts.append({'file':'docs/control_actualizacion/trace_checks.json','sha256':sha('docs/control_actualizacion/trace_checks.json')})
    data={"schemaVersion":"1.0","scope":"LOCAL_EXCEPTION_TESTS_AND_STATIC_TRACE","generator":"tools/control_actualizacion/trace_exceptions.py",
          "sourceInventory":{"file":INV,"sha256":hashlib.sha256(inventory_raw).hexdigest(),'generatedAtReported':inv['generatedAt'],'modifiedHere':False},
          "policy":{"testResultsOnlyFromActualJunit":True,"processOrNodePassInferred":False,"all135RequirementsClaimedTested":False,
                    "requirementsCountMeaning":"135 requisitos localizados en fuente; NO 135 requisitos probados",
                    "noNetworkApiWrites":True,"noDatabaseOrAdbOrDockerRebuild":True,"physicalField":"NO_EJECUTADO",
                    "businessAcceptance":"PENDING_IDENTIFIED_VALIDATOR"},
          "execution":{"javaSuites":suites,"javaTestCount":sum(t['suite']!='WEB' for t in tests),'webTestCount':sum(t['suite']=='WEB' for t in tests),
                       "newTestCount":sum(t['newThisTask'] for t in tests),"testStatusCounts":dict(Counter(t['status'] for t in tests)),
                       "javaCommand":"gradlew.bat --offline --no-daemon -I tools/control_actualizacion/exceptions.init.gradle test --tests '*Workflow*ExceptionsTest' --tests '*WorkflowExceptionUseCasesTest' --tests '*ProofIdempotencyExceptionsTest' --tests '*OrderUseCasesImplTest' --tests '*RouteUseCasesImplTest' --tests '*OrderLifecycleTest' --tests '*DeliveryProofRulesTest' --tests '*BusinessOperationsServiceTest'",
                       "webCommand":"node --test --test-reporter=junit --test-reporter-destination=../build/exceptions_actualizacion/exceptions_web_junit.xml tests/*.test.mjs",
                       "javaScope":"Mockito + StepVerifier + in-memory WebFluxTest; adapter decision reads replaced in memory. Testcontainers excluded.",
                       "webScope":"Node local tests; new service functions execute with an in-memory transport. No running API, login or browser.",
                       "warnings":"Existing compile warning for deprecated MockBean and unchecked operations; no test failure."},
          "inventoryChecksReference":{"file":"docs/control_actualizacion/trace_checks.json","scope":"current_source_structural_checks_not_UAT_or_product_execution"},
          "processes":process_rows,"requirements":requirement_rows,"exceptions":exceptions,"nodes":nodes,"tests":tests,"findings":[gap],"mobileSupport":[mobile_support],"sourceReceipts":receipts,
          "limits":["No test in this worker certifies full BPMN node, branch, handoff or business UAT.",
                    "P05/P06/P07/P09 remain mapped using existing inventory; no new exception assertions assigned by process proximity.",
                    "RF-19 source wording says assignment at registration, while implemented flow separates P01 registration and P02 confirmation/assignment. This is a semantic difference, not a passed requirement.",
                    "Commercial cancellation P01 and purchase cancellation P09 require human evidence; route CANCELLED does not implement them.",
                    "SQL integrity/rollback, concurrency, actual storage, Keycloak, field device and enterprise acceptance remain outside this run.",
                    "Static links retain historical pointer and line. Current file hashes identify freshness; mappings are not runtime calls.",
                    "No change to old inventory, trace_inventory.py, Word, PPT, product source, accounts or .env by this worker."]}
    assert all(sha(r['file'])==r['sha256'] for r in receipts), 'Source changed during trace generation'
    return data


def markdown(data):
    ex=data['execution']; lines=[
        '# Excepciones y trazabilidad — actualización local', '',
        f"Pruebas ejecutadas: **{ex['javaTestCount']} Java + {ex['webTestCount']} web**, "
        f"{ex['newTestCount']} casos nuevos incluidos. Todos los resultados de ejecución se extraen de JUnit real; "
        'no se precargan PASS. Son aserciones acotadas de funciones, no aceptación de procesos ni de 135 requisitos.', '',
        'Alcance: reglas de asignación/reasignación, despacho, cancelación técnica de ruta, RETRY/REPLAN, '
        'permisos por actor e idempotencia POD. Repositorios, transportes y lecturas se sustituyen en memoria. '
        'WebFluxTest usa la configuración de seguridad real y un cliente HTTP en memoria; no envía escrituras a una API en ejecución. '
        'Sin BD, ADB, reconstrucción Docker, Word/PPT ni cambios de producto por este worker.', '',
        'Aceptación empresarial: PENDING_IDENTIFIED_VALIDATOR. Campo físico: NO_EJECUTADO. '
        'Los nombres, cargos, acuerdos del cliente y evidencia humana no se deducen de pruebas automáticas.', '',
        'Artefactos: [JSON completo](excepciones_trazabilidad.json), [CSV por nodo](excepciones_trazabilidad.csv), '+
        link('inventario NUEVO actual',INV)+', '+link('generador de esta traza','tools/control_actualizacion/trace_exceptions.py')+'. '
        'El inventario histórico se conserva en '+link('docs/correccion_integral',HISTORICAL_INV)+'. '
        'Las comprobaciones de fuentes actuales están en '+link('trace_checks.json','docs/control_actualizacion/trace_checks.json')+'.', '',
        '## Verificación ejecutada', '',
        '| Suite | Casos | Fallos | Errores | Evidencia |', '|---|---:|---:|---:|---|']
    for suite in ex['javaSuites']:
        lines.append(f"| {suite['suite'].rsplit('.',1)[-1]} | {suite['tests']} | {suite['failures']} | {suite['errors']} | {link('JUnit XML',suite['file'])} |")
    lines += [f"| Web Node (incluye pruebas existentes) | {ex['webTestCount']} | 0 | 0 | {link('JUnit XML',WEB_REPORT)} |", '',
              'Comandos reproducibles (desde raíz para Java y desde web-admin para web):', '',
              '```powershell',ex['javaCommand'],ex['webCommand'],'```', '',
              'Advertencias del compilador: MockBean deprecado y operaciones sin comprobación de tipos en pruebas existentes; '
              'las suites finalizaron correctamente. No se ejecutó Testcontainers ni una prueba transaccional contra SQL.', '',
              '## Excepciones críticas y límites de cada resultado', '']
    tests={t['id']:t for t in data['tests']}
    for e in data['exceptions']:
        lines += [f"### {e['id']} — {e['name']}", '',
                  'Nodos relacionados editorialmente: '+', '.join(e['nodeIds'])+'. Requisitos relacionados: '+', '.join(e['relatedRequirementIds'])+'. '
                  'La relación no acredita cada requisito ni cada nodo completo.', '',
                  'Aserción: '+e['assertionScope'], '',
                  'Límite: '+e['limits'], '',
                  'Funciones actuales: '+', '.join(link(f['function'],f['file'],f['line']) for f in e['functions'])+'.', '',
                  'Pruebas reales relacionadas:', '']
        for test_id in e['testIds']:
            t=tests[test_id]; s=t['sourceEvidence']
            lines.append('- '+link(t['suite']+'::'+t['name'],s['file'],s.get('line'))+' — '+t['status']+'; '+link('evidencia XML',t['executionEvidence']['file']))
        lines.append('')
    lines += ['## Hallazgo para coordinación del principal', '']
    for f in data['findings']:
        lines += [f"{f['id']} — {f['status']}. {f['description']}", '',
                  'Fuentes: '+', '.join(link(Path(r['file']).name,r['file'],r['line']) for r in f['sourceEvidence'])+'.', '',f['action'], '']
    lines += ['## Soporte móvil nuevo de rutas: P03/P07', '']
    for m in data['mobileSupport']:
        lines += ['Clasificación: **SUPPORT_COMPONENT_NOT_BUSINESS_SCREEN**. CachedMapTileProvider, RecoverableTileLayer y MapAttribution '
                  'son soporte del mapa de routes_page; no nuevas pantallas de negocio. Relación editorial con '+', '.join(m['nodeAssociationsProposed'])+'.', '',
                  'Fuentes: '+', '.join(link(Path(r['file']).name,r['file'],r['line']) for r in m['sourceEvidence'])+'.', '',
                  'Tres pruebas localizadas en '+link('map_recovery_test.dart',m['testSourceEvidence']['file'])+':', '',
                  *['- '+name for name in m['testNamesLocated']], '',
                  'Resultados reportados directamente por el principal: 84 host PASS, 8 host omitidos intencionalmente y 8 opt-in PASS. '
                  'No fueron reejecutados por este worker ni se suman al total Java/web. '
                  'El issue de analyze y la prueba de APK4005 corresponden al principal y no se dan por resueltos aquí. '
                  'No se infiere cobertura RF total, exactitud GPS ni aceptación de campo.', '']
    lines += ['## P01–P09: matriz de procesos y nodos', '',
              'Los nombres son los del BPMN real, no títulos históricos de una presentación. Las flechas de código '
              'son asociaciones estáticas; pantalla importada, API y método no significan recorrido UI ejecutado. '
              'Los 109 nodos de inicio/compuerta/final se clasifican como enrutamiento, sin convertirlos en defectos de código.', '']
    for p in data['processes']:
        lines += [f"### {p['id']} — {p['name']}", '',
                  f"{p['nodes']} nodos; actores: {', '.join(p['actors'])}. Alcance: {p['scope']}. "
                  'Excepciones relacionadas: '+(', '.join(p['relatedExceptionIds']) or 'ninguna nueva en este worker')+'.', '',
                  '| Nodo (fuente BPMN) | Actor / tipo | Requisitos de alcance | Pantalla / soporte | API y función | Prueba / estado |',
                  '|---|---|---|---|---|---|']
        for n in data['nodes']:
            if n['processId']!=p['id']: continue
            s=n['sourceEvidence']; title=n['name'] or 'Convergencia sin etiqueta'
            screen=', '.join(Path(f).name for f in n['screenIds']) or 'Sin enlace UI técnico'
            if n['supportComponentIds']: screen+='; MOBILE_ROUTES_MAP_SUPPORT'
            methods='; '.join(n['endpoints'])+'<br>'+'; '.join(n['functionIds'])
            state=', '.join(n['exceptionIds'])+' / '+n['technicalStatus']
            row=[link(n['id'],s['file'],s['line'])+' '+title,n['actor']+' / '+n['type'],', '.join(n['processScopeRequirementIds']),screen,methods,state]
            lines.append('| '+' | '.join(escaped(v) for v in row)+' |')
        lines.append('')
    lines += ['## Límites de cobertura y reproducibilidad','']
    lines += ['- '+v for v in data['limits']]
    lines += ['', 'Los campos nodeResult permanecen null. 135 es el número de requisitos del inventario, '
              'no requisitos probados ni porcentaje de cobertura. El registro JSON conserva los 135, con requirementResult=null; '
              '26 carecen de asignación de proceso en el generador actual y se mantienen visibles, sin completarla por intuición. '
              'Los acuses, cancelaciones comerciales, documentos '
              'de aptitud y decisiones de empresa mantienen su evidencia humana pendiente.', '',
              'Cambios de este worker: cinco clases nuevas de tests de workflow/usecases, un archivo nuevo de tests web, '
              'exceptions.init.gradle, trace_exceptions.py y estos entregables JSON/CSV/MD más informes nuevos de ejecución/inventario. '
              'No se editan pruebas anteriores ni fuentes de producto.','']
    return '\n'.join(lines)


def csv_trace(data):
    output=io.StringIO(newline=''); writer=csv.writer(output,delimiter=';',lineterminator='\n')
    writer.writerow(['processId','processName','nodeId','nodeName','actor','type','scopeRequirementIds','screenIds','supportComponentIds','endpoints','functionIds','exceptionIds','relatedExecutedTestIds','technicalStatus','nodeResult','businessAcceptance'])
    for n in data['nodes']:
        values=[n['processId'],n['processName'],n['id'],n['name'],n['actor'],n['type'],','.join(n['processScopeRequirementIds']),
                ','.join(n['screenIds']),','.join(n['supportComponentIds']),','.join(n['endpoints']),','.join(n['functionIds']),
                ','.join(n['exceptionIds']),','.join(n['relatedExecutedTestIds']),n['technicalStatus'],'',n['businessAcceptance']]
        writer.writerow(["'"+v if re.match(r'^[=+@-]',v) else v for v in values])
    return '\ufeff'+output.getvalue()


def main():
    parser=argparse.ArgumentParser(description=__doc__); parser.add_argument('--check',action='store_true'); args=parser.parse_args()
    data=build(); outputs={'excepciones_trazabilidad.json':json.dumps(data,ensure_ascii=False,indent=2)+'\n',
                          'excepciones_trazabilidad.csv':csv_trace(data),'EXCEPCIONES_Y_TRAZABILIDAD.md':markdown(data)}
    for name,text in outputs.items():
        target=OUT/name
        if args.check: assert target.read_text(encoding='utf-8')==text,name
        else:
            if target.exists():
                old=target.read_text(encoding='utf-8')
                assert ('tools/control_actualizacion/trace_exceptions.py' in old if name.endswith('.json') else old.startswith('# Excepciones y trazabilidad') if name.endswith('.md') else old.startswith('\ufeffprocessId;processName;nodeId;')),name
            target.write_text(text,encoding='utf-8',newline='\n')
    print(json.dumps({'mode':'check_only' if args.check else 'generated','outputs':list(outputs),'java':data['execution']['javaTestCount'],
                      'web':data['execution']['webTestCount'],'new':data['execution']['newTestCount'],'statusCounts':data['execution']['testStatusCounts'],
                      'processes':len(data['processes']),'nodes':len(data['nodes']),'requirementsProved':'NOT_INFERRED','businessAcceptance':'PENDING'},ensure_ascii=False))


if __name__=='__main__': main()
