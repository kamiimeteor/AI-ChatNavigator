const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
function setup() {
  const listeners = new Map(), timers = new Map();
  let nextTimer = 0, scrolls = 0;
  const container = { scrollTop: 0, scrollTo({top}) { this.scrollTop = top; scrolls++; } };
  const element = { isConnected: true, getBoundingClientRect() { return { top: 1000 - container.scrollTop, bottom: 1100 - container.scrollTop }; } };
  let messages = [{ messageId: 'a', text: 'hello', element }];
  const adapter = { getUserMessages: () => messages };
  const context = {
    window: { innerHeight: 800, ACN_AdapterUtils: { scroller: () => container } },
    document: { scrollingElement: container, documentElement: container,
      addEventListener(type, fn) { listeners.set(type, fn); },
      removeEventListener(type, fn) { if (listeners.get(type) === fn) listeners.delete(type); } },
    location: { href: 'https://chatgpt.com/c/a' },
    setTimeout(fn) { timers.set(++nextTimer, fn); return nextTimer; },
    clearTimeout(id) { timers.delete(id); }
  };
  for (const file of ['message-index.js', 'navigation.js']) vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../content', file), 'utf8'), context);
  return { context, container, element, adapter, listeners, timers,
    entry: context.window.ACN_MessageIndex.create().update(messages)[0],
    nav: context.window.ACN_Navigation,
    flush() { for (const [id, fn] of [...timers]) { timers.delete(id); fn(); } },
    input(type, key) { listeners.get(type)?.({ type, key }); },
    setMessages(value) { messages = value; }, get scrolls() { return scrolls; } };
}
test('navigation scrolls immediately and cleans up after a bounded settle', async () => {
  const f = setup(), promise = f.nav.navigate(f.adapter, f.entry);
  assert.equal(f.scrolls, 1);
  f.flush();
  assert.equal((await promise).status, 'success');
  assert.equal(f.scrolls, 1);
  assert.equal(f.listeners.size, 0);
});
for (const [type, key] of [['wheel'], ['touchstart'], ['pointerdown'], ['keydown', 'PageDown']]) {
  test(type + ' cancels all subsequent scroll correction', async () => {
    const f = setup(), promise = f.nav.navigate(f.adapter, f.entry);
    f.input(type, key);
    f.container.scrollTop = 100;
    f.flush();
    assert.equal((await promise).status, 'cancelled');
    assert.equal(f.container.scrollTop, 100);
    assert.equal(f.scrolls, 1);
    assert.equal(f.listeners.size, 0);
    assert.equal(f.timers.size, 0);
  });
}
test('a second click cancels the previous job without cancelling the new one', async () => {
  const f = setup(), first = f.nav.navigate(f.adapter, f.entry), second = f.nav.navigate(f.adapter, f.entry);
  assert.equal((await first).status, 'cancelled');
  f.flush();
  assert.equal((await second).status, 'success');
});
test('a changed URL blocks old scrolling before the route watcher runs', async () => {
  const f = setup(), promise = f.nav.navigate(f.adapter, f.entry);
  f.context.location.href = 'https://chatgpt.com/c/b';
  f.container.scrollTop = 0;
  f.flush();
  assert.equal((await promise).status, 'cancelled');
  assert.equal(f.scrolls, 1);
});
test('a changed branch or recycled node does not receive a corrective scroll', async () => {
  const f = setup(), promise = f.nav.navigate(f.adapter, f.entry);
  f.setMessages([{ messageId: 'a', text: 'edited', element: f.element }]);
  f.flush();
  assert.equal((await promise).status, 'unavailable');
  assert.equal(f.scrolls, 1);
});
test('there is at most one correction, never a scroll pin', async () => {
  const f = setup(), promise = f.nav.navigate(f.adapter, f.entry);
  f.container.scrollTop = 0;
  f.flush();
  assert.equal((await promise).status, 'success');
  assert.equal(f.scrolls, 2);
  f.container.scrollTop = 0;
  f.flush();
  assert.equal(f.scrolls, 2);
});
test('adapter failures return a recoverable status without leaving listeners', async () => {
  const f = setup();
  f.adapter.getUserMessages = () => { throw Error('fixture failure'); };
  assert.equal((await f.nav.navigate(f.adapter, f.entry)).status, 'failed');
  assert.equal(f.listeners.size, 0);
});

test('a virtual prompt scrolls immediately and succeeds only after its exact text remounts', async () => {
  const f = setup();
  f.adapter.isPlaceholder = node => node === f.element;
  const promise = f.nav.navigate(f.adapter,f.entry);
  assert.equal(f.scrolls,1);
  f.flush();
  assert.equal(f.scrolls,1);
  assert.equal(f.timers.size,1);
  const restored = {isConnected:true,getBoundingClientRect:()=>({top:80,bottom:180})};
  f.setMessages([{messageId:'a',text:'hello',element:restored}]);
  f.flush();
  const result = await promise;
  assert.equal(result.status,'success');
  assert.equal(result.element,restored);
  assert.equal(f.scrolls,1);
  assert.equal(f.listeners.size,0);
});
test('a placeholder that never renders stops without repeated scrolling or a false success', async () => {
  const f = setup(); f.adapter.isPlaceholder = () => true;
  const promise = f.nav.navigate(f.adapter,f.entry);
  for(let i=0;i<25;i++) f.flush();
  assert.equal((await promise).status,'unavailable');
  assert.equal(f.scrolls,1);
  assert.equal(f.timers.size,0);
  assert.equal(f.listeners.size,0);
});
test('manual scrolling cancels placeholder recovery before late remounting', async () => {
  const f = setup(); f.adapter.isPlaceholder = () => true;
  const promise = f.nav.navigate(f.adapter,f.entry);
  f.flush(); f.input('wheel'); f.container.scrollTop=123; f.flush();
  assert.equal((await promise).status,'cancelled');
  assert.equal(f.container.scrollTop,123);
  assert.equal(f.scrolls,1);
  assert.equal(f.timers.size,0);
});
test('edits and route changes invalidate an in-flight placeholder jump', async () => {
  for(const change of ['edit','url']) {
    const f=setup(); f.adapter.isPlaceholder=()=>true;
    const promise=f.nav.navigate(f.adapter,f.entry); f.flush();
    if(change==='edit') f.setMessages([{messageId:'a',text:'new branch',element:f.element}]);
    else f.context.location.href='https://chatgpt.com/c/b';
    f.flush();
    assert.equal((await promise).status,change==='edit'?'unavailable':'cancelled');
    assert.equal(f.scrolls,1);
    assert.equal(f.timers.size,0);
  }
});
