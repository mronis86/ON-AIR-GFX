import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAllEvents, getEvent, getPollsByEvent, getQAsByEvent, updatePoll, updateQA, setLiveState } from '../services/firestore';
import type { Event, Poll, QandA } from '../types';
import PollDisplay from '../components/PollDisplay';
import QADisplay from '../components/QADisplay';
import { getAnimationClasses, getTransitionInClass, afterDelayThenPaint, saveAnimationSettings, getAnimationSettings } from '../utils/animations';
import { postToWebApp } from '../services/googleSheets';
import { buildLiveQaCsv, downloadCsv } from '../utils/liveDataCsv';

const OPERATOR_PASSWORD = '1615';

// Broadcast icon SVG
const BroadcastIcon = () => (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
  </svg>
);

const VideoIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
  </svg>
);

const PollIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
  </svg>
);

const QAIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

type FilterType = 'all' | 'upcoming' | 'past';
type ItemType = 'polls' | 'qa' | 'weblinks' | 'infobars' | 'boxes';

export default function OperatorsPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [events, setEvents] = useState<Event[]>([]);
  const [filter, setFilter] = useState<FilterType>('upcoming');
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [polls, setPolls] = useState<Poll[]>([]);
  const [qas, setQAs] = useState<QandA[]>([]);
  const [qaQuestions, setQAQuestions] = useState<QandA[]>([]);
  const [loading, setLoading] = useState(false);
  const [activePoll, setActivePoll] = useState<Poll | null>(null);
  const [activeQA, setActiveQA] = useState<QandA | null>(null);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [qaAnimatingIn, setQAAnimatingIn] = useState(false); // Track if Q&A is animating in
  const activeQARef = useRef<string | null>(null); // Track active QA ID to prevent unnecessary updates
  const qaAnimateInScheduledRef = useRef(false); // True while delayed animate-in is pending; prevents effect from showing immediately
  const pollAnimateInScheduledRef = useRef(false); // Same for poll animate-in
  const [editingPollId, setEditingPollId] = useState<string | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedItemType, setSelectedItemType] = useState<ItemType>('polls');
  const [showPreviewPopup, setShowPreviewPopup] = useState(false);
  const [previewPosition, setPreviewPosition] = useState({ x: 0, y: 0 });
  const [previewSize, setPreviewSize] = useState({ width: 960, height: 540 });
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [showSettings, setShowSettings] = useState(false);
  // Load animation settings from localStorage
  const initialAnimationSettings = getAnimationSettings();
  const [animationInType, setAnimationInType] = useState<'fade' | 'slideUp' | 'slideDown' | 'slideLeft' | 'slideRight' | 'scale'>(initialAnimationSettings.animationInType);
  const [animationOutType, setAnimationOutType] = useState<'fade' | 'slideUp' | 'slideDown' | 'slideLeft' | 'slideRight' | 'scale'>(initialAnimationSettings.animationOutType);
  const [backgroundAnimateFirst, setBackgroundAnimateFirst] = useState(initialAnimationSettings.backgroundAnimateFirst);
  const [qaAnimateInDelayMs, setQAAnimateInDelayMs] = useState(initialAnimationSettings.qaAnimateInDelayMs ?? 100);
  const [showOutputOptions, setShowOutputOptions] = useState(false);
  const [expandedPollId, setExpandedPollId] = useState<string | null>(null);
  const [expandedQAId, setExpandedQAId] = useState<string | null>(null);
  const [previewOutput, setPreviewOutput] = useState<number>(1); // Output 1-4 for preview
  const navigate = useNavigate();

  useEffect(() => {
    // Check if already authenticated (stored in sessionStorage)
    const auth = sessionStorage.getItem('operator_authenticated');
    if (auth === 'true') {
      setIsAuthenticated(true);
      loadEvents();
    }
  }, []);

  // Update preview when polls change or preview output changes
  useEffect(() => {
    if (polls.length > 0) {
      // Find active poll that is enabled for the current preview output
      const active = polls.find((p) => {
        if (!p.isActive) return false;
        // Check if this poll should show on the current preview output
        const outputSettings = p.outputSettings || {};
        const shouldShow = 
          (outputSettings.fullScreen?.includes(previewOutput)) ||
          (outputSettings.lowerThird?.includes(previewOutput)) ||
          (outputSettings.pip?.includes(previewOutput));
        
        return shouldShow;
      });
      
      if (active) {
        // Only update if it's a different poll or output changed
        if (!activePoll || activePoll.id !== active.id) {
          // Animate in: render hidden first, then after delay + paint set visible
          pollAnimateInScheduledRef.current = true;
          setActivePoll(active);
          setPreviewVisible(false);
          afterDelayThenPaint(qaAnimateInDelayMs, () => {
            setPreviewVisible(true);
            pollAnimateInScheduledRef.current = false;
          });
        } else if (!previewVisible && !pollAnimateInScheduledRef.current) {
          setPreviewVisible(true);
        }
      } else {
        // If no active poll, animate out if there was one visible
        if (activePoll && previewVisible) {
          setPreviewVisible(false);
          setTimeout(() => {
            setActivePoll(null);
          }, 500);
        } else if (!activePoll) {
          setActivePoll(null);
          setPreviewVisible(false);
        }
      }
    } else {
      setActivePoll(null);
      setPreviewVisible(false);
    }
  }, [polls, activePoll?.id, previewVisible, previewOutput, qaAnimateInDelayMs]);

  // Update preview when Q&A questions change or preview output changes
  // Q&A shows only if no poll is active (polls take priority)
  useEffect(() => {
    // Only check Q&A if no poll is active (polls take priority)
    if (activePoll) {
      // Poll is active, so don't show Q&A
      if (activeQA) {
        setActiveQA(null);
        setPreviewVisible(false);
      }
      return;
    }
    
    if (qaQuestions.length > 0) {
      // Build enriched questions list - combine questions with their parent session settings
      const enrichedQuestions: QandA[] = [];
      
      // First, add all questions with their outputSettings
      qaQuestions.forEach(qa => {
        let outputSettings = qa.outputSettings;
        
        // If question doesn't have outputSettings, find parent session
        if (!outputSettings || Object.keys(outputSettings).length === 0) {
          const parentSession = qas.find(session => 
            session.eventId === qa.eventId && 
            session.name && 
            !session.question &&
            session.outputSettings &&
            Object.keys(session.outputSettings).length > 0
          );
          if (parentSession?.outputSettings) {
            outputSettings = parentSession.outputSettings;
          }
        }
        
        enrichedQuestions.push({ ...qa, outputSettings: outputSettings || {} });
      });
      
      // Find the ACTIVE Q&A question that is enabled for the current preview output
      // Only show ACTIVE questions (not CUE) - CUE questions become ACTIVE when play is clicked
      let active: QandA | undefined;
      
      active = enrichedQuestions.find((qa) => {
        if (!qa.isActive) return false; // Only look for ACTIVE questions (not CUE)
        const outputSettings = qa.outputSettings || {};
        return (
          (outputSettings.fullScreen?.includes(previewOutput)) ||
          (outputSettings.lowerThird?.includes(previewOutput)) ||
          (outputSettings.pip?.includes(previewOutput)) ||
          (outputSettings.splitScreen?.includes(previewOutput))
        );
      });
      
      if (active) {
        // Only update if it's a different Q&A or output changed
        if (!activeQA || activeQA.id !== active.id) {
          // If switching from one Q&A to another, animate out first
          if (activeQA && previewVisible) {
            setPreviewVisible(false);
            setQAAnimatingIn(false);
            setTimeout(() => {
              qaAnimateInScheduledRef.current = true;
              setActiveQA(active);
              setQAAnimatingIn(false);
              setPreviewVisible(false);
              afterDelayThenPaint(qaAnimateInDelayMs, () => {
                setQAAnimatingIn(true);
                setPreviewVisible(true);
                qaAnimateInScheduledRef.current = false;
              });
            }, 500);
          } else {
            qaAnimateInScheduledRef.current = true;
            setActiveQA(active);
            setQAAnimatingIn(false);
            setPreviewVisible(false);
            afterDelayThenPaint(qaAnimateInDelayMs, () => {
              setQAAnimatingIn(true);
              setPreviewVisible(true);
              qaAnimateInScheduledRef.current = false;
            });
          }
        } else if (!previewVisible && !qaAnimateInScheduledRef.current) {
          setQAAnimatingIn(true);
          setPreviewVisible(true);
        }
      } else {
        // If no active Q&A, animate out if there was one visible
        if (activeQA && previewVisible) {
          setPreviewVisible(false);
          setQAAnimatingIn(false);
          setTimeout(() => {
            setActiveQA(null);
            setQAAnimatingIn(false);
          }, 500);
        } else if (!activeQA) {
          setActiveQA(null);
          setQAAnimatingIn(false);
          setPreviewVisible(false);
        }
      }
    } else {
      // No Q&A questions - clear if we had one
      if (activeQA) {
        setPreviewVisible(false);
        setQAAnimatingIn(false);
        setTimeout(() => {
          setActiveQA(null);
          setQAAnimatingIn(false);
        }, 500);
      }
    }
  }, [qaQuestions, activeQA?.id, previewVisible, previewOutput, qas, activePoll, qaAnimateInDelayMs]);

  // Always write live state to Firestore (free plan: Google Apps Script / Railway CSV read from here)
  // Use any ACTIVE Q&A question for live state (not just the one chosen for preview output), so CSV/Sheets see it
  const activeQAForLiveState = activeQA ?? qaQuestions.find((q) => q.isActive) ?? null;
  useEffect(() => {
    if (!selectedEventId || !selectedEvent) return;
    setLiveState(selectedEventId, {
      activePoll: activePoll
        ? {
            id: activePoll.id,
            title: activePoll.title,
            type: activePoll.type,
            options: activePoll.options,
            googleSheetTab: activePoll.googleSheetTab,
          }
        : null,
      activeQA: activeQAForLiveState
        ? {
            question: activeQAForLiveState.question ?? '',
            answer: activeQAForLiveState.answer ?? '',
            submitterName: activeQAForLiveState.submitterName ?? '',
          }
        : null,
      pollSheetName: activePoll?.googleSheetTab?.trim() || undefined,
      qaSheetName: selectedEvent?.activeQASheetName?.trim() || undefined,
      qaCell: selectedEvent?.activeQACell?.trim() || undefined,
      eventName: selectedEvent?.name,
    }).catch((err: unknown) => console.warn('Live state write failed:', err));
  }, [
    selectedEventId,
    selectedEvent?.id,
    selectedEvent?.name,
    selectedEvent?.activeQASheetName,
    selectedEvent?.activeQACell,
    activePoll?.id,
    activePoll?.title,
    activePoll?.type,
    activePoll?.options,
    activePoll?.googleSheetTab,
    activeQAForLiveState?.id,
    activeQAForLiveState?.question,
    activeQAForLiveState?.answer,
    activeQAForLiveState?.submitterName,
  ]);

  // Optional: also POST to Web App when URL is set (works with Cloud Function proxy on Blaze plan)
  useEffect(() => {
    const webAppUrl = selectedEvent?.googleSheetWebAppUrl?.trim();
    if (!webAppUrl) return;

    const post = (body: object) =>
      postToWebApp(webAppUrl, body).catch((err: unknown) => console.warn('Google Sheet web app POST failed:', err));

    if (activePoll?.googleSheetTab?.trim()) {
      post({
        type: 'poll',
        subSheet: activePoll.googleSheetTab.trim(),
        poll: {
          id: activePoll.id,
          title: activePoll.title,
          type: activePoll.type,
          options: activePoll.options,
          isActive: activePoll.isActive,
        },
      });
    }

    if (selectedEvent && selectedEvent.activeQASheetName?.trim() && selectedEvent.activeQACell?.trim()) {
      post({
        type: 'qa_active',
        sheetName: selectedEvent.activeQASheetName.trim(),
        cell: selectedEvent.activeQACell.trim(),
        data: activeQA
          ? {
              question: activeQA.question,
              answer: activeQA.answer ?? '',
              submitterName: activeQA.submitterName ?? '',
            }
          : { question: '', answer: '', submitterName: '' },
      });
    }
  }, [
    selectedEvent?.id,
    selectedEvent?.googleSheetWebAppUrl,
    selectedEvent?.activeQASheetName,
    selectedEvent?.activeQACell,
    activePoll?.id,
    activePoll?.googleSheetTab,
    activePoll?.options,
    activeQA?.id,
    activeQA?.question,
    activeQA?.answer,
    activeQA?.submitterName,
  ]);

  // Refresh Q&A questions periodically to show updated Cue/Next status
  useEffect(() => {
    if (!selectedEventId) return;
    
    const interval = setInterval(async () => {
      try {
        const eventQAs = await getQAsByEvent(selectedEventId);
        const qaSessions = eventQAs.filter(qa => qa.name && !qa.question);
        const qaSubmissions = eventQAs.filter(qa => qa.question && !qa.name);
        
        // Enrich Q&A questions with outputSettings from parent sessions if missing
        const enrichedSubmissions = qaSubmissions.map(qa => {
          if (!qa.outputSettings || Object.keys(qa.outputSettings).length === 0) {
            const parentSession = qaSessions.find(session => 
              session.eventId === qa.eventId && 
              session.name && 
              !session.question &&
              session.outputSettings &&
              Object.keys(session.outputSettings).length > 0
            );
            if (parentSession?.outputSettings) {
              return { ...qa, outputSettings: parentSession.outputSettings };
            }
          }
          return qa;
        });
        
        // Check if something actually changed (to prevent unnecessary re-renders)
        const currentIds = qaQuestions.map(q => q.id).sort().join(',');
        const newIds = enrichedSubmissions.map(q => q.id).sort().join(',');
        const listChanged = currentIds !== newIds;
        
        // Check if status changed (isQueued, isNext, isActive, isDone)
        const statusChanged = qaQuestions.some(currentQ => {
          const newQ = enrichedSubmissions.find(n => n.id === currentQ.id);
          if (!newQ) return false;
          return (
            currentQ.isQueued !== newQ.isQueued ||
            currentQ.isNext !== newQ.isNext ||
            currentQ.isActive !== newQ.isActive ||
            currentQ.isDone !== newQ.isDone
          );
        }) || enrichedSubmissions.some(newQ => {
          const currentQ = qaQuestions.find(c => c.id === newQ.id);
          if (!currentQ) return false;
          return (
            currentQ.isQueued !== newQ.isQueued ||
            currentQ.isNext !== newQ.isNext ||
            currentQ.isActive !== newQ.isActive ||
            currentQ.isDone !== newQ.isDone
          );
        });
        
        // Update if list changed or status changed
        if (listChanged || statusChanged) {
          setQAQuestions(enrichedSubmissions);
        }
      } catch (err) {
        console.error('Error refreshing Q&A questions:', err);
      }
    }, 2000); // Refresh every 2 seconds to match moderation page
    
    return () => clearInterval(interval);
  }, [selectedEventId, qas]);

  // Real-time vote updates for active poll in preview
  useEffect(() => {
    if (!selectedEventId || !activePoll) return;

    const interval = setInterval(async () => {
      try {
        const eventPolls = await getPollsByEvent(selectedEventId);
        const updatedActivePoll = eventPolls.find((p) => p.isActive && p.id === activePoll.id);
        if (updatedActivePoll) {
          // Check if votes changed
          const currentVotes = activePoll.options.map(o => o.votes || 0).join(',');
          const newVotes = updatedActivePoll.options.map(o => o.votes || 0).join(',');
          if (currentVotes !== newVotes) {
            setActivePoll(updatedActivePoll);
            // Also update the polls list
            setPolls(eventPolls);
          }
        }
      } catch (err) {
        console.error('Error updating poll votes:', err);
      }
    }, 1000); // Check every 1 second

    return () => clearInterval(interval);
  }, [selectedEventId, activePoll?.id]);

  const loadEvents = async () => {
    try {
      const allEvents = await getAllEvents();
      // Sort by date (upcoming first, then past)
      allEvents.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      setEvents(allEvents);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load events');
    }
  };

  const filteredEvents = (() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    switch (filter) {
      case 'upcoming':
        return events.filter((event) => {
          const eventDate = new Date(event.date);
          eventDate.setHours(0, 0, 0, 0);
          return eventDate >= now;
        });
      case 'past':
        return events.filter((event) => {
          const eventDate = new Date(event.date);
          eventDate.setHours(0, 0, 0, 0);
          return eventDate < now;
        });
      default:
        return events;
    }
  })();

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === OPERATOR_PASSWORD) {
      setIsAuthenticated(true);
      sessionStorage.setItem('operator_authenticated', 'true');
      loadEvents();
      setError(null);
    } else {
      setError('Incorrect password');
    }
  };

  const handleBack = () => {
    setIsAuthenticated(false);
    sessionStorage.removeItem('operator_authenticated');
    setSelectedEventId(null);
    setSelectedEvent(null);
    setPolls([]);
    window.location.href = '/';
  };

  const handleEventSelect = async (eventId: string) => {
    setLoading(true);
    try {
      const event = await getEvent(eventId);
      const eventPolls = await getPollsByEvent(eventId);
      const eventQAs = await getQAsByEvent(eventId);
      // Filter to only show Q&A session containers (not individual submissions)
      const qaSessions = eventQAs.filter(qa => qa.name && !qa.question);
      // Filter to show individual Q&A questions (submissions)
      const qaSubmissions = eventQAs.filter(qa => qa.question && !qa.name);
      
      setSelectedEventId(eventId);
      setSelectedEvent(event);
      setPolls(eventPolls);
      setQAs(qaSessions);
      setQAQuestions(qaSubmissions);
      
      // Find active poll for preview
      const active = eventPolls.find((p) => p.isActive);
      if (active) {
        setActivePoll(active);
        setPreviewVisible(true);
      } else {
        setActivePoll(null);
        setPreviewVisible(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load event data');
    } finally {
      setLoading(false);
    }
  };


  const handleActivatePoll = async (pollId: string) => {
    try {
      await updatePoll(pollId, {
        isActive: true,
      });

      // Reload polls - the useEffect will handle the animation
      if (selectedEventId) {
        const eventPolls = await getPollsByEvent(selectedEventId);
        setPolls(eventPolls);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to activate poll');
      console.error('Error activating poll:', err);
    }
  };

  const handleDeactivatePoll = async (pollId: string) => {
    try {
      // Animate out first
      setPreviewVisible(false);
      setTimeout(async () => {
        await updatePoll(pollId, {
          isActive: false,
        });

        // Reload polls
        if (selectedEventId) {
          const eventPolls = await getPollsByEvent(selectedEventId);
          setPolls(eventPolls);
          
          // Clear preview if this was the active poll
          const active = eventPolls.find((p) => p.isActive);
          if (!active) {
            setActivePoll(null);
          }
        }
      }, 500); // Wait for animation to complete
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to deactivate poll');
      console.error('Error deactivating poll:', err);
    }
  };

  const handleActivateQA = async (qaId: string) => {
    try {
      // Check if there's a Cued question - if so, activate it instead of the session
      const cuedQuestion = qaQuestions.find(q => q.isQueued);
      if (cuedQuestion) {
        // Activate the Cued question (changes Cue -> Active)
        await handlePlayQuestion(cuedQuestion.id);
      } else {
        // No Cued question, activate the Q&A session as before
        await updateQA(qaId, {
          isActive: true,
        });

        // Reload Q&As
        if (selectedEventId) {
          const eventQAs = await getQAsByEvent(selectedEventId);
          const qaSessions = eventQAs.filter(qa => qa.name && !qa.question);
          const qaSubmissions = eventQAs.filter(qa => qa.question && !qa.name);
          setQAs(qaSessions);
          setQAQuestions(qaSubmissions);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to activate Q&A');
      console.error('Error activating Q&A:', err);
    }
  };

  const handleDeactivateQA = async (qaId: string) => {
    try {
      // Check if there's an Active question - if so, stop it (changes Active -> Done)
      const activeQuestion = qaQuestions.find(q => q.isActive);
      if (activeQuestion) {
        // Stop the Active question (changes Active -> Done, promotes Next -> Cue)
        await handleStopQuestion(activeQuestion.id);
      } else {
        // No Active question, deactivate the Q&A session as before
        setPreviewVisible(false);
        setTimeout(async () => {
          await updateQA(qaId, {
            isActive: false,
          });

          // Reload Q&As
          if (selectedEventId) {
            const eventQAs = await getQAsByEvent(selectedEventId);
            const qaSessions = eventQAs.filter(qa => qa.name && !qa.question);
            const qaSubmissions = eventQAs.filter(qa => qa.question && !qa.name);
            setQAs(qaSessions);
            setQAQuestions(qaSubmissions);
            
            // Clear preview if this was the active Q&A
            const active = qaSessions.find((q) => q.isActive);
            if (!active) {
              setActiveQA(null);
            }
          }
        }, 500); // Wait for animation to complete
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to deactivate Q&A');
      console.error('Error deactivating Q&A:', err);
    }
  };

  // Handle Play button for individual questions (Cue -> Active)
  const handlePlayQuestion = async (questionId: string) => {
    try {
      // Get the question to activate
      const questionToActivate = qaQuestions.find(q => q.id === questionId);
      if (!questionToActivate) return;

      // Find the parent Q&A session to get outputSettings
      const parentSession = qas.find(qa => qa.eventId === questionToActivate.eventId && qa.name && !qa.question);
      
      // Copy outputSettings from parent session if question doesn't have them
      const updates: any = {
        isQueued: false,
        isActive: true,
      };
      
      if (parentSession?.outputSettings && !questionToActivate.outputSettings) {
        updates.outputSettings = parentSession.outputSettings;
      }

      // Update Cue question to Active
      await updateQA(questionId, updates);

      // Optimistically update local state
      setQAQuestions((prev) =>
        prev.map((q) =>
          q.id === questionId ? { ...q, isActive: true, isQueued: false, ...updates } : { ...q, isActive: false }
        )
      );

      // Write live state to Firestore immediately (same data as Download CSV / Railway link)
      if (selectedEventId && selectedEvent) {
        setLiveState(selectedEventId, {
          activePoll: activePoll
            ? {
                id: activePoll.id,
                title: activePoll.title,
                type: activePoll.type,
                options: activePoll.options,
                googleSheetTab: activePoll.googleSheetTab,
              }
            : null,
          activeQA: {
            question: questionToActivate.question ?? '',
            answer: questionToActivate.answer ?? '',
            submitterName: questionToActivate.submitterName ?? '',
          },
          pollSheetName: activePoll?.googleSheetTab?.trim() || undefined,
          qaSheetName: selectedEvent.activeQASheetName?.trim() || undefined,
          qaCell: selectedEvent.activeQACell?.trim() || undefined,
          eventName: selectedEvent.name ?? '',
        }).catch((err: unknown) => console.warn('Live state write failed:', err));
      }

      // Reload Q&A questions to sync with server
      if (selectedEventId) {
        const eventQAs = await getQAsByEvent(selectedEventId);
        const qaSubmissions = eventQAs.filter(qa => qa.question && !qa.name);
        setQAQuestions(qaSubmissions);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to activate question');
      console.error('Error activating question:', err);
    }
  };

  // Handle Stop button for individual questions (Active -> Done, then promote Next to Cue)
  const handleStopQuestion = async (questionId: string) => {
    try {
      // Animate out first
      setPreviewVisible(false);
      
      setTimeout(async () => {
        // Update Active question to Done
        await updateQA(questionId, {
          isActive: false,
          isDone: true,
        });

        // Clear live state (Railway CSV) so it shows no active Q&A
        if (selectedEventId && selectedEvent) {
          setLiveState(selectedEventId, {
            activePoll: activePoll
              ? {
                  id: activePoll.id,
                  title: activePoll.title,
                  type: activePoll.type,
                  options: activePoll.options,
                  googleSheetTab: activePoll.googleSheetTab,
                }
              : null,
            activeQA: null,
            pollSheetName: activePoll?.googleSheetTab?.trim() || undefined,
            qaSheetName: selectedEvent.activeQASheetName?.trim() || undefined,
            qaCell: selectedEvent.activeQACell?.trim() || undefined,
            eventName: selectedEvent.name ?? '',
          }).catch((err: unknown) => console.warn('Live state write failed:', err));
        }

        // Find the Next question and promote it to Cue
        if (selectedEventId) {
          const eventQAs = await getQAsByEvent(selectedEventId);
          const qaSubmissions = eventQAs.filter(qa => qa.question && !qa.name);
          const nextQuestion = qaSubmissions.find(q => q.isNext);
          
          if (nextQuestion) {
            // Promote Next to Cue
            await updateQA(nextQuestion.id, {
              isNext: false,
              isQueued: true,
            });
          }

          // Reload Q&A questions
          const updatedQAs = await getQAsByEvent(selectedEventId);
          const updatedSubmissions = updatedQAs.filter(qa => qa.question && !qa.name);
          setQAQuestions(updatedSubmissions);
        }
      }, 500); // Wait for animation to complete
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to stop question');
      console.error('Error stopping question:', err);
    }
  };

  const handleUpdateOutputSettings = async (pollId: string, layoutType: 'fullScreen' | 'lowerThird' | 'pip', outputs: number[]) => {
    try {
      const poll = polls.find(p => p.id === pollId);
      if (!poll) {
        return;
      }

      // Optimistically update local state immediately for instant feedback
      const currentOutputSettings = poll.outputSettings || {};
      let newOutputSettings: { [key: string]: number[] } | undefined;
      
      if (outputs.length === 0) {
        // Empty array - remove this layout type
        const updated = { ...currentOutputSettings };
        delete updated[layoutType];
        
        // If no layout types remain, set to undefined to delete entire field
        newOutputSettings = Object.keys(updated).length > 0 ? updated : undefined;
      } else {
        // Non-empty array - update normally
        newOutputSettings = {
          ...currentOutputSettings,
          [layoutType]: outputs,
        };
      }

      // Update local state immediately for instant feedback
      setPolls(polls.map(p => 
        p.id === pollId 
          ? { ...p, outputSettings: newOutputSettings }
          : p
      ));

      // Then update in Firestore - don't wait or reload immediately
      // The optimistic update above is the source of truth
      updatePoll(pollId, {
        outputSettings: newOutputSettings,
      }).catch((err) => {
        // Only reload on error to revert the optimistic update
        console.error('Error updating output settings:', err);
        setError(err instanceof Error ? err.message : 'Failed to update output settings');
        
        if (selectedEventId) {
          getPollsByEvent(selectedEventId).then(eventPolls => {
            setPolls(eventPolls);
          });
        }
      });
    } catch (err) {
      console.error('Error updating output settings:', err);
      setError(err instanceof Error ? err.message : 'Failed to update output settings');
      
      // Reload polls on error to revert optimistic update
      if (selectedEventId) {
        const eventPolls = await getPollsByEvent(selectedEventId);
        setPolls(eventPolls);
      }
    }
  };

  const handleUpdateQAOutputSettings = async (qaId: string, layoutType: 'fullScreen' | 'lowerThird' | 'pip' | 'splitScreen', outputs: number[]) => {
    try {
      const qa = qas.find(q => q.id === qaId);
      if (!qa) {
        return;
      }

      // Optimistically update local state immediately for instant feedback
      const currentOutputSettings = qa.outputSettings || {};
      let newOutputSettings: { [key: string]: number[] } | undefined;
      
      if (outputs.length === 0) {
        // Empty array - remove this layout type
        const updated = { ...currentOutputSettings };
        delete updated[layoutType];
        
        // If no layout types remain, set to undefined to delete entire field
        newOutputSettings = Object.keys(updated).length > 0 ? updated : undefined;
      } else {
        // Non-empty array - update normally
        newOutputSettings = {
          ...currentOutputSettings,
          [layoutType]: outputs,
        };
      }

      // Update local state immediately for instant feedback
      setQAs(qas.map(q => 
        q.id === qaId 
          ? { ...q, outputSettings: newOutputSettings }
          : q
      ));

      // Then update in Firestore - don't wait or reload immediately
      // The optimistic update above is the source of truth
      updateQA(qaId, {
        outputSettings: newOutputSettings,
      }).catch((err) => {
        // Only reload on error to revert the optimistic update
        console.error('Error updating Q&A output settings:', err);
        setError(err instanceof Error ? err.message : 'Failed to update Q&A output settings');
        
        if (selectedEventId) {
          getQAsByEvent(selectedEventId).then(eventQAs => {
            const qaSessions = eventQAs.filter(q => q.name && !q.question);
            const qaSubmissions = eventQAs.filter(q => q.question && !q.name);
            setQAs(qaSessions);
            setQAQuestions(qaSubmissions);
          });
        }
      });
    } catch (err) {
      console.error('Error updating Q&A output settings:', err);
      setError(err instanceof Error ? err.message : 'Failed to update Q&A output settings');
      
      // Reload Q&As on error to revert optimistic update
      if (selectedEventId) {
        const eventQAs = await getQAsByEvent(selectedEventId);
        const qaSessions = eventQAs.filter(q => q.name && !q.question);
        const qaSubmissions = eventQAs.filter(q => q.question && !q.name);
        setQAs(qaSessions);
        setQAQuestions(qaSubmissions);
      }
    }
  };

  const handleCopyPublicLink = async () => {
    if (!selectedEventId) return;
    
    const publicLink = `${window.location.origin}/events/${selectedEventId}/public`;
    
    try {
      await navigator.clipboard.writeText(publicLink);
      // Show success message
      setError(null);
      // You could add a toast notification here if desired
      alert('Public link copied to clipboard!');
    } catch (err) {
      setError('Failed to copy link to clipboard');
      console.error('Error copying link:', err);
    }
  };

  const handlePollEditSuccess = async () => {
    // Refresh polls list after successful edit
    if (selectedEventId) {
      try {
        const eventPolls = await getPollsByEvent(selectedEventId);
        setPolls(eventPolls);
        
        // Update active poll if it was the one being edited
        if (activePoll && editingPollId && activePoll.id === editingPollId) {
          const updatedActivePoll = eventPolls.find((p) => p.id === activePoll.id);
          if (updatedActivePoll) {
            setActivePoll(updatedActivePoll);
          }
        }
      } catch (err) {
        console.error('Error refreshing polls:', err);
      }
    }
    
    // Close modal
    setShowEditModal(false);
    setEditingPollId(null);
  };

  const handlePollEditCancel = () => {
    setShowEditModal(false);
    setEditingPollId(null);
  };
  
  // Listen for messages from iframe
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data === 'closeEditModal') {
        // Refresh polls and close modal
        if (selectedEventId) {
          getPollsByEvent(selectedEventId).then(eventPolls => {
            setPolls(eventPolls);
            if (activePoll && editingPollId && activePoll.id === editingPollId) {
              const updatedActivePoll = eventPolls.find((p) => p.id === activePoll.id);
              if (updatedActivePoll) {
                setActivePoll(updatedActivePoll);
              }
            }
          }).catch(err => {
            console.error('Error refreshing polls:', err);
          });
        }
        setShowEditModal(false);
        setEditingPollId(null);
      }
    };
    
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [selectedEventId, activePoll?.id, editingPollId]);

  // Preview popup drag handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).classList.contains('preview-drag-handle')) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - previewPosition.x, y: e.clientY - previewPosition.y });
    }
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (isDragging) {
      setPreviewPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    } else if (isResizing) {
      const deltaX = e.clientX - dragStart.x;
      const deltaY = e.clientY - dragStart.y;
      const aspectRatio = 16 / 9;
      let newWidth = previewSize.width + deltaX;
      let newHeight = previewSize.height + deltaY;
      
      // Maintain 16:9 aspect ratio based on width
      newHeight = (newWidth * 9) / 16;
      
      // Enforce minimum size
      if (newWidth < 320) {
        newWidth = 320;
        newHeight = (newWidth * 9) / 16;
      }
      if (newHeight < 180) {
        newHeight = 180;
        newWidth = (newHeight * 16) / 9;
      }
      
      setPreviewSize({ width: newWidth, height: newHeight });
      setDragStart({ x: e.clientX, y: e.clientY });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    setIsResizing(false);
  };

  useEffect(() => {
    if (isDragging || isResizing) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, isResizing, dragStart, previewPosition]);

  // Update preview position when window resizes (if not being dragged)
  useEffect(() => {
    if (showPreviewPopup && !isDragging) {
      const updatePosition = () => {
        const rightMargin = 20;
        const topMargin = 80;
        setPreviewPosition({
          x: window.innerWidth - previewSize.width - rightMargin,
          y: topMargin,
        });
      };
      
      window.addEventListener('resize', updatePosition);
      return () => window.removeEventListener('resize', updatePosition);
    }
  }, [showPreviewPopup, previewSize.width, isDragging]);

  // Helper function to get animation classes

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="bg-gray-800 rounded-lg shadow-2xl p-8 max-w-md w-full border border-gray-700">
          <div className="flex items-center justify-center mb-6">
            <div className="bg-red-600 p-3 rounded-full">
              <BroadcastIcon />
            </div>
          </div>
          <h1 className="text-3xl font-bold text-white mb-2 text-center">Broadcast Control</h1>
          <p className="text-gray-400 text-center mb-6">Operator Access</p>
          <form onSubmit={handleLogin}>
            {error && (
              <div className="mb-4 p-3 bg-red-900/50 border border-red-700 text-red-300 rounded">
                {error}
              </div>
            )}
            <div className="mb-4">
              <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-2">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
                placeholder="Enter password"
                required
              />
            </div>
            <button
              type="submit"
              className="w-full bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 transition-colors font-semibold flex items-center justify-center gap-2"
            >
              <BroadcastIcon />
              Login
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <div className="bg-gray-800 border-b border-gray-700">
        <div className="w-full px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="bg-red-600 p-2 rounded">
              <BroadcastIcon />
            </div>
            <h1 className="text-2xl font-bold">Broadcast Control Panel</h1>
          </div>
          <div className="flex flex-wrap gap-2 items-center justify-end">
            {selectedEventId && (
              <>
                <button
                  onClick={handleCopyPublicLink}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
                  title="Copy public link to clipboard"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                  </svg>
                  Copy Public Link
                </button>
                <button
                  onClick={() => setShowOutputOptions(true)}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors flex items-center gap-2"
                >
                  <VideoIcon />
                  Output
                </button>
                <button
                  onClick={() => {
                    if (!showPreviewPopup) {
                      // Calculate top right position
                      const rightMargin = 20;
                      const topMargin = 80;
                      setPreviewPosition({
                        x: window.innerWidth - previewSize.width - rightMargin,
                        y: topMargin,
                      });
                    }
                    setShowPreviewPopup(!showPreviewPopup);
                  }}
                  className={`px-4 py-2 rounded-lg transition-colors flex items-center gap-2 ${
                    showPreviewPopup
                      ? 'bg-green-600 text-white hover:bg-green-700'
                      : 'bg-gray-700 text-white hover:bg-gray-600'
                  }`}
                  title="Toggle Preview Window"
                >
                  <VideoIcon />
                  Preview
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const csv = buildLiveQaCsv({
                      activeQA: activeQA ? { question: activeQA.question ?? '', answer: activeQA.answer ?? '', submitterName: activeQA.submitterName ?? '' } : null,
                      eventName: selectedEvent?.name,
                    });
                    downloadCsv(`live-qa-${selectedEventId}.csv`, csv);
                  }}
                  className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors flex items-center gap-2"
                  title="Download active live Q&A as CSV (Question, Answer, Submitter)"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Download CSV
                </button>
              </>
            )}
            <button
              onClick={() => setShowSettings(!showSettings)}
              className={`px-4 py-2 rounded-lg transition-colors flex items-center gap-2 ${
                showSettings
                  ? 'bg-gray-600 text-white'
                  : 'bg-gray-700 text-white hover:bg-gray-600'
              }`}
              title="Settings"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Settings
            </button>
            <button
              onClick={handleBack}
              className="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors flex items-center gap-2"
            >
              ← Back to Events
            </button>
          </div>
        </div>
      </div>

      {/* Output Options Popup */}
      {showOutputOptions && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowOutputOptions(false)}>
          <div className="bg-gray-800 border-2 border-gray-600 rounded-lg shadow-2xl p-6 min-w-[500px] max-w-[600px] z-50" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">Output Options</h3>
              <button
                onClick={() => setShowOutputOptions(false)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <p className="text-sm text-gray-400 mb-4">Select an output option. Configure which polls show on each output in the rundown.</p>
            <div className="grid grid-cols-2 gap-4">
              {[1, 2, 3, 4].map((outputNum) => (
                <a
                  key={outputNum}
                  href={`/output/${selectedEventId}/${outputNum}`}
                  target="_blank"
                  className="p-4 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors border-2 border-transparent hover:border-purple-500"
                  onClick={() => setShowOutputOptions(false)}
                >
                  <div className="text-white font-semibold mb-1">Output {outputNum}</div>
                  <div className="text-xs text-gray-400">Configured polls only</div>
                </a>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Settings Menu */}
      {showSettings && (
        <div className="fixed top-20 right-6 bg-gray-800 border-2 border-gray-600 rounded-lg shadow-2xl z-40 p-6 min-w-[300px]">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-white">Animation Settings</h3>
            <button
              onClick={() => setShowSettings(false)}
              className="text-gray-400 hover:text-white transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Animation In
              </label>
              <select
                value={animationInType}
                onChange={(e) => {
                  const newType = e.target.value as any;
                  setAnimationInType(newType);
                  saveAnimationSettings({
                    animationInType: newType,
                    animationOutType,
                    backgroundAnimateFirst,
                    qaAnimateInDelayMs,
                  });
                }}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-red-500"
              >
                <option value="fade">Fade</option>
                <option value="slideUp">Slide Up</option>
                <option value="slideDown">Slide Down</option>
                <option value="slideLeft">Slide Left</option>
                <option value="slideRight">Slide Right</option>
                <option value="scale">Scale</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Animation Out
              </label>
              <select
                value={animationOutType}
                onChange={(e) => {
                  const newType = e.target.value as any;
                  setAnimationOutType(newType);
                  saveAnimationSettings({
                    animationInType,
                    animationOutType: newType,
                    backgroundAnimateFirst,
                    qaAnimateInDelayMs,
                  });
                }}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-red-500"
              >
                <option value="fade">Fade</option>
                <option value="slideUp">Slide Up</option>
                <option value="slideDown">Slide Down</option>
                <option value="slideLeft">Slide Left</option>
                <option value="slideRight">Slide Right</option>
                <option value="scale">Scale</option>
              </select>
            </div>

            <div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={backgroundAnimateFirst}
                  onChange={(e) => {
                    const newValue = e.target.checked;
                    setBackgroundAnimateFirst(newValue);
                    saveAnimationSettings({
                      animationInType,
                      animationOutType,
                      backgroundAnimateFirst: newValue,
                      qaAnimateInDelayMs,
                    });
                  }}
                  className="w-4 h-4 text-red-600 rounded focus:ring-red-500"
                />
                <span className="text-sm font-medium text-gray-300">Animate Background Before Content</span>
              </label>
              <p className="text-xs text-gray-500 mt-1">When enabled, background appears first, then content animates in</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Transition on delay (ms)
              </label>
              <input
                type="number"
                min={0}
                max={10000}
                step={100}
                value={qaAnimateInDelayMs}
                onChange={(e) => {
                  const val = Math.max(0, Math.min(10000, Number(e.target.value) || 0));
                  setQAAnimateInDelayMs(val);
                  saveAnimationSettings({
                    animationInType,
                    animationOutType,
                    backgroundAnimateFirst,
                    qaAnimateInDelayMs: val,
                  });
                }}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-red-500"
              />
              <p className="text-xs text-gray-500 mt-1">Global delay before polls and Q&A transition in (0–10 s). Ensures content is loaded and animation runs.</p>
            </div>

          </div>
        </div>
      )}

      {error && (
        <div className="w-full px-6 py-4">
          <div className="bg-red-900/50 border border-red-700 text-red-300 px-4 py-3 rounded">
            {error}
          </div>
        </div>
      )}

      <div className="w-full px-6 py-6" style={{ transform: 'scale(0.67)', transformOrigin: 'top left', width: '149.25%' }}>
        {!selectedEventId ? (
          /* Events List View - Full Width */
          <div>
            {/* Filter Tabs */}
            <div className="mb-6">
              <div className="flex gap-2 bg-gray-800 rounded-lg p-1 border border-gray-700 max-w-md">
                <button
                  onClick={() => setFilter('upcoming')}
                  className={`flex-1 px-4 py-2 rounded-md font-medium transition-all ${
                    filter === 'upcoming'
                      ? 'bg-red-600 text-white shadow-md'
                      : 'text-gray-400 hover:text-gray-200'
                  }`}
                >
                  Upcoming
                </button>
                <button
                  onClick={() => setFilter('past')}
                  className={`flex-1 px-4 py-2 rounded-md font-medium transition-all ${
                    filter === 'past'
                      ? 'bg-red-600 text-white shadow-md'
                      : 'text-gray-400 hover:text-gray-200'
                  }`}
                >
                  Past
                </button>
                <button
                  onClick={() => setFilter('all')}
                  className={`flex-1 px-4 py-2 rounded-md font-medium transition-all ${
                    filter === 'all'
                      ? 'bg-red-600 text-white shadow-md'
                      : 'text-gray-400 hover:text-gray-200'
                  }`}
                >
                  All Events
                </button>
              </div>
            </div>

            {/* Events List */}
            <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
              <div className="divide-y divide-gray-700">
                {filteredEvents.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    <p>No {filter === 'upcoming' ? 'upcoming' : filter === 'past' ? 'past' : ''} events</p>
                  </div>
                ) : (
                  filteredEvents.map((event) => {
                    const eventDate = new Date(event.date);
                    eventDate.setHours(0, 0, 0, 0);
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    const isUpcoming = eventDate >= today;
                    const daysUntil = isUpcoming ? Math.ceil((eventDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)) : null;

                    return (
                      <div
                        key={event.id}
                        className="hover:bg-gray-700/50 transition-colors duration-150"
                      >
                        <button
                          onClick={() => handleEventSelect(event.id)}
                          className="w-full text-left p-6"
                        >
                          <div className="flex items-center justify-between gap-4">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-3 mb-2">
                                <h3 className="text-lg font-semibold text-white truncate">
                                  {event.name}
                                </h3>
                                {isUpcoming && daysUntil !== null && (
                                  <>
                                    {daysUntil === 0 && (
                                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-500/20 text-green-400 whitespace-nowrap">
                                        Today
                                      </span>
                                    )}
                                    {daysUntil === 1 && (
                                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-500/20 text-blue-400 whitespace-nowrap">
                                        Tomorrow
                                      </span>
                                    )}
                                    {daysUntil !== null && daysUntil > 1 && daysUntil <= 7 && (
                                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-500/20 text-gray-400 whitespace-nowrap">
                                        {daysUntil} days away
                                      </span>
                                    )}
                                  </>
                                )}
                              </div>
                              
                              <div className="flex flex-wrap items-center gap-4 text-sm text-gray-400">
                                <div className="flex items-center gap-2">
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                  </svg>
                                  <span>{new Date(event.date).toLocaleDateString()}</span>
                                </div>
                                {event.googleSheetUrl && (
                                  <div className="flex items-center gap-2 text-green-400">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    <span>Sheet connected</span>
                                  </div>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center gap-3">
                              <span className="text-red-500 font-medium">View →</span>
                            </div>
                          </div>
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        ) : (
          /* Items List */
          <div>
              {/* Items List */}
              <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
                {loading ? (
                  <div className="text-center py-8">
                    <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-red-600"></div>
                    <p className="text-gray-400 mt-2">Loading...</p>
                  </div>
                ) : selectedEvent ? (
                  <div>
                    <h2 className="text-xl font-semibold mb-2 flex items-center gap-2">
                      {selectedEvent.name}
                    </h2>
                    {selectedEventId && (
                      <div className="flex flex-wrap items-center gap-2 mb-4 text-sm text-gray-400">
                        <span>Event ID:</span>
                        <code className="bg-gray-700 px-2 py-1 rounded font-mono text-gray-300">{selectedEventId}</code>
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              await navigator.clipboard.writeText(selectedEventId);
                            } catch (_) {}
                          }}
                          className="px-2 py-1 bg-gray-600 hover:bg-gray-500 rounded text-xs"
                        >
                          Copy
                        </button>
                        <span className="text-gray-500">(use in Railway CSV URL and Sheets =IMPORTDATA)</span>
                      </div>
                    )}

                    {/* Navigation Menu */}
                    <div className="mb-6">
                      <div className="flex gap-2 bg-gray-700 rounded-lg p-1 border border-gray-600">
                        <button
                          onClick={() => setSelectedItemType('polls')}
                          className={`flex-1 px-3 py-2 rounded-md font-medium transition-all flex items-center justify-center gap-2 ${
                            selectedItemType === 'polls'
                              ? 'bg-red-600 text-white shadow-md'
                              : 'text-gray-400 hover:text-gray-200'
                          }`}
                        >
                          <PollIcon />
                          Polls
                        </button>
                        <button
                          onClick={() => setSelectedItemType('qa')}
                          className={`flex-1 px-3 py-2 rounded-md font-medium transition-all flex items-center justify-center gap-2 ${
                            selectedItemType === 'qa'
                              ? 'bg-red-600 text-white shadow-md'
                              : 'text-gray-400 hover:text-gray-200'
                          }`}
                        >
                          <QAIcon />
                          Q&A
                        </button>
                        <button
                          onClick={() => setSelectedItemType('weblinks')}
                          className={`flex-1 px-3 py-2 rounded-md font-medium transition-all flex items-center justify-center gap-2 ${
                            selectedItemType === 'weblinks'
                              ? 'bg-red-600 text-white shadow-md'
                              : 'text-gray-400 hover:text-gray-200'
                          }`}
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                          </svg>
                          Links
                        </button>
                        <button
                          onClick={() => setSelectedItemType('infobars')}
                          className={`flex-1 px-3 py-2 rounded-md font-medium transition-all flex items-center justify-center gap-2 ${
                            selectedItemType === 'infobars'
                              ? 'bg-red-600 text-white shadow-md'
                              : 'text-gray-400 hover:text-gray-200'
                          }`}
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                          </svg>
                          Info
                        </button>
                        <button
                          onClick={() => setSelectedItemType('boxes')}
                          className={`flex-1 px-3 py-2 rounded-md font-medium transition-all flex items-center justify-center gap-2 ${
                            selectedItemType === 'boxes'
                              ? 'bg-red-600 text-white shadow-md'
                              : 'text-gray-400 hover:text-gray-200'
                          }`}
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                          </svg>
                          Boxes
                        </button>
                      </div>
                    </div>

                    {/* Items Section - Polls */}
                    {selectedItemType === 'polls' && (
                      <div className="mb-6">
                        <h3 className="text-sm font-medium text-gray-400 mb-3 uppercase tracking-wide">
                          Polls
                        </h3>
                      {polls.length === 0 ? (
                        <p className="text-gray-500 text-sm">No polls for this event</p>
                      ) : (
                        <div className="space-y-3">
                          {polls.map((poll) => (
                            <div
                              key={poll.id}
                              className={`p-4 rounded-lg border-2 transition-all ${
                                poll.isActive
                                  ? 'border-green-500 bg-green-900/20'
                                  : 'border-gray-600 bg-gray-700/50'
                              }`}
                            >
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2 flex-1">
                                  <PollIcon />
                                  <h4 className="font-semibold text-white">{poll.title}</h4>
                                </div>
                                <div className="flex items-center gap-3">
                                  {/* Play button - always visible */}
                                  <button
                                    onClick={() => handleActivatePoll(poll.id)}
                                    className={`p-3 rounded-lg transition-colors ${
                                      poll.isActive
                                        ? 'bg-green-700 hover:bg-green-600'
                                        : 'bg-green-600 hover:bg-green-700'
                                    }`}
                                    title="Activate (Animate In)"
                                  >
                                    <svg className="w-7 h-7 text-white" fill="currentColor" viewBox="0 0 24 24">
                                      <path d="M8 5v14l11-7z"/>
                                    </svg>
                                  </button>
                                  
                                  {/* Stop button - always visible */}
                                  <button
                                    onClick={() => handleDeactivatePoll(poll.id)}
                                    className={`p-3 rounded-lg transition-colors ${
                                      poll.isActive
                                        ? 'bg-red-600 hover:bg-red-700'
                                        : 'bg-red-700 hover:bg-red-600'
                                    }`}
                                    title="Deactivate (Animate Out)"
                                  >
                                    <svg className="w-7 h-7 text-white" fill="currentColor" viewBox="0 0 24 24">
                                      <path d="M6 6h12v12H6z"/>
                                    </svg>
                                  </button>
                                </div>
                              </div>
                              {/* Output Configuration */}
                              <div className="mt-2 pt-2 border-t border-gray-600">
                                <div className="flex items-center justify-between mb-2">
                                  <button
                                    onClick={() => setExpandedPollId(expandedPollId === poll.id ? null : poll.id)}
                                    className="flex items-center gap-2 text-yellow-400 hover:text-yellow-300 transition-colors text-sm"
                                  >
                                    <svg className={`w-4 h-4 transition-transform ${expandedPollId === poll.id ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                    </svg>
                                    <span>Output Settings</span>
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setEditingPollId(poll.id);
                                      setShowEditModal(true);
                                    }}
                                    className="flex items-center gap-2 text-blue-400 hover:text-blue-300 transition-colors text-sm"
                                    title="Edit Poll"
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                    </svg>
                                    <span>Edit</span>
                                  </button>
                                </div>
                                
                                {expandedPollId === poll.id && (
                                  <div className="mt-3 space-y-4 bg-gray-800/50 p-4 rounded" onClick={(e) => e.stopPropagation()}>
                                    {/* Full Screen Layout */}
                                    <div className="border-b border-gray-700 pb-4 last:border-b-0 last:pb-0">
                                      <div className="mb-3">
                                        <span className={`text-sm font-medium ${
                                          (poll.outputSettings?.fullScreen?.length || 0) > 0
                                            ? 'text-yellow-400'
                                            : 'text-gray-300'
                                        }`}>
                                          Full Screen
                                        </span>
                                      </div>
                                      <div className="flex gap-2 flex-wrap">
                                        {[1, 2, 3, 4].map((outputNum) => (
                                          <button
                                            key={outputNum}
                                            onClick={(e) => {
                                              e.preventDefault();
                                              e.stopPropagation();
                                              const current = poll.outputSettings?.fullScreen || [];
                                              // Allow disabling even the last one - empty array is valid
                                              const newOutputs = current.includes(outputNum)
                                                ? current.filter(n => n !== outputNum)
                                                : [...current, outputNum].sort();
                                              // Always call update, even with empty array
                                              handleUpdateOutputSettings(poll.id, 'fullScreen', newOutputs);
                                            }}
                                            className={`px-4 py-2 rounded text-sm font-medium transition-colors ${
                                              poll.outputSettings?.fullScreen?.includes(outputNum)
                                                ? 'bg-yellow-600 text-white hover:bg-yellow-700'
                                                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                                            }`}
                                          >
                                            Output {outputNum}
                                          </button>
                                        ))}
                                      </div>
                                    </div>
                                    
                                    {/* Lower Third Layout */}
                                    <div className="border-b border-gray-700 pb-4 last:border-b-0 last:pb-0">
                                      <div className="mb-3">
                                        <span className={`text-sm font-medium ${
                                          (poll.outputSettings?.lowerThird?.length || 0) > 0
                                            ? 'text-yellow-400'
                                            : 'text-gray-300'
                                        }`}>
                                          Lower Third
                                        </span>
                                      </div>
                                      <div className="flex gap-2 flex-wrap">
                                        {[1, 2, 3, 4].map((outputNum) => (
                                          <button
                                            key={outputNum}
                                            onClick={(e) => {
                                              e.preventDefault();
                                              e.stopPropagation();
                                              const current = poll.outputSettings?.lowerThird || [];
                                              // Allow disabling even the last one - empty array is valid
                                              const newOutputs = current.includes(outputNum)
                                                ? current.filter(n => n !== outputNum)
                                                : [...current, outputNum].sort();
                                              // Always call update, even with empty array
                                              handleUpdateOutputSettings(poll.id, 'lowerThird', newOutputs);
                                            }}
                                            className={`px-4 py-2 rounded text-sm font-medium transition-colors ${
                                              poll.outputSettings?.lowerThird?.includes(outputNum)
                                                ? 'bg-yellow-600 text-white hover:bg-yellow-700'
                                                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                                            }`}
                                          >
                                            Output {outputNum}
                                          </button>
                                        ))}
                                      </div>
                                    </div>
                                    
                                    {/* PIP Layout */}
                                    <div className="border-b border-gray-700 pb-4 last:border-b-0 last:pb-0">
                                      <div className="mb-3">
                                        <span className={`text-sm font-medium ${
                                          (poll.outputSettings?.pip?.length || 0) > 0
                                            ? 'text-yellow-400'
                                            : 'text-gray-300'
                                        }`}>
                                          PIP
                                        </span>
                                      </div>
                                      <div className="flex gap-2 flex-wrap">
                                        {[1, 2, 3, 4].map((outputNum) => (
                                          <button
                                            key={outputNum}
                                            onClick={(e) => {
                                              e.preventDefault();
                                              e.stopPropagation();
                                              const current = poll.outputSettings?.pip || [];
                                              // Allow disabling even the last one - empty array is valid
                                              const newOutputs = current.includes(outputNum)
                                                ? current.filter(n => n !== outputNum)
                                                : [...current, outputNum].sort();
                                              // Always call update, even with empty array
                                              handleUpdateOutputSettings(poll.id, 'pip', newOutputs);
                                            }}
                                            className={`px-4 py-2 rounded text-sm font-medium transition-colors ${
                                              poll.outputSettings?.pip?.includes(outputNum)
                                                ? 'bg-yellow-600 text-white hover:bg-yellow-700'
                                                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                                            }`}
                                          >
                                            Output {outputNum}
                                          </button>
                                        ))}
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    )}

                    {/* Items Section - Q&A */}
                    {selectedItemType === 'qa' && (
                      <div className="mb-6">
                        <div className="flex items-center justify-between mb-3">
                          <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wide">
                            Q&A
                          </h3>
                          {selectedEventId && (
                            <button
                              onClick={() => navigate(`/events/${selectedEventId}/qa/moderation`)}
                              className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-xs transition-colors flex items-center gap-1"
                            >
                              <QAIcon />
                              Moderation
                            </button>
                          )}
                        </div>
                        {selectedEventId ? (
                          <>
                            {/* Cued, Active, and Next Questions */}
                            {(qaQuestions.some(q => q.isQueued) || qaQuestions.some(q => q.isActive) || qaQuestions.some(q => q.isNext)) && (
                              <div className="mb-6 space-y-3">
                                <h4 className="text-sm font-semibold text-gray-300 uppercase tracking-wide">Queue Status</h4>
                                {qaQuestions.find(q => q.isQueued) && (
                                  <div className="p-3 rounded-lg border-2 border-orange-500 bg-orange-900/20">
                                    <div className="text-xs font-semibold text-orange-400 uppercase tracking-wide mb-1">Cue</div>
                                    <div className="text-base text-orange-200 font-medium">
                                      {qaQuestions.find(q => q.isQueued)?.question}
                                    </div>
                                  </div>
                                )}
                                {qaQuestions.find(q => q.isActive) && (
                                  <div className="p-3 rounded-lg border-2 border-green-500 bg-green-900/20">
                                    <div className="text-xs font-semibold text-green-400 uppercase tracking-wide mb-1">Active</div>
                                    <div className="text-base text-green-200 font-medium">
                                      {qaQuestions.find(q => q.isActive)?.question}
                                    </div>
                                  </div>
                                )}
                                {qaQuestions.find(q => q.isNext) && (
                                  <div className="p-3 rounded-lg border-2 border-purple-500 bg-purple-900/20">
                                    <div className="text-xs font-semibold text-purple-400 uppercase tracking-wide mb-1">Next</div>
                                    <div className="text-base text-purple-200 font-medium">
                                      {qaQuestions.find(q => q.isNext)?.question}
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                            
                            {/* Q&A Sessions */}
                            {qas.length === 0 ? (
                              <p className="text-gray-500 text-sm">No Q&A sessions for this event</p>
                            ) : (
                              <div className="space-y-3">
                              {qas.map((qa) => (
                                <div
                                  key={qa.id}
                                  className={`p-4 rounded-lg border-2 transition-all ${
                                    qa.isActive
                                      ? 'border-green-500 bg-green-900/20'
                                      : 'border-gray-600 bg-gray-700/50'
                                  }`}
                                >
                                  <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-2 flex-1">
                                      <QAIcon />
                                      <h4 className="font-semibold text-white">{qa.name || 'Q&A Session'}</h4>
                                    </div>
                                    <div className="flex items-center gap-3">
                                      {/* Play button - always visible */}
                                      <button
                                        onClick={() => handleActivateQA(qa.id)}
                                        className={`p-3 rounded-lg transition-colors ${
                                          qa.isActive
                                            ? 'bg-green-700 hover:bg-green-600'
                                            : 'bg-green-600 hover:bg-green-700'
                                        }`}
                                        title="Activate (Animate In)"
                                      >
                                        <svg className="w-7 h-7 text-white" fill="currentColor" viewBox="0 0 24 24">
                                          <path d="M8 5v14l11-7z"/>
                                        </svg>
                                      </button>
                                      
                                      {/* Stop button - always visible */}
                                      <button
                                        onClick={() => handleDeactivateQA(qa.id)}
                                        className={`p-3 rounded-lg transition-colors ${
                                          qa.isActive
                                            ? 'bg-red-600 hover:bg-red-700'
                                            : 'bg-red-700 hover:bg-red-600'
                                        }`}
                                        title="Deactivate (Animate Out)"
                                      >
                                        <svg className="w-7 h-7 text-white" fill="currentColor" viewBox="0 0 24 24">
                                          <path d="M6 6h12v12H6z"/>
                                        </svg>
                                      </button>
                                    </div>
                                  </div>
                                  {/* Output Configuration */}
                                  <div className="mt-2 pt-2 border-t border-gray-600">
                                    <div className="flex items-center justify-between mb-2">
                                      <button
                                        onClick={() => setExpandedQAId(expandedQAId === qa.id ? null : qa.id)}
                                        className="flex items-center gap-2 text-yellow-400 hover:text-yellow-300 transition-colors text-sm"
                                      >
                                        <svg className={`w-4 h-4 transition-transform ${expandedQAId === qa.id ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                        </svg>
                                        <span>Output Settings</span>
                                      </button>
                                    </div>
                                    
                                    {expandedQAId === qa.id && (
                                      <div className="mt-3 space-y-4 bg-gray-800/50 p-4 rounded" onClick={(e) => e.stopPropagation()}>
                                        {/* Full Screen Layout */}
                                        <div className="border-b border-gray-700 pb-4 last:border-b-0 last:pb-0">
                                          <div className="mb-3">
                                            <span className={`text-sm font-medium ${
                                              (qa.outputSettings?.fullScreen?.length || 0) > 0
                                                ? 'text-yellow-400'
                                                : 'text-gray-300'
                                            }`}>
                                              Full Screen
                                            </span>
                                          </div>
                                          <div className="flex gap-2 flex-wrap">
                                            {[1, 2, 3, 4].map((outputNum) => (
                                              <button
                                                key={outputNum}
                                                onClick={(e) => {
                                                  e.preventDefault();
                                                  e.stopPropagation();
                                                  const current = qa.outputSettings?.fullScreen || [];
                                                  const newOutputs = current.includes(outputNum)
                                                    ? current.filter(n => n !== outputNum)
                                                    : [...current, outputNum].sort();
                                                  handleUpdateQAOutputSettings(qa.id, 'fullScreen', newOutputs);
                                                }}
                                                className={`px-4 py-2 rounded text-sm font-medium transition-colors ${
                                                  qa.outputSettings?.fullScreen?.includes(outputNum)
                                                    ? 'bg-yellow-600 text-white hover:bg-yellow-700'
                                                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                                                }`}
                                              >
                                                Output {outputNum}
                                              </button>
                                            ))}
                                          </div>
                                        </div>
                                        
                                        {/* Lower Third Layout */}
                                        <div className="border-b border-gray-700 pb-4 last:border-b-0 last:pb-0">
                                          <div className="mb-3">
                                            <span className={`text-sm font-medium ${
                                              (qa.outputSettings?.lowerThird?.length || 0) > 0
                                                ? 'text-yellow-400'
                                                : 'text-gray-300'
                                            }`}>
                                              Lower Third
                                            </span>
                                          </div>
                                          <div className="flex gap-2 flex-wrap">
                                            {[1, 2, 3, 4].map((outputNum) => (
                                              <button
                                                key={outputNum}
                                                onClick={(e) => {
                                                  e.preventDefault();
                                                  e.stopPropagation();
                                                  const current = qa.outputSettings?.lowerThird || [];
                                                  const newOutputs = current.includes(outputNum)
                                                    ? current.filter(n => n !== outputNum)
                                                    : [...current, outputNum].sort();
                                                  handleUpdateQAOutputSettings(qa.id, 'lowerThird', newOutputs);
                                                }}
                                                className={`px-4 py-2 rounded text-sm font-medium transition-colors ${
                                                  qa.outputSettings?.lowerThird?.includes(outputNum)
                                                    ? 'bg-yellow-600 text-white hover:bg-yellow-700'
                                                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                                                }`}
                                              >
                                                Output {outputNum}
                                              </button>
                                            ))}
                                          </div>
                                        </div>
                                        
                                        {/* PIP Layout */}
                                        <div className="border-b border-gray-700 pb-4 last:border-b-0 last:pb-0">
                                          <div className="mb-3">
                                            <span className={`text-sm font-medium ${
                                              (qa.outputSettings?.pip?.length || 0) > 0
                                                ? 'text-yellow-400'
                                                : 'text-gray-300'
                                            }`}>
                                              PIP
                                            </span>
                                          </div>
                                          <div className="flex gap-2 flex-wrap">
                                            {[1, 2, 3, 4].map((outputNum) => (
                                              <button
                                                key={outputNum}
                                                onClick={(e) => {
                                                  e.preventDefault();
                                                  e.stopPropagation();
                                                  const current = qa.outputSettings?.pip || [];
                                                  const newOutputs = current.includes(outputNum)
                                                    ? current.filter(n => n !== outputNum)
                                                    : [...current, outputNum].sort();
                                                  handleUpdateQAOutputSettings(qa.id, 'pip', newOutputs);
                                                }}
                                                className={`px-4 py-2 rounded text-sm font-medium transition-colors ${
                                                  qa.outputSettings?.pip?.includes(outputNum)
                                                    ? 'bg-yellow-600 text-white hover:bg-yellow-700'
                                                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                                                }`}
                                              >
                                                Output {outputNum}
                                              </button>
                                            ))}
                                          </div>
                                        </div>
                                        
                                        {/* Split Screen Layout */}
                                        <div className="border-b border-gray-700 pb-4 last:border-b-0 last:pb-0">
                                          <div className="mb-3">
                                            <span className={`text-sm font-medium ${
                                              (qa.outputSettings?.splitScreen?.length || 0) > 0
                                                ? 'text-yellow-400'
                                                : 'text-gray-300'
                                            }`}>
                                              Split Screen
                                            </span>
                                          </div>
                                          <div className="flex gap-2 flex-wrap">
                                            {[1, 2, 3, 4].map((outputNum) => (
                                              <button
                                                key={outputNum}
                                                onClick={(e) => {
                                                  e.preventDefault();
                                                  e.stopPropagation();
                                                  const current = qa.outputSettings?.splitScreen || [];
                                                  const newOutputs = current.includes(outputNum)
                                                    ? current.filter(n => n !== outputNum)
                                                    : [...current, outputNum].sort();
                                                  handleUpdateQAOutputSettings(qa.id, 'splitScreen', newOutputs);
                                                }}
                                                className={`px-4 py-2 rounded text-sm font-medium transition-colors ${
                                                  qa.outputSettings?.splitScreen?.includes(outputNum)
                                                    ? 'bg-yellow-600 text-white hover:bg-yellow-700'
                                                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                                                }`}
                                              >
                                                Output {outputNum}
                                              </button>
                                            ))}
                                          </div>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                            )}
                          </>
                        ) : (
                          <p className="text-gray-500 text-sm">Select an event to manage Q&A</p>
                        )}
                      </div>
                    )}

                    {/* Items Section - WebLinks */}
                    {selectedItemType === 'weblinks' && (
                      <div className="mb-6">
                        <h3 className="text-sm font-medium text-gray-400 mb-3 uppercase tracking-wide">
                          Web Links
                        </h3>
                        <p className="text-gray-500 text-sm">Web links management coming soon!</p>
                      </div>
                    )}

                    {/* Items Section - InfoBars */}
                    {selectedItemType === 'infobars' && (
                      <div className="mb-6">
                        <h3 className="text-sm font-medium text-gray-400 mb-3 uppercase tracking-wide">
                          Info Bars
                        </h3>
                        <p className="text-gray-500 text-sm">Info bars management coming soon!</p>
                      </div>
                    )}

                    {/* Items Section - Boxes */}
                    {selectedItemType === 'boxes' && (
                      <div className="mb-6">
                        <h3 className="text-sm font-medium text-gray-400 mb-3 uppercase tracking-wide">
                          Boxes
                        </h3>
                        <p className="text-gray-500 text-sm">Boxes management coming soon!</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-12 text-gray-500">
                    <p>Select an event to manage items</p>
                  </div>
                )}
              </div>
            </div>
        )}
      </div>

      {/* Preview Popup Window */}
      {showPreviewPopup && (
        <div
          className="fixed bg-gray-800 border-2 border-gray-600 rounded-lg shadow-2xl z-50"
          style={{
            left: `${previewPosition.x}px`,
            top: `${previewPosition.y}px`,
            width: `${previewSize.width}px`,
            height: `${previewSize.height + 40}px`, // Add space for header
            minWidth: '320px',
            minHeight: '220px',
          }}
        >
          {/* Header - Draggable */}
          <div
            className="preview-drag-handle bg-gray-700 px-4 py-2 flex items-center justify-between cursor-move border-b border-gray-600"
            onMouseDown={handleMouseDown}
          >
            <div className="flex items-center gap-2">
              <VideoIcon />
              <span className="text-sm font-medium text-white">Preview</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400">Output:</span>
              {[1, 2, 3, 4].map((outputNum) => (
                <button
                  key={outputNum}
                  onClick={() => setPreviewOutput(outputNum)}
                  className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                    previewOutput === outputNum
                      ? 'bg-purple-600 text-white'
                      : 'bg-gray-600 text-gray-300 hover:bg-gray-500'
                  }`}
                >
                  {outputNum}
                </button>
              ))}
            </div>
            <button
              onClick={() => setShowPreviewPopup(false)}
              className="text-gray-400 hover:text-white transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Preview Content - True 16:9 aspect ratio with proper scaling */}
          <div
            className="bg-black relative hide-scrollbar"
            style={{
              width: `${previewSize.width}px`,
              height: `${previewSize.height}px`,
              aspectRatio: '16/9',
              overflow: 'hidden',
              position: 'relative',
            }}
          >
            {activePoll ? (() => {
              // Determine which layout to show based on output settings for preview output
              const outputSettings = activePoll.outputSettings || {};
              let layoutToShow = activePoll.layoutStyle || 1;
              
              // Override layout based on what's enabled for this output
              // Priority: fullScreen > lowerThird > pip
              if (outputSettings.fullScreen?.includes(previewOutput)) {
                layoutToShow = 1;
              } else if (outputSettings.lowerThird?.includes(previewOutput)) {
                layoutToShow = 2;
              } else if (outputSettings.pip?.includes(previewOutput)) {
                layoutToShow = 3;
              }
              
              // Create a modified poll object with the correct layout
              const previewPoll = { ...activePoll, layoutStyle: layoutToShow };
              
              return layoutToShow === 1 ? (
                /* Full Screen Layout */
                <div className="relative w-full h-full hide-scrollbar" style={{ width: '960px', height: '540px', transform: `scale(${previewSize.width / 960})`, transformOrigin: 'top left', overflow: 'hidden' }}>
                  {/* Background layer - animates first if enabled */}
                  <div
                    className={`absolute inset-0 transition-all duration-500 ${backgroundAnimateFirst && previewVisible ? 'opacity-100' : !backgroundAnimateFirst ? (previewVisible ? 'opacity-100' : 'opacity-0') : 'opacity-0'}`}
                    style={{
                      width: '960px',
                      height: '540px',
                      zIndex: 0,
                      ...(() => {
                        const bg = activePoll.backgroundSettings?.fullScreen;
                        if (bg?.type === 'color' && bg.color) return { background: bg.color };
                        if (bg?.type === 'image' && bg.imageUrl) return {
                          backgroundImage: `url(${bg.imageUrl})`,
                          backgroundSize: 'cover',
                          backgroundPosition: 'center',
                          backgroundRepeat: 'no-repeat',
                        };
                        return {};
                      })(),
                      ...(() => {
                        const border = activePoll.borderSettings?.fullScreen;
                        if (border?.thickness && border.thickness > 0) {
                          const position = border.position || 'outer';
                          const borderColor = activePoll.primaryColor || '#3B82F6';
                          if (position === 'inner') {
                            return { boxShadow: `inset 0 0 0 ${border.thickness}px ${borderColor}` };
                          } else {
                            return { boxShadow: `0 0 0 ${border.thickness}px ${borderColor}` };
                          }
                        }
                        return {};
                      })(),
                      ...(activePoll.borderSettings?.fullScreen?.zoom && activePoll.borderSettings.fullScreen.zoom !== 100 ? {
                        transform: `scale(${activePoll.borderSettings.fullScreen.zoom / 100})`,
                        transformOrigin: 'center center',
                      } : {}),
                      ...(activePoll.borderRadius ? { borderRadius: `${activePoll.borderRadius}px` } : {}),
                    }}
                  />
                  {/* Content layer: key forces remount when showing so keyframe animation runs on mount; out = transition */}
                  <div
                    key={`poll-full-${activePoll.id}-${previewVisible ? 'on' : 'off'}`}
                    className={`absolute inset-0 flex items-center justify-center hide-scrollbar ${
                      previewVisible ? getTransitionInClass(animationInType) : `transition-all duration-500 ${getAnimationClasses(false, animationInType)}`
                    }`}
                    style={{
                      width: '960px',
                      height: '540px',
                      zIndex: 1,
                      background: 'transparent',
                      transitionDelay: backgroundAnimateFirst && previewVisible ? '300ms' : '0ms',
                      ...(previewVisible ? {} : { opacity: 0 }),
                    }}
                  >
                    <PollDisplay poll={previewPoll} disableBackground={true} />
                  </div>
                </div>
              ) : layoutToShow === 2 ? (
                /* Lower Third Layout - Fixed height (1/3 of screen) at bottom */
                (() => {
                  const baseHeight = 180; // 1/3 of 540px
                  const borderSetting = activePoll.borderSettings?.lowerThird;
                  const borderType = (borderSetting as any)?.type || borderSetting?.position || 'line';
                  const hasBoxEdge = borderType === 'boxEdge' || borderType === 'boxInner' || borderType === 'inner';
                  const zoomPercent = (hasBoxEdge && borderSetting?.zoom !== undefined) ? borderSetting.zoom : 100;
                  const zoomScale = zoomPercent / 100;
                  const shouldZoom = hasBoxEdge && zoomPercent !== 100;
                  const yPosition = (hasBoxEdge && (borderSetting as any)?.yPosition !== undefined && (borderSetting as any)?.yPosition !== null) 
                    ? (borderSetting as any).yPosition 
                    : 0;
                  
                  const scaleFactor = previewSize.width / 960;
                  const actualYPosition = yPosition || 0;
                  const lineOffset = 25;
                  const bottomAdjustment = shouldZoom 
                    ? (baseHeight * (1 - zoomScale) / 2) - actualYPosition + lineOffset
                    : -actualYPosition + lineOffset;
                  
                  return (
                    <div
                      className="relative w-full h-full hide-scrollbar"
                      style={{
                        width: '960px',
                        height: '540px',
                        transform: `scale(${scaleFactor})`,
                        transformOrigin: 'top left',
                        overflow: 'hidden',
                      }}
                    >
                      <div
                        className="relative hide-scrollbar"
                        style={{
                          width: shouldZoom ? '960px' : '100%',
                          height: `${baseHeight}px`,
                          transform: shouldZoom ? `scale(${zoomScale})` : undefined,
                          transformOrigin: shouldZoom ? 'center center' : undefined,
                          overflow: 'hidden',
                          position: 'absolute',
                          left: shouldZoom ? '50%' : '0',
                          right: shouldZoom ? undefined : '0',
                          bottom: `${bottomAdjustment}px`,
                          marginLeft: shouldZoom ? '-480px' : '0',
                        }}
                      >
                        {/* Background layer */}
                        <div
                          className={`absolute inset-0 transition-all duration-500 ${backgroundAnimateFirst && previewVisible ? 'opacity-100' : !backgroundAnimateFirst ? (previewVisible ? 'opacity-100' : 'opacity-0') : 'opacity-0'}`}
                          style={{
                            width: '100%',
                            height: `${baseHeight}px`,
                            zIndex: 0,
                            ...(Object.keys(activePoll.backgroundSettings?.lowerThird || {}).length > 0 && activePoll.backgroundSettings?.lowerThird?.type !== 'transparent' ? (
                              activePoll.backgroundSettings?.lowerThird?.type === 'color' && activePoll.backgroundSettings?.lowerThird?.color
                                ? { background: activePoll.backgroundSettings.lowerThird.color }
                                : activePoll.backgroundSettings?.lowerThird?.type === 'image' && activePoll.backgroundSettings?.lowerThird?.imageUrl
                                ? {
                                    backgroundImage: `url(${activePoll.backgroundSettings.lowerThird.imageUrl})`,
                                    backgroundSize: 'cover',
                                    backgroundPosition: 'center',
                                    backgroundRepeat: 'no-repeat',
                                  }
                                : {}
                            ) : {
                              background: 'linear-gradient(to top, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.85) 100%)',
                            }),
                            ...(() => {
                              const border = activePoll.borderSettings?.lowerThird;
                              if (border?.thickness && border.thickness > 0) {
                                const position = border.position || 'outer';
                                const borderColor = activePoll.primaryColor || '#3B82F6';
                                if (position === 'inner') {
                                  return { boxShadow: `inset 0 0 0 ${border.thickness}px ${borderColor}` };
                                } else {
                                  return { boxShadow: `0 0 0 ${border.thickness}px ${borderColor}` };
                                }
                              }
                              return {};
                            })(),
                            backdropFilter: 'blur(8px)',
                            borderTop: Object.keys(activePoll.borderSettings?.lowerThird || {}).length === 0 || !activePoll.borderSettings?.lowerThird?.thickness ? `3px solid ${activePoll.primaryColor || '#3B82F6'}` : undefined,
                            ...(activePoll.borderRadius ? { borderRadius: `${activePoll.borderRadius}px` } : {}),
                          }}
                        />
                        {/* Content layer */}
                        <div
                          key={`poll-lower-${activePoll.id}-${previewVisible ? 'on' : 'off'}`}
                          className={`absolute inset-0 hide-scrollbar ${
                            previewVisible ? getTransitionInClass(animationInType) : `transition-all duration-500 ${getAnimationClasses(false, animationInType)}`
                          }`}
                          style={{
                            width: '100%',
                            height: `${baseHeight}px`,
                            zIndex: 1,
                            background: 'transparent',
                            transitionDelay: backgroundAnimateFirst && previewVisible ? '300ms' : '0ms',
                            padding: '24px',
                            ...(previewVisible ? {} : { opacity: 0 }),
                          }}
                        >
                          <PollDisplay poll={previewPoll} disableBackground={true} />
                        </div>
                      </div>
                    </div>
                  );
                })()
              ) : (
                /* PIP Layout - Side box */
                (() => {
                  const pipBorderSetting = activePoll.borderSettings?.pip;
                  const pipZoom = (pipBorderSetting as any)?.zoom !== undefined ? (pipBorderSetting as any).zoom : 100;
                  const pipXPosition = (pipBorderSetting as any)?.xPosition !== undefined && (pipBorderSetting as any).xPosition !== null ? (pipBorderSetting as any).xPosition : 0;
                  const pipYPosition = (pipBorderSetting as any)?.yPosition !== undefined && (pipBorderSetting as any).yPosition !== null ? (pipBorderSetting as any).yPosition : 0;
                  
                  const pipZoomScale = pipZoom / 100;
                  const shouldPipZoom = pipZoom !== 100;
                  const scaleFactor = previewSize.width / 960;
                  
                  const baseTop = 24;
                  const baseLeft = activePoll.pipPosition === 'left' ? 24 : undefined;
                  const baseRight = activePoll.pipPosition === 'right' ? 24 : undefined;
                  
                  const finalTop = baseTop + pipYPosition;
                  const finalLeft = baseLeft !== undefined ? baseLeft + pipXPosition : baseLeft;
                  const finalRight = baseRight !== undefined ? baseRight - pipXPosition : baseRight;
                  
                  const finalTransform = shouldPipZoom 
                    ? `scale(${scaleFactor * pipZoomScale})`
                    : `scale(${scaleFactor})`;
                  
                  return (
                    <div
                      className="relative w-full h-full hide-scrollbar"
                      style={{
                        width: '960px',
                        height: '540px',
                        transform: finalTransform,
                        transformOrigin: activePoll.pipPosition === 'left' ? 'left top' : 'right top',
                        overflow: 'hidden',
                        position: 'absolute',
                        top: `${finalTop}px`,
                        ...(finalLeft !== undefined ? { left: `${finalLeft}px` } : { right: `${finalRight}px` }),
                        maxWidth: '35vw',
                      }}
                    >
                      {/* Background layer */}
                      <div
                        className={`absolute inset-0 transition-all duration-500 ${backgroundAnimateFirst && previewVisible ? 'opacity-100' : !backgroundAnimateFirst ? (previewVisible ? 'opacity-100' : 'opacity-0') : 'opacity-0'}`}
                        style={{
                          width: '960px',
                          height: '540px',
                          zIndex: 0,
                          ...(Object.keys(activePoll.backgroundSettings?.pip || {}).length > 0 && activePoll.backgroundSettings?.pip?.type !== 'transparent' ? (
                            activePoll.backgroundSettings?.pip?.type === 'color' && activePoll.backgroundSettings?.pip?.color
                              ? { background: activePoll.backgroundSettings.pip.color }
                              : activePoll.backgroundSettings?.pip?.type === 'image' && activePoll.backgroundSettings?.pip?.imageUrl
                              ? {
                                  backgroundImage: `url(${activePoll.backgroundSettings.pip.imageUrl})`,
                                  backgroundSize: 'cover',
                                  backgroundPosition: 'center',
                                  backgroundRepeat: 'no-repeat',
                                }
                              : {}
                          ) : {
                            background: 'rgba(0,0,0,0.95)',
                          }),
                          ...(() => {
                            const border = activePoll.borderSettings?.pip;
                            if (border?.thickness && border.thickness > 0) {
                              const position = border.position || 'outer';
                              const borderColor = activePoll.primaryColor || '#3B82F6';
                              if (position === 'inner') {
                                return { boxShadow: `inset 0 0 0 ${border.thickness}px ${borderColor}` };
                              } else {
                                return { border: `${border.thickness}px solid ${borderColor}` };
                              }
                            }
                            return {};
                          })(),
                          backdropFilter: 'blur(8px)',
                          border: Object.keys(activePoll.borderSettings?.pip || {}).length === 0 || !activePoll.borderSettings?.pip?.thickness ? `2px solid ${activePoll.primaryColor || '#3B82F6'}` : undefined,
                          ...(activePoll.borderRadius ? { borderRadius: `${activePoll.borderRadius}px` } : {}),
                        }}
                      />
                      {/* Content layer */}
                      <div
                        key={`poll-pip-${activePoll.id}-${previewVisible ? 'on' : 'off'}`}
                        className={`absolute inset-0 hide-scrollbar ${
                          previewVisible
                            ? getTransitionInClass(animationInType)
                            : `transition-all duration-500 ${activePoll.pipPosition === 'left'
                            ? getAnimationClasses(false, animationOutType === 'slideLeft' ? 'slideLeft' : animationOutType)
                            : getAnimationClasses(false, animationOutType === 'slideRight' ? 'slideRight' : animationOutType)}`
                        }`}
                        style={{
                          width: '960px',
                          height: '540px',
                          zIndex: 1,
                          background: 'transparent',
                          transitionDelay: backgroundAnimateFirst && previewVisible ? '300ms' : '0ms',
                          padding: '16px',
                          ...(previewVisible ? {} : { opacity: 0 }),
                        }}
                      >
                        <PollDisplay poll={previewPoll} disableBackground={true} />
                      </div>
                    </div>
                  );
                })()
              );
            })() : activeQA ? (() => {
              // Ensure activeQA has outputSettings from parent session if missing
              let enrichedQA = activeQA;
              if (!enrichedQA.outputSettings) {
                const parentSession = qas.find(session => session.eventId === enrichedQA.eventId);
                if (parentSession?.outputSettings) {
                  enrichedQA = { ...enrichedQA, outputSettings: parentSession.outputSettings };
                }
              }
              
              // Determine which layout to show based on output settings for preview output
              const outputSettings = enrichedQA.outputSettings || {};
              let layoutToShow = enrichedQA.layoutStyle || 1;
              
              // Override layout based on what's enabled for this output
              // Priority: fullScreen > lowerThird > splitScreen > pip
              if (outputSettings.fullScreen?.includes(previewOutput)) {
                layoutToShow = 1;
              } else if (outputSettings.lowerThird?.includes(previewOutput)) {
                layoutToShow = 2;
              } else if (outputSettings.splitScreen?.includes(previewOutput)) {
                layoutToShow = 4;
              } else if (outputSettings.pip?.includes(previewOutput)) {
                layoutToShow = 3;
              }
              
              // Create a modified Q&A object with the correct layout
              const previewQA = { ...enrichedQA, layoutStyle: layoutToShow };
              
              // Get background and border styles (simplified for preview)
              const getQABackgroundStyle = () => {
                let bgSetting;
                if (layoutToShow === 1) {
                  bgSetting = previewQA.backgroundSettings?.fullScreen;
                } else if (layoutToShow === 2) {
                  bgSetting = previewQA.backgroundSettings?.lowerThird;
                } else if (layoutToShow === 3) {
                  bgSetting = previewQA.backgroundSettings?.pip;
                } else {
                  bgSetting = previewQA.backgroundSettings?.splitScreen;
                }
                
                if (!bgSetting || !bgSetting.type || bgSetting.type === 'transparent') {
                  return layoutToShow === 2 
                    ? { background: 'linear-gradient(to top, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.85) 100%)' }
                    : { background: 'rgba(0,0,0,0.95)' };
                } else if (bgSetting.type === 'color') {
                  return { background: bgSetting.color || 'rgba(0,0,0,0.95)' };
                } else if (bgSetting.type === 'image' && bgSetting.imageUrl) {
                  return {
                    backgroundImage: `url(${bgSetting.imageUrl})`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    backgroundRepeat: 'no-repeat',
                  };
                }
                return { background: 'rgba(0,0,0,0.95)' };
              };
              
              // Render Q&A fullscreen with proper animation structure
              const shouldShow = previewVisible && qaAnimatingIn;
              
              return (
                <div 
                  key={`qa-${activeQA.id}-${previewOutput}`}
                  className="relative w-full h-full hide-scrollbar" 
                  style={{ width: '960px', height: '540px', transform: `scale(${previewSize.width / 960})`, transformOrigin: 'top left', overflow: 'hidden' }}
                >
                  {/* Background layer - animates first if enabled */}
                  <div
                    className={`absolute inset-0 transition-all duration-500 ${
                      backgroundAnimateFirst && shouldShow
                        ? 'opacity-100'
                        : !backgroundAnimateFirst
                        ? (shouldShow ? 'opacity-100' : 'opacity-0')
                        : 'opacity-0'
                    }`}
                    style={{
                      width: '960px',
                      height: '540px',
                      zIndex: 0,
                      ...getQABackgroundStyle(),
                      backdropFilter: 'blur(8px)',
                    }}
                  />
                  {/* Content layer: key forces remount when showing so keyframe animation runs on mount */}
                  <div
                    key={`qa-${activeQA.id}-${previewOutput}-${shouldShow ? 'on' : 'off'}`}
                    className={`absolute inset-0 flex items-center justify-center hide-scrollbar ${
                      shouldShow ? getTransitionInClass(animationInType) : `transition-all duration-500 ${getAnimationClasses(false, animationInType)}`
                    }`}
                    style={{
                      width: '960px',
                      height: '540px',
                      zIndex: 1,
                      background: 'transparent',
                      transitionDelay: backgroundAnimateFirst && shouldShow ? '300ms' : '0ms',
                      ...(shouldShow ? {} : { opacity: 0 }),
                    }}
                  >
                    <QADisplay qa={previewQA} disableBackground={true} />
                  </div>
                </div>
              );
            })() : (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-gray-600 text-center">
                  <div className="text-6xl mb-4 opacity-50">
                    <VideoIcon />
                  </div>
                  <p className="mt-4 text-xl">No active items</p>
                  <p className="text-sm text-gray-500 mt-2">Click play to see preview</p>
                </div>
              </div>
            )}
          </div>

          {/* Resize Handle */}
          <div
            className="absolute bottom-0 right-0 w-4 h-4 bg-gray-600 cursor-nwse-resize"
            style={{ clipPath: 'polygon(100% 0, 0 100%, 100% 100%)' }}
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setIsResizing(true);
              setDragStart({ x: e.clientX, y: e.clientY });
            }}
          />
        </div>
      )}

      {/* Edit Poll Modal - Embed EventDetailPage */}
      {showEditModal && selectedEventId && (
        <div className="fixed inset-0 bg-black bg-opacity-90 z-50 flex items-center justify-center p-8">
          <div className="w-[90%] h-[90%] bg-white rounded-lg shadow-2xl overflow-hidden relative">
            {/* Close button */}
            <button
              onClick={handlePollEditCancel}
              className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors z-50 bg-gray-700 hover:bg-gray-600 rounded-full p-3"
              title="Close"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            
            {/* Modal content - iframe with EventDetailPage */}
            <div className="w-full h-full bg-white">
              <iframe
                src={`/events/${selectedEventId}${editingPollId ? `?edit=${editingPollId}` : ''}`}
                className="w-full h-full border-0"
                title="Edit Poll"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

