import { overlayContainer } from '../../app/designViewport';
import {LoadingState} from '../../components/feedback/LoadingState';
import {NetworkError} from '../../components/feedback/NetworkError';
import { useState } from 'react';
import { Alert, Button, Form, Input, message } from 'antd';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { loadWalletAccounts, saveWalletAccount } from '../../services/wallet-accounts';
import type { WalletAccount } from '../../services/wallet-accounts';
import { useSessionStore } from '../../stores/session';
import { t } from '../../i18n';
import { Icon } from '../../components/Icon';
import './wallet-management.css';
import { RecordsLayout } from '../../components/records/RecordsLayout';

export function WalletManagement({ onBack }: { onBack: () => void }) {
  const [selected, setSelected] = useState<WalletAccount | null>(null);
  const [toast, holder] = message.useMessage({getContainer:overlayContainer});
  const uid = useSessionStore(state => state.session?.uid);
  const client = useQueryClient();
  const queryKey = ['wallet-accounts', uid];
  const query = useQuery({ queryKey, queryFn: ({ signal }) => loadWalletAccounts(signal), retry: false });
  const save = useMutation({ mutationFn: saveWalletAccount, onSuccess: async account => {
    client.setQueryData<WalletAccount[]>(queryKey, rows => rows?.map(row => row.channel === account.channel ? account : row));
    setSelected(null);
    void toast.success(t('wallet.saved'));
    await client.invalidateQueries({ queryKey });
  }});
  function back() {
    if (save.isPending) return;
    if (selected) { setSelected(null); save.reset(); } else onBack();
  }
  return <RecordsLayout className="wallet-management-page" title={selected ? t(selected.bound ? 'wallet.edit' : 'wallet.bind') : t('wallet.title')}
    backLabel={selected ? t('wallet.back') : t('copy.backToMyAccount')} onBack={back}>
    {holder}
    {selected ? <Form key={selected.channel} layout="vertical" initialValues={{ account: selected.account, name: selected.name }}
      disabled={save.isPending} onFinish={(values: { account: string; name: string }) => save.mutate({ channel: selected.channel, account: values.account.trim(), name: values.name.trim() })}>
      <h2>{selected.channel}</h2>
      <Form.Item name="account" label={t('wallet.account')} rules={[{ required: true, whitespace: true, message: t('wallet.accountRequired') }, { max: 128, message: t('wallet.accountTooLong') }]}>
        <Input autoComplete="off" maxLength={128} placeholder={t('wallet.accountPlaceholder')} />
      </Form.Item>
      <Form.Item name="name" label={t('wallet.name')} rules={[{ required: true, whitespace: true, message: t('wallet.nameRequired') }, { max: 64, message: t('wallet.nameTooLong') }]}>
        <Input autoComplete="off" maxLength={64} placeholder={t('wallet.namePlaceholder')} />
      </Form.Item>
      {save.isError && <Alert role="alert" type="error" title={t('wallet.saveFailed')} />}
      <Button type="primary" htmlType="submit" block size="large" loading={save.isPending}>{t('wallet.save')}</Button>
    </Form> : <>
      <h2>{t('wallet.channels')}</h2>
      {query.isPending ? <LoadingState/> : query.isError && !query.data ?
        <NetworkError disabled={query.isFetching} onRetry={() => void query.refetch()}/> : <>
        {query.isError && <Alert type="warning" title={t('wallet.loadFailed')} action={<Button onClick={() => void query.refetch()} loading={query.isFetching}>{t('copy.retry')}</Button>} />}
        {query.data?.length === 0 && <p className="wallet-feedback">{t('wallet.empty')}</p>}
        <div className="wallet-channel-list">{query.data?.map(channel => <button type="button" key={channel.channel} onClick={() => { save.reset(); setSelected(channel); }}>
          <span className="wallet-channel-icon"><Icon name="wallet" size={25} /></span>
          <span className="wallet-channel-copy"><strong>{channel.channel}</strong><span>{channel.bound ? t('wallet.bound') : t('wallet.unbound')}</span></span>
          <Icon name="chevron" size={20} />
        </button>)}</div>
      </>}
    </>}
  </RecordsLayout>;
}
