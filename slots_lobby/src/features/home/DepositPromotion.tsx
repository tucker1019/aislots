import { Modal } from 'antd';
import { overlayContainer } from '../../app/designViewport';
import { navigateLobby } from '../../app/useLobbyRoute';
import { t, useLanguageStore } from '../../i18n';
import { useSessionStore } from '../../stores/session';
import { Icon } from '../../components/Icon';
import { useDepositBonus } from '../deposit/useDepositBonusLabel';
import '../../styles/deposit-promotion.css';

export function DepositPromotion({ open, onClose, afterClose }: { open: boolean; onClose: () => void; afterClose: () => void }) {
  useLanguageStore(state => state.locale);
  const uid = useSessionStore(state => state.session?.uid);
  const { percent, pending } = useDepositBonus(uid, open);
  const heading = t('depositPromotion.title');

  return <Modal open={open} onCancel={onClose} afterClose={afterClose} title={<span className="deposit-promotion-sr">{heading}</span>}
    closable={false} footer={null} centered width={344} getContainer={overlayContainer}
    className="deposit-promotion-modal" destroyOnHidden>
    <div className="deposit-promotion-card">
      <div className="deposit-promotion-decoration" aria-hidden="true">
        <i /><i /><i />
      </div>
      <p className="deposit-promotion-kicker" aria-hidden={!percent}>{t('depositPromotion.topBonus')}</p>
      <h2 className="deposit-promotion-title">{percent ? t('depositPromotion.offerHeading') : heading}</h2>
      <div className="deposit-promotion-value" aria-busy={pending} aria-live="polite">
        {percent ? <strong className={`deposit-promotion-percent${percent.length > 5 ? ' deposit-promotion-percent-long' : ''}`}>{percent}</strong>
          : pending ? <span className="deposit-promotion-placeholder" role="status" aria-label={t('copy.loading')} />
          : <Icon name="rupiah" size={70} />}
      </div>
      <button type="button" className="deposit-promotion-cta" onClick={() => {
        onClose();
        navigateLobby('deposit');
      }}>{t('depositPromotion.deposit')} <span aria-hidden="true">→</span></button>
    </div>
    <button type="button" className="deposit-promotion-close" aria-label={t('depositPromotion.close')} onClick={onClose}>
      <Icon name="close" size={24} />
    </button>
  </Modal>;
}
