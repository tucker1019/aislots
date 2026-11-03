import {beforeEach,expect,it,vi} from 'vitest';
import {render,screen,fireEvent,waitFor,act} from '@testing-library/react';
import {QueryClient,QueryClientProvider,focusManager} from '@tanstack/react-query';
import {InviteChests} from './InviteChests';
import {fetchInviteChests,claimInviteChest,parseChests,parseFriends} from '../../services/invite-details';
import type * as Details from '../../services/invite-details';
vi.mock('../../services/invite-details',async original=>({...await original<typeof Details>(),fetchInviteChests:vi.fn(),claimInviteChest:vi.fn()}));
const info={inviteUrl:'https://example.com/?inviteCode=ABC',supportUrl:'https://t.me/tucker881',rules:{version:'v1',durationDays:30,minDepositCount:5,minDepositAmount:50000,minBetAmount:500000,rewardAmount:20000,displayRows:10},invitedCount:3,qualifiedCount:2,pendingAmount:20000,claimedAmount:20000};
const data={info,page:1,hasMore:false,items:Array.from({length:100},(_,i)=>({slot:i+1,rewardId:i<2?String(11+i):'',amount:20000,status:i===0?'claimed' as const:i===1?'claimable' as const:'locked' as const}))};
beforeEach(()=>{vi.mocked(fetchInviteChests).mockReset();vi.mocked(claimInviteChest).mockReset();vi.mocked(fetchInviteChests).mockResolvedValue(data);});
function setup(){render(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false,gcTime:0}}})}><InviteChests/></QueryClientProvider>);}
it('显示100个宝箱，已领取和未达标禁用，只领取选中的奖励并弹成功toast',async()=>{
 vi.mocked(claimInviteChest).mockResolvedValue(20000);setup();await screen.findByText('我的直属下级 3 人，有效人数 2 人');expect(document.querySelectorAll('.invite-chest')).toHaveLength(100);expect(screen.getByRole('button',{name:'第 1 个宝箱，已领取'})).toBeDisabled();expect(screen.getByRole('button',{name:'第 3 个宝箱，未达标'})).toBeDisabled();fireEvent.click(screen.getByRole('button',{name:'第 2 个宝箱，可领取'}));await waitFor(()=>expect(claimInviteChest).toHaveBeenCalledWith('12',expect.any(String)));expect(await screen.findByText('领取成功',{exact:true})).toBeInTheDocument();
});
it('网络失败重试保留请求号，窗口切换不重新请求',async()=>{
 vi.mocked(claimInviteChest).mockRejectedValueOnce(new Error('lost response')).mockResolvedValue(20000);setup();const chest=await screen.findByRole('button',{name:'第 2 个宝箱，可领取'});fireEvent.click(chest);await screen.findByRole('alert');const id=vi.mocked(claimInviteChest).mock.calls[0][1];fireEvent.click(chest);await waitFor(()=>expect(claimInviteChest).toHaveBeenCalledTimes(2));expect(vi.mocked(claimInviteChest).mock.calls[1][1]).toBe(id);
});
it('规则和好友详情使用不同路由',async()=>{setup();await screen.findByText('好友详情 ›');fireEvent.click(screen.getByRole('button',{name:/好友详情/}));expect(location.pathname).toBe('/invite/friends');fireEvent.click(screen.getByRole('button',{name:/规则查看/}));expect(location.pathname).toBe('/invite');});
it('拒绝未知原因和错位宝箱，防止认错奖励',()=>{expect(()=>parseChests({...data,items:[{...data.items[0],slot:2},...data.items.slice(1)]})).toThrow();expect(()=>parseChests({...data,items:[...data.items.slice(0,1),{...data.items[1],rewardId:''},...data.items.slice(2)]})).toThrow();expect(()=>parseFriends({page:1,hasMore:false,items:[{uid:'1',account:'friend',registeredAt:new Date().toISOString(),reasons:['app_required']}]})).toThrow();});

it('切换窗口和恢复网络不自动刷新邀请',async()=>{setup();await screen.findByText('我的直属下级 3 人，有效人数 2 人');await act(async()=>{focusManager.setFocused(false);focusManager.setFocused(true);window.dispatchEvent(new Event('online'));});expect(fetchInviteChests).toHaveBeenCalledTimes(1);});
it('超过100个有效邀请可查看下一页宝箱，不截断奖励',async()=>{vi.mocked(fetchInviteChests).mockResolvedValueOnce({...data,hasMore:true,info:{...info,qualifiedCount:101}}).mockResolvedValueOnce({...data,page:2,items:data.items.map((item,i)=>({...item,slot:101+i,rewardId:i===0?'1000':'',status:i===0?'claimable':'locked'}))});setup();fireEvent.click(await screen.findByRole('button',{name:'下一页'}));expect(await screen.findByRole('button',{name:'第 101 个宝箱，可领取'})).toBeEnabled();expect(fetchInviteChests).toHaveBeenLastCalledWith(2,expect.any(AbortSignal));});

it('进入赚钱页邀请区和复制链接不产生重复消息容器key',async()=>{
 const errors=vi.spyOn(console,'error').mockImplementation(()=>{});
 Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:vi.fn().mockResolvedValue(undefined)}});
 try{setup();await screen.findByText('我的直属下级 3 人，有效人数 2 人');fireEvent.click(screen.getByRole('button',{name:'复制'}));expect(await screen.findByText('邀请链接已复制')).toBeInTheDocument();expect(errors.mock.calls.filter(call=>call.some(value=>String(value).includes('message-holder')))).toHaveLength(0);}finally{errors.mockRestore();}
});
