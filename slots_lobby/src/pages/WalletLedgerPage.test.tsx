import { beforeEach, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useLanguageStore } from '../i18n';
import { WalletLedgerPage } from './WalletLedgerPage';
import { fetchLedger, fetchLedgerDetail } from '../services/wallet-ledger';
vi.mock('../services/wallet-ledger',()=>({fetchLedger:vi.fn(),fetchLedgerDetail:vi.fn()}));
const item={id:'7',orderId:'transaction-7',type:'AG 投注',currency:'IDR',amount:-100,balance:500,createdAt:'2026-11-03T01:00:00Z',remark:'AG 投注'};
const page={items:[item],categories:[{id:'bet:AG',name:'AG 投注'},{id:'checkin',name:'签到奖励'}],nextCursor:''};
beforeEach(()=>{useLanguageStore.getState().setLocale('zh-CN');vi.mocked(fetchLedger).mockReset();vi.mocked(fetchLedgerDetail).mockReset();window.history.replaceState(null,'','/wallet-ledger');});
function setup(id?:string){render(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false,gcTime:0}}})}><WalletLedgerPage id={id} onBack={vi.fn()}/></QueryClientProvider>);}
it('分类来自服务端，按类型筛选，列表显示余额和厂商',async()=>{
 vi.mocked(fetchLedger).mockResolvedValue(page);setup();expect(await screen.findByText('AG 投注')).toBeInTheDocument();expect(screen.getByText('账户余额 5.00')).toBeInTheDocument();
 fireEvent.click(screen.getByRole('button',{name:'全部'}));fireEvent.click(screen.getByRole('button',{name:'签到奖励'}));
 await waitFor(()=>expect(vi.mocked(fetchLedger).mock.calls.some(call=>call[2]==='checkin')).toBe(true));
});
it('详情按流水ID读取并显示订单、币种和备注',async()=>{
 vi.mocked(fetchLedger).mockResolvedValue(page);vi.mocked(fetchLedgerDetail).mockResolvedValue(item);setup('7');
 expect(await screen.findByText('transaction-7')).toBeInTheDocument();expect(screen.getByRole('button',{name:'复制订单号'})).toBeEnabled();expect(screen.getByText('账变后余额')).toBeInTheDocument();
 expect(vi.mocked(fetchLedgerDetail).mock.calls[0]?.[0]).toBe('7');
});
it('追加记录保留原列表',async()=>{
 vi.mocked(fetchLedger).mockResolvedValueOnce({...page,nextCursor:'7'}).mockResolvedValueOnce({...page,items:[{...item,id:'6',type:'签到奖励'}]});setup();await screen.findByText('AG 投注');fireEvent.click(screen.getByRole('button',{name:'加载更多'}));expect(await screen.findByText('签到奖励')).toBeInTheDocument();expect(screen.getByText('AG 投注')).toBeInTheDocument();
});
it('失败可以重试',async()=>{vi.mocked(fetchLedger).mockRejectedValue(new Error('network'));setup();expect(await screen.findByText('网络异常，请重试')).toBeInTheDocument();expect(screen.getByRole('button',{name:'重试'})).toBeEnabled();});

it('英文模式选中服务端分类后筛选按钮仍显示英文',async()=>{
 useLanguageStore.getState().setLocale('en-US');
 vi.mocked(fetchLedger).mockResolvedValue({...page,categories:[{id:'withdrawal-bonus',name:'取款赠送'}]});
 setup();await screen.findByText('AG Bet');
 fireEvent.click(screen.getByRole('button',{name:'All'}));
 fireEvent.click(screen.getByRole('button',{name:'Withdrawal bonus'}));
 expect(await screen.findByRole('button',{name:'Withdrawal bonus'})).toBeInTheDocument();
 expect(screen.queryByText('取款赠送')).not.toBeInTheDocument();
 await waitFor(()=>expect(vi.mocked(fetchLedger).mock.calls.some(call=>call[2]==='withdrawal-bonus')).toBe(true));
});
