import { Modal, message } from 'antd';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { InfiniteData } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { navigateLobby } from '../app/useLobbyRoute';
import { overlayContainer } from '../app/designViewport';
import { AsyncButton } from '../components/buttons/AsyncButton';
import { RecordsLayout } from '../components/records/RecordsLayout';
import { LoadingState } from '../components/feedback/LoadingState';
import { NetworkError } from '../components/feedback/NetworkError';
import { indicatorKey } from '../features/rewards/claimIndicators';
import { t, useLanguageStore } from '../i18n';
import { deleteMail, loadMail, markAllMailRead, markMailRead, type MailItem, type MailPage as MailResult } from '../services/mail';
import { useSessionStore } from '../stores/session';
import '../styles/mail.css';

type MailFilter = 'all' | 'unread' | 'read';

function dateOnly(value: string, locale: string) {
  const [year, month, day] = value.split('-').map(Number);
  return new Intl.DateTimeFormat(locale, { month: 'long', day: 'numeric' }).format(new Date(year, month - 1, day));
}

function dateTime(value: string, locale: string) {
  return new Intl.DateTimeFormat(locale, { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(value));
}

function rewardLabel(item: MailItem) {
  if (item.rewardType === 'leaderboard') return t('mail.reward.leaderboard');
  if (item.rewardType === 'loss_return') return t('mail.reward.lossReturn');
  return t('mail.reward.rebate');
}

function mailTitle(item: MailItem, locale: string) {
  const status = item.noticeType === 'expired' ? t('mail.status.expired') : t('mail.status.settled');
  return t('mail.titleTemplate', { date: dateOnly(item.businessDate, locale), reward: rewardLabel(item), status });
}

function mailBody(item: MailItem, locale: string) {
  const reward = rewardLabel(item);
  const deadline = dateTime(item.deadline, locale);
  const displayDate = dateOnly(item.businessDate, locale);
  if (item.noticeType === 'expired') return t('mail.body.expired', { date: displayDate, reward });
  if (item.noticeType === 'reminder') return t('mail.body.reminder', { reward, deadline, hours: item.reminderHours });
  return t('mail.body.settlement', { date: displayDate, reward, deadline });
}

function updateMailPages(data: InfiniteData<MailResult, string> | undefined, update: (item: MailItem) => MailItem | null) {
  if (!data) return data;
  return { ...data, pages: data.pages.map(page => ({ ...page, items: page.items.map(update).filter((item): item is MailItem => item !== null) })) };
}

export function MailPage({ onBack }: { onBack: () => void }) {
  const locale = useLanguageStore(state => state.locale);
  const uid = useSessionStore(state => state.session?.uid);
  const client = useQueryClient();
  const [toast, holder] = message.useMessage({ getContainer: overlayContainer, maxCount: 1, classNames: { list: 'lobby-toast-list' } });
  const [filter, setFilter] = useState<MailFilter>('all');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const key = ['lobby', 'mail', uid] as const;
  const query = useInfiniteQuery({ queryKey: key, initialPageParam: '', queryFn: ({ pageParam, signal }) => loadMail(pageParam, signal, uid), getNextPageParam: last => last.hasMore ? last.nextCursor : undefined, enabled: Boolean(uid), retry: false, staleTime: 0 });
  const items = useMemo(() => query.data?.pages.flatMap(page => page.items) ?? [], [query.data]);
  const unreadCount = useMemo(() => items.filter(item => item.unread).length, [items]);
  useEffect(() => {
    if (uid && query.isSuccess) client.setQueryData(indicatorKey(uid, 'mail'), { mail: unreadCount });
  }, [client, uid, query.isSuccess, unreadCount]);
  const syncMailIndicator = () => { if (uid) void client.invalidateQueries({ queryKey: indicatorKey(uid, 'mail') }); };
  const selected = items.find(item => item.mailId === selectedId);
  const visible = items.filter(item => filter === 'all' || (filter === 'unread' ? item.unread : !item.unread));
  const markRead = useMutation({ mutationFn: (id: number) => markMailRead(id, uid), retry: false, onSuccess: (_data, id) => { client.setQueryData<InfiniteData<MailResult, string>>(key, data => updateMailPages(data, item => item.mailId === id ? { ...item, unread: false } : item)); syncMailIndicator(); }, onError: error => { void toast.error(error instanceof Error ? error.message : t('mail.actionFailed')); } });
  const readAll = useMutation({ mutationFn: () => markAllMailRead(uid), retry: false, onSuccess: () => { client.setQueryData<InfiniteData<MailResult, string>>(key, data => updateMailPages(data, item => ({ ...item, unread: false }))); if (uid) client.setQueryData(indicatorKey(uid, 'mail'), { mail: 0 }); syncMailIndicator(); }, onError: error => { void toast.error(error instanceof Error ? error.message : t('mail.actionFailed')); } });
  const remove = useMutation({ mutationFn: (id: number) => deleteMail(id, uid), retry: false, onSuccess: (_data, id) => { client.setQueryData<InfiniteData<MailResult, string>>(key, data => updateMailPages(data, item => item.mailId === id ? null : item)); syncMailIndicator(); if (selectedId === id) setSelectedId(null); setDeleteId(null); void toast.success(t('mail.deleted')); }, onError: error => { setDeleteId(null); void toast.error(error instanceof Error ? error.message : t('mail.actionFailed')); } });

  function openMail(item: MailItem) {
    setSelectedId(item.mailId);
    if (item.unread) markRead.mutate(item.mailId);
  }

  const filters = selected ? undefined : <div className="mail-filters">
    <nav aria-label={t('mail.filters')}>
      {(['all', 'unread', 'read'] as const).map(value => <button type="button" key={value} aria-pressed={filter === value} onClick={() => setFilter(value)}>{t(`mail.${value}`)}</button>)}
    </nav>
    <button type="button" className="mail-mark-all" disabled={readAll.isPending || items.every(item => !item.unread)} onClick={() => readAll.mutate()}>{t('mail.markAllRead')}</button>
  </div>;
  const actions = selected ? <button type="button" className="mail-detail-delete" onClick={() => setDeleteId(selected.mailId)}>{t('mail.delete')}</button> : undefined;

  return <>
    {holder}
    <RecordsLayout title={t('mail.title')} backLabel={selected ? t('mail.back') : t('copy.backToMyAccount')} onBack={() => selected ? setSelectedId(null) : onBack()} filters={filters} actions={actions} className="mail-page">
      {selected ? <article className="mail-detail">
        <h2>{mailTitle(selected, locale)}</h2>
        <p className="mail-greeting">{t('mail.greeting')}</p>
        <p className="mail-detail-copy">{mailBody(selected, locale)}</p>
        <div className="mail-deadline"><span>{t('mail.claimDeadline')}</span><time>{dateTime(selected.deadline, locale)}</time></div>
        <div className="mail-signature"><strong>{t('mail.operationsTeam')}</strong><time>{dateTime(selected.sentAt, locale)}</time></div>
        <button type="button" className="mail-go-claim" onClick={() => navigateLobby(selected.actionPath === '/earn' ? 'earn' : 'platform-leaderboard')}>{t('mail.goClaim')}</button>
      </article> : query.isPending ? <LoadingState label={t('copy.loading')} /> : !query.data ? <NetworkError disabled={query.isFetching} onRetry={() => void query.refetch()} /> : <>
        {visible.length ? <div className="mail-list">{visible.map(item => <article className={`mail-row${item.unread ? ' unread' : ''}`} key={item.mailId}>
          <button type="button" className="mail-row-title" onClick={() => openMail(item)}>{mailTitle(item, locale)}</button>
          <div className="mail-row-actions"><span>{item.unread ? t('mail.unread') : t('mail.read')}</span><button type="button" onClick={() => setDeleteId(item.mailId)}>{t('mail.delete')}</button></div>
          <time>{dateTime(item.sentAt, locale)}</time>
        </article>)}</div> : <div className="mail-empty">{t('mail.empty')}</div>}
        {query.isFetchNextPageError && <button className="mail-retry-more" type="button" onClick={() => void query.fetchNextPage()}>{t('mail.retry')}</button>}
        {query.hasNextPage && <AsyncButton className="mail-load-more" loading={query.isFetchingNextPage} type="button" disabled={query.isFetching} onClick={() => void query.fetchNextPage()}>{t('mail.loadMore')}</AsyncButton>}
      </>}
    </RecordsLayout>
    <Modal open={deleteId !== null} title={t('mail.deleteTitle')} getContainer={overlayContainer} footer={[
      <button type="button" className="mail-modal-cancel" key="cancel" disabled={remove.isPending} onClick={() => setDeleteId(null)}>{t('mail.cancel')}</button>,
      <AsyncButton key="delete" loading={remove.isPending} type="button" className="mail-modal-delete" disabled={remove.isPending} onClick={() => { if (deleteId !== null) remove.mutate(deleteId); }}>{t('mail.confirmDelete')}</AsyncButton>,
    ]} onCancel={() => { if (!remove.isPending) setDeleteId(null); }}>
      <p>{t('mail.deleteMessage')}</p>
    </Modal>
  </>;
}
