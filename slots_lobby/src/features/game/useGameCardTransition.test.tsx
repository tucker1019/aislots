import {useRef} from 'react';
import {act,cleanup,fireEvent,render,screen} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
import {rememberGameCardOrigin} from './gameCardOrigin';
import {useGameCardTransition} from './useGameCardTransition';
function Harness({onClose}:{onClose:()=>void}){
 const shell=useRef<HTMLElement>(null);const {closeToCard}=useGameCardTransition('card-test',shell);
 return <section ref={shell}><button onClick={()=>closeToCard(onClose)}>close</button><iframe title="game" src="about:blank"/></section>;
}
afterEach(()=>{cleanup();vi.restoreAllMocks();});
it('opens from the clicked card, then closes back to it after 500ms without remounting the iframe',()=>{
 vi.spyOn(HTMLElement.prototype,'getBoundingClientRect').mockReturnValue({left:0,top:0,width:420,height:800} as DOMRect);
 vi.spyOn(HTMLElement.prototype,'offsetWidth','get').mockReturnValue(420);
 const card=document.createElement('button');card.getBoundingClientRect=()=>({left:120,top:240,width:100,height:140}) as DOMRect;
 rememberGameCardOrigin('card-test',card);
 const animations:{cancel:ReturnType<typeof vi.fn>;onfinish:(()=>void)|null}[]=[];
 const animate=vi.fn<(frames:Keyframe[],options:KeyframeAnimationOptions)=>{cancel:ReturnType<typeof vi.fn>;onfinish:(()=>void)|null}>(()=>{const a={cancel:vi.fn(),onfinish:null as (()=>void)|null};animations.push(a);return a;});
 Object.defineProperty(HTMLElement.prototype,'animate',{configurable:true,value:animate});
 const onClose=vi.fn();render(<Harness onClose={onClose}/>);const frame=screen.getByTitle('game');
 expect(animate.mock.calls[0][0][0].transform).toContain('scale(0.175, 0.175)');
 expect(animate.mock.calls[0][0].map(f=>f.opacity)).toEqual([0,1]);
 expect(animate.mock.calls[0][1].duration).toBe(500);
 act(()=>animations[0].onfinish?.());fireEvent.click(screen.getByText('close'));
 expect(onClose).not.toHaveBeenCalled();expect(screen.getByTitle('game')).toBe(frame);
 expect(animate.mock.calls[1][0].map(f=>f.opacity)).toEqual([1,0]);
 fireEvent.click(screen.getByText('close'));expect(animate).toHaveBeenCalledTimes(2);
 act(()=>animations[1].onfinish?.());expect(onClose).toHaveBeenCalledOnce();
});
