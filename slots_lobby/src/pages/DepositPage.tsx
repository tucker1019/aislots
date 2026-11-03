import { useQuery } from '@tanstack/react-query';
import { useAccountProfile } from '../features/account/useAccountProfile';
import { fetchRechargeTiers } from '../services/recharge';
import { DepositForm } from '../features/deposit/DepositForm';
export function DepositPage() {
 const profile=useAccountProfile();
 const tiers=useQuery({queryKey:['recharge-tiers',profile.data?.uid],enabled:!!profile.data,queryFn:({signal})=>fetchRechargeTiers(signal),retry:false});
 return <section className="deposit-page" aria-label="存款页面"><div className="deposit-heading"><span>钱包服务</span><h1>存款</h1><p>选择金额，查看本次实际到账。</p></div>
  <p className="deposit-test-notice">当前为测试支付通道，创建订单约3秒后自动模拟到账，无需实际付款。</p>
  {profile.isPending||(!profile.isError&&tiers.isPending)?<p role="status">正在加载存款档位…</p>:profile.isError||tiers.isError?<section className="deposit-card" role="alert"><p>存款信息加载失败，请重试。</p><button type="button" disabled={profile.isFetching||tiers.isFetching} onClick={()=>{if(profile.isError)void profile.refetch();else void tiers.refetch();}}>重新加载</button></section>:!tiers.data?.length?<section className="deposit-card"><h2>暂无可用存款档位</h2><p>请稍后再来看看。</p></section>:profile.data&&<DepositForm key={profile.data.uid} uid={profile.data.uid} tiers={tiers.data} />}
 </section>;
}
