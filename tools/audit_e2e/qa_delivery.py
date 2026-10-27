from pathlib import Path
from zipfile import ZipFile
from collections import Counter
import json, re, sys
from lxml import etree
from pypdf import PdfReader

sys.stdout.reconfigure(encoding='utf-8')
root=Path(__file__).resolve().parents[2]
out=root/'docs/auditoria_end_to_end_20261019'
doc=out/'EcoRoute_Arquitectura_Verificacion_y_Flujos.docx'
ns={'w':'http://schemas.openxmlformats.org/wordprocessingml/2006/main'}
with ZipFile(doc) as z:
    styles=etree.fromstring(z.read('word/styles.xml'))
    title=styles.xpath('//w:style[@w:styleId="Title"]',namespaces=ns)[0]
    assert not title.xpath('.//w:pBdr',namespaces=ns),'Borde en Title'
    xml=etree.fromstring(z.read('word/document.xml'))
    ids=[x['id'] for x in json.loads((out/'trazabilidad_requerimientos.json').read_text(encoding='utf8'))]
    assert len(ids)==135 and len(set(ids))==135
    texts=' '.join(xml.xpath('//w:t/text()',namespaces=ns))
    assert 'gps_locations' not in texts
    assert 'vehicle_gps_history' in texts
    assert 'Login genera state' not in texts
    captions=xml.xpath('//w:p[w:pPr/w:pStyle[@w:val="Caption"]]//w:t/text()',namespaces=ns)
    assert len(captions)==22,(len(captions),'Esperados once diagramas unicos y once capturas')
    # Tables must have repeated headers and explicit borders on every cell.
    tables=xml.xpath('//w:tbl',namespaces=ns)
    for tb in tables:
        assert tb.xpath('./w:tr[1]/w:trPr/w:tblHeader',namespaces=ns)
        assert all(c.find('w:tcPr/w:tcBorders',ns) is not None for c in tb.xpath('.//w:tc',namespaces=ns))
html=(out/'index.html').read_text(encoding='utf8')
refs=re.findall(r'(?:href|src)="([^"]+)"',html)
missing=[r for r in refs if not r.startswith(('#','http')) and not (out/r).exists()]
assert not missing,missing
pdf=PdfReader(out/'_qa/manual.pdf')
pages=[]
for i,page in enumerate(pdf.pages,1):
    text=page.extract_text()
    pages.append({'page':i,'characters':len(text),'start':text[:95].replace('\n',' ')})
report={'pages':len(pdf.pages),'requirements':len(ids),'captions':len(captions),'tables':len(tables),'linkedFilesMissing':missing,'pageTexts':pages}
(out/'_qa/preflight.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf8')
print(json.dumps({k:v for k,v in report.items() if k!='pageTexts'},ensure_ascii=False))
