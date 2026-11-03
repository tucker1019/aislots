import { beforeEach, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WalletManagement } from './WalletManagement';
import { loadWalletAccounts, saveWalletAccount } from '../../services/wallet-accounts';
vi.mock('../../services/wallet-accounts',()=>({loadWalletAccounts:vi.fn(),saveWalletAccount:vi.fn()}));
const rows=[{channel:'test1',account:'',name:'',bound:false},{channel:'test2',account:'222',name:'李四',bound:true}];
beforeEach(()=>{vi.mocked(loadWalletAccounts).mockReset().mockResolvedValue(rows);vi.mocked(saveWalletAccount).mockReset();});
function setup(){return render(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false,gcTime:0}}})}><WalletManagement onBack={vi.fn()}/></QueryClientProvider>);}
it('binds, shows validation and saves a channel without clearing an existing channel',async()=>{
 const user=userEvent.setup();setup();await user.click(await screen.findByRole('button',{name:/test1/}));
 await user.click(screen.getByRole('button',{name:/保\s*存/}));await waitFor(()=>expect(screen.getByText('请输入收款账号')).toBeVisible());expect(saveWalletAccount).not.toHaveBeenCalled();
 await user.type(screen.getByLabelText('收款账号'),'00123');await user.type(screen.getByLabelText('姓名'),'张三');
 vi.mocked(saveWalletAccount).mockResolvedValue({channel:'test1',account:'00123',name:'张三',bound:true});
 await user.click(screen.getByRole('button',{name:/保\s*存/}));await waitFor(()=>expect(saveWalletAccount).toHaveBeenCalledWith({channel:'test1',account:'00123',name:'张三'},expect.anything()));
 expect(await screen.findByRole('button',{name:/test2/})).toBeVisible();
});
it('prefills bound values and keeps input on a failed save',async()=>{
 const user=userEvent.setup();vi.mocked(saveWalletAccount).mockRejectedValue(new Error('offline'));setup();
 await user.click(await screen.findByRole('button',{name:/test2/}));expect(screen.getByLabelText('收款账号')).toHaveValue('222');expect(screen.getByLabelText('姓名')).toHaveValue('李四');
 await user.clear(screen.getByLabelText('姓名'));await user.type(screen.getByLabelText('姓名'),'王五');await user.click(screen.getByRole('button',{name:/保\s*存/}));
 expect(await screen.findByRole('alert')).toHaveTextContent('保存失败');expect(screen.getByLabelText('姓名')).toHaveValue('王五');
});
it('retries failed list loading',async()=>{
 const user=userEvent.setup();vi.mocked(loadWalletAccounts).mockRejectedValueOnce(new Error('offline'));setup();await user.click(await screen.findByRole('button',{name:/重\s*试/}));expect(await screen.findByRole('button',{name:/test1/})).toBeVisible();
});
