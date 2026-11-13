import {afterEach,expect,it,vi} from 'vitest';
import {render,screen} from '@testing-library/react';
import {useLanguageStore} from '../../i18n';
import {NoticeBar} from './NoticeBar';
import {PromotionBanner} from './PromotionBanner';
vi.mock('./useLobbyContent',()=>({useLobbyContent:()=>({isError:false,isFetching:false,data:{announcements:{'zh-TW':['歡迎來到 AISlots，祝您遊戲愉快。'],'en-US':['Welcome to AISlots. Enjoy your games.']},banners:[{id:'referral',enabled:true,imageZhTw:'/assets/zh.webp',imageEnUs:'/assets/en.webp',altZhTw:'推薦一人，獎勵200',altEnUs:'Refer a friend, earn 200',route:'/earn'},{id:'custom',enabled:true,imageZhTw:'/assets/custom-zh.webp',imageEnUs:'/assets/custom-en.webp',altZhTw:'自訂',altEnUs:'Operator custom offer',route:'/offers'}]}})}));
afterEach(()=>{useLanguageStore.getState().setLocale('zh-TW');localStorage.removeItem('aislots-language');});
it('印尼語本地化預設公告和宣傳標籤，缺圖時使用英文並保留運營自訂內容',()=>{
 useLanguageStore.getState().setLocale('id-ID');render(<><NoticeBar/><PromotionBanner/></>);
 expect(screen.getByRole('region',{name:'Pengumuman'})).toHaveTextContent('Selamat datang di AISlots. Selamat bermain.');
 const images=Array.from(document.querySelectorAll('img'));
 expect(images.some(image=>image.alt==='Undang teman, dapatkan 200'&&image.getAttribute('src')==='/assets/en.webp')).toBe(true);
 expect(images.some(image=>image.alt==='Operator custom offer'&&image.getAttribute('src')==='/assets/custom-en.webp')).toBe(true);
 expect(images.every(image=>!image.getAttribute('src')?.includes('-zh.'))).toBe(true);
});
