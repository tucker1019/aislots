import {testGames} from '../../test/game-catalog';
import {beforeEach as authenticatedFixture} from 'vitest';
import {useSessionStore} from '../../stores/session';
import { expect,it,vi } from 'vitest';
import {render,screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {HomeContent} from './HomeContent';
import {launchGame} from '../../services/game-entry';
vi.mock('../../services/lobby-content',()=>({fetchLobbyContent:vi.fn().mockResolvedValue({announcements:{'zh-TW':[],'en-US':[]},banners:[]})}));
vi.mock('../../services/lobby-games',()=>({fetchLobbyGames:vi.fn().mockResolvedValue(testGames)}));
vi.mock('../../services/game-entry',()=>({launchGame:vi.fn()}));
it('遊戲卡片先進入詳情路由，由詳情容器負責加載遊戲',async()=>{
 window.history.replaceState(null,'','/');render(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}><HomeContent onComingSoon={vi.fn()}/></QueryClientProvider>);await userEvent.setup().click(await screen.findByRole('button',{name:'進入麻將胡了'}));expect(window.location.pathname).toBe('/game/AG1');expect(launchGame).not.toHaveBeenCalled();
});

authenticatedFixture(()=>useSessionStore.setState({session:{uid:7,sid:'a'.repeat(52),expiresAt:'2030-01-01T00:00:00Z'}}));

it('麻將二代卡片進入獨立遊戲路由',async()=>{
 window.history.replaceState(null,'','/');
 const comingSoon=vi.fn();
 render(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}><HomeContent onComingSoon={comingSoon}/></QueryClientProvider>);
 await userEvent.setup().click(await screen.findByRole('button',{name:'麻將胡了2'}));
 expect(window.location.pathname).toBe('/game/AG2');
 expect(comingSoon).not.toHaveBeenCalled();
});
