import { onRequest } from 'firebase-functions/v2/https';
import { initializeApp } from 'firebase-admin/app';

initializeApp();

const ALLOW_ORIGIN = '*';
const ALLOWED_BASE = 'https://script.google.com/';

/** CSV endpoint removed – use Railway live-csv-server instead. No Blaze required. */
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
