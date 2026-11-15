export const defaultPromotions = [
 {id:'referral',asset:'referral-200',key:'promotion.referral',route:'/earn'},
 {id:'deposit',asset:'deposit-bonus-5',key:'promotion.deposit',route:'/deposit'},
 {id:'cashback',asset:'cashback-1',key:'promotion.cashback',route:'/earn'},
] as const;

export function promotionImage(asset:string,language:'zh-tw'|'en'|'id-id') {
 return `/assets/lobby/promotions/${asset}-${language}-v1.webp`;
}
