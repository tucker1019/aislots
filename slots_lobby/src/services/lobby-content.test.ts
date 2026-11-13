import {expect,it} from 'vitest';
import {parseLobbyContent} from './lobby-content';
const banner={id:'x',enabled:true,imageZhTw:'/assets/x.webp',imageEnUs:'https://cdn.example/x.webp',altZhTw:'Banner',altEnUs:'Banner',route:'/earn'};
const data={announcements:[{locale:'zh-TW',items:['hello']},{locale:'en-US',items:['hello']}],banners:[banner]};
it('validates managed bilingual content and strictly internal links',()=>{expect(parseLobbyContent(data).banners[0].route).toBe('/earn');for(const patch of [{route:'https://evil.example'},{imageEnUs:'javascript:alert(1)'},{imageEnUs:'//evil.example/a'},{imageZhTw:'/api/../assets/a.webp'}])expect(()=>parseLobbyContent({...data,banners:[{...banner,...patch}]})).toThrow();});
it('rejects duplicate banner IDs and incomplete localized announcements',()=>{expect(()=>parseLobbyContent({...data,banners:[banner,banner]})).toThrow();expect(()=>parseLobbyContent({...data,announcements:[{locale:'en-US',items:[]}]})).toThrow();expect(parseLobbyContent({...data,banners:[]}).banners).toEqual([]);});
it('accepts the real published default Banner assets including referral paths',()=>{const value={...data,banners:[{...banner,id:'referral',imageZhTw:'/assets/lobby/promotions/referral-200-zh-tw-v1.webp',imageEnUs:'/assets/lobby/promotions/referral-200-en-v1.webp'}]};expect(parseLobbyContent(value).banners).toHaveLength(1);});
it('accepts optional Indonesian announcements without losing required legacy locales',()=>{
 expect(parseLobbyContent({...data,announcements:[...data.announcements,{locale:'id-ID',items:['Selamat bermain']}]}).announcements['id-ID']).toEqual(['Selamat bermain']);
 expect(()=>parseLobbyContent({...data,announcements:[{locale:'id-ID',items:[]},{locale:'en-US',items:[]}]})).toThrow();
 expect(()=>parseLobbyContent({...data,announcements:[...data.announcements,{locale:'id-ID',items:[]},{locale:'id-ID',items:[]}]})).toThrow();
});
