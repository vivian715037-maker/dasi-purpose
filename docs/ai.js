export function aiCategory(result) {
  if (!result || result.source!=='ai' || !['related','unrelated','uncertain'].includes(result.related) || !Number.isFinite(result.confidence) || result.confidence<0 || result.confidence>1 || typeof result.reason!=='string') throw new Error('AI 응답 형식 오류');
  if (result.confidence < .8 || result.related === 'uncertain') return 'unknown';
  return result.related === 'unrelated' ? 'blocked' : 'allowed';
}
export async function judgeSite(server, token, goal, url, title) {
  const u=new URL(url);
  const response=await fetch(`${server}/api/judge`,{method:'POST',headers:{'Content-Type':'application/json','X-Demo-Token':token},signal:AbortSignal.timeout(15000),body:JSON.stringify({goal,url:u.origin+'/',title:(title||'').slice(0,300)})});
  if (!response.ok) throw new Error(response.status===401 ? '시연 연결코드가 올바르지 않습니다. AI_연결코드.txt의 코드로 다시 연결해 주세요. API 키를 입력하면 안 됩니다. (401)' : `AI 연결 실패 (${response.status})`);
  const result=await response.json(); aiCategory(result); return result;
}
export async function verifyConnection(server, token) {
  if(typeof token!=='string'||token.trim().length<16||token.trim().length>200) throw new Error('AI_연결코드.txt의 시연 연결코드를 입력해 주세요.');
  if(token.trim().startsWith('sk-')) throw new Error('이 칸에는 API 키를 넣지 마세요. AI_연결코드.txt의 시연 연결코드를 입력해 주세요.');
  const response=await fetch(`${server}/api/connection`,{headers:{'X-Demo-Token':token.trim()},signal:AbortSignal.timeout(8000)});
  if(response.status===401) throw new Error('시연 연결코드가 맞지 않습니다. AI_연결코드.txt에서 코드 한 줄만 복사해 주세요. (401)');
  if(!response.ok) throw new Error(`연결 확인 실패 (${response.status}). 잠시 후 다시 시도해 주세요.`);
  const data=await response.json();
  if(data.ok!==true||data.configured!==true) throw new Error('서버 AI 설정을 확인해야 합니다.');
  return true;
}
