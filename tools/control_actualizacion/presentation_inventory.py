"""Read-only OOXML inventory, without python-pptx or presentation rendering."""
from pathlib import Path
from zipfile import ZipFile
from collections import Counter
import xml.etree.ElementTree as ET
import hashlib
import json
import re

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / 'docs/correccion_integral/EcoRoute_Arquitectura_y_Flujos_Verificados.pptx'
OUT = ROOT / 'docs/control_actualizacion/presentacion/_qa/baseline'
NS = {
    'a': 'http://schemas.openxmlformats.org/drawingml/2006/main',
    'p': 'http://schemas.openxmlformats.org/presentationml/2006/main',
}

def text(node):
    return '\n'.join(''.join(n.text or '' for n in p.findall('.//a:t', NS))
                     for p in node.findall('.//a:p', NS))

def main():
    OUT.mkdir(parents=True, exist_ok=True)
    fonts = Counter()
    slides = []
    with ZipFile(SOURCE) as package:
        names = sorted((n for n in package.namelist()
                        if re.fullmatch(r'ppt/slides/slide\d+\.xml', n)),
                       key=lambda n: int(re.search(r'slide(\d+)', n)[1]))
        size = ET.fromstring(package.read('ppt/presentation.xml')).find('p:sldSz', NS).attrib
        for index, name in enumerate(names, 1):
            slide = ET.fromstring(package.read(name))
            fonts.update(n.get('typeface') for n in slide.findall('.//a:latin', NS))
            shapes = []
            for node in slide.findall('.//p:sp', NS):
                props = node.find('p:nvSpPr/p:cNvPr', NS)
                body = node.find('p:txBody', NS)
                shapes.append({'ooxmlId': props.get('id') if props is not None else None,
                               'name': props.get('name') if props is not None else None,
                               'text': text(body) if body is not None else '',
                               'transform': ET.tostring(node.find('p:spPr', NS), encoding='unicode')})
            tables = [text(t) for t in slide.findall('.//a:tbl', NS)]
            note_file = f'ppt/notesSlides/notesSlide{index}.xml'
            notes = text(ET.fromstring(package.read(note_file))) if note_file in package.namelist() else ''
            slides.append({'number': index, 'file': name, 'shapes': shapes, 'tables': tables,
                           'images': len(slide.findall('.//p:pic', NS)), 'notes': notes})
        media = [{'file': n, 'sha256': hashlib.sha256(package.read(n)).hexdigest()}
                 for n in package.namelist() if n.startswith('ppt/media/')]
    result = {'source': str(SOURCE), 'sha256': hashlib.sha256(SOURCE.read_bytes()).hexdigest(),
              'slideCount': len(slides), 'sizeEmu': size, 'fonts': dict(fonts), 'slides': slides,
              'media': media}
    (OUT / 'source_ooxml.json').write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding='utf-8')
    for slide in slides:
        print(f"\nSLIDE {slide['number']:02d}")
        for shape in slide['shapes']:
            if shape['text']:
                print(f"[{shape['name']}] {shape['text']}")
        for table in slide['tables']:
            print(f'[TABLE] {table}')
    print(json.dumps({'sha256': result['sha256'], 'slideCount': len(slides),
                      'sizeEmu': size, 'fonts': dict(fonts)}, ensure_ascii=False))

if __name__ == '__main__':
    main()
