export const offerPosters = [
 {id:'deposit',category:'deposit',label:'offers.depositPoster'},
 {id:'rebate',category:'returns',label:'offers.rebatePoster'},
 {id:'loss',category:'returns',label:'offers.lossPoster'},
 {id:'agent',category:'referrals',label:'offers.agentPoster'},
 {id:'invite',category:'referrals',label:'offers.invitePoster'},
 {id:'weekly',category:'vip',label:'offers.weeklyPoster'},
 {id:'monthly',category:'vip',label:'offers.monthlyPoster'},
] as const;
export const offerCategories=['all','deposit','returns','referrals','vip'] as const;
export type OfferCategory=typeof offerCategories[number];
