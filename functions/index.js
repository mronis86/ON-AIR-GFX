import { onRequest } from 'firebase-functions/v2/https';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

initializeApp();
const db = getFirestore();

const ALLOW_ORIGIN = '*';
const ALLOWED_BASE = 'https://script.google.com/';

function escapeCsv(s) {
  if (s == null) s = '';
  const t = String(s).replace(/"/g, '""');
  return /[,"\n\r]/.test(t) ? `"${t}"` : t;
}

/** GET ?eventId=xxx returns live Q&A as CSV for vMix etc. */
export const liveQaCsv = onRequest(
  { cors: true },
  async (req, res) => {
    res.set('Access-Control-Allow-Origin', ALLOW_ORIGIN);
    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }
    if (req.method !== 'GET') {
      res.status(405).set('Content-Type', 'text/plain').send('Method not allowed');
      return;
    }
    const eventId = (req.query.eventId || req.query.eventid || '').toString().trim();
    if (!eventId) {
      res.status(400).set('Content-Type', 'text/plain').send('Missing eventId query parameter');
      return;
    }
    try {
      const snap = await db.collection('liveState').doc(eventId).get();
      const data = snap.exists ? snap.data() : {};
      const q = data.activeQA || null;
      const eventName = data.eventName || '';
      const updatedAt = data.updatedAt ? (data.updatedAt.toDate ? data.updatedAt.toDate().toISOString() : String(data.updatedAt)) : '';
      const rows = [
        'Question,Answer,Submitter,Event,Updated',
        [escapeCsv(q?.question), escapeCsv(q?.answer), escapeCsv(q?.submitterName), escapeCsv(eventName), escapeCsv(updatedAt)].join(','),
      ];
      const csv = '\uFEFF' + rows.join('\r\n');
      res.status(200).set('Content-Type', 'text/csv; charset=utf-8').send(csv);
    } catch (err) {
      res.status(500).set('Content-Type', 'text/plain').send(err?.message || 'Error');
    }
  }
);

export const sheetProxy = onRequest(
  { cors: true },
  async (req, res) => {
    res.set('Access-Control-Allow-Origin', ALLOW_ORIGIN);
    res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }

    if (req.method !== 'POST') {
      res.status(405).json({ ok: false, error: 'Method not allowed' });
      return;
    }

    const payload = req.body || {};
    const url = payload.url;
    const body = payload.body;

    if (!url || typeof url !== 'string') {
      res.status(400).json({ ok: false, error: 'Missing url' });
      return;
    }
    const trimmed = url.trim();
    if (!trimmed.startsWith(ALLOWED_BASE)) {
      res.status(400).json({ ok: false, error: 'URL must be a Google Apps Script Web App (script.google.com)' });
      return;
    }

    try {
      const proxyRes = await fetch(trimmed, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: typeof body === 'object' ? JSON.stringify(body) : JSON.stringify(payload.body ?? {}),
      });
      const text = await proxyRes.text();
      res.status(proxyRes.status).set('Content-Type', 'application/json').send(text || JSON.stringify({ ok: proxyRes.ok }));
    } catch (err) {
      res.status(502).json({ ok: false, error: err?.message || 'Proxy request failed' });
    }
  }
);
