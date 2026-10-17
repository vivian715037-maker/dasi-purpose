// Optional development check. Requires playwright-core and its Chromium browser.
// No dependency is required to install or use the extension itself.
const { chromium } = require('playwright-core');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
async function main() {
  const extension = path.resolve(__dirname, '../extension');
  const output = path.resolve(__dirname, '../test-results');
  fs.mkdirSync(output, { recursive: true });
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'wellbeing-test-'));
  const context = await chromium.launchPersistentContext(profile, {
    channel: 'chrome', headless: true, viewport: { width: 1280, height: 1000 },
    args: ['--enable-unsafe-extension-debugging'], ignoreDefaultArgs: ['--disable-extensions']
  });
  const errors = [];
  context.on('page', page => page.on('pageerror', e => errors.push(e.message)));
  try {
    const cdp = await context.browser().newBrowserCDPSession();
    await cdp.send('Extensions.loadUnpacked', { path: extension });
    let worker = context.serviceWorkers()[0];
    worker ||= await context.waitForEvent('serviceworker', { timeout: 15000 });
    const id = new URL(worker.url()).host;
    console.log('Extension loaded:', id);
    const dashboard = await context.newPage();
    await dashboard.goto(`chrome-extension://${id}/dashboard.html`);
    await dashboard.waitForFunction(() => !document.getElementById('submit').disabled);
    await dashboard.locator('#goal').fill('수학 공부');
    await dashboard.locator('#allowed').fill('wikipedia.org');
    await dashboard.locator('#blocked').fill('youtube.com');
    await dashboard.locator('#break-interval').fill('1');
    // Disable system notifications in automated runs; test on-screen path.
    await dashboard.locator('#notifications').uncheck();
    await dashboard.locator('#submit').click();
    await dashboard.locator('#live').waitFor({ state: 'visible' });
    assert.equal(await dashboard.locator('#live-goal').textContent(), '수학 공부');
    await dashboard.screenshot({ path: path.join(output, 'dashboard.png'), fullPage: true });
    const web = await context.newPage();
    // Fixtures use real domains with local page responses, without visiting the services.
    await context.route('https://wikipedia.org/**', route => route.fulfill({ contentType: 'text/html; charset=utf-8', body: '<!doctype html><html><head><meta charset="utf-8"><title>수학 자료</title></head><body><h1>학습 사이트 테스트</h1></body></html>' }));
    await context.route('https://youtube.com/**', route => route.fulfill({ contentType: 'text/html; charset=utf-8', body: '<!doctype html><html><head><meta charset="utf-8"><title>동영상 페이지</title></head><body style="background:#ecece7;font-family:sans-serif;padding:50px"><h1>방해 사이트 테스트 페이지</h1><p>실제 사이트 대신 로컬 응답으로 검증 중입니다.</p></body></html>' }));
    await context.route('https://example.org/**', route => route.fulfill({ contentType: 'text/html', body: '<h1>미분류 페이지</h1>' }));
    await web.goto('https://wikipedia.org/'); await web.bringToFront();
    await worker.evaluate(async () => {
      const state = (await chrome.storage.local.get('state')).state;
      console.log('Chrome focused:', (await chrome.windows.getLastFocused()).focused);
      return state;
    });
    const snapshot = () => worker.evaluate(async () => (await chrome.storage.local.get('state')).state);
    const waitForState = async predicate => {
      for (let i = 0; i < 80; i++) { const state = await snapshot(); if (predicate(state)) return state; await new Promise(resolve => setTimeout(resolve, 100)); }
      throw new Error(`State condition not met: ${JSON.stringify(await snapshot())}`);
    };
    await waitForState(s => s.active?.category === 'allowed');
    assert.equal(await web.locator('[data-wellbeing-overlay]').count(), 0);
    await web.goto('https://youtube.com/');
    await web.locator('[data-wellbeing-overlay]').waitFor({ state: 'attached' });
    await web.screenshot({ path: path.join(output, 'warning.png'), fullPage: true });
    await waitForState(s => Object.values(s.days).some(d => d.detections === 1));
    // Closed shadow root buttons are intentionally exercised by keyboard.
    await web.keyboard.press('Tab'); await web.keyboard.press('Tab'); await web.keyboard.press('Enter');
    await web.locator('[data-wellbeing-overlay]').waitFor({ state: 'detached' });
    let state = await snapshot();
    assert.equal(state.exceptions[state.active.tabId], 'youtube.com');
    await web.reload(); await new Promise(r => setTimeout(r, 300));
    assert.equal(await web.locator('[data-wellbeing-overlay]').count(), 0);
    await web.goto('https://example.org/'); await waitForState(s => s.active?.category === 'unknown');
    await worker.evaluate(async () => {
      const { state } = await chrome.storage.local.get('state'); state.cooldowns = {}; await chrome.storage.local.set({ state });
    });
    await web.goto('https://youtube.com/'); await web.locator('[data-wellbeing-overlay]').waitFor({ state: 'attached' });
    // Initial focus is the return button.
    await web.keyboard.press('Enter');
    await web.waitForURL('https://wikipedia.org/');
    await waitForState(s => Object.values(s.days).some(d => d.returns === 1));
    await waitForState(s => s.active?.category === 'allowed');
    await new Promise(r => setTimeout(r, 500));
    console.log('Overlay, allow once, return passed. Testing alarm.');
    // Accelerate only the accumulated duration, then exercise the real alarm listener.
    await worker.evaluate(async () => {
      const { state } = await chrome.storage.local.get('state');
      state.session.sinceBreakMs = 60000; await chrome.storage.local.set({ state });
      await chrome.alarms.create('wellbeing-clock', { when: Date.now() + 1000, periodInMinutes: 0.5 });
    });
    try { await web.locator('[data-wellbeing-overlay]').waitFor({ state: 'attached', timeout: 35000 }); }
    catch(error) { console.log('Alarm failure state:',JSON.stringify(await snapshot())); console.log('Alarm:',await worker.evaluate(()=>chrome.alarms.getAll())); throw error; }
    await waitForState(s => Object.values(s.days).some(d => d.breaks >= 1));
    await web.keyboard.press('Enter');
    await waitForState(s => s.session.status === 'break');
    await web.locator('[data-wellbeing-overlay]').waitFor({ state: 'detached' });
    await dashboard.bringToFront();
    await dashboard.locator('#end').click();
    await waitForState(s => s.session.status === 'ended');
    await dashboard.reload();
    await dashboard.locator('#stat-returns').filter({ hasText: '1' }).waitFor();
    const popup = await context.newPage();
    await popup.setViewportSize({ width: 400, height: 600 });
    await popup.goto(`chrome-extension://${id}/popup.html`);
    await popup.waitForFunction(() => !document.getElementById('submit').disabled);
    assert.equal(await popup.locator('#stat-returns').textContent(), '1');
    assert.equal(await popup.evaluate(() => document.documentElement.scrollWidth), 400);
    console.log('Popup start button bottom:', await popup.locator('#submit').evaluate(el=>el.getBoundingClientRect().bottom));
    await popup.screenshot({ path: path.join(output, 'popup.png'), fullPage: true });
    assert.ok(await popup.locator('#submit').evaluate(el=>el.getBoundingClientRect().bottom <= 600), 'Start button should fit in a real 600px popup');
    state = await snapshot();
    assert.equal(Object.values(state.days).reduce((n,d) => n+d.returns,0), 1);
    assert.equal(errors.length, 0, errors.join('\n'));
    console.log(JSON.stringify({ browser: context.browser()?.version(), extensionId:id, result:'PASS', scenarios:['load','start','allowed','blocked overlay','allow once','reload','unknown','return','alarm break','end','storage reload','400px popup'], stats:state.days, pageErrors:errors }, null, 2));
  } finally { await context.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
