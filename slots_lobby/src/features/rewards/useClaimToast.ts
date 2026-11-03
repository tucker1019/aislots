import { t } from '../../i18n';
import { useCallback } from 'react';
import { message } from 'antd';
// Shared by reward claims; call only after a confirmed successful response.
export function useClaimToast() {
  const [toast, holder] = message.useMessage({
    top: 'calc(env(safe-area-inset-top, 0px) + 12px)',
    maxCount: 1,
    classNames: { list: 'lobby-toast-list' },
  });
  const notify = useCallback(() => {
    void toast.success({ key: 'reward-claim-success', content: t('copy.claimSuccessful'), duration: 2 });
  }, [toast]);
  return { notify, holder };
}
