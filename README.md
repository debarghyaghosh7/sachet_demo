# Sachet (सचेत) — Pause. Check. Act.

SANGYAN Investor Resilience Hackathon · Tracks A + E (+ B for the complaint step)

A Hindi/English web app (installable PWA) where a first-time or senior investor pastes, speaks, or screenshots a WhatsApp/Telegram/SMS "tip" and gets:

1. **Check** – an explainable red-flag breakdown with the exact phrase found, shown as a concern level (never a true/false verdict).
2. **Understand** – each flag explained in plain Hindi/English, with read-aloud.
3. **Act** – concrete next steps (1930, cybercrime.gov.in, Sanchar Saathi, SEBI list, SCORES) and a ready-to-file complaint draft built from what they checked.

Everything runs in the browser. No backend, no accounts, no storage, no analytics. Nothing recommends any instrument.

## Run locally
```
python3 -m http.server 8080     # then open http://localhost:8080
node test.js                    # detection-engine tests
```
Microphone / service worker need `https` or `localhost`.

## Deploy (live demo link)
Static site — drag the folder into Netlify Drop, or push to GitHub and enable Pages, or `vercel --prod`. No build step.

## Files
`engine.js` detection rules · `i18n.js` Hindi/English strings · `app.js` UI, voice, OCR, complaint draft · `sw.js` offline cache · `test.js` tests

## Guardrail checklist (for the Trust criterion)
- No buy/sell/hold, no price talk, no broker/instrument promotion, no upsell, no ads.
- No SMS/OTP reading; no PII harvesting. Message analysed locally; complaint form never leaves the device.
- Honest uncertainty: four levels, "not a verdict" disclaimer on every result, "none found ≠ safe".
- Disclosed caveat: browser voice typing may use the browser vendor's speech service; the checking itself never leaves the phone.

## Known limitations (say these in the deck — it builds trust)
- Pattern/rule based; can miss novel scams and over-flag honest messages.
- SEBI number check is **format only**; the app deep-links to SEBI's official list rather than claiming live verification.
- Official-domain list is a small curated sample; extend before real use.
- OCR downloads ~MBs of language data on first use; Hindi OCR accuracy varies.
- Verify the government links in `app.js` (`stepsHtml`) before recording the demo.

## 3–5 min demo video script
1. (0:00) Problem: 9/10 F&O traders lose; tips arrive on WhatsApp. Meet Sunita ji / Rohit, Tier-3 first-time investor.
2. (0:30) Open app in Hindi. Tap "Tip group" sample → show high concern, highlighted phrases, read-aloud in Hindi.
3. (1:30) Tap "Institutional account" → lookalike-domain and fake SEBI number flags. Show the honest note on valid-looking numbers.
4. (2:15) Show "Ordinary notice" → no flags, "this is not a guarantee of safety" (shows no over-claiming).
5. (2:45) Speak a message by voice, upload a screenshot.
6. (3:30) "Prepare complaint draft" → fill fields → Hindi/English draft → copy for SCORES / cybercrime.gov.in.
7. (4:15) Privacy + guardrails, limitations, roadmap.

## Deck outline
Problem → User (persona) → Solution journey (Check → Understand → Act) → Tech (on-device rules, Web Speech, Tesseract OCR, PWA, offline) → Guardrails & privacy → Impact/measurement → Limitations & roadmap (more languages via Bhashini, IVR/WhatsApp front-end, community-reported patterns, optional LLM explanations behind a privacy-preserving proxy).
