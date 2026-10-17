import {test} from 'node:test';import assert from 'node:assert/strict';
import {aiCategory,judgeSite,verifyConnection} from '../ai.js';
test('AI 결과는 0.8 이상일 때만 경고하며 불확실·형식 오류 구분',()=>{
 assert.equal(aiCategory({source:'ai',related:'unrelated',confidence:.9,reason:'게임 영상'}),'blocked');
 assert.equal(aiCategory({source:'ai',related:'unrelated',confidence:.7,reason:'불확실'}),'unknown');
 assert.equal(aiCategory({source:'ai',related:'uncertain',confidence:.95,reason:'정보 부족'}),'unknown');
 assert.equal(aiCategory({source:'ai',related:'related',confidence:.95,reason:'강의'}),'allowed');
 assert.throws(()=>aiCategory({source:'ai',related:'unrelated',confidence:2,reason:'오류'}));
});
test('연결코드 저장 전 인증: API 키 입력·잘못된 코드 거절, 정상 코드 확인',async()=>{
 const original=globalThis.fetch;
 try{
  let calls=0;globalThis.fetch=async()=>{calls++;return new Response('',{status:401});};
  await assert.rejects(verifyConnection('https://server.test','sk-or-v1-not-a-connection-code'),/API 키/);assert.equal(calls,0);
  await assert.rejects(verifyConnection('https://server.test','wrong-connection-code'),/401/);
  globalThis.fetch=async()=>Response.json({ok:true,configured:true});
  assert.equal(await verifyConnection('https://server.test','correct-connection-code'),true);
 }finally{globalThis.fetch=original;}
});
test('서버로 URL 경로·검색어를 보내지 않음; 실패는 명시적으로 반환',async()=>{
 const realFetch=globalThis.fetch;
 try{
  globalThis.fetch=async(url,options)=>{const body=JSON.parse(options.body);assert.equal(body.url,'https://youtube.com/');assert.ok(!options.body.includes('private-query'));return Response.json({source:'ai',related:'related',confidence:.9,reason:'강의'});};
  await judgeSite('https://server.test','access-code','수학 공부','https://youtube.com/watch?v=private-query','수학 강의');
  globalThis.fetch=async()=>new Response('',{status:503});
  await assert.rejects(judgeSite('https://server.test','access-code','수학','https://youtube.com/','게임'));
 }finally{globalThis.fetch=realFetch;}
});
