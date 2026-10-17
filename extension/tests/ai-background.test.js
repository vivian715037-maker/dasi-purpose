import{test}from'node:test';import assert from'node:assert/strict';
import{DEFAULT_SETTINGS}from'../core.js';
test('비동기 AI: 미분류→AI 경고, 실패→규칙, 탭 이동 후 오래된 응답 폐기',async()=>{
 const callbacks={},db={},overlays=[];let tab={id:1,url:'https://video.example/watch?q=private',title:'게임 영상',active:true};let resolveAI;
 const event=n=>({addListener:f=>callbacks[n]=f});const originalFetch=globalThis.fetch;
 globalThis.chrome={runtime:{getURL:p=>'chrome-extension://test/'+p,onMessage:event('message'),onInstalled:event('install'),onStartup:event('startup')},storage:{local:{get:async key=>({[key]:structuredClone(db[key])}),set:async o=>Object.assign(db,structuredClone(o))}},alarms:{get:async()=>({}),create:async()=>{},onAlarm:event('alarm')},windows:{getLastFocused:async()=>({id:1,type:'normal',focused:true}),onFocusChanged:event('focus')},tabs:{query:async()=>[tab],sendMessage:async(_id,m)=>overlays.push(m),onActivated:event('activate'),onUpdated:event('update'),onCreated:event('created'),onRemoved:event('removed')},notifications:{create:async()=>{}},scripting:{executeScript:async()=>{}}};
 db.connection={token:'demo-connection-token'};
 globalThis.fetch=async(_url,opts)=>{assert.equal(JSON.parse(opts.body).url,'https://video.example/');return new Promise(resolve=>{resolveAI=resolve;});};
 try{
  await import('../background.js?ai-test');
  const sender={url:'chrome-extension://test/dashboard.html'};
  const send=(type,extra={})=>new Promise(resolve=>callbacks.message({type,...extra},sender,resolve));
  const flush=async()=>{for(let i=0;i<10;i++)await new Promise(r=>setImmediate(r));};
  const started=await send('START',{settings:{...DEFAULT_SETTINGS,goal:'수학 공부'}});assert.equal(started.ok,true);assert.equal(db.state.active.source,'pending');
  resolveAI(Response.json({source:'ai',related:'unrelated',confidence:.95,reason:'게임 영상'}));await flush();
  assert.equal(db.state.active.category,'blocked');assert.equal(db.state.active.source,'ai');assert.equal(overlays.at(-1).source,'ai');
  tab={...tab,url:'https://video.example/other',title:'다른 영상'};await send('GET');
  const stale=resolveAI;
  tab={...tab,url:'https://wikipedia.org',title:'수학'};await send('GET');
  stale(Response.json({source:'ai',related:'unrelated',confidence:.99,reason:'이전 페이지'}));await flush();
  assert.equal(db.state.active.host,'wikipedia.org');assert.equal(db.state.active.category,'allowed');
  globalThis.fetch=async()=>new Response('',{status:503});tab={...tab,url:'https://unknown.example',title:'미분류'};await send('GET');await flush();
  assert.equal(db.state.active.source,'fallback');assert.equal(db.state.active.category,'unknown');
  tab={...tab,url:'https://youtube.com',title:'방해 목록'};await send('GET');await flush();assert.equal(db.state.active.category,'blocked');assert.equal(db.state.active.source,'fallback');
  await send('END');
  globalThis.fetch=async(_url,opts)=>Response.json({source:'ai',related:JSON.parse(opts.body).title.includes('수학')?'related':'unrelated',confidence:.95,reason:'영상별 판단'});
  tab={...tab,url:'https://www.youtube.com/watch?v=mathA',title:'수학 강의'};
  await send('START',{settings:{...DEFAULT_SETTINGS,goal:'수학 공부',allowed:['youtube.com'],blocked:[]}});await flush();
  assert.equal(db.state.active.category,'allowed');assert.equal(db.state.active.source,'ai','YouTube 허용 목록도 AI를 건너뛰면 안 됨');
  tab={...tab,url:'https://www.youtube.com/watch?v=gameA',title:'게임 영상 A'};await send('GET');await flush();
  assert.equal(db.state.active.category,'blocked');assert.equal(db.state.active.source,'ai');
  await send('ALLOW_ONCE');assert.equal(db.state.active.allowOnce,true);
  const shown=overlays.filter(m=>m.type==='WB_SHOW').length;
  tab={...tab,url:'https://www.youtube.com/watch?v=gameB',title:'게임 영상 B'};await send('GET');await flush();
  assert.equal(db.state.active.allowOnce,false,'다른 영상에 허용이 이어지면 안 됨');
  assert.equal(overlays.filter(m=>m.type==='WB_SHOW').length,shown+1,'다른 영상은 2분 도메인 쿨다운과 무관하게 경고');
 }finally{globalThis.fetch=originalFetch;delete globalThis.chrome;}
});
