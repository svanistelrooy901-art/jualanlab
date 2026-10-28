/**
 * JualanLab manual content, bilingual. Every paragraph is a pair L(ms, en) so the two PDFs always share one structure.
 * Screens (fig) are named identically in manual/shots (BM) and manual/shots-en (EN).
 */
export function makeBody(h) {
  const { L, fig, figs, tip, warn, note, steps, chapter, INSTALL_MOCKS } = h;
  const body = [];

  // ---------------------------------------------------------------- 1
  body.push(
    chapter(
      'kenal',
      L('Kenali JualanLab', 'Getting to know JualanLab'),
      L('Kaunter jualan dan kedai online untuk peniaga kecil, yang tahu untung setiap item.', 'A sales counter and online store for small sellers that knows the profit on every item.'),
      `
<p>${L(
        'JualanLab ialah app kaunter jualan (POS) di telefon anda. Anda jual di kaunter, di bazar atau melalui kedai online anda sendiri. Setiap jualan direkod dengan <b>untung sebenar</b>, kerana harga dan margin setiap item datang terus dari UntungLab.',
        'JualanLab is a sales counter (POS) app on your phone. You sell at the counter, at a bazaar or through your own online store. Every sale is recorded with its <b>real profit</b>, because the price and margin of each item come straight from UntungLab.',
      )}</p>
<p>${L(
        'Di penghujung hari, Tutup Hari kira tunai dalam laci dan asingkan duit kepada <b>modal untuk beli bahan semula</b> dan <b>untung anda</b>, supaya duit modal tidak terbelanja tanpa sedar.',
        'At the end of the day, Close Day counts the cash in the drawer and splits the money into <b>capital to buy ingredients again</b> and <b>your profit</b>, so capital does not get spent without you noticing.',
      )}</p>

<h2>${L('UntungLab dan JualanLab', 'UntungLab and JualanLab')}</h2>
<div class="eq small">
  <div class="b"><small>${L('UntungLab: kira kos dan harga', 'UntungLab: work out cost and price')}</small></div><span>→</span>
  <div class="b"><small>${L('Hantar ke JualanLab', 'Send to JualanLab')}</small></div><span>→</span>
  <div class="b res"><small>${L('JualanLab: jual dan nampak untung', 'JualanLab: sell and see profit')}</small></div>
</div>
<p>${L(
        'Anda tidak wajib ada UntungLab. Tanpa UntungLab, anda tambah item dan harga sendiri, tetapi untung item itu tidak diketahui kerana kosnya tiada.',
        'You do not need UntungLab. Without it, you add items and prices yourself, but the profit on those items is unknown because their cost is not known.',
      )}</p>

<h2>${L('Pelan', 'Plans')}</h2>
<table class="tb">
<tr><th>${L('Pelan', 'Plan')}</th><th>${L('Apa yang anda dapat', 'What you get')}</th></tr>
<tr><td>${L('Percuma sebulan', 'Free month')}</td><td>${L('Setiap kedai baharu dapat semua ciri selama 30 hari pertama, termasuk kedai online. Tiada kad, tiada caj automatik.', 'Every new shop gets every feature for its first 30 days, the online store included. No card, no automatic charge.')}</td></tr>
<tr><td>Free</td><td>${L('Kaunter dengan sehingga 10 item aktif, Buka dan Tutup Hari, Mod Bazar, resit. Tiada pautan UntungLab, tiada Laporan, tiada kedai online.', 'The counter with up to 10 active items, Open and Close Day, Bazaar Mode, receipts. No UntungLab link, no Laporan, no online store.')}</td></tr>
<tr><td>${L('POS penuh', 'Full POS')}</td><td>${L('Bayar sekali. Item tanpa had, pautan UntungLab, Laporan.', 'Paid once. Unlimited items, the UntungLab link, Laporan.')}</td></tr>
<tr><td>${L('Kedai Online', 'Kedai Online')}</td><td>${L('Langganan RM19.90 sebulan atau RM199 setahun, untuk pemilik POS penuh. Kedai online dengan pautan dan QR anda sendiri.', 'A subscription, RM19.90 a month or RM199 a year, for full POS owners. Your own online store with its own link and QR.')}</td></tr>
</table>

<h2>${L('Di mana data anda disimpan', 'Where your data is kept')}</h2>
<p>${L(
        'Jualan disimpan dalam telefon dahulu, kemudian dihantar ke pelayan JualanLab bila ada internet. Semua telefon kedai yang log masuk dengan akaun yang sama berkongsi katalog, hari jualan dan laporan. Resipi dan kos bahan UntungLab kekal dalam telefon anda dan tidak dihantar.',
        'Sales are kept on the phone first, then sent to the JualanLab server when there is internet. Every shop phone signed in with the same account shares the catalogue, the business day and the reports. UntungLab recipes and ingredient costs stay on your phone and are never sent.',
      )}</p>
`,
    ),
  );

  // ---------------------------------------------------------------- 2
  body.push(
    chapter(
      'pasang',
      L('Pasang dan log masuk', 'Install and sign in'),
      L('Tambah JualanLab ke skrin utama, log masuk dengan akaun smeLab dan namakan kedai anda.', 'Add JualanLab to your home screen, sign in with your smeLab account and name your shop.'),
      `
<h2>${L('1. Pasang di skrin utama', '1. Add it to your home screen')}</h2>
<p>${L(
        'JualanLab ialah app web, jadi tiada Play Store atau App Store. Buka <b>jualan.untunglab.space</b> dan tambah ia ke skrin utama sekali sahaja. Selepas itu ia dibuka seperti app biasa, penuh skrin. <b>Pasang dan buka sekali semasa ada internet</b> supaya kaunter boleh dibuka tanpa internet selepas itu.',
        'JualanLab is a web app, so there is no Play Store or App Store. Open <b>jualan.untunglab.space</b> and add it to your home screen once. After that it opens like a normal app, full screen. <b>Install and open it once while you have internet</b> so the counter opens without internet afterwards.',
      )}</p>
<div class="inst">
 <div class="c"><h3>${L('iPhone / iPad (Safari)', 'iPhone / iPad (Safari)')}</h3><div class="mk">${INSTALL_MOCKS.iosA}${INSTALL_MOCKS.iosB}</div>
  ${steps(L('Buka <b>jualan.untunglab.space</b> di <b>Safari</b>. Pelayar lain di iPhone tidak boleh memasang app.', 'Open <b>jualan.untunglab.space</b> in <b>Safari</b>. Other browsers on iPhone cannot install apps.'), L('Tekan butang <b>Kongsi</b> (kotak dengan anak panah ke atas) di bawah skrin.', 'Tap the <b>Share</b> button (a box with an arrow pointing up) at the bottom of the screen.'), L('Tatal dan pilih <b>Tambah ke Skrin Utama</b>.', 'Scroll and tap <b>Add to Home Screen</b>.'), L('Tekan <b>Tambah</b>. Ikon JualanLab muncul di skrin anda. Buka JualanLab dari ikon itu, bukan dari Safari.', 'Tap <b>Add</b>. The JualanLab icon appears on your screen. Open JualanLab from that icon, not from Safari.'))}</div>
 <div class="c"><h3>${L('Android (Chrome)', 'Android (Chrome)')}</h3><div class="mk">${INSTALL_MOCKS.andA}${INSTALL_MOCKS.andB}</div>
  ${steps(L('Buka <b>jualan.untunglab.space</b> di <b>Chrome</b>.', 'Open <b>jualan.untunglab.space</b> in <b>Chrome</b>.'), L('Tekan menu <b>⋮</b> (tiga titik) di penjuru atas.', 'Tap the <b>⋮</b> menu (three dots) at the top corner.'), L('Pilih <b>Pasang app</b> atau <b>Tambah ke skrin utama</b>.', 'Choose <b>Install app</b> or <b>Add to Home screen</b>.'), L('Tekan <b>Pasang</b>. Ikon JualanLab muncul di skrin anda.', 'Tap <b>Install</b>. The JualanLab icon appears on your screen.'))}
  <div class="call warn small"><b>${L('Amaran "app tidak selamat"?', 'An "unsafe app" warning?')}</b> ${L('Itu amaran biasa Android atau Google Play Protect untuk app yang dipasang dari web. Tekan <b>Lagi butiran</b>, kemudian <b>Pasang juga</b>. Jika tidak pasti, guna JualanLab terus di Chrome tanpa memasangnya.', 'This is a normal Android or Google Play Protect warning for apps installed from the web. Tap <b>More details</b>, then <b>Install anyway</b>. If you are unsure, just use JualanLab in Chrome without installing it.')}</div></div>
 <div class="c wide"><h3>${L('Komputer atau tablet (Chrome atau Edge)', 'Computer or tablet (Chrome or Edge)')}</h3><div class="mk w">${INSTALL_MOCKS.deskA}${INSTALL_MOCKS.deskB}</div>
  ${steps(L('Buka <b>jualan.untunglab.space</b> di Chrome atau Edge.', 'Open <b>jualan.untunglab.space</b> in Chrome or Edge.'), L('Cari ikon <b>Pasang</b> di hujung bar alamat, atau tekan menu <b>⋮</b> dan pilih <b>Pasang JualanLab</b>.', 'Look for the <b>Install</b> icon at the end of the address bar, or open the <b>⋮</b> menu and choose <b>Install JualanLab</b>.'), L('Tekan <b>Pasang</b>. JualanLab dibuka dalam tetingkapnya sendiri, sesuai untuk kaunter di kedai.', 'Click <b>Install</b>. JualanLab opens in its own window, handy for a shop counter.'))}</div>
</div>
${tip(L('Ada lebih dari satu telefon di kedai? Pasang JualanLab di setiap telefon dan log masuk dengan emel yang sama. Semua telefon berkongsi katalog, hari jualan dan pesanan.', 'More than one phone in the shop? Install JualanLab on each phone and sign in with the same email. All of them share the catalogue, the business day and the orders.'))}

<h2>${L('2. Log masuk dengan akaun smeLab', '2. Sign in with your smeLab account')}</h2>
<p>${L(
        'JualanLab guna akaun smeLab: satu emel untuk UntungLab, JualanLab dan aplikasi smeLab lain. Tiada kata laluan.',
        'JualanLab uses your smeLab account: one email for UntungLab, JualanLab and the other smeLab apps. There is no password.',
      )}</p>
${steps(
        L('Taip emel anda dan tekan <b>Hantar kod 6 digit</b>.', 'Type your email and tap <b>Send 6-digit code</b>.'),
        L('Buka emel daripada smeLab. Tiada dalam Inbox? Semak <b>Spam</b> atau <b>Promotions</b>.', 'Open the email from smeLab. Not in your Inbox? Check <b>Spam</b> or <b>Promotions</b>.'),
        L('Taip kod 6 digit itu. Anda kekal log masuk di telefon itu, jadi langkah ini jarang perlu diulang.', 'Type the 6-digit code. You stay signed in on that phone, so you rarely need to do this again.'),
      )}
<p>${L(
        'Pertama kali masuk, beri nama kedai anda. Nama ini keluar pada resit dan kedai online, dan boleh ditukar kemudian di <b>Lagi → Tetapan kedai</b>.',
        'The first time, give your shop a name. It appears on receipts and on the online store, and you can change it later under <b>More → Shop settings</b>.',
      )}</p>
${figs(fig('01-masuk', L('Log masuk dengan emel.', 'Sign in with your email.')), fig('02-kedai-baru', L('Namakan kedai anda.', 'Name your shop.')))}

<h2>${L('3. Bergerak dalam app', '3. Moving around the app')}</h2>
<p>${L(
        'Bar bawah ada <b>Utama</b>, <b>Kaunter</b>, <b>Pesanan</b> (bila kedai online ada), <b>Jualan</b> dan <b>Lagi</b>. Di bawah <b>Lagi</b> ada Laporan, Kedai online, Katalog, Diskaun &amp; Promosi, Mod Bazar, Terima harga dari UntungLab, Tetapan kedai, Pelan, Manual dan bahasa.',
        'The bottom bar has <b>Home</b>, <b>Counter</b>, <b>Orders</b> (once you have an online store), <b>Sales</b> and <b>More</b>. Under <b>More</b> are Laporan, the online store, Catalogue, Discounts &amp; Promotions, Bazaar Mode, Receive prices from UntungLab, Shop settings, Plans, the Manual and the language.',
      )}</p>
${figs(fig('03-utama-tutup', L('Utama sebelum hari dibuka.', 'Home before the day is opened.'), [L('Buka Hari untuk mula menjual.', 'Open Day to start selling.')]), fig('28-lagi', L('Menu Lagi.', 'The More menu.')))}
`,
    ),
  );

  // ---------------------------------------------------------------- 3
  body.push(
    chapter(
      'harga',
      L('Harga dari UntungLab dan Katalog', 'Prices from UntungLab and the Catalogue'),
      L('Masukkan menu anda sekali tekan dari UntungLab, atau tambah item sendiri.', 'Bring your menu in with one tap from UntungLab, or add items yourself.'),
      `
<h2>${L('Hantar ke JualanLab', 'Send to JualanLab')}</h2>
${steps(
        L('Di <b>UntungLab</b>, buka <b>Menu</b> (atau <b>Lagi</b>) dan tekan <b>Hantar ke JualanLab</b>.', 'In <b>UntungLab</b>, open <b>Menu</b> (or <b>More</b>) and tap <b>Send to JualanLab</b>.'),
        L('Tekan butang buka. JualanLab dibuka dengan senarai harga anda.', 'Tap the open button. JualanLab opens with your price list.'),
        L('Semak senarai: <b>Baharu</b>, <b>Berubah</b> dan item yang sama. Tekan <b>Terima</b>.', 'Check the list: <b>New</b>, <b>Changed</b> and items that are the same. Tap <b>Accept</b>.'),
      )}
<p>${L(
        'UntungLab di telefon lain? Salin pautan dari UntungLab dan tampal di <b>Lagi → Terima harga dari UntungLab</b>, atau buka fail .json yang dikongsi.',
        'UntungLab on another phone? Copy the link in UntungLab and paste it under <b>More → Receive prices from UntungLab</b>, or open the shared .json file.',
      )}</p>
${figs(fig('04-terima', L('Pratonton sebelum terima.', 'The preview before you accept.')), fig('29-terima-tampal', L('Tampal pautan atau buka fail.', 'Paste a link or open a file.')))}
${warn(L('Hantar semula setiap kali anda ubah kos, harga atau margin di UntungLab. JualanLab tidak tahu perubahan itu sehingga anda hantar, kerana data UntungLab kekal dalam telefon anda.', 'Send again every time you change a cost, price or margin in UntungLab. JualanLab does not know about the change until you send it, because UntungLab data stays on your phone.'))}
<table class="tb gl">
<tr><th>${L('Bila anda hantar semula', 'When you send again')}</th><th>${L('Apa berlaku', 'What happens')}</th></tr>
<tr><td>${L('Harga atau margin berubah', 'A price or margin changed')}</td><td>${L('Item dikemas kini. Jualan lama kekal dengan kos dan margin pada hari ia dijual.', 'The item is updated. Past sales keep the cost and margin of the day they were made.')}</td></tr>
<tr><td>${L('Anda ubah harga kaunter sendiri', 'You set your own counter price')}</td><td>${L('Harga anda dikekalkan dan ditanda <b>Harga sendiri</b>.', 'Your price is kept and marked <b>Own price</b>.')}</td></tr>
<tr><td>${L('Menu dibuang di UntungLab', 'A menu was removed in UntungLab')}</td><td>${L('Item jadi tidak aktif, tidak dipadam, kerana jualan lama merujuknya.', 'The item becomes inactive, not deleted, because past sales refer to it.')}</td></tr>
</table>

<h2>${L('Katalog', 'Catalogue')}</h2>
<p>${L(
        'Katalog ialah semua item yang boleh dijual. Item dari UntungLab membawa margin. Tekan <b>Tambah item</b> untuk item yang tiada di UntungLab, contohnya air minuman. Anda boleh nyahaktifkan item yang tidak dijual lagi; ia tidak hilang dari jualan lama.',
        'The catalogue is every item you can sell. Items from UntungLab carry a margin. Tap <b>Add item</b> for things that are not in UntungLab, such as drinks. You can make an item inactive when you stop selling it; it does not disappear from past sales.',
      )}</p>
${figs(fig('05-katalog', L('Katalog dengan item dari UntungLab.', 'The catalogue with items from UntungLab.'), [L('Tambah item sendiri.', 'Add your own item.')]), fig('06-item-baru', L('Item baharu.', 'A new item.')))}
${note(L('Item sendiri tiada kos, jadi untungnya "tidak diketahui". Pemilik UntungLab boleh taip margin (%) untuk item sendiri. Pelan Free hadkan 10 item aktif.', 'Your own items have no cost, so their profit is "unknown". UntungLab owners may type a margin (%) for their own items. The Free plan allows 10 active items.'))}
`,
    ),
  );

  // ---------------------------------------------------------------- 4
  body.push(
    chapter(
      'kaunter',
      L('Buka Hari dan jual di kaunter', 'Open Day and sell at the counter'),
      L('Satu hari jualan, dari Buka Hari hingga Tutup Hari, walaupun selepas tengah malam.', 'One business day, from Open Day to Close Day, even past midnight.'),
      `
<h2>${L('Buka Hari', 'Open Day')}</h2>
<p>${L(
        'Di <b>Utama</b>, taip duit awal dalam laci (pilihan) dan tekan <b>Buka Hari</b>. Semua jualan sehingga anda Tutup Hari masuk ke hari ini, walaupun gerai anda buka sampai lepas tengah malam. Telefon lain di kedai ikut hari yang sama.',
        'On <b>Home</b>, type the starting cash in the drawer (optional) and tap <b>Open Day</b>. Every sale until you Close Day belongs to this day, even if your stall stays open past midnight. The other shop phones follow the same day.',
      )}</p>

<h2>${L('Jual', 'Sell')}</h2>
${steps(
        L('Buka <b>Kaunter</b>. Tekan item untuk tambah satu; tekan lagi untuk tambah lagi. Butang <b>−</b> kurangkan satu.', 'Open <b>Counter</b>. Tap an item to add one; tap again to add more. The <b>−</b> button takes one away.'),
        L('Tapis ikut kategori atau cari nama. Setiap item tunjuk harga dan margin (merah bila rugi).', 'Filter by category or search by name. Each item shows its price and margin (red when it loses money).'),
        L('Tekan <b>Bayar</b>.', 'Tap <b>Pay</b>.'),
      )}
${figs(fig('07-kaunter', L('Kaunter dengan tiga item dalam bakul.', 'The counter with three items in the basket.'), [L('Item dalam bakul, dengan bilangannya.', 'An item in the basket, with its count.'), L('Bayar.', 'Pay.')]), fig('08-bayar', L('Bakul dan bayaran.', 'Basket and payment.'), [L('Pilih cara bayar.', 'Choose how they pay.'), L('Sahkan bayaran.', 'Confirm the payment.')]))}

<h2>${L('Bayaran', 'Payment')}</h2>
<table class="tb gl">
<tr><th>${L('Cara bayar', 'Method')}</th><th>${L('Apa perlu dibuat', 'What to do')}</th></tr>
<tr><td>${L('Tunai', 'Cash')}</td><td>${L('Tekan jumlah diterima (Tepat, RM10, RM20, RM50) atau taip sendiri. Baki untuk pelanggan keluar terus.', 'Tap the amount received (Exact, RM10, RM20, RM50) or type it. The change to give back appears straight away.')}</td></tr>
<tr><td>QR DuitNow</td><td>${L('Tekan <b>Tunjuk QR kedai</b> supaya pelanggan imbas. Semak notifikasi bank, kemudian sahkan.', 'Tap <b>Show shop QR</b> so the customer can scan. Check your bank notification, then confirm.')}</td></tr>
<tr><td>E-wallet</td><td>${L('Sama seperti QR: sahkan selepas duit masuk.', 'Like QR: confirm once the money is in.')}</td></tr>
</table>
<p>${L(
        'Di bakul, anda boleh tambah nota untuk satu item, beri <b>% Diskaun</b> pada satu item (butang 5, 10 atau 15%), atau diskaun untuk seluruh pesanan. Margin baharu dikira terus, jadi anda nampak jika diskaun buat anda rugi. Promosi yang sedang berjalan sudah ditolak sendiri.',
        'In the basket you can add a note to an item, give one item a <b>% Discount</b> (5, 10 or 15% buttons), or discount the whole order. The new margin is worked out on the spot, so you see if a discount makes you lose money. Running promotions are taken off by themselves.',
      )}</p>

<h2>${L('Resit', 'Receipt')}</h2>
<p>${L(
        'Selepas sahkan, resit keluar. Simpan atau kongsi <b>gambar resit</b> ke WhatsApp, atau taip nombor pelanggan dan hantar resit teks. Tekan <b>Jualan baharu</b> untuk pelanggan seterusnya.',
        'Once confirmed, the receipt appears. Save or share the <b>receipt picture</b> to WhatsApp, or type the customer\'s number and send a text receipt. Tap <b>New sale</b> for the next customer.',
      )}</p>
${figs(fig('09-resit', L('Resit selepas bayar tunai.', 'The receipt after a cash payment.'), [L('Simpan atau kongsi gambar resit.', 'Save or share the receipt picture.'), L('Atau hantar resit teks ke nombor pelanggan.', 'Or send a text receipt to the customer\'s number.')]), fig('11-utama-buka', L('Utama semasa hari dibuka: untung hari ini.', 'Home while the day is open: today\'s profit.')))}
${tip(L('Tiada internet? Teruskan menjual. Jualan disimpan dalam telefon dan dihantar sendiri bila talian kembali. Di <b>Jualan</b>, jualan yang belum dihantar ditanda <b>Belum dihantar</b>.', 'No internet? Keep selling. Sales are kept on the phone and sent by themselves when the connection is back. In <b>Sales</b>, sales not sent yet are marked <b>Not sent</b>.'))}
`,
    ),
  );

  // ---------------------------------------------------------------- 5
  body.push(
    chapter(
      'tutup',
      L('Jualan dan Tutup Hari', 'Sales and Close Day'),
      L('Lihat jualan hari ini, batalkan jualan yang salah, dan tutup hari dengan duit ikut sampul.', 'See today\'s sales, void a wrong sale, and close the day with money envelopes.'),
      `
<h2>${L('Jualan hari ini', 'Today\'s sales')}</h2>
<p>${L(
        '<b>Jualan</b> tunjuk jumlah jualan, anggaran untung dan bilangan transaksi, pecahan ikut cara bayar, item terlaris, promosi yang dipakai, dan senarai semua transaksi. Butang anak panah tukar hari. <b>Eksport CSV</b> muat turun jualan untuk Excel atau Google Sheets.',
        '<b>Sales</b> shows total sales, estimated profit and the number of transactions, a split by payment method, best sellers, promotions used, and a list of every transaction. The arrow buttons change the day. <b>Export CSV</b> downloads the sales for Excel or Google Sheets.',
      )}</p>
${figs(fig('10-jualan', L('Jualan hari ini.', 'Today\'s sales.')), fig('10b-jualan-bawah', L('Item terlaris, promosi dan transaksi.', 'Best sellers, promotions and transactions.')))}
${note(L('Jualan tidak boleh dipadam. Salah tekan? Buka transaksi itu dan <b>Batalkan</b> dengan sebab. Ia kekal dalam rekod tetapi tidak dikira, dan stok kedai online dipulangkan jika dibatalkan pada hari yang sama.', 'Sales cannot be deleted. A mistake? Open that transaction and <b>Void</b> it with a reason. It stays in the record but is not counted, and online store stock comes back if you void it the same day.'))}

<h2>${L('Tutup Hari', 'Close Day')}</h2>
${steps(
        L('Tekan <b>Tutup Hari</b> di Utama atau Jualan.', 'Tap <b>Close Day</b> on Home or Sales.'),
        L('<b>Kira tunai dalam laci</b> dan taip jumlahnya. JualanLab tunjuk tunai dijangka (duit awal + jualan tunai) dan sama ada lebih atau kurang.', '<b>Count the cash in the drawer</b> and type the total. JualanLab shows the expected cash (starting cash + cash sales) and whether you are over or short.'),
        L('Lihat <b>Duit ikut sampul</b>: berapa perlu disimpan sebagai <b>modal beli bahan semula</b> dan berapa <b>untung</b> anda.', 'Look at <b>Money envelopes</b>: how much to keep as <b>capital to buy ingredients again</b> and how much is your <b>profit</b>.'),
        L('Tekan <b>Tutup Hari</b>. Hari ditutup untuk semua telefon. Jualan selepas itu perlu Buka Hari baharu.', 'Tap <b>Close Day</b>. The day closes for every phone. Sales after that need a new Open Day.'),
      )}
${figs(fig('12-tutup-hari', L('Kira tunai dalam laci.', 'Count the cash in the drawer.')), fig('12b-sampul', L('Duit ikut sampul.', 'Money envelopes.')))}
${tip(L('Sediakan dua sampul atau dua akaun bank: satu untuk modal, satu untuk untung. Masukkan jumlah yang JualanLab tunjuk setiap hari, dan modal anda tidak akan terbelanja.', 'Keep two envelopes or two bank accounts: one for capital, one for profit. Put in the amounts JualanLab shows each day, and your capital will not get spent.'))}
<p>${L(
        '<b>Tidak diagih</b> ialah jualan item yang tiada margin dari UntungLab: JualanLab tidak tahu berapa bahagian modal dan untung. Hantar harga dari UntungLab untuk item itu supaya ia dikira.',
        '<b>Not split</b> is sales of items without a margin from UntungLab: JualanLab cannot tell how much is capital and how much is profit. Send those items from UntungLab so they are counted.',
      )}</p>
`,
    ),
  );

  // ---------------------------------------------------------------- 6
  body.push(
    chapter(
      'bazar',
      L('Mod Bazar', 'Bazaar Mode'),
      L('Butang besar untuk bazar Ramadan, pasar malam dan karnival.', 'Big buttons for Ramadan bazaars, night markets and fairs.'),
      `
<p>${L(
        'Di bazar, pelanggan beratur dan anda perlu laju. Mod Bazar tunjuk sehingga 8 butang besar, satu untuk setiap item, dan butang bayaran besar. Skrin kekal terang dan butang berbunyi bila ditekan. Ia berfungsi tanpa internet.',
        'At a bazaar, customers queue and you need to be fast. Bazaar Mode shows up to 8 big buttons, one per item, and big payment buttons. The screen stays on and buttons make a sound when pressed. It works without internet.',
      )}</p>
${steps(
        L('Buka <b>Mod Bazar</b> dari Utama atau Lagi.', 'Open <b>Bazaar Mode</b> from Home or More.'),
        L('Pilih item untuk butang besar (sehingga 8).', 'Pick the items for the big buttons (up to 8).'),
        L('Jika hari belum dibuka, taip duit awal dan tekan <b>Buka Hari &amp; mula bazar</b>. Jika sudah, tekan <b>Mula bazar</b>.', 'If the day is not open yet, type the starting cash and tap <b>Open Day &amp; start bazaar</b>. If it is, tap <b>Start bazaar</b>.'),
        L('Tekan item, kemudian <b>Cukup</b>, jumlah tunai, atau <b>QR</b>. Baki keluar besar di skrin. Tekan <b>Siap · pelanggan seterusnya</b>.', 'Tap items, then <b>Exact</b>, a cash amount, or <b>QR</b>. The change shows in large type. Tap <b>Done · next customer</b>.'),
      )}
${figs(fig('13-bazar', L('Sediakan Mod Bazar.', 'Setting up Bazaar Mode.')))}
${note(L('Jualan bazar masuk ke hari jualan yang sama dan ditanda <b>Bazar</b> dalam Jualan dan Laporan. Tutup Hari seperti biasa bila selesai.', 'Bazaar sales go into the same business day and are marked <b>Bazaar</b> in Sales and Laporan. Close Day as usual when you finish.'))}
`,
    ),
  );

  // ---------------------------------------------------------------- 7
  body.push(
    chapter(
      'promo',
      L('Diskaun dan Promosi', 'Discounts and Promotions'),
      L('Promosi ditolak sendiri di kaunter, bazar dan kedai online.', 'Promotions come off by themselves at the counter, the bazaar and the online store.'),
      `
<p>${L(
        'Di <b>Lagi → Diskaun &amp; Promosi</b>, tekan <b>+ Promosi</b>. Beri nama (ia tertera pada resit), pilih <b>peratus</b> atau <b>harga promosi</b>, pilih untuk semua item, kategori atau item tertentu, dan tarikh mula dan tamat. JualanLab tunjuk item terlibat dan margin baharu, termasuk jika ada item yang rugi.',
        'Under <b>More → Discounts &amp; Promotions</b>, tap <b>+ Promotion</b>. Give it a name (it appears on receipts), choose a <b>percentage</b> or a <b>promo price</b>, choose all items, categories or chosen items, and start and end dates. JualanLab shows the items affected and their new margin, including any that lose money.',
      )}</p>
${figs(fig('14-diskaun', L('Promosi berjalan dan butang diskaun pantas.', 'A running promotion and the quick discount buttons.')))}
<p>${L(
        '<b>Butang diskaun pantas</b> ialah peratus yang muncul di bakul untuk diskaun satu item semasa bayar. Tukar kepada nilai yang anda selalu beri.',
        'The <b>quick discount buttons</b> are the percentages shown in the basket to discount one item at payment. Change them to the values you usually give.',
      )}</p>
`,
    ),
  );

  // ---------------------------------------------------------------- 8
  body.push(
    chapter(
      'kedai',
      L('Kedai online', 'The online store'),
      L('Kedai anda sendiri dengan pautan dan QR. Pelanggan pesan dari telefon dan bayar dengan DuitNow QR anda.', 'Your own store with its own link and QR. Customers order from their phone and pay with your DuitNow QR.'),
      `
<h2>${L('Sediakan kedai', 'Set up the store')}</h2>
${steps(
        L('Buka <b>Lagi → Kedai online</b> dan tekan <b>Sediakan kedai</b>.', 'Open <b>More → Online store</b> and tap <b>Set up store</b>.'),
        L('Pilih <b>pautan kedai</b>, contohnya kedai.untunglab.space/dapur-mak-long.', 'Choose your <b>store link</b>, for example kedai.untunglab.space/dapur-mak-long.'),
        L('Tambah logo, gambar muka depan, warna jenama dan ayat ringkas.', 'Add a logo, a cover photo, a brand colour and a short line.'),
        L('Tetapkan cara pelanggan terima, bayaran, <b>QR DuitNow kedai</b> dan nombor WhatsApp.', 'Set how customers get their order, payment, your <b>shop DuitNow QR</b> and WhatsApp number.'),
        L('Hidupkan <b>Terbitkan kedai</b> dan tekan <b>Simpan</b>.', 'Turn on <b>Publish store</b> and tap <b>Save</b>.'),
      )}
${figs(fig('15-kedai-atas', L('Pautan dan rupa kedai.', 'The store link and look.'), [L('Salin pautan untuk dikongsi.', 'Copy the link to share.'), L('Buka kedai untuk lihat seperti pelanggan.', 'Open the store to see it as a customer does.')]), fig('17-kedai-terima', L('Ambil sendiri dan penghantaran.', 'Pickup and delivery.')))}
${tip(L('<b>Terima pesanan sekarang</b> boleh dimatikan bila anda cuti atau stok habis. Pelanggan masih nampak menu, tetapi tidak boleh pesan.', '<b>Take orders now</b> can be turned off when you are away or sold out. Customers still see the menu but cannot order.'))}

<h2>${L('Cara terima pesanan', 'How you take orders')}</h2>
<table class="tb gl">
<tr><th>${L('Cara', 'Mode')}</th><th>${L('Sesuai untuk', 'Suits')}</th></tr>
<tr><td>${L('Biasa', 'Normal')}</td><td>${L('Pesanan untuk sekarang, selagi kedai dibuka.', 'Orders for now, while the store is open.')}</td></tr>
<tr><td>${L('Waktu buka + pra-tempah automatik', 'Opening hours + automatic pre-order')}</td><td>${L('Tetapkan waktu buka setiap hari dan hari cuti. Di luar waktu buka, pesanan jadi pra-tempah untuk hari buka seterusnya, dan kedai tunjuk waktu buka anda. 30 minit sebelum tutup, JualanLab ingatkan anda semak stok untuk esok.', 'Set your opening hours for each day and your holidays. Outside opening hours, orders become pre-orders for the next opening day, and the store shows your opening hours. 30 minutes before closing, JualanLab reminds you to check tomorrow\'s stock.')}</td></tr>
<tr><td>${L('Batch pra-tempah', 'Pre-order batches')}</td><td>${L('Untuk kek, kuih raya atau menu mingguan: buat batch dengan tarikh siap, tarikh tutup tempahan, had pesanan dan menu serta stok sendiri.', 'For cakes, festive cookies or weekly menus: make batches with a ready date, an order closing date, an order limit and their own menu and stock.')}</td></tr>
</table>
${figs(fig('16-kedai-cara', L('Cara terima pesanan.', 'How you take orders.')), fig('18-kedai-item', L('Item di kedai: gambar, stok dan tanda.', 'Store items: photos, stock and badges.')))}

<h2>${L('Item dan stok', 'Items and stock')}</h2>
<p>${L(
        'Di <b>Item di kedai</b>, tekan item untuk tambah gambar dan penerangan, tanda (Baru, Pedas, Laris), tonjolkan di atas, atau sembunyikan dari kedai (kaunter sahaja). Hidupkan <b>Kira stok</b> untuk item yang terhad: kedai tunjuk "Tinggal 3", dan bila stok 0 item ditanda <b>Habis</b>. Jualan di kaunter dan bazar juga tolak stok kedai.',
        'Under <b>Store items</b>, tap an item to add a photo and description, a badge (New, Spicy, Best seller), feature it at the top, or hide it from the store (counter only). Turn on <b>Track stock</b> for limited items: the store shows "Only 3 left", and at 0 the item is marked <b>Sold out</b>. Counter and bazaar sales take from store stock too.',
      )}</p>

<h2>${L('Apa pelanggan nampak', 'What customers see')}</h2>
${steps(
        L('Pelanggan buka pautan atau imbas QR kedai, pilih item dan tekan <b>Lihat troli</b>.', 'The customer opens the link or scans the store QR, picks items and taps <b>View cart</b>.'),
        L('Pilih ambil sendiri atau penghantaran, isi nama dan nombor WhatsApp. Butiran disimpan dalam telefon mereka untuk pesanan seterusnya.', 'They choose pickup or delivery and fill in their name and WhatsApp number. Their details are kept on their phone for next time.'),
        L('Selepas hantar pesanan, mereka imbas QR DuitNow anda dan tekan <b>Dah bayar? Hantar bukti</b>, yang buka WhatsApp kepada anda dengan nombor pesanan.', 'After placing the order, they scan your DuitNow QR and tap <b>Paid? Send proof</b>, which opens WhatsApp to you with the order number.'),
        L('Halaman pesanan mereka kemas kini sendiri bila anda ubah status.', 'Their order page updates by itself when you change the status.'),
      )}
${figs(fig('19-pelanggan-kedai', L('Kedai online di telefon pelanggan.', 'The online store on a customer\'s phone.')), fig('20-pelanggan-troli', L('Troli: cara terima dan maklumat.', 'Cart: how to get it and details.')), fig('21-pelanggan-pesanan', L('Bayar dengan QR DuitNow.', 'Pay with DuitNow QR.')))}
${note(L('Bayaran terus masuk ke akaun anda. JualanLab tidak memegang wang pelanggan. Pesanan QR yang tidak dibayar dibatalkan sendiri selepas masa yang anda tetapkan, dan stoknya dipulangkan.', 'Payments go straight into your account. JualanLab never holds customers\' money. QR orders that are not paid cancel themselves after the time you set, and their stock comes back.'))}

<h2>${L('Kongsi kedai anda', 'Share your store')}</h2>
<p>${L(
        'Tekan <b>Salin pautan</b> atau <b>Kongsi</b> untuk hantar ke WhatsApp, Instagram atau Facebook. <b>Poster QR kedai</b> sedia untuk dicetak (A4) dan ditampal di gerai, kaunter atau kotak kek.',
        'Tap <b>Copy link</b> or <b>Share</b> to send it to WhatsApp, Instagram or Facebook. The <b>store QR poster</b> is ready to print (A4) and stick on your stall, counter or cake boxes.',
      )}</p>
${figs(fig('25-poster', L('Poster QR kedai.', 'The store QR poster.')))}
`,
    ),
  );

  // ---------------------------------------------------------------- 9
  body.push(
    chapter(
      'pesanan',
      L('Pesanan', 'Orders'),
      L('Terima, sediakan dan serahkan pesanan online, satu butang setiap langkah.', 'Take, prepare and hand over online orders, one button per step.'),
      `
<h2>${L('Pesanan masuk', 'A new order')}</h2>
<p>${L(
        'Pesanan baharu berbunyi dan keluar sebagai banner bila app dibuka. Hidupkan <b>Notifikasi pesanan baru</b> di tab Pesanan untuk dapat notifikasi walaupun app ditutup. Di iPhone, notifikasi hanya berfungsi bila JualanLab dipasang di Skrin Utama.',
        'A new order plays a sound and shows a banner while the app is open. Turn on <b>New order notifications</b> in the Orders tab to be notified even when the app is closed. On iPhone, notifications only work when JualanLab is installed on the Home Screen.',
      )}</p>
${figs(fig('22-pesanan', L('Tab Pesanan.', 'The Orders tab.')), fig('22b-pesanan-kad', L('Kad pesanan.', 'Order cards.'), [L('Langkah seterusnya.', 'The next step.'), L('WhatsApp pelanggan dengan mesej sedia.', 'WhatsApp the customer with a ready message.')]))}

<h2>${L('Langkah pesanan', 'Order steps')}</h2>
<table class="tb gl">
<tr><th>${L('Status', 'Status')}</th><th>${L('Apa anda buat', 'What you do')}</th></tr>
<tr><td>${L('Semak bayaran', 'Check payment')}</td><td>${L('Semak jumlah dan rujukan nombor pesanan dalam app bank anda, kemudian tekan <b>Bayaran diterima</b>. Pesanan jadi jualan dalam hari jualan anda.', 'Check the amount and the order number reference in your bank app, then tap <b>Payment received</b>. The order becomes a sale in your business day.')}</td></tr>
<tr><td>${L('Disahkan', 'Confirmed')}</td><td>${L('Tekan <b>Mula sediakan</b>.', 'Tap <b>Start preparing</b>.')}</td></tr>
<tr><td>${L('Sedang disediakan', 'Preparing')}</td><td>${L('Tekan <b>Sedia diambil</b> atau <b>Dalam penghantaran</b>.', 'Tap <b>Ready for pickup</b> or <b>Out for delivery</b>.')}</td></tr>
<tr><td>${L('Sedia', 'Ready')}</td><td>${L('Tekan <b>Selesai</b> bila pelanggan terima. Bayar semasa terima: pilih Tunai atau QR.', 'Tap <b>Done</b> when the customer has it. Pay on collection: choose Cash or QR.')}</td></tr>
</table>
<p>${L(
        'Setiap langkah ada butang <b>WhatsApp</b> dengan mesej sedia untuk pelanggan. Perlu batal? Tekan <b>Batal</b> dan beri sebab; pesanan yang sudah dibayar dibatalkan jualannya dan anda pulangkan wang pelanggan sendiri.',
        'Every step has a <b>WhatsApp</b> button with a ready message for the customer. Need to cancel? Tap <b>Cancel</b> and give a reason; a paid order has its sale voided and you refund the customer yourself.',
      )}</p>

<h2>${L('Tempah rider', 'Book a rider')}</h2>
<p>${L(
        'Untuk pesanan penghantaran, <b>Tempah rider</b> salin semua butiran yang Lalamove atau Grab minta: alamat ambil, nama dan nombor pelanggan, alamat hantar, nombor pesanan, dan jumlah untuk dikutip jika bayar semasa terima. Tekan <b>Salin butiran</b>, buka Lalamove atau Grab, dan tampal. Tambang rider dibayar terus kepada mereka.',
        'For delivery orders, <b>Book a rider</b> copies everything Lalamove or Grab ask for: pickup address, customer name and number, delivery address, order number, and the amount to collect for pay on collection. Tap <b>Copy details</b>, open Lalamove or Grab, and paste. You pay the rider fare to them directly.',
      )}</p>
${figs(fig('23-rider', L('Tempah rider.', 'Book a rider.')), fig('24-sedia', L('Senarai sedia: apa perlu dibuat.', 'Prep list: what to make.')))}

<h2>${L('Senarai sedia', 'Prep list')}</h2>
<p>${L(
        '<b>Senarai sedia</b> campurkan semua pesanan aktif (atau satu batch) kepada berapa unit setiap item perlu dibuat. Cetak, atau tekan <b>Rancang di UntungLab</b> untuk kira bahan yang perlu dibeli.',
        'The <b>prep list</b> adds all active orders (or one batch) into how many of each item to make. Print it, or tap <b>Plan in UntungLab</b> to work out the ingredients to buy.',
      )}</p>
${figs(fig('30-utama-kedai', L('Kad kedai online di Utama: pesanan hari ini dan pesanan yang perlu tindakan.', 'The online store card on Home: today\'s orders and orders that need you.')))}
`,
    ),
  );

  // ---------------------------------------------------------------- 10
  body.push(
    chapter(
      'laporan',
      L('Laporan', 'Laporan (reports)'),
      L('Untung, jualan dan item terbaik untuk mana-mana tempoh.', 'Profit, sales and your best items for any period.'),
      `
<p>${L(
        'Buka <b>Lagi → Laporan</b>, atau Laporan dari Jualan. Pilih Hari ini, 7 hari, Bulan ini, Bulan lepas atau tarikh sendiri. Setiap angka dibanding dengan tempoh sebelumnya.',
        'Open <b>More → Laporan</b>, or Laporan from Sales. Choose Today, 7 days, This month, Last month or your own dates. Every figure is compared with the period before.',
      )}</p>
<ul class="bl">
<li>${L('<b>Untung kasar</b> dan jualan, margin, transaksi dan purata sebakul.', '<b>Gross profit</b> and sales, margin, transactions and average basket.')}</li>
<li>${L('<b>Jualan harian</b> dan hari paling laris.', '<b>Daily sales</b> and the busiest day.')}</li>
<li>${L('<b>Item ikut untung</b>, termasuk item yang rugi dan cadangan harga.', '<b>Items by profit</b>, including items that lose money and a price suggestion.')}</li>
<li>${L('<b>Saluran jualan</b> (kaunter, bazar, online) dan <b>cara bayar</b>.', '<b>Sales channels</b> (counter, bazaar, online) and <b>payment methods</b>.')}</li>
</ul>
${figs(fig('26-laporan', L('Laporan bulan ini.', 'This month\'s Laporan.')), fig('26b-laporan-bawah', L('Item ikut untung dan saluran jualan.', 'Items by profit and sales channels.')))}
${note(L('Laporan untuk POS penuh (dan percuma sebulan). Untung dikira daripada margin UntungLab pada hari item dijual.', 'Laporan is part of the full POS (and the free month). Profit comes from the UntungLab margin on the day each item was sold.'))}
`,
    ),
  );

  // ---------------------------------------------------------------- 11
  body.push(
    chapter(
      'pelan',
      L('Pelan dan pembelian', 'Plans and buying'),
      L('Bayar sekali untuk POS penuh; Kedai Online sebagai langganan.', 'Pay once for the full POS; Kedai Online as a subscription.'),
      `
<p>${L(
        '<b>Lagi → Pelan</b> tunjuk pelan anda, hari percuma yang tinggal, dan status Kedai Online. Pembelian dibuat di <b>smelab.untunglab.space</b> dengan emel yang sama, melalui FPX (ToyyibPay).',
        '<b>More → Plans</b> shows your plan, the free days left, and your Kedai Online status. You buy at <b>smelab.untunglab.space</b> with the same email, through FPX (ToyyibPay).',
      )}</p>
${steps(
        L('Tekan <b>Beli di smeLab</b>.', 'Tap <b>Buy at smeLab</b>.'),
        L('Log masuk dengan emel yang sama dengan JualanLab, pilih JualanLab dan bayar.', 'Sign in with the same email as JualanLab, choose JualanLab and pay.'),
        L('Kembali ke JualanLab dan tekan <b>Sudah bayar? Semak semula</b>. POS penuh terus dibuka.', 'Come back to JualanLab and tap <b>Paid already? Check again</b>. The full POS opens at once.'),
      )}
${figs(fig('27-pelan', L('Pelan anda.', 'Your plan.')))}
<table class="tb">
<tr><th>${L('Harga', 'Price')}</th><th></th></tr>
<tr><td>${L('POS penuh', 'Full POS')}</td><td>${L('RM49 sekali bayar. Harga Early Bird untuk pembeli terawal. RM29 jika anda sudah memiliki UntungLab. Pakej UntungLab + JualanLab RM75.', 'RM49, paid once. An Early Bird price for the first buyers. RM29 if you already own UntungLab. UntungLab + JualanLab bundle RM75.')}</td></tr>
<tr><td>Kedai Online</td><td>${L('RM19.90 sebulan atau RM199 setahun, tiada caj automatik. Langganan dibuka dalam app sebelum percuma sebulan pertama tamat. Akan datang dalam Kedai Online: bayaran online melalui payment gateway dan penghantaran (Lalamove, EasyParcel).', 'RM19.90 a month or RM199 a year, no automatic charge. Subscribing opens in the app before the first free months end. Coming to Kedai Online: online payment through a payment gateway, and delivery (Lalamove, EasyParcel).')}</td></tr>
</table>
${note(L('Selepas percuma sebulan, kedai tanpa POS penuh ke pelan Free: kaunter dengan 10 item, tanpa kedai online. Tiada data dipadam, dan semuanya dibuka semula sebaik anda naik taraf. Bayaran balik penuh dalam 7 hari: emel admin@digitalsambal.space.', 'After the free month, a shop without the full POS moves to Free: the counter with 10 items, no online store. No data is deleted, and everything reopens as soon as you upgrade. Full refund within 7 days: email admin@digitalsambal.space.'))}
`,
    ),
  );

  // ---------------------------------------------------------------- 12
  body.push(
    chapter(
      'soalan',
      L('Soalan lazim', 'Questions and answers'),
      L('Jawapan pantas bila sesuatu tidak seperti dijangka.', 'Quick answers when something is not as expected.'),
      `
<dl class="faq">
<dt>${L('App tulis "luar talian" walaupun ada internet.', 'The app says "offline" even though I have internet.')}</dt>
<dd>${L('Tutup app sepenuhnya dan buka semula. Masih sama? Buka jualan.untunglab.space di Chrome atau Safari: jika halaman itu juga tidak dibuka, masalahnya pada talian atau DNS telefon. Tukar ke data mudah alih, atau matikan Private DNS di tetapan telefon. Jualan anda selamat dalam telefon. <b>Jangan padam data app</b> semasa ada jualan belum dihantar.', 'Close the app fully and open it again. Still the same? Open jualan.untunglab.space in Chrome or Safari: if that page does not open either, the problem is the phone\'s connection or DNS. Switch to mobile data, or turn off Private DNS in the phone settings. Your sales are safe on the phone. <b>Do not clear the app\'s data</b> while there are unsent sales.')}</dd>
<dt>${L('Dua telefon menjual pada masa yang sama. Bergaduh tak?', 'Two phones sell at the same time. Do they clash?')}</dt>
<dd>${L('Tidak. Setiap telefon ada nombor resitnya sendiri, dan semua jualan masuk ke hari jualan yang sama.', 'No. Each phone has its own receipt numbers, and all sales go into the same business day.')}</dd>
<dt>${L('Saya tukar telefon.', 'I changed phones.')}</dt>
<dd>${L('Pasang JualanLab di telefon baharu dan log masuk dengan emel yang sama. Katalog, jualan dan kedai anda ada di pelayan. Pastikan telefon lama sudah hantar semua jualan dahulu.', 'Install JualanLab on the new phone and sign in with the same email. Your catalogue, sales and store are on the server. Make sure the old phone has sent all its sales first.')}</dd>
<dt>${L('Untung tunjuk "?" untuk sesetengah item.', 'Profit shows "?" for some items.')}</dt>
<dd>${L('Item itu tiada margin: ia item sendiri, atau belum lengkap di UntungLab. Lengkapkan kosnya di UntungLab dan hantar semula.', 'That item has no margin: it is your own item, or not complete in UntungLab. Complete its cost in UntungLab and send again.')}</dd>
<dt>${L('Pelanggan pesan tetapi tidak bayar.', 'A customer ordered but did not pay.')}</dt>
<dd>${L('Pesanan QR yang tidak dibayar dibatalkan sendiri selepas masa yang anda tetapkan di tetapan kedai, dan stok dipulangkan. Anda juga boleh batalkan sendiri dengan sebab.', 'Unpaid QR orders cancel themselves after the time you set in the store settings, and the stock comes back. You can also cancel them yourself with a reason.')}</dd>
<dt>${L('Notifikasi pesanan tidak keluar di iPhone.', 'Order notifications do not appear on iPhone.')}</dt>
<dd>${L('Pasang JualanLab ke Skrin Utama melalui Safari, buka dari ikon itu, kemudian hidupkan notifikasi di tab Pesanan.', 'Add JualanLab to the Home Screen through Safari, open it from that icon, then turn on notifications in the Orders tab.')}</dd>
<dt>${L('Perlu bantuan lain?', 'Need other help?')}</dt>
<dd>${L('Emel admin@digitalsambal.space. Beritahu emel akaun anda dan screenshot skrin itu.', 'Email admin@digitalsambal.space. Tell us your account email and send a screenshot of the screen.')}</dd>
</dl>
<p class="end">${L('Selamat berniaga dengan JualanLab!', 'Happy selling with JualanLab!')}</p>
`,
    ),
  );

  return body;
}
