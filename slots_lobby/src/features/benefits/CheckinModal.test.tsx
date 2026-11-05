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
it('按真實天數排獎勵，領取使用服務端日期並禁止重復點擊',async()=>{
 vi.mocked(loadCheckinInfo).mockResolvedValue(info);vi.mocked(claimCheckin).mockResolvedValue(188);setup();
 const button=await screen.findByRole('button',{name:'立即簽到'});expect(screen.getAllByLabelText(/第\d天，獎勵/)).toHaveLength(7);
 fireEvent.click(button);await waitFor(()=>expect(claimCheckin).toHaveBeenCalledWith('2026-11-03',expect.anything()));
 expect(await screen.findByRole('button',{name:'今日已簽到'})).toBeDisabled();expect(screen.queryByText(/簽到成功，獲得/)).not.toBeInTheDocument();expect(await screen.findByText('領取成功',{exact:true})).toBeInTheDocument();
});
it('條件不足不能領取',async()=>{vi.mocked(loadCheckinInfo).mockResolvedValue({...info,canClaim:false});setup();expect(await screen.findByRole('button',{name:'完成充值與投注條件後簽到'})).toBeDisabled();expect(claimCheckin).not.toHaveBeenCalled();});
it('失敗可重試原日期',async()=>{vi.mocked(loadCheckinInfo).mockResolvedValue(info);vi.mocked(claimCheckin).mockRejectedValue(new Error('失敗'));setup();fireEvent.click(await screen.findByRole('button',{name:'立即簽到'}));expect(await screen.findByRole('alert')).toHaveTextContent('失敗');expect(screen.queryByText('領取成功',{exact:true})).not.toBeInTheDocument();expect(screen.getByRole('button',{name:'立即簽到'})).toBeEnabled();});
