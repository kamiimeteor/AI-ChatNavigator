const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');

function setup({blocked=false,nested=false}={}) {
  const timers=new Map(), listeners=new Map(), states=[], scrolls=[];
  let now=0, next=0, updates=0;
  let root={isConnected:true};
  const scroller={isConnected:true,scrollTop:4000,
    getBoundingClientRect:()=>({top:nested?100:0,bottom:900}),
    scrollTo({top}) { this.scrollTop=top; scrolls.push(top); }};
  let turns=Array.from({length:5},(_,i)=>({id:String(i),element:{isConnected:true,y:i*1000,
    getBoundingClientRect(){return {top:this.y-scroller.scrollTop+(nested?100:0),height:1000};}}}));
  const known=new Set([turns[4].element]);
  const adapter={getHistorySnapshot(){
    if(!blocked) turns.forEach(t=>{
      const y=t.element.getBoundingClientRect().top;
      if(y>=0&&y<900) known.add(t.element);
    });
    return {root,turns:turns.slice(),pending:turns.map(t=>t.element).filter(e=>!known.has(e))};
  }};
  const document={hidden:false,scrollingElement:nested?{}:scroller,
    addEventListener(type,fn){listeners.set(type,fn);},
    removeEventListener(type,fn){if(listeners.get(type)===fn)listeners.delete(type);}};
  const context={window:{ACN_AdapterUtils:{scroller:()=>scroller}},document,
    location:{href:'https://chatgpt.com/c/a'},Date:{now:()=>now},
    setTimeout(fn,ms){timers.set(++next,{fn,due:now+ms});return next;},
    clearTimeout(id){timers.delete(id);}};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../content/history-loader.js'),'utf8'),context);
  const loader=context.window.ACN_HistoryLoader;
  const start=()=>loader.start(adapter,()=>updates++,s=>states.push(s));
  return {loader,start,states,scrolls,timers,listeners,context,scroller,turns,known,
    tick(){const item=[...timers].sort((a,b)=>a[1].due-b[1].due)[0];if(!item)return false;
      timers.delete(item[0]);now=item[1].due;item[1].fn();return true;},
    drain(){let i=0;while(this.tick())assert(++i<500,'unbounded loader');},
    input(type,target){listeners.get(type)?.({type,target});},
    changeRoot(){root={isConnected:true};},
    removeTurn(){turns=turns.slice(1);},
    get updates(){return updates;}, get now(){return now;}};
}

test('cold start loads five prompts from one visible prompt and restores the reading position',()=>{
  const f=setup();f.start();assert.equal(f.scrolls.length,0);f.drain();
  assert.equal(f.known.size,5);
  assert.equal(f.scroller.scrollTop,4000);
  assert.equal(f.states.at(-1),'complete');
  assert(f.updates>0);
  assert.equal(f.listeners.size,0);assert.equal(f.timers.size,0);
});
test('reading position is restored relative to its turn when preceding heights change',()=>{
  const f=setup({nested:true});f.start();f.tick();
  f.turns[4].element.y+=200;
  f.drain();assert.equal(f.scroller.scrollTop,4200);
  assert.equal(f.states.at(-1),'complete');
});
for(const type of ['wheel','touchstart','pointerdown','keydown']) {
  test(type+' cancels scanning without pulling the user back',()=>{
    const f=setup();f.start();f.tick();f.input(type);
    f.scroller.scrollTop=1234;f.drain();
    assert.equal(f.scroller.scrollTop,1234);
    assert.equal(f.states.at(-1),'cancelled');assert.equal(f.listeners.size,0);
  });
}
test('interacting during the startup delay prevents automatic scrolling',()=>{
  const f=setup();f.start();f.input('wheel');f.drain();
  assert.equal(f.scrolls.length,0);assert.equal(f.states.at(-1),'cancelled');
});
test('stop button pointerdown leaves cancellation to its click instead of restarting loading',()=>{
  const f=setup();f.start();f.tick();
  f.input('pointerdown',{closest:()=>({})});
  assert.equal(f.states.at(-1),'loading');
  f.loader.cancel();f.drain();assert.equal(f.states.at(-1),'cancelled');
});
for(const change of ['route','root','branch','hidden']) {
  test(change+' change invalidates scanning and the old reading anchor',()=>{
    const f=setup();f.start();f.tick();const before=f.scrolls.length;
    if(change==='route')f.context.location.href='https://chatgpt.com/c/b';
    if(change==='root')f.changeRoot();
    if(change==='branch')f.removeTurn();
    if(change==='hidden')f.context.document.hidden=true;
    f.drain();assert.equal(f.scrolls.length,before);assert.equal(f.states.at(-1),'cancelled');
  });
}
test('unresponsive placeholders time out, restore position and leave a resumable partial result',()=>{
  const f=setup({blocked:true});f.start();f.drain();
  assert.equal(f.states.at(-1),'partial');assert.equal(f.scroller.scrollTop,4000);
  assert(f.now<16000);assert.equal(f.timers.size,0);assert.equal(f.listeners.size,0);
});
test('already observed history does not scroll at all',()=>{
  const f=setup();f.turns.forEach(t=>f.known.add(t.element));f.start();f.drain();
  assert.equal(f.scrolls.length,0);assert.equal(f.states.at(-1),'complete');
});
test('cancellation during restoration prevents the final corrective scroll',()=>{
  const f=setup();f.start();
  while(f.scrolls.at(-1)!==4000) assert(f.tick());
  f.input('wheel');f.scroller.scrollTop=3000;f.drain();
  assert.equal(f.scroller.scrollTop,3000);assert.equal(f.states.at(-1),'cancelled');
});
