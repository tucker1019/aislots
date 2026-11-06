import {ClaimBadge} from '../rewards/ClaimBadge';
import {AsyncAntButton as Button} from '../../components/buttons/AsyncButton';
import { overlayContainer } from '../../app/designViewport';
import {Input,Modal} from 'antd';
import { t } from '../../i18n';
import type { InviteChest } from '../../services/invite-details';
import { betMoney } from '../bet-records/money';

export function InviteChestModal({ chest, qualifiedCount, inviteUrl, pending, onClose, onCopy, onClaim }: {
  chest: InviteChest; qualifiedCount: number; inviteUrl: string; pending: boolean;
  onClose: () => void; onCopy: () => void; onClaim: () => void;
}) {
  return <Modal getContainer={overlayContainer} open centered width={360} title={t('server.inviteReward')} className="invite-chest-modal"
    onCancel={onClose} closable={!pending} maskClosable={!pending} keyboard={!pending}
    footer={<Button block type="primary" autoInsertSpace={false} loading={pending} disabled={pending}
      onClick={chest.status === 'claimable' ? onClaim : onClose}>
      {chest.status === 'claimable' ? t('copy.claim') : t('copy.gotIt')}<ClaimBadge active={chest.status==='claimable'&&chest.amount>0}/>
    </Button>}>
    <dl className="invite-chest-details">
      <div><dt>{t('invite.rewardAmount')}</dt><dd>{betMoney(chest.amount)}</dd></div>
      <div><dt>{t('copy.inviteFriends')}</dt><dd>{Math.min(qualifiedCount, chest.slot)} / {chest.slot}</dd></div>
    </dl>
    <label className="invite-chest-link-label" htmlFor="chest-invite-link">{t('invite.link')}</label>
    <div className="invite-chest-link"><Input id="chest-invite-link" readOnly value={inviteUrl} title={inviteUrl} /><Button onClick={onCopy}>{t('copy.copy')}</Button></div>
  </Modal>;
}
