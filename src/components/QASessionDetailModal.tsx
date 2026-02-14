import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getQuestionsBySession } from '../services/firestore';
import type { QandA } from '../types';

interface QASessionDetailModalProps {
  session: QandA;
  eventId: string;
  /** When true, include questions without sessionId (legacy submissions before we tracked session) */
  includeOrphaned?: boolean;
  onClose: () => void;
}

export default function QASessionDetailModal({ session, eventId, includeOrphaned, onClose }: QASessionDetailModalProps) {
  const navigate = useNavigate();
  const [questions, setQuestions] = useState<QandA[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!session?.id || !eventId) return;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await getQuestionsBySession(session.id, eventId, { includeOrphaned });
        setQuestions(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load questions');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [session?.id, eventId]);

  const handleOpenModeration = () => {
    onClose();
    navigate(`/events/${eventId}/qa/moderation`);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-800">
            {session?.name || 'Q&A Session'} – Questions
          </h3>
          <div className="flex items-center gap-2">
            <button
              onClick={handleOpenModeration}
              className="px-3 py-1.5 text-sm bg-purple-600 text-white rounded-md hover:bg-purple-700"
            >
              Moderation
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {loading && (
            <p className="text-gray-500 text-center py-8">Loading questions...</p>
          )}
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}
          {!loading && !error && questions.length === 0 && (
            <p className="text-gray-500 text-center py-8">No questions yet. Submissions will appear here.</p>
          )}
          {!loading && !error && questions.length > 0 && (
            <ul className="space-y-3">
              {questions.map((q) => (
                <li
                  key={q.id}
                  className="p-3 bg-gray-50 rounded-lg border border-gray-200"
                >
                  <p className="text-gray-800 font-medium mb-1">{q.question}</p>
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <span
                      className={`px-2 py-0.5 rounded ${
                        q.status === 'approved'
                          ? 'bg-green-100 text-green-800'
                          : q.status === 'rejected'
                          ? 'bg-red-100 text-red-800'
                          : 'bg-yellow-100 text-yellow-800'
                      }`}
                    >
                      {q.status}
                    </span>
                    {q.isActive && (
                      <span className="px-2 py-0.5 rounded bg-green-100 text-green-800">Active</span>
                    )}
                    {q.isNext && (
                      <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-800">Cued</span>
                    )}
                    {q.submitterName && (
                      <span className="text-gray-500">— {q.submitterName}</span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="p-4 border-t border-gray-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
