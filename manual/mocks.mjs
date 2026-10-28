/**
 * Install pictures for the manual: inline SVG drawn to look like the real browser screens, numbered like the steps.
 * Same drawings as UntungLab's manual and sales page, in JualanLab's colours and address.
 */
const RING = '#FF5A36';
const INK = '#05070A';
const BLUE = '#3AB4FF';
const ring = (cx, cy, r) => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${RING}" stroke-width="3"/>`;
const badge = (x, y, n) =>
  `<circle cx="${x}" cy="${y}" r="10" fill="${RING}"/><text x="${x}" y="${y + 4.5}" text-anchor="middle" font-size="13" font-weight="800" fill="#fff">${n}</text>`;
const tx = (x, y, ms, en, o = {}) => {
  const a = `x="${x}" y="${y}" font-size="${o.size ?? 11}" fill="${o.fill ?? '#111'}" font-weight="${o.weight ?? 500}" text-anchor="${o.anchor ?? 'start'}"`;
  return `<text lang="ms" ${a}>${ms}</text><text lang="en" ${a}>${en}</text>`;
};
const svg = (w, h, inner, label) =>
  `<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="${label}" font-family="system-ui,-apple-system,Segoe UI,Roboto,sans-serif" xmlns="http://www.w3.org/2000/svg">${inner}</svg>`;

/** JualanLab's own screen, kept simple, behind the browser chrome. */
const appPage = (x, y, w, h) =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#F3F6FA"/>
<rect x="${x}" y="${y}" width="${w}" height="40" fill="${INK}"/>
<text x="${x + 12}" y="${y + 25}" font-size="13" font-weight="800" fill="${BLUE}">JualanLab</text>
<rect x="${x + 12}" y="${y + 52}" width="${w - 24}" height="46" rx="10" fill="#fff"/>
<rect x="${x + 20}" y="${y + 62}" width="60" height="7" rx="3" fill="#C9D3DF"/><rect x="${x + 20}" y="${y + 76}" width="90" height="12" rx="4" fill="#0B63CE"/>
<rect x="${x + 12}" y="${y + 106}" width="${w - 24}" height="46" rx="10" fill="#fff"/>
<rect x="${x + 20}" y="${y + 116}" width="70" height="7" rx="3" fill="#C9D3DF"/><rect x="${x + 20}" y="${y + 130}" width="50" height="12" rx="4" fill="${BLUE}"/>`;

const phoneFrame = (inner, label) =>
  svg(200, 260, `<rect x="3" y="3" width="194" height="254" rx="28" fill="#15191C"/><rect x="9" y="9" width="182" height="242" rx="22" fill="#fff"/><clipPath id="cp"><rect x="9" y="9" width="182" height="242" rx="22"/></clipPath><g clip-path="url(#cp)">${inner}</g>`, label);

const iosA = () =>
  phoneFrame(
    `${appPage(9, 9, 182, 190)}
<rect x="9" y="198" width="182" height="53" fill="#F2F3F5"/>
<rect x="30" y="204" width="140" height="20" rx="10" fill="#E1E4E8"/><text x="100" y="218" font-size="9.5" text-anchor="middle" fill="#444">jualan.untunglab.space</text>
<g stroke="#2F7BFF" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
 <path d="M32 232l-6 6 6 6"/><path d="M60 232l6 6-6 6"/>
 <path d="M93 239v9h14v-9M100 246v-15M95 236l5-5 5 5"/>
 <path d="M133 233h16v14h-16zM141 233v14"/><rect x="167" y="233" width="12" height="12" rx="2"/><path d="M171 230h10v10"/>
</g>${ring(100, 240, 16)}${badge(120, 222, 1)}`,
    'Safari',
  );

const iosB = () =>
  phoneFrame(
    `${appPage(9, 9, 182, 190)}<rect x="9" y="9" width="182" height="242" fill="#000" opacity=".4"/>
<rect x="9" y="70" width="182" height="181" rx="16" fill="#F2F3F5"/>
<rect x="19" y="80" width="26" height="26" rx="7" fill="${INK}"/><text x="32" y="98" font-size="14" font-weight="800" text-anchor="middle" fill="${BLUE}">J</text>
<text x="52" y="94" font-size="11" font-weight="700" fill="#111">JualanLab</text>
<rect x="19" y="116" width="162" height="30" rx="8" fill="#fff"/>${tx(30, 135, 'Salin', 'Copy', { size: 11 })}
<rect x="19" y="152" width="162" height="34" rx="8" fill="#fff"/>
${tx(52, 173, 'Tambah ke Skrin Utama', 'Add to Home Screen', { size: 10.5, weight: 700 })}
<rect x="28" y="161" width="16" height="16" rx="4" fill="none" stroke="#111" stroke-width="1.6"/><path d="M36 164v10M31 169h10" stroke="#111" stroke-width="1.6"/>
<rect x="19" y="192" width="162" height="30" rx="8" fill="#fff"/>${tx(30, 211, 'Tambah Penanda', 'Add Bookmark', { size: 11 })}
<rect x="17" y="150" width="166" height="38" rx="10" fill="none" stroke="${RING}" stroke-width="3"/>${badge(176, 150, 2)}`,
    'Share sheet',
  );

const andA = () =>
  phoneFrame(
    `${appPage(9, 44, 182, 207)}
<rect x="9" y="9" width="182" height="35" fill="#fff"/><rect x="18" y="16" width="124" height="22" rx="11" fill="#EEF0F2"/><text x="80" y="31" font-size="9" text-anchor="middle" fill="#444">jualan.untunglab.space</text>
<g fill="#444"><circle cx="171" cy="20" r="2.3"/><circle cx="171" cy="27" r="2.3"/><circle cx="171" cy="34" r="2.3"/></g>
${ring(171, 27, 15)}${badge(148, 48, 1)}`,
    'Chrome Android',
  );

const andB = () =>
  phoneFrame(
    `${appPage(9, 44, 182, 207)}
<rect x="9" y="9" width="182" height="35" fill="#fff"/><rect x="18" y="16" width="124" height="22" rx="11" fill="#EEF0F2"/>
<rect x="9" y="44" width="182" height="207" fill="#000" opacity=".25"/>
<rect x="46" y="38" width="140" height="150" rx="10" fill="#fff" stroke="#D0D5D9"/>
${tx(58, 62, 'Tab baharu', 'New tab', { size: 11 })}${tx(58, 86, 'Sejarah', 'History', { size: 11 })}
<rect x="50" y="98" width="132" height="28" rx="7" fill="#E3F1FF"/>
<rect x="58" y="106" width="12" height="12" rx="2" fill="none" stroke="#111" stroke-width="1.6"/><path d="M64 108v6M61 112l3 3 3-3" stroke="#111" stroke-width="1.5" fill="none"/>
${tx(78, 117, 'Pasang app', 'Install app', { size: 11, weight: 700 })}
${tx(58, 148, 'Tetapan', 'Settings', { size: 11 })}${tx(58, 172, 'Bantuan', 'Help', { size: 11 })}
<rect x="48" y="96" width="136" height="32" rx="9" fill="none" stroke="${RING}" stroke-width="3"/>${badge(178, 96, 2)}`,
    'Chrome menu',
  );

const desk = (inner, label) =>
  svg(
    320,
    200,
    `<rect x="2" y="2" width="316" height="196" rx="10" fill="#fff" stroke="#C9D0D4" stroke-width="2"/>
<rect x="2" y="2" width="316" height="30" rx="10" fill="#E8ECEF"/><rect x="2" y="22" width="316" height="10" fill="#E8ECEF"/>
<circle cx="16" cy="17" r="4" fill="#FF5F57"/><circle cx="30" cy="17" r="4" fill="#FEBC2E"/><circle cx="44" cy="17" r="4" fill="#28C840"/>
<rect x="2" y="32" width="316" height="28" fill="#fff" stroke="#E1E4E8"/>
<g stroke="#667" stroke-width="1.8" fill="none" stroke-linecap="round"><path d="M18 46l-5-4 5-4M13 42h12"/><path d="M48 38l5 4-5 4"/></g>
<rect x="70" y="38" width="204" height="18" rx="9" fill="#EEF0F2"/><text x="82" y="51" font-size="10" fill="#444">jualan.untunglab.space</text>
${appPage(2, 60, 316, 136)}${inner}`,
    label,
  );

const deskA = () =>
  desk(
    `<rect x="250" y="40" width="16" height="14" rx="2" fill="none" stroke="#2F7BFF" stroke-width="1.8"/><path d="M258 43v6M255 47l3 3 3-3" stroke="#2F7BFF" stroke-width="1.8" fill="none"/>
${ring(258, 47, 13)}${badge(280, 70, 1)}`,
    'Chrome desktop',
  );

const deskB = () =>
  desk(
    `<rect x="154" y="62" width="158" height="100" rx="10" fill="#fff" stroke="#C9D0D4" stroke-width="1.5"/>
<rect x="164" y="72" width="22" height="22" rx="6" fill="${INK}"/><text x="175" y="88" font-size="13" font-weight="800" text-anchor="middle" fill="${BLUE}">J</text>
${tx(194, 87, 'Pasang JualanLab?', 'Install JualanLab?', { size: 10.5, weight: 700 })}
<rect x="164" y="126" width="62" height="24" rx="12" fill="#fff" stroke="#9CB0B1"/>${tx(195, 142, 'Batal', 'Cancel', { size: 11, anchor: 'middle' })}
<rect x="238" y="126" width="66" height="24" rx="12" fill="#2F7BFF"/>${tx(271, 142, 'Pasang', 'Install', { size: 11, anchor: 'middle', fill: '#fff', weight: 700 })}
<rect x="235" y="123" width="72" height="30" rx="15" fill="none" stroke="${RING}" stroke-width="3"/>${badge(308, 123, 2)}`,
    'Install dialog',
  );

export const INSTALL_MOCKS = { iosA: iosA(), iosB: iosB(), andA: andA(), andB: andB(), deskA: deskA(), deskB: deskB() };
