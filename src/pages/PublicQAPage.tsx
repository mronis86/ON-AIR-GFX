import { useState, useEffect, FormEvent } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getEvent, getQA, submitPublicQuestion } from '../services/firestore';
import { getQaBackupSheetName, postToWebApp } from '../services/googleSheets';
import type { QandA } from '../types';

export default function PublicQAPage() {
  const { qaId } = useParams<{ qaId: string }>();
  const navigate = useNavigate();
  const [qa, setQA] = useState<QandA | null>(null);
  const [question, setQuestion] = useState('');
  const [submitterName, setSubmitterName] = useState('');
  const [submitterEmail, setSubmitterEmail] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!qaId) return;

    const loadQA = async () => {
      try {
        const qaData = await getQA(qaId);
        if (!qaData) {
          setError('Q&A not found');
          setLoading(false);
          return;
        }
        
        if (!qaData.enablePublicSubmission) {
          setError('Public submissions are not enabled for this Q&A');
          setLoading(false);
          return;
        }

        setQA(qaData);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load Q&A');
      } finally {
        setLoading(false);
      }
    };

    loadQA();
  }, [qaId]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!question.trim()) {
      setError('Please enter your question');
      return;
    }

    if (!qa) return;

    // Validate required fields based on configuration
    if (qa.collectName && !isAnonymous && !submitterName.trim()) {
      setError('Please enter your name');
      return;
    }

    if (qa.collectEmail && !isAnonymous && !submitterEmail.trim()) {
      setError('Please enter your email');
      return;
    }

    // Validate email format if provided
    if (submitterEmail.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(submitterEmail.trim())) {
      setError('Please enter a valid email address');
      return;
    }

    setSubmitting(true);

    try {
      await submitPublicQuestion(
        qaId!,
        question.trim(),
        submitterName.trim() || undefined,
        submitterEmail.trim() || undefined,
        isAnonymous
      );
      setSubmitted(true);
      if (qa.eventId) {
        const eventData = await getEvent(qa.eventId);
        const qaBackupEnabled =
          eventData?.googleSheetWebAppUrl?.trim() &&
          (eventData?.qaBackupSheetName?.trim() || (eventData?.qaBackupPerSession && eventData?.qaBackupSheetPrefix?.trim()));
        if (qaBackupEnabled && eventData?.googleSheetWebAppUrl) {
          const ev = eventData;
          const webAppUrl = ev.googleSheetWebAppUrl!.trim();
          postToWebApp(
            webAppUrl,
            {
              type: 'qa_backup',
              sheetName: getQaBackupSheetName(ev, qaId!),
              data: {
                timestamp: new Date().toISOString(),
                sessionId: qaId,
                question: question.trim(),
                submitterName: isAnonymous ? '' : submitterName.trim(),
                submitterEmail: isAnonymous ? '' : submitterEmail.trim(),
                status: 'pending',
              },
            },
            ev.railwayLiveCsvBaseUrl?.trim().replace(/\/+$/, '')
          ).catch((err: unknown) => console.warn('Q&A backup to sheet failed:', err));
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit question');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (error && !qa) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-md p-8 max-w-md text-center">
          <div className="text-red-600 text-6xl mb-4">✗</div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Error</h2>
          <p className="text-gray-600">{error}</p>
        </div>
      </div>
    );
  }

  const handleSubmitAnother = () => {
    setSubmitted(false);
    setQuestion('');
    setSubmitterName('');
    setSubmitterEmail('');
    setIsAnonymous(false);
    setError(null);
  };

  const handleGoBack = () => {
    if (qa?.eventId) {
      navigate(`/events/${qa.eventId}/public`);
    } else {
      navigate(-1);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-md p-8 max-w-md text-center">
          <div className="text-6xl mb-4 text-green-600">✓</div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Thank you!</h2>
          <p className="text-gray-600 mb-6">Your question has been submitted and will be reviewed.</p>
          <div className="flex flex-col gap-3">
            <button
              onClick={handleSubmitAnother}
              className="w-full bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors font-semibold"
            >
              Submit Another Question
            </button>
            <button
              onClick={handleGoBack}
              className="w-full bg-gray-200 text-gray-800 px-6 py-3 rounded-lg hover:bg-gray-300 transition-colors font-semibold"
            >
              Go Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!qa) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl p-8 max-w-2xl w-full">
        <h1 className="text-3xl font-bold text-gray-800 mb-6 text-center">Submit Your Question</h1>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Question Field - Always Required */}
          <div>
            <label htmlFor="question" className="block text-sm font-medium text-gray-700 mb-2">
              Your Question <span className="text-red-500">*</span>
            </label>
            <textarea
              id="question"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              rows={4}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter your question here..."
              required
            />
          </div>

          {/* Anonymous Option - Only if allowAnonymous is true */}
          {qa.allowAnonymous && qa.collectName && (
            <div className="flex items-center">
              <input
                id="isAnonymous"
                type="checkbox"
                checked={isAnonymous}
                onChange={(e) => {
                  setIsAnonymous(e.target.checked);
                  if (e.target.checked) {
                    // Clear email if anonymous
                    setSubmitterEmail('');
                  }
                }}
                className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
              />
              <label htmlFor="isAnonymous" className="ml-2 text-sm text-gray-700">
                Submit anonymously
              </label>
            </div>
          )}

          {/* Name Field - Only if collectName is true */}
          {qa.collectName && (
            <div>
              <label htmlFor="submitterName" className="block text-sm font-medium text-gray-700 mb-2">
                Your Name {!qa.allowAnonymous ? <span className="text-red-500">*</span> : ''}
              </label>
              <input
                id="submitterName"
                type="text"
                value={submitterName}
                onChange={(e) => setSubmitterName(e.target.value)}
                disabled={isAnonymous}
                required={!qa.allowAnonymous}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                placeholder={isAnonymous ? 'Anonymous' : 'Enter your name'}
              />
            </div>
          )}

          {/* Email Field - Only if collectEmail is true */}
          {qa.collectEmail && !isAnonymous && (
            <div>
              <label htmlFor="submitterEmail" className="block text-sm font-medium text-gray-700 mb-2">
                Your Email <span className="text-red-500">*</span>
              </label>
              <input
                id="submitterEmail"
                type="email"
                value={submitterEmail}
                onChange={(e) => setSubmitterEmail(e.target.value)}
                required
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter your email address"
              />
            </div>
          )}

          {error && (
            <div className="p-3 bg-red-100 border border-red-400 text-red-700 rounded">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors font-semibold text-lg disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {submitting ? 'Submitting...' : 'Submit Question'}
          </button>
        </form>
      </div>
    </div>
  );
}
