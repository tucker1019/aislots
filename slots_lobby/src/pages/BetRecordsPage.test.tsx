import { expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BetRecordsPage } from './BetRecordsPage';
import { loadBetRecords } from '../services/bet-records';
vi.mock('../services/bet-records', () => ({loadBetRecords:vi.fn()}));
const row = {betId:'original',gameId:'AG1',gameName:'麻將胡了',provider:'動態廠商',createdAt:'2026-11-03T01:00:00Z',betAmount:100,validBet:100,profit:-50};
const page = {items:[row],count:22,betAmount:2200,profit:-50,hasMore:true,currency:'IDR',providers:['AG']};
beforeEach(() => {vi.mocked(loadBetRecords).mockReset();});
function setup() {return render(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false,gcTime:0}}})}><BetRecordsPage onBack={vi.fn()} /></QueryClientProvider>);}
it('加載更多保留舊記錄，匯總來自服務端，時間篩選重查第一頁', async () => {
 vi.mocked(loadBetRecords).mockResolvedValueOnce(page).mockResolvedValueOnce({...page,hasMore:false,items:[{...row,betId:'next'}]}).mockResolvedValueOnce({...page,items:[],count:0,hasMore:false});
 setup(); expect(await screen.findByText('動態廠商')).toBeInTheDocument(); expect(screen.getByText('22')).toBeInTheDocument();
 fireEvent.click(screen.getByText('加載更多')); expect(await screen.findByText('next')).toBeInTheDocument(); expect(screen.getByText('original')).toBeInTheDocument();
 fireEvent.click(screen.getByRole('button',{name:/今天/})); fireEvent.click(screen.getByRole('button',{name:'昨天'}));
 expect(await screen.findByText('暫無投注記錄')).toBeInTheDocument();
 await waitFor(() => expect(vi.mocked(loadBetRecords).mock.calls[2]?.[2]).toBe(1));
});
it('失敗提供重試', async () => {vi.mocked(loadBetRecords).mockRejectedValue(new Error('network'));setup();expect(await screen.findByText('網絡異常，請重試')).toBeInTheDocument();expect(screen.getByText('重試')).toBeEnabled();});
it('廠商默認全部，下拉讀取服務端選項，選擇後請求服務端篩選', async () => {
 vi.mocked(loadBetRecords).mockResolvedValue({...page,hasMore:false});
 setup();await screen.findByText('動態廠商');
 fireEvent.click(screen.getByRole('button',{name:'全部'}));
 fireEvent.click(screen.getByRole('button',{name:'AG'}));
 await waitFor(() => expect(vi.mocked(loadBetRecords).mock.calls.some(call => call[4] === 'AG')).toBe(true));
 expect(screen.getByRole('button',{name:'AG'})).toHaveAttribute('aria-expanded','false');
 fireEvent.click(screen.getByRole('button',{name:'AG'}));
 fireEvent.click(screen.getByRole('button',{name:'全部'}));
 expect(screen.getByRole('button',{name:'全部'})).toHaveAttribute('aria-expanded','false');
});
