import {afterEach,expect,it,vi} from 'vitest';
import {render,screen,fireEvent,act} from '@testing-library/react';
import {WalletBalance} from './WalletBalance';
afterEach(()=>vi.useRealTimers());
it('接口快速完成也至少锁定0.5秒，连续点击只发一个请求',async()=>{
 vi.useFakeTimers();const refresh=vi.fn().mockResolvedValue(undefined);render(<WalletBalance coins={123400} isFetching={false} onRefresh={refresh}/>);
 const button=screen.getByRole('button',{name:'刷新钱包余额'});
 await act(async()=>{fireEvent.click(button);fireEvent.click(button);});
 expect(document.querySelectorAll('.wallet-loading-dots > span')).toHaveLength(3);
 expect(refresh).toHaveBeenCalledTimes(1);expect(button).toBeDisabled();expect(screen.getByLabelText('正在刷新钱包余额')).toBeInTheDocument();
 await act(()=>vi.advanceTimersByTimeAsync(499));expect(button).toBeDisabled();
 await act(()=>vi.advanceTimersByTimeAsync(1));expect(button).toBeEnabled();expect(screen.getByLabelText('钱包余额 1,234.00')).toBeInTheDocument();
});
it('接口超过0.5秒仍锁定，回来后才恢复金额和按钮',async()=>{
 vi.useFakeTimers();let finish:()=>void=()=>{};const refresh=vi.fn(()=>new Promise<void>(resolve=>{finish=resolve;}));render(<WalletBalance coins={100} isFetching={false} onRefresh={refresh}/>);
 const button=screen.getByRole('button',{name:'刷新钱包余额'});await act(async()=>fireEvent.click(button));await act(()=>vi.advanceTimersByTimeAsync(3000));expect(button).toBeDisabled();
 await act(async()=>{finish();});expect(button).toBeEnabled();expect(screen.queryByLabelText('正在刷新钱包余额')).not.toBeInTheDocument();
});
it('请求失败也会在最短动画结束后解锁',async()=>{
 vi.useFakeTimers();const refresh=vi.fn().mockRejectedValue(new Error('network'));render(<WalletBalance coins={100} isFetching={false} onRefresh={refresh}/>);
 const button=screen.getByRole('button',{name:'刷新钱包余额'});await act(async()=>fireEvent.click(button));expect(button).toBeDisabled();await act(()=>vi.advanceTimersByTimeAsync(500));expect(button).toBeEnabled();
});
