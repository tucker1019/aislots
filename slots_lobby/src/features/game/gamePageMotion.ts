/** DOM rects are physical pixels; translate in the page's local design coordinates. */
export function gamePageFrames(shell: HTMLElement, target: DOMRectReadOnly | null, shrinking: boolean): Keyframe[] {
  const full = 'translateX(-50%) translate(0, 0) scale(1, 1)';
  const bounds = shell.getBoundingClientRect();
  let compact = full;
  if (target?.width && target.height && bounds.width && bounds.height) {
    const zoom = bounds.width / shell.offsetWidth || 1;
    const scale = Math.min(target.width / bounds.width, target.height / bounds.height);
    const x = target.left + (target.width - bounds.width * scale) / 2;
    const y = target.top + (target.height - bounds.height * scale) / 2;
    compact = `translateX(-50%) translate(${(x - bounds.left) / zoom}px, ${(y - bounds.top) / zoom}px) scale(${scale}, ${scale})`;
  }
  return [
    { transform: shrinking ? full : compact, opacity: shrinking ? 1 : 0, borderRadius: shrinking ? '0px' : '13px' },
    { transform: shrinking ? compact : full, opacity: shrinking ? 0 : 1, borderRadius: shrinking ? '13px' : '0px' },
  ];
}
export const gamePageMotionOptions: KeyframeAnimationOptions = {
  duration: 500, easing: 'cubic-bezier(.4, 0, .2, 1)', fill: 'both',
};
