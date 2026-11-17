import { useRef } from 'react';
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { useGameDocking } from './useGameDocking';
function Harness({ minimized }: { minimized: boolean }) {
 const target=useRef<HTMLElement>(null);const shell=useGameDocking(minimized,target);
 return <><section ref={shell} data-testid="detail"><iframe title="persistent game" src="about:blank" /></section><aside ref={target} data-testid="dock"><button className="minimized-game-restore">restore</button></aside></>;
}
afterEach(()=>{cleanup();vi.restoreAllMocks();vi.unstubAllGlobals();});
it('animates the page to the dock and back for 500ms without replacing the iframe',()=>{
 vi.spyOn(HTMLElement.prototype,'getBoundingClientRect').mockImplementation(function(this:HTMLElement){return (this.dataset.testid==='dock'?{left:22,top:650,width:380,height:66}:{left:10,top:0,width:420,height:800}) as DOMRect;});
 vi.spyOn(HTMLElement.prototype,'offsetWidth','get').mockReturnValue(420);
 const animations:{cancel:ReturnType<typeof vi.fn>;onfinish:(()=>void)|null}[]=[];
 const animate=vi.fn<(frames:Keyframe[],options:KeyframeAnimationOptions)=>{cancel:ReturnType<typeof vi.fn>;onfinish:(()=>void)|null}>(()=>{const animation={cancel:vi.fn(),onfinish:null as (()=>void)|null};animations.push(animation);return animation;});
 Object.defineProperty(HTMLElement.prototype,'animate',{configurable:true,value:animate});
 const {rerender}=render(<Harness minimized={false}/>);const iframe=screen.getByTitle('persistent game');
 rerender(<Harness minimized/>);
 expect(animate).toHaveBeenCalledWith(expect.any(Array),expect.objectContaining({duration:500,fill:'both'}));
 expect(animate.mock.calls[0]?.[0]).toEqual(expect.arrayContaining([expect.objectContaining({transform:expect.stringContaining('scale(0.0825, 0.0825)')})]));
 expect(animate.mock.calls[0][0].map(frame=>frame.opacity)).toEqual([1,0]);
 expect(screen.getByTestId('detail')).toHaveClass('game-detail-docking');expect(screen.getByText('restore')).toBeDisabled();
 act(()=>animations[0].onfinish?.());expect(screen.getByText('restore')).not.toBeDisabled();
 rerender(<Harness minimized={false}/>);expect(animate).toHaveBeenCalledTimes(2);expect(animate.mock.calls[1][0].map(frame=>frame.opacity)).toEqual([0,1]);expect(screen.getByTitle('persistent game')).toBe(iframe);
 act(()=>animations[1].onfinish?.());expect(screen.getByTestId('detail')).not.toHaveClass('game-detail-docking');
});
it('respects reduced motion',()=>{
 vi.stubGlobal('matchMedia',()=>({matches:true}));const animate=vi.fn();Object.defineProperty(HTMLElement.prototype,'animate',{configurable:true,value:animate});
 const {rerender}=render(<Harness minimized={false}/>);rerender(<Harness minimized/>);expect(animate).not.toHaveBeenCalled();
});
