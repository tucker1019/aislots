import {create} from 'zustand';
export type AuthMode='login'|'register';
export const useAuthStore=create<{open:boolean;mode:AuthMode;resume?:()=>void;show:(mode?:AuthMode,resume?:()=>void)=>void;close:()=>void}>(set=>({open:false,mode:'login',show:(mode='login',resume)=>set({open:true,mode,resume}),close:()=>set({open:false,resume:undefined})}));
