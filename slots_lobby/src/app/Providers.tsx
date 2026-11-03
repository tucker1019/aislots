import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { ConfigProvider } from 'antd';
import { getLanguage } from '../i18n/config';
import { useLanguageStore } from '../i18n';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { theme } from './theme';
export function Providers({ children }: { children: ReactNode }) {
  const locale=useLanguageStore(state=>state.locale);
  useEffect(()=>{document.documentElement.lang=locale;},[locale]);
  const [client] = useState(() => new QueryClient({ defaultOptions: {
    queries: { retry: 1, retryDelay: 500, refetchOnWindowFocus: false },
  } }));
  return <ConfigProvider locale={getLanguage(locale).antd} theme={theme}><QueryClientProvider client={client}>{children}</QueryClientProvider></ConfigProvider>;
}
