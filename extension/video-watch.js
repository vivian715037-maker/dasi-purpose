(() => {
  let last='', timer;
  async function check(force=false) {
    if(document.visibilityState==='hidden')return;
    const signature=location.href+'\n'+document.title;
    if(!force&&signature===last)return;
    last=signature;
    try {await chrome.runtime.sendMessage({type:'PAGE_CHANGED'});} catch { /* Reload page after extension updates. */ }
  }
  const changed=()=>{clearTimeout(timer);timer=setTimeout(()=>check(),500);};
  document.addEventListener('yt-navigate-finish',changed);
  document.addEventListener('yt-page-data-updated',changed);
  document.addEventListener('visibilitychange',()=>check(true));
  const observer=new MutationObserver(changed);
  function observe(){if(document.head)observer.observe(document.head,{subtree:true,childList:true,characterData:true});changed();}
  if(document.head)observe();else document.addEventListener('DOMContentLoaded',observe,{once:true});
  setInterval(()=>check(),1500);
})();
