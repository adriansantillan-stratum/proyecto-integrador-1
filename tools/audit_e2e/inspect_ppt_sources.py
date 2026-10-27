from pathlib import Path
from zipfile import ZipFile
from collections import Counter
import xml.etree.ElementTree as ET
import re,json
root=Path(__file__).resolve().parents[2]
ns={'a':'http://schemas.openxmlformats.org/drawingml/2006/main','p':'http://schemas.openxmlformats.org/presentationml/2006/main'}
with ZipFile(root/'docs/presentacion_capitulo2/final/EcoRoute_Capitulo_2_Diseno_BPMN_Formal_v4.pptx') as z:
    files=sorted([f for f in z.namelist() if re.fullmatch(r'ppt/slides/slide\d+\.xml',f)],key=lambda f:int(re.search(r'slide(\d+)',f)[1]))
    trees=[ET.fromstring(z.read(f)) for f in files]
    print('SIZE', ET.fromstring(z.read('ppt/presentation.xml')).find('p:sldSz',ns).attrib)
    theme=ET.fromstring(z.read('ppt/theme/theme1.xml'))
    print('THEME',ET.tostring(theme.find('.//a:clrScheme',ns),encoding='unicode'))
    print('FONTS',Counter(n.get('typeface') for t in trees for n in t.findall('.//a:latin',ns)))
    print('SIZES',Counter(n.get('sz') for t in trees for n in t.findall('.//a:rPr',ns)))
    print('\n'.join(str(i+1)+' '+ ' / '.join(n.text or '' for n in t.findall('.//a:t',ns)[:3]) for i,t in enumerate(trees)))
for name in ['inventario_trazabilidad.json','diagramas/erd_verificado_manifest.json','evidencias/regresion_api.json','capturas/web/WEB-1792482508091/results.json']:
    j=json.loads((root/'docs/correccion_integral'/name).read_text(encoding='utf-8'))
    print('\nSOURCE',name,'KEYS',list(j))
    if 'summary' in j: print('SUMMARY',json.dumps(j['summary'],ensure_ascii=False)[:2500])
    if 'businessObjectCount' in j:
        print('OBJECTS',list(j['objects']))
        print('EXCLUDED',j['excluded'])
        print('FK',len(j['foreignKeys']), 'DIAGRAMS',j['diagrams'])
