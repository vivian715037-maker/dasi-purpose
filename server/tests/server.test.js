import {test} from 'node:test';import assert from 'node:assert/strict';import worker from '../worker/index.js';
const env={WEB_ORIGIN:'https://app.example',OPENROUTER_API_KEY:'server-only-secret',DEMO_ACCESS_TOKEN:'demo-code'};
const request=(body,token='demo-code',origin=env.WEB_ORIGIN)=>new Request('https://worker.example/api/judge',{method:'POST',headers:{'Content-Type':'application/json','Origin':origin,'X-Demo-Token':token},body:JSON.stringify(body)});
test('서버: 인증·CORS·입력 검증 및 provider 오류 503',async()=>{
 assert.equal((await worker.fetch(new Request('https://worker.example/api/connection',{headers:{'X-Demo-Token':'wrong'}}),env)).status,401);
 const verified=await worker.fetch(new Request('https://worker.example/api/connection',{headers:{'X-Demo-Token':'demo-code'}}),env);
 assert.equal(verified.status,200);assert.equal((await verified.json()).configured,true);
 const body={goal:'수학',url:'https://youtube.com/',title:'강의'};
 assert.equal((await worker.fetch(request(body,'wrong'),env)).status,401);
 assert.equal((await worker.fetch(request(body,'demo-code','https://evil.example'),env)).status,403);
 assert.equal((await worker.fetch(request({...body,goal:''}),env)).status,400);
 const original=globalThis.fetch;
 try{
  globalThis.fetch=async()=>new Response('',{status:500});
  const failed=await worker.fetch(request(body),env);assert.equal(failed.status,503);assert.ok(!(await failed.text()).includes(env.OPENROUTER_API_KEY));
  globalThis.fetch=async(_url,opts)=>{const payload=JSON.parse(opts.body);assert.ok(!JSON.stringify(payload).includes('secret-search'));return Response.json({choices:[{message:{content:JSON.stringify({related:'related',confidence:.9,reason:'수학 강의'})}}]});};
  const ok=await worker.fetch(request({...body,url:'https://youtube.com/watch?q=secret-search'}),env);assert.equal(ok.status,200);assert.equal((await ok.json()).source,'ai');
 }finally{globalThis.fetch=original;}
});
