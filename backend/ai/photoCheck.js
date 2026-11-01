// ai/photoCheck.js
//
// Optional, best-effort AI assistance: looks at the photos a citizen attached and reports whether they
// plausibly show a water body, which *possible visible indicators* are present (never "confirmed
// pollution"), and one cautious follow-up question. It is assistive only — it never blocks a report and
// never replaces authority inspection.
//
// Every outcome is reported honestly with a `status`, so the UI can say exactly what happened instead of
// silently showing nothing:
//   ok              – the model looked at the photo(s) and answered
//   not_configured  – no ANTHROPIC_API_KEY on the server
//   failed          – the call or the answer could not be used (reason in `error`)
const fs = require('fs');
const config = require('../config');

const VALID_INDICATORS = [
  'floating_garbage', 'dead_fish', 'algal_growth', 'excessive_vegetation', 'muddy_water', 'foam_froth',
  'possible_discharge_outlet', 'waste_on_bank', 'erosion', 'encroachment_construction', 'oil_sheen', 'discoloured_water',
];

const SYSTEM_PROMPT = `You assist a civic water-body complaint platform in India. You will see 1-3 photos a citizen submitted as evidence of a water-body problem (pond, lake, river, tank, canal, reservoir, wetland, drain).

Judge ONLY what is visibly present. Be useful, not timid: if water is visible and a listed indicator is clearly visible, list it.

Respond with ONLY one JSON object (no prose, no markdown fences):
{
  "relevance": "relevant" | "not_relevant" | "uncertain",
  "water_visible": true | false,
  "indicators": [0-8 items chosen ONLY from: ${VALID_INDICATORS.map((i) => `"${i}"`).join(', ')}],
  "note": "one or two plain sentences describing what is visible, using the wording 'possible visible indicators' and never claiming confirmed pollution or toxicity",
  "followup_question": "one short targeted question for the citizen based on what is visible, or an empty string",
  "followup_options": [2-4 short answer choices for that question, or an empty array]
}

Rules:
- "relevant": a water body or its banks/surroundings (including a drain or channel feeding it) are visible.
- "not_relevant": the photos clearly show something else (selfie, indoor scene, vehicle, document, unrelated object, screenshot).
- "uncertain": too dark, blurry or cropped to tell.
- indicators: floating_garbage = plastic/waste floating on the water; waste_on_bank = rubbish dumped on the bank; algal_growth = green scum or algal-looking surface; excessive_vegetation = dense weeds/hyacinth/reeds covering water; muddy_water = brown/turbid water; discoloured_water = unnatural colour (black, grey, red, blue); foam_froth = foam on the surface; oil_sheen = rainbow/oily film; dead_fish = dead fish visible; possible_discharge_outlet = pipe/drain/outfall entering the water; erosion = collapsed or eroded bank; encroachment_construction = buildings, fill or construction on the bank.
- Never state that water is "polluted", "contaminated" or "toxic" as fact.`;

async function toApiImage(filePath) {
  // The API rejects images over ~5 MB and works best near 1500 px — shrink and normalise to JPEG first.
  try {
    const sharp = require('sharp');
    const buf = await sharp(filePath).rotate().resize({ width: 1568, height: 1568, fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 82 }).toBuffer();
    return { media_type: 'image/jpeg', data: buf.toString('base64') };
  } catch (e) {
    const buf = fs.readFileSync(filePath);
    if (buf.length > 4.5 * 1024 * 1024) throw new Error('image too large to analyse');
    const lower = filePath.toLowerCase();
    const mt = lower.endsWith('.png') ? 'image/png' : lower.endsWith('.webp') ? 'image/webp' : 'image/jpeg';
    return { media_type: mt, data: buf.toString('base64') };
  }
}

function extractJson(text) {
  const clean = String(text || '').replace(/```json|```/gi, '').trim();
  try { return JSON.parse(clean); } catch (e) { /* fall through */ }
  const a = clean.indexOf('{'), b = clean.lastIndexOf('}');
  if (a >= 0 && b > a) return JSON.parse(clean.slice(a, b + 1));
  throw new Error('model did not return JSON');
}

function result(status, extra) {
  return Object.assign({ status, relevance: 'unchecked', water_visible: null, indicators: [], note: '', followup_question: '', followup_options: [], error: '' }, extra || {});
}

function isConfigured() { return !!config.GEMINI_API_KEY; }

async function checkPhotos(filePaths) {
  if (!isConfigured()) {
    return result('not_configured', { note: 'AI photo check is not switched on for this server.' });
  }
  const paths = (Array.isArray(filePaths) ? filePaths : [filePaths]).filter(Boolean).slice(0, 3);
  if (!paths.length) return result('failed', { error: 'no photo to check' });

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 45000);
  try {
    const images = [];
    for (const p of paths) images.push(await toApiImage(p));

    const parts = images.map((im) => ({ inline_data: { mime_type: im.media_type, data: im.data } }));
    parts.push({ text: `Assess ${images.length > 1 ? 'these ' + images.length + ' photos' : 'this photo'} from a water-body report.` });

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${config.GEMINI_MODEL}:generateContent`;
    const resp = await fetch(url, {
      method: 'POST',
      signal: ctrl.signal,
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': config.GEMINI_API_KEY },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: [{ role: 'user', parts }],
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0.2,
          maxOutputTokens: 1500,
          thinkingConfig: { thinkingBudget: 0 },
        },
      }),
    });
    const raw = await resp.text();
    let data; try { data = JSON.parse(raw); } catch (e) { data = null; }

    if (!resp.ok) {
      const msg = (data && data.error && data.error.message) || raw.slice(0, 200);
      console.error(`[ai photo check] HTTP ${resp.status}: ${msg}`);
      const keyBad = resp.status === 401 || resp.status === 403 || /api key/i.test(msg);
      const hint = keyBad ? 'the API key was rejected'
        : resp.status === 404 ? 'the AI model name was not found'
        : resp.status === 429 ? 'the AI service is rate-limited or out of credit'
        : `AI service error ${resp.status}`;
      return result('failed', { error: hint });
    }

    const cand = data && data.candidates && data.candidates[0];
    const text = ((cand && cand.content && cand.content.parts) || []).map((p) => p.text || '').join('');
    if (!text) {
      console.error('[ai photo check] empty answer', cand && cand.finishReason, data && data.promptFeedback);
      return result('failed', { error: 'model did not return JSON' });
    }
    const parsed = extractJson(text);

    const indicators = (Array.isArray(parsed.indicators) ? parsed.indicators : [])
      .map((i) => String(i).toLowerCase().trim())
      .filter((i, idx, arr) => VALID_INDICATORS.includes(i) && arr.indexOf(i) === idx).slice(0, 8);
    const relevance = ['relevant', 'not_relevant', 'uncertain'].includes(parsed.relevance) ? parsed.relevance : 'uncertain';
    if (relevance === 'not_relevant') indicators.length = 0;

    return result('ok', {
      relevance,
      water_visible: typeof parsed.water_visible === 'boolean' ? parsed.water_visible : null,
      indicators,
      note: String(parsed.note || '').slice(0, 400),
      followup_question: String(parsed.followup_question || '').slice(0, 200),
      followup_options: (Array.isArray(parsed.followup_options) ? parsed.followup_options : []).map((o) => String(o).slice(0, 60)).slice(0, 4),
    });
  } catch (e) {
    const reason = e.name === 'AbortError' ? 'the AI service took too long to answer' : e.message;
    console.error('[ai photo check failed]', reason);
    return result('failed', { error: reason });
  } finally {
    clearTimeout(timer);
  }
}

// Backwards-compatible single-photo helper.
function checkPhoto(filePath) { return checkPhotos([filePath]); }

module.exports = { checkPhoto, checkPhotos, isConfigured, VALID_INDICATORS };
