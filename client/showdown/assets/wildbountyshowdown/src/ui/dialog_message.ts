export function gameErrorMessage(error: unknown): {title:string;message:string;expired:boolean;funds:boolean} {
    const value = error && typeof error === 'object' ? error as {status?:number;code?:string;message?:string} : {};
    const expired = value.status === 401 || value.status === 403;
    const funds = value.status === 402 || /insufficient.*(?:balance|funds)|余额不足|INSUFFICIENT_BALANCE/i.test(`${value.code || ''} ${value.message || ''}`);
    if (expired) return {title:"Sesi Berakhir",message:"Silakan kembali ke lobi dan masuk lagi.",expired:true,funds:false};
    if (funds) return {title:"Saldo Tidak Cukup",message:"Silakan deposit lalu coba lagi.",expired:false,funds:true};
    return {title:"Permintaan Gagal",message:"Tidak dapat terhubung ke game. Periksa koneksi lalu coba lagi.",expired:false,funds:false};
}
