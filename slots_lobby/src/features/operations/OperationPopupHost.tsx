import { useEffect, useState } from 'react';
import { Modal } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { overlayContainer } from '../../app/designViewport';
import { useLobbyRoute } from '../../app/useLobbyRoute';
import { t, useLanguageStore } from '../../i18n';
import { getLanguage } from '../../i18n/config';
import { useAuthStore } from '../../stores/auth';
import { useSessionStore } from '../../stores/session';
import { useOperationPopups } from '../../stores/operationPopups';
import { checkinDetailKey, loadCheckinInfo } from '../../services/checkin';
import { CheckinModal } from '../benefits/CheckinModal';
import { DepositPromotion } from '../home/DepositPromotion';
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
      .map(text => ({ kind: 'announcement', id: 'announcement:' + text, priority: 0, title: t('copy.notices'), text })));
  }, [data, locale, isSuccess, isPlaceholderData]);
  return null;
}

export function OperationPopupHost() {
  const { view } = useLobbyRoute();
  const authOpen = useAuthStore(s => s.open);
  const uid = useSessionStore(s => s.session?.uid);
  const active = useOperationPopups(s => s.active);
  const hasPending = useOperationPopups(s => s.pending.length > 0);
  const [closingId, setClosingId] = useState<string>();
  const closing = active !== undefined && closingId === active.id;
  const available = view === 'home' && !authOpen;
  const checkinUid = active?.kind === 'checkin' ? active.uid : undefined;
  const checkin = useQuery({
    queryKey: checkinDetailKey(checkinUid),
    enabled: available && active?.kind === 'checkin' && !active.ready && checkinUid === uid,
    queryFn: ({ signal }) => loadCheckinInfo(signal),
    retry: false,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (view !== 'home') return;
    const { enqueue } = useOperationPopups.getState();
    enqueue([{ kind: 'deposit', id: 'entry:deposit', priority: 20 }]);
    if (uid !== undefined) enqueue([{ kind: 'checkin', id: 'entry:checkin:' + uid, priority: 10, uid }]);
  }, [view, uid]);

  useEffect(() => {
    if (available && hasPending && !active && !closing) useOperationPopups.getState().showNext();
  }, [available, hasPending, active, closing]);

  useEffect(() => {
    if (active?.kind !== 'checkin') return;
    if (active.uid !== uid) {
      useOperationPopups.getState().finish(active.id);
      return;
    }
    if (!available || active.ready || checkin.fetchStatus !== 'idle') return;
    if (checkin.isError || checkin.data?.claimed) useOperationPopups.getState().finish(active.id);
    else if (checkin.isSuccess) useOperationPopups.getState().approveCheckin(active.id);
  }, [active, uid, available, checkin.fetchStatus, checkin.isError, checkin.isSuccess, checkin.data?.claimed]);

  const open = available && !closing;
  const close = () => setClosingId(active?.id);
  const afterClose = () => {
    if (!closing || !active) return;
    useOperationPopups.getState().finish(active.id);
    setClosingId(undefined);
  };

  return <>
    {view === 'home' && <AnnouncementPopups />}
    {active?.kind === 'deposit' && <DepositPromotion open={open} onClose={close} afterClose={afterClose} />}
    {active?.kind === 'checkin' && active.uid === uid && active.ready &&
      <CheckinModal open={open} onClose={close} afterClose={afterClose} checkedOnEntry />}
    {active?.kind === 'announcement' && <Modal getContainer={overlayContainer} open={open}
      title={active.title} footer={null} onCancel={close} afterClose={afterClose}>
      <p style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', maxHeight: '55dvh', overflowY: 'auto' }}>{active.text}</p>
    </Modal>}
  </>;
}
