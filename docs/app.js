import { SERVER_URL } from './config.js';
import { validateSettings, localDay } from './core.js';
import { verifyConnection } from './ai.js?v=auth2';
const $=id=>document.getElementById(id);
const pending=new Map();let seq=0, connected=false,state=null;
window.addEventListener('message',event=>{
  if(event.source!==window||event.origin!==location.origin||event.data?.channel!=='DASI_EXTENSION')return;
  const handler=pending.get(event.data.id);if(handler){pending.delete(event.data.id);handler(event.data);}
});
function bridge(request,timeout=2200){return new Promise((resolve,reject)=>{
  const id=++seq;const timer=setTimeout(()=>{pending.delete(id);reject(new Error('확장프로그램을 설치·새로고침한 후 다시 연결해 주세요.'));},timeout);
  pending.set(id,result=>{clearTimeout(timer);result.ok?resolve(result):reject(new Error(result.error||'확장 연결 오류'));});
  window.postMessage({channel:'DASI_WEB',id,request},location.origin);
});}
function feedback(text,error=false){$('feedback').hidden=false;$('feedback').textContent=text;$('feedback').classList.toggle('error',error);}
function formSettings(){return validateSettings({goal:$('goal').value,plannedMinutes:$('planned').value,breakMinutes:$('interval').value,allowed:$('allowed').value,blocked:$('blocked').value,aiEnabled:$('ai-enabled').checked,notifications:true});}
function format(ms){return `${String(Math.floor(ms/60000)).padStart(2,'0')}:${String(Math.floor(ms/1000)%60).padStart(2,'0')}`;}
function render(){
  $('extension-status').textContent=connected?'Chrome 확장 연결됨 · 다른 탭 감지 가능':'확장 미연결 · 확장프로그램 설치 후 다시 연결해 주세요';
  $('extension-dot').className=`dot ${connected?'running':''}`;
  $('start').disabled=!connected;
  if(!state)return;
  const s=state.session,active=s&&s.status!=='ended';
  $('session-form').hidden=!!active;$('live-session').hidden=!active;
  if(active){$('live-goal').textContent=s.goal;$('live-status').textContent={running:'나의 목적을 이어가는 중',paused:'잠시 멈췄어요',break:'5분 동안 쉬어 가세요'}[s.status];$('timer').textContent=format(s.elapsedMs);$('pause').textContent=s.status==='running'?'일시정지':'다시 시작';$('pause').disabled=s.status==='break'&&Date.now()<s.breakUntil;$('rest').hidden=s.status!=='running';$('rest-status').textContent=s.status==='break'?`휴식 종료 ${new Date(s.breakUntil).toLocaleTimeString('ko-KR')}`:'';}
  const stats=state.days[localDay(Date.now())]||{};$('stat-time').textContent=`${Math.floor((stats.elapsedMs||0)/60000)}분`;
  for(const key of ['sessions','detections','returns','breaks'])$(`stat-${key}`).textContent=stats[key]||0;
  const d=state.lastDecision;if(d){$('decision-host').textContent=d.host;$('decision-reason').textContent=`${{ai:'AI 추정',rule:'규칙 기반',fallback:'AI 실패 → 규칙 기반'}[d.source]||d.source} · ${{allowed:'관련/허용',blocked:'관련 없음/방해',unknown:'미분류'}[d.category]} · ${d.reason}`;}
  if(state.aiConnected)$('code-status').textContent='확장프로그램에 연결코드가 저장되어 있습니다. API 키는 서버에만 있습니다.';
}
async function refresh(showError=false){try{const r=await bridge({type:'GET'});state=r.state;connected=true;}catch(e){connected=false;if(showError)feedback(e.message,true);}render();}
async function command(type,extra={}){try{const r=await bridge({type,...extra},type==='CONNECT'?12000:5000);state=r.state;render();feedback('반영했어요. 다른 사이트 탭을 방문해 보세요.');return true;}catch(e){feedback(e.message,true);return false;}}
$('session-form').onsubmit=event=>{event.preventDefault();try{command('START',{settings:formSettings()});}catch(e){feedback(e.message,true);}};
$('pause').onclick=()=>command(state.session.status==='running'?'PAUSE':'RESUME');
for(const [id,type]of[['end','END'],['rest','BREAK'],['extend','EXTEND']])$(id).onclick=()=>command(type);
$('reconnect').onclick=()=>refresh(true);
$('connect-ai').onclick=async()=>{
  const token=$('connection-code').value.trim();$('connect-ai').disabled=true;$('connect-ai').textContent='서버 인증 확인 중…';
  try{
    await verifyConnection(SERVER_URL,token);
    if(connected&&!await command('CONNECT',{token}))return;
    sessionStorage.setItem('dasi-code',token);$('connection-code').value='';
    $('code-status').textContent='서버 인증 확인 완료 · AI를 사용할 수 있어요.';
    feedback('AI 연결을 확인했어요. 목적을 시작하고 다른 사이트 탭을 방문해 보세요.');
  }catch(e){feedback(e.message,true);$('code-status').textContent='연결 실패 · 코드를 저장하지 않았습니다. API 키가 아닌 시연 연결코드를 입력하세요.';}
  finally{$('connect-ai').disabled=false;$('connect-ai').textContent='연결코드 저장';}
};
refresh();setInterval(()=>{if(!document.hidden)refresh();},5000);window.addEventListener('focus',()=>refresh());
