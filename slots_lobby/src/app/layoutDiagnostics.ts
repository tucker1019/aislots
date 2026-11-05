/** Explicit opt-in diagnostics for device-only clipping; never include account contents. */
export function installLayoutDiagnostics() {
 if(new URLSearchParams(location.search).get('layoutDebug')!=='1')return;
 const panel=document.createElement('pre');
 panel.setAttribute('aria-label','Layout diagnostics');
 Object.assign(panel.style,{position:'fixed',left:'4px',right:'4px',bottom:'76px',zIndex:'2147483647',margin:'0',padding:'10px',background:'#fff',color:'#1d1d1f',border:'1px solid #0066cc',borderRadius:'8px',font:'11px/1.5 monospace',whiteSpace:'pre-wrap',pointerEvents:'none'});
 document.body.appendChild(panel);
 const selectors=['#lobby-viewport','#root','main','.my-account','.account-identity','.account-balance-card','.bottom-navigation'];
 const update=()=>{
  const lines=[`layout v1 | window ${innerWidth} | html ${document.documentElement.clientWidth}`,`visual ${window.visualViewport?.width.toFixed(1)} | scale ${window.visualViewport?.scale} | design ${getComputedStyle(document.documentElement).getPropertyValue('--lobby-scale')}`];
  for(const selector of selectors){const element=document.querySelector<HTMLElement>(selector);if(!element)continue;const rect=element.getBoundingClientRect();lines.push(`${selector}: x${rect.left.toFixed(1)} w${rect.width.toFixed(1)} right${rect.right.toFixed(1)} scroll${element.scrollWidth}/${element.clientWidth}`);}
  panel.textContent=lines.join('\n');
 };
 let scheduled=false;
 const observer=new MutationObserver(()=>{if(scheduled)return;scheduled=true;requestAnimationFrame(()=>{scheduled=false;update();});});
 const root=document.getElementById('root');if(root)observer.observe(root,{childList:true,subtree:true});
 window.addEventListener('resize',update);window.visualViewport?.addEventListener('resize',update);update();
}
