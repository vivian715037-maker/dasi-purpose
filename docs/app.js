import { SERVER_URL } from './config.js';
import { validateSettings, classify, hostFromUrl, localDay } from './core.js';
import { judgeSite, aiCategory } from './ai.js';
const $=id=>document.getElementById(id);
const pending=new Map();let seq=0, connected=false,state=null,busy=false;
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
  $('extension-status').textContent=connected?'Chrome 확장 연결됨 · 다른 탭 감지 가능':'확장 미연결 · 아래 AI 체험은 연결코드로 이용 가능';
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
async function command(type,extra={}){try{const r=await bridge({type,...extra},5000);state=r.state;render();feedback('반영했어요. 다른 사이트 탭을 방문해 보세요.');}catch(e){feedback(e.message,true);}}
$('session-form').onsubmit=event=>{event.preventDefault();try{command('START',{settings:formSettings()});}catch(e){feedback(e.message,true);}};
$('pause').onclick=()=>command(state.session.status==='running'?'PAUSE':'RESUME');
for(const [id,type]of[['end','END'],['rest','BREAK'],['extend','EXTEND']])$(id).onclick=()=>command(type);
$('reconnect').onclick=()=>refresh(true);
$('connect-ai').onclick=async()=>{
  const token=$('connection-code').value.trim();if(token.length<16||token.length>200){feedback('시연 연결코드를 확인해 주세요.',true);return;}
  sessionStorage.setItem('dasi-code',token);$('connection-code').value='';
  if(connected)await command('CONNECT',{token});else feedback('이 탭에 연결코드를 저장했어요. AI 판단을 체험해 보세요.');
};
function showResult(result){
  const category=result.source==='ai'?aiCategory(result):result.category;
  $('result').hidden=false;$('result').classList.toggle('unrelated',category==='blocked');
  $('result-source').textContent=result.source==='ai'?'LIVE AI · 실제 AI 응답':'RULE FALLBACK · 규칙 기반';
  $('result-label').textContent={allowed:'목적과 관련 있어요',blocked:'처음의 목적을 기억해 볼까요?',unknown:'아직 확실하지 않아요'}[category];
  $('result-reason').textContent=result.reason;
  $('result-confidence').textContent=result.source==='ai'?`모델: ${result.model} · 모델 신뢰도 ${Math.round(result.confidence*100)}% (검증된 확률 아님)`:'미등록 사이트를 임의로 방해 사이트로 단정하지 않습니다.';
}
function fallback(reason){const settings=formSettings();return{source:'fallback',category:classify(hostFromUrl($('test-url').value),settings),reason};}
$('judge').onclick=async()=>{
  if(busy)return;
  if(!$('preview-consent').checked){feedback('AI 전송에 동의하려면 체크해 주세요. 규칙 기반 체험은 그대로 이용할 수 있어요.',true);return;}
  busy=true;$('judge').disabled=true;$('judge').textContent='AI 판단 중…';
  try{
    const goal=state?.session&&state.session.status!=='ended'?state.session.goal:$('goal').value.trim();
    if(!goal)throw new Error('사용 목적을 입력해 주세요.');
    const url=$('test-url').value,title=$('test-title').value;
    let result;
    if(connected)result=(await bridge({type:'PREVIEW',goal,url,title},18000)).result;
    else{const token=sessionStorage.getItem('dasi-code');if(!token)throw new Error('시연 연결코드를 먼저 저장해 주세요.');result=await judgeSite(SERVER_URL,token,goal,url,title);}
    showResult(result);
  }catch(e){try{showResult(fallback(`${e.message} · 기존 사이트 규칙으로 판단했습니다.`));}catch(validation){feedback(validation.message,true);}}
  finally{busy=false;$('judge').disabled=false;$('judge').textContent='AI 관련성 판단하기';}
};
$('fallback-demo').onclick=()=>{try{showResult(fallback('연결 실패 상황을 체험 중입니다. AI 응답을 사용하지 않고 기존 사이트 규칙으로 판단합니다.'));}catch(e){feedback(e.message,true);}};
$('sample-study').onclick=()=>{$('test-url').value='https://www.youtube.com/';$('test-title').value='중학교 수학 일차방정식 개념 강의';};
$('sample-game').onclick=()=>{$('test-url').value='https://www.youtube.com/';$('test-title').value='리그오브레전드 게임 하이라이트 웃긴 영상 모음';};
refresh();setInterval(()=>{if(!document.hidden)refresh();},5000);window.addEventListener('focus',()=>refresh());
