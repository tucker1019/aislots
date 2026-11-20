import {expect,it} from 'vitest';
import {shareChannels,socialShareUrl,shareCopy} from './social-share';
import {useLanguageStore} from '../i18n';
it('preserves invitation and replay parameters through every external share URL',()=>{
 for(const url of ['https://example.com/?inviteCode=a%26b','https://game.example/?replay=bet&share=secret']){
  for(const channel of shareChannels){
   const target=new URL(socialShareUrl(channel.id,{url,kind:'invite'}));
   expect(target.protocol).toBe('https:');
   expect([...target.searchParams.values()].some(v=>v.includes(url))).toBe(true);
  }
 }
});
it('rejects script URLs',()=>{expect(()=>socialShareUrl('telegram',{url:'javascript:alert(1)',kind:'game'})).toThrow();});
it('uses localized copy for all three business contexts',()=>{
 for(const locale of ['zh-TW','en-US','id-ID'] as const){
  useLanguageStore.setState({locale});
  for(const kind of ['game','invite','replay'] as const){const copy=shareCopy({url:'https://example.com',kind,name:'Mahjong'});expect(copy.title).not.toContain('share.');expect(copy.text.length).toBeGreaterThan(5);if(kind==='game')expect(copy.title).toContain('Mahjong');}
 }
 useLanguageStore.setState({locale:'zh-TW'});
});
