import {beforeEach as authenticatedFixture} from 'vitest';
import {useSessionStore} from '../stores/session';
import type * as VipModule from './vip-details';
import type * as AccountModule from './account';
import { beforeEach, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, within, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { parseVipDetails, loadVipDetails, claimVipReward } from './vip-details';
import { loadAccountProfile } from './account';
import { VipPage } from '../pages/VipPage';
vi.mock('./vip-details', async original => ({ ...await original<typeof VipModule>(), loadVipDetails: vi.fn(), claimVipReward: vi.fn() }));
vi.mock('./account', async original => ({ ...await original<typeof AccountModule>(), loadAccountProfile: vi.fn() }));
const tier = {level:0,upgradeBet:0,upgradeRecharge:0,keepBet:0,keepRecharge:0,upgradeReward:0,weeklyReward:0,monthlyReward:0,birthdayReward:0,weeklyBet:0,weeklyRecharge:0,monthlyBet:0,monthlyRecharge:0};
const fixture = { activityDate:'2026-11-03',upgradeRewards:[],weekly:{rewardId:'',level:0,amount:0,status:'no_reward'},monthly:{rewardId:'',level:0,amount:0,status:'no_reward'}, levels: [tier,{...tier,level:1,upgradeBet:100},{...tier,level:2,upgradeBet:300000,upgradeReward:300,weeklyReward:200,monthlyReward:300}],state:{level:1,highestLevel:1,upgradeBet:20300,upgradeRecharge:0,status:'normal',protectionBet:0,protectionRecharge:0,protectionRequiredBet:0,protectionRequiredRecharge:0,protectionEnd:''},idleDays:30,protectionDays:15,timezone:'Asia/Shanghai'};
beforeEach(() => {vi.mocked(loadVipDetails).mockReset();vi.mocked(claimVipReward).mockReset();vi.mocked(loadAccountProfile).mockResolvedValue({uid:10000001,nickname:'小明',avatarId:1,coins:0});});
it('完整配置保留分單位，拒絕損壞、重復或缺少當前等級的配置', () => {
 expect(parseVipDetails(fixture).levels[2].weeklyReward).toBe(200);
 expect(() => parseVipDetails({...fixture,levels:[{...tier,weeklyReward:'200'}]})).toThrow();
 expect(() => parseVipDetails({...fixture,levels:[tier,tier]})).toThrow();
 expect(() => parseVipDetails({...fixture,state:{...fixture.state,level:9}})).toThrow();
});
function setup(tables=false) {
 const onBack=vi.fn(),onTables=vi.fn();
 render(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false,gcTime:0}}})}><VipPage tables={tables} onBack={onBack} onTables={onTables} /></QueryClientProvider>);
 return {onBack,onTables};
}
it('顯示真實等級和升級差額，切換等級僅查看對應權益', async () => {
 vi.mocked(loadVipDetails).mockResolvedValue(parseVipDetails(fixture));const {onTables}=setup();
 expect(await screen.findByText('小明')).toBeInTheDocument();expect(screen.getByText(/還需存款 0.00，有效流水 2,797.00/)).toBeInTheDocument();
 fireEvent.click(screen.getByRole('button',{name:'VIP2'}));expect(screen.getByRole('heading',{name:'VIP2 尊享特權'})).toBeInTheDocument();expect(screen.getByText('待解鎖')).toBeInTheDocument();
 fireEvent.click(screen.getByRole('button',{name:'VIP詳情'}));expect(onTables).toHaveBeenCalledOnce();
});
it('三張表逐等級展示服務端配置並高亮當前等級', async () => {
 vi.mocked(loadVipDetails).mockResolvedValue(parseVipDetails(fixture));setup(true);
 const region=await screen.findByRole('region',{name:'VIP福利'});
 expect(within(region).getAllByRole('row')).toHaveLength(4);expect(within(region).getByText('2.00')).toBeInTheDocument();
 expect(screen.getAllByRole('table')).toHaveLength(3);
});
it('接口失敗顯示重試，不展示偽造權益', async () => {
 vi.mocked(loadVipDetails).mockRejectedValue(new Error('network'));setup();expect(await screen.findByRole('alert')).toHaveTextContent('網絡異常，請重試');expect(screen.getByRole('button',{name:'重試'})).toBeEnabled();
});

it('真實待領獎勵可領，成功刷新為已領取，未解鎖等級不可領', async () => {
 const pending={rewardId:'upgrade-1',level:1,amount:300,status:'claimable'};
 const initial=parseVipDetails({...fixture,upgradeRewards:[pending]});
 vi.mocked(loadVipDetails).mockResolvedValueOnce(initial).mockResolvedValue({...initial,upgradeRewards:[{...pending,status:'claimed'}]});
 vi.mocked(claimVipReward).mockResolvedValue(300);setup();
 fireEvent.click(await screen.findByRole('button',{name:'晉級獎勵領取'}));
 expect(await screen.findByRole('button',{name:'晉級獎勵已領取'})).toBeDisabled();
 expect(claimVipReward).toHaveBeenCalledWith('upgrade','2026-11-03',expect.any(String),'upgrade-1');
 expect(screen.getByRole('status')).toHaveTextContent('已領取 3.00');
 expect(await screen.findByText('領取成功',{exact:true})).toBeInTheDocument();
 fireEvent.click(screen.getByRole('button',{name:'VIP2'}));expect(screen.getByRole('button',{name:'晉級獎勵等級權益'})).toBeDisabled();
});
it('丟失領取響應後重試保持相同請求ID，週期獎勵按獎勵所屬等級展示', async () => {
 const pending={rewardId:'week-previous',level:0,amount:200,status:'claimable'};
 vi.mocked(loadVipDetails).mockResolvedValue(parseVipDetails({...fixture,weekly:pending,monthly:{...pending,status:'claimed'}}));
 vi.mocked(claimVipReward).mockRejectedValue(new Error('timeout'));setup();
 await screen.findByText('小明');expect(screen.getByRole('button',{name:'周禮金等級權益'})).toBeDisabled();
 fireEvent.click(screen.getByRole('button',{name:'VIP0'}));expect(screen.getByRole('button',{name:'月禮金已領取'})).toBeDisabled();
 fireEvent.click(screen.getByRole('button',{name:'周禮金領取'}));
 await waitFor(()=>expect(screen.getByRole('button',{name:'周禮金領取'})).toBeEnabled());
 fireEvent.click(screen.getByRole('button',{name:'周禮金領取'}));
 await waitFor(()=>expect(claimVipReward).toHaveBeenCalledTimes(2));
 expect(vi.mocked(claimVipReward).mock.calls[1]).toEqual(vi.mocked(claimVipReward).mock.calls[0]);
});
it('跨級獎勵逐級領取，領取一級不影響另一級',async()=>{
 const rewards=[{rewardId:'level-1',level:1,amount:300,status:'claimable'},{rewardId:'level-2',level:2,amount:500,status:'claimable'}];
 const initial=parseVipDetails({...fixture,upgradeRewards:rewards});
 vi.mocked(loadVipDetails).mockResolvedValueOnce(initial).mockResolvedValue({...initial,upgradeRewards:[{...rewards[0],status:'claimed'},rewards[1]]});
 vi.mocked(claimVipReward).mockResolvedValue(300);setup();
 fireEvent.click(await screen.findByRole('button',{name:'晉級獎勵領取'}));expect(await screen.findByRole('button',{name:'晉級獎勵已領取'})).toBeDisabled();
 expect(claimVipReward).toHaveBeenCalledWith('upgrade','2026-11-03',expect.any(String),'level-1');
 fireEvent.click(screen.getByRole('button',{name:'VIP2'}));expect(screen.getByRole('button',{name:'晉級獎勵領取'})).toBeEnabled();
 fireEvent.click(screen.getByRole('button',{name:'晉級獎勵領取'}));await waitFor(()=>expect(claimVipReward).toHaveBeenCalledWith('upgrade','2026-11-03',expect.any(String),'level-2'));
});

authenticatedFixture(()=>useSessionStore.setState({session:{uid:7,sid:'a'.repeat(52),expiresAt:'2030-01-01T00:00:00Z'}}));
