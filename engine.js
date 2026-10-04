/* Sachet detection engine — runs fully on-device. No network calls, no storage.
 * analyze(text) -> { level, score, flags[], notes[], extracted{links,phones} }
 * It is a PATTERN check. It never returns a true/false verdict and never recommends any instrument.
 */
(function (root) {
  'use strict';

  const TLDS = new Set(['com','in','net','org','co','io','xyz','top','vip','site','club','online','click','shop','app','me','ly','gov','info','biz','live','link','cc','page','icu','fun','store','tech','ai','buzz','tk','ml','ga','cf','gq','edu','ac','nic']);
  const ODD_TLDS = new Set(['xyz','top','vip','site','club','online','click','shop','icu','fun','live','link','cc','buzz','store','tk','ml','ga','cf','gq']);
  const SHORTENERS = new Set(['bit.ly','tinyurl.com','cutt.ly','rb.gy','t.ly','is.gd','shorturl.at','goo.gl','rebrand.ly','tiny.cc']);
  const INVITE_HOSTS = ['t.me','telegram.me','chat.whatsapp.com','wa.me','discord.gg'];
  // Curated sample of official domains. Extend before real-world use.
  const OFFICIAL = ['zerodha.com','upstox.com','groww.in','angelone.in','angelbroking.com','icicidirect.com','icicibank.com','hdfcsec.com','hdfcbank.com','kotaksecurities.com','kotak.com','nseindia.com','bseindia.com','sebi.gov.in','nsdl.co.in','nsdl.com','cdslindia.com','paytm.com','paytmmoney.com','sharekhan.com','motilaloswal.com','5paisa.com'];
  const BRANDS = ['zerodha','upstox','groww','angelone','angelbroking','icici','hdfc','kotak','nse','bse','nseindia','bseindia','sebi','nsdl','cdsl','paytm','sharekhan','motilal','5paisa'];

  const VALID_REG = /\bIN[ABHMPRZ]\d{9}\b/i;

  const clip = s => String(s).trim().replace(/\s+/g, ' ').slice(0, 90);
  const negated = (t, i) => /(never|don'?t|do\s*not|not\s+to|should\s*not|कभी\s*न|कभी\s*नहीं|मत|न\s*करें)\s*[^.\n]{0,35}$/i.test(t.slice(Math.max(0, i - 45), i));

  function first(re, text, skipNeg) {
    const g = new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g');
    let m;
    while ((m = g.exec(text))) {
      if (m[0].length === 0) { g.lastIndex++; continue; }
      if (!(skipNeg && negated(text, m.index))) return clip(m[0]);
    }
    return null;
  }

  function extractLinks(text) {
    const out = [];
    const re = /(?:https?:\/\/)?(?:www\.)?((?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+([a-z]{2,10}))(?:[\/:?#][^\s]*)?/gi;
    let m;
    while ((m = re.exec(text))) {
      if (text[m.index - 1] === '@') continue;
      const host = m[1].toLowerCase(), tld = m[2].toLowerCase();
      if (!TLDS.has(tld)) continue;
      out.push({ raw: m[0].replace(/[.,;:!?)\]]+$/, ''), host, tld });
    }
    return out;
  }

  const isOfficial = h => OFFICIAL.some(o => h === o || h.endsWith('.' + o)) || h.endsWith('.gov.in') || h.endsWith('.nic.in');
  const brandIn = h => {
    const tokens = h.split(/[.\-_]/);
    return BRANDS.some(b => tokens.some(k => k === b || (b.length >= 4 && (k.startsWith(b) || k.endsWith(b)))));
  };

  const CEL = "finance\\s*minister|nirmala|sitharaman|ambani|ratan\\s*tata|narayana?\\s*murthy|sudha\\s*murty|warren\\s*buffett|elon\\s*musk|modi|वित्त\\s*मंत्री|अंबानी|रतन\\s*टाटा|मोदी";
  const INV = "invest|platform|app|scheme|yojana|निवेश|ऐप|योजना";

  const RE = {
    guaranteed: /guarantee[ds]?|assured\s*(?:returns?|profit)|fixed\s*returns?|(?:100|99)\s*%\s*(?:safe|profit|sure|accura\w+|success)|risk[\s-]?free|no[\s-]?risk|loss[\s-]?free|गारंटी|पक्का\s*(?:मुनाफ\u093C?ा|फायदा)|निश्चित\s*(?:लाभ|मुनाफ\u093C?ा|रिटर्न)|ज\u093C?ीरो\s*रिस्क|बिना\s*रिस्क/i,
    multiple: /\b(?:double|triple|[2-9]x|\d{2}x)\b[^.\n]{0,40}?(?:days?|weeks?|months?|din|हफ\S{0,2}ते|दिन|महीने)/i,
    doubleHi: /(?:पैसा|पैसे|रकम|निवेश)[^।.\n]{0,15}(?:दोगुना|तिगुना|डबल)|(?:दोगुना|तिगुना|डबल)[^।.\n]{0,15}(?:पैसा|पैसे|रकम|निवेश)/i,
    urgency: /limited\s*(?:time|seats?|slots?|period|offer)|hurry|last\s*chance|today\s*only|act\s*now|join\s*(?:now|today|fast|immediately)|only\s*\d+\s*(?:seats?|slots?|spots?)|offer\s*(?:ends|expires)|(?:within|in)\s*(?:the\s*next\s*)?\d+\s*(?:hours?|hrs|minutes?)|abhi\s*join|jaldi|aaj\s*hi|जल्दी|आज\s*ही|आखिरी\s*मौका|सीमित\s*(?:सीट|समय)|अभी\s*जुड़ें|\d+\s*(?:घंटे|घण्टे)\s*में/i,
    tipstyle: /sure[\s-]?shot|jackpot|multi[\s-]?bagger|target\s*(?:price)?\s*[:\-]?\s*(?:rs\.?|₹)?\s*\d+|target\b\s*\d|stop[\s-]?loss|buy\s*(?:above|at|near|now|today)|intraday\s*(?:tips?|calls?)|(?:stock|trading|option)\s*(?:tips?|calls?)|rocket|bumper\s*(?:profit|return)|टिप्स?|रॉकेट|धमाका|बम्पर\s*(?:मुनाफ\u093C?ा|रिटर्न)/i,
    pump: /operator|upper\s*circuit|lower\s*circuit|\bpump\b|big\s*players?|insider|inside\s*(?:information|news|tip)|bulk\s*deal\s*(?:tip|info)|kal\s*[^.\n]{0,25}(?:rocket|upar|upper|circuit)|ऑपरेटर|अपर\s*सर्किट|अंदर\s*की\s*(?:खबर|जानकारी)|इनसाइडर/i,
    paymentask: /(?:registration|activation|processing|joining|membership|subscription|verification|demat|kyc)\s*(?:fees?|charges?|amount|deposit)|(?:pay|send|transfer|deposit|जमा\s*करें|भेजें)[^.\n]{0,40}(?:fees?|charges|margin|deposit|activate|activation|रजिस्ट्रेशन|मार्जिन)|(?:margin|security)\s*deposit|(?:phonepe|gpay|google\s*pay|paytm|upi)\s*(?:karo|kar\s*do|करो|करें|number|no\.?|id)|रजिस्ट्रेशन\s*फ\u093C?ीस|पेमेंट\s*करो/i,
    withdrawal: /(?:withdraw(?:al)?|निकालने|विड्रॉल)[^.\n]{0,50}(?:fees?|tax|charges?|deposit|verification|unlock|टैक्स|चार्ज|फ\u093C?ीस)|(?:fees?|tax|charges?|टैक्स|चार्ज)[^.\n]{0,40}(?:to\s*withdraw|before\s*withdraw|निकालने)/i,
    otp: /(?:share|send|tell|give|forward|बताएं|बताओ|बताइए|भेजें|शेयर)[^.\n]{0,25}(?:otp|pin|cvv|password|पासवर्ड|ओटीपी)|(?:otp|ओटीपी|cvv|pin)[^.\n]{0,20}(?:share|send|tell|बताएं|बताओ|बताइए|भेजें)|\botp\b[^.\n]{0,15}(?:batao|bataiye|bhejo)/i,
    remote: /any\s?desk|team\s?viewer|quick\s?support|rust\s?desk|ammyy|ultra\s?viewer|screen\s?shar(?:e|ing)|remote\s*(?:access|support|control)|एनीडेस्क|टीमव्यूअर|स्क्रीन\s*शेयर/i,
    sebiClaim: /sebi[\s-]*(?:registered|approved|certified|verified|authori[sz]ed|licensed)|registered\s*(?:with|by|under)\s*sebi|सेबी\s*(?:रजिस्टर्ड|पंजीकृत|अप्रूव्ड|मान्य|प्रमाणित)/i,
    sebiNo: /sebi[\s-]*(?:registration|regn|reg)(?![a-z])\.?\s*(?:no\.?|number|#)?\s*[:\-]?\s*([A-Za-z0-9\/\-]{3,})/i,
    fear: /(?:account|खाता|डीमैट|demat)[^.\n]{0,30}(?:block(?:ed)?|freeze|frozen|suspend(?:ed)?|close[ds]?|बंद|ब्लॉक|फ्रीज\u093C?)|legal\s*action|arrest|court\s*notice|(?:fir|case)\s*(?:file|register)|गिरफ्तार|कानूनी\s*कार्रवाई|वारंट|जेल/i,
    celeb: new RegExp('(?:' + CEL + ')[^.\\n]{0,60}(?:' + INV + ')|(?:' + INV + ')[^.\\n]{0,60}(?:' + CEL + ')', 'i'),
    app: /(?:download|install|डाउनलोड|इंस्टॉल)[^.\n]{0,30}(?:app|apk|ऐप|एप)|\.apk\b|(?:ai|bot|auto)[\s-]*trading[\s-]*(?:bot|software|app)?|arbitrage|crypto|usdt|forex|binary\s*option|bitcoin/i,
    ipo: /(?:institutional|vip|hni|pre[\s-]?ipo|block\s*deal|qib|anchor)\s*(?:account|quota|allotment|client|shares?|ipo)|guarantee[ds]?\s*(?:ipo\s*)?allot(?:ment)?|unlisted\s*shares?|ipo\s*(?:allotment)?\s*(?:guarantee|sure)|इंस्टीट्यूशनल\s*अकाउंट|आईपीओ\s*(?:अलॉटमेंट|गारंटी)/i,
    secrecy: /(?:don'?t|do\s*not|never)\s*(?:tell|inform)[^.\n]{0,20}(?:anyone|anybody|family|others?|bank)|keep\s*(?:it\s*)?(?:secret|confidential)|between\s*us|किसी\s*को\s*(?:मत|न)\s*बता|गोपनीय\s*रखें|kisi\s*ko\s*mat\s*bata/i,
    invite: /(?:join|जुड़ें|जुड़िए)[^.\n]{0,30}(?:vip|premium|group|channel|ग्रुप|चैनल)|(?:vip|premium)\s*(?:group|channel|ग्रुप|चैनल)/i
  };

  const DEFS = [
    { id: 'guaranteed', weight: 30,
      test: t => first(RE.guaranteed, t),
      title: { en: 'Promises guaranteed or risk-free returns', hi: 'गारंटीड या बिना जोखिम के मुनाफ़े का वादा' },
      why: { en: 'No genuine investment can guarantee returns. Markets go up and down; anyone promising a sure profit is lying or hiding the risk. SEBI rules do not allow registered advisers to guarantee returns.',
             hi: 'कोई भी असली निवेश मुनाफ़े की गारंटी नहीं दे सकता। बाज़ार ऊपर-नीचे होता है। पक्के मुनाफ़े का वादा करने वाला या तो झूठ बोल रहा है या जोखिम छिपा रहा है। SEBI के नियम रजिस्टर्ड सलाहकारों को रिटर्न की गारंटी देने की अनुमति नहीं देते।' } },
    { id: 'highreturn', weight: 25,
      test: t => {
        const g = /(\d{1,4}(?:\.\d+)?)\s*(?:%|percent|प्रतिशत)[^.\n]{0,30}?(daily|per\s*day|a\s*day|every\s*day|weekly|per\s*week|a\s*week|monthly|per\s*month|a\s*month|रोज|प्रतिदिन|हफ\S{0,2}ते|साप्ताहिक|महीने|मासिक)/gi;
        let m;
        while ((m = g.exec(t))) {
          const v = parseFloat(m[1]), u = m[2].toLowerCase();
          const day = /day|रोज|प्रतिदिन/.test(u), week = /week|हफ|साप्ताहिक/.test(u);
          if (v >= (day ? 1 : week ? 3 : 10)) return clip(m[0]);
        }
        const g2 = /(daily|per\s*day|every\s*day|weekly|every\s*week|रोज|प्रतिदिन)\s*(\d{1,4}(?:\.\d+)?)\s*(?:%|percent|प्रतिशत)/gi;
        while ((m = g2.exec(t))) {
          const v = parseFloat(m[2]), u = m[1].toLowerCase();
          const week = /week/.test(u);
          if (v >= (week ? 3 : 1)) return clip(m[0]);
        }
        return first(RE.multiple, t) || first(RE.doubleHi, t);
      },
      title: { en: 'Unrealistically high returns', hi: 'अवास्तविक रूप से ज़्यादा रिटर्न' },
      why: { en: 'A few percent every day, or money doubling in days, is far beyond what any real market investment offers. It is the most common sign of a Ponzi-style or fake-trading scheme.',
             hi: 'रोज़ या हफ़्ते में कई प्रतिशत, या कुछ दिनों में पैसा दोगुना होना किसी भी असली निवेश में संभव नहीं है। यह पोंज़ी या नकली ट्रेडिंग स्कीम की सबसे आम निशानी है।' } },
    { id: 'urgency', weight: 12,
      test: t => first(RE.urgency, t),
      title: { en: 'Pressure to act fast', hi: 'जल्दबाज़ी का दबाव' },
      why: { en: 'Scammers rush you so you do not stop to think or ask someone. A genuine opportunity will still be there tomorrow.',
             hi: 'ठग आपको जल्दी में रखते हैं ताकि आप रुककर सोचें या किसी से पूछें नहीं। असली मौका कल भी रहेगा।' } },
    { id: 'tipstyle', weight: 15,
      test: t => first(RE.tipstyle, t),
      title: { en: 'Stock-tip style language', hi: 'स्टॉक-टिप वाली भाषा' },
      why: { en: '"Sure-shot", targets and stop-losses sold as tips are how tip sellers lure people. Giving paid investment advice without SEBI registration is not allowed, and SEBI\u2019s study found 9 in 10 individual F&O traders lose money.',
             hi: '"सुरे-शॉट", टारगेट और स्टॉप-लॉस वाली टिप्स बेचकर लोगों को फँसाया जाता है। बिना SEBI रजिस्ट्रेशन के पैसे लेकर निवेश सलाह देना मना है। SEBI के अध्ययन में 10 में से 9 छोटे F&O ट्रेडर घाटे में रहे।' } },
    { id: 'pump', weight: 20,
      test: t => first(RE.pump, t),
      title: { en: 'Operator / inside-information claims', hi: 'ऑपरेटर / अंदर की ख़बर का दावा' },
      why: { en: 'Talk of "operators", circuits or inside news is the classic pump-and-dump pattern: scammers hype a stock, sell their own shares, and leave you with the loss. Trading on inside information is itself illegal.',
             hi: '"ऑपरेटर", सर्किट या अंदर की ख़बर की बात पंप-एंड-डंप का पुराना तरीका है: ठग हाइप से शेयर चढ़ाते हैं, अपने शेयर बेच देते हैं और नुकसान आपके हिस्से आता है। अंदरूनी जानकारी पर ट्रेडिंग ख़ुद गैरकानूनी है।' } },
    { id: 'paymentask', weight: 25, critical: true,
      test: t => first(RE.paymentask, t),
      title: { en: 'Asks you to pay a fee or deposit', hi: 'फ़ीस या डिपॉज़िट माँगा जा रहा है' },
      why: { en: 'Regulated brokers and advisers do not ask you to send "registration fees" or deposits to a personal UPI or phone number. Money sent this way is very hard to recover.',
             hi: 'रेगुलेटेड ब्रोकर या सलाहकार किसी निजी UPI/फ़ोन नंबर पर "रजिस्ट्रेशन फ़ीस" या डिपॉज़िट नहीं माँगते। ऐसे भेजा गया पैसा वापस पाना बहुत मुश्किल होता है।' } },
    { id: 'withdrawal', weight: 30, critical: true,
      test: t => first(RE.withdrawal, t),
      title: { en: 'Fee or tax demanded before you can withdraw', hi: 'पैसे निकालने से पहले फ़ीस/टैक्स की माँग' },
      why: { en: 'A classic trap: the app shows big profits, then asks for "tax" or "fees" to release your money. Every payment is followed by a new demand.',
             hi: 'यह पुरानी चाल है: ऐप में बड़ा मुनाफ़ा दिखता है, फिर पैसे निकालने के लिए "टैक्स" या "फ़ीस" माँगी जाती है। हर भुगतान के बाद नई माँग आती है।' } },
    { id: 'otp', weight: 40, critical: true,
      test: t => first(RE.otp, t, true),
      title: { en: 'Asks for OTP, PIN or password', hi: 'OTP, PIN या पासवर्ड माँगा जा रहा है' },
      why: { en: 'Nobody genuine \u2014 not a broker, a bank or SEBI \u2014 will ever ask for your OTP, PIN or password. Sharing an OTP can let someone empty your account.',
             hi: 'कोई भी असली व्यक्ति \u2014 ब्रोकर, बैंक या SEBI \u2014 आपसे OTP, PIN या पासवर्ड कभी नहीं माँगता। OTP बताने से आपका खाता खाली हो सकता है।' } },
    { id: 'remote', weight: 40, critical: true,
      test: t => first(RE.remote, t, true),
      title: { en: 'Asks you to install a remote-access / screen-sharing app', hi: 'रिमोट-एक्सेस / स्क्रीन-शेयर ऐप इंस्टॉल करने को कहा गया' },
      why: { en: 'Apps like AnyDesk let someone see and control your phone, including your banking apps. Never install them at a stranger\u2019s request.',
             hi: 'AnyDesk जैसे ऐप से कोई आपके फ़ोन को देख और चला सकता है, बैंकिंग ऐप समेत। किसी अनजान के कहने पर इन्हें कभी इंस्टॉल न करें।' } },
    { id: 'fakesebi', weight: 20,
      test: t => {
        const num = VALID_REG.test(t);
        const bad = t.match(RE.sebiNo);
        if (bad && !VALID_REG.test(bad[1])) return clip(bad[0]);
        const claim = first(RE.sebiClaim, t);
        if (claim && !num) return claim;
        return null;
      },
      title: { en: 'SEBI registration claimed but not shown properly', hi: 'SEBI रजिस्ट्रेशन का दावा, पर सही नंबर नहीं' },
      why: { en: 'Scammers often write "SEBI registered" or quote a made-up number. A real number looks like INH000000000 (analyst) or INA000000000 (adviser) and must match the person\u2019s name on SEBI\u2019s official list.',
             hi: 'ठग अक्सर "SEBI रजिस्टर्ड" लिखते हैं या नकली नंबर देते हैं। असली नंबर INH000000000 (एनालिस्ट) या INA000000000 (सलाहकार) जैसा दिखता है और SEBI की आधिकारिक सूची में उसी व्यक्ति के नाम से मिलना चाहिए।' } },
    { id: 'fear', weight: 20,
      test: t => first(RE.fear, t),
      title: { en: 'Threats or fear tactics', hi: 'डराने-धमकाने वाली बातें' },
      why: { en: 'Messages saying your account will be blocked or that you face legal action try to scare you into obeying. Regulators and brokers do not threaten you over WhatsApp or phone calls.',
             hi: 'खाता ब्लॉक होने या कानूनी कार्रवाई की बात आपको डराकर आदेश मनवाने के लिए होती है। नियामक या ब्रोकर WhatsApp या फ़ोन पर धमकी नहीं देते।' } },
    { id: 'celeb', weight: 15,
      test: t => first(RE.celeb, t),
      title: { en: 'Famous person tied to an investment', hi: 'मशहूर हस्ती के नाम पर निवेश का प्रचार' },
      why: { en: 'Fake videos and ads using well-known faces are common, and deepfakes can make someone appear to back a scheme. Check the person\u2019s or company\u2019s official channel yourself.',
             hi: 'नामी चेहरों वाले नकली वीडियो और विज्ञापन आम हैं। डीपफ़ेक से किसी को स्कीम का समर्थन करते दिखाया जा सकता है। उनके आधिकारिक चैनल पर ख़ुद जाँचें।' } },
    { id: 'app', weight: 18,
      test: t => first(RE.app, t),
      title: { en: 'Asks you to install an app, or mentions crypto / forex / trading bots', hi: 'ऐप इंस्टॉल करने या क्रिप्टो/फ़ॉरेक्स/बॉट ट्रेडिंग की बात' },
      why: { en: 'Fake trading apps show made-up profits. Apps sent through links or APK files are not from official app stores and can steal data. Crypto, forex and "AI bots" are common bait.',
             hi: 'नकली ट्रेडिंग ऐप में गढ़ा हुआ मुनाफ़ा दिखाया जाता है। लिंक या APK से आने वाले ऐप आधिकारिक स्टोर के नहीं होते और डेटा चुरा सकते हैं। क्रिप्टो, फ़ॉरेक्स और "AI बॉट" आम चारा हैं।' } },
    { id: 'ipo', weight: 22,
      test: t => first(RE.ipo, t),
      title: { en: '"Institutional account" or guaranteed IPO allotment offer', hi: '"इंस्टीट्यूशनल अकाउंट" / IPO अलॉटमेंट की गारंटी' },
      why: { en: 'IPO allotment follows fixed rules and lotteries; nobody can guarantee it. "Institutional" or "VIP" accounts sold to ordinary investors are a known scam pattern.',
             hi: 'IPO अलॉटमेंट तय नियमों और लॉटरी से होता है, इसकी गारंटी कोई नहीं दे सकता। आम निवेशकों को "इंस्टीट्यूशनल" या "VIP" अकाउंट बेचना जानी-पहचानी ठगी है।' } },
    { id: 'secrecy', weight: 15,
      test: t => first(RE.secrecy, t),
      title: { en: 'Asks you to keep it secret', hi: 'किसी को न बताने की सलाह' },
      why: { en: 'Scammers isolate you so family cannot warn you. Talk to someone you trust before acting.',
             hi: 'ठग चाहते हैं कि घर वाले आपको रोक न सकें। कुछ करने से पहले किसी भरोसेमंद व्यक्ति से बात करें।' } },
    { id: 'groupinvite', weight: 12,
      test: (t, c) => {
        const l = c.links.find(x => INVITE_HOSTS.some(h => x.host === h || x.host.endsWith('.' + h)));
        return l ? clip(l.raw) : first(RE.invite, t);
      },
      title: { en: 'Invites you to a WhatsApp/Telegram "VIP" group', hi: 'WhatsApp/Telegram "VIP" ग्रुप में बुलाया जा रहा है' },
      why: { en: 'Tip groups are the main channel for pump-and-dump schemes. Many members are fake accounts posting fake profit screenshots.',
             hi: 'टिप ग्रुप पंप-एंड-डंप का मुख्य ज़रिया हैं। इनके कई मेंबर नकली अकाउंट होते हैं जो नकली मुनाफ़े के स्क्रीनशॉट डालते हैं।' } },
    { id: 'shortlink', weight: 10,
      test: (t, c) => { const l = c.links.find(x => SHORTENERS.has(x.host)); return l ? clip(l.raw) : null; },
      title: { en: 'Hidden link (shortened URL)', hi: 'छिपा हुआ लिंक (छोटा URL)' },
      why: { en: 'A shortened link hides where it really goes. Do not open it; if needed, type the official website address yourself.',
             hi: 'छोटा लिंक असली पता छिपा देता है। उसे न खोलें; ज़रूरत हो तो आधिकारिक वेबसाइट ख़ुद टाइप करें।' } },
    { id: 'oddtld', weight: 10,
      test: (t, c) => { const l = c.links.find(x => ODD_TLDS.has(x.tld) && !INVITE_HOSTS.includes(x.host)); return l ? clip(l.raw) : null; },
      title: { en: 'Unusual website address', hi: 'अजीब वेबसाइट पता' },
      why: { en: 'Real brokers and regulators use well-known addresses (.com, .in, .gov.in). Endings like .vip, .xyz or .top are common on throwaway scam sites.',
             hi: 'असली ब्रोकर और नियामक जाने-पहचाने पते (.com, .in, .gov.in) इस्तेमाल करते हैं। .vip, .xyz, .top जैसे अंत वाले पते अक्सर कुछ दिन चलने वाली ठग साइटों पर होते हैं।' } },
    { id: 'lookalike', weight: 45, critical: true,
      test: (t, c) => { const l = c.links.find(x => !isOfficial(x.host) && brandIn(x.host)); return l ? clip(l.host) : null; },
      title: { en: 'Link imitates a known broker or regulator', hi: 'लिंक किसी जाने-माने ब्रोकर/नियामक की नक़ल करता है' },
      why: { en: 'The address contains a well-known name but is not that organisation\u2019s real website. This is how cloned login and trading portals are made.',
             hi: 'पते में मशहूर नाम है पर यह उस संस्था की असली वेबसाइट नहीं है। नकली लॉगिन और ट्रेडिंग पोर्टल ऐसे ही बनते हैं।' } }
  ];

  function analyze(raw) {
    const text = String(raw || '').normalize('NFC');
    const links = extractLinks(text);
    const phones = Array.from(new Set((text.match(/(?:\+?91[\s-]?)?[6-9]\d{9}\b/g) || []).map(s => s.trim())));
    const ctx = { links };
    const flags = [];
    for (const d of DEFS) {
      const ev = d.test(text, ctx);
      if (ev) flags.push({ id: d.id, weight: d.weight, critical: !!d.critical, title: d.title, why: d.why, evidence: ev });
    }
    flags.sort((a, b) => (b.critical - a.critical) || (b.weight - a.weight));
    const score = Math.min(100, flags.reduce((s, f) => s + f.weight, 0));
    const critical = flags.some(f => f.critical);
    const level = (critical || score >= 50) ? 'high' : score >= 20 ? 'medium' : score > 0 ? 'low' : 'none';

    const notes = [];
    const reg = text.match(VALID_REG);
    if (reg) {
      notes.push({
        en: 'A registration number in the right format was found (' + reg[0].toUpperCase() + '). Anyone can type a valid-looking number \u2014 check that the number AND the name match on SEBI\u2019s official list.',
        hi: 'सही फ़ॉर्मेट का रजिस्ट्रेशन नंबर मिला (' + reg[0].toUpperCase() + ')। कोई भी ऐसा दिखने वाला नंबर लिख सकता है \u2014 SEBI की आधिकारिक सूची में नंबर और नाम दोनों मिलाएँ।'
      });
    }
    return { level, score, flags, notes, extracted: { links: links.map(l => l.raw), phones } };
  }

  const api = { analyze };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Sachet = api;
})(typeof window !== 'undefined' ? window : globalThis);
