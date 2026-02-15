import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { getEvent, getPoll, submitPollVotes } from '../services/firestore';
import { getPollBackupSheetName, postToWebApp } from '../services/googleSheets';
import type { Poll } from '../types';

export default function PublicPollPage() {
  const { pollId } = useParams<{ pollId: string }>();
  const [poll, setPoll] = useState<Poll | null>(null);
  const [selectedOptions, setSelectedOptions] = useState<string[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!pollId) return;

    const loadPoll = async () => {
      try {
        const pollData = await getPoll(pollId);
        if (!pollData) {
          setError('Poll not found');
          return;
        }
        if (!pollData.isActive) {
          setError('This poll is not currently active');
          return;
        }
        setPoll(pollData);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load poll');
      } finally {
        setLoading(false);
      }
    };

    loadPoll();
  }, [pollId]);

  const handleOptionToggle = (optionId: string) => {
    if (!poll) return;

    if (poll.type === 'single_choice' || poll.type === 'yes_no') {
      setSelectedOptions([optionId]);
    } else {
      setSelectedOptions((prev) =>
        prev.includes(optionId)
          ? prev.filter((id) => id !== optionId)
          : [...prev, optionId]
      );
    }
  };

  const handleSubmit = async () => {
    if (selectedOptions.length === 0) {
      setError('Please select at least one option');
      return;
    }

    if (!pollId) {
      setError('Poll ID is missing');
      return;
    }

    try {
      setError(null);
      await submitPollVotes(pollId, selectedOptions);
      setSubmitted(true);
      // Backup poll to sheet on user vote (in advance of operators)
      if (poll?.eventId) {
        const [updatedPoll, eventData] = await Promise.all([getPoll(pollId!), getEvent(poll.eventId)]);
        const pollBackupEnabled =
          eventData?.googleSheetWebAppUrl?.trim() &&
          (eventData?.pollBackupSheetName?.trim() || (eventData?.pollBackupPerPoll && eventData?.pollBackupSheetPrefix?.trim()));
        if (updatedPoll && pollBackupEnabled && eventData?.googleSheetWebAppUrl) {
          const ev = eventData;
          const webAppUrl = ev.googleSheetWebAppUrl!.trim();
          postToWebApp(
            webAppUrl,
            {
              type: 'poll_backup',
              sheetName: getPollBackupSheetName(ev, updatedPoll.id),
              data: {
                timestamp: new Date().toISOString(),
                id: updatedPoll.id,
                title: updatedPoll.title,
                options: (updatedPoll.options || []).map(o => ({ text: o.text, votes: o.votes ?? 0 })),
              },
            },
            ev.railwayLiveCsvBaseUrl?.trim().replace(/\/+$/, '')
          ).catch((err: unknown) => console.warn('Poll backup to sheet failed:', err));
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit vote');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600">Loading poll...</p>
        </div>
      </div>
    );
  }

  if (error || !poll) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="bg-white rounded-lg shadow-md p-8 max-w-md text-center">
          <p className="text-red-600">{error || 'Poll not found'}</p>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="bg-white rounded-lg shadow-md p-8 max-w-md text-center">
          <div className="text-6xl mb-4">✓</div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Thank you!</h2>
          <p className="text-gray-600">Your response has been recorded.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl p-8 max-w-2xl w-full">
        <h1 className="text-3xl font-bold text-gray-800 mb-6 text-center">{poll.title}</h1>
        
        <div className="space-y-3 mb-6">
          {poll.options.map((option) => (
            <button
              key={option.id}
              onClick={() => handleOptionToggle(option.id)}
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

        {error && (
          <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
            {error}
          </div>
        )}

        <button
          onClick={handleSubmit}
          disabled={selectedOptions.length === 0}
          className="w-full bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-semibold text-lg"
        >
          Submit
        </button>
      </div>
    </div>
  );
}

