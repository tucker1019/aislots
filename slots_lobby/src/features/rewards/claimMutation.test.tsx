import {useEffect} from 'react';
import {beforeEach,expect,it,vi} from 'vitest';
import {render,screen,fireEvent,waitFor,act} from '@testing-library/react';
import {useMutation,useQueryClient} from '@tanstack/react-query';
import {Providers} from '../../app/Providers';
import {useSessionStore} from '../../stores/session';
import {useClaimIndicators} from './useClaimIndicators';
import {indicatorKey} from './claimIndicators';
function Control({run}:{run:()=>Promise<number>}){
 const client=useQueryClient();const uid=useSessionStore(s=>s.session?.uid);
 const mutation=useMutation({meta:{claimUid:uid,claimIndicator:'checkin'},mutationFn:run,retry:false});
 const rewards=useClaimIndicators();
 useEffect(()=>{if(uid)client.setQueryData(indicatorKey(uid,'checkin'),{checkin:1});},[client,uid]);
 return <><button onClick={()=>mutation.mutate()}>request</button><output>{rewards.my?'available':'none'}:{mutation.status}</output></>;
}
beforeEach(()=>useSessionStore.setState({session:{uid:7,sid:'A'.repeat(52),expiresAt:'2030-01-01'}}));
it('失败不消红点，成功才消红点',async()=>{
 const run=vi.fn().mockRejectedValueOnce(new Error('network')).mockResolvedValueOnce(188);
 render(<Providers><Control run={run}/></Providers>);
 await screen.findByText('available:idle');fireEvent.click(screen.getByRole('button',{name:'request'}));
 await screen.findByText('available:error');fireEvent.click(screen.getByRole('button',{name:'request'}));
 await screen.findByText('none:success');expect(run).toHaveBeenCalledTimes(2);
});
it('领取期间切换账号，旧账号返回不能取消新账号红点',async()=>{
 let complete:(n:number)=>void=()=>{};const run=vi.fn(()=>new Promise<number>(resolve=>{complete=resolve;}));
 render(<Providers><Control run={run}/></Providers>);await screen.findByText('available:idle');
 fireEvent.click(screen.getByRole('button',{name:'request'}));await waitFor(()=>expect(run).toHaveBeenCalledTimes(1));
 await act(async()=>useSessionStore.setState({session:{uid:8,sid:'B'.repeat(52),expiresAt:'2030-01-01'}}));
 await act(async()=>complete(188));await screen.findByText('available:success');
});
