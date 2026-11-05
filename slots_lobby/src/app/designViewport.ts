/** One design coordinate system for lobby pages, fixed controls and portal overlays. */
export const DESIGN_WIDTH = 420;
export function viewportMetrics(width:number,height:number) {
 const scale=Math.min(1,Math.max(1,width)/DESIGN_WIDTH);
 return {scale,height:Math.max(1,height)/scale};
}
export function overlayContainer():HTMLElement {return document.getElementById('lobby-overlays')??document.body;}
export function installDesignViewport() {
 const update=()=>{
  const {scale,height}=viewportMetrics(document.documentElement.clientWidth,window.visualViewport?.height??window.innerHeight);
  const style=document.documentElement.style;
  style.setProperty('--lobby-scale',String(scale));
  style.setProperty('--lobby-inverse-scale',String(1/scale));
  style.setProperty('--lobby-height',`${height}px`);
 };
 update();window.addEventListener('resize',update);window.visualViewport?.addEventListener('resize',update);
 return ()=>{window.removeEventListener('resize',update);window.visualViewport?.removeEventListener('resize',update);};
}
