import { t } from '../../i18n';
import { Modal, Progress } from 'antd';
import type { VipOverview } from '../../services/benefits';
import { betMoney } from '../bet-records/money';
function UpgradeProgress({label,current,required}:{label:string;current:number;required:number}) {
 const percent=required===0?100:Math.min(100,current/required*100);
 return <div className="vip-upgrade-progress"><div><span>{label}</span><span><b>{betMoney(current)}</b> / {betMoney(required)}</span></div><Progress percent={percent} showInfo={false} size="small" aria-label={label} /></div>;
}
export function VipUpgradeModal({info,onClose,onHome}:{info:VipOverview;onClose:()=>void;onHome:()=>void}) {
 const max=info.nextBet===null;
 return <Modal open centered footer={null} closable={false} title={null} width={400} onCancel={onClose} className="vip-upgrade-modal">
  <section className="vip-upgrade-panel" aria-label={t('copy.vipUpgradeRequirements')}><h2>{max?t('copy.highestVipLevelReached'):t('copy.vipValueUpgradeRequirements', {p0: info.level+1})}</h2><div className="vip-upgrade-body">
   {info.protecting?<p className="vip-upgrade-notice">{t('copy.completeLevelProtectionBeforeContinuingToEarn')}</p>:max?<p className="vip-upgrade-notice">{t('copy.youHaveReachedTheHighestVipLevel')}</p>:<><UpgradeProgress label={t('copy.eligibleTurnover')} current={info.upgradeBet} required={info.nextBet??0}/>{info.nextRecharge!==null&&info.nextRecharge>0&&<UpgradeProgress label={t('copy.depositAmount')} current={info.upgradeRecharge} required={info.nextRecharge}/>}</>}
   <button className="vip-upgrade-home" type="button" onClick={onHome}>{t('copy.earnTurnover')}</button>
  </div></section><button type="button" className="vip-upgrade-close" aria-label={t('copy.closeUpgradeRequirements')} onClick={onClose}>×</button>
 </Modal>;
}
