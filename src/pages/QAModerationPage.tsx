import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getEvent, getQAsByEvent, getQAsByStatus, updateQA, createQA, deleteQA, subscribeQAsByEvent } from '../services/firestore';
import type { Event, QandA, QAStatus } from '../types';

export default function QAModerationPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();
  const [event, setEvent] = useState<Event | null>(null);
  const [activeTab, setActiveTab] = useState<'pending' | 'approved'>('pending');
  const [pendingQAs, setPendingQAs] = useState<QandA[]>([]);
  const [approvedQAs, setApprovedQAs] = useState<QandA[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedQA, setSelectedQA] = useState<QandA | null>(null);
  const [editingQA, setEditingQA] = useState<QandA | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showAllQuestionsModal, setShowAllQuestionsModal] = useState(false);
  const [allQuestions, setAllQuestions] = useState<QandA[]>([]);
  const [selectedQuestionIds, setSelectedQuestionIds] = useState<Set<string>>(new Set());
  const [sessions, setSessions] = useState<QandA[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);

  useEffect(() => {
    if (!eventId) return;
    loadData();
  }, [eventId, activeTab]);

  // Subscribe to Q&A - updates only when data changes (no polling, fewer Firestore reads)
  useEffect(() => {
    if (!eventId) return;
    const unsub = subscribeQAsByEvent(eventId, (allQAs) => {
      const submissions = allQAs.filter(qa => qa.question && !qa.name);
      const sessionList = allQAs.filter(qa => qa.name && !qa.question);
      const allSorted = submissions.sort((a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      const approved = submissions.filter(qa => qa.status === 'approved');
      const approvedSorted = approved.sort((a, b) => {
        if (a.isQueued && !b.isQueued) return -1;
        if (!a.isQueued && b.isQueued) return 1;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
      setSessions(sessionList);
      setPendingQAs(allSorted);
      setApprovedQAs(approvedSorted);
    });
    return () => unsub();
  }, [eventId]);

  const loadData = async () => {
    if (!eventId) return;
    setLoading(true);
    setError(null);
    
    try {
      const eventData = await getEvent(eventId);
      setEvent(eventData);

      const allQAs = await getQAsByEvent(eventId);
      const sessionList = allQAs.filter(qa => qa.name && !qa.question);
      setSessions(sessionList);

      const submissions = allQAs.filter(qa => qa.question && !qa.name); // Only submissions, not session containers

      // For pending tab: show ALL questions (pending, approved, rejected)
      const allSorted = submissions.sort((a, b) => 
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
      setPendingQAs(allSorted);

      // For approved tab: show only approved questions (duplicated from pending)
      const approved = submissions.filter(qa => qa.status === 'approved');
      // Sort by queued first, then by date
      const approvedSorted = approved.sort((a, b) => {
        // Queued questions first
        if (a.isQueued && !b.isQueued) return -1;
        if (!a.isQueued && b.isQueued) return 1;
        // Then by date (newest first)
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
      setApprovedQAs(approvedSorted);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load Q&A data');
      console.error('Error loading Q&A data:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadAllQuestions = async () => {
    if (!eventId) return;
    try {
      const allQAs = await getQAsByEvent(eventId);
      const submissions = allQAs.filter(qa => qa.question && !qa.name); // Only submissions
      // Sort by date (newest first)
      const sorted = submissions.sort((a, b) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      setAllQuestions(sorted);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load all questions');
      console.error('Error loading all questions:', err);
    }
  };

  const handleDeleteQuestion = async (qaId: string) => {
    if (!confirm('Are you sure you want to delete this question? This action cannot be undone.')) return;
    
    try {
      await deleteQA(qaId);
      await loadAllQuestions();
      await loadData();
      if (selectedQA?.id === qaId) {
        setSelectedQA(null);
        setEditingQA(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete question');
      console.error('Error deleting question:', err);
    }
  };

  const handleToggleSelectQuestion = (qaId: string) => {
    setSelectedQuestionIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(qaId)) {
        newSet.delete(qaId);
      } else {
        newSet.add(qaId);
      }
      return newSet;
    });
  };

  const handleSelectAll = () => {
    if (selectedQuestionIds.size === allQuestions.length) {
      setSelectedQuestionIds(new Set());
    } else {
      setSelectedQuestionIds(new Set(allQuestions.map(q => q.id)));
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedQuestionIds.size === 0) return;
    
    if (!confirm(`Are you sure you want to delete ${selectedQuestionIds.size} question(s)? This action cannot be undone.`)) return;
    
    try {
      const deletePromises = Array.from(selectedQuestionIds).map(qaId => deleteQA(qaId));
      await Promise.all(deletePromises);
      setSelectedQuestionIds(new Set());
      await loadAllQuestions();
      await loadData();
      if (selectedQA && selectedQuestionIds.has(selectedQA.id)) {
        setSelectedQA(null);
        setEditingQA(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete questions');
      console.error('Error deleting questions:', err);
    }
  };

  const handleApprove = async (qaId: string) => {
    try {
      // Find the QA to approve
      const qa = pendingQAs.find(q => q.id === qaId);
      if (!qa) return;

      // Get max queue order for approved QAs
      const approved = await getQAsByStatus(eventId!, 'approved');
      const maxOrder = approved.length > 0 
        ? Math.max(...approved.map(q => q.queueOrder ?? 0)) 
        : 0;

      // Update status to approved and set queue order
      await updateQA(qaId, {
        status: 'approved' as QAStatus,
        queueOrder: maxOrder + 1,
        isActive: false,
        isNext: false,
      });

      // Immediately update local state - keep in pending list but update status
      setPendingQAs(prev => prev.map(q => q.id === qaId ? { ...q, status: 'approved' as QAStatus, queueOrder: maxOrder + 1 } : q));
      setApprovedQAs(prev => {
        const updated = [...prev, { ...qa, status: 'approved' as QAStatus, queueOrder: maxOrder + 1 }];
        return updated.sort((a, b) => {
          // Queued questions first
          if (a.isQueued && !b.isQueued) return -1;
          if (!a.isQueued && b.isQueued) return 1;
          // Then by date (newest first)
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        });
      });

      // Clear selection if it was the approved question
      if (selectedQA?.id === qaId) {
        setSelectedQA(null);
        setEditingQA(null);
      }

      // Reload data to ensure consistency
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to approve question');
      console.error('Error approving question:', err);
      // Reload on error to get correct state
      await loadData();
    }
  };

  const handleReject = async (qaId: string) => {
    try {
      // Find the QA to reject
      const qa = pendingQAs.find(q => q.id === qaId);
      if (!qa) return;

      await updateQA(qaId, {
        status: 'rejected' as QAStatus,
      });

      // Immediately update local state - keep in pending list but update status
      setPendingQAs(prev => prev.map(q => q.id === qaId ? { ...q, status: 'rejected' as QAStatus } : q));

      // Clear selection if it was the rejected question
      if (selectedQA?.id === qaId) {
        setSelectedQA(null);
        setEditingQA(null);
      }

      // Reload data to ensure consistency
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reject question');
      console.error('Error rejecting question:', err);
      // Reload on error to get correct state
      await loadData();
    }
  };

  const handleQueue = async (qaId: string) => {
    try {
      const qa = pendingQAs.find(q => q.id === qaId) || approvedQAs.find(q => q.id === qaId);
      if (!qa) return;
      // Active questions can only go to Done (via Stop); don't allow queueing them
      if (qa.isActive) {
        setError('Active questions can only be completed via Stop. Use Operators to stop the active question.');
        return;
      }
      // Done questions must be reset to pending or approved before they can be cued
      if (qa.isDone) {
        setError('Done questions cannot be set to Cue or Next. Reset the question to Pending or Approved first.');
        return;
      }

      // Update local state immediately for instant feedback
      setPendingQAs(prev => prev.map(q => {
        if (q.id === qaId) {
          return { ...q, isQueued: true, isNext: false, status: q.status !== 'approved' ? 'approved' as QAStatus : q.status };
        } else if (q.isActive) {
          return q;
        } else if (q.isQueued) {
          return { ...q, isQueued: false, isNext: true };
        } else if (!q.isNext && q.status === 'approved') {
          return { ...q, isNext: true };
        }
        return q;
      }));

      // Update approved list
      setApprovedQAs(prev => prev.map(q => {
        if (q.id === qaId) {
          return { ...q, isQueued: true, isNext: false };
        } else if (q.isActive) {
          return q;
        } else if (q.isQueued) {
          return { ...q, isQueued: false, isNext: true };
        } else if (!q.isNext) {
          return { ...q, isNext: true };
        }
        return q;
      }));

      // Update selected QA
      if (selectedQA?.id === qaId) {
        setSelectedQA({ ...selectedQA, isQueued: true, isNext: false, status: selectedQA.status !== 'approved' ? 'approved' as QAStatus : selectedQA.status });
      }

      // Update Firestore in background
      const allQAs = await getQAsByEvent(eventId!);
      const updates: Promise<void>[] = [];
      
      for (const q of allQAs) {
        if (q.isDone) continue; // Never change cue/next on done questions
        if (q.id === qaId) {
          const updateData: Partial<QandA> = {
            isQueued: true,
            isNext: false,
          };
          
          if (q.status !== 'approved') {
            updateData.status = 'approved' as QAStatus;
          }
          
          updates.push(updateQA(qaId, updateData));
        } else if (q.isActive) {
          // Active questions can only go to Done; never set isNext on them
          continue;
        } else if (q.isQueued) {
          updates.push(updateQA(q.id, { isQueued: false, isNext: true }));
        } else if (!q.isNext && q.status === 'approved') {
          updates.push(updateQA(q.id, { isNext: true }));
        }
      }

      await Promise.all(updates);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to queue question');
      console.error('Error queueing question:', err);
      // Reload on error to get correct state
      await loadData();
    }
  };


  const handleSetActive = async (qaId: string) => {
    try {
      // First, deactivate all other QAs
      const allApproved = await getQAsByStatus(eventId!, 'approved');
      for (const qa of allApproved) {
        if (qa.isActive && qa.id !== qaId) {
          await updateQA(qa.id, { isActive: false });
        }
      }

      // Set this one as active and clear isNext
      await updateQA(qaId, {
        isActive: true,
        isNext: false,
      });

      await loadData();
      setSelectedQA(approvedQAs.find(q => q.id === qaId) || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to set active');
      console.error('Error setting active:', err);
    }
  };

  const handleSetNext = async (qaId: string) => {
    try {
      const qa = pendingQAs.find(q => q.id === qaId) || approvedQAs.find(q => q.id === qaId);
      if (!qa) return;
      // Active questions can only go to Done (via Stop); never revert to Next
      if (qa.isActive) {
        setError('Active questions can only be completed via Stop. Use Operators to stop the active question.');
        return;
      }
      // Done questions must be reset to pending or approved before they can be set as next
      if (qa.isDone) {
        setError('Done questions cannot be set to Cue or Next. Reset the question to Pending or Approved first.');
        return;
      }

      // Update local state immediately for instant feedback
      setPendingQAs(prev => prev.map(q => {
        if (q.id === qaId) {
          return { ...q, isNext: true, isQueued: false };
        } else if (q.isNext) {
          return { ...q, isNext: false };
        }
        return q;
      }));

      // Update approved list
      setApprovedQAs(prev => prev.map(q => {
        if (q.id === qaId) {
          return { ...q, isNext: true, isQueued: false };
        } else if (q.isNext) {
          return { ...q, isNext: false };
        }
        return q;
      }));

      // Update selected QA
      if (selectedQA?.id === qaId) {
        setSelectedQA({ ...selectedQA, isNext: true, isQueued: false });
      }

      // Update Firestore in background
      const allQAs = await getQAsByEvent(eventId!);
      const updates: Promise<void>[] = [];
      
      for (const q of allQAs) {
        if (q.isDone) continue; // Never change next on done questions
        if (q.id === qaId) {
          updates.push(updateQA(qaId, {
            isNext: true,
            isQueued: false,
            isActive: false,
          }));
        } else if (q.isNext) {
          updates.push(updateQA(q.id, { isNext: false }));
        }
      }

      await Promise.all(updates);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to set next');
      console.error('Error setting next:', err);
      // Reload on error to get correct state
      await loadData();
    }
  };

  const handleUpdateQueueOrder = async (qaId: string, newOrder: number) => {
    try {
      await updateQA(qaId, { queueOrder: newOrder });
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update queue order');
      console.error('Error updating queue order:', err);
    }
  };

  const handleResetAll = async () => {
    if (!confirm('Are you sure you want to reset ALL questions (including approved, rejected, and done) back to pending? This will remove them from the approved queue and clear all status flags.')) return;
    
    try {
      // Get all questions for this event (pending, approved, rejected, done)
      const allQuestions = await getQAsByEvent(eventId!);
      const submissions = allQuestions.filter(qa => qa.question && !qa.name);
      const resetPromises = submissions.map(qa => 
        updateQA(qa.id, { 
          status: 'pending' as QAStatus,
          isActive: false,
          isNext: false,
          isQueued: false,
          isDone: false,
        })
      );
      await Promise.all(resetPromises);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reset questions');
      console.error('Error resetting questions:', err);
    }
  };

  /** Reset a single question back to pending (for testing or re-use). */
  const handleResetToPending = async (qaId: string) => {
    try {
      await updateQA(qaId, {
        status: 'pending' as QAStatus,
        isActive: false,
        isNext: false,
        isQueued: false,
        isDone: false,
      });
      await loadData();
      if (selectedQA?.id === qaId) setSelectedQA(prev => prev ? { ...prev, status: 'pending' as QAStatus, isActive: false, isNext: false, isQueued: false, isDone: false } : null);
      setAllQuestions(prev => prev.map(q => q.id === qaId ? { ...q, status: 'pending' as QAStatus, isActive: false, isNext: false, isQueued: false, isDone: false } : q));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reset question');
      console.error('Error resetting question:', err);
    }
  };

  /** Reset a single question to approved and clear queue flags (for testing — can then set Cue/Next again). */
  const handleResetToApproved = async (qaId: string) => {
    try {
      const approved = await getQAsByStatus(eventId!, 'approved');
      const maxOrder = approved.length > 0 ? Math.max(...approved.map(q => q.queueOrder ?? 0)) : 0;
      await updateQA(qaId, {
        status: 'approved' as QAStatus,
        queueOrder: maxOrder + 1,
        isActive: false,
        isNext: false,
        isQueued: false,
        isDone: false,
      });
      await loadData();
      if (selectedQA?.id === qaId) setSelectedQA(prev => prev ? { ...prev, status: 'approved' as QAStatus, isActive: false, isNext: false, isQueued: false, isDone: false } : null);
      setAllQuestions(prev => prev.map(q => q.id === qaId ? { ...q, status: 'approved' as QAStatus, queueOrder: maxOrder + 1, isActive: false, isNext: false, isQueued: false, isDone: false } : q));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reset question');
      console.error('Error resetting question:', err);
    }
  };

  const handleEditQA = (qa: QandA) => {
    setEditingQA(qa);
    setSelectedQA(qa);
    setShowEditModal(true);
  };

  const handleSaveEdit = async () => {
    if (!editingQA) return;

    try {
      await updateQA(editingQA.id, {
        question: editingQA.question,
      });
      setEditingQA(null);
      setShowEditModal(false);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save changes');
      console.error('Error saving QA:', err);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-white text-2xl">Loading...</div>
      </div>
    );
  }

  // Filter by selected session
  const filterBySession = (list: QandA[]) =>
    selectedSessionId
      ? list.filter(q => q.sessionId === selectedSessionId)
      : list;
  const filteredPending = filterBySession(pendingQAs);
  const filteredApproved = filterBySession(approvedQAs);
  const currentQAs = activeTab === 'pending' ? filteredPending : filteredApproved;

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <div className="bg-gray-800 border-b border-gray-700 px-6 py-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">{event?.name || 'Q&A Moderation'}</h1>
            <p className="text-gray-400 text-sm mt-1">Manage and moderate questions</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <label htmlFor="session-filter" className="text-sm text-gray-400">Session:</label>
              <select
                id="session-filter"
                value={selectedSessionId ?? ''}
                onChange={(e) => setSelectedSessionId(e.target.value || null)}
                className="px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm min-w-[180px]"
              >
                <option value="">All sessions</option>
                {sessions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name || 'Untitled session'}
                  </option>
                ))}
              </select>
            </div>
            <button
              onClick={() => {
                setShowAllQuestionsModal(true);
                loadAllQuestions();
              }}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
            >
              View All Questions
            </button>
          <button
            onClick={() => navigate(-1)}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
          >
            Back
          </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="mx-6 mt-4 p-4 bg-red-900/50 border border-red-600 rounded-lg">
          {error}
        </div>
      )}

      <div className="flex h-[calc(100vh-100px)]">
        {/* Left Panel - Question List (only for pending tab) */}
        {activeTab === 'pending' && (
          <div className="w-1/3 border-r border-gray-700 flex flex-col">
              {/* Tabs */}
              <div className="flex border-b border-gray-700">
                <button
                  onClick={() => setActiveTab('pending')}
                  className={`flex-1 px-4 py-3 font-medium transition-colors ${
                    activeTab === 'pending'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                  }`}
                >
                  Pending ({filteredPending.length})
                </button>
                <button
                  onClick={() => setActiveTab('approved')}
                  className="flex-1 px-4 py-3 font-medium transition-colors bg-gray-800 text-gray-300 hover:bg-gray-700"
                >
                  Approved ({filteredApproved.length})
                </button>
              </div>

              {/* Reset All Button */}
              <div className="px-4 py-3 border-b border-gray-700 bg-gray-800">
                <button
                  onClick={handleResetAll}
                  className="w-full px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg transition-colors font-medium"
                >
                  Reset All to Pending
                </button>
              </div>

              {/* Question List */}
              <div className="flex-1 overflow-y-auto">
                {currentQAs.length === 0 ? (
                  <div className="p-6 text-center text-gray-500">
                    No {activeTab} questions
                  </div>
                ) : (
                  <div className="divide-y divide-gray-700">
                    {currentQAs.map((qa) => (
                      <div
                        key={qa.id}
                        className={`p-4 cursor-pointer transition-colors ${
                          qa.isDone
                            ? 'bg-gray-900/50 border-l-4 border-gray-600 opacity-50'
                            : qa.isQueued
                            ? 'bg-orange-900/40 border-l-4 border-orange-500'
                            : qa.isNext
                            ? 'bg-purple-900/30 border-l-4 border-purple-500'
                            : selectedQA?.id === qa.id
                            ? 'bg-blue-900/50 border-l-4 border-blue-500'
                            : 'hover:bg-gray-800'
                        }`}
                        onClick={() => {
                          setSelectedQA(qa);
                          setEditingQA(null);
                        }}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1">
                            <div className={`font-medium text-base line-clamp-2 ${
                              qa.isDone
                                ? 'text-gray-500 line-through'
                                : qa.isQueued ? 'text-orange-400' : qa.isNext ? 'text-purple-400' : ''
                            }`}>{qa.question}</div>
                          </div>
                          <div className="flex gap-1 ml-2">
                            {qa.isDone && (
                              <span className="px-2 py-1 bg-gray-700 text-gray-300 text-xs rounded">Done</span>
                            )}
                            {qa.status === 'pending' && !qa.isDone && (
                              <span className="px-2 py-1 bg-yellow-600 text-white text-xs rounded">Pending</span>
                            )}
                            {qa.status === 'approved' && activeTab === 'pending' && !qa.isDone && (
                              <span className="px-2 py-1 bg-green-600 text-white text-xs rounded">Approved</span>
                            )}
                            {qa.status === 'rejected' && !qa.isDone && (
                              <span className="px-2 py-1 bg-red-600 text-white text-xs rounded">Rejected</span>
                            )}
                            {qa.isActive && !qa.isDone && (
                              <span className="px-2 py-1 bg-green-600 text-white text-xs rounded">Active</span>
                            )}
                          </div>
                        </div>
                        {qa.answer && (
                          <div className="text-xs text-gray-500 line-clamp-1 mt-1">{qa.answer}</div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
        )}

        {/* Full Width Approved Tab */}
        {activeTab === 'approved' && (
          <div className="w-full flex flex-col">
            {/* Tabs */}
            <div className="flex border-b border-gray-700">
              <button
                onClick={() => setActiveTab('pending')}
                className="px-6 py-3 font-medium transition-colors bg-gray-800 text-gray-300 hover:bg-gray-700"
              >
                Pending ({filteredPending.length})
              </button>
              <button
                onClick={() => setActiveTab('approved')}
                className={`px-6 py-3 font-medium transition-colors ${
                  activeTab === 'approved'
                    ? 'bg-green-600 text-white'
                    : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                }`}
              >
                Approved ({filteredApproved.length})
              </button>
            </div>


            {/* Full Width Question List */}
            <div className="flex-1 overflow-y-auto p-6">
              {currentQAs.length === 0 ? (
                <div className="text-center text-gray-500 py-8">
                  No approved questions
                </div>
              ) : (
                <div className="space-y-4">
                  {currentQAs.map((qa) => (
                    <div
                      key={qa.id}
                      className={`p-4 rounded-lg border transition-colors ${
                        qa.isDone
                          ? 'bg-gray-900/50 border-gray-600 opacity-50'
                          : qa.isActive
                          ? 'bg-green-900/30 border-green-600'
                          : qa.isQueued
                          ? 'bg-orange-900/40 border-orange-500'
                          : qa.isNext
                          ? 'bg-purple-900/30 border-purple-600'
                          : 'bg-gray-800 border-gray-700'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className={`font-medium text-lg mb-2 ${
                            qa.isDone
                              ? 'text-gray-500 line-through'
                              : qa.isQueued ? 'text-orange-400' : qa.isNext ? 'text-purple-400' : ''
                          }`}>{qa.question}</div>
                          {qa.answer && (
                            <div className="text-sm text-gray-500 mt-2">{qa.answer}</div>
                          )}
                        </div>
                        <div className="flex items-center gap-3">
                          {/* Status Badges */}
                          <div className="flex gap-1">
                            {qa.isDone && (
                              <span className="px-2 py-1 bg-gray-700 text-gray-300 text-xs rounded">Done</span>
                            )}
                            {qa.isActive && !qa.isDone && (
                              <span className="px-2 py-1 bg-green-600 text-white text-xs rounded">Active</span>
                            )}
                          </div>
                          {/* Queue Button - disabled for active or done (must reset first) */}
                          <button
                            onClick={() => !qa.isActive && !qa.isDone && handleQueue(qa.id)}
                            disabled={qa.isActive || qa.isDone}
                            className={`px-4 py-2 rounded-lg transition-colors font-medium ${
                              qa.isActive || qa.isDone
                                ? 'bg-gray-800 text-gray-500 cursor-not-allowed'
                                : qa.isQueued
                                ? 'bg-orange-600 hover:bg-orange-700'
                                : 'bg-gray-700 hover:bg-gray-600'
                            }`}
                          >
                            {qa.isQueued ? 'Cue' : 'Cue'}
                          </button>
                          {/* Next Button - disabled for active or done (must reset first) */}
                          <button
                            onClick={() => !qa.isActive && !qa.isDone && handleSetNext(qa.id)}
                            disabled={qa.isActive || qa.isDone}
                            className={`px-4 py-2 rounded-lg transition-colors font-medium ${
                              qa.isActive || qa.isDone
                                ? 'bg-gray-800 text-gray-500 cursor-not-allowed'
                                : qa.isNext
                                ? 'bg-purple-600 hover:bg-purple-700'
                                : 'bg-gray-700 hover:bg-gray-600'
                            }`}
                          >
                            Next
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Right Panel - Details & Actions (only for pending tab) */}
        {activeTab === 'pending' && (
          <div className="flex-1 flex flex-col">
          {selectedQA ? (
            <>
              {/* Details/Edit Section */}
              <div className="flex-1 overflow-y-auto p-6">
                {editingQA ? (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">Question Text</label>
                      <textarea
                        value={editingQA.question}
                        onChange={(e) => setEditingQA({ ...editingQA, question: e.target.value })}
                        className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white"
                        rows={6}
                      />
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={handleSaveEdit}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => {
                          setEditingQA(null);
                          setSelectedQA(selectedQA);
                        }}
                        className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-400 mb-1">Question</label>
                      <div className="p-4 bg-gray-800 rounded-lg">{selectedQA.question}</div>
                    </div>
                    {selectedQA.answer && (
                      <div>
                        <label className="block text-sm font-medium text-gray-400 mb-1">Answer</label>
                        <div className="p-4 bg-gray-800 rounded-lg">{selectedQA.answer}</div>
                      </div>
                    )}
                    {selectedQA.submitterName && (
                      <div>
                        <label className="block text-sm font-medium text-gray-400 mb-1">Submitter</label>
                        <div className="p-4 bg-gray-800 rounded-lg">{selectedQA.submitterName}</div>
                      </div>
                    )}
                    {selectedQA.moderatorNotes && (
                      <div>
                        <label className="block text-sm font-medium text-gray-400 mb-1">Moderator Notes</label>
                        <div className="p-4 bg-gray-800 rounded-lg">{selectedQA.moderatorNotes}</div>
                      </div>
                    )}
                    <button
                      onClick={() => handleEditQA(selectedQA)}
                      className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
                    >
                      Edit
                    </button>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="border-t border-gray-700 p-6 bg-gray-800">
                <div className="space-y-3">
                  {activeTab === 'pending' && (
                    <div className="space-y-2">
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleApprove(selectedQA.id)}
                          className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg transition-colors font-medium"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => handleReject(selectedQA.id)}
                          className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg transition-colors font-medium"
                        >
                          Reject
                        </button>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => !selectedQA.isActive && !selectedQA.isDone && handleQueue(selectedQA.id)}
                          disabled={selectedQA.isActive || selectedQA.isDone}
                          className={`flex-1 px-4 py-2 rounded-lg transition-colors font-medium ${
                            selectedQA.isActive || selectedQA.isDone
                              ? 'bg-gray-800 text-gray-500 cursor-not-allowed'
                              : selectedQA.isQueued
                              ? 'bg-orange-600 hover:bg-orange-700'
                              : 'bg-gray-700 hover:bg-gray-600'
                          }`}
                        >
                          {selectedQA.isQueued ? 'Cue' : 'Cue'}
                        </button>
                        <button
                          onClick={() => !selectedQA.isActive && !selectedQA.isDone && handleSetNext(selectedQA.id)}
                          disabled={selectedQA.isActive || selectedQA.isDone}
                          className={`flex-1 px-4 py-2 rounded-lg transition-colors font-medium ${
                            selectedQA.isActive || selectedQA.isDone
                              ? 'bg-gray-800 text-gray-500 cursor-not-allowed'
                              : selectedQA.isNext
                              ? 'bg-purple-600 hover:bg-purple-700'
                              : 'bg-gray-700 hover:bg-gray-600'
                          }`}
                        >
                          Next
                        </button>
                      </div>
                    </div>
                  )}
                  {/* Reset for testing — restore a question to Pending or Approved so it can be cued again */}
                  <div className="pt-2 border-t border-gray-600">
                    <div className="text-xs text-gray-400 mb-1.5">Reset for testing</div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleResetToPending(selectedQA.id)}
                        className="px-3 py-1.5 bg-gray-600 hover:bg-gray-500 rounded-lg text-sm transition-colors"
                      >
                        Reset to Pending
                      </button>
                      <button
                        onClick={() => handleResetToApproved(selectedQA.id)}
                        className="px-3 py-1.5 bg-gray-600 hover:bg-gray-500 rounded-lg text-sm transition-colors"
                      >
                        Reset to Approved
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-500">
              Select a question to view details
            </div>
          )}
          </div>
        )}
      </div>

      {/* Edit Modal */}
      {showEditModal && selectedQA && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-gray-700">
              <h2 className="text-2xl font-bold">Edit Question</h2>
              <button
                onClick={() => {
                  setShowEditModal(false);
                  setEditingQA(null);
                }}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
              >
                Close
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              {editingQA ? (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Question Text</label>
                    <textarea
                      value={editingQA.question}
                      onChange={(e) => setEditingQA({ ...editingQA, question: e.target.value })}
                      className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                      rows={6}
                    />
                  </div>
                      <div className="flex gap-2">
                        <button
                      onClick={handleSaveEdit}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
                    >
                      Save
                        </button>
                        <button
                      onClick={() => {
                        setEditingQA(null);
                        setShowEditModal(false);
                      }}
                      className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
                    >
                      Cancel
                        </button>
                      </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Question</label>
                    <p className="text-white text-lg">{selectedQA.question}</p>
                  </div>
                  {selectedQA.submitterName && (
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">Submitter</label>
                      <p className="text-gray-400">— {selectedQA.submitterName}</p>
                        </div>
                      )}
                  {selectedQA.answer && (
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">Answer</label>
                      <p className="text-gray-400">{selectedQA.answer}</p>
                    </div>
                  )}
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleEditQA(selectedQA)}
                      className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => !selectedQA.isActive && !selectedQA.isDone && handleSetNext(selectedQA.id)}
                      disabled={selectedQA.isActive || selectedQA.isDone}
                      className={`px-4 py-2 rounded-lg transition-colors ${
                        selectedQA.isActive || selectedQA.isDone
                          ? 'bg-gray-800 text-gray-500 cursor-not-allowed'
                          : selectedQA.isNext
                          ? 'bg-blue-600 hover:bg-blue-700'
                          : 'bg-gray-700 hover:bg-gray-600'
                      }`}
                    >
                      {selectedQA.isNext ? 'Next in Queue' : 'Set as Next'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* All Questions Modal */}
      {showAllQuestionsModal && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-gray-700">
              <h2 className="text-2xl font-bold">All Questions</h2>
              <div className="flex gap-2">
                {selectedQuestionIds.size > 0 && (
                  <button
                    onClick={handleDeleteSelected}
                    className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
                  >
                    Delete Selected ({selectedQuestionIds.size})
                  </button>
                )}
                <button
                  onClick={() => {
                    setShowAllQuestionsModal(false);
                    setAllQuestions([]);
                    setSelectedQuestionIds(new Set());
                  }}
                  className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
            <div className="px-6 py-3 border-b border-gray-700 bg-gray-900">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedQuestionIds.size === allQuestions.length && allQuestions.length > 0}
                  onChange={handleSelectAll}
                  className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                />
                <span className="text-sm text-gray-300">
                  {selectedQuestionIds.size === allQuestions.length && allQuestions.length > 0
                    ? 'Deselect All'
                    : 'Select All'}
                  {selectedQuestionIds.size > 0 && ` (${selectedQuestionIds.size} selected)`}
                </span>
              </label>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              {allQuestions.length === 0 ? (
                <div className="text-center text-gray-500 py-8">No questions found</div>
              ) : (
                <div className="space-y-4">
                  {allQuestions.map((qa) => (
                    <div
                      key={qa.id}
                      className={`p-4 rounded-lg border ${
                        selectedQuestionIds.has(qa.id)
                          ? 'bg-gray-700 border-blue-500'
                          : 'bg-gray-900 border-gray-700'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <input
                          type="checkbox"
                          checked={selectedQuestionIds.has(qa.id)}
                          onChange={() => handleToggleSelectQuestion(qa.id)}
                          className="mt-1 w-4 h-4 text-blue-600 rounded focus:ring-blue-500 flex-shrink-0"
                        />
                        <div className="flex-1">
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex-1">
                              <div className="font-medium text-sm mb-1">{qa.question}</div>
                              {qa.submitterName && (
                                <div className="text-xs text-gray-400">— {qa.submitterName}</div>
                              )}
                              {qa.answer && (
                                <div className="text-xs text-gray-500 mt-2">{qa.answer}</div>
                              )}
                            </div>
                            <div className="flex gap-2 ml-4">
                              {qa.isDone && (
                                <span className="px-2 py-1 bg-gray-700 text-gray-300 text-xs rounded">Done</span>
                              )}
                              {qa.status === 'pending' && !qa.isDone && (
                                <span className="px-2 py-1 bg-yellow-600 text-white text-xs rounded">Pending</span>
                              )}
                              {qa.status === 'approved' && !qa.isDone && (
                                <span className="px-2 py-1 bg-green-600 text-white text-xs rounded">Approved</span>
                              )}
                              {qa.status === 'rejected' && !qa.isDone && (
                                <span className="px-2 py-1 bg-red-600 text-white text-xs rounded">Rejected</span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-700 flex-wrap gap-2">
                            <div className="text-xs text-gray-500">
                              {new Date(qa.createdAt).toLocaleString()}
                            </div>
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleResetToPending(qa.id)}
                                className="px-2 py-1 bg-gray-600 hover:bg-gray-500 rounded text-xs transition-colors"
                              >
                                To Pending
                              </button>
                              <button
                                onClick={() => handleResetToApproved(qa.id)}
                                className="px-2 py-1 bg-gray-600 hover:bg-gray-500 rounded text-xs transition-colors"
                              >
                                To Approved
                              </button>
                              <button
                                onClick={() => handleDeleteQuestion(qa.id)}
                                className="px-3 py-1 bg-red-600 hover:bg-red-700 rounded text-sm transition-colors"
                              >
                                Delete
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                  </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}



