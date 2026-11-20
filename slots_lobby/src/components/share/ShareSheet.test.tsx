import {expect,it,vi} from 'vitest';
import {render,screen,fireEvent,waitFor} from '@testing-library/react';
import {ShareSheet} from './ShareSheet';
it('opens a bottom sheet and copies exactly the supplied link with duplicate protection',async()=>{
 let finish!:()=>void;const copy=vi.fn(()=>new Promise<void>(resolve=>{finish=resolve;}));
 Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:copy}});
 render(<ShareSheet content={{url:'https://example.com/?inviteCode=abc',kind:'invite'}} onClose={vi.fn()}/>);
 expect(screen.getByRole('link',{name:'WhatsApp'})).toHaveAttribute('target','_blank');
 const button=screen.getByRole('button',{name:'複製'});fireEvent.click(button);fireEvent.click(button);
 expect(copy).toHaveBeenCalledTimes(1);expect(button).toHaveAttribute('aria-busy','true');finish();
 await waitFor(()=>expect(button).toBeEnabled());expect(copy).toHaveBeenCalledWith('https://example.com/?inviteCode=abc');
});
it('shows common toast on copy failure',async()=>{
 Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:vi.fn().mockRejectedValue(new Error('denied'))}});
 render(<ShareSheet content={{url:'https://example.com',kind:'game'}} onClose={vi.fn()}/>);fireEvent.click(screen.getByRole('button',{name:'複製'}));
 expect(await screen.findByText('複製失敗，請選取連結手動複製')).toBeInTheDocument();
});
