import { expect,it,vi } from 'vitest';
import {render,screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {HomeContent} from './HomeContent';
import {launchGame} from '../../services/game-entry';
vi.mock('../../services/game-entry',()=>({launchGame:vi.fn()}));
it('游戏卡片先进入详情路由，由详情容器负责加载游戏',async()=>{
 window.history.replaceState(null,'','/');render(<HomeContent/>);await userEvent.setup().click(screen.getByRole('button',{name:'进入麻将胡了'}));expect(window.location.pathname).toBe('/game/AG1');expect(launchGame).not.toHaveBeenCalled();
});
