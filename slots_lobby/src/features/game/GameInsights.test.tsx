import {t} from '../../i18n';
import type * as StatisticsModule from '../../services/game-statistics';
import {expect,it,vi,beforeEach} from 'vitest';
import {act,render,screen,fireEvent,waitFor} from '@testing-library/react';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {GameInsights} from './GameInsights';
import {fetchGameRtp,fetchLeaderboard} from '../../services/game-statistics';
vi.mock('../../services/game-statistics',async original=>({...await original<typeof StatisticsModule>(),fetchGameRtp:vi.fn(),fetchLeaderboard:vi.fn()}));
beforeEach(()=>{vi.mocked(fetchGameRtp).mockReset();vi.mocked(fetchLeaderboard).mockReset();});
function setup(part:'rtp'|'ranking'){render(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false,gcTime:0}}})}><GameInsights part={part}/></QueryClientProvider>);}
it('RTP浮窗直接展示三個窗口並按理論值顯示方向',async()=>{vi.mocked(fetchGameRtp).mockImplementation(async window=>({percent:window==='24h'?'90.00':'120.00',rounds:3,hasData:true,from:'2026-11-03T00:00:00Z',to:'2026-11-03T01:00:00Z',updatedAt:'2026-11-03T01:00:00Z',statisticsSince:'2026-11-03T00:00:00Z'}));setup('rtp');await screen.findByText('120.00%');fireEvent.click(screen.getByRole('button',{name:t('gamePreview.rtpTime')}));expect(await screen.findByText('90.00%')).toHaveClass('rtp-down');expect(screen.getAllByText('120.00%')[0]).toHaveClass('rtp-up');expect(screen.queryByRole('option')).not.toBeInTheDocument();expect(fetchGameRtp).toHaveBeenCalledTimes(3);});
it('5分鐘無數據時回退一小時',async()=>{vi.mocked(fetchGameRtp).mockImplementation(async window=>({percent:window==='1h'?'98.00':'90.00',rounds:3,hasData:window!=='5m',from:'2026-11-03T00:00:00Z',to:'2026-11-03T01:00:00Z',updatedAt:'2026-11-03T01:00:00Z',statisticsSince:'2026-11-03T00:00:00Z'}));setup('rtp');expect(await screen.findByText('98.00%')).toHaveClass('rtp-up');});
it('排行榜顯示脫敏暱稱和頭像，切換連勝榜',async()=>{vi.mocked(fetchLeaderboard).mockResolvedValue({items:[{rank:1,platformOrderId:'1',userId:'public',nickname:'玩***',avatarId:2,betId:'a',betAmount:'100',winAmount:'500',multiplier:'5.00',streak:8,occurredAt:'2026-11-03T01:00:00Z'}],updatedAt:'2026-11-03T01:00:00Z',statisticsSince:'2026-11-03T00:00:00Z',timezone:'UTC'});setup('ranking');expect(await screen.findByText('玩***')).toBeInTheDocument();expect(fetchLeaderboard).toHaveBeenCalledWith('wins','all',expect.any(AbortSignal));fireEvent.click(screen.getByRole('tab',{name:t('gamePreview.longestStreak')}));expect(await screen.findByText(t('statistics.streak',{count:8}))).toBeInTheDocument();expect(fetchGameRtp).not.toHaveBeenCalled();});

it('停留頁面不輪詢刷新RTP',async()=>{vi.mocked(fetchGameRtp).mockResolvedValue({percent:'97.00',rounds:3,hasData:true,from:'2026-11-03T00:00:00Z',to:'2026-11-03T01:00:00Z',updatedAt:'2026-11-03T01:00:00Z',statisticsSince:'2026-11-03T00:00:00Z'});setup('rtp');await screen.findByText('97.00%');vi.useFakeTimers();try{await act(async()=>{await vi.advanceTimersByTimeAsync(90000);});expect(fetchGameRtp).toHaveBeenCalledTimes(3);}finally{vi.useRealTimers();}});

it('體驗賬號用獨立標籤展示，不偽裝為普通玩家',async()=>{
 vi.mocked(fetchLeaderboard).mockResolvedValue({items:[{rank:1,platformOrderId:'1',userId:'demo',nickname:'體***',avatarId:1,betId:'demo-bet',betAmount:'200',winAmount:'500',multiplier:'2.50',streak:1,occurredAt:'2026-11-04T01:00:00Z',experienceAccount:true}],updatedAt:'2026-11-04T01:00:00Z',statisticsSince:'2026-11-03T00:00:00Z',timezone:'UTC'});
 setup('ranking');expect(await screen.findByText(t('statistics.experienceAccount'))).toBeInTheDocument();expect(screen.getByText('體***')).toBeInTheDocument();
});

it('24 小時先返回時只更新浮窗，頂部等較短窗口確定後再顯示', async () => {
  type Result = Awaited<ReturnType<typeof fetchGameRtp>>;
  let resolveShort!: (result: Result) => void;
  let resolveHourly!: (result: Result) => void;
  const short = new Promise<Result>(resolve => { resolveShort = resolve; });
  const hourly = new Promise<Result>(resolve => { resolveHourly = resolve; });
  const daily: Result = {
    percent: '90.00', rounds: 3, hasData: true,
    from: '', to: '', updatedAt: '', statisticsSince: '',
  };
  vi.mocked(fetchGameRtp).mockImplementation(window =>
    window === '5m' ? short : window === '1h' ? hourly : Promise.resolve(daily),
  );
  setup('rtp');
  const button = screen.getByRole('button', {name: t('gamePreview.rtpTime')});
  const headline = button.parentElement?.querySelector('.rtp-headline');
  expect(headline).toHaveTextContent('…');
  fireEvent.click(button);
  await screen.findByText('90.00%');
  expect(headline).toHaveTextContent('…');

  resolveHourly({...daily, percent: '98.00'});
  await screen.findByText('98.00%');
  expect(headline).toHaveTextContent('…');

  resolveShort({...daily, hasData: false});
  await waitFor(() => expect(headline).toHaveTextContent('98.00%'));
});
