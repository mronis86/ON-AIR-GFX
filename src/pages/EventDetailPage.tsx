import { useState, useEffect } from 'react';
import { useParams, Link, useSearchParams, useNavigate } from 'react-router-dom';
import { getEvent, getPollsByEvent, getQAsByEvent, updateEvent, updatePoll, deletePoll, deleteQA } from '../services/firestore';
import { extractSpreadsheetId, postToWebApp, getRailwayBaseUrlForSheet, ensureRailwayBaseUrlHasHttps, DEFAULT_RAILWAY_BASE_URL } from '../services/googleSheets';
import { GOOGLE_SHEET_SCRIPT, GOOGLE_SHEET_SCRIPT_FIRESTORE, GOOGLE_SHEET_SCRIPT_FIRESTORE_SIMPLE, getTimedRefreshScript } from '../constants/googleSheetScript';
import type { Event, Poll, QandA } from '../types';
import PollFormEnhanced from '../components/PollFormEnhanced';
import QAForm from '../components/QAForm';
import QASessionDetailModal from '../components/QASessionDetailModal';

export default function EventDetailPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const [event, setEvent] = useState<Event | null>(null);
  const [polls, setPolls] = useState<Poll[]>([]);
  const [qas, setQAs] = useState<QandA[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPollForm, setShowPollForm] = useState(false);
  const [editingPoll, setEditingPoll] = useState<string | null>(null);
  const [showQAForm, setShowQAForm] = useState(false);
  const [editingQA, setEditingQA] = useState<string | null>(null);
  const [selectedTab, setSelectedTab] = useState<'polls' | 'qa' | 'other'>('qa');
  const [selectedPollIds, setSelectedPollIds] = useState<Set<string>>(new Set());
  const [selectedSessionIds, setSelectedSessionIds] = useState<Set<string>>(new Set());
  const [sessionDetailSession, setSessionDetailSession] = useState<QandA | null>(null);
  const navigate = useNavigate();
  
  // Check for edit parameter in URL (e.g. when opened from Operators panel modal)
  useEffect(() => {
    const editPollId = searchParams.get('edit');
    if (editPollId) {
      setEditingPoll(editPollId);
      setShowPollForm(false);
      setSelectedTab('polls'); // Show Polls tab so the full edit form (including Bars start Y, etc.) is visible
    }
  }, [searchParams]);
  const [showSheetForm, setShowSheetForm] = useState(false);
  const [sheetUrl, setSheetUrl] = useState('');
  const [webAppUrl, setWebAppUrl] = useState('');
  const [activeQASheetName, setActiveQASheetName] = useState('');
  const [activeQACell, setActiveQACell] = useState('');
  const [qaBackupSheetName, setQaBackupSheetName] = useState('');
  const [qaBackupSheetNames, setQaBackupSheetNames] = useState<Record<string, string>>({});
  const [pollBackupSheetName, setPollBackupSheetName] = useState('');
  const [pollBackupSheetNames, setPollBackupSheetNames] = useState<Record<string, string>>({});
  const [showQaBackupSheetModal, setShowQaBackupSheetModal] = useState(false);
  const [showPollBackupSheetModal, setShowPollBackupSheetModal] = useState(false);
  const [savingSheet, setSavingSheet] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savingPollTab, setSavingPollTab] = useState<string | null>(null);
  const [scriptCopied, setScriptCopied] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState<'script' | 'error' | 'eventId' | null>(null);
  const [scriptVariant, setScriptVariant] = useState<'firestore' | 'firestore_simple'>('firestore_simple');
  const [railwayBaseUrl, setRailwayBaseUrl] = useState('');
  const railwayBaseUrlClean = railwayBaseUrl.trim().replace(/\/+$/, '');
  const railwayBaseWithHttps = ensureRailwayBaseUrlHasHttps(railwayBaseUrlClean || DEFAULT_RAILWAY_BASE_URL);
  const railwayLiveQaCsvUrl = eventId && railwayBaseWithHttps ? `${railwayBaseWithHttps}/live-qa-csv?eventId=${encodeURIComponent(eventId)}` : '';
  const railwayLivePollCsvUrl = eventId && railwayBaseWithHttps ? `${railwayBaseWithHttps}/live-poll-csv?eventId=${encodeURIComponent(eventId)}` : '';
  const railwayImportDataFormula = railwayLiveQaCsvUrl ? `=IMPORTDATA("${railwayLiveQaCsvUrl}")` : '';
  const railwayPollImportDataFormula = railwayLivePollCsvUrl ? `=IMPORTDATA("${railwayLivePollCsvUrl}")` : '';
  const [sheetError, setSheetError] = useState<string | null>(null);
  const [sheetSaveSuccess, setSheetSaveSuccess] = useState(false);
  const [testWriteLoading, setTestWriteLoading] = useState(false);
  const [testWriteResult, setTestWriteResult] = useState<string | null>(null);
  const [showRefreshScriptModal, setShowRefreshScriptModal] = useState(false);

  useEffect(() => {
    if (!eventId) return;

    const loadData = async () => {
      try {
        setLoading(true);
        const [eventData, pollsData, qasData] = await Promise.all([
          getEvent(eventId),
          getPollsByEvent(eventId),
          getQAsByEvent(eventId),
        ]);

        if (!eventData) {
          setError('Event not found');
          return;
        }

        setEvent(eventData);
        setPolls(pollsData);
        // Only store sessions (containers), not individual questions
        const sessions = qasData.filter((qa) => qa.name && !qa.question);
        setQAs(sessions);
        setSheetUrl(eventData.googleSheetUrl || '');
        setWebAppUrl(eventData.googleSheetWebAppUrl || '');
        setActiveQASheetName(eventData.activeQASheetName || '');
        setActiveQACell(eventData.activeQACell || '');
        setQaBackupSheetName(eventData.qaBackupSheetName || '');
        setQaBackupSheetNames(eventData.qaBackupSheetNames || {});
        setPollBackupSheetName(eventData.pollBackupSheetName || '');
        setPollBackupSheetNames(eventData.pollBackupSheetNames || {});
        setRailwayBaseUrl(ensureRailwayBaseUrlHasHttps(eventData.railwayLiveCsvBaseUrl || '') || DEFAULT_RAILWAY_BASE_URL);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load event data');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [eventId]);

  const handleSaveSheetUrl = async () => {
    if (!eventId || !event) return;

    setSavingSheet(true);
    setSheetError(null);

    const trimmedSheetUrl = sheetUrl.trim();
    const trimmedWebAppUrl = webAppUrl.trim();
    try {
      if (trimmedSheetUrl) {
        const spreadsheetId = extractSpreadsheetId(trimmedSheetUrl);
        if (!spreadsheetId) {
          const msg = 'Invalid Google Sheet URL. Use the full link from the browser, e.g. https://docs.google.com/spreadsheets/d/YOUR_SHEET_ID/edit';
          setSheetError(msg);
          setSavingSheet(false);
          return;
        }
      }
      // Free plan script creates sheets when runLiveSync runs; no POST from app.

      await updateEvent(eventId, {
        googleSheetUrl: trimmedSheetUrl || '',
        googleSheetWebAppUrl: trimmedWebAppUrl || '',
        activeQASheetName: activeQASheetName.trim() || '',
        activeQACell: activeQACell.trim() || '',
        qaBackupSheetName: qaBackupSheetName.trim() || undefined,
        qaBackupSheetNames: Object.keys(qaBackupSheetNames).length ? qaBackupSheetNames : undefined,
        pollBackupSheetName: pollBackupSheetName.trim() || undefined,
        pollBackupSheetNames: Object.keys(pollBackupSheetNames).length ? pollBackupSheetNames : undefined,
        railwayLiveCsvBaseUrl: railwayBaseUrl.trim().replace(/\/+$/, '') || undefined,
      });

      const updatedEvent = await getEvent(eventId);
      if (updatedEvent) {
        setEvent(updatedEvent);
        setSheetSaveSuccess(true);
        setSheetError(null);
        // Keep form open so feedback stays in Google settings and does not change/cover the event page
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to save Google Sheet URL';
      setSheetError(msg);
    } finally {
      setSavingSheet(false);
    }
  };

  const handlePollFormSuccess = async () => {
    setShowPollForm(false);
    if (eventId) {
      try {
        const pollsData = await getPollsByEvent(eventId);
        setPolls(pollsData);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to reload polls');
      }
    }
  };

  const handleToggleSelectPoll = (id: string) => {
    setSelectedPollIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSelectAllPolls = () => {
    if (selectedPollIds.size === polls.length) {
      setSelectedPollIds(new Set());
    } else {
      setSelectedPollIds(new Set(polls.map((p) => p.id)));
    }
  };

  const handleDeleteSelectedPolls = async () => {
    if (selectedPollIds.size === 0) return;
    if (!confirm(`Delete ${selectedPollIds.size} selected poll(s)? This cannot be undone.`)) return;
    try {
      for (const id of selectedPollIds) {
        await deletePoll(id);
      }
      setSelectedPollIds(new Set());
      if (editingPoll && selectedPollIds.has(editingPoll)) {
        setEditingPoll(null);
        setShowPollForm(false);
      }
      if (eventId) {
        const pollsData = await getPollsByEvent(eventId);
        setPolls(pollsData);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete polls');
    }
  };

  const handleQAFormSuccess = async () => {
    setShowQAForm(false);
    setEditingQA(null);
    if (eventId) {
      try {
        const qasData = await getQAsByEvent(eventId);
        const sessions = qasData.filter((qa) => qa.name && !qa.question);
        setQAs(sessions);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to reload Q&A');
      }
    }
  };

  const qaSessions = qas; // qas is already filtered to sessions only

  const handleToggleSelectSession = (id: string) => {
    setSelectedSessionIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSelectAllSessions = () => {
    if (selectedSessionIds.size === qaSessions.length) {
      setSelectedSessionIds(new Set());
    } else {
      setSelectedSessionIds(new Set(qaSessions.map((s) => s.id)));
    }
  };

  const handleDeleteSelectedSessions = async () => {
    if (selectedSessionIds.size === 0) return;
    if (!confirm(`Delete ${selectedSessionIds.size} selected session(s)? Questions in these sessions will remain but won't be linked.`)) return;
    try {
      for (const id of selectedSessionIds) {
        await deleteQA(id);
      }
      setSelectedSessionIds(new Set());
      if (eventId) {
        const qasData = await getQAsByEvent(eventId);
        const sessions = qasData.filter((qa) => qa.name && !qa.question);
        setQAs(sessions);
        if (sessionDetailSession && selectedSessionIds.has(sessionDetailSession.id)) {
          setSessionDetailSession(null);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete sessions');
    }
  };

  const handleCopyPublicLink = async () => {
    if (!eventId) return;
    
    const publicLink = `${window.location.origin}/events/${eventId}/public`;
    
    try {
      await navigator.clipboard.writeText(publicLink);
      alert('Public link copied to clipboard!');
    } catch (err) {
      setError('Failed to copy link to clipboard');
      console.error('Error copying link:', err);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <p className="text-gray-500">Loading event...</p>
      </div>
    );
  }

  // Full-page error only when event failed to load or not found (no event data). All other messages stay on the page.
  if (!event) {
    const errorText = error || 'Event not found';
    return (
      <div className="min-h-screen bg-gray-100">
        <div className="container mx-auto px-4 py-8 max-w-2xl">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-sm font-medium text-red-800 mb-2">Error (you can copy this message)</p>
            <pre className="text-sm text-red-700 whitespace-pre-wrap break-all mb-3 p-3 bg-white border border-red-100 rounded select-all" style={{ maxHeight: '200px', overflow: 'auto' }}>
              {errorText}
            </pre>
            <button
              type="button"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(errorText);
                } catch (_) {}
              }}
              className="mr-2 px-3 py-1.5 bg-red-600 text-white text-sm rounded hover:bg-red-700"
            >
              Copy error
            </button>
          </div>
          <div className="mt-4 flex gap-4">
            <Link to="/" className="text-blue-600 hover:text-blue-800 font-medium">
              ← Back to Events
            </Link>
            {eventId && (
              <Link to={`/events/${eventId}`} className="text-blue-600 hover:text-blue-800 font-medium">
                Back to this event
              </Link>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="container mx-auto px-4 py-8">
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex flex-wrap items-center gap-2">
            <pre className="flex-1 min-w-0 text-sm text-red-700 whitespace-pre-wrap break-all" style={{ maxHeight: '120px', overflow: 'auto' }}>{error}</pre>
            <button type="button" onClick={() => setError(null)} className="shrink-0 px-3 py-1.5 border border-red-300 text-red-700 rounded hover:bg-red-100">Dismiss</button>
            <button type="button" onClick={async () => { try { await navigator.clipboard.writeText(error); } catch (_) {} }} className="shrink-0 px-3 py-1.5 bg-red-600 text-white rounded hover:bg-red-700">Copy</button>
          </div>
        )}
        <Link to="/" className="text-blue-600 hover:text-blue-800 mb-4 inline-block">
          ← Back to Events
        </Link>

        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1">
              <h1 className="text-3xl font-bold text-gray-800 mb-2">{event.name}</h1>
              <p className="text-gray-600">
                <span className="font-medium">Date:</span> {formatDate(event.date)}
              </p>
            </div>
            <button
              onClick={handleCopyPublicLink}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 ml-4"
              title="Copy public link to clipboard"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
              Copy Public Link
            </button>
          </div>
          
          {/* Google Sheet Section - all feedback (success/error) only inside this section, never covers event page */}
          <div className="mt-4 pt-4 border-t border-gray-200">
            {!showSheetForm ? (
              <div className="flex items-center justify-between">
                <div>
                  {event.googleSheetUrl ? (
                    <div>
                      <p className="text-sm font-medium text-gray-700 mb-1">Google Sheet Connected</p>
                      <a
                        href={event.googleSheetUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-800 underline text-sm"
                      >
                        View Sheet →
                      </a>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500">No Google Sheet connected</p>
                  )}
                </div>
                <button
                  onClick={() => { setShowSheetForm(true); setSheetSaveSuccess(false); }}
                  className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                >
                  {event.googleSheetUrl ? 'Edit' : 'Add'} Sheet
                </button>
              </div>
            ) : (
              <div>
                {sheetSaveSuccess && (
                  <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-md flex items-center justify-between">
                    <p className="text-sm font-medium text-green-800">Settings saved.</p>
                    <button type="button" onClick={() => setSheetSaveSuccess(false)} className="text-green-700 hover:text-green-900 text-sm font-medium">Dismiss</button>
                  </div>
                )}
                {sheetError && (
                  <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
                    <p className="text-sm font-medium text-red-800 mb-1">Error (copy below to share or troubleshoot)</p>
                    <pre className="text-xs text-red-700 whitespace-pre-wrap break-all mb-2 p-2 bg-white border border-red-100 rounded select-all" style={{ maxHeight: '120px', overflow: 'auto' }}>
                      {sheetError}
                    </pre>
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(sheetError);
                          setCopyFeedback('error');
                          setTimeout(() => setCopyFeedback(null), 2000);
                        } catch (_) {}
                      }}
                      className="text-sm px-2 py-1 bg-red-600 text-white rounded hover:bg-red-700"
                    >
                      {copyFeedback === 'error' ? 'Copied!' : 'Copy error'}
                    </button>
                  </div>
                )}
                <label htmlFor="sheet-url" className="block text-sm font-medium text-gray-700 mb-2">
                  Google Sheet URL
                </label>
                <div className="flex gap-2">
                  <input
                    id="sheet-url"
                    type="text"
                    value={sheetUrl}
                    onChange={(e) => setSheetUrl(e.target.value)}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="https://docs.google.com/spreadsheets/d/YOUR_SHEET_ID/edit"
                  />
                  <button
                    onClick={handleSaveSheetUrl}
                    disabled={savingSheet}
                    className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                  >
                    {savingSheet ? 'Saving...' : 'Save'}
                  </button>
                  <button
                    onClick={() => {
                      setShowSheetForm(false);
                      setSheetError(null);
                      setSheetUrl(event.googleSheetUrl || '');
                      setWebAppUrl(event.googleSheetWebAppUrl || '');
                      setActiveQASheetName(event.activeQASheetName || '');
                      setActiveQACell(event.activeQACell || '');
                      setQaBackupSheetName(event.qaBackupSheetName || '');
                      setQaBackupSheetNames(event.qaBackupSheetNames || {});
                      setPollBackupSheetName(event.pollBackupSheetName || '');
                      setPollBackupSheetNames(event.pollBackupSheetNames || {});
                      setRailwayBaseUrl(ensureRailwayBaseUrlHasHttps(event.railwayLiveCsvBaseUrl || '') || DEFAULT_RAILWAY_BASE_URL);
                    }}
                    className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
                <p className="mt-1 text-xs text-gray-500">Link to open the spreadsheet. Save to store.</p>

                {/* Writing: Web App + live cell + backups */}
                <div className="mt-6 pt-4 border-t border-gray-200">
                  <p className="text-sm font-medium text-gray-700 mb-3">Writing to the sheet (Web App)</p>
                  <p className="text-xs text-gray-500 mb-3">To write from the app you need the Web App script deployed and its URL below. Writes go through <strong>Railway</strong> (Reading section). If you leave Railway URL blank, the app uses <strong>on-air-gfx-production.up.railway.app</strong> by default.</p>
                  <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2 mb-3">
                    <strong>Data goes to the spreadsheet the script is in.</strong> The script always writes to the same Google Sheet where you added it (Extensions → Apps Script). Open the sheet from the link above, then go to <strong>Extensions → Apps Script</strong> in <em>that</em> sheet and paste the Web App script there. If you added the script to a different spreadsheet, data will be there — check that sheet or move the script into this one.
                  </p>
                  <div className="space-y-3">
                    <div>
                      <label htmlFor="webapp-url" className="block text-sm font-medium text-gray-700 mb-1">Web App URL</label>
                      <div className="flex flex-wrap items-center gap-2">
                        <input
                          id="webapp-url"
                          type="text"
                          value={webAppUrl}
                          onChange={(e) => { setWebAppUrl(e.target.value); setTestWriteResult(null); }}
                          className="flex-1 min-w-[200px] px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="https://script.google.com/macros/s/.../exec"
                        />
                        <button
                          type="button"
                          disabled={!webAppUrl.trim() || testWriteLoading}
                          title={`Test writes to tab "${pollBackupSheetName.trim() || 'Poll_Results'}"`}
                          onClick={async () => {
                            setTestWriteResult(null);
                            setTestWriteLoading(true);
                            try {
                              const proxyBase = getRailwayBaseUrlForSheet(railwayBaseUrl);
                              const res = await postToWebApp(
                                webAppUrl.trim(),
                                {
                                  type: 'poll_backup',
                                  sheetName: pollBackupSheetName.trim() || 'Poll_Results',
                                  data: {
                                    timestamp: new Date().toISOString(),
                                    id: 'test',
                                    title: 'Test write',
                                    options: [{ text: 'Option A', votes: 1 }],
                                  },
                                },
                                proxyBase
                              );
                              const text = await res.text();
                              const looksLikeHtml = typeof text === 'string' && (text.trim().startsWith('<') || text.trim().startsWith('<!'));
                              let resultOk = res.ok;
                              let resultError = '';
                              let resultMessage = '';
                              if (looksLikeHtml) {
                                resultOk = false;
                                resultError = 'The Web App returned a page instead of JSON. In Apps Script: Deploy → Manage deployments → Edit. Set "Who has access" to "Anyone" (not "Anyone with Google account"). New version → Deploy. Railway cannot sign in.';
                              } else {
                                try {
                                  const json = JSON.parse(text || '{}');
                                  if (json && json.ok === false && json.error) {
                                    resultOk = false;
                                    resultError = json.error;
                                    if (json.redirected && json.redirectLocation) {
                                      resultError += ` Redirected to: ${json.redirectLocation}`;
                                    }
                                  } else if (json && json.message) {
                                    resultMessage = json.message;
                                  } else if (json && json.sheetName && json.row) {
                                    resultMessage = `Wrote to tab "${json.sheetName}" row ${json.row}. Check that tab in the spreadsheet.`;
                                  } else if (res.ok && (!json || json.ok !== true) && !json.sheetName) {
                                    resultOk = false;
                                    resultError = 'Response missing ok/sheetName. Redeploy the Web App: Deploy → Manage deployments → Edit → Version: New version → Deploy.';
                                  }
                                } catch (_) {
                                  if (res.ok) {
                                    resultOk = false;
                                    resultError = 'Response was not valid JSON. Set deployment to "Who has access: Anyone" and redeploy.';
                                  }
                                }
                              }
                              if (resultOk) {
                                const tabName = pollBackupSheetName.trim() || 'Poll_Results';
                                const proxyHost = proxyBase.replace(/^https?:\/\//, '').replace(/\/+$/, '');
                                setTestWriteResult(resultMessage || `Success — check the tab named "${tabName}" in your spreadsheet (bottom tabs). Via Railway: ${proxyHost}`);
                              } else {
                                setTestWriteResult(`Failed: ${resultError || text?.slice(0, 200) || res.statusText}`);
                              }
                            } catch (err) {
                              const msg = err instanceof Error ? err.message : String(err);
                              const proxyBase = getRailwayBaseUrlForSheet(railwayBaseUrl);
                              const triedUrl = `${proxyBase.replace(/\/+$/, '')}/sheet-write`;
                              setTestWriteResult(`Error: ${msg}. Tried: ${triedUrl} — check Railway is up and the URL is correct (use https://).`);
                            } finally {
                              setTestWriteLoading(false);
                            }
                          }}
                          className="shrink-0 px-3 py-2 text-sm bg-emerald-600 text-white rounded-md hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {testWriteLoading ? 'Testing…' : 'Test write'}
                        </button>
                      </div>
                      <p className="mt-1 text-xs text-gray-500">Test writes to the tab named &quot;{pollBackupSheetName.trim() || 'Poll_Results'}&quot; (your Poll backup sheet above).</p>
                      {testWriteResult && (
                        <p className={`mt-1.5 text-xs ${testWriteResult.startsWith('Success') ? 'text-green-700' : 'text-amber-700'}`}>
                          {testWriteResult}
                        </p>
                      )}
                    </div>
                    <div className="flex gap-4 flex-wrap">
                      <div className="flex-1 min-w-[120px]">
                        <label htmlFor="qa-sheet" className="block text-sm font-medium text-gray-700 mb-1">Live Q&A sheet + cell</label>
                        <input
                          id="qa-sheet"
                          type="text"
                          value={activeQASheetName}
                          onChange={(e) => setActiveQASheetName(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="e.g. Live"
                        />
                      </div>
                      <div className="w-24">
                        <label htmlFor="qa-cell" className="block text-sm font-medium text-gray-700 mb-1">Cell</label>
                        <input
                          id="qa-cell"
                          type="text"
                          value={activeQACell}
                          onChange={(e) => setActiveQACell(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="A1"
                        />
                      </div>
                    </div>
                    <p className="text-xs text-gray-500">The active Q&A (the one you Cue/Next in Operators) is written here when it changes.</p>
                  </div>

                  <div className="mt-4">
                    <p className="text-sm font-medium text-gray-700 mb-2">Backup sheets (optional)</p>
                    <p className="text-xs text-gray-500 mb-2">
                      Writing uses the <strong>Web App</strong> script only (see below). Railway URL in the Reading section is used for writes (default: on-air-gfx-production.up.railway.app). No script runs on Railway — it just forwards requests to the Web App.
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label htmlFor="qa-backup-sheet" className="block text-sm font-medium text-gray-700 mb-1">Q&A backup sheet (default)</label>
                        <div className="flex gap-2">
                          <input
                            id="qa-backup-sheet"
                            type="text"
                            value={qaBackupSheetName}
                            onChange={(e) => setQaBackupSheetName(e.target.value)}
                            className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="e.g. QA_Submissions"
                          />
                          <button
                            type="button"
                            onClick={() => setShowQaBackupSheetModal(true)}
                            className="shrink-0 px-3 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50"
                          >
                            Per session…
                          </button>
                        </div>
                        <p className="mt-0.5 text-xs text-gray-500">Or set a sheet name per Q&A session in the popup. Trigger: when someone submits a question.</p>
                      </div>
                      <div>
                        <label htmlFor="poll-backup-sheet" className="block text-sm font-medium text-gray-700 mb-1">Poll backup sheet (default)</label>
                        <div className="flex gap-2">
                          <input
                            id="poll-backup-sheet"
                            type="text"
                            value={pollBackupSheetName}
                            onChange={(e) => setPollBackupSheetName(e.target.value)}
                            className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="e.g. Poll_Results"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPollBackupSheetModal(true)}
                            className="shrink-0 px-3 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50"
                          >
                            Per poll…
                          </button>
                        </div>
                        <p className="mt-0.5 text-xs text-gray-500">Or set a sheet name per poll in the popup. Trigger: when someone votes or Operators sync.</p>
                      </div>
                    </div>
                  </div>

                  {/* Modal: Set sheet name per Q&A session */}
                  {showQaBackupSheetModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setShowQaBackupSheetModal(false)}>
                      <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[80vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
                        <div className="p-4 border-b border-gray-200">
                          <h3 className="text-sm font-semibold text-gray-800">Sheet name per Q&A session</h3>
                          <p className="text-xs text-gray-500 mt-0.5">Leave blank to use the default sheet above. Save here, then Save the main form.</p>
                        </div>
                        <div className="p-4 overflow-y-auto flex-1 space-y-3">
                          {qas.length === 0 ? (
                            <p className="text-sm text-gray-500">No Q&A sessions yet. Create one in the Q&A tab first.</p>
                          ) : (
                            qas.map((qa) => (
                              <div key={qa.id} className="flex flex-col gap-1">
                                <label className="text-xs font-medium text-gray-600">{qa.name || qa.id}</label>
                                <input
                                  type="text"
                                  value={qaBackupSheetNames[qa.id] ?? ''}
                                  onChange={(e) => setQaBackupSheetNames((prev) => ({ ...prev, [qa.id]: e.target.value }))}
                                  placeholder={qaBackupSheetName || 'QA_Submissions'}
                                  className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
                                />
                              </div>
                            ))
                          )}
                        </div>
                        <div className="p-4 border-t border-gray-200 flex justify-end gap-2">
                          <button type="button" onClick={() => setShowQaBackupSheetModal(false)} className="px-3 py-1.5 text-sm border border-gray-300 rounded hover:bg-gray-50">Done</button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Modal: Set sheet name per poll */}
                  {showPollBackupSheetModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setShowPollBackupSheetModal(false)}>
                      <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[80vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
                        <div className="p-4 border-b border-gray-200">
                          <h3 className="text-sm font-semibold text-gray-800">Sheet name per poll</h3>
                          <p className="text-xs text-gray-500 mt-0.5">Leave blank to use the default sheet above. Save here, then Save the main form.</p>
                        </div>
                        <div className="p-4 overflow-y-auto flex-1 space-y-3">
                          {polls.length === 0 ? (
                            <p className="text-sm text-gray-500">No polls yet. Create one in the Polls tab first.</p>
                          ) : (
                            polls.map((poll) => (
                              <div key={poll.id} className="flex flex-col gap-1">
                                <label className="text-xs font-medium text-gray-600">{poll.title || poll.id}</label>
                                <input
                                  type="text"
                                  value={pollBackupSheetNames[poll.id] ?? ''}
                                  onChange={(e) => setPollBackupSheetNames((prev) => ({ ...prev, [poll.id]: e.target.value }))}
                                  placeholder={pollBackupSheetName || 'Poll_Results'}
                                  className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
                                />
                              </div>
                            ))
                          )}
                        </div>
                        <div className="p-4 border-t border-gray-200 flex justify-end gap-2">
                          <button type="button" onClick={() => setShowPollBackupSheetModal(false)} className="px-3 py-1.5 text-sm border border-gray-300 rounded hover:bg-gray-50">Done</button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Web App script (for writing) — only script needed for sheet writes */}
                <div className="mt-6 pt-4 border-t border-gray-200">
                  <p className="text-sm font-medium text-gray-700 mb-2">Web App script (for writing)</p>
                  <p className="text-xs text-gray-500 mb-2">
                    This is the only Google script needed for writing. In your sheet: Extensions → Apps Script, paste the script, Deploy → New deployment → Web app (Execute as: Me, Who has access: Anyone). Paste the Web App URL in the box above. Railway does not run any script — it only forwards requests from the app to the Web App.
                  </p>
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(GOOGLE_SHEET_SCRIPT);
                        setCopyFeedback('script');
                        setScriptCopied(true);
                        setTimeout(() => { setScriptCopied(false); setCopyFeedback(null); }, 2000);
                      } catch (_) {
                        setSheetError('Copy failed.');
                      }
                    }}
                    className="px-3 py-1.5 bg-gray-700 text-white text-sm rounded hover:bg-gray-800"
                  >
                    {copyFeedback === 'script' ? 'Copied!' : 'Copy Web App script'}
                  </button>
                </div>

                {/* Reading: Railway (recommended) or Firestore */}
                <div className="mt-6 pt-4 border-t border-gray-200">
                  <p className="text-sm font-medium text-gray-700 mb-2">Reading into the sheet (optional)</p>
                  <p className="text-xs text-gray-500 mb-2">To pull live Q&A and poll data into the sheet, use Railway (no Google script). Railway URL below is used for reads and for writes (proxy). Defaults to <strong>on-air-gfx-production.up.railway.app</strong> if left blank.</p>
                  {eventId && (
                    <div className="flex flex-wrap items-center gap-2 mb-3 p-2 bg-gray-50 border border-gray-200 rounded">
                      <span className="text-xs text-gray-600">Event ID:</span>
                      <code className="text-sm font-mono bg-white px-2 py-1 border border-gray-200 rounded">{eventId}</code>
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            await navigator.clipboard.writeText(eventId);
                            setCopyFeedback('eventId');
                            setTimeout(() => setCopyFeedback(null), 2000);
                          } catch (_) {}
                        }}
                        className="text-xs px-2 py-1 bg-gray-600 text-white rounded hover:bg-gray-700"
                      >
                        {copyFeedback === 'eventId' ? 'Copied!' : 'Copy Event ID'}
                      </button>
                    </div>
                  )}

                  <div className="space-y-3 mb-2">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Railway URL (optional; default used if blank)</label>
                      <input
                        type="text"
                        value={railwayBaseUrl}
                        onChange={(e) => setRailwayBaseUrl(e.target.value)}
                        placeholder={DEFAULT_RAILWAY_BASE_URL}
                        className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
                      />
                      <p className="text-xs text-gray-500 mt-1">Deploy the repo to Railway (root: live-csv-server). Set FIREBASE_PROJECT_ID and FIREBASE_SERVICE_ACCOUNT in Railway. No Google script on Railway.</p>
                    </div>
                    {railwayImportDataFormula && (
                        <div className="space-y-4">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-xs font-medium text-gray-700">Q&A formula:</span>
                              <button
                                type="button"
                                onClick={async () => {
                                  try {
                                    await navigator.clipboard.writeText(railwayImportDataFormula);
                                    setCopyFeedback('script');
                                    setTimeout(() => setCopyFeedback(null), 2000);
                                  } catch (_) { setSheetError('Copy failed.'); }
                                }}
                                className="text-xs px-2 py-1 bg-emerald-600 text-white rounded hover:bg-emerald-700"
                              >
                                {copyFeedback === 'script' ? 'Copied!' : 'Copy Q&A formula'}
                              </button>
                            </div>
                            <pre className="p-3 bg-gray-100 border border-gray-300 rounded text-xs overflow-auto font-mono whitespace-pre-wrap break-all mt-1">
                              {railwayImportDataFormula}
                            </pre>
                            <p className="text-xs text-gray-500 mt-1">ACTIVE, Cue, Next columns. Enable via CSV button on Operators page.</p>
                          </div>
                          {railwayPollImportDataFormula && (
                            <div>
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-xs font-medium text-gray-700">Poll formula:</span>
                                <button
                                  type="button"
                                  onClick={async () => {
                                    try {
                                      await navigator.clipboard.writeText(railwayPollImportDataFormula);
                                      setCopyFeedback('script');
                                      setTimeout(() => setCopyFeedback(null), 2000);
                                    } catch (_) { setSheetError('Copy failed.'); }
                                  }}
                                  className="text-xs px-2 py-1 bg-emerald-600 text-white rounded hover:bg-emerald-700"
                                >
                                  {copyFeedback === 'script' ? 'Copied!' : 'Copy Poll formula'}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setShowRefreshScriptModal(true)}
                                  className="text-xs px-2 py-1 bg-amber-600 text-white rounded hover:bg-amber-700"
                                  title="Google Apps Script for timed refresh (every 1 min)"
                                >
                                  Timed refresh script
                                </button>
                              </div>
                              <pre className="p-3 bg-gray-100 border border-gray-300 rounded text-xs overflow-auto font-mono whitespace-pre-wrap break-all mt-1">
                                {railwayPollImportDataFormula}
                              </pre>
                              <p className="text-xs text-gray-500 mt-1">Title, options, votes. Enable via CSV button on Operators page.</p>
                            </div>
                          )}
                          <p className="text-xs text-gray-500">Sheets refreshes periodically. See docs/Railway-Deploy-Step-by-Step.md.</p>
                        </div>
                      )}

                  <details className="mt-4">
                    <summary className="text-sm font-medium text-gray-700 cursor-pointer">Alternative: Firestore sync (no Railway)</summary>
                    <p className="text-xs text-gray-500 mt-1 mb-2">If you don’t use Railway, you can run a script from Apps Script to pull data. Event ID above; set LIVE_STATE_EVENT_ID and API key in script CONFIG.</p>
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <select
                        value={scriptVariant}
                        onChange={(e) => setScriptVariant(e.target.value as 'firestore' | 'firestore_simple')}
                        className="text-sm border border-gray-300 rounded px-2 py-1"
                      >
                        <option value="firestore">Full (standalone or sheet)</option>
                        <option value="firestore_simple">Simple (sheet only)</option>
                      </select>
                      <button
                        type="button"
                        onClick={async () => {
                          const script = scriptVariant === 'firestore' ? GOOGLE_SHEET_SCRIPT_FIRESTORE : GOOGLE_SHEET_SCRIPT_FIRESTORE_SIMPLE;
                          try {
                            await navigator.clipboard.writeText(script);
                            setCopyFeedback('script');
                            setTimeout(() => { setCopyFeedback(null); }, 2000);
                          } catch (_) { setSheetError('Copy failed.'); }
                        }}
                        className="px-3 py-1.5 bg-gray-700 text-white text-sm rounded hover:bg-gray-800"
                      >
                        {copyFeedback === 'script' ? 'Copied!' : 'Copy script'}
                      </button>
                    </div>
                    <pre className="mt-2 p-3 bg-gray-100 border border-gray-300 rounded text-xs overflow-auto max-h-48 font-mono whitespace-pre-wrap break-all">
                      {scriptVariant === 'firestore' ? GOOGLE_SHEET_SCRIPT_FIRESTORE : GOOGLE_SHEET_SCRIPT_FIRESTORE_SIMPLE}
                    </pre>
                  </details>
                    </div>
                  </div>

                  {/* Timed Refresh Script Modal */}
                  {showRefreshScriptModal && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999]" onClick={() => setShowRefreshScriptModal(false)}>
                      <div className="bg-gray-800 border-2 border-gray-600 rounded-lg shadow-2xl p-6 min-w-[400px] max-w-[700px] max-h-[90vh] overflow-hidden flex flex-col z-[9999]" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-4 shrink-0">
                          <h3 className="text-lg font-semibold text-white">Google Apps Script: Timed CSV Refresh</h3>
                          <button onClick={() => setShowRefreshScriptModal(false)} className="text-gray-400 hover:text-white transition-colors">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                        <div className="space-y-3 overflow-y-auto flex-1 min-h-0 pr-2">
                          <p className="text-sm text-gray-300">Use this script for frequent refresh (e.g. every 1 min) instead of IMPORTDATA (which refreshes ~hourly).</p>
                          <ol className="text-sm text-gray-400 list-decimal list-inside space-y-1">
                            <li>Open your Google Sheet → Extensions → Apps Script</li>
                            <li>Delete any code and paste the script below. Save.</li>
                            <li>Run <strong className="text-gray-300">testAuth</strong> once. Authorize when prompted.</li>
                            <li>Run <strong className="text-gray-300">refreshAll</strong> once to test</li>
                            <li>Triggers: Edit → Current project&apos;s triggers → Add: <strong className="text-gray-300">refreshAll</strong>, Time-driven, Every minute</li>
                          </ol>
                          <p className="text-xs text-gray-500">Script writes Q&A to &quot;Live Q&A&quot; (A1) and Poll to &quot;Live Poll&quot; (A1). Edit CONFIG to change.</p>
                          <div className="relative">
                            <pre className="p-4 bg-gray-900 border border-gray-600 rounded text-xs overflow-auto max-h-[320px] font-mono whitespace-pre-wrap break-words text-gray-300">
                              {getTimedRefreshScript(railwayBaseWithHttps, eventId || 'YOUR_EVENT_ID')}
                            </pre>
                            <button
                              type="button"
                              onClick={async () => {
                                try {
                                  await navigator.clipboard.writeText(getTimedRefreshScript(railwayBaseWithHttps, eventId || 'YOUR_EVENT_ID'));
                                } catch (_) {}
                              }}
                              className="absolute top-2 right-2 px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white text-xs font-medium rounded"
                            >
                              Copy script
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                </div>
            )}
          </div>
        </div>

        {/* Tabs for organizing content */}
        <div className="mb-6">
          <div className="flex gap-2 bg-gray-200 rounded-lg p-1 border border-gray-300">
            <button
              onClick={() => setSelectedTab('qa')}
              className={`flex-1 px-4 py-2 rounded-md font-medium transition-all flex items-center justify-center gap-2 ${
                selectedTab === 'qa'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-gray-600 hover:text-gray-800 hover:bg-gray-100'
              }`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Q&A
            </button>
            <button
              onClick={() => setSelectedTab('polls')}
              className={`flex-1 px-4 py-2 rounded-md font-medium transition-all flex items-center justify-center gap-2 ${
                selectedTab === 'polls'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-gray-600 hover:text-gray-800 hover:bg-gray-100'
              }`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              Polls
            </button>
            <button
              onClick={() => setSelectedTab('other')}
              className={`flex-1 px-4 py-2 rounded-md font-medium transition-all flex items-center justify-center gap-2 ${
                selectedTab === 'other'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-gray-600 hover:text-gray-800 hover:bg-gray-100'
              }`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
              Other
            </button>
          </div>
        </div>

        {/* Polls Tab */}
        {selectedTab === 'polls' && (
        <div className="mb-8">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-semibold text-gray-700">Polls</h2>
            <div className="flex gap-2">
              <button
                onClick={() => setShowPollForm(!showPollForm)}
                className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
              >
                {showPollForm ? 'Cancel' : '+ New Poll'}
              </button>
              {polls.length > 0 && (
                <>
                  <button
                    onClick={handleSelectAllPolls}
                    className="px-3 py-2 text-sm text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50"
                  >
                    {selectedPollIds.size === polls.length ? 'Deselect all' : 'Select all'}
                  </button>
                  <button
                    onClick={handleDeleteSelectedPolls}
                    disabled={selectedPollIds.size === 0}
                    className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Delete selected ({selectedPollIds.size})
                  </button>
                </>
              )}
            </div>
          </div>

          {showPollForm && !editingPoll && (
            <div className="mb-6">
              <PollFormEnhanced
                eventId={event.id}
                onSuccess={handlePollFormSuccess}
                onCancel={() => setShowPollForm(false)}
              />
            </div>
          )}

          {editingPoll && (
            <div className="mb-6">
              <PollFormEnhanced
                eventId={event.id}
                poll={polls.find(p => p.id === editingPoll) || undefined}
                onSuccess={() => {
                  setEditingPoll(null);
                  setSearchParams({}); // Clear URL params
                  handlePollFormSuccess();
                  // If in iframe, notify parent to close
                  if (window.parent !== window) {
                    window.parent.postMessage('closeEditModal', '*');
                  }
                }}
                onCancel={() => {
                  setEditingPoll(null);
                  setSearchParams({}); // Clear URL params
                  // If in iframe, notify parent to close
                  if (window.parent !== window) {
                    window.parent.postMessage('closeEditModal', '*');
                  }
                }}
              />
            </div>
          )}

          {polls.length === 0 ? (
            <div className="bg-white rounded-lg shadow-md p-6 text-center text-gray-500">
              <p>No polls yet. Create your first poll!</p>
            </div>
          ) : (
            <div className="grid gap-4">
              {polls.map((poll) => (
                <div
                  key={poll.id}
                  className="bg-white rounded-lg shadow-md p-6"
                >
                  <div className="flex items-start gap-4">
                    <label className="flex items-center pt-1">
                      <input
                        type="checkbox"
                        checked={selectedPollIds.has(poll.id)}
                        onChange={() => handleToggleSelectPoll(poll.id)}
                        className="rounded border-gray-300"
                      />
                    </label>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-xl font-semibold text-gray-800">{poll.title}</h3>
                      <div className="flex gap-2 mt-1">
                        <span className="text-sm text-gray-500 bg-gray-100 px-2 py-1 rounded">
                          {poll.type.replace('_', ' ')}
                        </span>
                        {poll.displayType && (
                          <span className="text-sm text-gray-500 bg-gray-100 px-2 py-1 rounded">
                            {poll.displayType.replace('_', ' ')}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="shrink-0">
                      <button
                        onClick={() => {
                          setEditingPoll(poll.id);
                          setShowPollForm(false);
                        }}
                        className="px-3 py-1 text-blue-600 border border-blue-300 rounded-md hover:bg-blue-50 transition-colors text-sm"
                      >
                        Edit
                      </button>
                    </div>
                  </div>
                  <div className="mt-4">
                    <p className="text-sm font-medium text-gray-700 mb-2">Options:</p>
                    <ul className="list-disc list-inside space-y-1">
                      {poll.options.map((option) => (
                        <li key={option.id} className="text-gray-600 flex items-center gap-2">
                          {option.imageUrl && (
                            <img src={option.imageUrl} alt="" className="w-6 h-6 object-contain" />
                          )}
                          <span>{option.text}</span>
                          {option.votes !== undefined && (
                            <span className="text-xs text-gray-400">({option.votes} votes)</span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                  {event?.googleSheetWebAppUrl && (
                    <div className="mt-3 pt-3 border-t border-gray-200 flex items-center gap-2 flex-wrap">
                      <label className="text-sm text-gray-600">Send to sheet tab:</label>
                      <input
                        type="text"
                        value={poll.googleSheetTab || ''}
                        onChange={(e) => {
                          const next = polls.map((p) => p.id === poll.id ? { ...p, googleSheetTab: e.target.value } : p);
                          setPolls(next);
                        }}
                        placeholder="e.g. Poll1"
                        className="flex-1 min-w-[100px] px-2 py-1.5 border border-gray-300 rounded text-sm"
                      />
                      <button
                        onClick={async () => {
                          setSavingPollTab(poll.id);
                          try {
                            await updatePoll(poll.id, { googleSheetTab: (poll.googleSheetTab || '').trim() || undefined });
                            const updated = await getPollsByEvent(event.id);
                            setPolls(updated);
                          } catch (err) {
                            setError(err instanceof Error ? err.message : 'Failed to save');
                          } finally {
                            setSavingPollTab(null);
                          }
                        }}
                        disabled={savingPollTab === poll.id}
                        className="px-2 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                      >
                        {savingPollTab === poll.id ? 'Saving...' : 'Save'}
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
        )}

        {/* Q&A Tab */}
        {selectedTab === 'qa' && (
        <div className="mb-8">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-semibold text-gray-700">Q&A Sessions</h2>
            <div className="flex gap-2">
              <button
                onClick={() => navigate(`/events/${eventId}/qa/moderation`)}
                className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors"
              >
                Moderation
              </button>
              <button
                onClick={() => setShowQAForm(!showQAForm)}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
              >
                {showQAForm ? 'Cancel' : '+ New Session'}
              </button>
              {qaSessions.length > 0 && (
                <>
                  <button
                    onClick={handleSelectAllSessions}
                    className="px-3 py-2 text-sm text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50"
                  >
                    {selectedSessionIds.size === qaSessions.length ? 'Deselect all' : 'Select all'}
                  </button>
                  <button
                    onClick={handleDeleteSelectedSessions}
                    disabled={selectedSessionIds.size === 0}
                    className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Delete selected ({selectedSessionIds.size})
                  </button>
                </>
              )}
            </div>
          </div>

          {showQAForm && !editingQA && (
            <div className="mb-6">
              <QAForm
                eventId={event.id}
                onSuccess={handleQAFormSuccess}
                onCancel={() => setShowQAForm(false)}
              />
            </div>
          )}

          {editingQA && (
            <div className="mb-6">
              <QAForm
                eventId={event.id}
                qa={qaSessions.find((q) => q.id === editingQA) || undefined}
                onSuccess={handleQAFormSuccess}
                onCancel={() => {
                  setEditingQA(null);
                  setShowQAForm(false);
                }}
              />
            </div>
          )}

          {qaSessions.length === 0 ? (
            <div className="bg-white rounded-lg shadow-md p-6 text-center text-gray-500">
              <p>No Q&A sessions yet. Create your first session!</p>
              <p className="text-sm mt-2">Sessions collect questions from the public event page. Click a session to view and manage its questions.</p>
            </div>
          ) : (
            <div className="grid gap-4">
              {qaSessions.map((session) => (
                <div
                  key={session.id}
                  className="bg-white rounded-lg shadow-md p-6 flex items-start gap-4"
                >
                  <label className="flex items-center pt-1">
                    <input
                      type="checkbox"
                      checked={selectedSessionIds.has(session.id)}
                      onChange={() => handleToggleSelectSession(session.id)}
                      className="rounded border-gray-300"
                    />
                  </label>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-xl font-semibold text-gray-800">{session.name || 'Untitled Session'}</h3>
                    {(session.collectName !== false || session.collectEmail !== false) && (
                      <p className="text-xs text-gray-500 mt-1">
                        Collects: {session.collectName ? 'Name' : ''}{session.collectName && session.collectEmail ? ' + ' : ''}{session.collectEmail ? 'Email' : ''}
                        {session.allowAnonymous ? ' (anonymous allowed)' : ''}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col gap-2 shrink-0">
                    <button
                      onClick={() => setSessionDetailSession(session)}
                      className="px-3 py-1.5 text-blue-600 border border-blue-300 rounded-md hover:bg-blue-50 transition-colors text-sm"
                    >
                      View questions
                    </button>
                    <button
                      onClick={() => {
                        setEditingQA(session.id);
                        setShowQAForm(false);
                      }}
                      className="px-3 py-1 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors text-sm"
                    >
                      Edit
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {sessionDetailSession && eventId && (
            <QASessionDetailModal
              session={sessionDetailSession}
              eventId={eventId}
              includeOrphaned={qaSessions.length === 1}
              onClose={() => setSessionDetailSession(null)}
            />
          )}
        </div>
        )}

        {/* Other Items Tab */}
        {selectedTab === 'other' && (
        <div className="mb-8">
          <h2 className="text-2xl font-semibold text-gray-700 mb-4">Other Items</h2>
          <div className="bg-white rounded-lg shadow-md p-6 text-center text-gray-500">
            <p>WebLinks, InfoBars, and Boxes coming soon!</p>
          </div>
        </div>
        )}
      </div>
    </div>
  );
}

