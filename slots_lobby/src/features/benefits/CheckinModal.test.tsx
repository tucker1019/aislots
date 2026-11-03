import { beforeEach, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CheckinModal } from './CheckinModal';
import { claimCheckin, loadCheckinInfo } from '../../services/checkin';
vi.mock('../../services/checkin',()=>({claimCheckin:vi.fn(),loadCheckinInfo:vi.fn()}));
const current={day:1,reward:188,requiredBet:6800,requiredRecharge:1000};
const info={activityDate:'2026-11-03',currentDay:1,claimed:false,canClaim:true,validBet:25320,rechargeAmount:1000,days:Array.from({length:7},(_,i)=>({...current,day:i+1})),current};
beforeEach(()=>{vi.mocked(loadCheckinInfo).mockReset();vi.mocked(claimCheckin).mockReset();});
function setup(){const client=new QueryClient({defaultOptions:{queries:{retry:false,gcTime:0}}});render(<QueryClientProvider client={client}><CheckinModal onClose={vi.fn()} /></QueryClientProvider>);}
it('按真实天数排奖励，领取使用服务端日期并禁止重复点击',async()=>{
 vi.mocked(loadCheckinInfo).mockResolvedValue(info);vi.mocked(claimCheckin).mockResolvedValue(188);setup();
 const button=await screen.findByRole('button',{name:'立即签到'});expect(screen.getAllByLabelText(/第\d天，奖励/)).toHaveLength(7);
 fireEvent.click(button);await waitFor(()=>expect(claimCheckin).toHaveBeenCalledWith('2026-11-03',expect.anything()));
 expect(await screen.findByRole('button',{name:'今日已签到'})).toBeDisabled();expect(await screen.findByText('签到成功，获得 1.88')).toBeInTheDocument();expect(await screen.findByText('领取成功',{exact:true})).toBeInTheDocument();
});
it('条件不足不能领取',async()=>{vi.mocked(loadCheckinInfo).mockResolvedValue({...info,canClaim:false});setup();expect(await screen.findByRole('button',{name:'完成充值与投注条件后签到'})).toBeDisabled();expect(claimCheckin).not.toHaveBeenCalled();});
it('失败可重试原日期',async()=>{vi.mocked(loadCheckinInfo).mockResolvedValue(info);vi.mocked(claimCheckin).mockRejectedValue(new Error('失败'));setup();fireEvent.click(await screen.findByRole('button',{name:'立即签到'}));expect(await screen.findByRole('alert')).toHaveTextContent('失败');expect(screen.queryByText('领取成功',{exact:true})).not.toBeInTheDocument();expect(screen.getByRole('button',{name:'立即签到'})).toBeEnabled();});
