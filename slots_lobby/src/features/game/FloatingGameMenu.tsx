import { useRef, useState, type PointerEvent } from 'react';
import { t } from '../../i18n';

type Point = { x: number; y: number };
type Drag = { pointer: Point; origin: Point; moved: boolean; bounds: DOMRect };

export function FloatingGameMenu({open,onToggle,onExit,onShrink}:{
 open: boolean; onToggle: ()=>void; onExit: ()=>void; onShrink: ()=>void;
}) {
 const [position,setPosition]=useState<Point>();
 const drag=useRef<Drag>(null);
 const activePointer=useRef<number>(null);

 function startDrag(event: PointerEvent<HTMLButtonElement>) {
  if (!event.isPrimary || event.button !== 0) return;
  const button=event.currentTarget;
  const shell=button.closest('.game-detail-shell');
  if (!shell) return;
  const bounds=shell.getBoundingClientRect();
  const rect=button.getBoundingClientRect();
  drag.current={pointer:{x:event.clientX,y:event.clientY},
   origin:{x:rect.left-bounds.left,y:rect.top-bounds.top},moved:false,bounds};
  activePointer.current=event.pointerId;
  button.setPointerCapture?.(event.pointerId);
 }

 function moveDrag(event: PointerEvent<HTMLButtonElement>) {
  const gesture=drag.current;
  if (!gesture || activePointer.current !== event.pointerId) return;
  const dx=event.clientX-gesture.pointer.x, dy=event.clientY-gesture.pointer.y;
  if (!gesture.moved && Math.hypot(dx,dy)<6) return;
  gesture.moved=true;
  setPosition({
   x:Math.max(0,Math.min(gesture.origin.x+dx,gesture.bounds.width-54)),
   y:Math.max(0,Math.min(gesture.origin.y+dy,gesture.bounds.height-54)),
  });
 }

 function endDrag(event: PointerEvent<HTMLButtonElement>) {
  if (activePointer.current === event.pointerId) activePointer.current=null;
 }

 return <div className={`game-floating-controls${position && position.x < 114 ? ' game-floating-controls-right' : ''}`}
   style={position ? { left: `clamp(var(--game-menu-left), ${position.x}px, 100% - var(--game-menu-right) - 54px)`,
    top: `clamp(var(--game-menu-top), ${position.y}px, 100% - var(--game-menu-bottom) - 54px)`, right: 'auto' } : undefined}>
   {open&&<div className="game-floating-actions">
    <button type="button" aria-label={t('gamePreview.exit')} onClick={onExit}>
     <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M11 4H5v16h6m3-13 5 5-5 5m-5-5h10"/></svg>
    </button>
    <button type="button" aria-label={t('gamePreview.shrink')} onClick={onShrink}>
     <svg aria-hidden="true" viewBox="0 0 24 24"><rect x="7" y="3" width="10" height="18" rx="2"/><path d="M10 7h4"/></svg>
    </button>
   </div>}
   <button className="game-floating-toggle" type="button" aria-expanded={open} aria-label={t(open?'gamePreview.closeMenu':'gamePreview.openMenu')} onPointerDown={startDrag} onPointerMove={moveDrag} onPointerUp={endDrag} onPointerCancel={endDrag}
    onLostPointerCapture={endDrag} onClick={event=>{if (event.detail === 0 || !drag.current?.moved) onToggle();}}>
    {open?<svg aria-hidden="true" viewBox="0 0 24 24"><path d="m6 6 12 12M18 6 6 18"/></svg>:<span aria-hidden="true"/>}
   </button>
  </div>;
}
