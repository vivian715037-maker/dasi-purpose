import { freshState, validateSettings, classify, hostFromUrl, dayStats, settle, COOLDOWN } from './core.js';
import { SERVER_URL, WEB_URL } from './config.js';
import { judgeSite, aiCategory } from './ai.js';

const aiCache = new Map(), aiPending = new Set();
let bootstrapAttempted=false;
const fingerprint = (s, tab) => JSON.stringify([s.session?.startedAt,s.session?.goal,tab.id,tab.url,(tab.title||'').slice(0,300)]);
async function connection() {
  let saved=(await chrome.storage.local.get('connection')).connection;
  if(!saved && !bootstrapAttempted) {
    bootstrapAttempted=true;
    try { const r=await fetch(chrome.runtime.getURL('connection.local.json')); if(r.ok) { const local=await r.json(); if(typeof local.token==='string') { saved={token:local.token}; await chrome.storage.local.set({connection:saved}); } } } catch { /* Public download requires a connection code. */ }
  }
  return saved || {};
}
function scheduleAI(state, tab, key, token) {
  if(aiPending.has(tab.id)) return;
  aiPending.add(tab.id);
  judgeSite(SERVER_URL,token,state.session.goal,tab.url,tab.title).then(
    result => ({result,expires:Date.now()+300000}),
    () => ({error:true,expires:Date.now()+30000})
  ).then(entry => {
    aiPending.delete(tab.id);
    if(aiCache.size>=100) aiCache.clear(); aiCache.set(key,entry);
    serial(async () => {
      const latest=await load(), current=await focusedTab();
      if(latest.session?.status==='running' && current && fingerprint(latest,current)===key) {
        settle(latest,Date.now()); await inspect(latest,Date.now()); await save(latest);
      }
    });
  });
}

const CLOCK = 'wellbeing-clock';
let chain = Promise.resolve();
function serial(work) {
  const next = chain.then(work);
  chain = next.catch(error => console.warn('다시, 목적:', error.message));
  return next;
}
async function load() {
  const state=(await chrome.storage.local.get('state')).state || freshState();
  state.aiConnected=!!(await connection()).token;
  return state;
}
async function save(state) {
  // Bound storage; only daily aggregates, no browsing history.
  for (const key of Object.keys(state.days).sort().slice(0, -90)) delete state.days[key];
  await chrome.storage.local.set({ state });
}
async function ensureClock() {
  if (!await chrome.alarms.get(CLOCK)) await chrome.alarms.create(CLOCK, { periodInMinutes: 0.5 });
}
async function notify(state, id, title, message) {
  if (!state.settings.notifications) return;
  try {
    await chrome.notifications.create(id, { type: 'basic', iconUrl: 'icons/icon128.png', title, message });
    state.status = '';
  } catch { state.status = '시스템 알림을 표시하지 못했습니다. Chrome과 Windows 알림 설정을 확인해 주세요.'; }
}
async function sendTab(tabId, message) {
  if (!Number.isInteger(tabId)) return;
  try { await chrome.tabs.sendMessage(tabId, message); } catch { /* Not injected / protected page. */ }
}
async function clearOverlays() {
  const tabs = await chrome.tabs.query({});
  await Promise.all(tabs.map(tab => sendTab(tab.id, { type: 'WB_CLEAR' })));
}
async function focusedTab() {
  try {
    const win = await chrome.windows.getLastFocused();
    if (!win.focused || win.type !== 'normal') return null;
    return (await chrome.tabs.query({ active: true, windowId: win.id }))[0] || null;
  } catch { return null; }
}
async function overlay(tabId, state, kind) {
  try {
    await chrome.scripting.executeScript({ target: { tabId }, files: ['content.js'] });
    await chrome.tabs.sendMessage(tabId, { type: 'WB_SHOW', kind, goal: state.session.goal, host: state.active.host, source:state.active.source, reason:state.active.reason });
  } catch {
    state.status = '이 페이지는 화면 경고를 지원하지 않습니다. 확장프로그램 팝업에서 상태를 확인해 주세요.';
  }
}
async function inspect(state, now) {
  const previous = state.active;
  const tab = await focusedTab();
  const host = tab?.url?.startsWith(WEB_URL) ? '' : hostFromUrl(tab?.url || '');
  let category = classify(host, state.settings);
  state.active = tab ? { tabId: tab.id, host, category, source:'rule', reason: category==='unknown'?'미등록 사이트입니다.':'사용자가 정한 사이트 규칙' } : null;
  const s = state.session;
  if (!s || s.status !== 'running') { state.trackingAt = null; return; }
  state.trackingAt = host ? now : null;
  if (!host) return;
  const config=await connection();
  state.aiConnected=!!config.token;
  if(category==='unknown' && state.settings.aiEnabled !== false) {
    if(!config.token) {
      state.active.source='fallback';state.active.reason='AI 연결코드를 입력하면 관련성을 판단합니다. 현재는 규칙 기반입니다.';
    } else {
      const key=fingerprint(state,tab), cached=aiCache.get(key);
      if(cached && cached.expires>Date.now()) {
        if(cached.error) {state.active.source='fallback';state.active.reason='AI 연결 실패 · 규칙 기반으로 작동 중';}
        else { category=aiCategory(cached.result); Object.assign(state.active,{category,source:'ai',reason:cached.result.reason,confidence:cached.result.confidence}); }
      } else {
        state.active.source='pending';state.active.reason='AI가 목적과 사이트의 관련성을 확인하고 있어요.';
        scheduleAI(state,tab,key,config.token);
      }
    }
  }
  if(state.active.source!=='pending') state.lastDecision={...state.active,at:now};
  if (category !== 'blocked' && (previous?.host !== host || previous?.category === 'blocked'))
    await sendTab(tab.id, { type: 'WB_CLEAR' });
  if (s.elapsedMs >= s.plannedMinutes * 60000 && !s.planNotified) {
    s.planNotified = true;
    await notify(state, 'wellbeing-plan', '예정한 시간이 지났어요', '목표를 마쳤나요? 팝업에서 종료하거나 10분 연장해 주세요.');
  }
  if (s.sinceBreakMs >= state.settings.breakMinutes * 60000) {
    s.sinceBreakMs = 0;
    dayStats(state, now).breaks++;
    await notify(state, 'wellbeing-break', '눈과 몸을 쉬게 하세요', '20초 동안 먼 곳을 보거나 가볍게 스트레칭해 보세요. 팝업에서 5분 쉬기를 선택할 수 있어요.');
    await overlay(tab.id, state, 'break');
    return;
  }
  const exception = state.exceptions[tab.id];
  if (exception && exception !== host) delete state.exceptions[tab.id];
  if (category === 'blocked' && exception !== host && now - (state.cooldowns[host] || 0) >= COOLDOWN) {
    state.cooldowns[host] = now;
    dayStats(state, now).detections++;
    await notify(state, 'wellbeing-distraction', '처음의 목적을 기억해 볼까요?', `원래 목표는 “${s.goal}”입니다. 계속 이용하시겠어요?`);
    await overlay(tab.id, state, 'distraction');
  }
}
async function tick() {
  const state = await load(), now = Date.now();
  settle(state, now);
  if (state.session?.status === 'break' && now >= state.session.breakUntil && !state.session.breakReady) {
    state.session.breakReady = true;
    await notify(state, 'wellbeing-rest-end', '5분 휴식이 끝났어요', '준비되면 팝업에서 다시 시작해 주세요.');
  }
  await inspect(state, now);
  await save(state);
}
async function command(message, sender) {
  const state = await load(), now = Date.now();
  settle(state, now);
  const trustedUI = ['popup.html', 'dashboard.html'].some(page => sender.url === chrome.runtime.getURL(page)) || sender.url?.startsWith(WEB_URL);
  const contentSender = !trustedUI && !!sender.tab;
  if (!trustedUI && !contentSender) throw new Error('지원하지 않는 요청입니다.');
  if (contentSender && !['RETURN', 'BREAK', 'ALLOW_ONCE', 'DISMISS'].includes(message.type)) throw new Error('지원하지 않는 페이지 요청입니다.');
  // A page can act only on its own currently focused tab in a running session.
  if (contentSender) {
    const current = await focusedTab();
    if (!state.session || state.session.status !== 'running' || current?.id !== sender.tab.id)
      throw new Error('현재 탭에서 실행 중인 세션이 없습니다.');
  }
  switch (message.type) {
    case 'CONNECT': {
      if(typeof message.token!=='string'||message.token.length<16||message.token.length>200) throw new Error('올바른 연결코드를 입력해 주세요.');
      await chrome.storage.local.set({connection:{token:message.token.trim()}}); aiCache.clear();state.aiConnected=true;break;
    }
    case 'GET': break;
    case 'SAVE': state.settings = validateSettings(message.settings); aiCache.clear();state.status = ''; await clearOverlays(); break;
    case 'START': {
      if (state.session && state.session.status !== 'ended') throw new Error('진행 중인 세션을 먼저 종료해 주세요.');
      const settings = validateSettings(message.settings);
      if (!settings.goal) throw new Error('이번에 인터넷을 켠 목적을 입력해 주세요.');
      state.settings = settings;
      state.session = { goal: settings.goal, plannedMinutes: settings.plannedMinutes, startedAt: now, elapsedMs: 0, sinceBreakMs: 0, status: 'running', planNotified: false };
      state.cooldowns = {}; state.exceptions = {}; state.status = ''; aiCache.clear();
      dayStats(state, now).sessions++;
      break;
    }
    case 'PAUSE':
      if (state.session?.status === 'running') state.session.status = 'paused';
      await clearOverlays(); break;
    case 'RESUME':
      if (!['paused', 'break'].includes(state.session?.status)) throw new Error('재개할 세션이 없습니다.');
      if (state.session.status === 'break' && now < state.session.breakUntil) throw new Error('휴식이 끝난 뒤 재개할 수 있어요.');
      state.session.status = 'running'; state.session.breakUntil = null; break;
    case 'END':
      if (state.session) { state.session.status = 'ended'; state.session.endedAt = now; }
      state.exceptions = {}; state.cooldowns = {}; await clearOverlays(); break;
    case 'EXTEND':
      if (!state.session || state.session.status === 'ended') throw new Error('진행 중인 세션이 없습니다.');
      state.session.plannedMinutes += 10; state.session.planNotified = false; break;
    case 'BREAK':
      if (state.session?.status !== 'running') throw new Error('실행 중인 세션에서 휴식을 시작해 주세요.');
      state.session.status = 'break'; state.session.breakUntil = now + 300000;
      state.session.breakReady = false; state.session.sinceBreakMs = 0;
      await clearOverlays(); break;
    case 'RETURN': {
      if (state.session?.status !== 'running') throw new Error('실행 중인 세션이 없습니다.');
      const tab = contentSender ? sender.tab : await focusedTab();
      const url = state.settings.allowed[0] ? `https://${state.settings.allowed[0]}/` : chrome.runtime.getURL('dashboard.html');
      if (tab) await chrome.tabs.update(tab.id, { url }); else await chrome.tabs.create({ url });
      dayStats(state, now).returns++;
      break;
    }
    case 'ALLOW_ONCE': {
      if (state.session?.status !== 'running') throw new Error('실행 중인 세션이 없습니다.');
      const tab = contentSender ? sender.tab : await focusedTab();
      const host = hostFromUrl(tab?.url || '');
      if (host) state.exceptions[tab.id] = host;
      await sendTab(tab?.id, { type: 'WB_CLEAR' }); break;
    }
    case 'DISMISS':
      await sendTab(sender.tab?.id, { type: 'WB_CLEAR' }); break;
    case 'REGISTER': {
      const tab = await focusedTab(), host = hostFromUrl(tab?.url || '');
      if (!host) throw new Error('일반 웹사이트 탭에서 등록해 주세요.');
      if (!['allowed', 'blocked'].includes(message.list)) throw new Error('목록을 확인해 주세요.');
      const settings = structuredClone(state.settings); settings[message.list].push(host);
      state.settings = validateSettings(settings); break;
    }
    default: throw new Error('알 수 없는 요청입니다.');
  }
  await inspect(state, now);
  await save(state);
  return state;
}
chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if(message.type==='PREVIEW' && (sender.url?.startsWith(WEB_URL) || ['popup.html','dashboard.html'].some(p=>sender.url===chrome.runtime.getURL(p)))) {
    connection().then(c=>{
      if(!c.token) throw new Error('AI 연결코드를 먼저 입력해 주세요.');
      if(typeof message.goal!=='string'||!message.goal.trim()||message.goal.length>120||typeof message.url!=='string'||message.url.length>400||typeof message.title!=='string') throw new Error('목적과 URL을 확인해 주세요.');
      return judgeSite(SERVER_URL,c.token,message.goal,message.url,message.title);
    }).then(result=>respond({ok:true,result}),error=>respond({ok:false,error:error.message}));return true;
  }
  serial(() => command(message, sender)).then(state => respond({ ok: true, state }), error => respond({ ok: false, error: error.message }));
  return true;
});
const enqueueTick = () => { serial(tick); };
chrome.tabs.onActivated.addListener(enqueueTick);
chrome.tabs.onUpdated.addListener((_id, change, tab) => {
  if (tab.active && (change.url || change.status === 'complete' || change.title)) enqueueTick();
});
chrome.tabs.onCreated.addListener(tab => { if (tab.active) enqueueTick(); });
chrome.tabs.onRemoved.addListener(tabId => serial(async () => {
  const state = await load(); delete state.exceptions[tabId]; await save(state); await tick();
}));
chrome.windows.onFocusChanged.addListener(enqueueTick);
chrome.alarms.onAlarm.addListener(alarm => { if (alarm.name === CLOCK) enqueueTick(); });
chrome.runtime.onInstalled.addListener(() => serial(async () => { await ensureClock(); await tick(); }));
chrome.runtime.onStartup.addListener(() => serial(async () => {
  const state = await load(); state.trackingAt = null; state.active = null; state.exceptions = {};
  if (state.session && state.session.status !== 'ended') { state.session.status = 'paused'; state.session.breakUntil = null; }
  await save(state); await ensureClock();
}));
// Alarms may be cleared by a browser restart. Restore the periodic checkpoint.
serial(ensureClock);
