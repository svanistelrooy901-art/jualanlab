# JualanLab (adik UntungLab): nota awal untuk sesi baharu

Ini nota, bukan keputusan. Semua perkara bertanda **[Mamu tentukan]** belum diputuskan.

## Apa yang JualanLab perlu tahu tentang UntungLab
- Data UntungLab hanya dalam IndexedDB peranti (Dexie, skema v1). Tiada pelayan data, tiada log masuk. Origin app: `https://untunglab.space/`.
- Menu ada: nama, kategori (pilihan), harga jual seunit, hasil setiap batch, bahan, pembungkusan, peralatan, dan variasi (menu anak yang ikut menu asas). Kos sebenar dan untung dikira oleh enjin tulen `src/domain` (satu-satunya tempat formula).
- Lesen: kod `UL-XXXX-XXXX-XXXX`, token ECDSA yang disahkan di peranti, 2 peranti, pelayan Cloudflare Worker + D1 di `beli.untunglab.space`.
- Pengguna sasaran: peniaga makanan rumah Malaysia. BM dahulu, English pilihan.

## Keputusan Mamu (2026-10-09): JualanLab perlu internet
JualanLab ialah POS dan jual beli berlaku dalam talian, jadi **internet tidak boleh dielakkan** untuk JualanLab. Pengguna yang mahu menghubungkan JualanLab dengan UntungLab mesti faham konsep ini: UntungLab kekal luar talian dan tanpa akaun, JualanLab perlu internet.
Kesan: prinsip "tiada akaun, data dalam peranti" tidak lagi wajib untuk JualanLab, jadi penyegerakan awan menjadi pilihan yang munasabah. UntungLab sendiri tidak berubah dan masih berfungsi penuh tanpa JualanLab.
Perlu direka: apa yang berlaku bila internet putus semasa jualan (baris gilir luar talian atau sekadar berhenti), dan satu paparan jelas "pautan ini perlukan internet" di sisi UntungLab.

## Keputusan Mamu (2026-10-09): pautan satu hala dan ringkas
Dua app berasingan, repo berasingan. UntungLab **hanya menghantar harga dan margin** ke JualanLab. Itu sahaja. Tiada pautan dua hala, tiada penyegerakan data lain. Jangan jadikan pautan ini rumit.

## Cara menghubungkan dua app (pilihan untuk dibincang) [Mamu tentukan]
1. **Origin yang sama** (contoh `untunglab.space/jualan`): IndexedDB dikongsi, jadi POS boleh baca menu dan harga UntungLab terus. Paling mudah, tetapi dua app dalam satu pakej dan satu skema data.
2. **Origin berlainan + fail pindah** (eksport/import JSON seperti Backup): kekal berasingan, tiada risiko merosakkan data satu sama lain, tetapi pengguna perlu pindah data secara manual.
3. **Origin berlainan + penyegerakan awan**: paling lancar tetapi bertentangan dengan prinsip "tiada akaun, data kekal dalam peranti", dan memerlukan pelayan data, log masuk dan polisi privasi baharu.
Cadangan awal: bermula dengan pilihan 2 atau 1, kerana ia mengekalkan prinsip luar talian dan tanpa akaun.

## Soalan untuk skop JualanLab [Mamu tentukan]
- Fungsi POS minimum: senarai menu, bakul, bayaran tunai/QR/e-wallet, resit, rekod jualan harian?
- Adakah JualanLab guna harga jual dan kos daripada UntungLab, dan UntungLab pula guna isi padu jualan sebenar daripada JualanLab (gantikan Anggaran Jualan Bulanan)?
- Jual berasingan atau satu pakej? Satu kod lesen atau dua?
- Cetakan resit, pencetak Bluetooth, inventori bahan?

## Peraturan yang patut dikekalkan
Satu enjin kos, tiada tekaan angka, nombor negatif dengan tanda dan label, had percuma hanya menyekat penambahan, kemas kini app menunggu pengguna, dwibahasa sejak awal, ujian dahulu dan keputusan direkod dalam DECISIONS.md.

---

## Status update (9 Oct 2026): decisions locked by Mamu

The notes above are copied unchanged from `untunglab/docs/JUALANLAB-NOTES.md`. Many open points there are now decided. Full detail and reasoning: JualanLab V1 scope doc (https://claude.ai/code/artifact/f649bda0-9df0-4637-badf-e1eb29de4bb1) and research doc (https://claude.ai/code/artifact/f1be1367-c59b-4fb2-8366-cf5516641c49).

**Product**
- JualanLab = counter POS + online store, for home and small food businesses. Separate app, separate repo.
- Two releases (changed 9 Oct, see DECISIONS.md T-03): **V1 = counter POS**, about 3 to 5 weeks after UntungLab launches; **V1.1 = online store and Kedai Plus**, after V1.
- Online store: pickup and seller delivery (flat fee), pay-at-pickup allowed, ToyyibPay / Billplz on the seller's own account (Kedai Plus only).
- Order Burger stays a separate product.

**Link with UntungLab: two-way by tap (replaces "one-way, price and margin only")**
- UntungLab → JualanLab: price, margin, status, name, category, base menu, keyed by UntungLab menu id. Data travels in the link `#` part; QR for another phone; JSON file as fallback.
- JualanLab → UntungLab: batch quantities (menuId, quantity, batchDate) into UntungLab "Plan a Batch", which builds the shopping list from recipes.
- Every hand-off starts with a tap. No background sync. UntungLab keeps no account and no server. Actual sales, customers and payments never go to UntungLab.

**Offline**
- Counter sales queue on the device when the internet drops and sync later; gateway payments need internet.

**Accounts and server**
- Google sign-in, plus email OTP via Brevo. Cloudflare Worker + D1.
- Domain for V1: subdomain (for example `jualan.untunglab.space`); final domain later.

**Pricing**
| Plan | Price |
| --- | --- |
| Free | All basic functions, 10 products, no UntungLab link, no online payment |
| POS (one-time) | RM49; early bird RM39 for the first 15 buyers; UntungLab users RM29 |
| Bundle JualanLab + UntungLab (new users) | RM75 |
| Kedai Plus (needs paid POS) | RM19.90/month or RM199/year, 14-day trial |
| AI agent ("Tanya Lab") | Future subscription add-on |

**Ideas by release (from the research doc; updated 9 Oct, DECISIONS.md T-04)**
- V1 (counter POS): Profit Today, Money Envelopes (capital vs profit after Close Day), Bazaar Mode.
- V1.1 (online store): Batch Selling with quotas, Prep List, Send to UntungLab.
- Later: Price Test, Menu Map, Profit Target, Ask the Lab (AI subscription).
- Plan a Batch lives in UntungLab and ships in Phase 2 with manual entry; the Send to UntungLab button arrives with V1.1.
- Domain locked: `jualan.untunglab.space` (DECISIONS.md L-01).
