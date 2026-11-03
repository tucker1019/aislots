import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Icon } from '../components/Icon';
import { useAccountProfile } from '../features/account/useAccountProfile';
import { useSessionStore } from '../stores/session';
import { loadVipDetails, type VipDetails } from '../services/vip-details';
import { VipPerks } from '../features/vip/VipPerks';
import { VipCarousel } from '../features/vip/VipCarousel';
import { VipTables } from '../features/vip/VipTables';
import { betMoney } from '../features/bet-records/money';
function VipOverview({ info }: { info: VipDetails }) {
  const profile = useAccountProfile();
  const track = useRef<HTMLElement>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const {state,levels} = info;
  const tier = levels.find(row => row.level === selected) ?? levels.find(row => row.level === state.level)!;
  useEffect(() => {
    const element = track.current;
    const active = element?.querySelector<HTMLElement>('[aria-pressed=true]');
    if (element && active) element.scrollLeft = Math.max(0, active.offsetLeft - element.offsetLeft - (element.clientWidth - active.offsetWidth) / 2);
  }, [tier.level]);
  const next = levels.find(row => row.level > state.level);
  return <div className="vip-overview">
    <section className="vip-profile"><div><strong>{profile.data?.nickname ?? '我的账户'}</strong><small>用户名</small></div>{profile.data && <img src={`/assets/profile/avatar/${profile.data.avatarId}.png`} alt="用户头像" width={62} height={62} />}<div><strong><Icon name="crown" size={17} /> VIP{state.level}</strong><small>当前等级</small></div></section>
    <nav ref={track} className="vip-level-track" aria-label="选择VIP等级">{levels.map(row => <button type="button" key={row.level} aria-pressed={tier.level === row.level} onClick={() => setSelected(row.level)}><span aria-hidden="true" />VIP{row.level}</button>)}</nav>
    <p className="vip-next">{state.status === 'protecting' ? '保级期间先完成保级任务，成功后继续累计升级进度。' : next ? `距离解锁 VIP${next.level}，还需存款 ${betMoney(Math.max(0,next.upgradeRecharge-state.upgradeRecharge))}，有效流水 ${betMoney(Math.max(0,next.upgradeBet-state.upgradeBet))}` : '已达到最高VIP等级'}</p>
    <VipCarousel levels={levels} selected={tier.level} current={state.level} highest={state.highestLevel} onSelect={setSelected} />
    {state.status === 'protecting' && <section className="vip-protection"><h2>当前保级进度</h2><p>存款 {betMoney(state.protectionRecharge)} / {betMoney(state.protectionRequiredRecharge)}</p><p>有效流水 {betMoney(state.protectionBet)} / {betMoney(state.protectionRequiredBet)}</p>{state.protectionEnd && <p>截止时间：{new Date(state.protectionEnd).toLocaleString('zh-CN')}</p>}</section>}
    <h2 className="vip-section-title">VIP{tier.level} 尊享特权</h2><VipPerks info={info} tier={tier} />
    <section className="vip-rules"><h2>VIP条款与规则</h2><p><strong>晋级标准：</strong>累计有效投注流水和存款同时达到配置条件后晋级，数据以服务端统计为准。</p><p><strong>晋级礼金：</strong>每个等级的晋级礼金仅可领取一次，已解锁权益金额与当前待领金额分别计算。</p><p><strong>周／月礼金：</strong>需满足对应周期的存款与有效流水要求，周期结算后按服务端规定时间领取，同一周期仅可领取一次。查看上方“VIP详情”可核对各等级条件。</p><p><strong>保级规则：</strong>连续 {info.idleDays} 天无活动进入 {info.protectionDays} 天保级期。进入时升级进度清零；成功后保级期累计全部计入升级进度，失败则降级并清零本次进度。</p><p>统计时区：{info.timezone}。礼金金额和领取资格以服务端实际结算为准。</p></section>
  </div>;
}
export function VipPage({ tables, onBack, onTables }: { tables: boolean; onBack: () => void; onTables: () => void }) {
  const uid = useSessionStore(state => state.session?.uid);
  const query = useQuery({queryKey:['lobby','vip-details',uid],queryFn:({signal}) => loadVipDetails(signal),retry:false,staleTime:15000});
  return <section className="vip-page benefits-page"><header className="benefits-heading"><button type="button" aria-label={tables ? '返回我的VIP' : '返回福利中心'} onClick={onBack}><Icon name="chevron" size={20} /></button><h1>{tables ? 'VIP详情' : '我的VIP'}</h1>{!tables && <button type="button" className="vip-details-link" onClick={onTables}>VIP详情</button>}</header>{query.isPending ? <p className="benefits-feedback" role="status">正在加载VIP详情…</p> : query.isError || !query.data ? <div className="benefits-feedback" role="alert"><p>VIP详情加载失败</p><button type="button" disabled={query.isFetching} onClick={() => void query.refetch()}>重试</button></div> : tables ? <VipTables levels={query.data.levels} current={query.data.state.level} /> : <VipOverview info={query.data} />}</section>;
}
