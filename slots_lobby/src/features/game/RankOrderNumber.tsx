import {message} from 'antd';
import {overlayContainer} from '../../app/designViewport';
import {t} from '../../i18n';

export function RankOrderNumber({betId}:{betId:string}) {
 const [toast,holder]=message.useMessage({getContainer:overlayContainer,maxCount:1,classNames:{list:'lobby-toast-list'}});
 async function copy() {
  try {
   await navigator.clipboard.writeText(betId);
   void toast.success(t('copy.copied'));
  } catch {
   void toast.error(t('copy.copyFailedPressAndHoldTheOrder'));
  }
 }
 return <div className="game-rank-order">
  {holder}
  <span>{t('copy.orderNumber')}</span>
  <svg className="game-rank-shield" width="13" height="15" viewBox="0 0 16 18" aria-hidden="true">
   <path d="M8 1 14.5 3.5V8c0 4.1-2.8 6.9-6.5 9C4.3 14.9 1.5 12.1 1.5 8V3.5L8 1Z" fill="currentColor"/>
   <path d="m4.8 8.8 2.1 2.1 4.3-4.4" fill="none" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
  <span className="game-rank-order-number" title={betId}>{betId}</span>
  <button type="button" aria-label={t('copy.copyOrderNumber')} onClick={()=>void copy()}>
   <svg width="15" height="15" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
    <rect x="6" y="6" width="10" height="11" rx="2"/><path d="M12 6V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h1"/>
   </svg>
  </button>
 </div>;
}
