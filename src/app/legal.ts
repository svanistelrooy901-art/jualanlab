/**
 * Privacy notice and terms of use, in Malay and English (Personal Data Protection Act 2010 asks for both).
 * Kept as plain data so the pages stay simple and the wording is easy to review. Drafted 15 Oct 2026; Mamu reviews
 * before launch. Contact and refund terms follow UntungLab's (admin@digitalsambal.space, 7 days).
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
      'JualanLab ialah aplikasi kaunter jualan oleh Digital Sambal. Notis ini menerangkan data peribadi yang kami kumpul, sebab kami gunakannya, dengan siapa ia dikongsi dan hak anda di bawah Akta Perlindungan Data Peribadi 2010.',
    sections: [
      {
        heading: 'Data yang kami kumpul',
        bullets: [
          'Akaun: alamat emel anda, dan nama anda jika log masuk dengan Google.',
          'Kedai: nama kedai dan katalog (item, harga, kategori, serta harga dan margin yang dihantar dari UntungLab).',
          'Jualan: item, jumlah, diskaun, cara bayar, nombor resit, masa, telefon yang membuat jualan, jualan yang dibatalkan dengan sebabnya, serta rekod Buka Hari dan Tutup Hari (termasuk tunai dikira).',
          'Pembelian pelan: nama, nombor telefon, emel, dan status bayaran. Bayaran dibuat di ToyyibPay; kami tidak melihat maklumat bank atau kad anda.',
          'Keselamatan: alamat IP semasa meminta kod log masuk, disimpan paling lama 2 hari untuk menghalang penyalahgunaan.',
        ],
      },
      {
        heading: 'Data yang kekal dalam telefon anda',
        paragraphs: [
          'Gambar QR DuitNow kedai, nombor telefon pelanggan yang ditaip untuk resit WhatsApp, dan jualan yang belum dihantar disimpan dalam telefon anda sahaja. Resit yang anda kongsi ke WhatsApp dihantar terus dari telefon anda. Kami tidak menyimpan nama atau nombor telefon pelanggan anda.',
        ],
      },
      {
        heading: 'Sebab kami menggunakan data',
        bullets: [
          'Untuk log masuk dan memastikan hanya anda boleh membuka kedai anda.',
          'Untuk menyimpan dan menyelaraskan jualan antara telefon kedai, serta menyediakan laporan, Tutup Hari dan eksport CSV.',
          'Untuk memproses pembelian, menghantar resit pembelian dan, bagi pakej, kod lesen UntungLab.',
          'Untuk menghalang penyalahgunaan dan membantu anda bila anda menghubungi kami.',
        ],
        paragraphs: ['Kami tidak menjual data anda dan tidak menggunakannya untuk iklan.'],
      },
      {
        heading: 'Pihak yang memproses data bagi pihak kami',
        bullets: [
          'Cloudflare: pelayan dan pangkalan data aplikasi. Data mungkin disimpan di luar Malaysia.',
          'Brevo: menghantar kod log masuk dan resit pembelian melalui emel.',
          'ToyyibPay: bayaran FPX untuk pelan.',
          'Google: hanya jika anda memilih log masuk dengan Google.',
        ],
        paragraphs: ['Kami juga akan mendedahkan data jika dikehendaki oleh undang-undang.'],
      },
      {
        heading: 'Tempoh simpanan',
        paragraphs: [
          'Data akaun, kedai dan jualan disimpan selagi akaun anda aktif. Jika anda meminta akaun dipadam, kami memadamnya dalam 30 hari, kecuali rekod pembelian yang perlu disimpan untuk tujuan cukai dan perakaunan. Kod log masuk tamat dalam 10 minit. Sesi log masuk tamat selepas 60 hari tidak digunakan.',
        ],
      },
      {
        heading: 'Hak anda',
        paragraphs: [
          `Anda boleh meminta salinan data anda, membetulkannya, atau memadam akaun anda dengan emel kepada ${CONTACT_EMAIL}. Jualan boleh dimuat turun pada bila-bila masa melalui Eksport CSV di halaman Jualan.`,
        ],
      },
      {
        heading: 'Keselamatan',
        paragraphs: [
          'Semua sambungan menggunakan HTTPS. Kod log masuk dan token sesi disimpan dalam bentuk cincang (hash), bukan teks asal. Tiada kata laluan untuk dicuri.',
        ],
      },
      {
        heading: 'Kuki dan storan telefon',
        paragraphs: [
          'Kami menggunakan satu kuki untuk memastikan anda kekal log masuk. Tiada kuki penjejakan atau iklan. Aplikasi menyimpan katalog dan jualan dalam telefon supaya ia boleh berfungsi tanpa internet.',
        ],
      },
      {
        heading: 'Perubahan dan hubungi kami',
        paragraphs: [
          `Jika notis ini berubah, kami akan kemas kini tarikh di atas dan memaklumkan perubahan penting dalam aplikasi. Soalan atau permintaan: ${CONTACT_EMAIL}.`,
        ],
      },
    ],
  },
  en: {
    title: 'Privacy Notice',
    updated: 'Updated 15 October 2026',
    intro:
      'JualanLab is a sales counter app by Digital Sambal. This notice explains what personal data we collect, why we use it, who it is shared with and your rights under the Personal Data Protection Act 2010.',
    sections: [
      {
        heading: 'Data we collect',
        bullets: [
          'Account: your email address, and your name if you sign in with Google.',
          'Shop: the shop name and catalogue (items, prices, categories, and the prices and margins sent from UntungLab).',
          'Sales: items, amounts, discounts, payment method, receipt number, time, the phone that made the sale, voided sales with their reason, and Open Day and Close Day records (including cash counted).',
          'Plan purchases: name, phone number, email and payment status. Payment is made at ToyyibPay; we never see your bank or card details.',
          'Security: your IP address when you ask for a sign-in code, kept for at most 2 days to prevent abuse.',
        ],
      },
      {
        heading: 'Data that stays on your phone',
        paragraphs: [
          "The shop's DuitNow QR picture, customer phone numbers typed for WhatsApp receipts, and sales not yet sent stay on your phone only. Receipts you share to WhatsApp go straight from your phone. We do not keep your customers' names or phone numbers.",
        ],
      },
      {
        heading: 'Why we use it',
        bullets: [
          'To sign you in and make sure only you can open your shop.',
          "To keep and sync sales across the shop's phones, and to give you reports, Close Day and CSV export.",
          'To process purchases, send purchase receipts and, for the bundle, an UntungLab licence code.',
          'To prevent abuse and to help you when you contact us.',
        ],
        paragraphs: ['We do not sell your data or use it for advertising.'],
      },
      {
        heading: 'Who processes data for us',
        bullets: [
          "Cloudflare: the app's servers and database. Data may be stored outside Malaysia.",
          'Brevo: sends sign-in codes and purchase receipts by email.',
          'ToyyibPay: FPX payments for plans.',
          'Google: only if you choose to sign in with Google.',
        ],
        paragraphs: ['We will also disclose data where the law requires it.'],
      },
      {
        heading: 'How long we keep it',
        paragraphs: [
          'Account, shop and sales data are kept while your account is active. If you ask for your account to be deleted, we delete it within 30 days, except purchase records we must keep for tax and accounting. Sign-in codes expire after 10 minutes. Sign-in sessions end after 60 days without use.',
        ],
      },
      {
        heading: 'Your rights',
        paragraphs: [
          `You can ask for a copy of your data, correct it, or have your account deleted by emailing ${CONTACT_EMAIL}. Sales can be downloaded at any time with Export CSV on the Sales page.`,
        ],
      },
      {
        heading: 'Security',
        paragraphs: ['Every connection uses HTTPS. Sign-in codes and session tokens are stored hashed, never as plain text. There are no passwords to steal.'],
      },
      {
        heading: 'Cookies and phone storage',
        paragraphs: [
          'We use one cookie to keep you signed in. No tracking or advertising cookies. The app keeps the catalogue and sales on the phone so it works without internet.',
        ],
      },
      {
        heading: 'Changes and contact',
        paragraphs: [`If this notice changes, we update the date above and tell you about important changes in the app. Questions or requests: ${CONTACT_EMAIL}.`],
      },
    ],
  },
};

export const TERMS: Record<'ms' | 'en', LegalDoc> = {
  ms: {
    title: 'Terma Penggunaan',
    updated: 'Dikemas kini 15 Oktober 2026',
    intro: 'Terma ini terpakai apabila anda menggunakan JualanLab, aplikasi kaunter jualan oleh Digital Sambal. Dengan menggunakan JualanLab, anda bersetuju dengan terma ini.',
    sections: [
      {
        heading: 'Akaun',
        paragraphs: [
          'Satu akaun untuk satu kedai. Anda log masuk dengan kod yang dihantar ke emel anda, jadi jaga akses emel anda. Anda bertanggungjawab atas aktiviti dalam akaun anda, termasuk telefon kedai yang log masuk dengan akaun yang sama.',
        ],
      },
      {
        heading: 'Pelan dan bayaran',
        bullets: [
          'Pelan Percuma: semua fungsi asas, hingga 10 item aktif.',
          'POS penuh: bayaran sekali untuk satu kedai, tanpa langganan bulanan. Harga ditunjuk sebelum anda membayar.',
          'Bayaran dibuat melalui ToyyibPay (FPX). Pelan dibuka selepas ToyyibPay mengesahkan bayaran.',
        ],
      },
      {
        heading: 'Bayaran balik',
        paragraphs: [
          `Dalam 7 hari selepas pembelian, emel ${CONTACT_EMAIL} (atau balas emel resit pembelian) dan kami akan memulangkan bayaran penuh. Kedai anda kembali ke Pelan Percuma; jualan anda tidak dipadam. Bagi pakej dengan UntungLab, kod lesen UntungLab yang dikeluarkan akan dibatalkan.`,
        ],
      },
      {
        heading: 'Data anda',
        paragraphs: [
          'Jualan dan katalog anda adalah milik anda. Kami menyimpannya untuk menyediakan perkhidmatan, seperti yang diterangkan dalam Notis Privasi. Anda boleh memuat turun jualan anda pada bila-bila masa melalui Eksport CSV.',
        ],
      },
      {
        heading: 'Anggaran untung dan cukai',
        paragraphs: [
          'Untung, margin dan Duit ikut sampul ialah anggaran berdasarkan angka dari UntungLab dan jualan yang direkod. Ia bukan nasihat perakaunan atau cukai. Anda bertanggungjawab atas rekod dan kewajipan cukai perniagaan anda.',
        ],
      },
      {
        heading: 'Jualan tanpa internet',
        paragraphs: [
          'Jualan disimpan dalam telefon dahulu dan dihantar bila ada internet. Jika telefon hilang, rosak atau datanya dipadam sebelum jualan dihantar, jualan itu boleh hilang. Sambung ke internet dengan kerap supaya jualan sampai ke pelayan.',
        ],
      },
      {
        heading: 'Penggunaan yang dilarang',
        bullets: [
          'Menjual barang atau perkhidmatan yang menyalahi undang-undang.',
          'Cuba mengganggu, menggodam atau membebankan perkhidmatan.',
          'Menjual semula atau berkongsi akses akaun kepada kedai lain.',
        ],
        paragraphs: ['Kami boleh menggantung akaun yang melanggar terma ini.'],
      },
      {
        heading: 'Perkhidmatan',
        paragraphs: [
          'Kami berusaha memastikan JualanLab sentiasa berfungsi, tetapi tidak dapat menjamin ia tidak pernah terganggu. Fungsi boleh ditambah atau diubah. Jika kami perlu menghentikan JualanLab, kami akan memberi notis awal yang munasabah dan peluang untuk memuat turun data anda.',
        ],
      },
      {
        heading: 'Had tanggungjawab',
        paragraphs: [
          'Setakat yang dibenarkan undang-undang, tanggungjawab kami terhad kepada jumlah yang anda bayar untuk JualanLab dalam 12 bulan sebelumnya. Kami tidak bertanggungjawab atas kerugian tidak langsung seperti hilang untung.',
        ],
      },
      {
        heading: 'Undang-undang dan hubungi kami',
        paragraphs: [
          `Terma ini tertakluk kepada undang-undang Malaysia. Jika terma berubah, kami akan kemas kini tarikh di atas dan memaklumkan perubahan penting dalam aplikasi. Soalan: ${CONTACT_EMAIL}.`,
        ],
      },
    ],
  },
  en: {
    title: 'Terms of Use',
    updated: 'Updated 15 October 2026',
    intro: 'These terms apply when you use JualanLab, the sales counter app by Digital Sambal. By using JualanLab you agree to them.',
    sections: [
      {
        heading: 'Account',
        paragraphs: [
          "One account for one shop. You sign in with a code sent to your email, so keep your email secure. You are responsible for what happens in your account, including the shop's phones signed in with it.",
        ],
      },
      {
        heading: 'Plans and payment',
        bullets: [
          'Free plan: all the basics, up to 10 active items.',
          'Full POS: a one-time payment for one shop, with no monthly subscription. The price is shown before you pay.',
          'Payment is made through ToyyibPay (FPX). The plan opens once ToyyibPay confirms the payment.',
        ],
      },
      {
        heading: 'Refunds',
        paragraphs: [
          `Within 7 days of purchase, email ${CONTACT_EMAIL} (or reply to your purchase receipt) and we will refund you in full. Your shop goes back to the Free plan; your sales are not deleted. For the bundle with UntungLab, the UntungLab licence code issued is cancelled.`,
        ],
      },
      {
        heading: 'Your data',
        paragraphs: [
          'Your sales and catalogue belong to you. We keep them to provide the service, as described in the Privacy Notice. You can download your sales at any time with Export CSV.',
        ],
      },
      {
        heading: 'Profit estimates and tax',
        paragraphs: [
          'Profit, margins and Money Envelopes are estimates based on figures from UntungLab and the sales you record. They are not accounting or tax advice. You are responsible for your business records and tax obligations.',
        ],
      },
      {
        heading: 'Selling without internet',
        paragraphs: [
          "Sales are saved on the phone first and sent when there is internet. If the phone is lost, broken or its data is cleared before sales are sent, those sales can be lost. Connect regularly so sales reach the server.",
        ],
      },
      {
        heading: 'Not allowed',
        bullets: ['Selling illegal goods or services.', 'Trying to disrupt, hack or overload the service.', 'Reselling or sharing account access with other shops.'],
        paragraphs: ['We may suspend accounts that break these terms.'],
      },
      {
        heading: 'The service',
        paragraphs: [
          'We work to keep JualanLab running, but cannot promise it will never be interrupted. Features may be added or changed. If we ever need to stop JualanLab, we will give reasonable notice and a chance to download your data.',
        ],
      },
      {
        heading: 'Limit of liability',
        paragraphs: [
          'As far as the law allows, our liability is limited to what you paid for JualanLab in the previous 12 months. We are not liable for indirect losses such as lost profit.',
        ],
      },
      {
        heading: 'Law and contact',
        paragraphs: [
          `These terms are governed by the laws of Malaysia. If they change, we update the date above and tell you about important changes in the app. Questions: ${CONTACT_EMAIL}.`,
        ],
      },
    ],
  },
};
