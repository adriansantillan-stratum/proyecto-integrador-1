from pathlib import Path
from zipfile import ZipFile
import re,json,xml.etree.ElementTree as ET
root=Path(__file__).resolve().parents[2]
path=root/'docs/presentacion_capitulo2/final/EcoRoute_Capitulo_2_Diseno_BPMN_Formal_v4.pptx'
ns={'a':'http://schemas.openxmlformats.org/drawingml/2006/main','p':'http://schemas.openxmlformats.org/presentationml/2006/main'}
with ZipFile(path) as z:
    files=sorted([f for f in z.namelist() if re.fullmatch(r'ppt/slides/slide\d+\.xml',f)],key=lambda f:int(re.search(r'slide(\d+)',f)[1]))
    slides=[]
    for index,file in enumerate(files,1):
        tree=ET.fromstring(z.read(file))
        slides.append({'slide':index,'text':tree.findall('.//a:t',ns) and ' | '.join(n.text or '' for n in tree.findall('.//a:t',ns))})
    size=ET.fromstring(z.read('ppt/presentation.xml')).find('p:sldSz',ns).attrib
    fonts=sorted(set(n.attrib.get('typeface','') for n in ET.fromstring(z.read('ppt/theme/theme1.xml')).findall('.//a:latin',ns)))
    print(json.dumps({'size':size,'fonts':fonts,'slides':slides},ensure_ascii=False,indent=2))
