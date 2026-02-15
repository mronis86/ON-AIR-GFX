import { useState, useEffect } from 'react';
import { useParams, Link, useSearchParams, useNavigate } from 'react-router-dom';
import { getEvent, getPollsByEvent, getQAsByEvent, updateEvent, updatePoll, deletePoll, deleteQA } from '../services/firestore';
import { extractSpreadsheetId } from '../services/googleSheets';
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
  const [pollBackupSheetName, setPollBackupSheetName] = useState('');
  const [savingSheet, setSavingSheet] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savingPollTab, setSavingPollTab] = useState<string | null>(null);
  const [scriptCopied, setScriptCopied] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState<'script' | 'error' | 'eventId' | null>(null);
  const [scriptVariant, setScriptVariant] = useState<'webapp' | 'firestore' | 'firestore_simple' | 'railway'>('railway');
  const [railwayBaseUrl, setRailwayBaseUrl] = useState('');
  const railwayBaseUrlClean = railwayBaseUrl.trim().replace(/\/+$/, '');
  const railwayLiveQaCsvUrl = eventId && railwayBaseUrlClean ? `${railwayBaseUrlClean}/live-qa-csv?eventId=${encodeURIComponent(eventId)}` : '';
  const railwayLivePollCsvUrl = eventId && railwayBaseUrlClean ? `${railwayBaseUrlClean}/live-poll-csv?eventId=${encodeURIComponent(eventId)}` : '';
  const railwayImportDataFormula = railwayLiveQaCsvUrl ? `=IMPORTDATA("${railwayLiveQaCsvUrl}")` : '';
  const railwayPollImportDataFormula = railwayLivePollCsvUrl ? `=IMPORTDATA("${railwayLivePollCsvUrl}")` : '';
  const [sheetError, setSheetError] = useState<string | null>(null);
  const [sheetSaveSuccess, setSheetSaveSuccess] = useState(false);
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
        setPollBackupSheetName(eventData.pollBackupSheetName || '');
        setRailwayBaseUrl(eventData.railwayLiveCsvBaseUrl || '');
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
        pollBackupSheetName: pollBackupSheetName.trim() || undefined,
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
                      setPollBackupSheetName(event.pollBackupSheetName || '');
                      setRailwayBaseUrl(event.railwayLiveCsvBaseUrl || '');
                    }}
                    className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
                <p className="mt-1 text-xs text-gray-500">Spreadsheet URL is for the link to open the sheet.</p>
                <div className="mt-4 space-y-3">
                  <div>
                    <label htmlFor="webapp-url" className="block text-sm font-medium text-gray-700 mb-1">Web App URL (for writing)</label>
                    <input
                      id="webapp-url"
                      type="text"
                      value={webAppUrl}
                      onChange={(e) => setWebAppUrl(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="https://script.google.com/macros/s/.../exec"
                    />
                    <p className="mt-0.5 text-xs text-gray-500">In the sheet: Extensions → Apps Script, paste the code from the script below (use &quot;Free plan&quot; for no Blaze/Web App). Copy the Web App URL here if using Web App script.</p>
                  </div>
                  <div className="flex gap-4 flex-wrap">
                    <div className="flex-1 min-w-[120px]">
                      <label htmlFor="qa-sheet" className="block text-sm font-medium text-gray-700 mb-1">Active Q&A sub-sheet</label>
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
                  <p className="text-xs text-gray-500">The currently active Q&A question is written to this sheet/cell when it changes.</p>
                </div>
                <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="qa-backup-sheet" className="block text-sm font-medium text-gray-700 mb-1">Q&A backup sub-sheet</label>
                    <input
                      id="qa-backup-sheet"
                      type="text"
                      value={qaBackupSheetName}
                      onChange={(e) => setQaBackupSheetName(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="e.g. QA_Submissions"
                    />
                    <p className="mt-0.5 text-xs text-gray-500">Append every Q&A submission (question, submitter, status) to this sheet. Requires Web App URL.</p>
                  </div>
                  <div>
                    <label htmlFor="poll-backup-sheet" className="block text-sm font-medium text-gray-700 mb-1">Poll backup sub-sheet</label>
                    <input
                      id="poll-backup-sheet"
                      type="text"
                      value={pollBackupSheetName}
                      onChange={(e) => setPollBackupSheetName(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="e.g. Poll_Results"
                    />
                    <p className="mt-0.5 text-xs text-gray-500">Append each poll snapshot when a poll is played. Requires Web App URL.</p>
                  </div>
                </div>
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <p className="text-sm font-medium text-gray-700 mb-2">For the Free plan script CONFIG</p>
                  <p className="text-xs text-gray-600 mb-1">Use the same API key as in your .env (VITE_FIREBASE_API_KEY). Event ID is below — copy it into CONFIG as LIVE_STATE_EVENT_ID.</p>
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
                  <p className="text-sm font-medium text-gray-700 mb-2">Copy script for your Google Sheet</p>
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <label className="text-xs text-gray-600">Script:</label>
                    <select
                      value={scriptVariant}
                      onChange={(e) => setScriptVariant(e.target.value as 'webapp' | 'firestore' | 'firestore_simple' | 'railway')}
                      className="text-sm border border-gray-300 rounded px-2 py-1"
                    >
                      <option value="railway">Railway – Live CSV (no script, no Blaze)</option>
                      <option value="firestore">Free plan (full – standalone or sheet, with doGet/testAuth)</option>
                      <option value="firestore_simple">Free plan (simple – sheet only, from docs)</option>
                      <option value="webapp">Web App – needs Blaze + proxy or direct POST</option>
                    </select>
                    {scriptVariant !== 'railway' && (
                    <button
                      type="button"
                      onClick={async () => {
                        const script = scriptVariant === 'firestore' ? GOOGLE_SHEET_SCRIPT_FIRESTORE : scriptVariant === 'firestore_simple' ? GOOGLE_SHEET_SCRIPT_FIRESTORE_SIMPLE : GOOGLE_SHEET_SCRIPT;
                        try {
                          await navigator.clipboard.writeText(script);
                          setCopyFeedback('script');
                          setScriptCopied(true);
                          setTimeout(() => { setScriptCopied(false); setCopyFeedback(null); }, 2000);
                        } catch (_) {
                          setSheetError('Copy failed. Select and copy the script below manually.');
                        }
                      }}
                      className="shrink-0 px-3 py-1.5 bg-gray-700 text-white text-sm rounded hover:bg-gray-800"
                    >
                      {copyFeedback === 'script' ? 'Copied!' : 'Copy script'}
                    </button>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mb-2">
                    {scriptVariant === 'railway'
                      ? 'Deploy the live-csv-server to Railway, paste your Railway URL below, then copy the formula into a cell. No Blaze, no Apps Script.'
                      : scriptVariant === 'firestore'
                      ? 'Full script: runs from sheet or standalone (script.google.com). CONFIG: API key, Event ID, optional SPREADSHEET_ID for standalone.'
                      : scriptVariant === 'firestore_simple'
                      ? 'Simple script (sheet only): create from the sheet (Extensions → Apps Script). CONFIG: API key and Event ID from above. Run testAuth first, then runLiveSync.'
                      : 'Deploy as web app and paste the URL above. Works with Cloud Function proxy (Blaze plan) or may fail in browser (CORS).'}
                  </p>
                  {scriptVariant === 'firestore' && (
                    <p className="text-xs text-amber-700 mb-2">
                      <strong>Getting &quot;unknown error&quot;?</strong> Use STANDALONE: go to script.google.com → New project → paste this script. In CONFIG set <strong>SPREADSHEET_ID</strong> to the ID from your sheet URL (the part between /d/ and /edit). Then run testAuth, then runLiveSync. Use a personal Gmail if you can.
                    </p>
                  )}
                  {scriptVariant === 'firestore_simple' && (
                    <p className="text-xs text-amber-700 mb-2">
                      <strong>Getting &quot;unknown error&quot;?</strong> Run <strong>testAuth</strong> first: in the script editor, open the function dropdown (next to Run), select <strong>testAuth</strong>, click Run. When the browser asks for permission, click Advanced → Go to … (unsafe) if you see &quot;This app isn&apos;t verified&quot;, then Allow. After that, run <strong>runLiveSync</strong>. Use a personal Gmail if you can.
                    </p>
                  )}
                  {scriptVariant === 'railway' && (
                    <div className="space-y-3 mb-2">
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Railway CSV server URL</label>
                        <input
                          type="text"
                          value={railwayBaseUrl}
                          onChange={(e) => setRailwayBaseUrl(e.target.value)}
                          placeholder="https://your-app.up.railway.app"
                          className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
                        />
                        <p className="text-xs text-gray-500 mt-1">Paste your Railway app URL (from Railway dashboard → Domains). Save above to persist.</p>
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
                    </div>
                  )}

                  {/* Timed Refresh Script Modal */}
                  {showRefreshScriptModal && scriptVariant === 'railway' && (
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
                              {getTimedRefreshScript(railwayBaseUrlClean || 'https://your-app.up.railway.app', eventId || 'YOUR_EVENT_ID')}
                            </pre>
                            <button
                              type="button"
                              onClick={async () => {
                                try {
                                  await navigator.clipboard.writeText(getTimedRefreshScript(railwayBaseUrlClean || 'https://your-app.up.railway.app', eventId || 'YOUR_EVENT_ID'));
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

                  {scriptVariant !== 'railway' && (
                  <pre className="mt-2 p-3 bg-gray-100 border border-gray-300 rounded text-xs overflow-auto max-h-64 font-mono whitespace-pre-wrap break-all">
                    {scriptVariant === 'firestore' ? GOOGLE_SHEET_SCRIPT_FIRESTORE : scriptVariant === 'firestore_simple' ? GOOGLE_SHEET_SCRIPT_FIRESTORE_SIMPLE : GOOGLE_SHEET_SCRIPT}
                  </pre>
                  )}
                </div>
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

