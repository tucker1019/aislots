import {expect,it} from 'vitest';
import {parseWithdrawal} from './withdrawal';
const order={orderId:'wdr_test',kind:'withdrawal',amount:5000,fee:150,bonus:0,creditAmount:4850,status:'pending',channel:'test1',account:'123',name:'测试',createdAt:'2026-11-04T00:00:00Z',settledAt:'',testMode:true};
it('取款到账扣除手续费，赠送单独记录',()=>{expect(parseWithdrawal(order).creditAmount).toBe(4850);expect(parseWithdrawal({...order,amount:20000,fee:0,bonus:200,creditAmount:20000}).bonus).toBe(200);});
it('拒绝金额异常、费用赠送冲突和非取款订单',()=>{for(const patch of [{creditAmount:5000},{fee:150,bonus:100},{amount:NaN},{amount:9007199254740992},{kind:'deposit'},{orderId:'deposit'},{testMode:undefined}])expect(()=>parseWithdrawal({...order,...patch})).toThrow();});
