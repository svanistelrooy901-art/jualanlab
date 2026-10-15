/**
 * smeLab privacy notice and terms of use, in Malay and English (the Personal Data Protection Act 2010 asks for both).
 * One text for the whole suite: shown by the smeLab account service (/privasi, /terma) and inside JualanLab.
 * Drafted 15 Oct 2026 for Mamu to review before launch. Contact and refund terms follow UntungLab's
 * (admin@digitalsambal.space, 7 days).
 */
export interface LegalSection {
  heading: string;
  paragraphs?: string[];
  bullets?: string[];
}

export interface LegalDoc {
  title: string;
  updated: string;
  intro: string;
  sections: LegalSection[];
}

export const CONTACT_EMAIL = 'admin@digitalsambal.space';

export const PRIVACY: Record<'ms' | 'en', LegalDoc> = {
  ms: {
    title: 'Notis Privasi',
    updated: 'Dikemas kini 15 Oktober 2026',
    intro:
      'smeLab ialah suite aplikasi untuk peniaga makanan oleh Digital Sambal: UntungLab, JualanLab dan aplikasi lain yang akan datang. Notis ini menerangkan data peribadi yang kami kumpul, sebab kami gunakannya, dengan siapa ia dikongsi dan hak anda di bawah Akta Perlindungan Data Peribadi 2010.',
    sections: [
      {
        heading: 'Data yang kami kumpul',
        bullets: [
          'Akaun smeLab: alamat emel anda, dan nama anda jika log masuk dengan Google. Satu akaun digunakan untuk semua aplikasi smeLab.',
          'Pembelian: nama, nombor telefon, emel, apa yang dibeli dan status bayaran. Bayaran dibuat di ToyyibPay; kami tidak melihat maklumat bank atau kad anda.',
          'UntungLab: kod lesen anda, peranti yang mengaktifkannya (ID rawak dan nama peranti), dan kiraan penggunaan tanpa nama. Resipi, bahan, kos dan harga anda kekal dalam peranti anda dan tidak dihantar kepada kami.',
          'JualanLab: nama kedai, katalog (item, harga, kategori, serta harga dan margin yang dihantar dari UntungLab), jualan (item, jumlah, diskaun, cara bayar, nombor resit, masa, telefon yang membuat jualan, jualan yang dibatalkan dengan sebabnya) serta rekod Buka Hari dan Tutup Hari (termasuk tunai dikira).',
          'Senarai "Maklumkan saya": emel anda dan aplikasi yang anda minati.',
          'Keselamatan: alamat IP semasa meminta kod log masuk, disimpan paling lama 2 hari untuk menghalang penyalahgunaan.',
        ],
      },
      {
        heading: 'Data yang kekal dalam telefon anda',
        paragraphs: [
          'Data UntungLab anda, gambar QR DuitNow kedai, nombor telefon pelanggan yang ditaip untuk resit WhatsApp, dan jualan JualanLab yang belum dihantar disimpan dalam telefon anda sahaja. Resit yang anda kongsi ke WhatsApp dihantar terus dari telefon anda. Kami tidak menyimpan nama atau nombor telefon pelanggan anda.',
        ],
      },
      {
        heading: 'Sebab kami menggunakan data',
        bullets: [
          'Untuk log masuk dan memastikan hanya anda boleh membuka akaun dan kedai anda.',
          'Untuk membuka aplikasi yang anda beli pada akaun anda, dan mengaktifkan lesen UntungLab.',
          'Untuk menyimpan dan menyelaraskan jualan JualanLab antara telefon kedai, serta menyediakan laporan, Tutup Hari dan eksport CSV.',
          'Untuk memproses pembelian dan menghantar resit serta kod lesen.',
          'Untuk memaklumkan anda bila aplikasi yang anda minati dilancarkan (hanya jika anda meminta).',
          'Untuk menghalang penyalahgunaan dan membantu anda bila anda menghubungi kami.',
        ],
        paragraphs: ['Kami tidak menjual data anda dan tidak menggunakannya untuk iklan.'],
      },
      {
        heading: 'Pihak yang memproses data bagi pihak kami',
        bullets: [
          'Cloudflare: pelayan dan pangkalan data. Data mungkin disimpan di luar Malaysia.',
          'Brevo: menghantar kod log masuk, resit dan kod lesen melalui emel.',
          'ToyyibPay: bayaran FPX.',
          'Google: hanya jika anda memilih log masuk dengan Google.',
        ],
        paragraphs: ['Kami juga akan mendedahkan data jika dikehendaki oleh undang-undang.'],
      },
      {
        heading: 'Tempoh simpanan',
        paragraphs: [
          'Data akaun dan aplikasi disimpan selagi akaun anda aktif. Jika anda meminta akaun dipadam, kami memadamnya dalam 30 hari, kecuali rekod pembelian yang perlu disimpan untuk tujuan cukai dan perakaunan. Kod log masuk tamat dalam 10 minit. Sesi log masuk tamat jika tidak digunakan selama beberapa bulan.',
        ],
      },
      {
        heading: 'Hak anda',
        paragraphs: [
          `Anda boleh meminta salinan data anda, membetulkannya, atau memadam akaun anda dengan emel kepada ${CONTACT_EMAIL}. Jualan JualanLab boleh dimuat turun pada bila-bila masa melalui Eksport CSV. Data UntungLab boleh disimpan melalui Backup dalam aplikasi.`,
        ],
      },
      {
        heading: 'Keselamatan',
        paragraphs: ['Semua sambungan menggunakan HTTPS. Kod log masuk dan token sesi disimpan dalam bentuk cincang (hash), bukan teks asal. Tiada kata laluan untuk dicuri.'],
      },
      {
        heading: 'Kuki dan storan telefon',
        paragraphs: [
          'Kami menggunakan kuki untuk memastikan anda kekal log masuk. Tiada kuki penjejakan atau iklan. Aplikasi menyimpan data dalam telefon supaya ia boleh berfungsi tanpa internet.',
        ],
      },
      {
        heading: 'Perubahan dan hubungi kami',
        paragraphs: [`Jika notis ini berubah, kami akan kemas kini tarikh di atas dan memaklumkan perubahan penting. Soalan atau permintaan: ${CONTACT_EMAIL}.`],
      },
    ],
  },
  en: {
    title: 'Privacy Notice',
    updated: 'Updated 15 October 2026',
    intro:
      'smeLab is a suite of apps for food businesses by Digital Sambal: UntungLab, JualanLab and more to come. This notice explains what personal data we collect, why we use it, who it is shared with and your rights under the Personal Data Protection Act 2010.',
    sections: [
      {
        heading: 'Data we collect',
        bullets: [
          'smeLab account: your email address, and your name if you sign in with Google. One account is used for every smeLab app.',
          'Purchases: name, phone number, email, what was bought and payment status. Payment is made at ToyyibPay; we never see your bank or card details.',
          'UntungLab: your licence code, the devices that activated it (a random ID and the device name), and an anonymous usage count. Your recipes, ingredients, costs and prices stay on your device and are not sent to us.',
          'JualanLab: shop name, catalogue (items, prices, categories, and the prices and margins sent from UntungLab), sales (items, amounts, discounts, payment method, receipt number, time, the phone that made the sale, voided sales with their reason) and Open Day and Close Day records (including cash counted).',
          'The "Notify me" list: your email and the app you are interested in.',
          'Security: your IP address when you ask for a sign-in code, kept for at most 2 days to prevent abuse.',
        ],
      },
      {
        heading: 'Data that stays on your phone',
        paragraphs: [
          "Your UntungLab data, the shop's DuitNow QR picture, customer phone numbers typed for WhatsApp receipts, and JualanLab sales not yet sent stay on your phone only. Receipts you share to WhatsApp go straight from your phone. We do not keep your customers' names or phone numbers.",
        ],
      },
      {
        heading: 'Why we use it',
        bullets: [
          'To sign you in and make sure only you can open your account and shop.',
          'To open the apps you bought on your account, and to activate UntungLab licences.',
          "To keep and sync JualanLab sales across the shop's phones, and to give you reports, Close Day and CSV export.",
          'To process purchases and send receipts and licence codes.',
          'To tell you when an app you are interested in launches (only if you asked).',
          'To prevent abuse and to help you when you contact us.',
        ],
        paragraphs: ['We do not sell your data or use it for advertising.'],
      },
      {
        heading: 'Who processes data for us',
        bullets: [
          'Cloudflare: servers and databases. Data may be stored outside Malaysia.',
          'Brevo: sends sign-in codes, receipts and licence codes by email.',
          'ToyyibPay: FPX payments.',
          'Google: only if you choose to sign in with Google.',
        ],
        paragraphs: ['We will also disclose data where the law requires it.'],
      },
      {
        heading: 'How long we keep it',
        paragraphs: [
          'Account and app data are kept while your account is active. If you ask for your account to be deleted, we delete it within 30 days, except purchase records we must keep for tax and accounting. Sign-in codes expire after 10 minutes. Sign-in sessions end after some months without use.',
        ],
      },
      {
        heading: 'Your rights',
        paragraphs: [
          `You can ask for a copy of your data, correct it, or have your account deleted by emailing ${CONTACT_EMAIL}. JualanLab sales can be downloaded at any time with Export CSV. UntungLab data can be saved with Backup inside the app.`,
        ],
      },
      {
        heading: 'Security',
        paragraphs: ['Every connection uses HTTPS. Sign-in codes and session tokens are stored hashed, never as plain text. There are no passwords to steal.'],
      },
      {
        heading: 'Cookies and phone storage',
        paragraphs: ['We use cookies to keep you signed in. No tracking or advertising cookies. The apps keep data on the phone so they work without internet.'],
      },
      {
        heading: 'Changes and contact',
        paragraphs: [`If this notice changes, we update the date above and tell you about important changes. Questions or requests: ${CONTACT_EMAIL}.`],
      },
    ],
  },
};

export const TERMS: Record<'ms' | 'en', LegalDoc> = {
  ms: {
    title: 'Terma Penggunaan',
    updated: 'Dikemas kini 15 Oktober 2026',
    intro: 'Terma ini terpakai apabila anda menggunakan aplikasi smeLab oleh Digital Sambal, termasuk UntungLab dan JualanLab, serta akaun smeLab. Dengan menggunakannya, anda bersetuju dengan terma ini.',
    sections: [
      {
        heading: 'Akaun',
        paragraphs: [
          'Satu akaun smeLab untuk semua aplikasi smeLab. Anda log masuk dengan kod yang dihantar ke emel anda (atau Google), jadi jaga akses emel anda. Anda bertanggungjawab atas aktiviti dalam akaun anda. Dalam JualanLab, satu akaun untuk satu kedai, dan telefon kedai boleh log masuk dengan akaun yang sama.',
        ],
      },
      {
        heading: 'Pembelian',
        bullets: [
          'Setiap aplikasi dibeli sekali, tanpa langganan bulanan: satu aplikasi, kedua-duanya sekali (pakej), atau aplikasi kedua pada harga pemilik. Harga ditunjuk sebelum anda membayar.',
          'UntungLab: lesen seumur hidup (selagi produk beroperasi), untuk 2 peranti.',
          'JualanLab: Pelan Percuma hingga 10 item aktif; POS penuh untuk satu kedai.',
          'Bayaran dibuat melalui ToyyibPay (FPX). Aplikasi dibuka pada akaun anda selepas ToyyibPay mengesahkan bayaran.',
        ],
      },
      {
        heading: 'Bayaran balik',
        paragraphs: [
          `Dalam 7 hari selepas pembelian, emel ${CONTACT_EMAIL} (atau balas emel resit) dan kami akan memulangkan bayaran penuh. Aplikasi yang dibayar ditutup semula: lesen UntungLab dibatalkan, dan kedai JualanLab kembali ke Pelan Percuma tanpa memadam jualan. Pakej dipulangkan sebagai satu pembelian.`,
        ],
      },
      {
        heading: 'Data anda',
        paragraphs: [
          'Data perniagaan anda adalah milik anda. Data UntungLab kekal dalam peranti anda. Jualan dan katalog JualanLab disimpan oleh kami untuk menyediakan perkhidmatan, seperti yang diterangkan dalam Notis Privasi, dan boleh dimuat turun pada bila-bila masa melalui Eksport CSV.',
        ],
      },
      {
        heading: 'Anggaran kos, untung dan cukai',
        paragraphs: [
          'Kos, untung, margin, cadangan harga dan Duit ikut sampul ialah anggaran berdasarkan angka yang anda masukkan dan jualan yang direkod. Ia bukan nasihat perakaunan atau cukai. Anda bertanggungjawab atas rekod dan kewajipan cukai perniagaan anda.',
        ],
      },
      {
        heading: 'Data dalam telefon',
        paragraphs: [
          'Sebahagian data hanya ada dalam telefon anda: data UntungLab, dan jualan JualanLab sehingga ia dihantar. Jika telefon hilang, rosak atau datanya dipadam sebelum Backup dibuat atau jualan dihantar, data itu boleh hilang. Buat Backup UntungLab dengan kerap dan sambung JualanLab ke internet supaya jualan sampai ke pelayan.',
        ],
      },
      {
        heading: 'Penggunaan yang dilarang',
        bullets: [
          'Menjual barang atau perkhidmatan yang menyalahi undang-undang.',
          'Cuba mengganggu, menggodam atau membebankan perkhidmatan.',
          'Menjual semula, berkongsi kod lesen atau berkongsi akses akaun dengan perniagaan lain.',
        ],
        paragraphs: ['Kami boleh menggantung akaun atau lesen yang melanggar terma ini.'],
      },
      {
        heading: 'Perkhidmatan',
        paragraphs: [
          'Kami berusaha memastikan aplikasi smeLab sentiasa berfungsi, tetapi tidak dapat menjamin ia tidak pernah terganggu. Fungsi boleh ditambah atau diubah. Jika kami perlu menghentikan sesuatu aplikasi, kami akan memberi notis awal yang munasabah dan peluang untuk menyimpan data anda.',
        ],
      },
      {
        heading: 'Had tanggungjawab',
        paragraphs: [
          'Setakat yang dibenarkan undang-undang, tanggungjawab kami terhad kepada jumlah yang anda bayar untuk aplikasi berkenaan dalam 12 bulan sebelumnya. Kami tidak bertanggungjawab atas kerugian tidak langsung seperti hilang untung.',
        ],
      },
      {
        heading: 'Undang-undang dan hubungi kami',
        paragraphs: [`Terma ini tertakluk kepada undang-undang Malaysia. Jika terma berubah, kami akan kemas kini tarikh di atas dan memaklumkan perubahan penting. Soalan: ${CONTACT_EMAIL}.`],
      },
    ],
  },
  en: {
    title: 'Terms of Use',
    updated: 'Updated 15 October 2026',
    intro: 'These terms apply when you use smeLab apps by Digital Sambal, including UntungLab and JualanLab, and the smeLab account. By using them you agree to these terms.',
    sections: [
      {
        heading: 'Account',
        paragraphs: [
          "One smeLab account for every smeLab app. You sign in with a code sent to your email (or Google), so keep your email secure. You are responsible for what happens in your account. In JualanLab, one account is for one shop, and the shop's phones can sign in with the same account.",
        ],
      },
      {
        heading: 'Purchases',
        bullets: [
          'Each app is bought once, with no monthly subscription: one app, both together (bundle), or the second app at the owner price. The price is shown before you pay.',
          'UntungLab: lifetime licence (for as long as the product operates), for 2 devices.',
          'JualanLab: Free plan up to 10 active items; full POS for one shop.',
          'Payment is made through ToyyibPay (FPX). Apps open on your account once ToyyibPay confirms the payment.',
        ],
      },
      {
        heading: 'Refunds',
        paragraphs: [
          `Within 7 days of purchase, email ${CONTACT_EMAIL} (or reply to your receipt) and we will refund you in full. The paid app closes again: the UntungLab licence is cancelled, and the JualanLab shop goes back to the Free plan without deleting sales. A bundle is refunded as one purchase.`,
        ],
      },
      {
        heading: 'Your data',
        paragraphs: [
          'Your business data belongs to you. UntungLab data stays on your device. JualanLab sales and catalogue are kept by us to provide the service, as described in the Privacy Notice, and can be downloaded at any time with Export CSV.',
        ],
      },
      {
        heading: 'Cost, profit estimates and tax',
        paragraphs: [
          'Costs, profit, margins, price suggestions and Money Envelopes are estimates based on the figures you enter and the sales you record. They are not accounting or tax advice. You are responsible for your business records and tax obligations.',
        ],
      },
      {
        heading: 'Data on the phone',
        paragraphs: [
          'Some data exists only on your phone: UntungLab data, and JualanLab sales until they are sent. If the phone is lost, broken or its data is cleared before a Backup is made or sales are sent, that data can be lost. Back up UntungLab regularly and connect JualanLab to the internet so sales reach the server.',
        ],
      },
      {
        heading: 'Not allowed',
        bullets: ['Selling illegal goods or services.', 'Trying to disrupt, hack or overload the service.', 'Reselling, sharing licence codes or sharing account access with other businesses.'],
        paragraphs: ['We may suspend accounts or licences that break these terms.'],
      },
      {
        heading: 'The service',
        paragraphs: [
          'We work to keep smeLab apps running, but cannot promise they will never be interrupted. Features may be added or changed. If we ever need to stop an app, we will give reasonable notice and a chance to save your data.',
        ],
      },
      {
        heading: 'Limit of liability',
        paragraphs: [
          'As far as the law allows, our liability is limited to what you paid for the app concerned in the previous 12 months. We are not liable for indirect losses such as lost profit.',
        ],
      },
      {
        heading: 'Law and contact',
        paragraphs: [`These terms are governed by the laws of Malaysia. If they change, we update the date above and tell you about important changes. Questions: ${CONTACT_EMAIL}.`],
      },
    ],
  },
};
