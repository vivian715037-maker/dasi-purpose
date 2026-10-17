export function aiCategory(result) {
  if (!result || result.source!=='ai' || !['related','unrelated','uncertain'].includes(result.related) || !Number.isFinite(result.confidence) || result.confidence<0 || result.confidence>1 || typeof result.reason!=='string') throw new Error('AI 응답 형식 오류');
  if (result.confidence < .8 || result.related === 'uncertain') return 'unknown';
  return result.related === 'unrelated' ? 'blocked' : 'allowed';
}
export async function judgeSite(server, token, goal, url, title) {
  const u=new URL(url);
  const response=await fetch(`${server}/api/judge`,{method:'POST',headers:{'Content-Type':'application/json','X-Demo-Token':token},signal:AbortSignal.timeout(15000),body:JSON.stringify({goal,url:u.origin+'/',title:(title||'').slice(0,300)})});
  if (!response.ok) throw new Error(`AI 연결 실패 (${response.status})`);
  const result=await response.json(); aiCategory(result); return result;
}
