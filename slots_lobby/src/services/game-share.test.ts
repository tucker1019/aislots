import {expect,it} from 'vitest';
import {gameShareUrl} from './game-share';
it('shares a clean game page without session or replay credentials',()=>{
 window.history.replaceState({},'', '/game/AG1?sid=private');
 expect(gameShareUrl('AG2')).toBe(window.location.origin+'/game/AG2');
});
