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
it('规则和奖励来自服务端，客服直接打开TG，复制专属链接',async()=>{
 vi.mocked(fetchInviteInfo).mockResolvedValue({...info,rules:{...info.rules,rewardAmount:30000}});Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:vi.fn().mockResolvedValue(undefined)}});setup();expect(await screen.findByText('3,000.00')).toBeInTheDocument();expect(screen.getByRole('link',{name:'联系客服'})).toHaveAttribute('href','https://t.me/tucker881');expect(screen.getByText(/注册30日内成功存款至少5次/)).toHaveTextContent('300.00');fireEvent.click(screen.getByRole('button',{name:'复制'}));await waitFor(()=>expect(navigator.clipboard.writeText).toHaveBeenCalledWith(info.inviteUrl));
});
it('仅介绍邀请规则，不显示个人进度和领取入口，客服在邀请链接下方',async()=>{
 vi.mocked(fetchInviteInfo).mockResolvedValue(info);setup();await screen.findByRole('table');
 expect(screen.queryByRole('button',{name:'领取'})).not.toBeInTheDocument();expect(screen.queryByText('待领取奖励')).not.toBeInTheDocument();expect(screen.queryByText('已邀请人数')).not.toBeInTheDocument();expect(screen.queryByText('累计已领取')).not.toBeInTheDocument();expect(claimInvite).not.toHaveBeenCalled();
 const support=screen.getByRole('link',{name:'联系客服'});expect(support.closest('.records-page-top')).toBeNull();expect(document.querySelector('.invite-link')?.nextElementSibling).toBe(support);
});
it('错误响应不作为有效页面',()=>{
 expect(()=>parseInviteInfo({...info,inviteUrl:'javascript:alert(1)'})).toThrow();expect(()=>parseInviteInfo({...info,rules:{...info.rules,rewardAmount:-1}})).toThrow();
});
