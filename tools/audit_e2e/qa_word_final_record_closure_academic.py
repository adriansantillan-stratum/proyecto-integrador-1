"""Record actual academic closure R1 observations only; no promotion or source edits."""
import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path
from zipfile import ZipFile
from qa_word_final_academic_finish import body, chapter_one, text
from qa_word_final_audit import docx_audit

ROOT = Path(__file__).resolve().parents[2]
QA = ROOT/'docs/correccion_integral/_qa/word_final'
RUN = QA/'cierre_visual_final_20261020/academico'
BASELINE = QA/'academico_final_r3'
OPENED = [3,4,5,50,55,56,72,73,74,75,76,*range(82,95),96,97]
DOCNAME = 'Integrador I_Grupo3_Correccion_Integral.docx'

def load(path):
    return json.loads(path.read_text(encoding='utf-8-sig'))

def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def later_chapters(nodes):
    start = next(i for i,n in enumerate(nodes) if n.tag.endswith('}p') and ''.join(text(n)).startswith('CAPÍTULO 3'))
    return [''.join(text(n)) for n in nodes[start:]]

def main():
    mapping=load(RUN/'pixel_map_r3_final.json')
    audit=load(RUN/'automated_checks.json')
    prior=load(BASELINE/'visual_review.json')
    assert prior['visualReviewComplete'] and not prior['openLayoutFindings']
    assert mapping['needsIndividualReview']==OPENED
    assert mapping['newPageCount']==audit['pdf']['page_count']==129
    assert len(mapping['identityTransferredPages'])==103 and not mapping['footerExcluded']
    docx=RUN/DOCNAME
    original=ROOT/'docs/Integrador I_Grupo3.docx'
    original_hash=sha(original)
    assert original_hash=='0510d1041b955184bbed180ce9a96ef31f3e08863d8ef58f93d34916c18ecfb5'
    docx_hash=sha(docx)
    current=body(docx);original_body=body(original)
    assert chapter_one(current)==chapter_one(original_body)
    assert later_chapters(current)==later_chapters(original_body)
    structure=docx_audit(docx)
    assert not structure['visible_error_matches']
    assert not structure['tracked_insertions'] and not structure['tracked_deletions']
    (RUN/'structure_checks.json').write_text(json.dumps(structure,ensure_ascii=False,indent=2),encoding='utf8')
    assert sha(RUN/'render.pdf')==audit['pdf']['sha256']
    for page in mapping['pages']:
        assert sha(RUN/page['file'])==page['png_sha256']
        page['individuallyViewedThisRevision']=page['page'] in OPENED
        if page['individuallyViewedThisRevision']:page['review_status']='individually_opened_native_pixels_this_revision'
    summary={
        'blankCandidates':[p['page'] for p in audit['pdf']['pages'] if p['blank_candidate']],
        'referenceErrors':[p['page'] for p in audit['pdf']['pages'] if p['errors']],
        'nearPhysicalEdgeCandidates':[p['page'] for p in audit['pdf']['pages'] if p['near_physical_edge']]}
    assert not any(summary.values())
    captions=[(i,''.join(text(n))) for i,n in enumerate(current) if n.tag.endswith('}p')]
    dispatch=[i for i,t in captions if t.startswith('p02 approved mobile pending')]
    bi=[i for i,t in captions if t.lower().startswith(('mv03 vista bi','mv03 bi tendencias','bi tendencias'))]
    assert len(dispatch)==3 and bi and max(dispatch)<min(bi)
    with ZipFile(docx) as z:
        embedded={n:hashlib.sha256(z.read(n)).hexdigest() for n in z.namelist() if n.startswith('word/media/')}
    finding={
        'id':'ACF01','severity':'P2','pages':[97],'category':'source_screenshot_redaction_spill',
        'description':'Notification panel geometry is now inside the source viewport, but opaque Playwright redaction rectangles extend below/outside its clipped scroll region and cover unrelated sidebar areas.',
        'solution':'Parent assistant is replacing only 02_notifications.png with clipped CSS redaction and will supply a same-pagination R2 render. Compare full-page pixels and re-open every unmatched page.',
        'status':'FIX_IN_PROGRESS_AWAITING_R2_RENDER'}
    report={
        'recordedUtc':datetime.now(timezone.utc).isoformat(),'document':'academico',
        'run':'cierre_visual_final_20261020/academico','revision':'R1',
        'status':'REVIEW_COMPLETE_WITH_ONE_SOURCE_CAPTURE_FINDING_AWAITING_R2',
        'visualReviewComplete':True,'approval':False,'pageCount':129,
        'coveredPages':list(range(1,130)),'individuallyOpenedThisRevision':OPENED,
        'identityTransferredPages':mapping['identityTransferredPages'],
        'counts':{'individualThisRevision':26,'fullPixelIdentityToReviewedR3':103,'totalCovered':129},
        'pixelIdentityMethod':mapping['method'],'footerExcluded':False,'pages':mapping['pages'],
        'baseline':str(BASELINE/'visual_review.json'),'qaDocxPath':str(docx),'qaDocxSha256':docx_hash,
        'pdfSha256':audit['pdf']['sha256'],'automatedSummary':summary,
        'sourcePreservation':{'chapterOneTextIdenticalToOriginal':True,'chapterOneBodyBlockCount':210,
            'laterChapterSkeletonTextIdenticalToOriginal':True,'originalSha256':original_hash,'originalModified':False,
            'comparisonMethod':'Exact concatenated w:t per body block, preserving order and block boundaries; run segmentation only is ignored, no text/whitespace normalization.',
            'embeddedMediaParts':len(embedded),'chapterTwoGalleryWasIntentionallyUpdated':True},
        'findings':[finding],'openLayoutFindings':[finding],
        'resolvedFindings':[
            {'id':'AC01','status':'CLOSED_FROM_R3_BASELINE','description':'Dictionary heading/table pagination observations transfer by complete page pixel identity.'},
            {'id':'AC02','status':'CLOSED_FROM_R3_BASELINE','description':'Chapter-one repeated header/heading pagination observations transfer by complete page pixel identity.'},
            {'id':'MV03','status':'CLOSED_FOR_ACADEMIC_FIGURES','pages':[50,86,87,88,89,90,91],'description':'Responsive gallery captures now show dedicated menu/header rather than a floating control hiding the heading. Consecutive viewport captures remain deliberate partial views.'},
            {'id':'MV04','status':'CLOSED_FOR_ACADEMIC_FIGURES','pages':[76,92,93,94],'description':'Cause labels are separate, horizontally arranged/wrapped, with new detail and mobile source views. No overlapping category-label band remains.'},
            {'id':'MV05','status':'CLOSED_FOR_ACADEMIC_FIGURES','pages':[96],'description':'Driver and vehicle forms show foreground dialogs, blank-input placeholders and buttons, without table redaction covering the dialogs.'},
            {'id':'MV06_geometry','status':'CLOSED_FOR_ACADEMIC_FIGURE','pages':[97],'description':'Notification panel title and left/right boundaries are inside the captured viewport. Residual mask spill is separately OPEN as ACF01.'},
            {'id':'MV07','status':'CLOSED_FOR_ACADEMIC_GALLERY','pages':[55,56],'description':'All three p02 approved mobile pending captions now occur in P02 before business BI captions. Structural body order verified as well.'}
        ],
        'promotion':{'status':'NOT_AUTHORIZED_DO_NOT_PROMOTE_R1','performed':False},
        'humanMICOTRANSValidation':'PENDING',
        'limits':[
            'visualReviewComplete means all 129 page images are covered by direct inspection or verified prior full-pixel identity, not that the open source finding has passed.',
            'Only 26 current pages were individually re-opened; 103 reuse verified R3 observations through exact decoded RGB bytes AND dimensions, across page shifts. No footer/region exclusion, crop, resize or tolerance.',
            'The parent assistant supplied the COM DOCX/PDF/PNGs. This reviewer did not re-export or mutate them; file hashes bind observations to these R1 inputs.',
            'Chapter-one historical factual claims and later chapter skeleton remain preserved; factual completeness and operational business acceptance are outside visual QA.',
            'BPMN/ERD figures and many desktop screenshots are overview figures. Original SVG/source PNG zoom and node tables/dictionary are needed for fine details; not every tiny source label is claimed readable at A4 size.',
            'Intentional source privacy masks still obscure broad list/form regions in inherited screenshots, including action forms on pages 82-85. Their hidden controls/data were not certified readable; this limitation does not assert those forms are absent.',
            'Responsive and vertically scrolled captures intentionally show partial cards/charts; adjacent captures and desktop views provide context. Screenshots are not an independent recalculation of operational metrics.',
            'Speech 26 pages and PPT 35 slides are parent-assistant QA attestations, not reviewed again here. Human MICOTRANS validation remains pending.',
            'No UI, database, builder, source DOCX, final deliverable or promotion was changed by this review. PDF/PNGs/reports are internal QA.'
        ]}
    assert sha(docx)==docx_hash and sha(original)==original_hash
    (RUN/'visual_review.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf8')
    print(json.dumps({k:report[k] for k in ['status','visualReviewComplete','counts','qaDocxSha256','sourcePreservation','promotion']},ensure_ascii=True))

if __name__=='__main__':main()
