import {useState} from 'react';
import {RecordsLayout} from '../components/records/RecordsLayout';
import {LoadingState} from '../components/feedback/LoadingState';
import {NetworkError} from '../components/feedback/NetworkError';
import {Icon} from '../components/Icon';
import {useAccountProfile} from '../features/account/useAccountProfile';
import {AvatarPicker} from '../features/profile/AvatarPicker';
import {t} from '../i18n';
import '../styles/profile.css';
export function ProfilePage({onBack}:{onBack:()=>void}){
 const query=useAccountProfile(true);const [dialog,setDialog]=useState<'avatar'|null>(null);const profile=query.data;
 return <RecordsLayout title={t('profile.title')} backLabel={t('copy.backToMyAccount')} onBack={onBack} className="profile-page">
 {!profile?query.isPending?<LoadingState/>:<NetworkError disabled={query.isFetching} onRetry={()=>void query.refetch()}/>:<>
 <div className="profile-avatar-area"><button type="button" className="profile-avatar" onClick={()=>setDialog('avatar')} aria-label={t('profile.changeAvatar')}><img src={`/assets/profile/avatar/${profile.avatarId}.png`} alt={t('profile.currentAvatar')}/><span><Icon name="settings" size={13}/></span></button><strong>{profile.nickname}</strong></div>
 <section className="profile-card"><div><span>{t('profile.memberId')}</span><strong>{profile.uid}</strong></div><div><span>{t('profile.account')}</span><strong>{profile.account||t('profile.guest')}</strong></div></section>
 {dialog==='avatar'&&<AvatarPicker uid={profile.uid} current={profile.avatarId} onClose={()=>setDialog(null)}/>}
 </>}
 </RecordsLayout>;
}
