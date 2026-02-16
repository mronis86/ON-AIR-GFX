/**
 * Live CSV server for Railway.
 * GET /live-qa-csv?eventId=xxx returns Q&A as CSV (6 columns).
 * GET /live-poll-csv?eventId=xxx returns Poll as CSV (title, options, votes).
 * Uses Firestore listeners - cache updates only when data changes (no TTL).
 * vMix can poll every 1s; reads only occur when Firestore data changes.
 * Set FIREBASE_PROJECT_ID and FIREBASE_SERVICE_ACCOUNT (JSON string) in Railway env.
 */
const SERVER_VERSION = '2025-02-listeners';
const express = require('express');
const admin = require('firebase-admin');

const app = express();
const PORT = process.env.PORT || 3000;

// JSON body for sheet-write proxy
app.use(express.json({ limit: '1mb' }));

// Idle timeout: unsubscribe from event if no requests for this long
const LISTENER_IDLE_MS = 30 * 60 * 1000; // 30 minutes

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

// In-memory cache: key -> { value, lastAccessed }
// No TTL - only updated by Firestore listeners
const cache = new Map();
const eventListeners = new Map(); // eventId -> { unsubs, lastAccessed, data }

function getCached(key) {
  const ent = cache.get(key);
  if (!ent) return null;
  return ent.value;
}

function setCache(key, value) {
  cache.set(key, { value, lastAccessed: Date.now() });
}

function buildQaCsv(liveData, qaDocs) {
  const csvSourceSessionId = liveData?.csvSourceSessionId || null;
  let active = null, cue = null, next = null;
  if (csvSourceSessionId) {
    const questions = qaDocs.filter((q) => q.question && !q.name && q.sessionId === csvSourceSessionId);
    active = questions.find((q) => q.isActive) || null;
    cue = questions.find((q) => q.isQueued) || null;
    next = questions.find((q) => q.isNext) || null;
  }
  // When no QA has active, cue, or next, return empty data to avoid hanging old values
  const emptyRow = ',,,,,';
  const row = (!active && !cue && !next)
    ? emptyRow
    : [
        escapeCsv(active?.question ?? ''),
        escapeCsv(active?.submitterName ?? ''),
        escapeCsv(cue?.question ?? ''),
        escapeCsv(cue?.submitterName ?? ''),
        escapeCsv(next?.question ?? ''),
        escapeCsv(next?.submitterName ?? ''),
      ].join(',');
  const rows = ['Question ACTIVE,Name ACTIVE,Question Cue,Name Cue,Question Next,Name Next', row];
  return '\uFEFF' + rows.join('\r\n');
}

function buildPollCsv(liveData, pollDocOrPolls) {
  const csvSourcePollId = liveData?.csvSourcePollId || null;
  const pollDoc = Array.isArray(pollDocOrPolls)
    ? pollDocOrPolls.find((p) => p.id === csvSourcePollId)
    : pollDocOrPolls;
  if (!csvSourcePollId || !pollDoc) {
    return '\uFEFFTitle\r\nOption,Votes,Percentage,PercentRounded';
  }
  const poll = { id: pollDoc.id, ...pollDoc };
  if (poll.eventId !== liveData._eventId) {
    return '\uFEFFTitle\r\nOption,Votes,Percentage,PercentRounded';
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
  return '\uFEFF' + rows.join('\r\n');
}

function rebuildAndCache(eventId, liveData, qaDocs, polls) {
  liveData._eventId = eventId;
  const qaCsv = buildQaCsv(liveData, qaDocs);
  const pollCsv = buildPollCsv(liveData, polls);
  setCache(`qa:${eventId}`, qaCsv);
  setCache(`poll:${eventId}`, pollCsv);
}

function ensureListeners(eventId) {
  if (!db) return;
  let state = eventListeners.get(eventId);
  if (state) {
    state.lastAccessed = Date.now();
    return;
  }

  const data = { liveData: {}, qaDocs: [], polls: [] };
  state = {
    unsubs: [],
    lastAccessed: Date.now(),
    data,
  };
  eventListeners.set(eventId, state);

  const rebuild = () => {
    rebuildAndCache(eventId, data.liveData, data.qaDocs, data.polls);
  };

  // Listen to liveState
  const unsubLive = db.collection('liveState').doc(eventId).onSnapshot((snap) => {
    data.liveData = snap.exists ? snap.data() : {};
    rebuild();
  }, (err) => console.error(`liveState listener error for ${eventId}:`, err?.message));

  // Listen to qa for this event
  const unsubQa = db.collection('qa').where('eventId', '==', eventId).onSnapshot((snap) => {
    data.qaDocs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    rebuild();
  }, (err) => console.error(`qa listener error for ${eventId}:`, err?.message));

  // Listen to polls for this event
  const unsubPolls = db.collection('polls').where('eventId', '==', eventId).onSnapshot((snap) => {
    data.polls = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    rebuild();
  }, (err) => console.error(`polls listener error for ${eventId}:`, err?.message));

  state.unsubs = [unsubLive, unsubQa, unsubPolls];
}

function pruneIdleListeners() {
  const now = Date.now();
  for (const [eventId, state] of eventListeners.entries()) {
    if (now - state.lastAccessed > LISTENER_IDLE_MS) {
      state.unsubs.forEach((fn) => { try { fn(); } catch (e) {} });
      eventListeners.delete(eventId);
      cache.delete(`qa:${eventId}`);
      cache.delete(`poll:${eventId}`);
    }
  }
}
setInterval(pruneIdleListeners, 5 * 60 * 1000); // Every 5 min

// CORS: allow browser requests from any origin (e.g. Firebase Hosting app)
app.use((req, res, next) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type, X-Api-Key, Authorization');
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }
  next();
});

// --- Companion API (Bitfocus Companion): no API key – use Railway URL + Event ID only ---
const EVENTS = 'events';
const POLLS = 'polls';
const QA = 'qa';
const LIVE_STATE = 'liveState';

app.get('/companion-api/events', async (req, res) => {
  if (!db) return res.status(500).json({ ok: false, error: 'Database not configured' });
  try {
    const snap = await db.collection(EVENTS).orderBy('date', 'desc').get();
    const events = snap.docs.map((d) => ({ id: d.id, name: d.data().name, date: d.data().date }));
    res.json(events);
  } catch (err) {
    res.status(500).json({ ok: false, error: err?.message });
  }
});

app.get('/companion-api/events/:eventId/polls', async (req, res) => {
  if (!db) return res.status(500).json({ ok: false, error: 'Database not configured' });
  try {
    const eventId = req.params.eventId;
    const snap = await db.collection(POLLS).where('eventId', '==', eventId).get();
    const polls = snap.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        title: data.title,
        isActive: data.isActive === true,
        isActiveForPublic: data.isActiveForPublic === true,
      };
    });
    res.json(polls);
  } catch (err) {
    res.status(500).json({ ok: false, error: err?.message });
  }
});

app.get('/companion-api/events/:eventId/qa', async (req, res) => {
  if (!db) return res.status(500).json({ ok: false, error: 'Database not configured' });
  try {
    const eventId = req.params.eventId;
    const snap = await db.collection(QA).where('eventId', '==', eventId).get();
    const sessions = [];
    const questions = [];
    snap.docs.forEach((d) => {
      const data = d.data();
      if (data.name && !data.question) {
        sessions.push({ id: d.id, name: data.name, isActiveForPublic: data.isActiveForPublic === true });
      } else if (data.question) {
        questions.push({
          id: d.id,
          sessionId: data.sessionId,
          question: data.question,
          isActive: data.isActive === true,
          isNext: data.isNext === true,
        });
      }
    });
    res.json({ sessions, questions });
  } catch (err) {
    res.status(500).json({ ok: false, error: err?.message });
  }
});

app.post('/companion-api/events/:eventId/poll/:pollId/active', async (req, res) => {
  if (!db) return res.status(500).json({ ok: false, error: 'Database not configured' });
  try {
    const { eventId, pollId } = req.params;
    const active = req.body?.active === true || req.body?.active === 'true';
    await db.collection(POLLS).doc(pollId).update({
      isActive: active,
      updatedAt: new Date().toISOString(),
    });
    if (!active) {
      const liveRef = db.collection(LIVE_STATE).doc(eventId);
      const live = (await liveRef.get()).data() || {};
      if (live.csvSourcePollId === pollId) {
        await liveRef.set({ ...live, csvSourcePollId: null, updatedAt: new Date() }, { merge: true });
      }
    }
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, error: err?.message });
  }
});

app.post('/companion-api/events/:eventId/poll/:pollId/public', async (req, res) => {
  if (!db) return res.status(500).json({ ok: false, error: 'Database not configured' });
  try {
    const { pollId } = req.params;
    const pub = req.body?.public === true || req.body?.public === 'true';
    await db.collection(POLLS).doc(pollId).update({
      isActiveForPublic: pub,
      updatedAt: new Date().toISOString(),
    });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, error: err?.message });
  }
});

app.post('/companion-api/events/:eventId/qa/:qaId/public', async (req, res) => {
  if (!db) return res.status(500).json({ ok: false, error: 'Database not configured' });
  try {
    const { qaId } = req.params;
    const pub = req.body?.public === true || req.body?.public === 'true';
    await db.collection(QA).doc(qaId).update({
      isActiveForPublic: pub,
      updatedAt: new Date().toISOString(),
    });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, error: err?.message });
  }
});

app.post('/companion-api/events/:eventId/qa/question/:questionId/play', async (req, res) => {
  if (!db) return res.status(500).json({ ok: false, error: 'Database not configured' });
  try {
    const { eventId, questionId } = req.params;
    const qSnap = await db.collection(QA).doc(questionId).get();
    if (!qSnap.exists) {
      return res.status(404).json({ ok: false, error: 'Question not found' });
    }
    const sessionId = qSnap.data().sessionId;
    const sessionSnap = sessionId ? await db.collection(QA).doc(sessionId).get() : null;
    const outputSettings = sessionSnap?.data()?.outputSettings || { fullScreen: [1], lowerThird: [1], pip: [1], splitScreen: [1] };
    const batch = db.batch();
    const allQ = await db.collection(QA).where('eventId', '==', eventId).get();
    const now = new Date().toISOString();
    allQ.docs.forEach((d) => {
      if (d.id === questionId) {
        batch.update(d.ref, { isActive: true, isQueued: false, isNext: false, outputSettings, updatedAt: now });
      } else {
        batch.update(d.ref, { isActive: false, updatedAt: now });
      }
    });
    await batch.commit();
    const question = qSnap.data();
    await db.collection(LIVE_STATE).doc(eventId).set({
      activeQA: { question: question.question, answer: question.answer, submitterName: question.submitterName },
      csvSourceSessionId: sessionId || questionId,
      updatedAt: new Date(),
    }, { merge: true });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, error: err?.message });
  }
});

app.post('/companion-api/events/:eventId/qa/question/:questionId/cue', async (req, res) => {
  if (!db) return res.status(500).json({ ok: false, error: 'Database not configured' });
  try {
    const { eventId, questionId } = req.params;
    const batch = db.batch();
    const allQ = await db.collection(QA).where('eventId', '==', eventId).get();
    const now = new Date().toISOString();
    allQ.docs.forEach((d) => {
      batch.update(d.ref, { isNext: d.id === questionId, updatedAt: now });
    });
    await batch.commit();
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, error: err?.message });
  }
});

app.post('/companion-api/events/:eventId/qa/stop', async (req, res) => {
  if (!db) return res.status(500).json({ ok: false, error: 'Database not configured' });
  try {
    const { eventId } = req.params;
    const activeQ = await db.collection(QA).where('eventId', '==', eventId).where('isActive', '==', true).limit(1).get();
    if (!activeQ.empty) {
      await activeQ.docs[0].ref.update({ isActive: false, updatedAt: new Date().toISOString() });
    }
    await db.collection(LIVE_STATE).doc(eventId).set({ activeQA: null, updatedAt: new Date() }, { merge: true });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, error: err?.message });
  }
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
  ensureListeners(eventId);
  const cached = getCached(`qa:${eventId}`);
  if (cached) {
    res.status(200).set('Content-Type', 'text/csv; charset=utf-8').send(cached);
    return;
  }
  // First request before initial snapshot - fetch once to prime
  try {
    const liveSnap = await db.collection('liveState').doc(eventId).get();
    const liveData = liveSnap.exists ? liveSnap.data() : {};
    const csvSourceSessionId = liveData.csvSourceSessionId || null;
    let qaDocs = [];
    if (csvSourceSessionId) {
      const qaSnap = await db.collection('qa').where('eventId', '==', eventId).get();
      qaDocs = qaSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
    }
    const csv = buildQaCsv(liveData, qaDocs);
    setCache(`qa:${eventId}`, csv);
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
  ensureListeners(eventId);
  const cached = getCached(`poll:${eventId}`);
  if (cached) {
    res.status(200).set('Content-Type', 'text/csv; charset=utf-8').send(cached);
    return;
  }
  // First request before initial snapshot - fetch once to prime
  try {
    const liveSnap = await db.collection('liveState').doc(eventId).get();
    const liveData = liveSnap.exists ? liveSnap.data() : {};
    const csvSourcePollId = liveData.csvSourcePollId || null;
    if (!csvSourcePollId) {
      const csv = '\uFEFFTitle\r\nOption,Votes,Percentage,PercentRounded';
      setCache(`poll:${eventId}`, csv);
      res.status(200).set('Content-Type', 'text/csv; charset=utf-8').send(csv);
      return;
    }
    const pollSnap = await db.collection('polls').doc(csvSourcePollId).get();
    if (!pollSnap.exists) {
      const csv = '\uFEFFTitle\r\nOption,Votes,Percentage,PercentRounded';
      setCache(`poll:${eventId}`, csv);
      res.status(200).set('Content-Type', 'text/csv; charset=utf-8').send(csv);
      return;
    }
    const poll = { id: pollSnap.id, ...pollSnap.data() };
    const csv = buildPollCsv({ ...liveData, _eventId: eventId }, [poll]);
    setCache(`poll:${eventId}`, csv);
    res.status(200).set('Content-Type', 'text/csv; charset=utf-8').send(csv);
  } catch (err) {
    res.status(500).set('Content-Type', 'text/plain').send(err?.message || 'Error');
  }
});

// Proxy POST to Google Apps Script Web App (avoids CORS when app calls from browser)
// OPTIONS is handled above by CORS middleware so browser preflight succeeds.
// redirect: 'manual' so we don't follow Google's redirect to login page (which would return HTML)
app.post('/sheet-write', async (req, res) => {
  const { url, body } = req.body || {};
  if (!url || typeof body !== 'object') {
    res.status(400).json({ ok: false, error: 'Missing url or body' });
    return;
  }
  try {
    let out = await fetch(String(url), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      redirect: 'manual',
    });
    let text = await out.text();

    // Google Apps Script "Anyone" deployments often redirect once to script.googleusercontent.com (echo URL). Follow that; only treat accounts.google.com as login.
    if (out.status >= 300 && out.status < 400) {
      const location = out.headers.get('location') || '';
      if (location.includes('script.googleusercontent.com')) {
        // Normal Apps Script proxy redirect — echo URL returns result for GET (forward cookies so Google accepts)
        const redirectUrl = location.startsWith('http') ? location : new URL(location, url).href;
        const setCookie = out.headers.get('set-cookie') || out.headers.get('Set-Cookie');
        const headers = {};
        if (setCookie) headers['Cookie'] = setCookie;
        out = await fetch(redirectUrl, { method: 'GET', redirect: 'manual', headers });
        text = await out.text();
      }
      if (out.status >= 300 && out.status < 400) {
        const loc2 = out.headers.get('location') || '';
        if (loc2.includes('accounts.google.com')) {
          console.warn('sheet-write: Google redirected to login', out.status, loc2?.slice(0, 80));
          res.status(200).set('Content-Type', 'application/json').send(JSON.stringify({
            ok: false,
            error: "Google redirected to login. Use the deployment URL that ends with /exec and has Who has access: Anyone. Create a New version and Deploy.",
            redirected: true,
            status: out.status,
            redirectLocation: loc2 ? loc2.slice(0, 120) : undefined,
          }));
          return;
        }
      }
    }

    // Log a short preview for debugging (Railway logs)
    const preview = text.slice(0, 120).replace(/\s+/g, ' ');
    console.log('sheet-write: Google response', out.status, preview + (text.length > 120 ? '...' : ''));

    res.status(out.status).set('Content-Type', 'application/json').send(text || '{}');
  } catch (err) {
    res.status(502).json({ ok: false, error: err?.message || 'Proxy failed' });
  }
});

app.get('/', (req, res) => {
  res.send(
    `Live CSV server v${SERVER_VERSION}. Uses Firestore listeners - cache updates on change. ` +
    `GET /live-qa-csv?eventId=X or /live-poll-csv?eventId=X. POST /sheet-write to proxy Web App writes. ` +
    `Companion API base URL: ${req.protocol}://${req.get('host')}/companion-api (use with Event ID in Companion module)`
  );
});

app.listen(PORT, () => {
  console.log(`Live CSV server v${SERVER_VERSION} on port ${PORT} - Firestore listeners, no TTL`);
});
