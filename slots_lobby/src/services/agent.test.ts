import {expect,it} from 'vitest';
import {agentSummaryKeys,parseAgent} from './agent';
const summary=Object.fromEntries(agentSummaryKeys.map(k=>[k,0]));
it('validates integer cents, privacy-safe data shape and pagination',()=>{
 const data={summary,items:[],hasMore:false,from:'2026-11-04',to:'2026-11-05',timezone:'Asia/Shanghai',status:'preview',updatedAt:'',providers:['AG'],inviteUrl:'',account:'player'};
 expect(parseAgent(data).summary.claimable).toBe(0);
 expect(()=>parseAgent({...data,summary:{...summary,claimable:'10'}})).toThrow();
 expect(()=>parseAgent({...data,summary:{...summary,commission:Number.MAX_SAFE_INTEGER+1}})).toThrow();
 expect(()=>parseAgent({...data,items:[{uid:1}]})).toThrow();
});
