// Run: node test.js
const { analyze } = require('./engine.js');
let fail = 0;
function expect(name, text, pred) {
  const r = analyze(text);
  const ok = pred(r);
  if (!ok) fail++;
  console.log((ok ? 'PASS ' : 'FAIL ') + name + '  -> ' + r.level + ' [' + r.flags.map(f => f.id).join(', ') + ']');
}
const ids = r => r.flags.map(f => f.id);

expect('tip group is high', '🔥 SURE SHOT TIP 🔥 Kal operator is stock me upper circuit lagayenge. Target 3x in 5 din, 100% guaranteed profit. Limited seats! Join our VIP group abhi: https://t.me/vip_profit_calls . SEBI registered analyst. Registration fees Rs 2999 PhonePe karo.',
  r => r.level === 'high' && ['guaranteed', 'pump', 'tipstyle', 'groupinvite', 'fakesebi', 'paymentask', 'highreturn'].every(i => ids(r).includes(i)));
expect('institutional + lookalike is high', 'Dear investor, you are selected for an Institutional Account with guaranteed IPO allotment. Download our app https://zerodha-kite-pro.vip to start. Daily 5% returns. Pay Rs 10,000 margin deposit to activate. SEBI Reg No: 12345. Do not tell anyone. Offer ends today.',
  r => r.level === 'high' && ['ipo', 'lookalike', 'oddtld', 'highreturn', 'fakesebi', 'secrecy'].every(i => ids(r).includes(i)));
expect('hindi block threat + anydesk + otp', 'आपका डीमैट खाता KYC अपडेट न होने से 24 घंटे में ब्लॉक हो जाएगा। कानूनी कार्रवाई होगी। AnyDesk डाउनलोड करें और अपना OTP बताएं। SEBI अधिकारी से बात करें 9876543210',
  r => r.level === 'high' && ['fear', 'remote', 'otp'].every(i => ids(r).includes(i)));
expect('plain MF disclaimer is none', 'Mutual fund investments are subject to market risks. Read all scheme related documents carefully. NAV is updated every business day. Never share your OTP with anyone.',
  r => r.level === 'none');
expect('warning NOT to install anydesk is not flagged', 'Do not install AnyDesk or any screen sharing app if a stranger asks you to.',
  r => !ids(r).includes('remote'));
expect('official link not lookalike', 'Check your broker details at https://www.sebi.gov.in/intermediaries.html and https://scores.sebi.gov.in',
  r => !ids(r).includes('lookalike') && r.level === 'none');
expect('valid-format SEBI number gives note, not flag', 'Research analyst Rahul Sharma, SEBI registered, registration number INH000012345. Research reports are for education only.',
  r => !ids(r).includes('fakesebi') && r.notes.length === 1);
expect('email domain not treated as link', 'Write to support@groww.in for help with your account.',
  r => !ids(r).includes('lookalike'));
expect('shortener flagged', 'See stock list here bit.ly/3abcXYZ', r => ids(r).includes('shortlink'));
expect('withdrawal trap critical', 'Your profit is ready. To withdraw you must pay 20% tax first.',
  r => r.level === 'high' && ids(r).includes('withdrawal'));
expect('empty input safe', '', r => r.level === 'none');
console.log(fail ? '\n' + fail + ' FAILED' : '\nAll passed');
process.exit(fail ? 1 : 0);
