import {beforeEach as authenticatedFixture} from 'vitest';
import {useSessionStore} from '../../stores/session';
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
it('顯示100個寶箱，已領取禁用，未達標可查看進度，只領取選中的獎勵並彈成功toast',async()=>{
 vi.mocked(claimInviteChest).mockResolvedValue(20000);setup();await screen.findByText('我的直屬下級 3 人，有效人數 2 人');expect(document.querySelectorAll('.invite-chest')).toHaveLength(100);expect(screen.queryByText('已領取',{exact:true})).not.toBeInTheDocument();expect(screen.queryByText('未達標',{exact:true})).not.toBeInTheDocument();expect(document.querySelectorAll('.invite-chest-check')).toHaveLength(1);expect(document.querySelector('.invite-chest.is-claimed img')).toHaveAttribute('src','/assets/lobby/chests/claimed.webp');expect(document.querySelector('.invite-chest.is-claimable img')).toHaveAttribute('src','/assets/lobby/chests/claimable.webp');expect(document.querySelector('.invite-chest.is-locked img')).toHaveAttribute('src','/assets/lobby/chests/locked.webp');expect(screen.getByRole('button',{name:'第 1 個寶箱，已領取'})).toBeDisabled();expect(screen.getByRole('button',{name:'第 3 個寶箱，未達標'})).toBeEnabled();fireEvent.click(screen.getByRole('button',{name:'第 2 個寶箱，可領取'}));fireEvent.click(await screen.findByRole('button',{name:'領取'}));await waitFor(()=>expect(claimInviteChest).toHaveBeenCalledWith('12',expect.any(String)));expect(await screen.findByText('領取成功',{exact:true})).toBeInTheDocument();
});
it('網絡失敗重試保留請求號，窗口切換不重新請求',async()=>{
 vi.mocked(claimInviteChest).mockRejectedValueOnce(new Error('lost response')).mockResolvedValue(20000);setup();const chest=await screen.findByRole('button',{name:'第 2 個寶箱，可領取'});fireEvent.click(chest);fireEvent.click(await screen.findByRole('button',{name:'領取'}));await waitFor(()=>expect(screen.getByRole('button',{name:'領取'})).toBeEnabled());const id=vi.mocked(claimInviteChest).mock.calls[0][1];fireEvent.click(screen.getByRole('button',{name:'領取'}));await waitFor(()=>expect(claimInviteChest).toHaveBeenCalledTimes(2));expect(vi.mocked(claimInviteChest).mock.calls[1][1]).toBe(id);
});
it('規則和好友詳情使用不同路由',async()=>{setup();await screen.findByText('好友詳情 ›');fireEvent.click(screen.getByRole('button',{name:/好友詳情/}));expect(location.pathname).toBe('/invite/friends');fireEvent.click(screen.getByRole('button',{name:/規則查看/}));expect(location.pathname).toBe('/invite');});
it('拒絕未知原因和錯位寶箱，防止認錯獎勵',()=>{expect(()=>parseChests({...data,items:[{...data.items[0],slot:2},...data.items.slice(1)]})).toThrow();expect(()=>parseChests({...data,items:[...data.items.slice(0,1),{...data.items[1],rewardId:''},...data.items.slice(2)]})).toThrow();expect(()=>parseFriends({page:1,hasMore:false,items:[{uid:'1',account:'friend',registeredAt:new Date().toISOString(),reasons:['app_required']}]})).toThrow();});

it('切換窗口和恢復網絡不自動刷新邀請',async()=>{setup();await screen.findByText('我的直屬下級 3 人，有效人數 2 人');await act(async()=>{focusManager.setFocused(false);focusManager.setFocused(true);window.dispatchEvent(new Event('online'));});expect(fetchInviteChests).toHaveBeenCalledTimes(1);});
it('超過100個有效邀請可查看下一頁寶箱，不截斷獎勵',async()=>{vi.mocked(fetchInviteChests).mockResolvedValueOnce({...data,hasMore:true,info:{...info,qualifiedCount:101}}).mockResolvedValueOnce({...data,page:2,items:data.items.map((item,i)=>({...item,slot:101+i,rewardId:i===0?'1000':'',status:i===0?'claimable':'locked'}))});setup();fireEvent.click(await screen.findByRole('button',{name:'下一頁'}));expect(await screen.findByRole('button',{name:'第 101 個寶箱，可領取'})).toBeEnabled();expect(fetchInviteChests).toHaveBeenLastCalledWith(2,expect.any(AbortSignal));});

it('進入賺錢頁邀請區和複製鏈接不產生重復消息容器key',async()=>{
 const errors=vi.spyOn(console,'error').mockImplementation(()=>{});
 Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:vi.fn().mockResolvedValue(undefined)}});
 try{setup();await screen.findByText('我的直屬下級 3 人，有效人數 2 人');fireEvent.click(screen.getByRole('button',{name:'複製'}));expect(await screen.findByText('邀請鏈接已複製')).toBeInTheDocument();expect(errors.mock.calls.filter(call=>call.some(value=>String(value).includes('message-holder')))).toHaveLength(0);}finally{errors.mockRestore();}
});

it('未達標寶箱顯示獎勵和有效邀請進度，不發起領取',async()=>{setup();fireEvent.click(await screen.findByRole('button',{name:'第 3 個寶箱，未達標'}));expect(await screen.findByRole('dialog',{name:'邀請獎勵'})).toBeInTheDocument();expect(screen.getByText('2 / 3')).toBeInTheDocument();expect(claimInviteChest).not.toHaveBeenCalled();fireEvent.click(screen.getByRole('button',{name:'知道了'}));await waitFor(()=>expect(screen.queryByRole('dialog')).not.toBeInTheDocument());});

authenticatedFixture(()=>useSessionStore.setState({session:{uid:7,sid:'a'.repeat(52),expiresAt:'2030-01-01T00:00:00Z'}}));
