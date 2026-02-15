import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { getEvent, getPoll, getPollsByEvent, submitPollVotes, getQAsByEvent, submitPublicQuestion } from '../services/firestore';
import { getPollBackupSheetName, getQaBackupSheetName, postToWebApp } from '../services/googleSheets';
import type { Event, Poll, QandA } from '../types';

type TabType = 'polls' | 'qa';

export default function PublicEventPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const [event, setEvent] = useState<Event | null>(null);
  const [polls, setPolls] = useState<Poll[]>([]);
  const [qas, setQAs] = useState<QandA[]>([]);
  const [activeTab, setActiveTab] = useState<TabType>('polls');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Poll submission state
  const [pollSubmissions, setPollSubmissions] = useState<Record<string, string[]>>({});
  const [submittedPolls, setSubmittedPolls] = useState<Set<string>>(new Set());
  
  // Removed Q&A submission state - we redirect to individual Q&A pages instead

  useEffect(() => {
    console.log('PublicEventPage: useEffect triggered, eventId:', eventId);
    
    if (!eventId) {
      console.error('PublicEventPage: Event ID is missing');
      setError('Event ID is missing');
      setLoading(false);
      return;
    }

    const loadData = async () => {
      try {
        console.log('PublicEventPage: Starting to load data for eventId:', eventId);
        setLoading(true);
        setError(null);
        
        const [eventData, pollsData, qasData] = await Promise.all([
          getEvent(eventId),
          getPollsByEvent(eventId),
          getQAsByEvent(eventId),
        ]);

        console.log('PublicEventPage: Data loaded:', {
          eventData,
          pollsCount: pollsData?.length || 0,
          qasCount: qasData?.length || 0,
        });

        if (!eventData) {
          console.error('PublicEventPage: Event not found for eventId:', eventId);
          setError('Event not found');
          setLoading(false);
          return;
        }

        setEvent(eventData);
        
        // Filter polls to only those with Public button ON in Operators
        const activePolls = pollsData.filter((poll) => poll.isActiveForPublic === true);
        setPolls(activePolls);
        console.log('PublicEventPage: Set polls:', activePolls);
        
        // Q&A sessions: only show those with Public button ON in Operators
        const publicQAs = qasData.filter(
          (qa) => qa.name && !qa.question && qa.isActiveForPublic === true
        );
        setQAs(publicQAs);
        console.log('PublicEventPage: Set Q&As:', publicQAs);

        // Set initial tab based on what's available
        if (activePolls.length > 0) {
          setActiveTab('polls');
          console.log('PublicEventPage: Set active tab to polls');
        } else if (publicQAs.length > 0) {
          setActiveTab('qa');
          console.log('PublicEventPage: Set active tab to qa');
        }
      } catch (err) {
        console.error('PublicEventPage: Error loading event data:', err);
        setError(err instanceof Error ? err.message : 'Failed to load event');
      } finally {
        setLoading(false);
        console.log('PublicEventPage: Loading complete');
      }
    };

    loadData();
  }, [eventId]);

  const handlePollOptionToggle = (pollId: string, optionId: string) => {
    if (submittedPolls.has(pollId)) return; // Can't change after submission
    
    const poll = polls.find(p => p.id === pollId);
    if (!poll) return;

    setPollSubmissions(prev => {
      const current = prev[pollId] || [];
      
      if (poll.type === 'single_choice' || poll.type === 'yes_no') {
        return { ...prev, [pollId]: [optionId] };
      } else {
        // Multiple choice
        return {
          ...prev,
          [pollId]: current.includes(optionId)
            ? current.filter(id => id !== optionId)
            : [...current, optionId],
        };
      }
    });
  };

  const handlePollSubmit = async (pollId: string) => {
    const selectedOptions = pollSubmissions[pollId] || [];
    if (selectedOptions.length === 0) {
      setError('Please select at least one option');
      return;
    }

    try {
      setError(null);
      await submitPollVotes(pollId, selectedOptions);
      setSubmittedPolls(prev => new Set([...prev, pollId]));
      // Backup poll to sheet on user vote (in advance of operators)
      const pollBackupEnabled =
        event?.googleSheetWebAppUrl?.trim() &&
        (event?.pollBackupSheetName?.trim() || (event?.pollBackupSheetNames && Object.keys(event.pollBackupSheetNames).some((k) => event!.pollBackupSheetNames![k]?.trim())));
      if (pollBackupEnabled) {
        const updatedPoll = await getPoll(pollId);
        if (updatedPoll) {
          postToWebApp(
            event!.googleSheetWebAppUrl!.trim(),
            {
              type: 'poll_backup',
              sheetName: getPollBackupSheetName(event!, updatedPoll.id),
              data: {
                timestamp: new Date().toISOString(),
                id: updatedPoll.id,
                title: updatedPoll.title,
                options: (updatedPoll.options || []).map(o => ({ text: o.text, votes: o.votes ?? 0 })),
              },
            },
            event!.railwayLiveCsvBaseUrl?.trim().replace(/\/+$/, '')
          ).catch((err: unknown) => console.warn('Poll backup to sheet failed:', err));
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit vote');
    }
  };

  // Q&A submission state
  const [qaQuestions, setQaQuestions] = useState<Record<string, string>>({});
  const [qaSubmitterNames, setQaSubmitterNames] = useState<Record<string, string>>({});
  const [qaSubmitterEmails, setQaSubmitterEmails] = useState<Record<string, string>>({});
  const [qaIsAnonymous, setQaIsAnonymous] = useState<Record<string, boolean>>({});
  const [submittedQAs, setSubmittedQAs] = useState<Set<string>>(new Set());
  const [submittingQA, setSubmittingQA] = useState<string | null>(null);

  const handleQAChange = (qaId: string, field: 'question' | 'name' | 'email', value: string) => {
    if (submittedQAs.has(qaId)) return; // Can't change after submission
    if (field === 'question') {
      setQaQuestions(prev => ({ ...prev, [qaId]: value }));
    } else if (field === 'name') {
      setQaSubmitterNames(prev => ({ ...prev, [qaId]: value }));
    } else if (field === 'email') {
      setQaSubmitterEmails(prev => ({ ...prev, [qaId]: value }));
    }
  };

  const handleQAToggleAnonymous = (qaId: string) => {
    if (submittedQAs.has(qaId)) return;
    setQaIsAnonymous(prev => ({ ...prev, [qaId]: !prev[qaId] }));
    if (!qaIsAnonymous[qaId]) {
      // When enabling anonymous, clear email
      setQaSubmitterEmails(prev => ({ ...prev, [qaId]: '' }));
    }
  };

  const handleQASubmit = async (qaId: string) => {
    const qa = qas.find(q => q.id === qaId);
    if (!qa) return;

    const question = qaQuestions[qaId]?.trim();
    if (!question) {
      setError('Please enter your question');
      return;
    }

    // Validate required fields based on configuration
    if (qa.collectName && !qaIsAnonymous[qaId] && !qaSubmitterNames[qaId]?.trim()) {
      setError('Please enter your name');
      return;
    }

    if (qa.collectEmail && !qaIsAnonymous[qaId] && !qaSubmitterEmails[qaId]?.trim()) {
      setError('Please enter your email');
      return;
    }

    // Validate email format if provided
    const email = qaSubmitterEmails[qaId]?.trim();
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Please enter a valid email address');
      return;
    }

    setSubmittingQA(qaId);
    setError(null);

    try {
      await submitPublicQuestion(
        qaId,
        question,
        qaSubmitterNames[qaId]?.trim() || undefined,
        email || undefined,
        qaIsAnonymous[qaId] || false
      );
      setSubmittedQAs(prev => new Set([...prev, qaId]));
      const qaBackupEnabled =
        event?.googleSheetWebAppUrl?.trim() &&
        (event?.qaBackupSheetName?.trim() || (event?.qaBackupSheetNames && Object.keys(event.qaBackupSheetNames).some((k) => event!.qaBackupSheetNames![k]?.trim())));
      if (qaBackupEnabled && event?.googleSheetWebAppUrl) {
        const ev = event;
        const webAppUrl = ev.googleSheetWebAppUrl!.trim();
        postToWebApp(
          webAppUrl,
          {
            type: 'qa_backup',
            sheetName: getQaBackupSheetName(ev, qaId),
            data: {
              timestamp: new Date().toISOString(),
              sessionId: qaId,
              question,
              submitterName: qaIsAnonymous[qaId] ? '' : (qaSubmitterNames[qaId]?.trim() || ''),
              submitterEmail: qaIsAnonymous[qaId] ? '' : (email || ''),
              status: 'pending',
            },
          },
          ev.railwayLiveCsvBaseUrl?.trim().replace(/\/+$/, '')
        ).catch((err: unknown) => console.warn('Q&A backup to sheet failed:', err));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit question');
    } finally {
      setSubmittingQA(null);
    }
  };

  console.log('PublicEventPage: Render state:', {
    loading,
    error,
    hasEvent: !!event,
    pollsCount: polls.length,
    qasCount: qas.length,
    activeTab,
  });

  if (loading) {
    console.log('PublicEventPage: Rendering loading state');
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (error && !event) {
    console.log('PublicEventPage: Rendering error state:', error);
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 flex items-center justify-center">
        <div className="bg-white rounded-lg shadow-md p-8 max-w-md text-center">
          <p className="text-red-600">{error}</p>
          <p className="text-sm text-gray-500 mt-2">Check console for details</p>
        </div>
      </div>
    );
  }

  const hasPolls = polls.length > 0;
  const hasQAs = qas.length > 0;

  console.log('PublicEventPage: Content check:', { hasPolls, hasQAs });

  if (!hasPolls && !hasQAs) {
    console.log('PublicEventPage: No polls or Q&As found');
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 flex items-center justify-center">
        <div className="bg-white rounded-lg shadow-md p-8 max-w-md text-center">
          <p className="text-gray-600">No polls or Q&A available for this event.</p>
          {event && (
            <p className="text-sm text-gray-500 mt-2">
              Event: {event.name} ({new Date(event.date).toLocaleDateString()})
            </p>
          )}
        </div>
      </div>
    );
  }

  console.log('PublicEventPage: Rendering main content');

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        {event && (
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-gray-800 mb-2">{event.name}</h1>
            <p className="text-gray-600">{new Date(event.date).toLocaleDateString()}</p>
          </div>
        )}

        {/* Tabs - Only show if both Polls and Q&A exist */}
        {hasPolls && hasQAs && (
          <div className="mb-6">
            <div className="flex gap-2 bg-white rounded-lg p-1 shadow-md">
              <button
                onClick={() => setActiveTab('polls')}
                className={`flex-1 px-6 py-3 rounded-md font-semibold transition-all ${
                  activeTab === 'polls'
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'text-gray-600 hover:text-gray-800'
                }`}
              >
                Polls ({polls.length})
              </button>
              <button
                onClick={() => setActiveTab('qa')}
                className={`flex-1 px-6 py-3 rounded-md font-semibold transition-all ${
                  activeTab === 'qa'
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'text-gray-600 hover:text-gray-800'
                }`}
              >
                Q&A ({qas.length})
              </button>
            </div>
          </div>
        )}

        {error && (
          <div className="mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg">
            {error}
          </div>
        )}

        {/* Polls Content - Show if active tab is polls OR if only polls exist */}
        {(activeTab === 'polls' || (hasPolls && !hasQAs)) && hasPolls && (
          <div className="space-y-6">
            {polls.map((poll) => {
              const selectedOptions = pollSubmissions[poll.id] || [];
              const isSubmitted = submittedPolls.has(poll.id);

              return (
                <div key={poll.id} className="bg-white rounded-lg shadow-xl p-8">
                  <h2 className="text-2xl font-bold text-gray-800 mb-6">{poll.title}</h2>
                  
                  {isSubmitted ? (
                    <div className="text-center py-8">
                      <div className="text-6xl mb-4 text-green-500">✓</div>
                      <p className="text-lg text-gray-600">Thank you! Your response has been recorded.</p>
                    </div>
                  ) : (
                    <>
                      <div className="space-y-3 mb-6">
                        {poll.options.map((option) => (
                          <button
                            key={option.id}
                            onClick={() => handlePollOptionToggle(poll.id, option.id)}
                            className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
                              selectedOptions.includes(option.id)
                                ? 'border-blue-600 bg-blue-50'
                                : 'border-gray-200 hover:border-gray-300'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <div
                                className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                                  selectedOptions.includes(option.id)
                                    ? 'border-blue-600 bg-blue-600'
                                    : 'border-gray-300'
                                }`}
                              >
                                {selectedOptions.includes(option.id) && (
                                  <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                  </svg>
                                )}
                              </div>
                              <span className="text-lg font-medium text-gray-800">{option.text}</span>
                            </div>
                          </button>
                        ))}
                      </div>

                      <button
                        onClick={() => handlePollSubmit(poll.id)}
                        disabled={selectedOptions.length === 0}
                        className="w-full bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-semibold text-lg"
                      >
                        Submit
                      </button>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Q&A Content - Show if active tab is qa OR if only Q&A exists */}
        {(activeTab === 'qa' || (hasQAs && !hasPolls)) && hasQAs && (
          <div className="space-y-6">
            {qas.map((qa) => {
              const question = qaQuestions[qa.id] || '';
              const submitterName = qaSubmitterNames[qa.id] || '';
              const submitterEmail = qaSubmitterEmails[qa.id] || '';
              const isAnonymous = qaIsAnonymous[qa.id] || false;
              const isSubmitted = submittedQAs.has(qa.id);
              const isSubmitting = submittingQA === qa.id;

              return (
                <div key={qa.id} className="bg-white rounded-lg shadow-xl p-8">
                  <h2 className="text-2xl font-bold text-gray-800 mb-6">{qa.name || 'Q&A Session'}</h2>
                  
                  {isSubmitted ? (
                    <div className="text-center py-8">
                      <div className="text-6xl mb-4 text-green-500">✓</div>
                      <p className="text-lg text-gray-600 mb-6">Thank you! Your question has been submitted and will be reviewed.</p>
                      <div className="flex flex-col gap-3 max-w-md mx-auto mt-6">
                        <button
                          onClick={() => {
                            setSubmittedQAs(prev => {
                              const newSet = new Set(prev);
                              newSet.delete(qa.id);
                              return newSet;
                            });
                            setQaQuestions(prev => ({ ...prev, [qa.id]: '' }));
                            setQaSubmitterNames(prev => ({ ...prev, [qa.id]: '' }));
                            setQaSubmitterEmails(prev => ({ ...prev, [qa.id]: '' }));
                            setQaIsAnonymous(prev => ({ ...prev, [qa.id]: false }));
                          }}
                          className="w-full bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors font-semibold text-lg shadow-md"
                        >
                          Submit Another Question
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="mb-6">
                        <label htmlFor={`qa-question-${qa.id}`} className="block text-sm font-medium text-gray-700 mb-2">
                          Your Question <span className="text-red-500">*</span>
                        </label>
                        <textarea
                          id={`qa-question-${qa.id}`}
                          value={question}
                          onChange={(e) => handleQAChange(qa.id, 'question', e.target.value)}
                          rows={4}
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="Enter your question here..."
                          required
                        />
                      </div>

                      {/* Anonymous Option - Only if allowAnonymous is true */}
                      {qa.allowAnonymous && qa.collectName && (
                        <div className="flex items-center mb-4">
                          <input
                            id={`qa-anonymous-${qa.id}`}
                            type="checkbox"
                            checked={isAnonymous}
                            onChange={() => handleQAToggleAnonymous(qa.id)}
                            className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                          />
                          <label htmlFor={`qa-anonymous-${qa.id}`} className="ml-2 text-sm text-gray-700">
                            Submit anonymously
                          </label>
                        </div>
                      )}

                      {/* Name Field - Only if collectName is true */}
                      {qa.collectName && (
                        <div className="mb-4">
                          <label htmlFor={`qa-name-${qa.id}`} className="block text-sm font-medium text-gray-700 mb-2">
                            Your Name {!qa.allowAnonymous ? <span className="text-red-500">*</span> : ''}
                          </label>
                          <input
                            id={`qa-name-${qa.id}`}
                            type="text"
                            value={submitterName}
                            onChange={(e) => handleQAChange(qa.id, 'name', e.target.value)}
                            disabled={isAnonymous}
                            required={!qa.allowAnonymous}
                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                            placeholder={isAnonymous ? 'Anonymous' : 'Enter your name'}
                          />
                        </div>
                      )}

                      {/* Email Field - Only if collectEmail is true */}
                      {qa.collectEmail && !isAnonymous && (
                        <div className="mb-6">
                          <label htmlFor={`qa-email-${qa.id}`} className="block text-sm font-medium text-gray-700 mb-2">
                            Your Email <span className="text-red-500">*</span>
                          </label>
                          <input
                            id={`qa-email-${qa.id}`}
                            type="email"
                            value={submitterEmail}
                            onChange={(e) => handleQAChange(qa.id, 'email', e.target.value)}
                            required
                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="Enter your email address"
                          />
                        </div>
                      )}

                      <button
                        onClick={() => handleQASubmit(qa.id)}
                        disabled={isSubmitting || !question.trim()}
                        className="w-full bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-semibold text-lg"
                      >
                        {isSubmitting ? 'Submitting...' : 'Submit Question'}
                      </button>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

