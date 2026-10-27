"""Map full-page decoded RGB pixel identity across renumbered QA runs.

No cropping, footer exclusion, resizing, tolerance or OCR similarity is used.
Only prior pages whose PNG file hashes match the saved review are reusable.
"""
import argparse
import hashlib
import json
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path
from PIL import Image

QA = Path(__file__).resolve().parents[2] / 'docs/correccion_integral/_qa/word_final'

def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def pixels(path):
    with Image.open(path) as source:
        im = source.convert('RGB')
        return {'width': im.width, 'height': im.height,
                'rgb_sha256': hashlib.sha256(im.tobytes()).hexdigest()}

def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--old', type=Path, required=True)
    p.add_argument('--new', type=Path, required=True)
    p.add_argument('--review', type=Path, required=True)
    p.add_argument('--out', type=Path, required=True)
    a = p.parse_args()
    for path in (a.old, a.new, a.review, a.out):
        if not path.resolve().is_relative_to(QA.resolve()):
            p.error('All paths must be under authorized QA root')
    review = json.loads(a.review.read_text(encoding='utf-8-sig'))
    assert review['visualReviewComplete']
    # Prior reports may contain direct observations or already audited exact
    # pixel-identity transfers. This transfers observations, never a PASS verdict.
    artifacts=review.get('viewedPageArtifacts',review.get('pages',[]))
    covered=set(review.get('viewedPages',review.get('coveredPages',[])))
    reviewed = {v['page']: v for v in artifacts if (
        v.get('individuallyViewed') or v.get('individuallyViewedThisRevision') or v['page'] in covered or
        v.get('reviewBasis') in ('individually_opened_r4',
                                'own_r3_review_transferred_by_identical_png_sha256') or
        v.get('review_status')=='prior_individual_review_full_pixel_identity')}
    old_by_pixels = defaultdict(list)
    old_pages = []
    for path in sorted(a.old.glob('page-*.png')):
        n = int(path.stem.split('-')[-1])
        file_hash = sha(path)
        assert n in reviewed and file_hash == (reviewed[n].get('sha256') or reviewed[n].get('png_sha256')), f'Unverified old page {n}'
        pixel = pixels(path)
        old_pages.append({'page': n, 'png_sha256': file_hash, **pixel})
        old_by_pixels[(pixel['width'],pixel['height'],pixel['rgb_sha256'])].append(n)
    pages = []
    for path in sorted(a.new.glob('page-*.png')):
        n = int(path.stem.split('-')[-1])
        pixel = pixels(path)
        matches = old_by_pixels.get((pixel['width'],pixel['height'],pixel['rgb_sha256']), [])
        pages.append({'page': n, 'file': path.name, 'png_sha256': sha(path), **pixel,
                      'identical_prior_reviewed_pages': matches,
                      'review_status': 'prior_individual_review_full_pixel_identity' if matches else 'NEEDS_INDIVIDUAL_REVIEW'})
    result = {'createdUtc': datetime.now(timezone.utc).isoformat(),
              'old': str(a.old.resolve()), 'new': str(a.new.resolve()),
              'oldReview': str(a.review.resolve()), 'oldPageCount':len(old_pages), 'newPageCount':len(pages),
              'method': 'SHA-256 of decoded RGB bytes AND exact width/height; entire image including footer; no crop/resize/tolerance',
              'footerExcluded': False, 'oldPages':old_pages, 'pages':pages,
              'identityTransferredPages':[v['page'] for v in pages if v['identical_prior_reviewed_pages']],
              'needsIndividualReview':[v['page'] for v in pages if not v['identical_prior_reviewed_pages']],
              'visualReviewComplete':False}
    a.out.write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf8')
    print(json.dumps({k:v for k,v in result.items() if k not in ('oldPages','pages')},ensure_ascii=True))

if __name__ == '__main__':
    main()
