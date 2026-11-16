// 仅展示用户提供的赔率与规则，不修改游戏配置或结算。
export const PAYOUTS = [
    {id:1,name:"Bandit Bertopeng",values:[10,20,30,50]},
    {id:2,name:"Revolver",values:[8,15,20,30]},
    {id:3,name:"Topi Koboi",values:[5,10,15,20]},
    {id:4,name:"Wiski",values:[5,10,15,20]},
    {id:5,name:'A',values:[2,4,6,10]},
    {id:6,name:'K',values:[2,4,6,10]},
    {id:7,name:'Q',values:[1,2,3,5]},
    {id:8,name:'J',values:[1,2,3,5]},
];
export const SYMBOL_NOTES = ["Wild menggantikan semua simbol kecuali Scatter.","Simbol berbingkai emas hanya muncul pada gulungan 3 dan 4."];
export const SECTIONS = [
    {id:'gold',title:"Simbol Berbingkai Emas",items:[
        "Pada putaran apa pun, beberapa simbol pada gulungan 3 dan/atau 4 dapat berbingkai emas, kecuali Wild dan Scatter.",
        "Setelah simbol baru jatuh, simbol berbingkai emas yang menang pada putaran sebelumnya berubah menjadi Wild.",
    ]},
    {id:'multiplier',title:"Pengali Kemenangan",items:[
        "Setiap putaran game utama dimulai dari ×1.",
        "Jika ada simbol menang, pengali kemenangan berlipat dua setelah pembayaran dan simbol baru jatuh.",
        "Pengali kemenangan maksimum adalah ×1.024.",
    ]},
    {id:'free',title:"Putaran Gratis",items:[
        "3 Scatter di posisi mana pun memicu 10 putaran gratis. Setiap Scatter tambahan memberikan 2 putaran gratis lagi.",
        "Setiap putaran gratis dimulai dari ×8.",
        "Dalam putaran gratis, pengali berlipat dua setelah simbol menang dibayar dan simbol baru jatuh.",
        "Putaran gratis dapat dipicu ulang.",
    ]},
    {id:'maximum',title:"Kemenangan Maksimum",items:[
        "Kemenangan maksimum adalah 5.000× total taruhan.",
        "Putaran berakhir ketika total kemenangan game utama atau putaran gratis mencapai 5.000× total taruhan.",
    ]},
    {id:'buy',title:"Beli Fitur",items:[
        "Ketuk Beli Fitur untuk membuka menu pembelian.",
        "Ketuk Mulai untuk membeli putaran gratis dengan harga yang ditampilkan.",
    ]},
    {id:'ways',title:"3.600 Cara Menang",items:[
        "Simbol menang harus muncul pada gulungan berurutan dari paling kiri ke kanan.",
        "Jumlah cara menang adalah hasil perkalian jumlah simbol tersebut pada setiap gulungan berurutan dari kiri ke kanan.",
        "Contoh di atas: 2 × 2 × 2 = 8 cara menang.",
        "Pembayaran simbol dikalikan jumlah cara menang untuk menentukan kemenangan kombinasi tersebut.",
        "Dalam contoh ini, Bandit Bertopeng pada 3 gulungan membayar 10, sehingga 10 × 8 = 80.",
    ]},
    {id:'cascade',title:"Runtuhan dan Pembayaran",items:[
        "Setelah pembayaran, semua simbol menang dihapus agar simbol di atas jatuh dan memulai runtuhan baru.",
        "Kombinasi menang baru dihitung hingga tidak ada lagi kemenangan.",
        "Semua kemenangan ditampilkan dalam nilai uang.",
    ]},
] as const;
