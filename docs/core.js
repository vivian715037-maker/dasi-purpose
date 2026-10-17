export const DEFAULT_SETTINGS = {
  goal: '', plannedMinutes: 30, breakMinutes: 30, notifications: true, aiEnabled: true,
  allowed: ['wikipedia.org'], blocked: ['youtube.com', 'instagram.com']
};
export const COOLDOWN = 120000;
export function isVideoSite(host) { return host === 'youtu.be' || host === 'youtube.com' || host.endsWith('.youtube.com'); }
export function pageScope(value) {
  const host=hostFromUrl(value);
  if(!isVideoSite(host))return host;
  const u=new URL(value);
  const id=host==='youtu.be'?u.pathname.split('/')[1]:u.searchParams.get('v')||(/^\/(shorts|live|embed)\/([^/]+)/.exec(u.pathname)?.[2]);
  return id ? `youtube:video:${id}` : `youtube:page:${u.pathname}`;
}
export function normalizeDomain(input) {
  const value = input.trim();
  if (!value) throw new Error('빈 사이트 주소는 등록할 수 없습니다.');
  let url;
  try { url = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(value) ? value : `https://${value}`); }
  catch { throw new Error(`사이트 주소를 확인해 주세요: ${value}`); }
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || url.port)
    throw new Error('HTTP/HTTPS 도메인만 입력해 주세요. 계정 정보나 포트는 사용할 수 없습니다.');
  const host = url.hostname.toLowerCase().replace(/^www\./, '').replace(/\.$/, '');
  if (host.length > 253 || !host.includes('.') || !host.split('.').every(p => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(p)))
    throw new Error(`올바른 도메인을 입력해 주세요: ${value}`);
  return host;
}
export function domainList(value) {
  const parts = Array.isArray(value) ? value : String(value).split(/[\s,;]+/);
  return [...new Set(parts.filter(x => x.trim()).map(normalizeDomain))];
}
export function matches(host, domain) { return host === domain || host.endsWith(`.${domain}`); }
export function classify(host, settings) {
  if (!host) return 'unsupported';
  if (settings.allowed.some(d => matches(host, d))) return 'allowed';
  if (settings.blocked.some(d => matches(host, d))) return 'blocked';
  return 'unknown';
}
export function hostFromUrl(value) {
  try { const u = new URL(value); return ['http:', 'https:'].includes(u.protocol) ? u.hostname.toLowerCase().replace(/\.$/, '') : ''; }
  catch { return ''; }
}
export function validateSettings(raw) {
  const settings = {
    goal: String(raw.goal || '').trim().slice(0, 120),
    plannedMinutes: Number(raw.plannedMinutes), breakMinutes: Number(raw.breakMinutes),
    notifications: raw.notifications !== false,
    aiEnabled: raw.aiEnabled !== false,
    allowed: domainList(raw.allowed || []), blocked: domainList(raw.blocked || [])
  };
  for (const n of [settings.plannedMinutes, settings.breakMinutes])
    if (!Number.isInteger(n) || n < 1 || n > 240) throw new Error('시간은 1~240분의 정수로 입력해 주세요.');
  if (settings.allowed.length + settings.blocked.length > 100) throw new Error('사이트는 합계 100개까지 등록할 수 있습니다.');
  if (settings.allowed.some(a => settings.blocked.some(b => matches(a, b) || matches(b, a))))
    throw new Error('허용·방해 목록에 같거나 서로 포함되는 도메인이 있습니다. 한쪽에서 지워 주세요.');
  return settings;
}
export function localDay(now) {
  const d = new Date(now);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
export function dayStats(state, now) {
  const key = localDay(now);
  return state.days[key] ||= { sessions: 0, elapsedMs: 0, detections: 0, returns: 0, breaks: 0 };
}
export function freshState() {
  return { version: 1, settings: structuredClone(DEFAULT_SETTINGS), session: null, days: {}, cooldowns: {}, exceptions: {}, trackingAt: null, status: '', active: null };
}
// Only a focused Chrome HTTP(S) tab qualifies. A long unobserved gap (sleep/exit)
// is excluded instead of claiming the computer was in use during that gap.
export function settle(state, now) {
  const s = state.session;
  if (s?.status === 'running' && state.trackingAt !== null) {
    const delta = now - state.trackingAt;
    if (delta > 0 && delta <= 90000) {
      s.elapsedMs += delta; s.sinceBreakMs += delta;
      let cursor = state.trackingAt;
      while (cursor < now) {
        const next = new Date(cursor); next.setHours(24, 0, 0, 0);
        const until = Math.min(now, next.getTime());
        dayStats(state, cursor).elapsedMs += until - cursor;
        cursor = until;
      }
    }
  }
  state.trackingAt = null;
}
