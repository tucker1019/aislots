import {afterEach,expect,it,vi} from 'vitest';
import {render,screen,fireEvent,act} from '@testing-library/react';
import {WalletBalance} from './WalletBalance';
afterEach(()=>vi.useRealTimers());
it('接口快速完成也至少鎖定0.5秒，連續點擊只發一個請求',async()=>{
 vi.useFakeTimers();const refresh=vi.fn().mockResolvedValue(undefined);render(<WalletBalance coins={123400} isFetching={false} onRefresh={refresh}/>);
 const button=screen.getByRole('button',{name:'刷新錢包餘額'});
 await act(async()=>{fireEvent.click(button);fireEvent.click(button);});
 expect(document.querySelectorAll('.wallet-loading-dots > span')).toHaveLength(3);
 expect(refresh).toHaveBeenCalledTimes(1);expect(button).toBeDisabled();expect(screen.getByLabelText('正在刷新錢包餘額')).toBeInTheDocument();
 await act(()=>vi.advanceTimersByTimeAsync(499));expect(button).toBeDisabled();
 await act(()=>vi.advanceTimersByTimeAsync(1));expect(button).toBeEnabled();expect(screen.getByLabelText('錢包餘額 1,234.00')).toBeInTheDocument();
});
it('接口超過0.5秒仍鎖定，回來後才恢復金額和按鈕',async()=>{
 vi.useFakeTimers();let finish:()=>void=()=>{};const refresh=vi.fn(()=>new Promise<void>(resolve=>{finish=resolve;}));render(<WalletBalance coins={100} isFetching={false} onRefresh={refresh}/>);
 const button=screen.getByRole('button',{name:'刷新錢包餘額'});await act(async()=>fireEvent.click(button));await act(()=>vi.advanceTimersByTimeAsync(3000));expect(button).toBeDisabled();
 await act(async()=>{finish();});expect(button).toBeEnabled();expect(screen.queryByLabelText('正在刷新錢包餘額')).not.toBeInTheDocument();
});
it('請求失敗也會在最短動畫結束後解鎖',async()=>{
 vi.useFakeTimers();const refresh=vi.fn().mockRejectedValue(new Error('network'));render(<WalletBalance coins={100} isFetching={false} onRefresh={refresh}/>);
 const button=screen.getByRole('button',{name:'刷新錢包餘額'});await act(async()=>fireEvent.click(button));expect(button).toBeDisabled();await act(()=>vi.advanceTimersByTimeAsync(500));expect(button).toBeEnabled();
});
