from pathlib import Path
import json
import re
import sys
import xml.etree.ElementTree as ET
from docx import Document
sys.stdout.reconfigure(encoding='utf-8')

ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'docs/auditoria_end_to_end_20261019/evidencias'
OUT.mkdir(parents=True,exist_ok=True)
SOURCE=ROOT/'docs/Integrador I_Grupo3_Capitulo2_BPMN_Formal.docx'
doc=Document(SOURCE)
requirements={}
for ti,table in enumerate(doc.tables):
    for row in table.rows:
        values=[c.text.strip() for c in row.cells]
        if re.fullmatch(r'R[N]?F-\d+',values[0]):
            requirements[values[0]]={'id':values[0],'description':values[1],
                                    'criterion_or_actor':values[2] if len(values)>2 else '',
                                    'source_table':ti}
ns={'b':'http://www.omg.org/spec/BPMN/20100524/MODEL'}
processes=[]
for file in sorted((ROOT/'docs/entregables_procesos_ecoroute/negocio_revisado/bpmn').glob('P??_negocio.bpmn')):
    xml=ET.parse(file).getroot();process=xml.find('b:process',ns)
    processes.append({'id':file.stem[:3],'title':process.get('name'),
                      'lanes':[n.get('name') for n in process.findall('b:laneSet/b:lane',ns)],
                      'tasks':[n.get('name') for n in process if n.tag.endswith(('Task','task'))],
                      'ends':[n.get('name') for n in process.findall('b:endEvent',ns)]})
data={'source':str(SOURCE),'requirements':list(requirements.values()),'processes':processes}
(OUT/'requisitos_y_bpmn.json').write_text(json.dumps(data,ensure_ascii=False,indent=2),encoding='utf8')
print(f"RF {sum(x.startswith('RF-') for x in requirements)}; RNF {sum(x.startswith('RNF-') for x in requirements)}; procesos {len(processes)}")
for value in requirements.values():print(value['id'],value['description'],value['criterion_or_actor'])
