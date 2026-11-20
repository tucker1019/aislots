import {expect,it} from 'vitest';
import {parseRebate} from './rebate';

const preview={reward:200,availableAt:'2026-06-02T00:00:00+07:00'};
const claim={reward:100,periodStart:'2026-05-31',periodEnd:'2026-06-01',status:'claimable'};
const payload={activityDate:'2026-06-01',timezone:'Asia/Jakarta',claimableTotal:600,platforms:[],daily:{preview,claim},weekly:{preview,claim:{...claim,reward:200,periodStart:'2026-05-25'}},monthly:{preview,claim:{...claim,reward:300,periodStart:'2026-05-01'}}};

it('keeps server source periods, status and amounts separate from future estimates',()=>{
 const info=parseRebate(payload);
 expect(info.claimableTotal).toBe(600);
 expect(info.daily.claim).toEqual(claim);
 expect(info.weekly.claim?.reward).toBe(200);
 expect(info.monthly.claim?.periodStart).toBe('2026-05-01');
 expect(info.daily.reward).toBe(200);
});
it('accepts no-reward, expired and claimed periods without treating them as claimable',()=>{
 for(const status of ['no_reward','claimed','expired'])expect(parseRebate({...payload,daily:{preview,claim:{...claim,status}}}).daily.claim?.status).toBe(status);
});
it('rejects malformed settlement data and never invents details for absent claims',()=>{
 for(const bad of [{reward:-1},{reward:1.5},{periodStart:'yesterday'},{status:'unknown'}])expect(()=>parseRebate({...payload,daily:{preview,claim:{...claim,...bad}}})).toThrow();
 expect(parseRebate({...payload,daily:{preview}}).daily.claim).toBeUndefined();
});
