const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

function setup(tops, nested = false) {
  const events = new Map(), frames = new Map(), updates = [];
  let io, nextFrame = 0;
  const container = {getBoundingClientRect:()=>({top:100,bottom:900})};
  const document = { scrollingElement:nested?{}:container, nodeType:9,
    addEventListener(type,fn){events.set(type,fn);},
    removeEventListener(type,fn){if(events.get(type)===fn)events.delete(type);} };
  const window = { innerHeight:1120, ACN_AdapterUtils:{scroller:()=>container},
    requestAnimationFrame(fn){frames.set(++nextFrame,fn);return nextFrame;},
    cancelAnimationFrame(id){frames.delete(id);},
    addEventListener(type,fn){events.set(type,fn);},
    removeEventListener(type,fn){if(events.get(type)===fn)events.delete(type);} };
  const elements=tops.map(top=>({top,isConnected:true,getBoundingClientRect(){return {top:this.top,height:68,bottom:this.top+68};}}));
  const context={window,document,Date,setTimeout,clearTimeout,
    IntersectionObserver:class {constructor(cb){io=cb;}observe(){}disconnect(){}}};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../content/observer.js'),'utf8'),context);
  const observer=window.ACN_Observer;
  observer.trackActiveMessage(elements,e=>updates.push(elements.indexOf(e)));
  return {observer,elements,events,frames,updates,
    intersections(){io(elements.map(target=>({target,isIntersecting:target.top>=0,intersectionRatio:target.top>=0?1:0})));},
    scroll(target=document){events.get('scroll')?.({target});},
    flush(){for(const [id,fn] of [...frames]){frames.delete(id);fn();}},
    get active(){return updates.at(-1);} };
}
test('a jump to prompt one at 64px is not overridden by prompt two near screen center',()=>{
  const f=setup([64,894,1366]);
  f.intersections();
  assert.equal(f.active,0);
  f.intersections();
  assert.equal(f.active,0);
});
test('a long answer keeps its preceding prompt active even when its bubble is off-screen',()=>{
  const f=setup([-800,320,1400]);
  f.intersections();
  assert.equal(f.active,0);
});
test('manual scrolling switches only when the next prompt reaches the reading line',()=>{
  const f=setup([64,894,1366]);
  f.elements.forEach(e=>e.top-=700); f.scroll(); f.flush();
  assert.equal(f.active,0);
  f.elements.forEach(e=>e.top-=120); f.scroll(); f.flush();
  assert.equal(f.active,1);
});
test('the reading line follows a nested scroll container rather than window center',()=>{
  const f=setup([164,440,950],true);
  f.intersections();
  assert.equal(f.active,0);
  f.elements.forEach(e=>e.top-=270);f.scroll();f.flush();
  assert.equal(f.active,1);
});
test('scroll events are batched and sidebar scrolling does not change the chat highlight',()=>{
  const f=setup([64,894]);
  f.scroll({nodeType:1,closest:()=>({})});
  assert.equal(f.frames.size,0);
  for(let i=0;i<100;i++)f.scroll();
  assert.equal(f.frames.size,1);
  f.flush();assert.equal(f.frames.size,0);
});
test('replacing message nodes recomputes without carrying the old highlight',()=>{
  const f=setup([64,894]);
  f.elements.forEach(e=>e.isConnected=false);
  const fresh={isConnected:true,getBoundingClientRect:()=>({top:64,height:68})};
  let selected;
  f.observer.trackActiveMessage([fresh],e=>selected=e);
  assert.equal(selected,fresh);
});
test('destroy removes pending frame, scroll listener, and resize listener',()=>{
  const f=setup([64,894]);f.scroll();f.observer.stopTrackingActive();
  assert.equal(f.frames.size,0);
  assert.equal(f.events.size,0);
});
