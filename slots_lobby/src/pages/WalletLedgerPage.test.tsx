import { beforeEach, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useLanguageStore } from '../i18n';
import { WalletLedgerPage } from './WalletLedgerPage';
import { fetchLedger, fetchLedgerDetail } from '../services/wallet-ledger';
vi.mock('../services/wallet-ledger',()=>({fetchLedger:vi.fn(),fetchLedgerDetail:vi.fn()}));
const item={categoryId:'bet:AG',id:'7',orderId:'transaction-7',type:'AG 投注',currency:'IDR',amount:-100,balance:500,createdAt:'2026-11-03T01:00:00Z',remark:'AG 投注'};
const page={items:[item],categories:[{id:'bet:AG',name:'AG 投注'},{id:'checkin',name:'簽到獎勵'}],nextCursor:''};
beforeEach(()=>{useLanguageStore.getState().setLocale('zh-TW');vi.mocked(fetchLedger).mockReset();vi.mocked(fetchLedgerDetail).mockReset();window.history.replaceState(null,'','/wallet-ledger');});
function setup(id?:string){render(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false,gcTime:0}}})}><WalletLedgerPage id={id} onBack={vi.fn()}/></QueryClientProvider>);}
it('分類來自服務端，按類型篩選，列表顯示餘額和廠商',async()=>{
 vi.mocked(fetchLedger).mockResolvedValue(page);setup();expect(await screen.findByText('AG 投注')).toBeInTheDocument();expect(screen.getByText('賬戶餘額 5.00')).toBeInTheDocument();
 fireEvent.click(screen.getByRole('button',{name:'全部'}));fireEvent.click(screen.getByRole('button',{name:'簽到獎勵'}));
 await waitFor(()=>expect(vi.mocked(fetchLedger).mock.calls.some(call=>call[2]==='checkin')).toBe(true));
});
it('詳情按流水ID讀取並顯示訂單、幣種和備注',async()=>{
 vi.mocked(fetchLedger).mockResolvedValue(page);vi.mocked(fetchLedgerDetail).mockResolvedValue(item);setup('7');
 expect(await screen.findByText('transaction-7')).toBeInTheDocument();expect(screen.getByRole('button',{name:'複製訂單號'})).toBeEnabled();expect(screen.getByText('賬變後餘額')).toBeInTheDocument();
 expect(vi.mocked(fetchLedgerDetail).mock.calls[0]?.[0]).toBe('7');
});
it('追加記錄保留原列表',async()=>{
 vi.mocked(fetchLedger).mockResolvedValueOnce({...page,nextCursor:'7'}).mockResolvedValueOnce({...page,items:[{...item,id:'6',categoryId:'checkin',type:'簽到獎勵'}]});setup();await screen.findByText('AG 投注');fireEvent.click(screen.getByRole('button',{name:'加載更多'}));expect(await screen.findByText('簽到獎勵')).toBeInTheDocument();expect(screen.getByText('AG 投注')).toBeInTheDocument();
});
it('失敗可以重試',async()=>{vi.mocked(fetchLedger).mockRejectedValue(new Error('network'));setup();expect(await screen.findByText('網絡異常，請重試')).toBeInTheDocument();expect(screen.getByRole('button',{name:'重試'})).toBeEnabled();});

it('英文模式選中服務端分類後篩選按鈕仍顯示英文',async()=>{
 useLanguageStore.getState().setLocale('en-US');
 vi.mocked(fetchLedger).mockResolvedValue({...page,categories:[{id:'withdrawal-bonus',name:'取款贈送'}]});
 setup();await screen.findByText('AG Bet');
 fireEvent.click(screen.getByRole('button',{name:'All'}));
 fireEvent.click(screen.getByRole('button',{name:'Withdrawal bonus'}));
 expect(await screen.findByRole('button',{name:'Withdrawal bonus'})).toBeInTheDocument();
 expect(screen.queryByText('取款贈送')).not.toBeInTheDocument();
 await waitFor(()=>expect(vi.mocked(fetchLedger).mock.calls.some(call=>call[2]==='withdrawal-bonus')).toBe(true));
});
