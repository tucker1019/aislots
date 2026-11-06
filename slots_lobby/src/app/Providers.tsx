import {rewardClaimed,type RewardGroup,groups} from '../features/rewards/claimIndicators';
import {useSessionStore} from '../stores/session';
import {forgetGameEntry} from '../services/game-entry';
import { overlayContainer } from './designViewport';
import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { ConfigProvider } from 'antd';
import { getLanguage } from '../i18n/config';
import { useLanguageStore } from '../i18n';
import { MutationCache,QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {getLobbyTheme} from './theme';
import {useThemeStore} from '../stores/theme';
function createLobbyClient():QueryClient{
  // Capture the owner at request start: mutation options may change while pending.
  const intents=new WeakMap<object,{uid:number;group:RewardGroup;kind:unknown}>();
  const mutationCache=new MutationCache({
    onMutate:(_variables,mutation)=>{
      const meta=mutation.options.meta;const uid=useSessionStore.getState().session?.uid;
      if(uid&&meta?.claimUid===uid&&typeof meta.claimIndicator==='string'&&groups.includes(meta.claimIndicator as RewardGroup)){
        intents.set(mutation,{uid,group:meta.claimIndicator as RewardGroup,kind:meta.rewardKind});
      }
    },
    onSuccess:async(data,variables,_context,mutation)=>{
      const intent=intents.get(mutation);
      if(intent&&intent.uid===useSessionStore.getState().session?.uid){
        await rewardClaimed(client,intent.uid,intent.group,data,variables,intent.kind);
      }
    },
  });
  const client=new QueryClient({mutationCache,defaultOptions:{queries:{retry:1,retryDelay:500,refetchOnWindowFocus:false}}});
  return client;
}
export function Providers({ children }: { children: ReactNode }) {
  const themeMode=useThemeStore(state=>state.mode);
  const locale=useLanguageStore(state=>state.locale);
  useEffect(()=>{document.documentElement.lang=locale;},[locale]);
  const [client] = useState(createLobbyClient);
  useEffect(()=>useSessionStore.subscribe((state,previous)=>{if(state.session?.uid!==previous.session?.uid){client.clear();forgetGameEntry();}}),[client]);
  return <ConfigProvider getPopupContainer={overlayContainer} locale={getLanguage(locale).antd} theme={getLobbyTheme(themeMode)}><QueryClientProvider client={client}>{children}</QueryClientProvider></ConfigProvider>;
}
