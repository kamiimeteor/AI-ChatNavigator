const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
function loadIndex() {
  const context = { window: {} };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../content/message-index.js'), 'utf8'), context);
  return context.window.ACN_MessageIndex;
}
function message(text, id = '', element = { isConnected: true }) {
  return { text, messageId: id, element };
}
test('unchanged and remounted messages keep their stable identity', () => {
  const api = loadIndex(), index = api.create();
  const first = index.update([message('first', 'a'), message('second', 'b')]);
  const next = index.update([message('second', 'b')]);
  assert.equal(next[0].key, first[1].key);
  assert.equal(next[0].label, first[1].label);
  assert.equal(next.length, 1); // Removed/hidden messages are not silently archived.
  assert.equal(next[0].label, 'second'); // No false global Q1 numbering.
});
test('a missing ID cannot fall back to a duplicate prompt or array index', () => {
  const api = loadIndex(), old = message('repeat', 'missing');
  const entry = api.create().update([old])[0];
  old.element.isConnected = false;
  entry.index = 4;
  assert.equal(api.resolve(entry, [message('repeat', 'a'), message('repeat', 'b')]), null);
});
test('the exact live node distinguishes identical prompts with no IDs', () => {
  const api = loadIndex(), first = message('repeat'), second = message('repeat');
  const entries = api.create().update([first, second]);
  assert.notEqual(entries[0].key, entries[1].key);
  assert.equal(api.resolve(entries[1], [first, second]), second.element);
  second.element.isConnected = false;
  assert.equal(api.resolve(entries[1], [first, message('repeat')]), null);
});
test('recycled elements and edited messages cannot satisfy a stale navigation', () => {
  const api = loadIndex(), old = message('before', 'a');
  const entry = api.create().update([old])[0];
  assert.equal(api.resolve(entry, [message('after', 'a', old.element)]), null);
  assert.equal(api.resolve(entry, [message('before', 'b', old.element)]), null);
  assert.equal(api.resolve(entry, []), null);
});
test('duplicate IDs do not collapse rows or select a remounted duplicate', () => {
  const api = loadIndex(), first = message('same', 'duplicate'), second = message('same', 'duplicate');
  const entries = api.create().update([first, second]);
  assert.notEqual(entries[0].key, entries[1].key);
  first.element.isConnected = false;
  assert.equal(api.resolve(entries[0], [message('same', 'duplicate'), second]), null);
});
test('only a unique exact stable identity can resolve a replaced element', () => {
  const api = loadIndex(), old = message('hello   world', 'a');
  const entry = api.create().update([old])[0];
  old.element.isConnected = false;
  const fresh = message('hello\nworld', 'a');
  assert.equal(api.resolve(entry, [fresh]), fresh.element);
});
test('platform matching excludes unsupported and lookalike hosts', () => {
  const context = { window: {}, location: {} };
  for (const platform of ['chatgpt', 'claude', 'gemini']) {
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../content/adapters', platform + '.js'), 'utf8'), context);
  }
  for (const [host, route, expected] of [
    ['chatgpt.com', '/c/123', 'chatgpt'], ['chat.openai.com', '/', 'chatgpt'],
    ['claude.ai', '/chat/123', 'claude'], ['gemini.google.com', '/u/1/app/123', 'gemini'],
    ['chatgpt.com', '/settings', undefined], ['claude.ai', '/settings', undefined],
    ['notclaude.ai', '/chat/123', undefined], ['gemini.google.com.evil.test', '/app', undefined]
  ]) {
    Object.assign(context.location, { hostname: host, pathname: route });
    assert.equal(context.window.ACN_Adapters.find(a => a.match())?.name, expected, host + route);
  }
});
