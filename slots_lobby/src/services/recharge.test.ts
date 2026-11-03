import { expect, it } from 'vitest';
import { parseTiers } from './recharge';
it('充值金额必须是安全整数分，到账一致且赠送手续费互斥', () => {
 const tier={id:'a',amount:1000,bonus:0,fee:20,creditAmount:980};
 expect(parseTiers({items:[tier]})).toEqual([tier]);
 expect(parseTiers({items:[]})).toEqual([]);
 for(const value of [{...tier,amount:'1000'},{...tier,creditAmount:999},{...tier,bonus:20},{...tier,amount:Number.MAX_SAFE_INTEGER+1}]) expect(()=>parseTiers({items:[value]})).toThrow();
});
