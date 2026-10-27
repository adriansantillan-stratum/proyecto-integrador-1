"""Read-only consistency checks for the generated defence guide."""
from pathlib import Path
import json,re,hashlib
from docx import Document

ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'docs/exposicion_8_pantallas'
doc=Document(OUT/'EcoRoute_Guia_8_Pantallas_4_Integrantes.docx')
manifest=json.loads((OUT/'_qa/manifest.json').read_text(encoding='utf-8'))
text='\n'.join(p.text for p in doc.paragraphs)
screen_headings=[p.text for p in doc.paragraphs if p.style.name=='Heading 1' and p.text.startswith('Pantalla ')]
checks={
 'eight_screen_chapters':len(screen_headings)==8,
 'two_screens_per_member':all(sum(int(s['student'])==n for s in manifest['screens'])==2 for n in range(1,5)),
 'source_hashes_current':all(hashlib.sha256((ROOT/f).read_bytes()).hexdigest()==sha for f,sha in manifest['source_files'].items()),
 'eight_main_screenshots_and_nine_diagrams':len(doc.inline_shapes)==17,
 'all_screens_have_speech':sum(p.text=='Guion para decir al profesor' for p in doc.paragraphs)==8,
 'all_screens_have_negative_paths':sum(p.text=='Validaciones y recorridos negativos' for p in doc.paragraphs)==8,
 'all_screens_have_data':sum(p.text=='Persistencia y datos relacionados' for p in doc.paragraphs)==8,
 'at_least_two_source_excerpts_per_screen':all(s['snippets']>=2 for s in manifest['screens']),
 'no_placeholder_or_tool_tokens':not any(x in text for x in ['TODO','INSERTAR AQUÍ','turn0search',':codex-file-citation']),
 'headings_are_black':all(doc.styles[n].font.color.rgb is not None and str(doc.styles[n].font.color.rgb)=='000000' for n in ['Title','Heading 1','Heading 2','Heading 3']),
 'all_excerpt_lines_belong_to_sources':True,
}
for n in range(1,5):
    for s in json.loads((ROOT/f'tools/exposicion_8_pantallas/alumno{n}.json').read_text(encoding='utf-8-sig')):
        for c in s['code']:
            lines=(ROOT/c['file']).read_text(encoding='utf-8-sig').splitlines()
            checks['all_excerpt_lines_belong_to_sources'] &= 1<=c['start']<=c['end']<=len(lines)
pdf=OUT/'_qa/EcoRoute_Guia_8_Pantallas_4_Integrantes.pdf'
if pdf.exists():
    import pdfplumber
    pd=pdfplumber.open(pdf)
    report_pages=[]
    for i,p in enumerate(pd.pages,1):
        page_text=p.extract_text() or ''
        # Content boxes outside safe printable bounds indicate likely clipping.
        bad=[]
        for word in p.extract_words():
            if word['x0']<30 or word['x1']>p.width-30 or word['top']<20 or word['bottom']>p.height-12:bad.append(word['text'])
        report_pages.append({'page':i,'words':len(page_text.split()),'outside_safe_bounds':bad[:8],
                             'screen_headings':[h for h in screen_headings if h in re.sub(r'\s+',' ',page_text)]})
    checks['no_text_outside_safe_bounds']=not any(p['outside_safe_bounds'] for p in report_pages)
    checks['no_empty_rendered_pages']=all(p['words']>8 for p in report_pages)
    (OUT/'_qa/render_page_inventory.json').write_text(json.dumps(report_pages,ensure_ascii=False,indent=2),encoding='utf-8')
    pd.close()
result={'status':'PASS' if all(checks.values()) else 'FAIL','checks':checks,'screen_headings':screen_headings,
        'source_files':len(manifest['source_files']),'code_excerpts':sum(s['snippets'] for s in manifest['screens']),
        'pages':len(report_pages) if pdf.exists() else None,'test_reference_warnings':manifest['warnings']}
(OUT/'_qa/checks.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(result,ensure_ascii=False))
raise SystemExit(0 if all(checks.values()) else 1)
