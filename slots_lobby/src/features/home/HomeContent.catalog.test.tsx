import { beforeEach, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { HomeContent } from './HomeContent';
import { fetchLobbyGames, type LobbyGame } from '../../services/lobby-games';
import { useSessionStore } from '../../stores/session';
vi.mock('../../services/lobby-games',()=>({fetchLobbyGames:vi.fn()}));
vi.mock('../../services/lobby-content',()=>({fetchLobbyContent:vi.fn().mockResolvedValue({announcements:{'zh-TW':[],'en-US':[]},banners:[]})}));
const games:LobbyGame[]=[{id:'NEW_GAME',name:'New Game',nameEn:'New Game',provider:'AG',cover:'/assets/new.png',enabled:true,sort:1},{id:'SOON',name:'Soon',nameEn:'Soon',provider:'AG',cover:'/assets/soon.png',enabled:false,sort:2}];
beforeEach(()=>{HTMLElement.prototype.scrollTo=vi.fn();vi.clearAllMocks();window.history.replaceState(null,'','/');useSessionStore.setState({session:{uid:7,sid:'a'.repeat(52),expiresAt:'2030-01-01T00:00:00Z'}});});
function setup(){const comingSoon=vi.fn();render(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false,gcTime:0}}})}><div id="root"><HomeContent onComingSoon={comingSoon}/></div></QueryClientProvider>);return comingSoon;}
it('uses the server catalog and supports newly configured games without client registration',async()=>{
 vi.mocked(fetchLobbyGames).mockResolvedValue(games);const comingSoon=setup();
 await userEvent.click(await screen.findByRole('button',{name:'Soon'}));expect(comingSoon).toHaveBeenCalledOnce();expect(window.location.pathname).toBe('/');
 await userEvent.click(screen.getByRole('button',{name:'New Game'}));expect(window.location.pathname).toBe('/game/NEW_GAME');
 expect(screen.queryByRole('button',{name:'進入麻將胡了'})).not.toBeInTheDocument();
});
it('keeps static controls on failure and retries only the catalog',async()=>{
 vi.mocked(fetchLobbyGames).mockRejectedValueOnce(new Error('network')).mockResolvedValueOnce([]);setup();
 expect(await screen.findByRole('alert')).toBeInTheDocument();expect(screen.getByRole('navigation',{name:'遊戲廠商'})).toBeInTheDocument();
 await userEvent.click(screen.getByRole('button',{name:'重試'}));expect(await screen.findByText('敬請期待')).toBeInTheDocument();expect(fetchLobbyGames).toHaveBeenCalledTimes(2);
});
it('appends six more rows while keeping existing image nodes',async()=>{
 const list=Array.from({length:40},(_,index)=>({...games[1],id:`G${index}`,name:`Game ${index}`}));vi.mocked(fetchLobbyGames).mockResolvedValue(list);
 let intersect: IntersectionObserverCallback=()=>{};
 vi.stubGlobal('IntersectionObserver',class { constructor(callback:IntersectionObserverCallback){intersect=callback;}observe(){}disconnect(){}unobserve(){} });
 Object.defineProperty(HTMLImageElement.prototype,'decode',{configurable:true,value:vi.fn().mockResolvedValue(undefined)});
 setup();const first=await screen.findByRole('button',{name:'Game 0'});expect(document.querySelectorAll('.game-tile')).toHaveLength(18);
 act(()=>intersect([{isIntersecting:true} as IntersectionObserverEntry],{} as IntersectionObserver));
 await waitFor(()=>expect(document.querySelectorAll('.game-tile')).toHaveLength(36));expect(screen.getByRole('button',{name:'Game 0'})).toBe(first);
});
