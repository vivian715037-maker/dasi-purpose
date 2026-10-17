(() => {
  const types=new Set(['GET','START','SAVE','PAUSE','RESUME','END','EXTEND','BREAK','CONNECT','PREVIEW']);
  window.addEventListener('message', async event => {
    if(event.source!==window || event.origin!==location.origin || event.data?.channel!=='DASI_WEB' || !types.has(event.data?.request?.type)) return;
    const id=event.data.id;
    try { const result=await chrome.runtime.sendMessage(event.data.request); window.postMessage({channel:'DASI_EXTENSION',id,...result},location.origin); }
    catch { window.postMessage({channel:'DASI_EXTENSION',id,ok:false,error:'확장프로그램을 새로고침하고 웹앱을 다시 열어 주세요.'},location.origin); }
  });
})();
