/**
 * Live CSV server for Railway.
 * GET /live-qa-csv?eventId=xxx returns Q&A as CSV (6 columns).
 * GET /live-poll-csv?eventId=xxx returns Poll as CSV (title, options, votes).
 * Reads from Firestore. Set FIREBASE_PROJECT_ID and FIREBASE_SERVICE_ACCOUNT (JSON string) in Railway env.
 * Version: 2025-02-poll (includes /live-poll-csv endpoint)
 * Caches responses 15s to reduce Firestore reads and avoid quota exhaustion.
 */
const SERVER_VERSION = '2025-02-poll';
const CACHE_TTL_MS = 15000; // 15 seconds - reduces Firestore quota usage
const express = require('express');
const admin = require('firebase-admin');

const app = express();
const PORT = process.env.PORT || 3000;

let db = null;
try {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const saJson = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!projectId || !saJson) {
    console.warn('Set FIREBASE_PROJECT_ID and FIREBASE_SERVICE_ACCOUNT in Railway Variables');
  } else {
    const cred = JSON.parse(saJson);
    admin.initializeApp({ credential: admin.credential.cert(cred) });
    db = admin.firestore();
  }
} catch (e) {
  console.error('Firebase init failed:', e.message);
}

function escapeCsv(s) {
  if (s == null) s = '';
  const t = String(s).replace(/"/g, '""');
  return /[,"\n\r]/.test(t) ? `"${t}"` : t;
}

// Simple in-memory cache to reduce Firestore reads (avoids RESOURCE_EXHAUSTED / quota exceeded)
const cache = new Map();
function getCached(key) {
  const ent = cache.get(key);
  if (!ent) return null;
  if (Date.now() > ent.expires) {
    cache.delete(key);
    return null;
  }
  return ent.value;
}
function setCache(key, value) {
  cache.set(key, { value, expires: Date.now() + CACHE_TTL_MS });
}

app.use((req, res, next) => {
  res.set('Access-Control-Allow-Origin', '*');
  next();
});

app.get('/live-qa-csv', async (req, res) => {
  if (!db) {
    res.status(500).set('Content-Type', 'text/plain').send('Server not configured. Set FIREBASE_PROJECT_ID and FIREBASE_SERVICE_ACCOUNT.');
    return;
  }
  const eventId = (req.query.eventId || req.query.eventid || '').toString().trim();
  if (!eventId) {
    res.status(400).set('Content-Type', 'text/plain').send('Missing eventId query parameter');
    return;
  }
  try {
    const liveSnap = await db.collection('liveState').doc(eventId).get();
    const liveData = liveSnap.exists ? liveSnap.data() : {};
    const csvSourceSessionId = liveData.csvSourceSessionId || null;

    let active = null, cue = null, next = null;
    if (csvSourceSessionId) {
      const qaSnap = await db.collection('qa').where('eventId', '==', eventId).get();
      const questions = qaSnap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((q) => q.question && !q.name && q.sessionId === csvSourceSessionId);
      active = questions.find((q) => q.isActive) || null;
      cue = questions.find((q) => q.isQueued) || null;
      next = questions.find((q) => q.isNext) || null;
    }

    const row = [
      escapeCsv(active?.question ?? ''),
      escapeCsv(active?.submitterName ?? ''),
      escapeCsv(cue?.question ?? ''),
      escapeCsv(cue?.submitterName ?? ''),
      escapeCsv(next?.question ?? ''),
      escapeCsv(next?.submitterName ?? ''),
    ].join(',');
    const rows = ['Question ACTIVE,Name ACTIVE,Question Cue,Name Cue,Question Next,Name Next', row];
    const csv = '\uFEFF' + rows.join('\r\n');
    setCache(cacheKey, csv);
    res.status(200).set('Content-Type', 'text/csv; charset=utf-8').send(csv);
  } catch (err) {
    res.status(500).set('Content-Type', 'text/plain').send(err?.message || 'Error');
  }
});

app.get('/live-poll-csv', async (req, res) => {
  if (!db) {
    res.status(500).set('Content-Type', 'text/plain').send('Server not configured. Set FIREBASE_PROJECT_ID and FIREBASE_SERVICE_ACCOUNT.');
    return;
  }
  const eventId = (req.query.eventId || req.query.eventid || '').toString().trim();
  if (!eventId) {
    res.status(400).set('Content-Type', 'text/plain').send('Missing eventId query parameter');
    return;
  }
  const cacheKey = `poll:${eventId}`;
  const cached = getCached(cacheKey);
  if (cached) {
    res.status(200).set('Content-Type', 'text/csv; charset=utf-8').send(cached);
    return;
  }
  try {
    const liveSnap = await db.collection('liveState').doc(eventId).get();
    const liveData = liveSnap.exists ? liveSnap.data() : {};
    const csvSourcePollId = liveData.csvSourcePollId || null;

    if (!csvSourcePollId) {
      const rows = ['Title', 'Option,Votes,Percentage,PercentRounded'];
      const csv = '\uFEFF' + rows.join('\r\n');
      res.status(200).set('Content-Type', 'text/csv; charset=utf-8').send(csv);
      return;
    }

    const pollSnap = await db.collection('polls').doc(csvSourcePollId).get();
    if (!pollSnap.exists) {
      const rows = ['Title', 'Option,Votes,Percentage,PercentRounded'];
      const csv = '\uFEFF' + rows.join('\r\n');
      res.status(200).set('Content-Type', 'text/csv; charset=utf-8').send(csv);
      return;
    }

    const poll = { id: pollSnap.id, ...pollSnap.data() };
    if (poll.eventId !== eventId) {
      const rows = ['Title', 'Option,Votes,Percentage,PercentRounded'];
      const csv = '\uFEFF' + rows.join('\r\n');
      res.status(200).set('Content-Type', 'text/csv; charset=utf-8').send(csv);
      return;
    }

    const title = escapeCsv(poll.title ?? '');
    const opts = poll.options ?? [];
    const totalVotes = opts.reduce((sum, o) => sum + (o.votes ?? 0), 0);
    const optRows = opts.map((o) => {
      const v = o.votes ?? 0;
      const pct = totalVotes > 0 ? ((v / totalVotes) * 100).toFixed(1) + '%' : '0%';
      const pctRounded = totalVotes > 0 ? Math.round((v / totalVotes) * 100) + '%' : '0%';
      return [escapeCsv(o.text ?? ''), v, pct, pctRounded].join(',');
    });
    const rows = [title, 'Option,Votes,Percentage,PercentRounded', ...optRows];
    const csv = '\uFEFF' + rows.join('\r\n');
    setCache(cacheKey, csv);
    res.status(200).set('Content-Type', 'text/csv; charset=utf-8').send(csv);
  } catch (err) {
    res.status(500).set('Content-Type', 'text/plain').send(err?.message || 'Error');
  }
});

app.get('/', (req, res) => {
  res.send(`Live CSV server v${SERVER_VERSION}. Use GET /live-qa-csv?eventId=YOUR_EVENT_ID or GET /live-poll-csv?eventId=YOUR_EVENT_ID`);
});

app.listen(PORT, () => {
  console.log(`Live CSV server v${SERVER_VERSION} on port ${PORT} - routes: /live-qa-csv, /live-poll-csv`);
});
