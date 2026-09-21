const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

function setup() {
  let shells = [], live = [];
  let root = { querySelectorAll: () => shells };
  const context = {
    window: { ACN_AdapterUtils: { main: () => root, messages: () => live } },
    location: { href: 'https://chatgpt.com/c/a' }
  };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../content/adapters/chatgpt.js'), 'utf8'), context);
  const adapter = context.window.ACN_Adapters[0];
  function add(id, text, order) {
    const shell = {
      id, textContent: text, isConnected: true, intersecting: 'true', order,
      matches: () => true,
      querySelector() { return this.intersecting === 'true' && this.textContent ? {} : null; },
      getAttribute(name) { return name === 'data-turn-id-container' ? this.id : this.intersecting; },
      getBoundingClientRect: () => ({ height: 120 }),
      compareDocumentPosition(other) { return this.order < other.order ? 4 : 2; }
    };
    const element = { isConnected: true, order, closest: () => shell,
      compareDocumentPosition(other) { return this.order < other.order ? 4 : 2; } };
    const message = { messageId: id, text, element };
    shells.push(shell); live.push(message);
    return { shell, message };
  }
  return { adapter, context, add,
    unmount(row) { live = live.filter(m => m !== row.message); row.message.element.isConnected = false;
      row.shell.textContent = ''; row.shell.intersecting = 'false'; },
    remount(row, text = row.message.text) { row.message.text = text; row.message.element.isConnected = true;
      row.shell.textContent = text; row.shell.intersecting = 'true'; live.push(row.message); },
    remove(row) { shells = shells.filter(s => s !== row.shell); live = live.filter(m => m !== row.message); row.shell.isConnected = false; },
    replaceRoot() { root = { querySelectorAll: () => shells }; }
  };
}

test('ChatGPT keeps four known prompts when the first becomes an empty virtual shell', () => {
  const f = setup(), rows = ['a','b','c','d'].map((id,i) => f.add(id,'prompt '+id,i));
  assert.equal(f.adapter.getUserMessages().length,4);
  f.unmount(rows[0]);
  const next = f.adapter.getUserMessages();
  assert.equal(next.length,4);
  assert.equal(next[0].messageId,'a');
  assert.equal(next[0].text,'prompt a');
  assert.equal(next[0].element,rows[0].shell);
  assert.equal(next[0].retained,true);
  f.remount(rows[0]);
  const restored = f.adapter.getUserMessages();
  assert.equal(restored.length,4);
  assert.equal(restored[0].element,rows[0].message.element);
  assert(!restored[0].retained);
});
test('unseen empty shells are never invented as user prompts', () => {
  const f = setup(), a = f.add('a','unknown',0);
  f.unmount(a);
  assert.equal(f.adapter.getUserMessages().length,0);
});
test('removed turns and replaced branch shells evict retained prompts', () => {
  const f = setup(), a = f.add('a','old branch',0);
  f.adapter.getUserMessages(); f.unmount(a); f.remove(a);
  const replacement = f.add('a','unknown new branch',0); f.unmount(replacement);
  assert.equal(f.adapter.getUserMessages().length,0);
});
test('changing conversation or replacing the conversation root clears retained text', () => {
  for (const change of ['url','root']) {
    const f = setup(), a = f.add('a','private prompt',0);
    f.adapter.getUserMessages(); f.unmount(a);
    if (change === 'url') f.context.location.href = 'https://chatgpt.com/c/b';
    else f.replaceRoot();
    assert.equal(f.adapter.getUserMessages().length,0);
  }
});
test('editing a mounted prompt replaces the retained label', () => {
  const f = setup(), a = f.add('a','old text',0);
  f.adapter.getUserMessages(); f.unmount(a); f.remount(a,'edited text');
  f.adapter.getUserMessages(); f.unmount(a);
  assert.equal(f.adapter.getUserMessages()[0].text,'edited text');
});
test('an assistant or unknown rendered replacement cannot inherit a cached user label', () => {
  const f = setup(), a = f.add('a','old text',0);
  f.adapter.getUserMessages(); f.unmount(a);
  a.shell.intersecting = 'true'; a.shell.textContent = 'assistant response';
  assert.equal(f.adapter.getUserMessages().length,0);
  a.shell.intersecting = 'false'; a.shell.textContent = '';
  assert.equal(f.adapter.getUserMessages().length,0);
});
test('duplicate turn IDs cannot retain ambiguous placeholders', () => {
  const f = setup(), a = f.add('a','same',0);
  f.adapter.getUserMessages(); f.unmount(a);
  const duplicate = f.add('a','same',1); f.unmount(duplicate);
  assert.equal(f.adapter.getUserMessages().length,0);
});
test('recycled shell IDs do not retain the previous message', () => {
  const f = setup(), a = f.add('a','old text',0);
  f.adapter.getUserMessages(); f.unmount(a); a.shell.id = 'b';
  assert.equal(f.adapter.getUserMessages().length,0);
});

test('cold start exposes unseen virtual turns for loading without inventing prompts', () => {
  const f=setup(), a=f.add('a','earlier',0), b=f.add('b','latest',1);
  f.unmount(a);
  const before=f.adapter.getHistorySnapshot();
  assert.equal(before.pending.length,1);
  assert.equal(before.pending[0],a.shell);
  assert.equal(f.adapter.getUserMessages().length,1);
  f.remount(a);
  assert.equal(f.adapter.getHistorySnapshot().pending.length,0);
  f.unmount(a);
  assert.equal(f.adapter.getHistorySnapshot().pending.length,0);
  assert.equal(f.adapter.getUserMessages().length,2);
});

test('observed turns are scoped to the exact shell and conversation root', () => {
  const f=setup(), a=f.add('a','earlier',0);
  f.adapter.getHistorySnapshot(); f.unmount(a);
  assert.equal(f.adapter.getHistorySnapshot().pending.length,0);
  f.replaceRoot();
  assert.equal(f.adapter.getHistorySnapshot().pending.length,1);
});
