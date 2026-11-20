import {expect,it,vi,beforeEach} from 'vitest';
import {render,screen,fireEvent,waitFor} from '@testing-library/react';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {GamePageActions} from './GamePageActions';
import {fetchGameFavorites,setGameFavorite} from '../../services/game-favorites';
import {useSessionStore} from '../../stores/session';
vi.mock('../../services/game-favorites',()=>({fetchGameFavorites:vi.fn(),setGameFavorite:vi.fn()}));
beforeEach(()=>{vi.mocked(fetchGameFavorites).mockResolvedValue([]);vi.mocked(setGameFavorite).mockReset();useSessionStore.setState({session:{uid:7,sid:'x'.repeat(52),expiresAt:'2099-01-01T00:00:00Z'}});});
it('prevents duplicate writes and only changes favorite state after the server confirms',async()=>{
 let finish!:(ids:string[])=>void;vi.mocked(setGameFavorite).mockImplementation(()=>new Promise(resolve=>{finish=resolve;}));
 const client=new QueryClient({defaultOptions:{queries:{retry:false,gcTime:0}}});
 render(<QueryClientProvider client={client}><GamePageActions gameId="AG2" title="Mahjong"/></QueryClientProvider>);
 const button=await screen.findByRole('button',{name:'收藏遊戲'});await waitFor(()=>expect(button).toBeEnabled());
 fireEvent.click(button);fireEvent.click(button);await waitFor(()=>expect(setGameFavorite).toHaveBeenCalledTimes(1));expect(button).toHaveAttribute('aria-busy','true');expect(button).toHaveAttribute('aria-pressed','false');
 finish(['AG2']);expect(await screen.findByRole('button',{name:'取消收藏'})).toHaveAttribute('aria-pressed','true');
 expect(client.getQueryData(['lobby','game-favorites',7])).toEqual(['AG2']);
});
it('keeps the confirmed favorite on failure and shows a toast',async()=>{
 vi.mocked(fetchGameFavorites).mockResolvedValue(['AG2']);vi.mocked(setGameFavorite).mockRejectedValue(new Error('offline'));
 render(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false,gcTime:0}}})}><GamePageActions gameId="AG2" title="Mahjong"/></QueryClientProvider>);
 const button=await screen.findByRole('button',{name:'取消收藏'});await waitFor(()=>expect(button).toBeEnabled());fireEvent.click(button);
 expect(await screen.findByText('收藏更新失敗，請重試')).toBeInTheDocument();expect(button).toHaveAttribute('aria-pressed','true');
});
