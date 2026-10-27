"""Make an explicit every-page review ledger; automated checks are not visual QA."""
from pathlib import Path
import argparse
import hashlib
import json
import re
import fitz

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--pdf', required=True, type=Path)
    parser.add_argument('--images', required=True, type=Path)
    parser.add_argument('--out', required=True, type=Path)
    args = parser.parse_args()
    files = sorted(args.images.glob('page-*.png'), key=lambda p: int(re.search(r'(\d+)\.png$', p.name).group(1)))
    pages = []
    with fitz.open(args.pdf) as pdf:
        if len(files) != len(pdf):
            raise ValueError('PDF/PNG page count mismatch')
        for index, page in enumerate(pdf):
            suspicious = []
            for block in page.get_text('dict')['blocks']:
                for line in block.get('lines', []):
                    for span in line['spans']:
                        x0, y0, x1, y1 = span['bbox']
                        if x0 < -1 or y0 < -1 or x1 > page.rect.width + 1 or y1 > page.rect.height + 1:
                            suspicious.append({'text': span['text'], 'bbox': span['bbox']})
            text = page.get_text()
            pages.append({'page': index + 1, 'image': str(files[index]),
                          'imageSha256': hashlib.sha256(files[index].read_bytes()).hexdigest(),
                          'pageSize': [page.rect.width, page.rect.height], 'wordCount': len(page.get_text('words')),
                          'outOfBoundsText': suspicious,
                          'fieldErrors': [token for token in ('Error! Reference source not found', 'Error! Bookmark not defined', '¡Error! Marcador no definido') if token in text],
                          'reviewedAt100Percent': False, 'reviewer': None, 'notes': None})
    payload = {'pdf': str(args.pdf), 'pages': pages, 'pageCount': len(pages),
               'visualReviewComplete': False,
               'scope': 'Automated bounds and page inventory; every PNG still needs direct visual inspection at 100 percent.'}
    args.out.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding='utf8')
    print(json.dumps({'pages': len(pages), 'outOfBounds': sum(len(p['outOfBoundsText']) for p in pages),
                      'fieldErrors': sum(len(p['fieldErrors']) for p in pages), 'visualReviewComplete': False}))

if __name__ == '__main__':
    main()
