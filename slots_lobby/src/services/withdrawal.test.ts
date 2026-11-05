import {expect,it} from 'vitest';
import {parseWithdrawal,parseWithdrawalTurnover} from './withdrawal';
const order={orderId:'wdr_test',kind:'withdrawal',amount:5000,fee:150,bonus:0,creditAmount:4850,status:'pending',channel:'test1',account:'123',name:'測試',createdAt:'2026-11-04T00:00:00Z',settledAt:'',testMode:true};
it('取款到賬扣除手續費，贈送單獨記錄',()=>{expect(parseWithdrawal(order).creditAmount).toBe(4850);expect(parseWithdrawal({...order,amount:20000,fee:0,bonus:200,creditAmount:20000}).bonus).toBe(200);});
it('拒絕金額異常、費用贈送衝突和非取款訂單',()=>{for(const patch of [{creditAmount:5000},{fee:150,bonus:100},{amount:NaN},{amount:9007199254740992},{kind:'deposit'},{orderId:'deposit'},{testMode:undefined}])expect(()=>parseWithdrawal({...order,...patch})).toThrow();});

it('流水資格響應必須完整且與剩餘要求一致，不能把錯誤響應當0',()=>{expect(parseWithdrawalTurnover({remaining:0,canWithdraw:true})).toEqual({remaining:0,canWithdraw:true});expect(parseWithdrawalTurnover({remaining:126000,canWithdraw:false}).remaining).toBe(126000);for(const value of [{},{remaining:-1,canWithdraw:false},{remaining:100,canWithdraw:true},{remaining:0,canWithdraw:false}])expect(()=>parseWithdrawalTurnover(value)).toThrow();});
