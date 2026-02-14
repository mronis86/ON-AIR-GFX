/**
 * ON-AIR GFX – Live CSV server for Google Sheets
 * GET /live-qa-csv?eventId=xxx → CSV of active Q&A from Firestore (REST API).
 * Set env: FIREBASE_API_KEY, FIREBASE_PROJECT_ID (same as your .env).
 * Deploy to Railway (or any Node host) – no Firebase Blaze needed.
 */
const express = require('express');
const app = express();

const PORT = process.env.PORT || 3000;
const API_KEY = process.env.FIREBASE_API_KEY;
const PROJECT_ID = process.env.FIREBASE_PROJECT_ID;

function escapeCsv(s) {
  if (s == null) s = '';
  const t = String(s).replace(/"/g, '""');
  return /[,"\n\r]/.test(t) ? `"${t}"` : t;
}

async function getLiveState(eventId) {
  const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/liveState/${encodeURIComponent(eventId)}?key=${encodeURIComponent(API_KEY)}`;
  const res = await fetch(url);
  if (res.status === 404) return {}; // No live state yet – app hasn't written for this event
  if (!res.ok) throw new Error(await res.text());
  const json = await res.json();
  return json.fields || {};
}

function parseValue(v) {
  if (!v) return null;
  if (v.nullValue !== undefined) return null;
  if (v.stringValue !== undefined) return v.stringValue;
  if (v.integerValue !== undefined) return parseInt(v.integerValue, 10);
  if (v.doubleValue !== undefined) return v.doubleValue;
  if (v.booleanValue !== undefined) return v.booleanValue;
  if (v.timestampValue !== undefined) return v.timestampValue;
  if (v.mapValue && v.mapValue.fields) {
    const obj = {};
    for (const k of Object.keys(v.mapValue.fields)) {
      obj[k] = parseValue(v.mapValue.fields[k]);
    }
    return obj;
  }
  if (v.arrayValue && v.arrayValue.values) {
    return v.arrayValue.values.map(parseValue);
  }
  return null;
}

function parseFields(fields) {
  const out = {};
  for (const key of Object.keys(fields)) {
    out[key] = parseValue(fields[key]);
  }
  return out;
}

app.use((req, res, next) => {
  res.set('Access-Control-Allow-Origin', '*');
  next();
});

app.get('/live-qa-csv', async (req, res) => {
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }
  const eventId = (req.query.eventId || req.query.eventid || '').toString().trim();
  if (!eventId) {
    return res.status(400).set('Content-Type', 'text/plain').send('Missing eventId query parameter');
  }
  if (!API_KEY || !PROJECT_ID) {
    return res.status(500).set('Content-Type', 'text/plain').send('Set FIREBASE_API_KEY and FIREBASE_PROJECT_ID env vars');
  }
  try {
    const fields = await getLiveState(eventId);
    const data = parseFields(fields);
    const q = data.activeQA || null;
    const eventName = data.eventName || '';
    const updatedAt = data.updatedAt != null ? String(data.updatedAt) : '';
    const hasQA = q && (q.question || q.answer || q.submitterName);
    const question = hasQA ? (q.question || '') : '(No active Q&A – set one in Operators and refresh)';
    const answer = hasQA ? (q.answer || '') : '';
    const submitter = hasQA ? (q.submitterName || '') : '';
    const rows = [
      'Question,Answer,Submitter,Event,Updated',
      [escapeCsv(question), escapeCsv(answer), escapeCsv(submitter), escapeCsv(eventName), escapeCsv(updatedAt)].join(','),
    ];
    const csv = '\uFEFF' + rows.join('\r\n');
    res.status(200)
      .set('Content-Type', 'text/csv; charset=utf-8')
      .set('Content-Disposition', 'inline') // so browser may show instead of download; Sheets ignores this
      .send(csv);
  } catch (err) {
    res.status(500).set('Content-Type', 'text/plain').send(err?.message || 'Error');
  }
});

app.get('/', (req, res) => {
  res.set('Content-Type', 'text/plain').send(
    'ON-AIR GFX Live CSV server. Use: GET /live-qa-csv?eventId=YOUR_EVENT_ID'
  );
});

app.listen(PORT, () => {
  console.log(`Live CSV server on port ${PORT}`);
});
