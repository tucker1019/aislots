import {useSessionStore} from '../stores/session';
import {useAuthStore} from '../stores/auth';
import {t} from '../i18n';
import { Brand } from './Brand';
import { UserSummary } from '../features/account/UserSummary';

export function Header() {
  const session=useSessionStore(state=>state.session);
  return <header className="site-header">
    <div className="header-inner">
      <Brand />
      {session?<UserSummary />:<div className="header-auth"><button onClick={()=>useAuthStore.getState().show('login')}>{t('auth.login')}</button><button onClick={()=>useAuthStore.getState().show('register')}>{t('auth.register')}</button></div>}
    </div>
  </header>;
}
