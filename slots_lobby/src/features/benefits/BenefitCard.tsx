import {ClaimBadge} from '../rewards/ClaimBadge';
import {AsyncButton} from '../../components/buttons/AsyncButton';
import { Icon } from '../../components/Icon';
import type { IconName } from '../../components/Icon';
interface Props { title: string; icon: IconName; tone: string; value?: string; description: string; action: string; disabled?: boolean; loading?:boolean; claimable?:boolean; onAction: () => void }
export function BenefitCard({ title, icon, tone, value, description, action, disabled, loading, claimable, onAction }: Props) {
  return <article className="benefit-card"><header><span className={`benefit-icon benefit-icon-${tone}`}><Icon name={icon} size={21} /></span><h2>{title}</h2>{value && <strong>{value}</strong>}</header><div className="benefit-card-bottom"><p>{description}</p><AsyncButton className="claim-badge-anchor" loading={loading} type="button" disabled={disabled} onClick={onAction}>{action}<ClaimBadge active={!!claimable}/></AsyncButton></div></article>;
}
