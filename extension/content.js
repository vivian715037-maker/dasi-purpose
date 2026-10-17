(() => {
  if (globalThis.__wellbeingInstalled) return;
  globalThis.__wellbeingInstalled = true;
  let root;
  const close = () => { root?.remove(); root = null; };
  chrome.runtime.onMessage.addListener(message => {
    if (message.type === 'WB_CLEAR') { close(); return; }
    if (message.type !== 'WB_SHOW') return;
    close();
    root = document.createElement('div');
    root.setAttribute('data-wellbeing-overlay', '');
    root.style.cssText = 'position:fixed!important;inset:0!important;z-index:2147483647!important;display:block!important;';
    const shadow = root.attachShadow({ mode: 'closed' });
    const style = document.createElement('style');
    style.textContent = `:host{all:initial}*{box-sizing:border-box}.shade{height:100%;display:grid;place-items:center;background:rgba(16,37,34,.50);font:16px/1.6 "Malgun Gothic",sans-serif;color:#193b34;padding:20px}.card{position:relative;background:#fbfaf4;max-width:460px;width:100%;padding:36px;border-radius:24px;box-shadow:0 24px 80px #10252244}.tag{font-size:12px;letter-spacing:2px;color:#56776e}h2{font-size:26px;line-height:1.4;margin:18px 0}p{color:#53665f;overflow-wrap:anywhere}.goal{font-size:19px;font-weight:700;color:#193b34}.buttons{display:grid;gap:10px;margin-top:24px}button{cursor:pointer;font:inherit;border:1px solid #cddbd2;border-radius:12px;padding:12px;background:transparent;color:#193b34}button:first-child{background:#205c4c;color:white;border-color:#205c4c}button:hover{filter:brightness(.94)}button:focus-visible{outline:3px solid #d19938;outline-offset:3px}.close{position:absolute;right:14px;top:10px;border:0;font-size:24px;padding:2px 9px}.small{font-size:12px;margin-bottom:0}`;
    const shade = document.createElement('div'); shade.className = 'shade';
    const card = document.createElement('section'); card.className = 'card';
    card.setAttribute('role', 'dialog'); card.setAttribute('aria-modal', 'true'); card.setAttribute('aria-label', '다시, 목적 안내');
    const closeButton = document.createElement('button'); closeButton.className = 'close'; closeButton.textContent = '×'; closeButton.setAttribute('aria-label', '경고 닫기');
    closeButton.onclick = close;
    const tag = document.createElement('div'); tag.className = 'tag'; tag.textContent = '다시, 목적 · 잠깐의 멈춤';
    const h = document.createElement('h2'); h.textContent = message.kind === 'break' ? '눈과 몸을 쉬게 하세요' : '처음의 목적을 기억하나요?';
    const p = document.createElement('p'); p.textContent = message.kind === 'break' ? '20초 동안 먼 곳을 보고 어깨를 가볍게 풀어 보세요.' : '원래 목표는 다음과 같습니다. 계속 이용하시겠어요?';
    const goal = document.createElement('p'); goal.className = 'goal'; goal.textContent = message.goal;
    const reason = document.createElement('p'); reason.className='small';reason.textContent=message.kind==='distraction' && message.source==='ai' ? `AI 추정 · ${message.reason} (제목·도메인 기준)` : '';
    const buttons = document.createElement('div'); buttons.className = 'buttons';
    const actions = message.kind === 'break' ? [['5분 쉬기', 'BREAK'], ['계속하기', 'DISMISS']] : [['목표로 돌아가기', 'RETURN'], ['5분 쉬기', 'BREAK'], ['이번만 허용', 'ALLOW_ONCE']];
    for (const [label, type] of actions) {
      const button = document.createElement('button'); button.textContent = label;
      button.onclick = async () => {
        button.disabled = true;
        try { const result = await chrome.runtime.sendMessage({ type }); if (!result?.ok) throw new Error(result?.error || '다시 시도해 주세요.'); close(); }
        catch (e) { p.textContent = e.message; button.disabled = false; }
      };
      buttons.append(button);
    }
    const small = document.createElement('p'); small.className = 'small'; small.textContent = '선택은 언제나 나에게 · Esc 키로도 닫을 수 있어요';
    card.append(closeButton, tag, h, p, goal, reason, buttons, small); shade.append(card); shadow.append(style, shade);
    shadow.addEventListener('keydown', event => {
      if (event.key === 'Escape') { event.preventDefault(); close(); }
      if (event.key === 'Tab') {
        const items = [...shadow.querySelectorAll('button:not(:disabled)')];
        const index = items.indexOf(shadow.activeElement);
        event.preventDefault(); items[(index + (event.shiftKey ? -1 : 1) + items.length) % items.length].focus();
      }
    });
    (document.documentElement || document.body).append(root);
    buttons.firstElementChild.focus();
  });
})();
