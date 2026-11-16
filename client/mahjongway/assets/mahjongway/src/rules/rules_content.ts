/** 用户提供的印尼语规则的中文译文；保留原文数值与功能说明，不用它改写开奖配置。 */
export interface RuleSection { title: string; items: readonly string[] }
export const RULE_SECTIONS: readonly RuleSection[] = [
    { title: "Mahjong Ways", items: [
        "Mahjong Ways adalah slot video 5 gulungan dan 4 baris, dengan perubahan simbol Wild serta putaran gratis dengan pengali meningkat.",
        "Game menggunakan 20 taruhan dasar dan 1.024 cara menang. Nilai dan level taruhan mengikuti pilihan pada Opsi Taruhan.",
        "Atur nilai setiap taruhan melalui opsi Taruhan.",
        "Atur level melalui opsi Level taruhan.",
        "Atur jumlah taruhan melalui opsi Total taruhan.",
        "Saldo dompet menunjukkan dana yang tersedia untuk bertaruh.",
        "Putar Otomatis menjalankan jumlah putaran yang dipilih.",
        "Kombinasi menang dan pembayarannya mengikuti Tabel Pembayaran.",
        "Pembayaran dihitung dari nilai pada Tabel Pembayaran dikalikan nilai taruhan dan level taruhan.",
        "Simbol menang harus muncul berurutan dari gulungan paling kiri ke kanan.",
        "Jumlah cara menang setiap simbol dihitung dengan mengalikan jumlah simbol tersebut pada gulungan berurutan dari kiri ke kanan.",
        "Pembayaran simbol dikalikan jumlah cara menang.",
        "Kemenangan dari seluruh cara menang dan runtuhan dijumlahkan.",
        "Setelah pembayaran, simbol menang dihapus dan simbol di atas jatuh untuk memulai putaran berikutnya.",
        "Kombinasi menang baru dihitung hingga tidak ada lagi kemenangan.",
        "Semua kemenangan ditampilkan dalam nilai uang.",
        "Wild menggantikan semua simbol kecuali Scatter.",
        "Simbol berlapis emas hanya muncul pada gulungan 2, 3, dan 4.",
        "Putaran gratis menggunakan nilai dan level taruhan yang sama saat fitur dipicu.",
    ] },
    { title: "Simbol Berlapis Emas", items: [
        "Pada putaran apa pun, beberapa simbol pada gulungan 2, 3, dan/atau 4 dapat berlapis emas, kecuali Wild dan Scatter.",
        "Setelah simbol baru jatuh, simbol berlapis emas yang menang pada putaran sebelumnya berubah menjadi Wild.",
    ] },
    { title: "Pengali Runtuhan", items: [
        "Semua kemenangan dikalikan pengali di atas gulungan. Putaran pertama dimulai dari ×1.",
        "Setelah kemenangan pertama, pengali putaran kedua meningkat menjadi ×2.",
        "Setelah kemenangan kedua, pengali putaran ketiga meningkat menjadi ×3.",
        "Setelah kemenangan ketiga, pengali putaran keempat dan seterusnya meningkat menjadi ×5.",
    ] },
    { title: "Putaran Gratis", items: [
        "3 Scatter di posisi mana pun memicu 12 putaran gratis. Setiap Scatter tambahan memberikan 2 putaran gratis lagi.",
        "Dalam putaran gratis, pengali meningkat menjadi ×2, ×4, ×6, dan ×10.",
        "Putaran gratis dapat dipicu ulang.",
    ] },
];
export const CONTROL_SECTIONS: readonly RuleSection[] = [
    { title: "Putar", items: [
        "Ketuk untuk memutar menggunakan nilai dan level taruhan saat ini.",
        "Ketuk tombol atau area game saat berputar untuk menghentikan gulungan.",
    ] },
    { title: "Khusus Desktop", items: [
        "Tekan tombol Spasi untuk memutar menggunakan taruhan saat ini.",
        "Tahan Spasi untuk terus memutar hingga tombol dilepas.",
        "Saat gulungan berputar, tekan Spasi untuk melewati animasi dan menampilkan hasil, tergantung kestabilan koneksi.",
        "Jika hanya satu tombol aktif, tekan Spasi untuk mengaktifkannya.",
    ] },
    { title: "Berhenti", items: ["Ketuk untuk menghentikan Putar Otomatis. Angka pada tombol menunjukkan sisa putaran."] },
    { title: "Kurangi", items: ["Ketuk untuk mengurangi total taruhan."] },
    { title: "Tambah", items: ["Ketuk untuk menambah total taruhan."] },
    { title: "Profil Pemain", items: ["Ketuk untuk melihat saldo dompet dan pengaturan lainnya."] },
    { title: "Total Taruhan", items: [
        "Ketuk untuk membuka Opsi Taruhan.",
        "Taruhan: geser untuk memilih nilai taruhan dasar.",
        "Level taruhan: geser untuk memilih level.",
        "Total taruhan = taruhan × level taruhan × garis. Mengubah pilihan akan memperbarui total taruhan.",
        "Taruhan maks.: ketuk untuk memilih nilai dan level taruhan tertinggi.",
    ] },
    { title: "Verifikasi", items: ["Ketuk untuk memverifikasi keaslian game."] },
    { title: "Putar Otomatis", items: ["Putar Otomatis menjalankan jumlah putaran yang dipilih.", "Ketuk angka untuk memilih jumlah putaran otomatis."] },
    { title: "Putar Turbo", items: ["Ketuk untuk mengaktifkan atau menonaktifkan Putar Turbo agar gulungan lebih cepat."] },
    { title: "Aturan", items: ["Menampilkan aturan game dan fungsi tombol."] },
    { title: "Tabel Pembayaran", items: ["Menampilkan kombinasi menang dan pembayarannya."] },
    { title: "Riwayat Game", items: [
        "Menampilkan detail game sebelumnya. Gulir ke bawah untuk memuat riwayat lainnya.",
        "Ketuk Kustom untuk memilih tanggal riwayat.",
    ] },
    { title: "Suara", items: ["Ketuk untuk mengaktifkan atau menonaktifkan suara."] },
    { title: "Keluar", items: ["Ketuk untuk keluar dari game."] },
    { title: "Tutup", items: ["Ketuk untuk kembali ke game."] },
];
export const ADDITIONAL_RULES: readonly string[] = [
    "Jika tidak ada aktivitas selama 90 hari berturut-turut, game kembali ke kondisi awal. Progres fitur pengumpulan, putaran gratis yang belum selesai, dan fitur yang belum selesai tidak disimpan.",
    "Gangguan pada game membatalkan seluruh pembayaran dan hasil game.",
    "Jika terjadi perselisihan hasil, hasil pada Riwayat Game menjadi acuan akhir.",
];
