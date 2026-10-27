"""Finalize academic R2 QA after individual inspection of changed page 97.

Writes QA reports only. Never promotes, edits a DOCX or updates render manifests.
"""
import hashlib
import json
from datetime import datetime, timezone
from zipfile import ZipFile
from qa_word_final_academic_finish import body, chapter_one, text
from qa_word_final_audit import docx_audit
from qa_word_final_record_closure_academic import ROOT, QA, load, sha, later_chapters

BASELINE=QA/'cierre_visual_final_20261020/academico'
RUN=QA/'cierre_visual_final_20261020_r2/academico'
EXPECTED='2e331a04927668594bb46659994467ecc0fe8a4cc1210c3ca7c8637c18a89cd8'
ORIGINAL='0510d1041b955184bbed180ce9a96ef31f3e08863d8ef58f93d34916c18ecfb5'

def main():
    prior=load(BASELINE/'visual_review.json')
    mapping=load(RUN/'pixel_map_r1_r2_verified.json')
    byte_comparison=load(RUN/'comparison_notification_fix.json')
    audit=load(RUN/'automated_checks.json')
    assert prior['visualReviewComplete'] and prior['pageCount']==129
    assert [v['id'] for v in prior['openLayoutFindings']]==['ACF01']
    assert mapping['needsIndividualReview']==byte_comparison['changed_pages']==[97]
    assert mapping['newPageCount']==mapping['oldPageCount']==audit['pdf']['page_count']==129
    assert len(mapping['identityTransferredPages'])==len(byte_comparison['unchanged_pages'])==128
    assert not mapping['footerExcluded']
    snapshot=load(RUN/'audit-inputs'/f'{EXPECTED}.json')
    old_snapshot=load(RUN/'audit-inputs'/f'{prior["qaDocxSha256"]}.json')
    current_docx=RUN/'audit-inputs'/f'{EXPECTED}.docx'
    old_docx=RUN/'audit-inputs'/f'{prior["qaDocxSha256"]}.docx'
    assert sha(current_docx)==snapshot['sha256']==EXPECTED
    assert sha(old_docx)==old_snapshot['sha256']==prior['qaDocxSha256']
    original=ROOT/'docs/Integrador I_Grupo3.docx'
    assert sha(original)==ORIGINAL
    current=body(current_docx);previous=body(old_docx);original_body=body(original)
    assert chapter_one(current)==chapter_one(original_body)
    assert later_chapters(current)==later_chapters(original_body)
    assert [''.join(text(n)) for n in current]==[''.join(text(n)) for n in previous], 'Body/TOC text differs from reviewed R1'
    with ZipFile(current_docx) as z,ZipFile(old_docx) as old:
        media={n:hashlib.sha256(z.read(n)).hexdigest() for n in z.namelist() if n.startswith('word/media/')}
        prior_media={n:hashlib.sha256(old.read(n)).hexdigest() for n in old.namelist() if n.startswith('word/media/')}
        assert media.keys()==prior_media.keys()
        changed_media=[n for n in media if media[n]!=prior_media[n]]
        assert len(changed_media)==1, 'Expected exactly one changed embedded notification image'
    structure=docx_audit(current_docx)
    assert not structure['visible_error_matches'] and not structure['tracked_insertions'] and not structure['tracked_deletions']
    (RUN/'structure_checks.json').write_text(json.dumps(structure,ensure_ascii=False,indent=2),encoding='utf8')
    assert sha(RUN/'render.pdf')==audit['pdf']['sha256']
    for p in mapping['pages']:
        assert sha(RUN/p['file'])==p['png_sha256']
        p['individuallyViewedThisRevision']=p['page']==97
        if p['page']==97:p['review_status']='individually_opened_native_pixels_this_revision'
    summary={
        'blankCandidates':[p['page'] for p in audit['pdf']['pages'] if p['blank_candidate']],
        'referenceErrors':[p['page'] for p in audit['pdf']['pages'] if p['errors']],
        'nearPhysicalEdgeCandidates':[p['page'] for p in audit['pdf']['pages'] if p['near_physical_edge']]}
    assert not any(summary.values())
    closed={
        'id':'ACF01','severity':'P2','pages':[97],'status':'CLOSED_VERIFIED_R2',
        'reviewBasis':'Page 97 individually opened with view_image detail original at native 120-DPI pixels.',
        'description':'The notification panel is fully within the source viewport; privacy redaction is clipped to its scroll region and no longer spills onto the sidebar below/outside it.'}
    report={
        'recordedUtc':datetime.now(timezone.utc).isoformat(),'document':'academico',
        'run':'cierre_visual_final_20261020_r2/academico','revision':'R2','status':'PASS',
        'visualReviewComplete':True,'approval':True,
        'approvalScope':'Complete 129-page academic document visual layout QA with explicit source-figure/privacy limits; not human MICOTRANS acceptance.',
        'pageCount':129,'coveredPages':list(range(1,130)),
        'individuallyOpenedThisRevision':[97],
        'identityTransferredPages':mapping['identityTransferredPages'],
        'counts':{'individualThisRevision':1,'fullPixelIdentityToReviewedR1':128,'totalCovered':129},
        'pixelIdentityMethod':mapping['method'],'footerExcluded':False,'pages':mapping['pages'],
        'baselineReview':str(BASELINE/'visual_review.json'),
        'reviewLineage':'R2 page 97 inspected directly; all other pages verified identical in both complete PNG bytes and full decoded RGB/dimensions to covered R1 pages. R1 coverage is 26 direct inspections plus 103 complete-pixel transfers from verified academic R3. Open R1 ACF01 was explicitly re-inspected, not inherited as a PASS.',
        'qaDocxPath':snapshot['source'],'qaDocxSha256':EXPECTED,'qaDocxBytes':snapshot['bytes'],
        'qaDocxSharing':snapshot['sharing'],'qaDocxSnapshot':str(current_docx),
        'pdfSha256':audit['pdf']['sha256'],'automatedSummary':summary,
        'sourcePreservation':{
            'chapterOneTextIdenticalToOriginal':True,'chapterOneBodyBlockCount':len(chapter_one(current)),
            'laterChapterSkeletonTextIdenticalToOriginal':True,
            'allBodyAndTocTextIdenticalToReviewedR1':True,
            'textComparisonMethod':'Exact concatenated w:t per body block, preserving order and block boundaries; run segmentation only ignored, no whitespace/text normalization.',
            'originalSha256':ORIGINAL,'originalModified':False,
            'embeddedMediaParts':len(media),'changedEmbeddedMediaVersusR1':changed_media,
            'changedEmbeddedMediaCount':1},
        'findings':[],'openLayoutFindings':[],
        'resolvedFindings':prior['resolvedFindings']+[closed,{
            'id':'MV06','status':'CLOSED_VERIFIED_R2','pages':[97],
            'description':'Notification panel geometry and privacy-redaction containment both visually verified in the current academic render.'}],
        'promotion':{'status':'NOT_AUTHORIZED_PENDING_PARENT_SIGNAL','performed':False},
        'humanMICOTRANSValidation':'PENDING',
        'limits':[
            'Only changed page 97 was reopened in R2; 128 pages transfer actual reviewed observations through complete image identity, not a blanket prior PASS. Every current page has an image hash and review basis.',
            'No footer, border, header or any other pixel region was excluded. No crop, resize or tolerance was used for identity; supplied byte comparison was independently corroborated by RGB hashing.',
            'Parent assistant supplied the COM DOCX/PDF/PNGs. This reviewer did not re-export them. Shared-read snapshots avoid OneDrive sharing-mode limitations and bind structural checks to the exact current DOCX hash.',
            'Visual layout QA does not validate every inherited chapter-one historical factual claim or complete the preserved later heading-only chapter skeleton.',
            'BPMN/ERD diagrams and desktop screenshots are overview figures. Fine details require original source PNG/SVG zoom and the node tables/data dictionary; not every tiny image label is claimed readable at A4 scale.',
            'Intentional privacy masks in inherited captures still obscure list data and some action-form regions (current pages 82-85). Hidden controls/data are not certified readable. No Word clipping or missing-dialog claim is inferred from those intentional masks.',
            'Scrolled/mobile captures are deliberate partial viewport views and may show partial cards/charts, with adjacent views providing context. No independent operational-metric recalculation was performed.',
            'Speech 26 pages and PPT 35 slides remain parent-assistant QA attestations, not independently reopened here. Human MICOTRANS/UAT acceptance remains pending.',
            'No UI, database, builder, source DOCX or final deliverable was modified, and no promotion was executed. Internal PDF/PNGs/snapshots are QA evidence only.'
        ]}
    assert sha(original)==ORIGINAL and sha(current_docx)==EXPECTED
    (RUN/'visual_review.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf8')
    print(json.dumps({k:report[k] for k in ['status','visualReviewComplete','counts','openLayoutFindings','qaDocxSha256','sourcePreservation','promotion']},ensure_ascii=True))

if __name__=='__main__':main()
