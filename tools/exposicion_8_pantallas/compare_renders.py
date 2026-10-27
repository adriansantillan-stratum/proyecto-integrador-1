from pathlib import Path
from PIL import Image
import hashlib,json,sys

ROOT=Path(__file__).resolve().parents[2]
QA=ROOT/'docs/exposicion_8_pantallas/_qa'
def body_hash(path):
    with Image.open(path) as image:
        # Exclude only the footer folio area; all body content remains compared.
        return hashlib.sha256(image.crop((0,0,image.width,1040)).tobytes()).hexdigest()
old={}
old_folder=sys.argv[1] if len(sys.argv)>1 else 'render_final'
new_folder=sys.argv[2] if len(sys.argv)>2 else 'render_verified'
report_name=sys.argv[3] if len(sys.argv)>3 else 'render_comparison.json'
for p in (QA/old_folder).glob('page-*.png'):
    old.setdefault(body_hash(p),[]).append(int(p.stem.split('-')[-1]))
pages=[]
for p in sorted((QA/new_folder).glob('page-*.png')):
    page=int(p.stem.split('-')[-1]);matches=old.get(body_hash(p),[])
    pages.append({'page':page,'body_matches_reviewed_pages':matches,'requires_new_visual_review':not bool(matches)})
result={'compared_pages':len(pages),'changed_pages':[p['page'] for p in pages if p['requires_new_visual_review']],'pages':pages}
(QA/report_name).write_text(json.dumps(result,indent=2),encoding='utf-8')
print(json.dumps({k:v for k,v in result.items() if k!='pages'}))
