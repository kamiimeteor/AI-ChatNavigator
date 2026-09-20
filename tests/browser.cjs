const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
// Playwright is a development-only dependency; it is never packaged.
const { chromium } = require('playwright');
const { tmpdir } = require('node:os');
const root = process.env.ACN_EXTENSION_DIR || path.resolve(__dirname, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json')));
const output = fs.mkdtempSync(path.join(tmpdir(), 'acn-browser-qa-'));
const results = [];
function rows(platform, count, prefix = 'Prompt') {
  return Array.from({ length: count }, (_, i) => {
    const text = `${prefix} ${String(i + 1).padStart(3, '0')}: explain this part of the project`;
    const user = platform === 'chatgpt' ? `<div data-message-author-role="user" data-message-id="${prefix}-${i}"><div class="user-message-bubble-color">${text}</div></div>` : platform === 'claude' ? `<div data-testid="user-message" data-message-id="${prefix}-${i}" class="font-user-message">${text}</div>` : `<user-query data-message-id="${prefix}-${i}"><user-query-content>${text}</user-query-content></user-query>`;
    return `<article>${user}<div class="answer">Assistant answer ${i + 1}. This explanation remains outside the prompt outline.</div></article>`;
  }).join('');
}
function fixture(platform, count = 30) {
  return `<!doctype html><html><head><meta charset="utf-8"><title>Stability fixture | ${platform}</title><style>body{margin:0;padding:24px;font:16px system-ui;background:#fafafa;color:#222}h1{font-size:20px}#chat-history{height:620px;overflow:auto;border:1px solid #ddd;padding:20px;max-width:900px}article{margin:0 0 32px}article>div:first-child,user-query{display:block;background:#e8eef7;border-radius:12px;padding:18px}user-query-content{display:block}.answer{padding:20px;min-height:130px;line-height:1.6}main{max-width:960px}</style></head><body><h1>${platform} · synthetic chat fixture</h1><main><div id="chat-history"><div data-test-render-count="1">${rows(platform,count)}</div></div></main></body></html>`;
}
(async () => {
  let currentContext = null;
  let browserVersion = null;
  try {
    console.log('Synthetic fixtures with a real unpacked extension and Chrome APIs');
    for (const platform of ['chatgpt', 'claude', 'gemini']) {
      const origin = { chatgpt:'https://chatgpt.com', claude:'https://claude.ai', gemini:'https://gemini.google.com' }[platform];
      const routePath = { chatgpt:'/c/fixture', claude:'/chat/fixture', gemini:'/u/1/app/fixture' }[platform];
      const context = await chromium.launchPersistentContext(fs.mkdtempSync(path.join(tmpdir(), 'acn-test-profile-')), { channel:'chrome', headless:true, viewport:{width:1280,height:800}, ignoreDefaultArgs:['--disable-extensions'],args:['--enable-unsafe-extension-debugging'] });
      currentContext = context;
      browserVersion = context.browser().version();
      const browserCDP = await context.browser().newBrowserCDPSession();
      const {id:extensionId} = await browserCDP.send('Extensions.loadUnpacked',{path:root});
      const installed = await browserCDP.send('Extensions.getExtensions');
      assert.equal(installed.extensions.find(ext => ext.id === extensionId)?.version, manifest.version);
      await context.route('**/*', route => route.request().resourceType() === 'document' ? route.fulfill({contentType:'text/html',body:fixture(platform)}) : route.abort());
      const page = await context.newPage();
      const errors = [], logs = [];
      page.on('pageerror', e => errors.push(e.message));
      page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.text()); logs.push(m.text()); });
      const cdp = await context.newCDPSession(page);
      const contexts=[];
      cdp.on('Runtime.executionContextCreated',({context})=>contexts.push(context));
      cdp.on('Runtime.exceptionThrown',({exceptionDetails})=>errors.push(exceptionDetails.exception?.description || exceptionDetails.text));
      await cdp.send('Runtime.enable');
      await page.goto(origin + routePath);
      await page.waitForSelector('.acn-toc-item');
      const executionContextId = contexts.find(c=>c.origin==='chrome-extension://'+extensionId).id;
      async function world(expression) {
        const response = await cdp.send('Runtime.evaluate', { expression, contextId:executionContextId, returnByValue:true, awaitPromise:true });
        if (response.exceptionDetails) throw Error(response.exceptionDetails.exception?.description || response.exceptionDetails.text);
        return response.result.value;
      }
      assert.equal(page.url(), origin + routePath);
      assert.match(await page.title(), /Stability fixture/);
      await page.waitForFunction(() => document.querySelectorAll('.acn-toc-item').length === 30);
      await page.getByRole('button', {name:'Pin sidebar', exact:true}).click();
      assert.match(await page.locator('.acn-coverage').innerText(), /30 loaded prompts/);
      assert(!(await page.locator('.acn-toc').innerText()).includes('Assistant answer'));
      assert.equal(await world('typeof window.ACN_activeAdapter.getUserMessages'), 'function');
      assert.equal(await page.evaluate(() => typeof window.ACN_activeAdapter), 'undefined');
      // User-visible click navigates in the correct nested scroll container.
      await page.locator('.acn-toc-item').nth(20).click();
      await page.waitForFunction(() => document.querySelector('.acn-highlight-flash'));
      const jumped = await page.locator('[data-message-id="Prompt-20"]').boundingBox();
      assert(jumped.y > 50 && jumped.y < 200, JSON.stringify(jumped));
      // Assistant streaming must not create/remove TOC entries or lose focus.
      await page.locator('.acn-toc-item').nth(20).focus();
      await page.evaluate(() => {
        window.__counts={added:0,removed:0}; window.__savedItem=document.querySelectorAll('.acn-toc-item')[20];
        window.__tocObserver=new MutationObserver(ms => ms.forEach(m => {window.__counts.added += m.addedNodes.length;window.__counts.removed += m.removedNodes.length}));
        window.__tocObserver.observe(document.querySelector('.acn-toc'),{childList:true});
      });
      await page.evaluate(async () => {
        const answer=document.querySelector('.answer');
        for(let i=0;i<100;i++){answer.textContent='Streaming answer '+i;await new Promise(requestAnimationFrame)}
      });
      await page.waitForTimeout(100);
      assert.deepEqual(await page.evaluate(() => window.__counts), {added:0,removed:0});
      assert(await page.evaluate(() => document.activeElement===window.__savedItem));
      // Unloading history preserves labels and removes obsolete entries.
      const second = await page.locator('.acn-toc-item').nth(1).innerText();
      await page.locator('article').first().evaluate(el => el.remove());
      await page.waitForFunction(() => document.querySelectorAll('.acn-toc-item').length===29);
      assert.equal(await page.locator('.acn-toc-item').first().innerText(), second);
      await page.evaluate(() => window.__tocObserver.disconnect());
      // Cancel before the delayed correction; manual movement must remain.
      await world(`window.__navResult=null; ACN_Navigation.navigate(ACN_activeAdapter,ACN_Sidebar.getEntries()[15]).then(r=>window.__navResult=r.status); void 0;`);
      await page.evaluate(() => { document.dispatchEvent(new WheelEvent('wheel',{bubbles:true,deltaY:100}));document.querySelector('#chat-history').scrollTop=333; });
      await page.waitForTimeout(180);
      assert.equal(await world('window.__navResult'), 'cancelled');
      assert.equal(await page.locator('#chat-history').evaluate(el=>el.scrollTop),333);
      // Rapid clicks select the last request.
      await page.locator('.acn-toc-item').nth(3).dispatchEvent('click');
      await page.locator('.acn-toc-item').nth(12).dispatchEvent('click');
      await page.waitForFunction(() => document.querySelector('.acn-highlight-flash')?.getAttribute('data-message-id') === 'Prompt-13');
      // Route changes invalidate an in-flight request before the URL poll.
      await world(`window.__navResult=null; ACN_Navigation.navigate(ACN_activeAdapter,ACN_Sidebar.getEntries()[0]).then(r=>window.__navResult=r.status); void 0;`);
      await page.evaluate(newURL => { history.pushState({},'',newURL);document.querySelector('#chat-history').scrollTop=444; }, origin+routePath+'-next');
      await page.waitForTimeout(180);
      assert.equal(await world('window.__navResult'), 'cancelled');
      assert.equal(await page.locator('#chat-history').evaluate(el=>el.scrollTop),444);
      await page.waitForTimeout(400);
      assert.equal(await page.locator('.acn-sidebar').count(),1);
      // Replacing the whole observed container still recovers on the same URL.
      await page.locator('main').evaluate((el, html) => {el.outerHTML=html;}, `<main><div id="chat-history"><div data-test-render-count="1">${rows(platform,3,'Replacement')}</div></div></main>`);
      await page.waitForFunction(() => document.querySelectorAll('.acn-toc-item').length === 3);
      assert.match(await page.locator('.acn-toc-item').first().innerText(), /Replacement/);
      // Exercise failure and Retry without spending ten seconds on the deadline.
      await world(`window.__now=Date.now; Date.now=()=>window.__now()+20000;`);
      await page.locator('article').evaluateAll(els=>els.forEach(el=>el.remove()));
      await page.waitForFunction(() => document.querySelector('.acn-state-text')?.textContent.includes('Could not read'));
      await page.getByRole('button',{name:'Retry',exact:true}).click();
      await page.waitForFunction(() => document.querySelector('.acn-state-text')?.textContent.includes('Waiting'));
      await page.locator('[data-test-render-count]').evaluate((el,html)=>el.innerHTML=html, rows(platform,30,'Recovered'));
      await page.waitForFunction(() => document.querySelectorAll('.acn-toc-item').length===30);
      assert.equal(await world('ACN_Sidebar.getState()'),'READY');
      // Host input remains visible; all user-facing navigation is keyboard focusable.
      assert.equal(await page.locator('.acn-toc-item').first().evaluate(el=>el.tagName),'BUTTON');
      await page.locator('.acn-toc-item').nth(5).focus();
      await page.keyboard.press('Enter');
      await page.waitForFunction(() => document.querySelector('.acn-highlight-flash')?.getAttribute('data-message-id')==='Recovered-5');
      await page.mouse.move(1100,100);
      await page.screenshot({path:path.join(output,platform+'-desktop.png')});
      await page.setViewportSize({width:800,height:720});
      const panel = await page.locator('.acn-sidebar').boundingBox();
      assert(panel && panel.x>=0 && panel.x+panel.width<=800);
      await page.screenshot({path:path.join(output,platform+'-narrow.png')});
      assert.deepEqual(errors,[]);
      assert(!logs.some(l=>l.includes('Recovered') || l.includes('Prompt')));
      results.push({platform,checks:12,streamUpdates:100,tocNodesAdded:0,tocNodesRemoved:0,consoleErrors:errors.length});
      console.log('PASS',platform,JSON.stringify(results.at(-1)));
      await context.close();
      currentContext = null;
    }
    fs.writeFileSync(path.join(output,'results.json'), JSON.stringify({browser:browserVersion,kind:'synthetic fixtures with real unpacked extension and Chrome APIs',results},null,2));
    console.log('Artifacts:',output);
  } finally {if (currentContext) await currentContext.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
