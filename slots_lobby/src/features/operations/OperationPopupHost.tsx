import { useEffect, useState } from 'react';
import { Modal } from 'antd';
import { overlayContainer } from '../../app/designViewport';
import { useLobbyRoute } from '../../app/useLobbyRoute';
import { t, useLanguageStore } from '../../i18n';
import { getLanguage } from '../../i18n/config';
import { useAuthStore } from '../../stores/auth';
import { useOperationPopups } from '../../stores/operationPopups';
import { useLobbyContent } from '../home/useLobbyContent';

const welcomeMessages = new Set((['zh-TW', 'en-US', 'id-ID'] as const).map(locale =>
  getLanguage(locale).messages['copy.welcomeToAislotsEnjoyYourGames']));

function AnnouncementPopups() {
  const locale = useLanguageStore(s => s.locale);
  const { data, isSuccess, isPlaceholderData } = useLobbyContent();
  useEffect(() => {
    if (!isSuccess || isPlaceholderData) return;
    const items = data.announcements[locale] ?? data.announcements['en-US'];
    useOperationPopups.getState().enqueue(items.map(text => text.trim()).filter(text => text && !welcomeMessages.has(text))
      .map(text => ({ id: 'announcement:' + text, priority: 0, title: t('copy.notices'), text })));
  }, [data, locale, isSuccess, isPlaceholderData]);
  return null;
}

export function OperationPopupHost() {
  const { view } = useLobbyRoute();
  const authOpen = useAuthStore(s => s.open);
  const active = useOperationPopups(s => s.active);
  const hasPending = useOperationPopups(s => s.pending.length > 0);
  const [closing, setClosing] = useState(false);
  const available = view === 'home' && !authOpen;

  useEffect(() => {
    if (available && hasPending && !active) useOperationPopups.getState().showNext();
  }, [available, hasPending, active]);

  return <>
    {view === 'home' && <AnnouncementPopups />}
    {active && <Modal getContainer={overlayContainer} open={available && !closing}
      title={active.title} footer={null} onCancel={() => setClosing(true)}
      afterClose={() => {
        if (!closing) return;
        useOperationPopups.getState().finish(active.id);
        setClosing(false);
      }}>
      <p style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', maxHeight: '55dvh', overflowY: 'auto' }}>{active.text}</p>
    </Modal>}
  </>;
}
