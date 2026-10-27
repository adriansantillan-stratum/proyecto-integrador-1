"""Read-only inventory of retained DOCX sources; writes task-local QA evidence only."""
from pathlib import Path
from zipfile import ZipFile
import hashlib
import json
from lxml import etree

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'docs/control_actualizacion/documentos/_qa/baseline'
SOURCES = {
    'academico': 'docs/Integrador I_Grupo3_Correccion_Integral.docx',
    'manual': 'docs/correccion_integral/EcoRoute_Manual_Integral_Implementacion_y_Pruebas.docx',
    'guion': 'docs/correccion_integral/EcoRoute_Guion_Tecnico_Exposicion.docx',
}
NS = {'w': 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'}

def sha(data):
    return hashlib.sha256(data).hexdigest()

def main():
    OUT.mkdir(parents=True, exist_ok=True)
    summary = []
    for key, rel in SOURCES.items():
        source = ROOT / rel
        raw = source.read_bytes()
        with ZipFile(source) as archive:
            xml = etree.fromstring(archive.read('word/document.xml'))
            paragraphs = []
            for index, node in enumerate(xml.xpath('//w:p', namespaces=NS)):
                text = ''.join(node.xpath('.//w:t/text()', namespaces=NS))
                style = node.xpath('./w:pPr/w:pStyle/@w:val', namespaces=NS)
                paragraphs.append({'index': index, 'style': style[0] if style else None,
                                   'text': text, 'xmlSha256': sha(etree.tostring(node))})
            parts = [{'part': info.filename, 'bytes': info.file_size,
                      'sha256': sha(archive.read(info.filename))} for info in archive.infolist()]
            sections = [etree.tostring(n, encoding='unicode') for n in xml.xpath('//w:sectPr', namespaces=NS)]
            fields = xml.xpath('//w:instrText/text()', namespaces=NS)
            data = {'key': key, 'source': rel, 'sha256': sha(raw), 'paragraphs': paragraphs,
                    'parts': parts, 'sections': sections, 'fields': fields}
            (OUT / f'{key}_inventory.json').write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding='utf8')
            (OUT / f'{key}_paragraphs.txt').write_text('\n'.join(f"{p['index']:04d} [{p['style'] or 'default'}] {p['text']}" for p in paragraphs), encoding='utf8')
            summary.append({'key': key, 'source': rel, 'sha256': sha(raw), 'paragraphs': len(paragraphs),
                            'parts': len(parts), 'sections': len(sections),
                            'headings': [{'index': p['index'], 'style': p['style'], 'text': p['text']} for p in paragraphs if p['style'] and ('Heading' in p['style'] or p['style'] in ('Title', 'Ttulo', 'Ttulo1', 'Ttulo2'))]})
    (OUT / 'sources.json').write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding='utf8')
    test_root = ROOT / 'build/analytics_actualizacion_20261022/test-results/test'
    suites = []
    for file in sorted(test_root.glob('TEST-*.xml')):
        suite = etree.fromstring(file.read_bytes())
        suites.append({'file': str(file.relative_to(ROOT)), 'sha256': sha(file.read_bytes()),
                       'name': suite.get('name'), 'timestamp': suite.get('timestamp'),
                       **{key: int(suite.get(key, '0')) for key in ('tests', 'failures', 'errors', 'skipped')}})
    test_summary = {'scope': 'TARGETED_ANALYTICS_V16_XML_NOT_UAT', 'suites': suites,
                    'summary': {key: sum(s[key] for s in suites) for key in ('tests', 'failures', 'errors', 'skipped')},
                    'executionBy': 'Principal/backend worker; read-only XML review by document worker'}
    (OUT / 'backend_current_tests.json').write_text(json.dumps(test_summary, ensure_ascii=False, indent=2), encoding='utf8')
    print(json.dumps([{k: v for k, v in s.items() if k != 'headings'} for s in summary], ensure_ascii=False))

if __name__ == '__main__':
    main()
