import {expect,it,vi,beforeEach} from 'vitest';
import {render,screen,waitFor} from '@testing-library/react';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {RtpSummary} from './RtpSummary';
import {fetchLobbyGames} from '../../services/lobby-games';
import {useLanguageStore} from '../../i18n';
vi.mock('../../services/lobby-games',()=>({fetchLobbyGames:vi.fn()}));
vi.mock('../../services/game-statistics',()=>({fetchGameRtp:vi.fn().mockResolvedValue({hasData:true,percent:'97.00'})}));
beforeEach(()=>useLanguageStore.setState({locale:'zh-TW'}));
function setup(gameId:string){return render(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false,gcTime:0}}})}><RtpSummary gameId={gameId}/></QueryClientProvider>);}
it('renders the selected game values and compares live RTP with its configured theory',async()=>{
 vi.mocked(fetchLobbyGames).mockResolvedValue([
  {id:'AG1',name:'one',nameEn:'one',cover:'/assets/one.png',provider:'AG',sort:1,enabled:true,theoreticalRtp:99,volatility:'low',maxWin:-1},
  {id:'AG2',name:'two',nameEn:'two',cover:'/assets/two.png',provider:'AG',sort:2,enabled:true,theoreticalRtp:96.5,volatility:'extreme',maxWin:5000},
 ]);
 const view=setup('AG2');
 expect(await screen.findByText('96.50%')).toBeInTheDocument();
 expect(screen.getByText('極高')).toBeInTheDocument();expect(screen.getByText('x5000')).toBeInTheDocument();
 await waitFor(()=>expect(screen.getByText('97.00%')).toHaveClass('rtp-up'));
 view.unmount();setup('AG1');
 expect(await screen.findByText('99.00%')).toBeInTheDocument();expect(screen.getByText('低')).toBeInTheDocument();expect(screen.getByText('無上限')).toBeInTheDocument();
 await waitFor(()=>expect(screen.getByText('97.00%')).toHaveClass('rtp-down'));
});
it.each([[97,'97.00%'],[97.1,'97.10%'],[97.03,'97.03%']] as const)('formats configured RTP %s with two decimals',async(value,display)=>{
 vi.mocked(fetchLobbyGames).mockResolvedValue([{id:'AG1',name:'one',nameEn:'one',cover:'/assets/one.png',provider:'AG',sort:1,enabled:true,theoreticalRtp:value,volatility:'medium',maxWin:-1}]);
 setup('AG1');
 await waitFor(()=>expect(screen.getByText('理論 RTP').parentElement?.querySelector('strong')).toHaveTextContent(display));
});
