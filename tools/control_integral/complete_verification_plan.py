"""Design controls for every BPMN node; never records an execution or approval."""
import json
from pathlib import Path
from collections import deque
ROOT=Path(__file__).resolve().parents[2];OUT=ROOT/'docs/control_integral_20261022'
inv=json.loads((OUT/'inventario_base.json').read_text(encoding='utf8'))
cases=[];covered_flows=set()
for process in inv['processes']:
    nodes={n['id']:n for n in process['nodes']}
    starts=[n['id'] for n in nodes.values() if n['type']=='startEvent']
    def path_to(start,predicate):
        queue=deque([(start,[start])]);seen=set()
        while queue:
            current,path=queue.popleft()
            if predicate(current):return path
            if current in seen:continue
            seen.add(current)
            for edge in nodes[current]['salidas']:
                if edge['to'] in nodes:queue.append((edge['to'],path+[edge['to']]))
        return None
    for node in nodes.values():
        route=next((p for s in starts if (p:=path_to(s,lambda n:n==node['id']))),None)
        scenarios=[]
        for edge in node['salidas']:
            target=edge['to'];condition=next((c.get('label') or c.get('expression') for c in node['conditions'] if c['flowId']==edge['flowId']),None)
            scenarios.append({'flowId':edge['flowId'],'condition':condition or 'Continuidad del flujo',
             'nextNode':target,'nextTask':nodes.get(target,{}).get('name'),'candidatePathToEnd':path_to(target,lambda n:nodes[n]['type']=='endEvent') if target in nodes else None,
             'expected':'Seguir únicamente el flujo permitido por los datos y la decisión real; conservar convergencia, actor, bloqueo o final. No aprobar tareas posteriores si falta la precondición.',
             'execution':'NOT_EXECUTED'})
            covered_flows.add(edge['flowId'])
        if not scenarios:scenarios=[{'condition':'Final alcanzado','nextNode':None,'expected':'Registrar el resultado y motivo; detener esta instancia. Si el final deriva a otro proceso, transmitir el mismo caso o su vínculo, sin continuar actividades de la instancia cerrada.','execution':'NOT_EXECUTED'}]
        cases.append({'id':'VCB-'+node['id'],'processId':process['id'],'nodeId':node['id'],'name':node['name'],
            'actor':node['actor'] or 'Responsable funcional del proceso; confirmar en la sesión',
            'type':node['type'],'candidatePathFromStart':route,
            'steps':['Preparar un caso de ensayo aislado y comprobar las precondiciones de las tareas anteriores.',
                     'Recorrer la secuencia candidata desde el inicio; validar su factibilidad de negocio con la persona responsable.',
                     'Para cada escenario listado, reproducir la condición con datos controlados y comprobar el destino, convergencia o final.',
                     'Registrar actor, fecha, resultado, ID operativo, condición y evidencia. Una actividad humana requiere su registro real; una pantalla no acredita la comunicación por sí sola.'],
            'scenarios':scenarios,'requiredEvidence':['Precondiciones e identificadores de ensayo','Actor/rol y fecha','Condición observada y siguiente nodo o final','Captura o registro humano; HTTP/SQL solo cuando existe soporte técnico'],
            'designStatus':'STRUCTURAL_CANDIDATE_REQUIRES_BUSINESS_REVIEW','technicalExecution':'NOT_EXECUTED','businessAcceptance':'NOT_ATTESTED'})
assert len(cases)==199 and len({c['nodeId'] for c in cases})==199
result={'scope':'LOCAL_VERIFICATION_DESIGN_NOT_EXECUTION','cases':cases,'summary':{'nodesWithControlDesign':199,'sequenceFlowsWithScenario':len(covered_flows),'businessUatCasesRetained':96,'acceptedOrExecutedByThisGenerator':0},
        'limits':['BFS validates graph reachability, not joint feasibility of all business conditions.','The 199 control cases complement, and do not replace or execute, the 96 user scenarios.','A condition requires the actual task data; gateways do not perform a hidden approval.']}
(OUT/'plan_verificacion_completo.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf8')
print(json.dumps(result['summary']))
