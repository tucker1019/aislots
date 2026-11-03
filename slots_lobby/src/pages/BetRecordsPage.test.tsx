import { expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BetRecordsPage } from './BetRecordsPage';
import { loadBetRecords } from '../services/bet-records';
vi.mock('../services/bet-records', () => ({loadBetRecords:vi.fn()}));
const row = {betId:'original',gameId:'AG1',gameName:'麻将胡了',provider:'动态厂商',createdAt:'2026-11-03T01:00:00Z',betAmount:100,validBet:100,profit:-50};
const page = {items:[row],count:22,betAmount:2200,profit:-50,hasMore:true,currency:'IDR',providers:['AG']};
beforeEach(() => {vi.mocked(loadBetRecords).mockReset();});
function setup() {return render(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false,gcTime:0}}})}><BetRecordsPage onBack={vi.fn()} /></QueryClientProvider>);}
it('加载更多保留旧记录，汇总来自服务端，时间筛选重查第一页', async () => {
 vi.mocked(loadBetRecords).mockResolvedValueOnce(page).mockResolvedValueOnce({...page,hasMore:false,items:[{...row,betId:'next'}]}).mockResolvedValueOnce({...page,items:[],count:0,hasMore:false});
 setup(); expect(await screen.findByText('动态厂商')).toBeInTheDocument(); expect(screen.getByText('22')).toBeInTheDocument();
 fireEvent.click(screen.getByText('加载更多')); expect(await screen.findByText('next')).toBeInTheDocument(); expect(screen.getByText('original')).toBeInTheDocument();
 fireEvent.click(screen.getByRole('button',{name:/今天/})); fireEvent.click(screen.getByRole('button',{name:'昨天'}));
 expect(await screen.findByText('暂无投注记录')).toBeInTheDocument();
 await waitFor(() => expect(vi.mocked(loadBetRecords).mock.calls[2]?.[2]).toBe(1));
});
it('失败提供重试', async () => {vi.mocked(loadBetRecords).mockRejectedValue(new Error('network'));setup();expect(await screen.findByText('网络异常，请重试')).toBeInTheDocument();expect(screen.getByText('重试')).toBeEnabled();});
it('厂商默认全部，下拉读取服务端选项，选择后请求服务端筛选', async () => {
 vi.mocked(loadBetRecords).mockResolvedValue({...page,hasMore:false});
 setup();await screen.findByText('动态厂商');
 fireEvent.click(screen.getByRole('button',{name:'全部'}));
 fireEvent.click(screen.getByRole('button',{name:'AG'}));
 await waitFor(() => expect(vi.mocked(loadBetRecords).mock.calls.some(call => call[4] === 'AG')).toBe(true));
 expect(screen.getByRole('button',{name:'AG'})).toHaveAttribute('aria-expanded','false');
 fireEvent.click(screen.getByRole('button',{name:'AG'}));
 fireEvent.click(screen.getByRole('button',{name:'全部'}));
 expect(screen.getByRole('button',{name:'全部'})).toHaveAttribute('aria-expanded','false');
});
