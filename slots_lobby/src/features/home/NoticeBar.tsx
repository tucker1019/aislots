import { Icon } from '../../components/Icon';
import { welcomeNotice } from './content';

export function NoticeBar() {
  return <section className="home-notice" aria-label="通知">
    <Icon name="speaker" size={16} />
    <div className="notice-viewport">
      <div className="notice-track"><span>{welcomeNotice}</span><span aria-hidden="true">{welcomeNotice}</span></div>
    </div>
  </section>;
}
