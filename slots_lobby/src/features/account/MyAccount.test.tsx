import {beforeEach,expect,it,vi} from 'vitest';
import {fireEvent,render,screen} from '@testing-library/react';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {MyAccount} from './MyAccount';
import {loadAccountProfile} from '../../services/account';
import {loadVipOverview} from '../../services/benefits';
import {useSessionStore} from '../../stores/session';
vi.mock('../../services/account',()=>({loadAccountProfile:vi.fn()}));
vi.mock('../../services/benefits',()=>({loadVipOverview:vi.fn()}));
beforeEach(()=>{
 useSessionStore.setState({session:{uid:7,sid:'A'.repeat(52),expiresAt:'2030-01-01'}});
 vi.mocked(loadAccountProfile).mockReset();vi.mocked(loadVipOverview).mockReset().mockImplementation(()=>new Promise(()=>{}));
});
function setup(){const records=vi.fn();render(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false,gcTime:0}}})}><MyAccount onAction={()=>{}} onDeposit={()=>{}} onRecords={records}/></QueryClientProvider>);return records;}
it('资料请求未返回时静态入口立即显示并可操作，不展示虚假余额',()=>{
 vi.mocked(loadAccountProfile).mockImplementation(()=>new Promise(()=>{}));const records=setup();
 expect(screen.getByRole('heading',{name:'福利中心'})).toBeVisible();expect(screen.getByRole('heading',{name:'賬戶服務'})).toBeVisible();
 fireEvent.click(screen.getByRole('button',{name:'存取記錄'}));expect(records).toHaveBeenCalledOnce();
 expect(screen.getByRole('button',{name:'安全中心'})).toBeVisible();expect(screen.getByRole('button',{name:'切換主題'})).toBeVisible();expect(screen.queryByRole('button',{name:'關於我們'})).not.toBeInTheDocument();expect(screen.queryByRole('button',{name:'常見問題'})).not.toBeInTheDocument();expect(screen.queryByText('0.00')).not.toBeInTheDocument();
});
it('资料加载失败仍可使用入口，局部重试成功后填入资料',async()=>{
 vi.mocked(loadAccountProfile).mockRejectedValueOnce(new Error('offline')).mockResolvedValue({uid:7,nickname:'Tester',avatarId:3,coins:12345});
 const records=setup();await screen.findByRole('button',{name:'重試'});
 fireEvent.click(screen.getByRole('button',{name:'存取記錄'}));expect(records).toHaveBeenCalledOnce();
 fireEvent.click(screen.getByRole('button',{name:'重試'}));expect(await screen.findByRole('heading',{name:'Tester'})).toBeVisible();expect(screen.getByText('123.45')).toBeVisible();
});
