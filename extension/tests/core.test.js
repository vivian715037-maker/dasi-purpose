import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeDomain, domainList, classify, validateSettings, DEFAULT_SETTINGS, freshState, settle, localDay, pageScope } from '../core.js';

test('YouTube 영상별 예외 키: 영상·쇼츠·공유 링크, 재생시간은 같은 영상',()=>{
 assert.equal(pageScope('https://www.youtube.com/watch?v=math&t=30'),pageScope('https://youtu.be/math'));
 assert.equal(pageScope('https://www.youtube.com/shorts/game'),pageScope('https://youtube.com/watch?v=game'));
 assert.notEqual(pageScope('https://youtube.com/watch?v=math'),pageScope('https://youtube.com/watch?v=game'));
 assert.equal(pageScope('https://wikipedia.org/wiki/Math'),'wikipedia.org');
});

test('도메인 정규화: URL, 대소문자, www, 경로, 중복, 한글', () => {
  assert.equal(normalizeDomain('HTTPS://WWW.YouTube.com/watch?v=123'), 'youtube.com');
  assert.deepEqual(domainList('wikipedia.org, https://wikipedia.org/a\ndocs.python.org'), ['wikipedia.org','docs.python.org']);
  assert.match(normalizeDomain('한글.kr'), /^xn--/);
  for (const invalid of ['javascript:alert(1)', 'chrome://extensions', 'localhost', 'https://user:secret@example.com', 'https://example.com:8080', '*.example.com', '-bad.com'])
    assert.throws(() => normalizeDomain(invalid), invalid);
});
test('정확한 도메인과 하위 도메인만 판단하고 미등록은 미분류', () => {
  assert.equal(classify('ko.wikipedia.org', DEFAULT_SETTINGS), 'allowed');
  assert.equal(classify('m.youtube.com', DEFAULT_SETTINGS), 'blocked');
  assert.equal(classify('notyoutube.com', DEFAULT_SETTINGS), 'unknown');
  assert.equal(classify('youtube.com.evil.org', DEFAULT_SETTINGS), 'unknown');
  assert.equal(classify('', DEFAULT_SETTINGS), 'unsupported');
});
test('목록 충돌, 시간 범위, 소수 입력을 거절', () => {
  assert.throws(() => validateSettings({...DEFAULT_SETTINGS, allowed:'youtube.com',blocked:'m.youtube.com'}));
  assert.throws(() => validateSettings({...DEFAULT_SETTINGS, plannedMinutes:0}));
  assert.throws(() => validateSettings({...DEFAULT_SETTINGS, breakMinutes:1.5}));
  assert.equal(validateSettings({...DEFAULT_SETTINGS, breakMinutes:'1'}).breakMinutes, 1);
});
test('진행·포커스 시간만 집계하고 일시정지와 긴 공백 제외', () => {
  const state = freshState(), start = new Date(2026,9,17,10).getTime();
  state.session = {status:'running',elapsedMs:0,sinceBreakMs:0}; state.trackingAt=start;
  settle(state,start+30000); assert.equal(state.session.elapsedMs,30000);
  settle(state,start+60000); assert.equal(state.session.elapsedMs,30000);
  state.trackingAt=start+60000; state.session.status='paused'; settle(state,start+90000);
  assert.equal(state.session.elapsedMs,30000);
  state.session.status='running'; state.trackingAt=start; settle(state,start+3600000);
  assert.equal(state.session.elapsedMs,30000);
});
test('자정에 걸친 시간은 날짜별로 분할', () => {
  const state=freshState(), start=new Date(2026,9,17,23,59,45).getTime();
  state.session={status:'running',elapsedMs:0,sinceBreakMs:0}; state.trackingAt=start;
  settle(state,start+30000);
  assert.equal(state.days[localDay(start)].elapsedMs,15000);
  assert.equal(state.days[localDay(start+30000)].elapsedMs,15000);
});
