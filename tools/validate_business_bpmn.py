"""Structural checks for the nine EcoRoute BPMN 2.0 business-process files."""
from collections import Counter
from pathlib import Path
import xml.etree.ElementTree as ET


ROOT = Path(__file__).resolve().parents[1]
DIRECTORY = ROOT / 'docs/entregables_procesos_ecoroute/negocio_revisado/bpmn'
NS = {'b': 'http://www.omg.org/spec/BPMN/20100524/MODEL',
      'di': 'http://www.omg.org/spec/BPMN/20100524/DI'}
FLOW_NODES = {'startEvent', 'endEvent', 'userTask', 'sendTask', 'receiveTask',
              'serviceTask', 'exclusiveGateway'}


for file in sorted(DIRECTORY.glob('P??_negocio.bpmn')):
    root = ET.parse(file).getroot()
    process = root.find('b:process', NS)
    assert process is not None, file
    nodes = {node.attrib['id']: node for node in process
             if node.tag.rsplit('}', 1)[-1] in FLOW_NODES}
    flows = process.findall('b:sequenceFlow', NS)
    source_counts = Counter(flow.attrib['sourceRef'] for flow in flows)
    target_counts = Counter(flow.attrib['targetRef'] for flow in flows)
    assert len(nodes) == len(set(nodes)), file
    assert sum(node.tag.endswith('startEvent') for node in nodes.values()) == 1, file
    assert sum(node.tag.endswith('endEvent') for node in nodes.values()) >= 1, file
    for flow in flows:
        assert flow.attrib['sourceRef'] in nodes, (file, flow.attrib)
        assert flow.attrib['targetRef'] in nodes, (file, flow.attrib)
    for node_id, node in nodes.items():
        kind = node.tag.rsplit('}', 1)[-1]
        actual_in = {item.text for item in node.findall('b:incoming', NS)}
        actual_out = {item.text for item in node.findall('b:outgoing', NS)}
        expected_in = {f.attrib['id'] for f in flows if f.attrib['targetRef'] == node_id}
        expected_out = {f.attrib['id'] for f in flows if f.attrib['sourceRef'] == node_id}
        assert actual_in == expected_in and actual_out == expected_out, (file, node_id)
        if kind in ('userTask', 'sendTask', 'receiveTask', 'serviceTask'):
            assert target_counts[node_id] == 1 and source_counts[node_id] == 1, (file, node_id)
        if kind == 'exclusiveGateway':
            direction = node.attrib['gatewayDirection']
            if direction == 'Converging':
                assert target_counts[node_id] >= 2 and source_counts[node_id] == 1, (file, node_id)
            else:
                assert direction == 'Diverging', (file, node_id)
                assert target_counts[node_id] == 1 and source_counts[node_id] == 2, (file, node_id)
                labels = {f.attrib.get('name') for f in flows if f.attrib['sourceRef'] == node_id}
                assert labels == {'Sí', 'No'}, (file, node_id, labels)
        if kind == 'endEvent':
            assert source_counts[node_id] == 0, (file, node_id)
            assert node.find('b:errorEventDefinition', NS) is None, (file, node_id)
            assert node.find('b:terminateEventDefinition', NS) is None, (file, node_id)
    lanes = process.findall('b:laneSet/b:lane', NS)
    assigned = [ref.text for lane in lanes for ref in lane.findall('b:flowNodeRef', NS)]
    assert len(assigned) == len(set(assigned)) and set(assigned) == set(nodes), file
    collaboration = root.find('b:collaboration', NS)
    if file.name.startswith('P01'):
        assert collaboration is not None, file
        participants = collaboration.findall('b:participant', NS)
        assert len(participants) == 2 and sum(p.attrib.get('processRef') == process.attrib['id'] for p in participants) == 1
        messages = collaboration.findall('b:messageFlow', NS)
        assert len(messages) == 2
        send = next(n for n in nodes.values() if n.tag.endswith('sendTask'))
        receive = next(n for n in nodes.values() if n.tag.endswith('receiveTask'))
        assert any(m.attrib['sourceRef'] == send.attrib['id'] for m in messages)
        assert any(m.attrib['targetRef'] == receive.attrib['id'] for m in messages)
        assert all(m.attrib.get('messageRef') for m in messages)
    else:
        assert collaboration is None, file
    diagram = root.find('di:BPMNDiagram/di:BPMNPlane', NS)
    assert diagram is not None
    print(f'{file.stem}: {len(nodes)} nodos, {len(flows)} flujos, {sum(n.attrib.get("gatewayDirection") == "Converging" for n in nodes.values())} convergencias')

assert len(list(DIRECTORY.glob('P??_negocio.bpmn'))) == 9
