import { useState, useEffect } from 'react';
import { useParams, Link, useSearchParams, useNavigate } from 'react-router-dom';
import { getEvent, getPollsByEvent, getQAsByEvent, updateEvent, updatePoll } from '../services/firestore';
import { extractSpreadsheetId } from '../services/googleSheets';
import { GOOGLE_SHEET_SCRIPT, GOOGLE_SHEET_SCRIPT_FIRESTORE, GOOGLE_SHEET_SCRIPT_FIRESTORE_SIMPLE } from '../constants/googleSheetScript';
import type { Event, Poll, QandA } from '../types';
import PollFormEnhanced from '../components/PollFormEnhanced';
import QAForm from '../components/QAForm';

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
  const [selectedTab, setSelectedTab] = useState<'polls' | 'qa' | 'other'>('polls');
  const navigate = useNavigate();
  
  // Check for edit parameter in URL
  useEffect(() => {
    const editPollId = searchParams.get('edit');
    if (editPollId) {
      setEditingPoll(editPollId);
      setShowPollForm(false);
    }
  }, [searchParams]);
  const [showSheetForm, setShowSheetForm] = useState(false);
  const [sheetUrl, setSheetUrl] = useState('');
  const [webAppUrl, setWebAppUrl] = useState('');
  const [activeQASheetName, setActiveQASheetName] = useState('');
  const [activeQACell, setActiveQACell] = useState('');
  const [savingSheet, setSavingSheet] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savingPollTab, setSavingPollTab] = useState<string | null>(null);
  const [scriptCopied, setScriptCopied] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState<'script' | 'error' | 'eventId' | null>(null);
  const [scriptVariant, setScriptVariant] = useState<'webapp' | 'firestore' | 'firestore_simple' | 'blaze_url' | 'railway'>('firestore');
  const [railwayBaseUrl, setRailwayBaseUrl] = useState('');
  const projectId = (import.meta.env.VITE_FIREBASE_PROJECT_ID as string) || 'chamber-on-air-gfx';
  const liveCsvUrl = eventId ? `https://us-central1-${projectId}.cloudfunctions.net/liveQaCsv?eventId=${encodeURIComponent(eventId)}` : '';
  const importDataFormula = liveCsvUrl ? `=IMPORTDATA("${liveCsvUrl}")` : '';
  const railwayBaseUrlClean = railwayBaseUrl.trim().replace(/\/+$/, '');
  const railwayLiveCsvUrl = eventId && railwayBaseUrlClean ? `${railwayBaseUrlClean}/live-qa-csv?eventId=${encodeURIComponent(eventId)}` : '';
  const railwayImportDataFormula = railwayLiveCsvUrl ? `=IMPORTDATA("${railwayLiveCsvUrl}")` : '';
  const [sheetError, setSheetError] = useState<string | null>(null);
  const [sheetSaveSuccess, setSheetSaveSuccess] = useState(false);

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
        setQAs(qasData);
        setSheetUrl(eventData.googleSheetUrl || '');
        setWebAppUrl(eventData.googleSheetWebAppUrl || '');
        setActiveQASheetName(eventData.activeQASheetName || '');
        setActiveQACell(eventData.activeQACell || '');
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

  const handleQAFormSuccess = async () => {
    setShowQAForm(false);
    setEditingQA(null);
    if (eventId) {
      try {
        const qasData = await getQAsByEvent(eventId);
        setQAs(qasData);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to reload Q&A');
      }
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
                      onChange={(e) => setScriptVariant(e.target.value as 'webapp' | 'firestore' | 'firestore_simple' | 'blaze_url')}
                      className="text-sm border border-gray-300 rounded px-2 py-1"
                    >
                      <option value="firestore">Free plan (full – standalone or sheet, with doGet/testAuth)</option>
                      <option value="firestore_simple">Free plan (simple – sheet only, from docs)</option>
                      <option value="blaze_url">No script – Live CSV URL (Blaze, no authorization)</option>
                      <option value="webapp">Web App – needs Blaze + proxy or direct POST</option>
                    </select>
                    {scriptVariant !== 'blaze_url' && (
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
                    {scriptVariant === 'firestore'
                      ? 'Full script: runs from sheet or standalone (script.google.com). CONFIG: API key, Event ID, optional SPREADSHEET_ID for standalone.'
                      : scriptVariant === 'firestore_simple'
                      ? 'Simple script (sheet only): create from the sheet (Extensions → Apps Script). CONFIG: API key and Event ID from above. Run testAuth first, then runLiveSync.'
                      : scriptVariant === 'blaze_url'
                      ? 'No Google Apps Script. Paste the formula in a cell; Sheets refreshes the CSV periodically. Requires Blaze (Cloud Functions). Blaze has a free tier — you may pay $0.'
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
                  {scriptVariant === 'blaze_url' && (
                    <>
                      <p className="text-xs text-gray-600 mb-2">1. Upgrade to Blaze in Firebase Console (pay-as-you-go; free tier usually $0). 2. Deploy once: <code className="bg-gray-100 px-1">firebase deploy --only functions</code>. 3. In your sheet, paste the formula below into a cell.</p>
                      {liveCsvUrl && (
                        <div className="space-y-2 mb-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-xs text-gray-600">Formula (paste in a cell):</span>
                            <button
                              type="button"
                              onClick={async () => {
                                try {
                                  await navigator.clipboard.writeText(importDataFormula);
                                  setCopyFeedback('script');
                                  setTimeout(() => setCopyFeedback(null), 2000);
                                } catch (_) { setSheetError('Copy failed.'); }
                              }}
                              className="text-xs px-2 py-1 bg-emerald-600 text-white rounded hover:bg-emerald-700"
                            >
                              {copyFeedback === 'script' ? 'Copied!' : 'Copy formula'}
                            </button>
                          </div>
                          <pre className="p-3 bg-gray-100 border border-gray-300 rounded text-xs overflow-auto font-mono whitespace-pre-wrap break-all">
                            {importDataFormula}
                          </pre>
                          <p className="text-xs text-gray-500">Sheets will refresh this data periodically (e.g. every hour). No script, no authorization.</p>
                        </div>
                      )}
                    </>
                  )}
                  {scriptVariant !== 'blaze_url' && (
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
            <button
              onClick={() => setShowPollForm(!showPollForm)}
              className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
            >
              {showPollForm ? 'Cancel' : '+ New Poll'}
            </button>
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
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex-1">
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
                    <button
                      onClick={() => {
                        setEditingPoll(poll.id);
                        setShowPollForm(false);
                      }}
                      className="ml-4 px-3 py-1 text-blue-600 border border-blue-300 rounded-md hover:bg-blue-50 transition-colors text-sm"
                    >
                      Edit
                    </button>
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
            <h2 className="text-2xl font-semibold text-gray-700">Q&A</h2>
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
                {showQAForm ? 'Cancel' : '+ New Q&A'}
              </button>
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
                qa={qas.find(q => q.id === editingQA) || undefined}
                onSuccess={handleQAFormSuccess}
                onCancel={() => {
                  setEditingQA(null);
                  setShowQAForm(false);
                }}
              />
            </div>
          )}

          {qas.length === 0 ? (
            <div className="bg-white rounded-lg shadow-md p-6 text-center text-gray-500">
              <p>No Q&A items yet. Create your first Q&A!</p>
            </div>
          ) : (
            <div className="grid gap-4">
              {qas.map((qa) => (
                <div
                  key={qa.id}
                  className="bg-white rounded-lg shadow-md p-6"
                >
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex-1">
                      <h3 className="text-xl font-semibold text-gray-800 mb-2">{qa.name || qa.question || 'Untitled Q&A'}</h3>
                      <div className="flex gap-2 mt-1 mb-2">
                        <span className={`text-sm px-2 py-1 rounded ${
                          qa.status === 'approved' 
                            ? 'bg-green-100 text-green-800' 
                            : qa.status === 'rejected'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-yellow-100 text-yellow-800'
                        }`}>
                          {qa.status}
                        </span>
                        {qa.isActive && (
                          <span className="text-sm bg-green-100 text-green-800 px-2 py-1 rounded">Active</span>
                        )}
                        {qa.isNext && (
                          <span className="text-sm bg-yellow-100 text-yellow-800 px-2 py-1 rounded">Next</span>
                        )}
                      </div>
                      {qa.answer && (
                        <p className="text-gray-600 mt-2">{qa.answer}</p>
                      )}
                      {qa.submitterName && (
                        <p className="text-sm text-gray-500 mt-2">— {qa.submitterName}</p>
                      )}
                      {qa.collectName !== false || qa.collectEmail !== false ? (
                        <div className="mt-3 pt-3 border-t border-gray-200">
                          <p className="text-xs font-medium text-gray-700 mb-1">
                            Submission Form Fields:
                          </p>
                          <p className="text-xs text-gray-500">
                            {qa.collectName ? 'Name' : ''} {qa.collectName && qa.collectEmail ? '+ ' : ''} {qa.collectEmail ? 'Email' : ''} {qa.allowAnonymous ? '(Anonymous allowed)' : ''}
                          </p>
                          <p className="text-xs text-gray-400 mt-1 italic">
                            Available on the public event page
                          </p>
                        </div>
                      ) : null}
                    </div>
                    <div className="flex flex-col gap-2">
                      <button
                        onClick={() => {
                          setEditingQA(qa.id);
                          setShowQAForm(false);
                        }}
                        className="px-3 py-1 text-blue-600 border border-blue-300 rounded-md hover:bg-blue-50 transition-colors text-sm"
                      >
                        Edit
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
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

