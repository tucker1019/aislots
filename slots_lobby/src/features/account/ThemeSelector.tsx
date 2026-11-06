import {useState} from 'react';
import {Modal,Radio} from 'antd';
import {overlayContainer} from '../../app/designViewport';
import {useThemeStore} from '../../stores/theme';
import {Icon} from '../../components/Icon';
import {t} from '../../i18n';
export function ThemeSelector(){
 const [open,setOpen]=useState(false);const {mode,setTheme}=useThemeStore();
 return <><button type="button" onClick={()=>setOpen(true)} aria-label={t('theme.choose')}><span className="account-help-icon" aria-hidden="true"><Icon name="moon" size={17}/></span><span>{t('theme.title')}</span><span className="account-language-current">{t(mode==='dark'?'theme.dark':'theme.light')}</span><span aria-hidden="true"><Icon name="chevron" size={16}/></span></button><Modal getContainer={overlayContainer} title={t('theme.choose')} open={open} footer={null} width={350} centered onCancel={()=>setOpen(false)}><Radio.Group className="language-options" value={mode} onChange={event=>{const next:unknown=event.target.value;if(next==='light'||next==='dark'){setTheme(next);setOpen(false);}}} options={[{value:'light',label:t('theme.light')},{value:'dark',label:t('theme.dark')}]}/></Modal></>;
}
