import {beforeEach,expect,it,vi} from 'vitest';
import {fireEvent,render,screen,waitFor} from '@testing-library/react';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {RedeemCodeDialog} from './RedeemCodeDialog';
import {redeemCode} from '../../services/redeem-code';
import {t} from '../../i18n';
import {betMoney} from '../bet-records/money';

vi.mock('../../services/redeem-code',()=>({redeemCode:vi.fn()}));
beforeEach(()=>{vi.mocked(redeemCode).mockReset();Object.defineProperty(navigator,'clipboard',{configurable:true,value:{readText:vi.fn().mockResolvedValue('RC-TEST-CODE')}});});

it('粘贴兑换码并提交，通过 toast 显示到账金额',async()=>{
 vi.mocked(redeemCode).mockResolvedValue({amount:1250,coins:5000,alreadyRedeemed:false});
 const onClose=vi.fn();
 render(<QueryClientProvider client={new QueryClient()}><RedeemCodeDialog onClose={onClose}/></QueryClientProvider>);
 fireEvent.click(screen.getByRole('button',{name:/粘\s*貼/}));
 const input=await screen.findByRole('textbox',{name:t('redeem.inputLabel')});
 await waitFor(()=>expect(input).toHaveValue('RC-TEST-CODE'));
 fireEvent.click(screen.getByRole('button',{name:t('redeem.submit')}));
 await waitFor(()=>expect(redeemCode).toHaveBeenCalledWith('RC-TEST-CODE'));
 expect(await screen.findByText(t('redeem.success',{amount:betMoney(1250)}))).toBeInTheDocument();
 expect(input).toHaveValue('');
 expect(onClose).not.toHaveBeenCalled();
});

it('重複兌換時通過錯誤 toast 提示已使用，不显示到账成功',async()=>{
 vi.mocked(redeemCode).mockResolvedValue({amount:1250,coins:5000,alreadyRedeemed:true});
 render(<QueryClientProvider client={new QueryClient()}><RedeemCodeDialog onClose={vi.fn()}/></QueryClientProvider>);
 fireEvent.change(await screen.findByRole('textbox',{name:t('redeem.inputLabel')}),{target:{value:'RC-TEST-CODE'}});
 fireEvent.click(screen.getByRole('button',{name:t('redeem.submit')}));
 expect(await screen.findByText(t('redeem.alreadyRedeemed'))).toBeInTheDocument();
 expect(screen.queryByText(t('redeem.success',{amount:betMoney(1250)}))).not.toBeInTheDocument();
});
