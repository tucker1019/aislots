import {t} from '../i18n';
export type ShareKind='game'|'invite'|'replay';
export interface ShareContent {url:string;kind:ShareKind;name?:string}
export const shareChannels=[
 {id:'facebook',name:'Facebook',color:'#1877f2'},
 {id:'x',name:'X',color:'#171717'},
 {id:'telegram',name:'Telegram',color:'#229ed9'},
 {id:'whatsapp',name:'WhatsApp',color:'#168c48'},
 {id:'line',name:'LINE',color:'#06a642'},
 {id:'vk',name:'VK',color:'#0077ff'},
 {id:'odnoklassniki',name:'OK',color:'#ed8100'},
 {id:'linkedin',name:'LinkedIn',color:'#0a66c2'},
] as const;
export type ShareChannel=typeof shareChannels[number]['id'];
// Default copy lives in the three locale files; callers only supply business context.
export function shareCopy(content:ShareContent){
 return {title:t(`share.${content.kind}Title`,{name:content.name??''}),text:t(`share.${content.kind}Text`,{name:content.name??''})};
}
export function socialShareUrl(channel:ShareChannel,content:ShareContent):string {
 const url=new URL(content.url);if(!['http:','https:'].includes(url.protocol))throw new Error('Invalid share URL');
 const {title,text}=shareCopy(content);const message=`${title}\n${text}`;
 const destinations:Record<ShareChannel,[string,Record<string,string>]>={
 facebook:['https://www.facebook.com/sharer/sharer.php',{u:url.href}],
 x:['https://twitter.com/intent/tweet',{url:url.href,text:message}],
 telegram:['https://t.me/share/url',{url:url.href,text:message}],
 whatsapp:['https://api.whatsapp.com/send',{text:`${message}\n${url.href}`}],
 line:['https://social-plugins.line.me/lineit/share',{url:url.href,text:message}],
 vk:['https://vk.com/share.php',{url:url.href,title,description:text}],
 odnoklassniki:['https://connect.ok.ru/offer',{url:url.href,title,description:text}],
 linkedin:['https://www.linkedin.com/sharing/share-offsite/',{url:url.href}],
 };
 const [base,params]=destinations[channel];const result=new URL(base);result.search=new URLSearchParams(params).toString();return result.href;
}
