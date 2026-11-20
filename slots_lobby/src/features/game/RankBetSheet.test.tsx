import {expect,it,vi} from 'vitest';
import {render,screen,fireEvent,waitFor,within} from '@testing-library/react';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {RankBetSheet} from './RankBetSheet';
import type * as StatisticsModule from '../../services/game-statistics';
import {fetchRankReplay} from '../../services/game-statistics';
vi.mock('../../services/lobby-games',()=>({fetchLobbyGames:vi.fn().mockResolvedValue([])}));
vi.mock('../../services/game-statistics',async original=>({...await original<typeof StatisticsModule>(),fetchRankReplay:vi.fn()}));
it('closes the bet drawer before opening share, and closes everything when share is dismissed',async()=>{
 const onClose=vi.fn();const url='https://game.example/?replay=bet&share=public';vi.mocked(fetchRankReplay).mockResolvedValue(url);
 render(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false,gcTime:0}}})}><RankBetSheet row={{rank:1,platformOrderId:'order',userId:'1',nickname:'player',avatarId:1,betId:'bet',betAmount:'100',winAmount:'500',multiplier:'5',occurredAt:'2026-11-21T00:00:00Z'}} board="wins" period="today" onClose={onClose}/></QueryClientProvider>);
 const share=await screen.findByRole('button',{name:'分享'});fireEvent.click(share);
 await waitFor(()=>expect(screen.getByRole('textbox',{name:'回放連結'})).toHaveValue(url));
 expect(document.querySelector('.ant-drawer-open .game-rank-sheet')).toBeNull();expect(onClose).not.toHaveBeenCalled();
 fireEvent.click(within(screen.getByRole('textbox',{name:'回放連結'}).closest('[role=dialog]') as HTMLElement).getByRole('button',{name:'Close'}));expect(onClose).toHaveBeenCalledTimes(1);
});
