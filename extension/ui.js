import { localDay } from './core.js';
import { WEB_URL } from './config.js';
const $ = id => document.getElementById(id);
const isDashboard = document.body.classList.contains('dashboard');
document.getElementById('app').innerHTML = `
  <header class="topbar"><div class="brand"><img src="icons/icon128.png" alt="">다시, 목적</div><a href="dashboard.html" target="_blank" id="dashboard-link">나의 기록 ↗</a></header>
  <section class="hero"><div class="eyebrow">A little pause, a better day</div><h1>인터넷을 켠 이유,<br>잊지 않도록.</h1><p>잠깐 멈추고, 내가 원한 일상으로 돌아오세요.</p></section>
  <div class="layout"><div class="stack">
    <section class="card tint" id="session-card">
      <div id="idle"><div class="card-head"><h2>오늘의 작은 약속</h2><span class="number">01 / PURPOSE</span></div><div class="intro-visual"><p class="intro-copy">무조건 막기보다,<br>내가 정한 목적을 떠올리는 연습.</p><div class="leaf" aria-hidden="true"></div></div></div>
      <div id="live" hidden><div class="status-row"><span class="dot" id="status-dot"></span><span id="session-status"></span></div><h2 class="goal-title" id="live-goal"></h2><div class="timer" id="timer">00:00</div><div class="timer-label">Chrome 사용 중 세션 시간 · 실제 집중도를 뜻하지 않아요</div><div class="progress"><span id="progress"></span></div><div class="session-meta"><span id="plan-left"></span><span id="break-left"></span></div><div class="notice" id="plan-notice" hidden>예정한 시간이 지났어요. 마쳤다면 종료하고, 더 필요하면 연장하세요.</div><div class="notice" id="break-notice" hidden></div><div class="actions"><button class="primary" id="pause">일시정지</button><button id="rest">5분 쉬기</button><button class="danger" id="end">종료</button></div><div class="actions" id="extend-row" hidden><button id="extend">10분 연장</button></div>
      <div class="site"><div class="site-text"><small>현재 Chrome 탭</small><strong id="current-host"></strong></div><span class="badge" id="category"></span></div><div class="actions" id="classify-actions" hidden><button data-list="allowed">허용 사이트로 등록</button><button data-list="blocked">방해 사이트로 등록</button></div><div class="actions" id="blocked-actions" hidden><button id="return">목표로 돌아가기</button><button id="allow-once">이번만 허용</button></div></div>
    </section>
    <button id="toggle-settings" hidden>사이트·휴식 설정 수정</button>
    <section class="card" id="form-card"><div class="card-head"><h2 id="form-title">무엇을 하러 왔나요?</h2><span class="number">02 / PLAN</span></div>
      <form id="settings-form"><label class="field" for="goal">이번 인터넷 사용의 목적<input id="goal" name="goal" type="text" maxlength="120" placeholder="예: 수학 공부, 자료 조사" autocomplete="off"></label><div class="fields"><label class="field" for="planned">예정 시간 (분)<input id="planned" type="number" min="1" max="240" value="30" required></label><label class="field" for="break-interval">휴식 안내 간격 (분)<input id="break-interval" type="number" min="1" max="240" value="30" required></label></div><label class="field" for="allowed">허용 사이트<textarea id="allowed" placeholder="wikipedia.org&#10;docs.python.org" spellcheck="false"></textarea></label><label class="field" for="blocked">방해 사이트<textarea id="blocked" placeholder="youtube.com&#10;instagram.com" spellcheck="false"></textarea></label><p class="hint">줄바꿈·쉼표로 구분 · 하위 도메인 포함 · 미등록 사이트는 차단하지 않아요</p><label class="check"><input id="notifications" type="checkbox" checked>시스템 알림 사용</label><button class="primary full" id="submit" type="submit">나의 목적 시작하기 →</button><p class="hint" id="settings-hint">설정과 기록은 이 브라우저에만 저장됩니다.</p></form>
    </section>
  </div><div class="stack">
    <section class="card"><div class="card-head"><h2>오늘, 나의 발걸음</h2><span class="number" id="today-label"></span></div><div class="metrics"><div class="metric wide"><span>Chrome 사용 중 세션 시간</span><strong id="stat-time">0분</strong></div><div class="metric"><strong id="stat-sessions">0</strong><span>시작한 세션</span></div><div class="metric"><strong id="stat-detections">0</strong><span>방해 사이트 경고</span></div><div class="metric"><strong id="stat-returns">0</strong><span>목표로 돌아온 횟수</span></div><div class="metric"><strong id="stat-breaks">0</strong><span>휴식 안내</span></div></div><p class="note">세션 시간에는 방해 사이트 이용도 포함돼요.<br>창을 벗어나거나 일시정지한 시간은 제외해요.</p><div class="mini-bars" id="weekly" aria-label="최근 7일 세션 시간"></div></section>
    <section class="card"><div class="eyebrow">Small steps matter</div><h2 style="margin-top:10px">화면 밖에도,<br>좋은 하루가 있어요.</h2><p class="note">20초 먼 곳 바라보기, 가볍게 기지개 켜기.<br>작은 휴식부터 시작해 보세요.</p><p class="note">AI 추정 + 규칙 기반 · 기록은 기기에 저장<br>Chrome 웹사이트에서만 작동합니다. 시스템 알림은 Windows 알림·집중 지원 설정에 따라 표시되지 않을 수 있어요.</p><button id="install-help" style="margin-top:16px">설치·시연 안내</button><div id="help" class="note" hidden>Chrome 확장프로그램 페이지에서 개발자 모드를 켜고 이 extension 폴더를 로드하세요.<br><br>시연: 목적 ‘수학 공부’ → 허용 wikipedia.org → 방해 youtube.com → 시작 → 두 사이트 방문 → 경고·복귀 확인.<br><br>휴식 간격을 1분으로 설정하면 빠르게 테스트할 수 있어요. 경고가 안 보이면 사이트 접근 권한을 확인하고 웹페이지를 새로고침하세요.</div></section>
  </div></div>
  <div class="notice" id="system-notice" hidden></div><div id="feedback" role="status" aria-live="polite" hidden></div><footer class="footer"><span>나를 통제하는 대신, 나의 선택을 돕습니다.</span><span>LOCAL ONLY · DIGITAL WELLBEING</span></footer>`;
if (isDashboard) { $('dashboard-link').textContent = '나만의 디지털 웰빙'; $('dashboard-link').removeAttribute('href'); }
const aiPanel=document.createElement('details');aiPanel.className='card ai-panel';
aiPanel.innerHTML=`<summary>AI 연결 · <span id="ai-connection-status">확인 중</span></summary><p class="note">AI 사용 시 목적·도메인·페이지 제목이 서버와 OpenRouter로 전달됩니다. 본문·입력 내용·URL 경로와 검색어는 보내지 않습니다. 사용자가 정한 사이트 규칙을 우선 적용합니다.</p><label class="check"><input type="checkbox" id="ai-enabled" checked>미분류 사이트의 AI 관련성 판단 사용</label><label class="field">시연 연결코드 (AI API 키가 아닙니다)<input type="password" id="connection-token" autocomplete="off" placeholder="연결코드 붙여넣기"></label><button id="connect-ai" class="full" style="margin-top:12px">AI 연결</button><p class="note">코드를 입력하지 않거나 AI가 실패하면 기존 규칙으로 작동합니다.</p><a id="web-app-link" target="_blank">GitHub Pages 웹앱 열기 ↗</a>`;
$('form-card').after(aiPanel);$('web-app-link').href=WEB_URL;
const aiReason=document.createElement('p');aiReason.id='ai-reason';aiReason.className='note';$('current-host').parentElement.parentElement.after(aiReason);
let state, busy = false, formDirty = false;
$('submit').disabled = true;
let feedbackTimer;
function feedback(message, error = false) {
  $('feedback').textContent = message; $('feedback').classList.toggle('error', error); $('feedback').hidden = false;
  clearTimeout(feedbackTimer); feedbackTimer = setTimeout(() => { $('feedback').hidden = true; }, 6000);
}
function format(ms) { const seconds = Math.max(0, Math.floor(ms / 1000)); return `${String(Math.floor(seconds/60)).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')}`; }
function readForm() { return { goal: $('goal').value, plannedMinutes: $('planned').value, breakMinutes: $('break-interval').value, allowed: $('allowed').value, blocked: $('blocked').value, notifications: $('notifications').checked, aiEnabled:$('ai-enabled').checked }; }
function fillForm() {
  const s = state.settings;
  $('goal').value = s.goal; $('planned').value = s.plannedMinutes; $('break-interval').value = s.breakMinutes;
  $('allowed').value = s.allowed.join('\n'); $('blocked').value = s.blocked.join('\n'); $('notifications').checked = s.notifications;
  $('ai-enabled').checked=s.aiEnabled!==false;
}
function render() {
  if (!state) return;
  const s = state.session, active = s && s.status !== 'ended', now = Date.now();
  document.body.classList.toggle('session-active', !!active);
  $('ai-connection-status').textContent=state.aiConnected?'연결코드 저장됨':'연결코드 필요';
  $('toggle-settings').hidden = isDashboard || !active;
  $('live').hidden = !active; $('idle').hidden = !!active;
  const labels = { running: '나의 목적을 이어가는 중', paused: '잠시 멈췄어요', break: '화면 밖에서 쉬어 가세요' };
  $('form-title').textContent = active ? '나의 약속 수정하기' : '무엇을 하러 왔나요?';
  $('submit').textContent = active ? '사이트·휴식 설정 저장' : '나의 목적 시작하기 →';
  $('goal').disabled = !!active; $('planned').disabled = !!active;
  $('settings-hint').textContent = active ? '현재 세션의 목적·예정 시간은 유지됩니다. 시간을 더하려면 10분 연장을 누르세요.' : '설정과 기록은 이 브라우저에만 저장됩니다.';
  if (active) {
    const projection = s.status === 'running' && state.trackingAt !== null && now - state.trackingAt <= 90000 ? Math.max(0, now-state.trackingAt) : 0;
    const elapsed = s.elapsedMs + projection;
    $('session-status').textContent = labels[s.status]; $('status-dot').className = `dot ${s.status}`;
    $('live-goal').textContent = s.goal; $('timer').textContent = format(elapsed);
    $('progress').style.width = `${Math.min(100, elapsed / (s.plannedMinutes * 60000) * 100)}%`;
    $('plan-left').textContent = `예정 ${s.plannedMinutes}분 · ${elapsed >= s.plannedMinutes*60000 ? '시간 도달' : format(s.plannedMinutes*60000-elapsed)+' 남음'}`;
    $('break-left').textContent = `휴식까지 ${format(state.settings.breakMinutes*60000-s.sinceBreakMs-projection)}`;
    $('pause').textContent = s.status === 'running' ? '일시정지' : '다시 시작';
    $('pause').disabled = busy || s.status === 'break' && now < s.breakUntil;
    $('rest').hidden = s.status !== 'running';
    $('break-notice').hidden = s.status !== 'break';
    $('break-notice').textContent = now < s.breakUntil ? `5분 쉬는 중 · ${format(s.breakUntil-now)} 후 재개할 수 있어요.` : '휴식이 끝났어요. 준비되면 다시 시작해 주세요.';
    $('plan-notice').hidden = elapsed < s.plannedMinutes*60000;
    $('extend-row').hidden = elapsed < s.plannedMinutes*60000;
    const a = state.active, category = a?.category || 'unsupported';
    $('current-host').textContent = a?.host || '일반 웹사이트 탭을 선택해 주세요';
    const texts = { allowed: '허용', blocked: '방해', unknown: '미분류', unsupported: '측정 제외' };
    $('category').textContent = a && state.exceptions[a.tabId] === a.host ? '이번만 허용' : texts[category];
    $('category').className = `badge ${category}`;
    $('ai-reason').textContent = a ? `${{ai:'AI 추정',rule:'규칙 기반',fallback:'규칙 기반 대체',pending:'AI 판단 중'}[a.source]||'규칙 기반'} · ${a.reason||''}` : '';
    $('classify-actions').hidden = category !== 'unknown';
    $('blocked-actions').hidden = category !== 'blocked' || s.status !== 'running';
  }
  const today = localDay(now), stats = state.days[today] || {};
  $('today-label').textContent = `${new Date(now).getMonth()+1}.${new Date(now).getDate()}`;
  $('stat-time').textContent = `${Math.floor((stats.elapsedMs || 0)/60000)}분`;
  for (const key of ['sessions','detections','returns','breaks']) $(`stat-${key}`).textContent = stats[key] || 0;
  const days = Array.from({ length: 7 }, (_, i) => { const d = new Date(now); d.setDate(d.getDate()-6+i); return { date:d, ms:state.days[localDay(d)]?.elapsedMs || 0 }; });
  const max = Math.max(60000, ...days.map(d=>d.ms));
  $('weekly').replaceChildren(...days.map((d,i) => {
    const col = document.createElement('div'); col.className = `bar-col ${i===6 ? 'today' : ''}`;
    const val = document.createElement('small'); val.textContent = `${Math.floor(d.ms/60000)}분`;
    const bar = document.createElement('div'); bar.className = 'bar'; bar.style.height = `${Math.max(3, d.ms/max*60)}px`;
    const label = document.createElement('span'); label.textContent = i===6 ? '오늘' : `${d.date.getMonth()+1}/${d.date.getDate()}`;
    col.append(val,bar,label); return col;
  }));
  $('system-notice').hidden = !state.status; $('system-notice').textContent = state.status;
}
async function request(type, extra = {}, silent = false) {
  if (!globalThis.chrome?.runtime?.id) { feedback('Chrome 확장프로그램으로 설치한 뒤 사용해 주세요.', true); return; }
  if (busy) return;
  busy = true;
  try {
    const result = await chrome.runtime.sendMessage({ type, ...extra });
    if (!result?.ok) throw new Error(result?.error || '연결을 확인해 주세요.');
    state = result.state;
    if (!formDirty || type === 'START' || type === 'SAVE' || type === 'REGISTER') { fillForm(); formDirty = false; }
    if (!silent && type !== 'GET') feedback({ START:'나의 목적을 시작했어요.', SAVE:'설정을 저장했어요.', END:'수고했어요. 오늘의 기록을 확인해 보세요.', PAUSE:'잠시 멈췄어요.', RESUME:'다시 이어가 볼까요?', BREAK:'5분 동안 눈과 몸을 쉬게 해 주세요.', REGISTER:'사이트를 등록했어요.', EXTEND:'10분 연장했어요.', ALLOW_ONCE:'이 탭의 현재 사이트를 이번 세션에서 허용했어요.', RETURN:'목표 사이트로 돌아갑니다.' }[type] || '반영했어요.');
  } catch(e) { if (!silent) feedback(e.message, true); }
  finally { busy = false; $('submit').disabled = !state; render(); }
}
$('settings-form').addEventListener('input', () => { formDirty = true; });
$('settings-form').addEventListener('submit', e => { e.preventDefault(); request(state?.session && state.session.status !== 'ended' ? 'SAVE' : 'START', { settings: readForm() }); });
$('pause').onclick = () => request(state.session.status === 'running' ? 'PAUSE' : 'RESUME');
for (const [id,type] of [['end','END'],['rest','BREAK'],['extend','EXTEND'],['return','RETURN'],['allow-once','ALLOW_ONCE']]) $(id).onclick = () => request(type);
document.querySelectorAll('[data-list]').forEach(button => { button.onclick = () => request('REGISTER', { list: button.dataset.list }); });
$('install-help').onclick = () => { $('help').hidden = !$('help').hidden; };
$('ai-enabled').onchange=()=>{formDirty=true;};
$('connect-ai').onclick=async()=>{await request('CONNECT',{token:$('connection-token').value});$('connection-token').value='';};
$('toggle-settings').onclick = () => {
  const expanded = document.body.classList.toggle('show-settings');
  $('toggle-settings').textContent = expanded ? '설정 접기' : '사이트·휴식 설정 수정';
};
if (globalThis.chrome?.runtime?.id) {
  request('GET');
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.state?.newValue) { state = changes.state.newValue; if (!formDirty) fillForm(); render(); }
  });
  setInterval(render, 1000);
  // Poll only while UI is visible; worker owns persistent timing.
  setInterval(() => { if (!document.hidden && !busy) request('GET', {}, true); }, 5000);
} else {
  $('submit').disabled = true;
  feedback('이 화면은 Chrome 확장프로그램 전용입니다. extension 폴더를 로드해 주세요.', true);
}

