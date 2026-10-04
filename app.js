/* Sachet UI logic. Everything runs in the browser; nothing is persisted or transmitted by this code. */
(function () {
  'use strict';
  const $ = s => document.querySelector(s);
  const $$ = s => Array.from(document.querySelectorAll(s));
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  let lang = 'hi', last = null, lastText = '', rec = null;
  const T = k => (I18N[lang] && I18N[lang][k]) || I18N.en[k] || k;

  const SAMPLES = [
    '🔥 SURE SHOT TIP 🔥 Kal operator is stock me upper circuit lagayenge. Target 3x in 5 din, 100% guaranteed profit. Limited seats! Join our VIP group abhi: https://t.me/vip_profit_calls . SEBI registered analyst. Registration fees Rs 2999 PhonePe karo.',
    'Dear investor, you are selected for an Institutional Account with guaranteed IPO allotment. Download our app https://zerodha-kite-pro.vip to start. Daily 5% returns. Pay Rs 10,000 margin deposit to activate. SEBI Reg No: 12345. Do not tell anyone. Offer ends today.',
    'आपका डीमैट खाता KYC अपडेट न होने से 24 घंटे में ब्लॉक हो जाएगा। कानूनी कार्रवाई होगी। AnyDesk डाउनलोड करें और अपना OTP बताएं। SEBI अधिकारी से बात करें 9876543210',
    'Mutual fund investments are subject to market risks. Read all scheme related documents carefully. NAV is updated every business day. Never share your OTP with anyone.'
  ];

  /* ---------- language ---------- */
  function applyLang() {
    document.documentElement.lang = lang;
    $$('[data-i18n]').forEach(e => { e.textContent = T(e.dataset.i18n); });
    $$('[data-i18n-ph]').forEach(e => { e.placeholder = T(e.dataset.i18nPh); });
    $$('.lang button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.lang === lang)));
    $$('#f-mode option').forEach(o => { o.textContent = T('mode_' + o.value); });
    $('#btn-mic').lastElementChild.textContent = T(rec ? 'btnMicStop' : 'btnMic');
    if (last) renderResult();
    window.speechSynthesis && speechSynthesis.cancel();
  }

  function show(id) {
    $$('.screen').forEach(s => { s.hidden = s.id !== id; });
    window.scrollTo(0, 0);
  }
  const status = msg => { $('#status').textContent = msg || ''; };

  /* ---------- check ---------- */
  function runCheck() {
    const text = $('#msg').value.trim();
    if (text.split(/\s+/).filter(Boolean).length < 3) { status(T('tooShort')); return; }
    status('');
    lastText = text;
    last = Sachet.analyze(text);
    renderResult();
    show('screen-result');
  }

  function stepsHtml(r) {
    const ids = r.flags.map(f => f.id);
    const urgent = r.level === 'high' || ['paymentask', 'otp', 'remote', 'withdrawal'].some(i => ids.includes(i));
    const A = (href, label) => `<a href="${href}" target="_blank" rel="noopener noreferrer">${esc(label)}</a>`;
    const items = [
      ['step_stop', '', false],
      ['step_verify', A('https://www.sebi.gov.in/intermediaries.html', 'sebi.gov.in'), false],
      ['step_trust', '', false],
      ['step_paid', `<a href="tel:1930">1930</a> · ${A('https://cybercrime.gov.in', 'cybercrime.gov.in')}`, urgent],
      ['step_report', A('https://sancharsaathi.gov.in', 'sancharsaathi.gov.in'), false],
      ['step_scores', A('https://scores.sebi.gov.in', 'scores.sebi.gov.in'), false]
    ];
    return '<ol class="steps">' + items.map(([k, link, u]) =>
      `<li class="${u ? 'urgent' : ''}">${esc(T(k))} ${link}</li>`).join('') + '</ol>';
  }

  function renderResult() {
    const r = last, L = r.level;
    const icon = { none: '🔍', low: '⚠️', medium: '⚠️', high: '🚨' }[L];
    const bars = { none: 0, low: 1, medium: 2, high: 3 }[L];
    const flags = r.flags.map(f => `
      <li class="flag">
        <div class="flag-h"><span class="sev ${f.critical ? 'sev-c' : 'sev-n'}">${esc(T(f.critical ? 'critical' : 'warn'))}</span><strong>${esc(f.title[lang])}</strong></div>
        <p class="ev">${esc(T('found'))} <q>${esc(f.evidence)}</q></p>
        <p class="why">${esc(f.why[lang])}</p>
      </li>`).join('');
    const notes = r.notes.map(n => `<div class="note">${esc(n[lang])}</div>`).join('');
    $('#result').innerHTML = `
      <div class="verdict lvl-${L}" role="alert">
        <span class="ico" aria-hidden="true">${icon}</span>
        <h2>${esc(T('lvl_' + L))}</h2>
        <p>${esc(T('sub_' + L))}</p>
        <div class="meter" aria-hidden="true">${[1, 2, 3].map(i => `<i class="${i <= bars ? 'on' : ''}"></i>`).join('')}</div>
      </div>
      ${r.flags.length ? `<div class="card"><h3>${esc(T('flagsTitle'))}</h3><ul class="flags">${flags}</ul></div>` : ''}
      ${notes ? `<div class="card"><h3>${esc(T('notesTitle'))}</h3>${notes}</div>` : ''}
      <div class="card"><h3>${esc(T('nextTitle'))}</h3>${stepsHtml(r)}</div>
      <p class="disc">${esc(T('disclaimer'))}</p>`;
    setListen(false);
  }

  /* ---------- read aloud ---------- */
  function setListen(on) {
    const b = $('#btn-listen');
    if (!b) return;
    b.setAttribute('aria-pressed', String(on));
    b.lastElementChild.textContent = T(on ? 'stopListen' : 'listen');
  }
  function speak() {
    if (!('speechSynthesis' in window)) { alert(T('noTts')); return; }
    if (speechSynthesis.speaking) { speechSynthesis.cancel(); setListen(false); return; }
    const parts = [T('lvl_' + last.level), T('sub_' + last.level)];
    last.flags.slice(0, 4).forEach(f => parts.push(f.title[lang] + '. ' + f.why[lang]));
    ['step_stop', 'step_verify', 'step_paid'].forEach(k => parts.push(T(k)));
    const u = new SpeechSynthesisUtterance(parts.join('. '));
    u.lang = lang === 'hi' ? 'hi-IN' : 'en-IN';
    u.rate = 0.9;
    u.onend = u.onerror = () => setListen(false);
    speechSynthesis.speak(u);
    setListen(true);
  }

  /* ---------- voice input ---------- */
  function toggleMic() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { status(T('micNo')); return; }
    if (rec) { rec.stop(); return; }
    rec = new SR();
    rec.lang = lang === 'hi' ? 'hi-IN' : 'en-IN';
    rec.interimResults = true;
    rec.continuous = true;
    const base = $('#msg').value;
    let fin = '';
    rec.onresult = e => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        if (res.isFinal) fin += res[0].transcript + ' '; else interim += res[0].transcript;
      }
      $('#msg').value = (base ? base + ' ' : '') + fin + interim;
    };
    const done = () => { rec = null; $('#btn-mic').setAttribute('aria-pressed', 'false'); $('#btn-mic').lastElementChild.textContent = T('btnMic'); };
    rec.onend = done;
    rec.onerror = () => { status(T('micNo')); done(); };
    rec.start();
    $('#btn-mic').setAttribute('aria-pressed', 'true');
    $('#btn-mic').lastElementChild.textContent = T('btnMicStop');
  }

  /* ---------- screenshot OCR (on-device, lazy-loaded) ---------- */
  function loadScript(src) {
    return new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = src; s.onload = res; s.onerror = rej;
      document.head.appendChild(s);
    });
  }
  async function ocr(file) {
    status(T('ocrLoading'));
    try {
      if (!window.Tesseract) await loadScript('https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js');
      const { data } = await window.Tesseract.recognize(file, 'eng+hin', {
        logger: m => { if (m.status === 'recognizing text') status(T('ocrLoading') + ' ' + Math.round(m.progress * 100) + '%'); }
      });
      $('#msg').value = (data.text || '').trim();
      status(T('ocrDone'));
    } catch (e) { status(T('ocrFail')); }
  }

  /* ---------- complaint draft ---------- */
  function formVals() {
    return {
      name: $('#f-name').value.trim(), city: $('#f-city').value.trim(), phone: $('#f-phone').value.trim(),
      date: $('#f-date').value, mode: $('#f-mode').value, contacts: $('#f-contacts').value.trim(),
      scenario: (document.querySelector('input[name=scn]:checked') || {}).value || 'approached',
      amount: $('#f-amount').value.trim(), paidTo: $('#f-paidto').value.trim(),
      what: $('#f-what').value.trim(), includeMsg: $('#f-incmsg').checked, dlang: $('#f-dlang').value
    };
  }
  function draftEn(f, flags, msg) {
    const m = I18N.en['mode_' + f.mode];
    const L = [];
    L.push('Subject: Complaint regarding suspected investment fraud / misleading investment solicitation', '');
    L.push('To,', 'The Concerned Officer', '(SEBI SCORES / National Cyber Crime Reporting Portal)', '');
    L.push('Complainant: ' + (f.name || '[Your name]') + (f.city ? ', ' + f.city : ''));
    if (f.date) L.push('Date of incident: ' + f.date);
    L.push('Mode of contact: ' + m);
    if (f.contacts) L.push('Details of the other party (phone / link / handle): ' + f.contacts);
    L.push('', 'What happened:', f.what || '[Describe briefly in your own words]');
    if (f.scenario === 'lost') {
      L.push('', 'Amount paid / lost: Rs ' + (f.amount || '[amount]'), 'Paid to (UPI ID / account / app): ' + (f.paidTo || '[add details]'));
    } else L.push('', 'I have not paid any money so far.');
    if (flags.length) { L.push('', 'Warning signs in the message I received:'); flags.forEach(x => L.push('- ' + x.title.en)); }
    if (f.includeMsg && msg) L.push('', 'Message received:', '"' + msg + '"');
    L.push('', 'Request: Please examine this matter and take appropriate action against the persons/entity involved.' + (f.scenario === 'lost' ? ' Please also guide me on the steps to try to recover my money.' : ''));
    L.push('', 'I declare that the above is true to the best of my knowledge.', '', f.name || '[Your name]', 'Contact: ' + (f.phone || '[Your phone / email]'), '', 'Attachments I will upload: screenshots of the chat, payment receipts / bank statement, screenshots of the app or website.');
    return L.join('\n');
  }
  function draftHi(f, flags, msg) {
    const m = I18N.hi['mode_' + f.mode];
    const L = [];
    L.push('विषय: संदिग्ध निवेश धोखाधड़ी / भ्रामक निवेश प्रस्ताव के संबंध में शिकायत', '');
    L.push('सेवा में,', 'संबंधित अधिकारी', '(SEBI SCORES / राष्ट्रीय साइबर अपराध रिपोर्टिंग पोर्टल)', '');
    L.push('शिकायतकर्ता: ' + (f.name || '[आपका नाम]') + (f.city ? ', ' + f.city : ''));
    if (f.date) L.push('घटना की तारीख: ' + f.date);
    L.push('संपर्क का माध्यम: ' + m);
    if (f.contacts) L.push('दूसरे पक्ष का विवरण (फ़ोन / लिंक / हैंडल): ' + f.contacts);
    L.push('', 'क्या हुआ:', f.what || '[अपने शब्दों में संक्षेप में लिखें]');
    if (f.scenario === 'lost') {
      L.push('', 'भेजी / गँवाई गई रकम: ₹' + (f.amount || '[रकम]'), 'किसे भेजा (UPI ID / खाता / ऐप): ' + (f.paidTo || '[विवरण जोड़ें]'));
    } else L.push('', 'मैंने अब तक कोई पैसा नहीं भेजा है।');
    if (flags.length) { L.push('', 'प्राप्त संदेश में चेतावनी के संकेत:'); flags.forEach(x => L.push('- ' + x.title.hi)); }
    if (f.includeMsg && msg) L.push('', 'प्राप्त संदेश:', '"' + msg + '"');
    L.push('', 'निवेदन: कृपया इस मामले की जाँच कर संबंधित व्यक्तियों/संस्था के विरुद्ध उचित कार्रवाई करें।' + (f.scenario === 'lost' ? ' साथ ही मेरी रकम वापस पाने के प्रयास के लिए मार्गदर्शन दें।' : ''));
    L.push('', 'मैं घोषणा करता/करती हूँ कि उपरोक्त जानकारी मेरी जानकारी में सही है।', '', f.name || '[आपका नाम]', 'संपर्क: ' + (f.phone || '[फ़ोन / ईमेल]'), '', 'संलग्न करूँगा/करूँगी: चैट के स्क्रीनशॉट, भुगतान की रसीदें / बैंक स्टेटमेंट, ऐप या वेबसाइट के स्क्रीनशॉट।');
    return L.join('\n');
  }
  function buildDraft() {
    const f = formVals();
    $('#draft').value = (f.dlang === 'hi' ? draftHi : draftEn)(f, last ? last.flags : [], lastText);
  }
  function openComplaint() {
    $('#f-contacts').value = last ? last.extracted.phones.concat(last.extracted.links).join(', ') : '';
    $('#f-dlang').value = lang;
    $$('#f-mode option').forEach(o => { o.textContent = T('mode_' + o.value); });
    show('screen-complain');
    buildDraft();
  }
  async function copyDraft() {
    const ta = $('#draft');
    try { await navigator.clipboard.writeText(ta.value); } catch (e) { ta.select(); document.execCommand('copy'); }
    const b = $('#btn-copy'), old = b.textContent;
    b.textContent = T('cCopied'); setTimeout(() => { b.textContent = old; }, 1500);
  }
  function downloadDraft() {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([$('#draft').value], { type: 'text/plain;charset=utf-8' }));
    a.download = 'complaint-draft.txt';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }

  /* ---------- wiring ---------- */
  document.addEventListener('click', e => {
    const lb = e.target.closest('.lang button');
    if (lb) { lang = lb.dataset.lang; applyLang(); return; }
    const sm = e.target.closest('[data-sample]');
    if (sm) { $('#msg').value = SAMPLES[+sm.dataset.sample]; status(''); runCheck(); return; }
    const act = e.target.closest('[data-act]');
    if (!act) return;
    const a = act.dataset.act;
    if (a === 'listen') speak();
    else if (a === 'complain') openComplaint();
    else if (a === 'again') { window.speechSynthesis && speechSynthesis.cancel(); show('screen-input'); }
    else if (a === 'toresult') show('screen-result');
  });
  $('#btn-check').addEventListener('click', runCheck);
  $('#btn-clear').addEventListener('click', () => { $('#msg').value = ''; status(''); $('#msg').focus(); });
  $('#btn-mic').addEventListener('click', toggleMic);
  $('#btn-shot').addEventListener('click', () => $('#file').click());
  $('#file').addEventListener('change', e => { const f = e.target.files[0]; if (f) ocr(f); e.target.value = ''; });
  $('#btn-build').addEventListener('click', buildDraft);
  $('#btn-copy').addEventListener('click', copyDraft);
  $('#btn-dl').addEventListener('click', downloadDraft);
  $('#f-dlang').addEventListener('change', buildDraft);
  $$('input[name=scn]').forEach(r => r.addEventListener('change', () => { $('#lostbox').hidden = (formVals().scenario !== 'lost'); buildDraft(); }));

  applyLang();
  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
})();
