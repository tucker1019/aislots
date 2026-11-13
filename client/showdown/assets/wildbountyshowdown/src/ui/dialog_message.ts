export function gameErrorMessage(error: unknown): {title:string;message:string;expired:boolean;funds:boolean} {
    const value = error && typeof error === 'object' ? error as {status?:number;code?:string;message?:string} : {};
    const expired = value.status === 401 || value.status === 403;
    const funds = value.status === 402 || /insufficient.*(?:balance|funds)|余额不足|INSUFFICIENT_BALANCE/i.test(`${value.code || ''} ${value.message || ''}`);
    if (expired) return {title:'会话已失效',message:'请返回大厅重新进入游戏。',expired:true,funds:false};
    if (funds) return {title:'余额不足',message:'请充值后再试。',expired:false,funds:true};
    return {title:'请求失败',message:'暂时无法连接游戏服务，请检查网络后重试。',expired:false,funds:false};
}
