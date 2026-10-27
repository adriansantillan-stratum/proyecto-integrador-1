"""Read-only DOCX/PDF checks; write reports only below the authorized QA root.

This does not export Word, render pages, edit deliverables or assert visual review.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import re
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from pathlib import Path
from zipfile import ZipFile

ROOT = Path(__file__).resolve().parents[2]
QA = ROOT / 'docs/correccion_integral/_qa/word_final'
DOCS = {
    'manual': ROOT / 'docs/correccion_integral/EcoRoute_Manual_Integral_Implementacion_y_Pruebas.docx',
    'guion': ROOT / 'docs/correccion_integral/EcoRoute_Guion_Tecnico_Exposicion.docx',
    'academico': ROOT / 'docs/Integrador I_Grupo3_Correccion_Integral.docx',
}
ORIGINAL = ROOT / 'docs/Integrador I_Grupo3.docx'
NS = {'w': 'http://schemas.openxmlformats.org/wordprocessingml/2006/main',
      'a': 'http://schemas.openxmlformats.org/drawingml/2006/main'}
W = '{' + NS['w'] + '}'
ERRORS = re.compile(r'Error!\s*(?:Bookmark not defined|Reference source not found)|'
                    r'Error\s*[!¡]\s*(?:Marcador no definido|No se encuentra el origen de la referencia)|'
                    r'¡Error!\s*(?:Marcador no definido|No se encuentra el origen de la referencia)|'
                    r'\ufffd|\[\[REF:|\bTOC PLACEHOLDER\b', re.IGNORECASE)


def stamp(path):
    return {'path': str(path), 'sha256': hashlib.sha256(path.read_bytes()).hexdigest(),
            'bytes': path.stat().st_size,
            'modified_utc': datetime.fromtimestamp(path.stat().st_mtime, timezone.utc).isoformat()}


def txt(node):
    return ''.join(t.text or '' for t in node.findall('.//w:t', NS))


def docx_audit(path):
    result = stamp(path)
    with ZipFile(path) as z:
        xml = ET.fromstring(z.read('word/document.xml'))
        styles_xml = ET.fromstring(z.read('word/styles.xml'))
        style_names = {s.get(W+'styleId'): s.find('w:name', NS).get(W+'val', '')
                       for s in styles_xml.findall('w:style', NS) if s.find('w:name', NS) is not None}
        tables = xml.findall('.//w:tbl', NS)
        paragraphs = xml.findall('.//w:p', NS)
        sections = xml.findall('.//w:sectPr', NS)
        result.update({
            'paragraphs': len(paragraphs), 'table_count': len(tables),
            'inline_images': len(xml.findall('.//a:blip', NS)),
            'media_parts': [n for n in z.namelist() if n.startswith('word/media/')],
            'fields': [n.text for n in xml.findall('.//w:instrText', NS)] +
                      [n.get(W+'instr') for n in xml.findall('.//w:fldSimple', NS)],
            'tracked_insertions': len(xml.findall('.//w:ins', NS)),
            'tracked_deletions': len(xml.findall('.//w:del', NS)),
            'headings': [], 'sections': [], 'tables': [], 'visible_error_matches': [],
        })
        for index, p in enumerate(paragraphs):
            style = p.find('w:pPr/w:pStyle', NS)
            if style is not None and re.search(r'Heading|Title|T.tulo', style_names.get(style.get(W+'val'), style.get(W+'val', '')), re.I):
                result['headings'].append({'paragraph': index, 'style': style.get(W+'val'),
                                           'style_name': style_names.get(style.get(W+'val')), 'text': txt(p)})
            if ERRORS.search(txt(p)):
                result['visible_error_matches'].append({'paragraph': index, 'text': txt(p)})
        for sec in sections:
            result['sections'].append({
                'size': {k.removeprefix(W): v for k, v in sec.find('w:pgSz', NS).attrib.items()} if sec.find('w:pgSz', NS) is not None else {},
                'margins': {k.removeprefix(W): v for k, v in sec.find('w:pgMar', NS).attrib.items()} if sec.find('w:pgMar', NS) is not None else {},
            })
        for index, table in enumerate(tables, 1):
            rows = table.findall('w:tr', NS)
            grid = [int(col.get(W+'w', '0')) for col in table.findall('w:tblGrid/w:gridCol', NS)]
            fixed = [i for i, row in enumerate(rows, 1)
                     if any(h.get(W+'hRule') == 'exact' for h in row.findall('w:trPr/w:trHeight', NS))]
            result['tables'].append({
                'table': index, 'rows': len(rows), 'grid_twips': grid,
                'headers': [txt(c) for c in rows[0].findall('w:tc', NS)] if rows else [],
                'repeating_header': bool(rows and rows[0].find('w:trPr/w:tblHeader', NS) is not None),
                'fixed_height_rows': fixed,
                'min_explicit_font_pt': min([int(n.get(W+'val'))/2 for n in table.findall('.//w:sz', NS)
                                             if n.get(W+'val', '').isdigit()], default=None),
            })
    return result


def pdf_audit(path):
    import pdfplumber
    result = stamp(path)
    result['pages'] = []
    with pdfplumber.open(path) as pdf:
        for number, page in enumerate(pdf.pages, 1):
            text = page.extract_text() or ''
            words = page.extract_words()
            body_words = [w for w in words if w['top'] < page.height-42 and w['bottom'] > 25]
            errors = [{'match': m.group(), 'context': text[max(0,m.start()-70):m.end()+70]}
                      for m in ERRORS.finditer(text)]
            edge = [w for w in words if w['x0'] < 15 or w['x1'] > page.width-15 or w['top'] < 8 or w['bottom'] > page.height-8]
            result['pages'].append({
                'page': number, 'size_pt': [page.width, page.height], 'words': len(words),
                'body_words': len(body_words), 'images': len(page.images),
                'blank_candidate': len(body_words) == 0 and not page.images,
                'near_physical_edge': edge, 'errors': errors,
                'body_bbox': [min(w['x0'] for w in body_words), min(w['top'] for w in body_words),
                              max(w['x1'] for w in body_words), max(w['bottom'] for w in body_words)] if body_words else None,
                'first_lines': text.splitlines()[:5], 'last_lines': text.splitlines()[-6:],
                'png_viewed': False,
            })
    result['page_count'] = len(result['pages'])
    result['limits'] = ['Automated text and geometry checks do not establish visual quality.',
                        'Blank candidates and edge candidates require visual inspection.',
                        'No page is recorded as viewed by this helper.']
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--out', required=True, type=Path)
    parser.add_argument('--pdf', type=Path)
    args = parser.parse_args()
    output = args.out.resolve()
    if not output.is_relative_to(QA.resolve()):
        parser.error('Report output must be below docs/correccion_integral/_qa/word_final')
    data = {'created_utc': datetime.now(timezone.utc).isoformat(),
            'phase': 'pdf_automated_checks' if args.pdf else 'preflight_waiting_WORD_LISTO',
            'visual_review_complete': False}
    if args.pdf:
        data['pdf'] = pdf_audit(args.pdf.resolve())
    else:
        data['original_preservation_baseline'] = stamp(ORIGINAL)
        data['documents'] = {key: docx_audit(path) for key, path in DOCS.items()}
        data['limits'] = ['Current sources may change before WORD_LISTO.',
                          'No export, render or visual page review has occurred.']
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding='utf8')
    print(json.dumps({'report': str(output), 'phase': data['phase'],
                      'visual_review_complete': False}, ensure_ascii=True))


if __name__ == '__main__':
    main()
