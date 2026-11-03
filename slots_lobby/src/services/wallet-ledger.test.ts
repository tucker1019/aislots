import { expect,it } from 'vitest';
import { parseLedgerItem } from './wallet-ledger';
it('账变允许负金额，但拒绝错误金额与日期',()=>{
 const row={id:'1',orderId:'a',type:'AG 投注',currency:'IDR',amount:-100,balance:500,createdAt:'2026-11-03T01:00:00Z',remark:'AG 投注'};
 expect(parseLedgerItem(row).amount).toBe(-100);
 for(const patch of [{amount:'100'},{balance:-1},{createdAt:'bad'}])expect(()=>parseLedgerItem({...row,...patch})).toThrow();
});
