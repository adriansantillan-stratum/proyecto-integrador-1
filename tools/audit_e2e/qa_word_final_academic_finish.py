"""Record the completed r3 academic review; never promote or edit DOCX files."""
import hashlib
import json
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from pathlib import Path
from zipfile import ZipFile
from qa_word_final_audit import docx_audit

ROOT = Path(__file__).resolve().parents[2]
QA = ROOT / 'docs/correccion_integral/_qa/word_final'
RUN = QA / 'academico_final_r3'
NS = {'w':'http://schemas.openxmlformats.org/wordprocessingml/2006/main'}
W = '{'+NS['w']+'}'
# These exact pages were opened individually in this assistant's current turn.
VIEWED = [3,4,5,*range(10,35),*range(44,50),*range(106,125)]

def digest(data):
    return hashlib.sha256(data).hexdigest()

def load(path):
    return json.loads(path.read_text(encoding='utf-8-sig'))

def body(path):
    with ZipFile(path) as z:
        return list(ET.fromstring(z.read('word/document.xml')).find('w:body',NS))

def text(node):
    return [v.text or '' for v in node.findall('.//w:t',NS)]

def chapter_one(nodes):
    start = next(i for i,n in enumerate(nodes) if n.tag==W+'p' and ''.join(text(n)).startswith('CAPÍTULO 1'))
    end = next(i for i,n in enumerate(nodes) if i>start and n.tag==W+'p' and ''.join(text(n)).startswith('CAPÍTULO 2'))
    return [''.join(text(n)) for n in nodes[start:end]]

def main():
    mapping = load(RUN/'pixel_map_r2_r3.json')
    audit = load(RUN/'automated_checks.json')
    manifest = load(RUN/'audit-inputs/snapshot_manifest.json')
    assert mapping['needsIndividualReview']==VIEWED
    assert mapping['newPageCount']==audit['pdf']['page_count']==125
    assert len(mapping['identityTransferredPages'])==72
    snapshots = {v['key']:v for v in manifest['snapshots']}
    for v in snapshots.values():
        assert digest(Path(v['snapshot']).read_bytes())==v['sha256']
    original = ROOT/'docs/Integrador I_Grupo3.docx'
    original_hash = digest(original.read_bytes())
    assert original_hash=='0510d1041b955184bbed180ce9a96ef31f3e08863d8ef58f93d34916c18ecfb5'
    prior = body(snapshots['r2']['snapshot'])
    current = body(snapshots['r3']['snapshot'])
    inherited = chapter_one(body(original))
    assert inherited==chapter_one(current), 'Chapter one text changed'
    # The single sdt contains the generated TOC. Its cached page numbers are expected to change.
    excluded = [i for i,n in enumerate(current) if n.tag==W+'sdt']
    assert len(excluded)==1 and 'ÍNDICE' in ''.join(text(current[excluded[0]]))
    old_text = [''.join(text(n)) for n in prior if n.tag!=W+'sdt']
    new_text = [''.join(text(n)) for n in current if n.tag!=W+'sdt']
    assert old_text==new_text, 'Non-TOC visible body text changed'
    with ZipFile(snapshots['r2']['snapshot']) as a, ZipFile(snapshots['r3']['snapshot']) as b:
        media_a = {n:digest(a.read(n)) for n in a.namelist() if n.startswith('word/media/')}
        media_b = {n:digest(b.read(n)) for n in b.namelist() if n.startswith('word/media/')}
        assert media_a==media_b, 'Embedded media changed'
    structure = docx_audit(Path(snapshots['r3']['snapshot']))
    (RUN/'structure_checks.json').write_text(json.dumps(structure,ensure_ascii=False,indent=2),encoding='utf8')
    assert not structure['visible_error_matches']
    assert not structure['tracked_insertions'] and not structure['tracked_deletions']
    assert digest((RUN/'render.pdf').read_bytes())==audit['pdf']['sha256']
    for page in mapping['pages']:
        assert digest((RUN/page['file']).read_bytes())==page['png_sha256']
        page['individuallyViewedThisRevision']=page['page'] in VIEWED
        if page['individuallyViewedThisRevision']:
            page['review_status']='individually_opened_native_pixels_this_revision'
    summary = {
        'blankCandidates':[v['page'] for v in audit['pdf']['pages'] if v['blank_candidate']],
        'referenceErrors':[v['page'] for v in audit['pdf']['pages'] if v['errors']],
        'nearPhysicalEdgeCandidates':[v['page'] for v in audit['pdf']['pages'] if v['near_physical_edge']]}
    assert not any(summary.values())
    report = {
        'recordedUtc':datetime.now(timezone.utc).isoformat(), 'document':'academico', 'run':'academico_final_r3',
        'status':'PASS_VISUAL_AND_SOURCE_PRESERVATION', 'visualReviewComplete':True,
        'scope':'All 125 pages of the latest academic revision; visual layout and formatting-only source preservation, not business acceptance or factual validation of inherited claims.',
        'pageCount':125, 'coveredPages':list(range(1,126)), 'individuallyOpenedThisRevision':VIEWED,
        'identityTransferredPages':mapping['identityTransferredPages'],
        'counts':{'individualThisRevision':len(VIEWED),'fullPixelIdentityToIndividuallyReviewedR2':72,'totalCovered':125},
        'pixelIdentityMethod':mapping['method'],'footerExcluded':False, 'pages':mapping['pages'],
        'qaDocxPath':snapshots['r3']['source'],'qaDocxSha256':snapshots['r3']['sha256'],
        'pdfSha256':audit['pdf']['sha256'],'automatedSummary':summary,
        'sourcePreservation':{'chapterOneTextIdenticalToOriginal':True,'chapterOneBodyBlockCount':len(inherited),
            'allNonTocBodyTextIdenticalToR2':True,'tocExcludedFromTextComparisonOnly':True,
            'tocExcludedFromPixelComparison':False,'textComparisonMethod':'Exact concatenated w:t text per body block, preserving block boundaries; ignores run segmentation only, no whitespace/text normalization',
            'embeddedMediaIdenticalToR2':True,'mediaPartCount':len(media_a),
            'originalSha256':original_hash,'originalModified':False},
        'resolvedFindings':[
            {'id':'AC01','status':'CLOSED','verifiedCurrentPages':[106,107,109,110,112,113,114,115],
             'description':'Previously orphaned products/vehicles/route expenses/driver shifts/delivery outbox now stay with table header and first data.'},
            {'id':'AC02','status':'CLOSED','verifiedCurrentPages':[10,11,18,19,20,21,22,23,24,25,26],
             'description':'Inherited continued tables now repeat headers; module three and module nine headings are kept with their tables.'}],
        'openLayoutFindings':[], 'promotion':{'status':'READY_NOT_YET_COPIED'},
        'humanMICOTRANSValidation':'PENDING',
        'limits':[
            '72 current pages reuse actual prior individual inspection only through exact full-page RGB identity with dimensions, mapped across page shifts. They were not re-opened in this revision.',
            'All 53 unmatched pages were individually opened at original 120-DPI image pixels, not contact-sheet-only reviewed.',
            'The COM DOCX/PDF/PNGs were provided by parent assistant; this reviewer did not re-export them. Hashes bind this review to those exact supplied files.',
            'Full PNGs include all page regions and any footer. No pixel area was ignored, cropped or resized for identity.',
            'BPMN and ERD figures remain overviews with node tables, dictionary and editable SVGs as detail sources; not every tiny image label is claimed readable at A4 scale.',
            'Unchanged source cause-chart labels overlap on current page 74 (prior 73); source privacy masks and viewport crop/navigation overlay limitations remain. No Word overflow is implied.',
            'Chapter one historical claims and the heading-only later chapter skeleton on page 125 remain preserved; their factual completeness is outside this QA.',
            'Long dictionary identifiers/defaults and the narrow Permite nulo header wrap but remain visible; no width/design changes were made.',
            'Human MICOTRANS/UAT validation remains pending; assistant visual QA does not replace it.',
            'Manual final r4 belongs to Huygens; no manual approval or promotion is asserted. Guion final r4 was already promoted by parent assistant and must not be recopied.',
            'PDF/PNGs and snapshots are internal QA, not deliverables.'
        ]}
    (RUN/'visual_review.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf8')
    print(json.dumps({'status':report['status'],'counts':report['counts'],'sourcePreservation':report['sourcePreservation'],
                      'qaDocxSha256':report['qaDocxSha256'],'automatedSummary':summary},ensure_ascii=True))

if __name__=='__main__':
    main()
