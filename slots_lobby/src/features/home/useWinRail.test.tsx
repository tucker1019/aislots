import {act,render,screen} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
import {useState} from 'react';
import {useWinRail} from './useWinRail';
function Harness({active=true,onNext}:{active?:boolean;onNext:()=>void}) {
 const rail=useWinRail(active,5,onNext);
 return <div ref={rail} data-testid="rail"><article className="recent-win"/></div>;
}
afterEach(()=>{vi.restoreAllMocks();vi.unstubAllGlobals();});
it('automatically advances exactly one card per stride and pauses off home',()=>{
 let callback:FrameRequestCallback=()=>{};
 vi.stubGlobal('requestAnimationFrame',vi.fn((cb:FrameRequestCallback)=>{callback=cb;return 1;}));
 vi.stubGlobal('cancelAnimationFrame',vi.fn());
 vi.spyOn(HTMLElement.prototype,'offsetWidth','get').mockReturnValue(90);
 const onNext=vi.fn();const view=render(<Harness onNext={onNext}/>);
 for(let now=1;now<=3601;now+=80)act(()=>callback(now));
 expect(onNext).toHaveBeenCalledOnce();
 expect(screen.getByTestId('rail').scrollLeft).toBeGreaterThan(0);
 view.rerender(<Harness active={false} onNext={onNext}/>);
 expect(cancelAnimationFrame).toHaveBeenCalled();
});

it('commits the new leading card before the animation callback resets its offset',()=>{
 let callback:FrameRequestCallback=()=>{};
 vi.stubGlobal('requestAnimationFrame',vi.fn((cb:FrameRequestCallback)=>{callback=cb;return 1;}));
 vi.stubGlobal('cancelAnimationFrame',vi.fn());
 vi.spyOn(HTMLElement.prototype,'offsetWidth','get').mockReturnValue(90);
 function Stream(){
  const [first,setFirst]=useState(0);
  const rail=useWinRail(true,5,()=>setFirst(value=>value+1));
  return <div ref={rail} data-testid="stream"><article className="recent-win">{first}</article></div>;
 }
 render(<Stream/>);
 let crossed=false;
 // Read within the same frame, before act can flush an asynchronous React update.
 for(let now=1;now<=2601;now+=80){
  act(()=>{
   callback(now);
   const node=screen.getByTestId('stream');
   if(now>2401){expect(node).toHaveTextContent('1');crossed=true;}
  });
 }
 expect(crossed).toBe(true);
});
