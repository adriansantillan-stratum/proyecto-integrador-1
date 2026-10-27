"""Compare all page PNG bytes for two QA runs without changing documents."""
import argparse
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2] / 'docs/correccion_integral/_qa/word_final'

def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--old', type=Path, required=True)
    p.add_argument('--new', type=Path, required=True)
    p.add_argument('--out', type=Path, required=True)
    a = p.parse_args()
    for path in (a.old, a.new, a.out):
        if not path.resolve().is_relative_to(ROOT.resolve()):
            p.error('All inputs and outputs must be within word_final')
    old = {int(f.stem.split('-')[-1]): f for f in a.old.glob('page-*.png')}
    new = {int(f.stem.split('-')[-1]): f for f in a.new.glob('page-*.png')}
    pages = []
    for n, path in sorted(new.items()):
        sha = digest(path)
        prior_sha = digest(old[n]) if n in old else None
        pages.append({'page': n, 'new_png': str(path.resolve()), 'sha256': sha,
                      'old_sha256': prior_sha, 'identical_png_bytes': sha == prior_sha})
    report = {'old': str(a.old.resolve()), 'new': str(a.new.resolve()),
              'old_page_count': len(old), 'new_page_count': len(new), 'pages': pages,
              'unchanged_pages': [v['page'] for v in pages if v['identical_png_bytes']],
              'changed_pages': [v['page'] for v in pages if not v['identical_png_bytes']],
              'limits': ['Identity transfers visual observations only if the prior page was actually inspected.',
                         'Changed pages need fresh visual review; this helper does not establish review.']}
    a.out.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf8')
    print(json.dumps({k: v for k,v in report.items() if k != 'pages'}, ensure_ascii=True))

if __name__ == '__main__':
    main()
