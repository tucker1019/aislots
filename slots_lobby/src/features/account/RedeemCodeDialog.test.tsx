import {beforeEach,expect,it,vi} from 'vitest';
import {fireEvent,render,screen,waitFor} from '@testing-library/react';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {RedeemCodeDialog} from './RedeemCodeDialog';
import {redeemCode} from '../../services/redeem-code';
import {t} from '../../i18n';

vi.mock('../../services/redeem-code',()=>({redeemCode:vi.fn()}));
beforeEach(()=>{vi.mocked(redeemCode).mockReset();Object.defineProperty(navigator,'clipboard',{configurable:true,value:{readText:vi.fn().mockResolvedValue('RC-TEST-CODE')}});});

it('粘贴兑换码并提交，成功后显示到账金额',async()=>{
 vi.mocked(redeemCode).mockResolvedValue({amount:1250,coins:5000});
 const onClose=vi.fn();
 render(<QueryClientProvider client={new QueryClient()}><RedeemCodeDialog onClose={onClose}/></QueryClientProvider>);
 fireEvent.click(screen.getByRole('button',{name:/粘\s*貼/}));
 const input=await screen.findByRole('textbox',{name:t('redeem.inputLabel')});
 await waitFor(()=>expect(input).toHaveValue('RC-TEST-CODE'));
 fireEvent.click(screen.getByRole('button',{name:t('redeem.submit')}));
 await waitFor(()=>expect(redeemCode).toHaveBeenCalledWith('RC-TEST-CODE'));
 expect(await screen.findByRole('status')).toHaveTextContent('Rp12');
 fireEvent.click(screen.getByRole('button',{name:t('redeem.done')}));
 expect(onClose).toHaveBeenCalledOnce();
});
