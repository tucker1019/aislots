import { Brand } from './Brand';
import { UserSummary } from '../features/account/UserSummary';

export function Header() {
  return <header className="site-header">
    <div className="header-inner">
      <Brand />
      <UserSummary />
    </div>
  </header>;
}
