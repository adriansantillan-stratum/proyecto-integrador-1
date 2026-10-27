import test from 'node:test';
import assert from 'node:assert/strict';
import { notificationPosition } from '../src/components/notificationPosition.ts';

for (const collapsed of [false,true]) {
  for (const viewport of [{width:1440,height:1100},{width:1024,height:768},{width:390,height:844},{width:320,height:568}]) {
    test(`notification fits full viewport ${viewport.width} collapsed=${collapsed}`,()=>{
      const p=notificationPosition({left:196,right:228,top:84,bottom:118},viewport,collapsed);
      assert.ok(p.left>=8 && p.top>=8);
      assert.ok(p.left+p.width<=viewport.width-8);
      assert.ok(p.top+p.maxHeight<=viewport.height-8);
      assert.ok(p.width>0 && p.maxHeight>0);
    });
  }
}
test('bottom-edge trigger opens upward without clipping',()=>{
  const p=notificationPosition({left:280,right:312,top:520,bottom:552},{width:320,height:568},false);
  assert.equal(p.top,112);assert.equal(p.maxHeight,400);assert.equal(p.left,8);
});
