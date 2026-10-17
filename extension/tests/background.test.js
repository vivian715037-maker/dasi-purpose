import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_SETTINGS, localDay } from '../core.js';

test('실제 service worker: 세션→경고→예외→복귀→휴식→재시작 및 오류 복구', async () => {
  const callbacks = {}, notifications=[], overlays=[];
  let stored, focused=true, url='https://wikipedia.org/', failInjection=false, failNotification=false;
  let now=new Date(2026,9,17,12).getTime();
  const realNow=Date.now; Date.now=()=>now;
  const event=name=>({addListener: fn=>{callbacks[name]=fn;}});
  globalThis.chrome={
    runtime:{ getURL:p=>`chrome-extension://test/${p}`, onMessage:event('message'),onInstalled:event('installed'),onStartup:event('startup') },
    storage:{local:{ get:async()=>({state:structuredClone(stored)}),set:async obj=>{stored=structuredClone(obj.state);} }},
    alarms:{ get:async()=>null,create:async()=>{},onAlarm:event('alarm') },
    windows:{getLastFocused:async()=>({id:1,type:'normal',focused}),onFocusChanged:event('focus')},
    tabs:{ query:async()=>[{id:1,url,active:true}], update:async(_id,props)=>{url=props.url;},create:async props=>{url=props.url;},sendMessage:async(_id,msg)=>{overlays.push(msg);},onActivated:event('activated'),onUpdated:event('updated'),onCreated:event('created'),onRemoved:event('removed') },
    notifications:{create:async(id,props)=>{if(failNotification)throw Error('denied');notifications.push({id,...props});}},
    scripting:{executeScript:async()=>{if(failInjection)throw Error('protected');}}
  };
  try {
    await import('../background.js?test');
    // Extension dashboard tabs have sender.tab too; they are trusted UI, not content scripts.
    const sender={url:'chrome-extension://test/dashboard.html', tab:{id:99,url:'chrome-extension://test/dashboard.html'}};
    const request=(type,extra={},from=sender)=>new Promise(resolve=>callbacks.message({type,...extra},from,resolve));
    const ok=async(type,extra,from)=>{const result=await request(type,extra,from);assert.equal(result.ok,true,result.error);return result.state;};
    const today=()=>stored.days[localDay(now)];
    await ok('START',{settings:{...DEFAULT_SETTINGS,goal:'수학 공부',breakMinutes:1}});
    assert.equal(today().sessions,1); assert.equal(notifications.length,0);
    assert.equal((await request('START',{settings:DEFAULT_SETTINGS})).ok,false);
    now+=10000;url='https://www.youtube.com/watch?v=secret';await ok('GET');
    assert.equal(today().detections,1);assert.equal(overlays.at(-1).type,'WB_SHOW');
    await ok('GET');assert.equal(today().detections,1);
    await ok('ALLOW_ONCE',{}, {tab:{id:1,url},url});
    now+=125000;await ok('GET');assert.equal(today().detections,1);
    url='https://wikipedia.org';await ok('GET');url='https://www.youtube.com';await ok('GET');
    assert.equal(today().detections,2);
    await ok('RETURN',{}, {tab:{id:1,url},url});
    assert.equal(url,'https://wikipedia.org/');assert.equal(today().returns,1);
    url='https://newsite.org';await ok('GET');assert.equal(stored.active.category,'unknown');
    await ok('REGISTER',{list:'allowed'});assert.ok(stored.settings.allowed.includes('newsite.org'));
    const before=stored.session.elapsedMs;
    focused=false; await ok('GET');now+=30000;await ok('GET');assert.equal(stored.session.elapsedMs,before);
    focused=true;await ok('GET');now+=30000;await ok('GET');now+=30000;await ok('GET');
    assert.equal(today().breaks,1); assert.equal(overlays.at(-1).kind,'break');
    await ok('BREAK'); const breakTime=stored.session.elapsedMs;
    assert.equal((await request('RESUME')).ok,false);now+=300000;await ok('GET');
    assert.equal(stored.session.elapsedMs,breakTime);await ok('RESUME');
    now+=10000;await ok('PAUSE');const pausedTime=stored.session.elapsedMs;now+=30000;await ok('GET');assert.equal(stored.session.elapsedMs,pausedTime);
    await ok('RESUME');
    failInjection=true;failNotification=true;url='https://instagram.com';await ok('GET');
    assert.equal(today().detections,3);assert.ok(stored.status);
    url='chrome://extensions';await ok('GET');assert.equal(stored.active.category,'unsupported');
    callbacks.startup();await ok('GET');assert.equal(stored.session.status,'paused');
    assert.equal(stored.trackingAt,null);
    await ok('END'); assert.equal(stored.session.status,'ended'); assert.equal(today().sessions,1);
    assert.ok(!JSON.stringify(stored).includes('watch?v=secret'));
    assert.equal((await request('START',{}, {tab:{id:1,url},url})).ok,false);
  } finally { Date.now=realNow; delete globalThis.chrome; }
});
