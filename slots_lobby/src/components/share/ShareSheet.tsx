import {useRef,useState} from 'react';
import {Drawer,message} from 'antd';
import {overlayContainer} from '../../app/designViewport';
import {AsyncButton} from '../buttons/AsyncButton';
import {t,useLanguageStore} from '../../i18n';
import {shareChannels,socialShareUrl,type ShareContent} from '../../services/social-share';

export function SocialShareLinks({content}:{content:ShareContent}){
 useLanguageStore(s=>s.locale);
 return <div className="social-share-grid">{shareChannels.map(channel=><a key={channel.id} href={socialShareUrl(channel.id,content)} target="_blank" rel="noopener noreferrer" className="social-share-channel" aria-label={channel.name}>
  <span style={{background:channel.color}}><img src={`/assets/social/${channel.id}.svg`} alt="" width={25} height={25}/></span><span>{channel.name}</span>
 </a>)}</div>;
}
export function ShareSheet({content,onClose}:{content:ShareContent|null;onClose:()=>void}){
 useLanguageStore(s=>s.locale);
 const [copying,setCopying]=useState(false);const lock=useRef(false);
 const [toast,holder]=message.useMessage({getContainer:overlayContainer,maxCount:1,classNames:{list:'lobby-toast-list'}});
 async function copy(){
  if(!content||lock.current)return;lock.current=true;setCopying(true);
  try{await navigator.clipboard.writeText(content.url);void toast.success(t('copy.copied'));}
  catch{void toast.error(t('gamePreview.shareCopyFailed'));}
  finally{lock.current=false;setCopying(false);}
 }
 return <>{holder}<Drawer open={!!content} placement="bottom" title={t('share.title')} onClose={onClose} getContainer={overlayContainer} rootStyle={{position:'absolute'}} size="auto" zIndex={1200} className="lobby-share-sheet" destroyOnHidden>
  <div className="share-sheet-handle" aria-hidden="true"/>
  {content&&<><p className="share-section-label">{t('share.social')}</p><SocialShareLinks content={content}/>
   <p className="share-section-label">{t('share.link')}</p><div className="share-link-row"><input aria-label={t(content.kind==='replay'?'gamePreview.shareLink':'share.link')} value={content.url} readOnly onFocus={event=>event.currentTarget.select()}/><AsyncButton type="button" loading={copying} onClick={()=>void copy()}>{t('copy.copy')}</AsyncButton></div></>}
 </Drawer></>;
}
export function ShareInvite({url}:{url:string}){
 const [open,setOpen]=useState(false);
 return <><button className="share-invite-trigger" type="button" onClick={()=>setOpen(true)}>{t('gamePreview.share')}</button><ShareSheet content={open?{url,kind:'invite'}:null} onClose={()=>setOpen(false)}/></>;
}
