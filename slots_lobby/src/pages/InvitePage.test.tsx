import {beforeEach,expect,it,vi,afterEach} from 'vitest';
import {render,screen,fireEvent,waitFor} from '@testing-library/react';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {InvitePage} from './InvitePage';
import {fetchInviteInfo,claimInvite,parseInviteInfo} from '../services/invite';
import type * as InviteModule from '../services/invite';
vi.mock('../services/invite',async original=>({...await original<typeof InviteModule>(),fetchInviteInfo:vi.fn(),claimInvite:vi.fn()}));
const info={inviteUrl:'https://example.com/?inviteCode=ABC',supportUrl:'https://t.me/tucker881',rules:{version:'v1',durationDays:30,minDepositCount:5,minDepositAmount:50000,minBetAmount:500000,rewardAmount:20000,displayRows:10},invitedCount:2,qualifiedCount:1,pendingAmount:20000,claimedAmount:0};
beforeEach(()=>{vi.mocked(fetchInviteInfo).mockReset();vi.mocked(claimInvite).mockReset();});afterEach(()=>vi.restoreAllMocks());
function setup(){render(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false,gcTime:0}}})}><InvitePage onBack={vi.fn()}/></QueryClientProvider>);}
it('規則和獎勵來自服務端，客服直接打開TG，複製專屬鏈接',async()=>{
 vi.mocked(fetchInviteInfo).mockResolvedValue({...info,rules:{...info.rules,rewardAmount:30000}});Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:vi.fn().mockResolvedValue(undefined)}});setup();expect(await screen.findByText('3,000.00')).toBeInTheDocument();expect(screen.getByRole('link',{name:'聯繫客服'})).toHaveAttribute('href','https://t.me/tucker881');expect(screen.getByText(/註冊30日內成功存款至少5次/)).toHaveTextContent('300.00');fireEvent.click(screen.getByRole('button',{name:'複製'}));await waitFor(()=>expect(navigator.clipboard.writeText).toHaveBeenCalledWith(info.inviteUrl));
});
it('僅介紹邀請規則，不顯示個人進度和領取入口，客服在邀請鏈接下方',async()=>{
 vi.mocked(fetchInviteInfo).mockResolvedValue(info);setup();await screen.findByRole('table');
 expect(screen.queryByRole('button',{name:'領取'})).not.toBeInTheDocument();expect(screen.queryByText('待領取獎勵')).not.toBeInTheDocument();expect(screen.queryByText('已邀請人數')).not.toBeInTheDocument();expect(screen.queryByText('累計已領取')).not.toBeInTheDocument();expect(claimInvite).not.toHaveBeenCalled();
 const support=screen.getByRole('link',{name:'聯繫客服'});expect(support.closest('.records-page-top')).toBeNull();expect(document.querySelector('.invite-link')?.nextElementSibling).toBe(support);
});
it('錯誤響應不作為有效頁面',()=>{
 expect(()=>parseInviteInfo({...info,inviteUrl:'javascript:alert(1)'})).toThrow();expect(()=>parseInviteInfo({...info,rules:{...info.rules,rewardAmount:-1}})).toThrow();
});
