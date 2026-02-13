import { useState, useEffect, FormEvent } from 'react';
import { createQA, updateQA } from '../services/firestore';
import type { QandA } from '../types';
import { QAStatus } from '../types';
import QADisplay from './QADisplay';

interface QAFormProps {
  eventId: string;
  qa?: QandA; // If provided, edit mode; otherwise, create mode
  onSuccess?: () => void;
  onCancel?: () => void;
}

const LAYOUT_LABELS = ['Full Screen', 'Lower Third', 'PIP', 'Split Screen'];

export default function QAForm({ eventId, qa, onSuccess, onCancel }: QAFormProps) {
  const isEditMode = !!qa;
  
  // Basic Info
  const [name, setName] = useState(qa?.name || '');
  
  // Public Submission Configuration - Q&A sessions automatically appear on public event page
  const [collectName, setCollectName] = useState(qa?.collectName !== false); // Default true
  const [collectEmail, setCollectEmail] = useState(qa?.collectEmail !== false); // Default true
  const [allowAnonymous, setAllowAnonymous] = useState(qa?.allowAnonymous || false);
  
  // Layout Settings
  const [layoutStyle, setLayoutStyle] = useState<number>(qa?.layoutStyle || 1);
  const [splitScreenPosition, setSplitScreenPosition] = useState<'left' | 'right'>(qa?.splitScreenPosition || 'right'); // For PIP (layout 3)
  const [splitScreenSide, setSplitScreenSide] = useState<'left' | 'right'>(qa?.splitScreenSide || 'left'); // For Split Screen (layout 4)
  const [splitScreenWidth, setSplitScreenWidth] = useState<'third' | 'half'>(qa?.splitScreenWidth || 'third'); // For Split Screen (layout 4)
  
  // Color Settings
  const [primaryColor, setPrimaryColor] = useState(qa?.primaryColor || '#3B82F6');
  const [secondaryColor, setSecondaryColor] = useState(qa?.secondaryColor || '#60A5FA');
  
  // Title Settings (per layout)
  const [titleSettings, setTitleSettings] = useState<{
    fullScreen?: { fontSize?: number; yPosition?: number; justification?: 'left' | 'center' | 'right' };
    lowerThird?: { fontSize?: number; yPosition?: number; justification?: 'left' | 'center' | 'right' };
    pip?: { fontSize?: number; yPosition?: number; justification?: 'left' | 'center' | 'right' }; // Layout 3: PIP
    splitScreen?: { fontSize?: number; yPosition?: number; justification?: 'left' | 'center' | 'right' }; // Layout 4: True Split Screen
  }>(qa?.titleSettings || {});
  
  // Background Settings (per layout)
  const [backgroundSettings, setBackgroundSettings] = useState<{
    fullScreen?: { type?: 'color' | 'transparent' | 'image'; color?: string; imageUrl?: string };
    lowerThird?: { type?: 'color' | 'transparent' | 'image'; color?: string; imageUrl?: string };
    pip?: { type?: 'color' | 'transparent' | 'image'; color?: string; imageUrl?: string }; // Layout 3: PIP
    splitScreen?: { type?: 'color' | 'transparent' | 'image'; color?: string; imageUrl?: string }; // Layout 4: True Split Screen
  }>(qa?.backgroundSettings || {});
  
  // Border Settings (per layout)
  const [borderSettings, setBorderSettings] = useState<{
    fullScreen?: { thickness?: number; position?: 'inner' | 'outer'; zoom?: number; borderRadius?: number };
    lowerThird?: { thickness?: number; position?: 'inner' | 'outer' | 'line'; type?: 'line' | 'boxEdge'; zoom?: number; yPosition?: number; borderRadius?: number };
    pip?: { thickness?: number; position?: 'inner' | 'outer'; zoom?: number; xPosition?: number; yPosition?: number; borderRadius?: number }; // Layout 3: PIP
    splitScreen?: { thickness?: number; position?: 'inner' | 'outer' | 'line'; type?: 'line' | 'boxEdge'; zoom?: number; xPosition?: number; yPosition?: number; borderRadius?: number }; // Layout 4: True Split Screen
  }>(qa?.borderSettings || {});
  
  // Border Radius
  const [borderRadius, setBorderRadius] = useState<number>(qa?.borderRadius ?? 0);
  
  // Display Settings
  const [showTitle, setShowTitle] = useState(qa?.showTitle !== false); // Default true
  const [showName, setShowName] = useState(qa?.showName !== false); // Default true - controls if name is shown in display
  
  // Answer Settings (per layout)
  const [answerSettings, setAnswerSettings] = useState<{
    fullScreen?: { fontSize?: number; justification?: 'left' | 'center' | 'right'; yPosition?: number };
    lowerThird?: { fontSize?: number; justification?: 'left' | 'center' | 'right'; yPosition?: number };
    pip?: { fontSize?: number; justification?: 'left' | 'center' | 'right'; yPosition?: number };
    splitScreen?: { fontSize?: number; justification?: 'left' | 'center' | 'right'; yPosition?: number };
  }>(qa?.answerSettings || {});
  
  // Name Settings (per layout)
  const [nameSettings, setNameSettings] = useState<{
    fullScreen?: { fontSize?: number; justification?: 'left' | 'center' | 'right'; yPosition?: number };
    lowerThird?: { fontSize?: number; justification?: 'left' | 'center' | 'right'; yPosition?: number };
    pip?: { fontSize?: number; justification?: 'left' | 'center' | 'right'; yPosition?: number };
    splitScreen?: { fontSize?: number; justification?: 'left' | 'center' | 'right'; yPosition?: number };
  }>(qa?.nameSettings || {});

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  // Update form state when qa prop changes (for editing)
  useEffect(() => {
    if (qa && isEditMode) {
      setName(qa.name || '');
      setCollectName(qa.collectName !== false);
      setCollectEmail(qa.collectEmail !== false);
      setAllowAnonymous(qa.allowAnonymous || false);
      setLayoutStyle(qa.layoutStyle || 1);
      setSplitScreenPosition(qa.splitScreenPosition || 'right');
      setSplitScreenSide(qa.splitScreenSide || 'left');
      setSplitScreenWidth(qa.splitScreenWidth || 'third');
      setPrimaryColor(qa.primaryColor || '#3B82F6');
      setSecondaryColor(qa.secondaryColor || '#60A5FA');
      setShowTitle(qa.showTitle !== false);
      setShowName(qa.showName !== false);
      // Migrate old splitScreen settings to pip for layout 3
      const migratedTitleSettings = qa.titleSettings || {};
      if (qa.layoutStyle === 3 && migratedTitleSettings.splitScreen && !migratedTitleSettings.pip) {
        migratedTitleSettings.pip = migratedTitleSettings.splitScreen;
      }
      const migratedAnswerSettings = qa.answerSettings || {};
      if (qa.layoutStyle === 3 && migratedAnswerSettings.splitScreen && !migratedAnswerSettings.pip) {
        migratedAnswerSettings.pip = migratedAnswerSettings.splitScreen;
      }
      const migratedNameSettings = qa.nameSettings || {};
      if (qa.layoutStyle === 3 && migratedNameSettings.splitScreen && !migratedNameSettings.pip) {
        migratedNameSettings.pip = migratedNameSettings.splitScreen;
      }
      const migratedBackgroundSettings = qa.backgroundSettings || {};
      if (qa.layoutStyle === 3 && migratedBackgroundSettings.splitScreen && !migratedBackgroundSettings.pip) {
        migratedBackgroundSettings.pip = migratedBackgroundSettings.splitScreen;
      }
      const migratedBorderSettings = qa.borderSettings || {};
      if (qa.layoutStyle === 3 && migratedBorderSettings.splitScreen && !migratedBorderSettings.pip) {
        // Copy splitScreen settings to pip, but remove 'line' position and 'type' since pip doesn't support them
        const { position, type, ...rest } = migratedBorderSettings.splitScreen;
        migratedBorderSettings.pip = {
          ...rest,
          position: position === 'line' ? 'inner' : (position === 'outer' ? 'outer' : 'inner'),
        };
      }
      
      setTitleSettings(migratedTitleSettings);
      setAnswerSettings(migratedAnswerSettings);
      setNameSettings(migratedNameSettings);
      setBackgroundSettings(migratedBackgroundSettings);
      setBorderSettings(migratedBorderSettings);
      setBorderRadius(qa.borderRadius ?? 0);
    }
  }, [qa, isEditMode]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (!name.trim()) {
        setError('Please enter a Q&A session name/title');
        setLoading(false);
        return;
      }

      if (qa) {
        // Update existing Q&A
        const updateData: Partial<QandA> = {
          name: name.trim(),
          collectName,
          collectEmail,
          allowAnonymous,
          layoutStyle,
          splitScreenPosition,
          splitScreenSide,
          splitScreenWidth,
          primaryColor,
          secondaryColor,
          showTitle,
          showName,
        };
        
        // Only include settings objects if they have content
        if (Object.keys(titleSettings).length > 0) {
          updateData.titleSettings = titleSettings;
        } else {
          // If empty, we'll delete the field in updateQA
          updateData.titleSettings = undefined;
        }
        if (Object.keys(answerSettings).length > 0) {
          updateData.answerSettings = answerSettings;
        } else {
          updateData.answerSettings = undefined;
        }
        if (showName && Object.keys(nameSettings).length > 0) {
          updateData.nameSettings = nameSettings;
        } else {
          updateData.nameSettings = undefined;
        }
        if (Object.keys(backgroundSettings).length > 0) {
          updateData.backgroundSettings = backgroundSettings;
        } else {
          updateData.backgroundSettings = undefined;
        }
        if (Object.keys(borderSettings).length > 0) {
          updateData.borderSettings = borderSettings;
        } else {
          updateData.borderSettings = undefined;
        }
        updateData.borderRadius = borderRadius;
        
        await updateQA(qa.id, updateData);
      } else {
        // Create new Q&A
        const qaData: Omit<QandA, 'id' | 'createdAt' | 'updatedAt'> = {
          eventId,
          name: name.trim(),
          status: QAStatus.APPROVED, // Q&A sessions start as approved (they're containers)
          isActive: false,
          isNext: false,
          collectName,
          collectEmail,
          allowAnonymous,
          layoutStyle,
          splitScreenPosition,
          splitScreenSide,
          splitScreenWidth,
          primaryColor,
          secondaryColor,
          showTitle,
        };
        
        // Only include settings objects if they have content
        if (Object.keys(titleSettings).length > 0) {
          qaData.titleSettings = titleSettings;
        }
        if (Object.keys(answerSettings).length > 0) {
          qaData.answerSettings = answerSettings;
        }
        if (showName && Object.keys(nameSettings).length > 0) {
          qaData.nameSettings = nameSettings;
        }
        if (Object.keys(backgroundSettings).length > 0) {
          qaData.backgroundSettings = backgroundSettings;
        }
        if (Object.keys(borderSettings).length > 0) {
          qaData.borderSettings = borderSettings;
        }
        qaData.borderRadius = borderRadius;
        
        await createQA(qaData);
      }

      if (onSuccess) {
        onSuccess();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save Q&A');
    } finally {
      setLoading(false);
    }
  };

  // Create preview Q&A object
  const previewQA: QandA = {
    id: 'preview',
    eventId,
    name: name || 'Q&A Session Name',
    borderRadius,
    question: name || 'Q&A Session Name', // Use the session name as the question for preview
    answer: 'This is a sample answer that demonstrates how the Q&A will look.',
    submitterName: showName ? 'John Doe' : undefined,
    status: QAStatus.APPROVED,
    isActive: false,
    isNext: false,
    layoutStyle,
    splitScreenPosition,
    splitScreenSide,
    splitScreenWidth,
    primaryColor,
    secondaryColor,
    showTitle,
    titleSettings,
    answerSettings,
    nameSettings: showName ? nameSettings : undefined,
    backgroundSettings,
    borderSettings,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  // Check if we're in a dark theme context (Operators page)
  const isDarkTheme = window.location.pathname.includes('/operators');

  return (
    <div className={`${isDarkTheme ? 'bg-gray-800' : 'bg-white'} p-6 rounded-lg shadow-md max-w-6xl mx-auto`}>
      <h2 className={`text-2xl font-bold mb-4 ${isDarkTheme ? 'text-white' : 'text-gray-800'}`}>
        {isEditMode ? 'Edit Q&A Session' : 'Create New Q&A Session'}
      </h2>

      {error && (
        <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Info */}
        <div>
          <label htmlFor="qa-name" className={`block text-sm font-medium ${isDarkTheme ? 'text-gray-300' : 'text-gray-700'} mb-1`}>
            Q&A Session Name *
          </label>
          <input
            id="qa-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="e.g., Main Session Q&A, Panel Discussion Q&A"
          />
          <p className={`text-xs mt-1 ${isDarkTheme ? 'text-gray-400' : 'text-gray-500'}`}>
            This is a general title for this Q&A session. Individual questions will be submitted by the public.
          </p>
        </div>

        {/* Public Submission Configuration - Q&A sessions automatically appear on public event page */}
        <div className="border-t border-gray-300 pt-4">
          <h3 className={`text-lg font-semibold mb-4 ${isDarkTheme ? 'text-white' : 'text-gray-800'}`}>
            Submission Form Configuration
          </h3>
          <p className={`text-sm mb-4 ${isDarkTheme ? 'text-gray-400' : 'text-gray-500'}`}>
            Configure which fields to show in the submission form on the public event page.
          </p>
          
          <div className="space-y-3 bg-gray-50 dark:bg-gray-700 p-4 rounded-md">
            <div className="flex items-center">
              <input
                id="collectName"
                type="checkbox"
                checked={collectName}
                onChange={(e) => setCollectName(e.target.checked)}
                className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
              />
              <label htmlFor="collectName" className={`ml-2 text-sm font-medium ${isDarkTheme ? 'text-gray-300' : 'text-gray-700'}`}>
                Collect Submitter Name
              </label>
            </div>

            <div className="flex items-center">
              <input
                id="collectEmail"
                type="checkbox"
                checked={collectEmail}
                onChange={(e) => setCollectEmail(e.target.checked)}
                className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
              />
              <label htmlFor="collectEmail" className={`ml-2 text-sm font-medium ${isDarkTheme ? 'text-gray-300' : 'text-gray-700'}`}>
                Collect Submitter Email
              </label>
            </div>

            <div className="flex items-center">
              <input
                id="allowAnonymous"
                type="checkbox"
                checked={allowAnonymous}
                onChange={(e) => setAllowAnonymous(e.target.checked)}
                disabled={!collectName}
                className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 disabled:opacity-50"
              />
              <label htmlFor="allowAnonymous" className={`ml-2 text-sm font-medium ${!collectName ? 'text-gray-400' : isDarkTheme ? 'text-gray-300' : 'text-gray-700'}`}>
                Allow Anonymous Submissions
              </label>
            </div>
            {allowAnonymous && collectName && (
              <p className={`ml-6 text-xs ${isDarkTheme ? 'text-gray-400' : 'text-gray-500'}`}>
                When enabled, users can submit questions with a name but without an email address.
              </p>
            )}
          </div>
        </div>

        {/* Display Settings */}
        <div className="border-t border-gray-300 pt-4">
          <h3 className={`text-lg font-semibold mb-4 ${isDarkTheme ? 'text-white' : 'text-gray-800'}`}>
            Display Settings
          </h3>
          <div className="flex items-end gap-6 mb-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={showTitle}
                onChange={(e) => setShowTitle(e.target.checked)}
                className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
              />
              <span className={`text-sm font-medium ${isDarkTheme ? 'text-gray-300' : 'text-gray-700'}`}>Show Title</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={showName}
                onChange={(e) => setShowName(e.target.checked)}
                className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
              />
              <span className={`text-sm font-medium ${isDarkTheme ? 'text-gray-300' : 'text-gray-700'}`}>Show Name</span>
            </label>
          </div>
        </div>

        {/* Broadcast Layout Options */}
        <div className="border-t border-gray-300 pt-4">
          <label className={`block text-sm font-medium mb-2 ${isDarkTheme ? 'text-gray-300' : 'text-gray-700'}`}>
            Broadcast Layout *
          </label>
          <div className="flex gap-2">
            {LAYOUT_LABELS.map((label, index) => {
              const styleNum = index + 1;
              return (
                <button
                  key={styleNum}
                  type="button"
                  onClick={() => setLayoutStyle(styleNum)}
                  className={`flex-1 px-4 py-3 rounded-md border-2 transition-all font-medium ${
                    layoutStyle === styleNum
                      ? 'border-blue-600 bg-blue-50 text-blue-700 font-semibold'
                      : 'border-gray-300 hover:border-gray-400'
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Split Screen Position (only show when Split Screen is selected) */}
        {layoutStyle === 3 && (
          <div>
            <label className={`block text-sm font-medium mb-2 ${isDarkTheme ? 'text-gray-300' : 'text-gray-700'}`}>
              PIP Position
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setSplitScreenPosition('left')}
                className={`flex-1 px-4 py-3 rounded-md border-2 transition-all font-medium ${
                  splitScreenPosition === 'left'
                    ? 'border-blue-600 bg-blue-50 text-blue-700 font-semibold'
                    : 'border-gray-300 hover:border-gray-400'
                }`}
              >
                Left
              </button>
              <button
                type="button"
                onClick={() => setSplitScreenPosition('right')}
                className={`flex-1 px-4 py-3 rounded-md border-2 transition-all font-medium ${
                  splitScreenPosition === 'right'
                    ? 'border-blue-600 bg-blue-50 text-blue-700 font-semibold'
                    : 'border-gray-300 hover:border-gray-400'
                }`}
              >
                Right
              </button>
            </div>
          </div>
        )}
        {layoutStyle === 4 && (
          <div className="space-y-4">
            <div>
              <label className={`block text-sm font-medium mb-2 ${isDarkTheme ? 'text-gray-300' : 'text-gray-700'}`}>
                Split Screen Position
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setSplitScreenSide('left')}
                  className={`flex-1 px-4 py-3 rounded-md border-2 transition-all font-medium ${
                    splitScreenSide === 'left'
                      ? 'border-blue-600 bg-blue-50 text-blue-700 font-semibold'
                      : 'border-gray-300 hover:border-gray-400'
                  }`}
                >
                  Left
                </button>
                <button
                  type="button"
                  onClick={() => setSplitScreenSide('right')}
                  className={`flex-1 px-4 py-3 rounded-md border-2 transition-all font-medium ${
                    splitScreenSide === 'right'
                      ? 'border-blue-600 bg-blue-50 text-blue-700 font-semibold'
                      : 'border-gray-300 hover:border-gray-400'
                  }`}
                >
                  Right
                </button>
              </div>
            </div>
            <div>
              <label className={`block text-sm font-medium mb-2 ${isDarkTheme ? 'text-gray-300' : 'text-gray-700'}`}>
                Split Screen Width
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setSplitScreenWidth('third')}
                  className={`flex-1 px-4 py-3 rounded-md border-2 transition-all font-medium ${
                    splitScreenWidth === 'third'
                      ? 'border-blue-600 bg-blue-50 text-blue-700 font-semibold'
                      : 'border-gray-300 hover:border-gray-400'
                  }`}
                >
                  1/3 Page
                </button>
                <button
                  type="button"
                  onClick={() => setSplitScreenWidth('half')}
                  className={`flex-1 px-4 py-3 rounded-md border-2 transition-all font-medium ${
                    splitScreenWidth === 'half'
                      ? 'border-blue-600 bg-blue-50 text-blue-700 font-semibold'
                      : 'border-gray-300 hover:border-gray-400'
                  }`}
                >
                  1/2 Page
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Color Settings */}
        <div className="border-t border-gray-300 pt-4">
          <h3 className={`text-lg font-semibold mb-4 ${isDarkTheme ? 'text-white' : 'text-gray-800'}`}>
            Color Settings
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={`block text-sm font-medium mb-2 ${isDarkTheme ? 'text-gray-300' : 'text-gray-700'}`}>
                Primary Color
              </label>
              <div className="flex gap-2">
                <input
                  type="color"
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  className="w-16 h-12 rounded border border-gray-300 cursor-pointer"
                />
                <input
                  type="text"
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md"
                  placeholder="#3B82F6"
                />
              </div>
            </div>
            <div>
              <label className={`block text-sm font-medium mb-2 ${isDarkTheme ? 'text-gray-300' : 'text-gray-700'}`}>
                Secondary Color
              </label>
              <div className="flex gap-2">
                <input
                  type="color"
                  value={secondaryColor}
                  onChange={(e) => setSecondaryColor(e.target.value)}
                  className="w-16 h-12 rounded border border-gray-300 cursor-pointer"
                />
                <input
                  type="text"
                  value={secondaryColor}
                  onChange={(e) => setSecondaryColor(e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md"
                  placeholder="#60A5FA"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Per-Layout Title Settings - Only show if showTitle is enabled */}
        {showTitle && (
        <div className="border-t border-gray-300 pt-4">
          <h3 className={`text-lg font-semibold mb-4 ${isDarkTheme ? 'text-white' : 'text-gray-800'}`}>Title Settings (Per Layout)</h3>
          
          {/* Full Screen Title Settings */}
          {layoutStyle === 1 && (
          <div className="border border-gray-200 rounded-lg p-4 bg-gray-50 mb-4">
            <label className={`block text-sm font-medium mb-3 ${isDarkTheme ? 'text-gray-700' : 'text-gray-700'}`}>
              Full Screen Layout
            </label>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-xs text-gray-600 mb-1">Font Size (px)</label>
                <input
                  type="number"
                  min="12"
                  max="120"
                  value={titleSettings.fullScreen?.fontSize || 80}
                  onChange={(e) => {
                    const fontSize = parseInt(e.target.value) || 80;
                    setTitleSettings(prev => ({
                      ...prev,
                      fullScreen: { ...prev.fullScreen, fontSize },
                    }));
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">Y Position (px)</label>
                <input
                  type="number"
                  min="-200"
                  max="200"
                  value={titleSettings.fullScreen?.yPosition || 0}
                  onChange={(e) => {
                    const yPosition = parseInt(e.target.value) || 0;
                    setTitleSettings(prev => ({
                      ...prev,
                      fullScreen: { ...prev.fullScreen, yPosition },
                    }));
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                  placeholder="0"
                />
                <span className="text-xs text-gray-500 mt-1 block">Negative = up, Positive = down</span>
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">Justification</label>
                <select
                  value={titleSettings.fullScreen?.justification || 'center'}
                  onChange={(e) => {
                    const justification = e.target.value as 'left' | 'center' | 'right';
                    setTitleSettings(prev => ({
                      ...prev,
                      fullScreen: { 
                        fontSize: prev.fullScreen?.fontSize || 80,
                        yPosition: prev.fullScreen?.yPosition || 0,
                        justification: justification,
                      },
                    }));
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                >
                  <option value="left">Left</option>
                  <option value="center">Center</option>
                  <option value="right">Right</option>
                </select>
              </div>
            </div>
          </div>
          )}

          {/* Lower Third Title Settings */}
          {layoutStyle === 2 && (
          <div className="border border-gray-200 rounded-lg p-4 bg-gray-50 mb-4">
            <label className={`block text-sm font-medium mb-3 ${isDarkTheme ? 'text-gray-700' : 'text-gray-700'}`}>
              Lower Third Layout
            </label>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-xs text-gray-600 mb-1">Font Size (px)</label>
                <input
                  type="number"
                  min="12"
                  max="120"
                  value={titleSettings.lowerThird?.fontSize || 50}
                  onChange={(e) => {
                    const fontSize = parseInt(e.target.value) || 50;
                    setTitleSettings(prev => ({
                      ...prev,
                      lowerThird: { ...prev.lowerThird, fontSize },
                    }));
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">Y Position (px)</label>
                <input
                  type="number"
                  min="-200"
                  max="200"
                  value={titleSettings.lowerThird?.yPosition ?? 0}
                  onChange={(e) => {
                    const yPosition = parseInt(e.target.value) || 0;
                    setTitleSettings(prev => ({
                      ...prev,
                      lowerThird: { ...prev.lowerThird, yPosition },
                    }));
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                  placeholder="0"
                />
                <span className="text-xs text-gray-500 mt-1 block">Negative = up, Positive = down</span>
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">Justification</label>
                <select
                  value={titleSettings.lowerThird?.justification || 'center'}
                  onChange={(e) => {
                    const justification = e.target.value as 'left' | 'center' | 'right';
                    setTitleSettings(prev => ({
                      ...prev,
                      lowerThird: { 
                        fontSize: prev.lowerThird?.fontSize || 50,
                        yPosition: prev.lowerThird?.yPosition ?? 0,
                        justification: justification,
                      },
                    }));
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                >
                  <option value="left">Left</option>
                  <option value="center">Center</option>
                  <option value="right">Right</option>
                </select>
              </div>
            </div>
          </div>
          )}

          {/* PIP Title Settings */}
          {layoutStyle === 3 && (
          <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
            <label className={`block text-sm font-medium mb-3 ${isDarkTheme ? 'text-gray-700' : 'text-gray-700'}`}>
              PIP Layout
            </label>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-xs text-gray-600 mb-1">Font Size (px)</label>
                <input
                  type="number"
                  min="12"
                  max="120"
                  value={titleSettings.pip?.fontSize || 40}
                  onChange={(e) => {
                    const fontSize = parseInt(e.target.value) || 40;
                    setTitleSettings(prev => ({
                      ...prev,
                      pip: { ...prev.pip, fontSize },
                    }));
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">Y Position (px)</label>
                <input
                  type="number"
                  min="-200"
                  max="200"
                  value={titleSettings.pip?.yPosition || 0}
                  onChange={(e) => {
                    const yPosition = parseInt(e.target.value) || 0;
                    setTitleSettings(prev => ({
                      ...prev,
                      pip: { ...prev.pip, yPosition },
                    }));
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                  placeholder="0"
                />
                <span className="text-xs text-gray-500 mt-1 block">Negative = up, Positive = down</span>
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">Justification</label>
                <select
                  value={titleSettings.pip?.justification || 'center'}
                  onChange={(e) => {
                    const justification = e.target.value as 'left' | 'center' | 'right';
                    setTitleSettings(prev => ({
                      ...prev,
                      pip: { 
                        fontSize: prev.pip?.fontSize || 40,
                        yPosition: prev.pip?.yPosition || 0,
                        justification: justification,
                      },
                    }));
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                >
                  <option value="left">Left</option>
                  <option value="center">Center</option>
                  <option value="right">Right</option>
                </select>
              </div>
            </div>
          </div>
          )}

          {/* Split Screen Title Settings */}
          {layoutStyle === 4 && (
          <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
            <label className={`block text-sm font-medium mb-3 ${isDarkTheme ? 'text-gray-700' : 'text-gray-700'}`}>
              Split Screen Layout
            </label>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-xs text-gray-600 mb-1">Font Size (px)</label>
                <input
                  type="number"
                  min="12"
                  max="120"
                  value={titleSettings.splitScreen?.fontSize || 40}
                  onChange={(e) => {
                    const fontSize = parseInt(e.target.value) || 40;
                    setTitleSettings(prev => ({
                      ...prev,
                      splitScreen: { ...prev.splitScreen, fontSize },
                    }));
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">Y Position (px)</label>
                <input
                  type="number"
                  min="-200"
                  max="200"
                  value={titleSettings.splitScreen?.yPosition || 0}
                  onChange={(e) => {
                    const yPosition = parseInt(e.target.value) || 0;
                    setTitleSettings(prev => ({
                      ...prev,
                      splitScreen: { ...prev.splitScreen, yPosition },
                    }));
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                  placeholder="0"
                />
                <span className="text-xs text-gray-500 mt-1 block">Negative = up, Positive = down</span>
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">Justification</label>
                <select
                  value={titleSettings.splitScreen?.justification || 'center'}
                  onChange={(e) => {
                    const justification = e.target.value as 'left' | 'center' | 'right';
                    setTitleSettings(prev => ({
                      ...prev,
                      splitScreen: { 
                        ...prev.splitScreen,
                        fontSize: prev.splitScreen?.fontSize || 40,
                        yPosition: prev.splitScreen?.yPosition || 0,
                        justification: justification,
                      },
                    }));
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                >
                  <option value="left">Left</option>
                  <option value="center">Center</option>
                  <option value="right">Right</option>
                </select>
              </div>
            </div>
          </div>
          )}
        </div>
        )}

        {/* Per-Layout Question Settings */}
        <div className="border-t border-gray-300 pt-4">
          <h3 className={`text-lg font-semibold mb-4 ${isDarkTheme ? 'text-white' : 'text-gray-800'}`}>Question Settings (Per Layout)</h3>
          
          {/* Full Screen Question Settings */}
          {layoutStyle === 1 && (
          <div className="border border-gray-200 rounded-lg p-4 bg-gray-50 mb-4">
            <label className={`block text-sm font-medium mb-3 ${isDarkTheme ? 'text-gray-700' : 'text-gray-700'}`}>
              Full Screen Layout
            </label>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-gray-600 mb-1">Font Size (px)</label>
                <input
                  type="number"
                  min="12"
                  max="120"
                  value={answerSettings.fullScreen?.fontSize || 36}
                  onChange={(e) => {
                    const fontSize = parseInt(e.target.value) || 36;
                    setAnswerSettings(prev => ({
                      ...prev,
                      fullScreen: { ...prev.fullScreen, fontSize },
                    }));
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">Justification</label>
                <select
                  value={answerSettings.fullScreen?.justification || 'center'}
                  onChange={(e) => {
                    const justification = e.target.value as 'left' | 'center' | 'right';
                    setAnswerSettings(prev => ({
                      ...prev,
                      fullScreen: { 
                        fontSize: prev.fullScreen?.fontSize || 36,
                        justification: justification,
                      },
                    }));
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                >
                  <option value="left">Left</option>
                  <option value="center">Center</option>
                  <option value="right">Right</option>
                </select>
              </div>
            </div>
          </div>
          )}

          {/* Lower Third Question Settings */}
          {layoutStyle === 2 && (
          <div className="border border-gray-200 rounded-lg p-4 bg-gray-50 mb-4">
            <label className={`block text-sm font-medium mb-3 ${isDarkTheme ? 'text-gray-700' : 'text-gray-700'}`}>
              Lower Third Layout
            </label>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-xs text-gray-600 mb-1">Font Size (px)</label>
                <input
                  type="number"
                  min="12"
                  max="120"
                  value={answerSettings.lowerThird?.fontSize || 24}
                  onChange={(e) => {
                    const fontSize = parseInt(e.target.value) || 24;
                    setAnswerSettings(prev => ({
                      ...prev,
                      lowerThird: { ...prev.lowerThird, fontSize },
                    }));
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">Justification</label>
                <select
                  value={answerSettings.lowerThird?.justification || 'center'}
                  onChange={(e) => {
                    const justification = e.target.value as 'left' | 'center' | 'right';
                    setAnswerSettings(prev => ({
                      ...prev,
                      lowerThird: { 
                        ...prev.lowerThird,
                        fontSize: prev.lowerThird?.fontSize || 24,
                        justification: justification,
                      },
                    }));
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                >
                  <option value="left">Left</option>
                  <option value="center">Center</option>
                  <option value="right">Right</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">Y Position (px)</label>
                <input
                  type="number"
                  min="-100"
                  max="100"
                  value={answerSettings.lowerThird?.yPosition || 0}
                  onChange={(e) => {
                    const yPosition = parseInt(e.target.value) || 0;
                    setAnswerSettings(prev => ({
                      ...prev,
                      lowerThird: { 
                        ...prev.lowerThird,
                        fontSize: prev.lowerThird?.fontSize || 24,
                        yPosition: yPosition,
                      },
                    }));
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                />
              </div>
            </div>
          </div>
          )}

          {/* PIP Answer Settings */}
          {layoutStyle === 3 && (
          <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
            <label className={`block text-sm font-medium mb-3 ${isDarkTheme ? 'text-gray-700' : 'text-gray-700'}`}>
              PIP Layout
            </label>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-gray-600 mb-1">Font Size (px)</label>
                <input
                  type="number"
                  min="12"
                  max="120"
                  value={answerSettings.pip?.fontSize || 28}
                  onChange={(e) => {
                    const fontSize = parseInt(e.target.value) || 28;
                    setAnswerSettings(prev => ({
                      ...prev,
                      pip: { ...prev.pip, fontSize },
                    }));
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">Justification</label>
                <select
                  value={answerSettings.pip?.justification || 'center'}
                  onChange={(e) => {
                    const justification = e.target.value as 'left' | 'center' | 'right';
                    setAnswerSettings(prev => ({
                      ...prev,
                      pip: { 
                        ...prev.pip,
                        fontSize: prev.pip?.fontSize || 28,
                        justification: justification,
                      },
                    }));
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                >
                  <option value="left">Left</option>
                  <option value="center">Center</option>
                  <option value="right">Right</option>
                </select>
              </div>
            </div>
          </div>
          )}

          {/* Split Screen Answer Settings */}
          {layoutStyle === 4 && (
          <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
            <label className={`block text-sm font-medium mb-3 ${isDarkTheme ? 'text-gray-700' : 'text-gray-700'}`}>
              Split Screen Layout
            </label>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-xs text-gray-600 mb-1">Font Size (px)</label>
                <input
                  type="number"
                  min="12"
                  max="120"
                  value={answerSettings.splitScreen?.fontSize || 28}
                  onChange={(e) => {
                    const fontSize = parseInt(e.target.value) || 28;
                    setAnswerSettings(prev => ({
                      ...prev,
                      splitScreen: { ...prev.splitScreen, fontSize },
                    }));
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">Y Position (px)</label>
                <input
                  type="number"
                  min="-200"
                  max="200"
                  value={answerSettings.splitScreen?.yPosition || 0}
                  onChange={(e) => {
                    const yPosition = parseInt(e.target.value) || 0;
                    setAnswerSettings(prev => ({
                      ...prev,
                      splitScreen: { ...prev.splitScreen, yPosition },
                    }));
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                  placeholder="0"
                />
                <span className="text-xs text-gray-500 mt-1 block">Negative = up, Positive = down</span>
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">Justification</label>
                <select
                  value={answerSettings.splitScreen?.justification || 'center'}
                  onChange={(e) => {
                    const justification = e.target.value as 'left' | 'center' | 'right';
                    setAnswerSettings(prev => ({
                      ...prev,
                      splitScreen: { 
                        ...prev.splitScreen,
                        fontSize: prev.splitScreen?.fontSize || 28,
                        yPosition: prev.splitScreen?.yPosition || 0,
                        justification: justification,
                      },
                    }));
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                >
                  <option value="left">Left</option>
                  <option value="center">Center</option>
                  <option value="right">Right</option>
                </select>
              </div>
            </div>
          </div>
          )}
        </div>

        {/* Per-Layout Name Settings - Only show if showName is enabled */}
        {showName && (
        <div className="border-t border-gray-300 pt-4">
          <h3 className={`text-lg font-semibold mb-4 ${isDarkTheme ? 'text-white' : 'text-gray-800'}`}>Name Settings (Per Layout)</h3>
          
          {/* Full Screen Name Settings */}
          {layoutStyle === 1 && (
          <div className="border border-gray-200 rounded-lg p-4 bg-gray-50 mb-4">
            <label className={`block text-sm font-medium mb-3 ${isDarkTheme ? 'text-gray-700' : 'text-gray-700'}`}>
              Full Screen Layout
            </label>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-gray-600 mb-1">Font Size (px)</label>
                <input
                  type="number"
                  min="12"
                  max="120"
                  value={nameSettings.fullScreen?.fontSize || 24}
                  onChange={(e) => {
                    const fontSize = parseInt(e.target.value) || 24;
                    setNameSettings(prev => ({
                      ...prev,
                      fullScreen: { ...prev.fullScreen, fontSize },
                    }));
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">Justification</label>
                <select
                  value={nameSettings.fullScreen?.justification || 'center'}
                  onChange={(e) => {
                    const justification = e.target.value as 'left' | 'center' | 'right';
                    setNameSettings(prev => ({
                      ...prev,
                      fullScreen: { 
                        fontSize: prev.fullScreen?.fontSize || 24,
                        justification: justification,
                      },
                    }));
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                >
                  <option value="left">Left</option>
                  <option value="center">Center</option>
                  <option value="right">Right</option>
                </select>
              </div>
            </div>
          </div>
          )}

          {/* Lower Third Name Settings */}
          {layoutStyle === 2 && (
          <div className="border border-gray-200 rounded-lg p-4 bg-gray-50 mb-4">
            <label className={`block text-sm font-medium mb-3 ${isDarkTheme ? 'text-gray-700' : 'text-gray-700'}`}>
              Lower Third Layout
            </label>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-xs text-gray-600 mb-1">Font Size (px)</label>
                <input
                  type="number"
                  min="12"
                  max="120"
                  value={nameSettings.lowerThird?.fontSize || 18}
                  onChange={(e) => {
                    const fontSize = parseInt(e.target.value) || 18;
                    setNameSettings(prev => ({
                      ...prev,
                      lowerThird: { ...prev.lowerThird, fontSize },
                    }));
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">Justification</label>
                <select
                  value={nameSettings.lowerThird?.justification || 'center'}
                  onChange={(e) => {
                    const justification = e.target.value as 'left' | 'center' | 'right';
                    setNameSettings(prev => ({
                      ...prev,
                      lowerThird: { 
                        ...prev.lowerThird,
                        fontSize: prev.lowerThird?.fontSize || 18,
                        justification: justification,
                      },
                    }));
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                >
                  <option value="left">Left</option>
                  <option value="center">Center</option>
                  <option value="right">Right</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">Y Position (px)</label>
                <input
                  type="number"
                  min="-100"
                  max="100"
                  value={nameSettings.lowerThird?.yPosition || 0}
                  onChange={(e) => {
                    const yPosition = parseInt(e.target.value) || 0;
                    setNameSettings(prev => ({
                      ...prev,
                      lowerThird: { 
                        ...prev.lowerThird,
                        fontSize: prev.lowerThird?.fontSize || 18,
                        yPosition: yPosition,
                      },
                    }));
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                />
              </div>
            </div>
          </div>
          )}

          {/* PIP Name Settings */}
          {layoutStyle === 3 && (
          <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
            <label className={`block text-sm font-medium mb-3 ${isDarkTheme ? 'text-gray-700' : 'text-gray-700'}`}>
              PIP Layout
            </label>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-gray-600 mb-1">Font Size (px)</label>
                <input
                  type="number"
                  min="12"
                  max="120"
                  value={nameSettings.pip?.fontSize || 20}
                  onChange={(e) => {
                    const fontSize = parseInt(e.target.value) || 20;
                    setNameSettings(prev => ({
                      ...prev,
                      pip: { ...prev.pip, fontSize },
                    }));
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">Justification</label>
                <select
                  value={nameSettings.pip?.justification || 'center'}
                  onChange={(e) => {
                    const justification = e.target.value as 'left' | 'center' | 'right';
                    setNameSettings(prev => ({
                      ...prev,
                      pip: { 
                        ...prev.pip,
                        fontSize: prev.pip?.fontSize || 20,
                        justification: justification,
                      },
                    }));
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                >
                  <option value="left">Left</option>
                  <option value="center">Center</option>
                  <option value="right">Right</option>
                </select>
              </div>
            </div>
          </div>
          )}

          {/* Split Screen Name Settings */}
          {layoutStyle === 4 && (
          <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
            <label className={`block text-sm font-medium mb-3 ${isDarkTheme ? 'text-gray-700' : 'text-gray-700'}`}>
              Split Screen Layout
            </label>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-xs text-gray-600 mb-1">Font Size (px)</label>
                <input
                  type="number"
                  min="12"
                  max="120"
                  value={nameSettings.splitScreen?.fontSize || 20}
                  onChange={(e) => {
                    const fontSize = parseInt(e.target.value) || 20;
                    setNameSettings(prev => ({
                      ...prev,
                      splitScreen: { ...prev.splitScreen, fontSize },
                    }));
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">Y Position (px)</label>
                <input
                  type="number"
                  min="-200"
                  max="200"
                  value={nameSettings.splitScreen?.yPosition || 0}
                  onChange={(e) => {
                    const yPosition = parseInt(e.target.value) || 0;
                    setNameSettings(prev => ({
                      ...prev,
                      splitScreen: { ...prev.splitScreen, yPosition },
                    }));
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                  placeholder="0"
                />
                <span className="text-xs text-gray-500 mt-1 block">Negative = up, Positive = down</span>
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">Justification</label>
                <select
                  value={nameSettings.splitScreen?.justification || 'center'}
                  onChange={(e) => {
                    const justification = e.target.value as 'left' | 'center' | 'right';
                    setNameSettings(prev => ({
                      ...prev,
                      splitScreen: { 
                        ...prev.splitScreen,
                        fontSize: prev.splitScreen?.fontSize || 20,
                        yPosition: prev.splitScreen?.yPosition || 0,
                        justification: justification,
                      },
                    }));
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                >
                  <option value="left">Left</option>
                  <option value="center">Center</option>
                  <option value="right">Right</option>
                </select>
              </div>
            </div>
          </div>
          )}
        </div>
        )}

        {/* Per-Layout Background Settings */}
        <div className="border-t border-gray-300 pt-4">
          <h3 className={`text-lg font-semibold mb-4 ${isDarkTheme ? 'text-white' : 'text-gray-800'}`}>Background Settings (Per Layout)</h3>
          
          {/* Full Screen Background */}
          {layoutStyle === 1 && (
          <div className="border border-gray-200 rounded-lg p-4 bg-gray-50 mb-4">
            <label className={`block text-sm font-medium mb-3 ${isDarkTheme ? 'text-gray-700' : 'text-gray-700'}`}>
              Full Screen Layout
            </label>
            <div className="space-y-4">
              <div>
                <label className="block text-xs text-gray-600 mb-1">Background Type</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setBackgroundSettings(prev => ({
                      ...prev,
                      fullScreen: { ...prev.fullScreen, type: 'transparent' },
                    }))}
                    className={`flex-1 px-4 py-2 rounded-md border-2 transition-all font-medium text-sm ${
                      backgroundSettings.fullScreen?.type === 'transparent' || !backgroundSettings.fullScreen?.type
                        ? 'border-blue-600 bg-blue-50 text-blue-700 font-semibold'
                        : 'border-gray-300 hover:border-gray-400'
                    }`}
                  >
                    Transparent
                  </button>
                  <button
                    type="button"
                    onClick={() => setBackgroundSettings(prev => ({
                      ...prev,
                      fullScreen: { ...prev.fullScreen, type: 'color', color: prev.fullScreen?.color || '#000000' },
                    }))}
                    className={`flex-1 px-4 py-2 rounded-md border-2 transition-all font-medium text-sm ${
                      backgroundSettings.fullScreen?.type === 'color'
                        ? 'border-blue-600 bg-blue-50 text-blue-700 font-semibold'
                        : 'border-gray-300 hover:border-gray-400'
                    }`}
                  >
                    Color
                  </button>
                  <button
                    type="button"
                    onClick={() => setBackgroundSettings(prev => ({
                      ...prev,
                      fullScreen: { ...prev.fullScreen, type: 'image', imageUrl: prev.fullScreen?.imageUrl || '' },
                    }))}
                    className={`flex-1 px-4 py-2 rounded-md border-2 transition-all font-medium text-sm ${
                      backgroundSettings.fullScreen?.type === 'image'
                        ? 'border-blue-600 bg-blue-50 text-blue-700 font-semibold'
                        : 'border-gray-300 hover:border-gray-400'
                    }`}
                  >
                    Image
                  </button>
                </div>
              </div>
              {backgroundSettings.fullScreen?.type === 'color' && (
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Background Color</label>
                  <div className="flex gap-2">
                    <input
                      type="color"
                      value={backgroundSettings.fullScreen?.color || '#000000'}
                      onChange={(e) => setBackgroundSettings(prev => ({
                        ...prev,
                        fullScreen: { ...prev.fullScreen, color: e.target.value },
                      }))}
                      className="w-16 h-12 rounded border border-gray-300 cursor-pointer"
                    />
                    <input
                      type="text"
                      value={backgroundSettings.fullScreen?.color || '#000000'}
                      onChange={(e) => setBackgroundSettings(prev => ({
                        ...prev,
                        fullScreen: { ...prev.fullScreen, color: e.target.value },
                      }))}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm"
                      placeholder="#000000"
                    />
                  </div>
                </div>
              )}
              {backgroundSettings.fullScreen?.type === 'image' && (
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Image URL</label>
                  <input
                    type="url"
                    value={backgroundSettings.fullScreen?.imageUrl || ''}
                    onChange={(e) => setBackgroundSettings(prev => ({
                      ...prev,
                      fullScreen: { ...prev.fullScreen, imageUrl: e.target.value },
                    }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                    placeholder="https://example.com/image.jpg"
                  />
                  {backgroundSettings.fullScreen?.imageUrl && (
                    <div className="mt-2">
                      <img
                        src={backgroundSettings.fullScreen.imageUrl}
                        alt="Preview"
                        className="h-24 w-auto object-contain border border-gray-300 rounded"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
          )}

          {/* Lower Third Background */}
          {layoutStyle === 2 && (
          <div className="border border-gray-200 rounded-lg p-4 bg-gray-50 mb-4">
            <label className={`block text-sm font-medium mb-3 ${isDarkTheme ? 'text-gray-700' : 'text-gray-700'}`}>
              Lower Third Layout
            </label>
            <div className="space-y-4">
              <div>
                <label className="block text-xs text-gray-600 mb-1">Background Type</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setBackgroundSettings(prev => ({
                      ...prev,
                      lowerThird: { ...prev.lowerThird, type: 'transparent' },
                    }))}
                    className={`flex-1 px-4 py-2 rounded-md border-2 transition-all font-medium text-sm ${
                      backgroundSettings.lowerThird?.type === 'transparent' || !backgroundSettings.lowerThird?.type
                        ? 'border-blue-600 bg-blue-50 text-blue-700 font-semibold'
                        : 'border-gray-300 hover:border-gray-400'
                    }`}
                  >
                    Transparent
                  </button>
                  <button
                    type="button"
                    onClick={() => setBackgroundSettings(prev => ({
                      ...prev,
                      lowerThird: { ...prev.lowerThird, type: 'color', color: prev.lowerThird?.color || '#000000' },
                    }))}
                    className={`flex-1 px-4 py-2 rounded-md border-2 transition-all font-medium text-sm ${
                      backgroundSettings.lowerThird?.type === 'color'
                        ? 'border-blue-600 bg-blue-50 text-blue-700 font-semibold'
                        : 'border-gray-300 hover:border-gray-400'
                    }`}
                  >
                    Color
                  </button>
                  <button
                    type="button"
                    onClick={() => setBackgroundSettings(prev => ({
                      ...prev,
                      lowerThird: { ...prev.lowerThird, type: 'image', imageUrl: prev.lowerThird?.imageUrl || '' },
                    }))}
                    className={`flex-1 px-4 py-2 rounded-md border-2 transition-all font-medium text-sm ${
                      backgroundSettings.lowerThird?.type === 'image'
                        ? 'border-blue-600 bg-blue-50 text-blue-700 font-semibold'
                        : 'border-gray-300 hover:border-gray-400'
                    }`}
                  >
                    Image
                  </button>
                </div>
              </div>
              {backgroundSettings.lowerThird?.type === 'color' && (
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Background Color</label>
                  <div className="flex gap-2">
                    <input
                      type="color"
                      value={backgroundSettings.lowerThird?.color || '#000000'}
                      onChange={(e) => setBackgroundSettings(prev => ({
                        ...prev,
                        lowerThird: { ...prev.lowerThird, color: e.target.value },
                      }))}
                      className="w-16 h-12 rounded border border-gray-300 cursor-pointer"
                    />
                    <input
                      type="text"
                      value={backgroundSettings.lowerThird?.color || '#000000'}
                      onChange={(e) => setBackgroundSettings(prev => ({
                        ...prev,
                        lowerThird: { ...prev.lowerThird, color: e.target.value },
                      }))}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm"
                      placeholder="#000000"
                    />
                  </div>
                </div>
              )}
              {backgroundSettings.lowerThird?.type === 'image' && (
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Image URL</label>
                  <input
                    type="url"
                    value={backgroundSettings.lowerThird?.imageUrl || ''}
                    onChange={(e) => setBackgroundSettings(prev => ({
                      ...prev,
                      lowerThird: { ...prev.lowerThird, imageUrl: e.target.value },
                    }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                    placeholder="https://example.com/image.jpg"
                  />
                  {backgroundSettings.lowerThird?.imageUrl && (
                    <div className="mt-2">
                      <img
                        src={backgroundSettings.lowerThird.imageUrl}
                        alt="Preview"
                        className="h-24 w-auto object-contain border border-gray-300 rounded"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
          )}

          {/* PIP Background */}
          {layoutStyle === 3 && (
          <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
            <label className={`block text-sm font-medium mb-3 ${isDarkTheme ? 'text-gray-700' : 'text-gray-700'}`}>
              PIP Layout
            </label>
            <div className="space-y-4">
              <div>
                <label className="block text-xs text-gray-600 mb-1">Background Type</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setBackgroundSettings(prev => ({
                      ...prev,
                      pip: { ...prev.pip, type: 'transparent' },
                    }))}
                    className={`flex-1 px-4 py-2 rounded-md border-2 transition-all font-medium text-sm ${
                      backgroundSettings.pip?.type === 'transparent' || !backgroundSettings.pip?.type
                        ? 'border-blue-600 bg-blue-50 text-blue-700 font-semibold'
                        : 'border-gray-300 hover:border-gray-400'
                    }`}
                  >
                    Transparent
                  </button>
                  <button
                    type="button"
                    onClick={() => setBackgroundSettings(prev => ({
                      ...prev,
                      pip: { ...prev.pip, type: 'color', color: prev.pip?.color || '#000000' },
                    }))}
                    className={`flex-1 px-4 py-2 rounded-md border-2 transition-all font-medium text-sm ${
                      backgroundSettings.pip?.type === 'color'
                        ? 'border-blue-600 bg-blue-50 text-blue-700 font-semibold'
                        : 'border-gray-300 hover:border-gray-400'
                    }`}
                  >
                    Color
                  </button>
                  <button
                    type="button"
                    onClick={() => setBackgroundSettings(prev => ({
                      ...prev,
                      pip: { ...prev.pip, type: 'image', imageUrl: prev.pip?.imageUrl || '' },
                    }))}
                    className={`flex-1 px-4 py-2 rounded-md border-2 transition-all font-medium text-sm ${
                      backgroundSettings.pip?.type === 'image'
                        ? 'border-blue-600 bg-blue-50 text-blue-700 font-semibold'
                        : 'border-gray-300 hover:border-gray-400'
                    }`}
                  >
                    Image
                  </button>
                </div>
              </div>
              {backgroundSettings.pip?.type === 'color' && (
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Background Color</label>
                  <div className="flex gap-2">
                    <input
                      type="color"
                      value={backgroundSettings.pip?.color || '#000000'}
                      onChange={(e) => setBackgroundSettings(prev => ({
                        ...prev,
                        pip: { ...prev.pip, color: e.target.value },
                      }))}
                      className="w-16 h-12 rounded border border-gray-300 cursor-pointer"
                    />
                    <input
                      type="text"
                      value={backgroundSettings.pip?.color || '#000000'}
                      onChange={(e) => setBackgroundSettings(prev => ({
                        ...prev,
                        pip: { ...prev.pip, color: e.target.value },
                      }))}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm"
                      placeholder="#000000"
                    />
                  </div>
                </div>
              )}
              {backgroundSettings.pip?.type === 'image' && (
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Image URL</label>
                  <input
                    type="url"
                    value={backgroundSettings.pip?.imageUrl || ''}
                    onChange={(e) => setBackgroundSettings(prev => ({
                      ...prev,
                      pip: { ...prev.pip, imageUrl: e.target.value },
                    }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                    placeholder="https://example.com/image.jpg"
                  />
                  {backgroundSettings.pip?.imageUrl && (
                    <div className="mt-2">
                      <img
                        src={backgroundSettings.pip.imageUrl}
                        alt="Preview"
                        className="h-24 w-auto object-contain border border-gray-300 rounded"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
          )}

          {/* Split Screen Background */}
          {layoutStyle === 4 && (
          <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
            <label className={`block text-sm font-medium mb-3 ${isDarkTheme ? 'text-gray-700' : 'text-gray-700'}`}>
              Split Screen Layout
            </label>
            <div className="space-y-4">
              <div>
                <label className="block text-xs text-gray-600 mb-1">Background Type</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setBackgroundSettings(prev => ({
                      ...prev,
                      splitScreen: { ...prev.splitScreen, type: 'transparent' },
                    }))}
                    className={`flex-1 px-4 py-2 rounded-md border-2 transition-all font-medium text-sm ${
                      backgroundSettings.splitScreen?.type === 'transparent' || !backgroundSettings.splitScreen?.type
                        ? 'border-blue-600 bg-blue-50 text-blue-700 font-semibold'
                        : 'border-gray-300 hover:border-gray-400'
                    }`}
                  >
                    Transparent
                  </button>
                  <button
                    type="button"
                    onClick={() => setBackgroundSettings(prev => ({
                      ...prev,
                      splitScreen: { ...prev.splitScreen, type: 'color', color: prev.splitScreen?.color || '#000000' },
                    }))}
                    className={`flex-1 px-4 py-2 rounded-md border-2 transition-all font-medium text-sm ${
                      backgroundSettings.splitScreen?.type === 'color'
                        ? 'border-blue-600 bg-blue-50 text-blue-700 font-semibold'
                        : 'border-gray-300 hover:border-gray-400'
                    }`}
                  >
                    Color
                  </button>
                  <button
                    type="button"
                    onClick={() => setBackgroundSettings(prev => ({
                      ...prev,
                      splitScreen: { ...prev.splitScreen, type: 'image', imageUrl: prev.splitScreen?.imageUrl || '' },
                    }))}
                    className={`flex-1 px-4 py-2 rounded-md border-2 transition-all font-medium text-sm ${
                      backgroundSettings.splitScreen?.type === 'image'
                        ? 'border-blue-600 bg-blue-50 text-blue-700 font-semibold'
                        : 'border-gray-300 hover:border-gray-400'
                    }`}
                  >
                    Image
                  </button>
                </div>
              </div>
              {backgroundSettings.splitScreen?.type === 'color' && (
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Background Color</label>
                  <div className="flex gap-2">
                    <input
                      type="color"
                      value={backgroundSettings.splitScreen?.color || '#000000'}
                      onChange={(e) => setBackgroundSettings(prev => ({
                        ...prev,
                        splitScreen: { ...prev.splitScreen, color: e.target.value },
                      }))}
                      className="w-16 h-12 rounded border border-gray-300 cursor-pointer"
                    />
                    <input
                      type="text"
                      value={backgroundSettings.splitScreen?.color || '#000000'}
                      onChange={(e) => setBackgroundSettings(prev => ({
                        ...prev,
                        splitScreen: { ...prev.splitScreen, color: e.target.value },
                      }))}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm"
                      placeholder="#000000"
                    />
                  </div>
                </div>
              )}
              {backgroundSettings.splitScreen?.type === 'image' && (
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Image URL</label>
                  <input
                    type="url"
                    value={backgroundSettings.splitScreen?.imageUrl || ''}
                    onChange={(e) => setBackgroundSettings(prev => ({
                      ...prev,
                      splitScreen: { ...prev.splitScreen, imageUrl: e.target.value },
                    }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                    placeholder="https://example.com/image.jpg"
                  />
                  {backgroundSettings.splitScreen?.imageUrl && (
                    <div className="mt-2">
                      <img
                        src={backgroundSettings.splitScreen.imageUrl}
                        alt="Preview"
                        className="h-24 w-auto object-contain border border-gray-300 rounded"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
          )}
        </div>

        {/* Per-Layout Border Settings */}
        <div className="border-t border-gray-300 pt-4">
          <h3 className={`text-lg font-semibold mb-4 ${isDarkTheme ? 'text-white' : 'text-gray-800'}`}>Border Settings (Per Layout)</h3>
          
          {/* Full Screen Border Settings */}
          {layoutStyle === 1 && (
          <div className="border border-gray-200 rounded-lg p-4 bg-gray-50 mb-4">
            <label className={`block text-sm font-medium mb-3 ${isDarkTheme ? 'text-gray-700' : 'text-gray-700'}`}>
              Full Screen Layout
            </label>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-gray-600 mb-1">Border Thickness (px)</label>
                <input
                  type="number"
                  min="0"
                  max="20"
                  value={borderSettings.fullScreen?.thickness || 0}
                  onChange={(e) => {
                    const thickness = parseInt(e.target.value) || 0;
                    setBorderSettings(prev => ({
                      ...prev,
                      fullScreen: { ...prev.fullScreen, thickness },
                    }));
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                  placeholder="0"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">Border</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      // Border On - set thickness to default if not set, keep position as 'inner'
                      const currentThickness = borderSettings.fullScreen?.thickness;
                      setBorderSettings(prev => ({
                        ...prev,
                        fullScreen: { 
                          ...prev.fullScreen, 
                          thickness: currentThickness && currentThickness > 0 ? currentThickness : 2,
                          position: 'inner',
                        },
                      }));
                    }}
                    className={`flex-1 px-4 py-2 rounded-md border-2 transition-all font-medium text-sm ${
                      borderSettings.fullScreen?.thickness && borderSettings.fullScreen.thickness > 0
                        ? 'border-blue-600 bg-blue-50 text-blue-700 font-semibold'
                        : 'border-gray-300 hover:border-gray-400'
                    }`}
                  >
                    Border On
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      // Border Off - set thickness to 0
                      setBorderSettings(prev => ({
                        ...prev,
                        fullScreen: { ...prev.fullScreen, thickness: 0, position: 'inner' },
                      }));
                    }}
                    className={`flex-1 px-4 py-2 rounded-md border-2 transition-all font-medium text-sm ${
                      !borderSettings.fullScreen?.thickness || borderSettings.fullScreen.thickness === 0
                        ? 'border-blue-600 bg-blue-50 text-blue-700 font-semibold'
                        : 'border-gray-300 hover:border-gray-400'
                    }`}
                  >
                    Border Off
                  </button>
                </div>
              </div>
            </div>
            {/* Zoom Control */}
            <div className="mt-4">
              <label className="block text-xs text-gray-600 mb-1">Zoom ({borderSettings.fullScreen?.zoom ?? 100}%)</label>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min="70"
                  max="150"
                  step="1"
                  value={borderSettings.fullScreen?.zoom ?? 100}
                  onChange={(e) => {
                    const zoom = parseInt(e.target.value) || 100;
                    setBorderSettings(prev => ({
                      ...prev,
                      fullScreen: { ...prev.fullScreen, zoom },
                    }));
                  }}
                  className="flex-1"
                />
                <input
                  type="number"
                  min="70"
                  max="150"
                  value={borderSettings.fullScreen?.zoom ?? 100}
                  onChange={(e) => {
                    const zoom = Math.max(70, Math.min(150, parseInt(e.target.value) || 100));
                    setBorderSettings(prev => ({
                      ...prev,
                      fullScreen: { ...prev.fullScreen, zoom },
                    }));
                  }}
                  className="w-20 px-2 py-1 border border-gray-300 rounded-md text-sm"
                />
                <span className="text-xs text-gray-600">%</span>
              </div>
              <p className="text-xs text-gray-500 mt-1">Scale the Q&A content (70-150%)</p>
            </div>
            {/* Border Radius Control */}
            <div className="mt-4">
              <label className="block text-xs text-gray-600 mb-1">Border Radius ({borderRadius}px)</label>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min="0"
                  max="50"
                  step="1"
                  value={borderRadius}
                  onChange={(e) => setBorderRadius(parseInt(e.target.value) || 0)}
                  className="flex-1"
                />
                <input
                  type="number"
                  min="0"
                  max="50"
                  value={borderRadius}
                  onChange={(e) => {
                    const value = Math.max(0, Math.min(50, parseInt(e.target.value) || 0));
                    setBorderRadius(value);
                  }}
                  className="w-20 px-2 py-1 border border-gray-300 rounded-md text-sm"
                />
                <span className="text-xs text-gray-600">px</span>
              </div>
              <p className="text-xs text-gray-500 mt-1">0 = square, higher = more rounded</p>
            </div>
          </div>
          )}

          {/* Lower Third Border Settings */}
          {layoutStyle === 2 && (
          <div className="border border-gray-200 rounded-lg p-4 bg-gray-50 mb-4">
            <label className={`block text-sm font-medium mb-3 ${isDarkTheme ? 'text-gray-700' : 'text-gray-700'}`}>
              Lower Third Layout
            </label>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-gray-600 mb-1">Border Thickness (px)</label>
                <input
                  type="number"
                  min="0"
                  max="20"
                  value={borderSettings.lowerThird?.thickness || 0}
                  onChange={(e) => {
                    const thickness = parseInt(e.target.value) || 0;
                    setBorderSettings(prev => ({
                      ...prev,
                      lowerThird: { ...prev.lowerThird, thickness },
                    }));
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                  placeholder="0"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">Border</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const currentThickness = borderSettings.lowerThird?.thickness;
                      setBorderSettings(prev => ({
                        ...prev,
                        lowerThird: { 
                          ...prev.lowerThird, 
                          type: 'line', 
                          position: 'line',
                          thickness: currentThickness && currentThickness > 0 ? currentThickness : 3,
                        },
                      }));
                    }}
                    className={`flex-1 px-3 py-2 rounded-md border-2 transition-all font-medium text-xs ${
                      ((borderSettings.lowerThird as any)?.type === 'line' || borderSettings.lowerThird?.position === 'line' || (!(borderSettings.lowerThird as any)?.type && !borderSettings.lowerThird?.position && borderSettings.lowerThird?.thickness)) && borderSettings.lowerThird?.thickness && borderSettings.lowerThird.thickness > 0
                        ? 'border-blue-600 bg-blue-50 text-blue-700 font-semibold'
                        : 'border-gray-300 hover:border-gray-400'
                    }`}
                  >
                    Line On
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const currentThickness = borderSettings.lowerThird?.thickness;
                      setBorderSettings(prev => ({
                        ...prev,
                        lowerThird: { 
                          ...prev.lowerThird, 
                          type: 'boxEdge', 
                          position: 'inner', 
                          zoom: prev.lowerThird?.zoom || 100,
                          thickness: currentThickness && currentThickness > 0 ? currentThickness : 2,
                        },
                      }));
                    }}
                    className={`flex-1 px-3 py-2 rounded-md border-2 transition-all font-medium text-xs ${
                      ((borderSettings.lowerThird as any)?.type === 'boxEdge' || (borderSettings.lowerThird as any)?.type === 'boxInner' || (borderSettings.lowerThird as any)?.type === 'inner' || (borderSettings.lowerThird?.position === 'inner' && !(borderSettings.lowerThird as any)?.type)) && borderSettings.lowerThird?.thickness && borderSettings.lowerThird.thickness > 0
                        ? 'border-blue-600 bg-blue-50 text-blue-700 font-semibold'
                        : 'border-gray-300 hover:border-gray-400'
                    }`}
                  >
                    Box Edge On
                  </button>
                  <button
                    type="button"
                    onClick={() => setBorderSettings(prev => ({
                      ...prev,
                      lowerThird: { ...prev.lowerThird, thickness: 0 },
                    }))}
                    className={`flex-1 px-3 py-2 rounded-md border-2 transition-all font-medium text-xs ${
                      !borderSettings.lowerThird?.thickness || borderSettings.lowerThird.thickness === 0
                        ? 'border-blue-600 bg-blue-50 text-blue-700 font-semibold'
                        : 'border-gray-300 hover:border-gray-400'
                    }`}
                  >
                    Border Off
                  </button>
                </div>
              </div>
              {/* Zoom and Y Position Options - Only show when Box Edge is selected AND border is on */}
              {((borderSettings.lowerThird as any)?.type === 'boxEdge' || (borderSettings.lowerThird as any)?.type === 'boxInner' || (borderSettings.lowerThird as any)?.type === 'inner' || (borderSettings.lowerThird?.position === 'inner' && !(borderSettings.lowerThird as any)?.type)) && borderSettings.lowerThird?.thickness && borderSettings.lowerThird.thickness > 0 ? (
                <>
                  <div className="mt-4">
                    <label className={`block text-xs mb-1 ${isDarkTheme ? 'text-gray-600' : 'text-gray-600'}`}>Zoom ({borderSettings.lowerThird?.zoom || 100}%)</label>
                    <div className="flex items-center gap-3">
                      <input
                        type="range"
                        min="70"
                        max="110"
                        step="1"
                        value={borderSettings.lowerThird?.zoom || 100}
                        onChange={(e) => {
                          const zoom = parseInt(e.target.value);
                          setBorderSettings(prev => ({
                            ...prev,
                            lowerThird: { ...prev.lowerThird, zoom },
                          }));
                        }}
                        className="flex-1"
                      />
                      <input
                        type="number"
                        min="70"
                        max="110"
                        value={borderSettings.lowerThird?.zoom || 100}
                        onChange={(e) => {
                          const zoom = Math.max(70, Math.min(110, parseInt(e.target.value) || 100));
                          setBorderSettings(prev => ({
                            ...prev,
                            lowerThird: { ...prev.lowerThird, zoom },
                          }));
                        }}
                        className="w-20 px-2 py-1 border border-gray-300 rounded-md text-sm"
                      />
                    </div>
                  </div>
                  <div className="mt-4">
                    <label className={`block text-xs mb-1 ${isDarkTheme ? 'text-gray-600' : 'text-gray-600'}`}>Y Position ({borderSettings.lowerThird?.yPosition ?? 0}px)</label>
                    <div className="flex items-center gap-3">
                      <input
                        type="range"
                        min="-50"
                        max="50"
                        step="1"
                        value={borderSettings.lowerThird?.yPosition ?? 0}
                        onChange={(e) => {
                          const yPosition = parseInt(e.target.value) || 0; // Ensure 0 instead of NaN
                          setBorderSettings(prev => ({
                            ...prev,
                            lowerThird: { ...prev.lowerThird, yPosition },
                          }));
                        }}
                        className="flex-1"
                      />
                      <input
                        type="number"
                        min="-50"
                        max="50"
                        value={borderSettings.lowerThird?.yPosition || 0}
                        onChange={(e) => {
                          const yPosition = Math.max(-50, Math.min(50, parseInt(e.target.value) || 0));
                          setBorderSettings(prev => ({
                            ...prev,
                            lowerThird: { ...prev.lowerThird, yPosition },
                          }));
                        }}
                        className="w-20 px-2 py-1 border border-gray-300 rounded-md text-sm"
                      />
                    </div>
                    <p className={`text-xs mt-1 ${isDarkTheme ? 'text-gray-500' : 'text-gray-500'}`}>Positive values move down, negative values move up</p>
                  </div>
                </>
              ) : null}
            </div>
            {/* Border Radius Control */}
            <div className="mt-4">
              <label className="block text-xs text-gray-600 mb-1">Border Radius ({borderRadius}px)</label>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min="0"
                  max="50"
                  step="1"
                  value={borderRadius}
                  onChange={(e) => setBorderRadius(parseInt(e.target.value) || 0)}
                  className="flex-1"
                />
                <input
                  type="number"
                  min="0"
                  max="50"
                  value={borderRadius}
                  onChange={(e) => {
                    const value = Math.max(0, Math.min(50, parseInt(e.target.value) || 0));
                    setBorderRadius(value);
                  }}
                  className="w-20 px-2 py-1 border border-gray-300 rounded-md text-sm"
                />
                <span className="text-xs text-gray-600">px</span>
              </div>
              <p className="text-xs text-gray-500 mt-1">0 = square, higher = more rounded</p>
            </div>
          </div>
          )}

          {/* PIP Border Settings */}
          {layoutStyle === 3 && (
          <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
            <label className={`block text-sm font-medium mb-3 ${isDarkTheme ? 'text-gray-700' : 'text-gray-700'}`}>
              PIP Layout
            </label>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-gray-600 mb-1">Border Thickness (px)</label>
                <input
                  type="number"
                  min="0"
                  max="20"
                  value={borderSettings.pip?.thickness || 0}
                  onChange={(e) => {
                    const thickness = parseInt(e.target.value) || 0;
                    setBorderSettings(prev => ({
                      ...prev,
                      pip: { ...prev.pip, thickness },
                    }));
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                  placeholder="0"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">Border Position</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setBorderSettings(prev => ({
                      ...prev,
                      pip: { ...prev.pip, position: 'inner' },
                    }))}
                    className={`flex-1 px-4 py-2 rounded-md border-2 transition-all font-medium text-sm ${
                      borderSettings.pip?.position === 'inner' || (!borderSettings.pip?.position && borderSettings.pip?.thickness)
                        ? 'border-blue-600 bg-blue-50 text-blue-700 font-semibold'
                        : 'border-gray-300 hover:border-gray-400'
                    }`}
                  >
                    Inner
                  </button>
                  <button
                    type="button"
                    onClick={() => setBorderSettings(prev => ({
                      ...prev,
                      pip: { ...prev.pip, position: 'outer' },
                    }))}
                    className={`flex-1 px-4 py-2 rounded-md border-2 transition-all font-medium text-sm ${
                      borderSettings.pip?.position === 'outer'
                        ? 'border-blue-600 bg-blue-50 text-blue-700 font-semibold'
                        : 'border-gray-300 hover:border-gray-400'
                    }`}
                  >
                    Outer
                  </button>
                </div>
              </div>
            </div>
            {/* Zoom and Position Options for PIP */}
            <div className="mt-4 space-y-4">
              <div>
                <label className="block text-xs text-gray-600 mb-1">Zoom ({borderSettings.pip?.zoom ?? 100}%)</label>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min="70"
                    max="150"
                    step="1"
                    value={borderSettings.pip?.zoom ?? 100}
                    onChange={(e) => {
                      const zoom = parseInt(e.target.value) || 100;
                      setBorderSettings(prev => ({
                        ...prev,
                        pip: { ...prev.pip, zoom },
                      }));
                    }}
                    className="flex-1"
                  />
                  <input
                    type="number"
                    min="70"
                    max="150"
                    value={borderSettings.pip?.zoom ?? 100}
                    onChange={(e) => {
                      const zoom = Math.max(70, Math.min(150, parseInt(e.target.value) || 100));
                      setBorderSettings(prev => ({
                        ...prev,
                        pip: { ...prev.pip, zoom },
                      }));
                    }}
                    className="w-20 px-2 py-1 border border-gray-300 rounded-md text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">X Position ({borderSettings.pip?.xPosition ?? 0}px)</label>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min="-100"
                    max="100"
                    step="1"
                    value={borderSettings.pip?.xPosition ?? 0}
                    onChange={(e) => {
                      const xPosition = parseInt(e.target.value) || 0;
                      setBorderSettings(prev => ({
                        ...prev,
                        pip: { ...prev.pip, xPosition },
                      }));
                    }}
                    className="flex-1"
                  />
                  <input
                    type="number"
                    min="-100"
                    max="100"
                    value={borderSettings.pip?.xPosition ?? 0}
                    onChange={(e) => {
                      const xPosition = Math.max(-100, Math.min(100, parseInt(e.target.value) || 0));
                      setBorderSettings(prev => ({
                        ...prev,
                        pip: { ...prev.pip, xPosition },
                      }));
                    }}
                    className="w-20 px-2 py-1 border border-gray-300 rounded-md text-sm"
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">Positive values move right, negative values move left</p>
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">Y Position ({borderSettings.pip?.yPosition ?? 0}px)</label>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min="-100"
                    max="100"
                    step="1"
                    value={borderSettings.pip?.yPosition ?? 0}
                    onChange={(e) => {
                      const yPosition = parseInt(e.target.value) || 0;
                      setBorderSettings(prev => ({
                        ...prev,
                        pip: { ...prev.pip, yPosition },
                      }));
                    }}
                    className="flex-1"
                  />
                  <input
                    type="number"
                    min="-100"
                    max="100"
                    value={borderSettings.pip?.yPosition ?? 0}
                    onChange={(e) => {
                      const yPosition = Math.max(-100, Math.min(100, parseInt(e.target.value) || 0));
                      setBorderSettings(prev => ({
                        ...prev,
                        pip: { ...prev.pip, yPosition },
                      }));
                    }}
                    className="w-20 px-2 py-1 border border-gray-300 rounded-md text-sm"
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">Positive values move down, negative values move up</p>
              </div>
            </div>
            {/* Border Radius Control */}
            <div className="mt-4">
              <label className="block text-xs text-gray-600 mb-1">Border Radius ({borderRadius}px)</label>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min="0"
                  max="50"
                  step="1"
                  value={borderRadius}
                  onChange={(e) => setBorderRadius(parseInt(e.target.value) || 0)}
                  className="flex-1"
                />
                <input
                  type="number"
                  min="0"
                  max="50"
                  value={borderRadius}
                  onChange={(e) => {
                    const value = Math.max(0, Math.min(50, parseInt(e.target.value) || 0));
                    setBorderRadius(value);
                  }}
                  className="w-20 px-2 py-1 border border-gray-300 rounded-md text-sm"
                />
                <span className="text-xs text-gray-600">px</span>
              </div>
              <p className="text-xs text-gray-500 mt-1">0 = square, higher = more rounded</p>
            </div>
          </div>
          )}

          {/* Split Screen Border Settings */}
          {layoutStyle === 4 && (
          <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
            <label className={`block text-sm font-medium mb-3 ${isDarkTheme ? 'text-gray-700' : 'text-gray-700'}`}>
              Split Screen Layout
            </label>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-gray-600 mb-1">Border Thickness (px)</label>
                <input
                  type="number"
                  min="0"
                  max="20"
                  value={borderSettings.splitScreen?.thickness || 0}
                  onChange={(e) => {
                    const thickness = parseInt(e.target.value) || 0;
                    setBorderSettings(prev => ({
                      ...prev,
                      splitScreen: { ...prev.splitScreen, thickness },
                    }));
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                  placeholder="0"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">Border</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const currentThickness = borderSettings.splitScreen?.thickness;
                      setBorderSettings(prev => ({
                        ...prev,
                        splitScreen: { 
                          ...prev.splitScreen, 
                          type: 'line', 
                          position: 'line',
                          thickness: currentThickness && currentThickness > 0 ? currentThickness : 3,
                        },
                      }));
                    }}
                    className={`flex-1 px-3 py-2 rounded-md border-2 transition-all font-medium text-xs ${
                      ((borderSettings.splitScreen as any)?.type === 'line' || borderSettings.splitScreen?.position === 'line' || (!(borderSettings.splitScreen as any)?.type && !borderSettings.splitScreen?.position && borderSettings.splitScreen?.thickness)) && borderSettings.splitScreen?.thickness && borderSettings.splitScreen.thickness > 0
                        ? 'border-blue-600 bg-blue-50 text-blue-700 font-semibold'
                        : 'border-gray-300 hover:border-gray-400'
                    }`}
                  >
                    Line On
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const currentThickness = borderSettings.splitScreen?.thickness;
                      setBorderSettings(prev => ({
                        ...prev,
                        splitScreen: { 
                          ...prev.splitScreen, 
                          type: 'boxEdge', 
                          position: 'inner', 
                          zoom: prev.splitScreen?.zoom || 100,
                          thickness: currentThickness && currentThickness > 0 ? currentThickness : 2,
                        },
                      }));
                    }}
                    className={`flex-1 px-3 py-2 rounded-md border-2 transition-all font-medium text-xs ${
                      ((borderSettings.splitScreen as any)?.type === 'boxEdge' || (borderSettings.splitScreen as any)?.type === 'boxInner' || (borderSettings.splitScreen as any)?.type === 'inner' || (borderSettings.splitScreen?.position === 'inner' && !(borderSettings.splitScreen as any)?.type)) && borderSettings.splitScreen?.thickness && borderSettings.splitScreen.thickness > 0
                        ? 'border-blue-600 bg-blue-50 text-blue-700 font-semibold'
                        : 'border-gray-300 hover:border-gray-400'
                    }`}
                  >
                    Box Edge On
                  </button>
                  <button
                    type="button"
                    onClick={() => setBorderSettings(prev => ({
                      ...prev,
                      splitScreen: { ...prev.splitScreen, thickness: 0 },
                    }))}
                    className={`flex-1 px-3 py-2 rounded-md border-2 transition-all font-medium text-xs ${
                      !borderSettings.splitScreen?.thickness || borderSettings.splitScreen.thickness === 0
                        ? 'border-blue-600 bg-blue-50 text-blue-700 font-semibold'
                        : 'border-gray-300 hover:border-gray-400'
                    }`}
                  >
                    Border Off
                  </button>
                </div>
              </div>
            </div>
            {/* Zoom and Position Options for Split Screen */}
            <div className="mt-4 space-y-4">
              <div>
                <label className="block text-xs text-gray-600 mb-1">Zoom ({borderSettings.splitScreen?.zoom ?? 100}%)</label>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min="70"
                    max="150"
                    step="1"
                    value={borderSettings.splitScreen?.zoom ?? 100}
                    onChange={(e) => {
                      const zoom = parseInt(e.target.value) || 100;
                      setBorderSettings(prev => ({
                        ...prev,
                        splitScreen: { ...prev.splitScreen, zoom },
                      }));
                    }}
                    className="flex-1"
                  />
                  <input
                    type="number"
                    min="70"
                    max="150"
                    value={borderSettings.splitScreen?.zoom ?? 100}
                    onChange={(e) => {
                      const zoom = Math.max(70, Math.min(150, parseInt(e.target.value) || 100));
                      setBorderSettings(prev => ({
                        ...prev,
                        splitScreen: { ...prev.splitScreen, zoom },
                      }));
                    }}
                    className="w-20 px-2 py-1 border border-gray-300 rounded-md text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">X Position ({borderSettings.splitScreen?.xPosition ?? 0}px)</label>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min="-100"
                    max="100"
                    step="1"
                    value={borderSettings.splitScreen?.xPosition ?? 0}
                    onChange={(e) => {
                      const xPosition = parseInt(e.target.value) || 0;
                      setBorderSettings(prev => ({
                        ...prev,
                        splitScreen: { ...prev.splitScreen, xPosition },
                      }));
                    }}
                    className="flex-1"
                  />
                  <input
                    type="number"
                    min="-100"
                    max="100"
                    value={borderSettings.splitScreen?.xPosition ?? 0}
                    onChange={(e) => {
                      const xPosition = Math.max(-100, Math.min(100, parseInt(e.target.value) || 0));
                      setBorderSettings(prev => ({
                        ...prev,
                        splitScreen: { ...prev.splitScreen, xPosition },
                      }));
                    }}
                    className="w-20 px-2 py-1 border border-gray-300 rounded-md text-sm"
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">Positive values move right, negative values move left</p>
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">Y Position ({borderSettings.splitScreen?.yPosition ?? 0}px)</label>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min="-100"
                    max="100"
                    step="1"
                    value={borderSettings.splitScreen?.yPosition ?? 0}
                    onChange={(e) => {
                      const yPosition = parseInt(e.target.value) || 0;
                      setBorderSettings(prev => ({
                        ...prev,
                        splitScreen: { ...prev.splitScreen, yPosition },
                      }));
                    }}
                    className="flex-1"
                  />
                  <input
                    type="number"
                    min="-100"
                    max="100"
                    value={borderSettings.splitScreen?.yPosition ?? 0}
                    onChange={(e) => {
                      const yPosition = Math.max(-100, Math.min(100, parseInt(e.target.value) || 0));
                      setBorderSettings(prev => ({
                        ...prev,
                        splitScreen: { ...prev.splitScreen, yPosition },
                      }));
                    }}
                    className="w-20 px-2 py-1 border border-gray-300 rounded-md text-sm"
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">Positive values move down, negative values move up</p>
              </div>
            </div>
            {/* Border Radius Control */}
            <div className="mt-4">
              <label className="block text-xs text-gray-600 mb-1">Border Radius ({borderRadius}px)</label>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min="0"
                  max="50"
                  step="1"
                  value={borderRadius}
                  onChange={(e) => setBorderRadius(parseInt(e.target.value) || 0)}
                  className="flex-1"
                />
                <input
                  type="number"
                  min="0"
                  max="50"
                  value={borderRadius}
                  onChange={(e) => {
                    const value = Math.max(0, Math.min(50, parseInt(e.target.value) || 0));
                    setBorderRadius(value);
                  }}
                  className="w-20 px-2 py-1 border border-gray-300 rounded-md text-sm"
                />
                <span className="text-xs text-gray-600">px</span>
              </div>
              <p className="text-xs text-gray-500 mt-1">0 = square, higher = more rounded</p>
            </div>
          </div>
          )}
        </div>

        {/* Preview Toggle */}
        <div className="border-t border-gray-300 pt-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className={`text-lg font-semibold ${isDarkTheme ? 'text-white' : 'text-gray-800'}`}>Preview</h3>
            <button
              type="button"
              onClick={() => setShowPreview(!showPreview)}
              className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors text-sm"
            >
              {showPreview ? 'Hide Preview' : 'Show Preview'}
            </button>
          </div>
          
          {showPreview && (
            <div className="bg-black rounded-lg overflow-hidden" style={{ aspectRatio: '16/9' }}>
              {layoutStyle === 1 ? (
                /* Full Screen Layout - matches FullscreenOutputPage */
                <div className="relative w-full h-full" style={{ width: '100%', height: '100%' }}>
                  <div
                    className="absolute inset-0 flex items-center justify-center"
                    style={{
                      ...(Object.keys(backgroundSettings.fullScreen || {}).length > 0 && backgroundSettings.fullScreen?.type !== 'transparent' ? (
                        backgroundSettings.fullScreen?.type === 'color' && backgroundSettings.fullScreen?.color
                          ? { background: backgroundSettings.fullScreen.color }
                          : backgroundSettings.fullScreen?.type === 'image' && backgroundSettings.fullScreen?.imageUrl
                          ? {
                              backgroundImage: `url(${backgroundSettings.fullScreen.imageUrl})`,
                              backgroundSize: 'cover',
                              backgroundPosition: 'center',
                              backgroundRepeat: 'no-repeat',
                            }
                          : {}
                      ) : {}),
                      ...(() => {
                        const border = borderSettings.fullScreen;
                        if (border?.thickness && border.thickness > 0) {
                          const position = border.position || 'outer';
                          if (position === 'inner') {
                            return { boxShadow: `inset 0 0 0 ${border.thickness}px ${primaryColor}` };
                          } else {
                            return { boxShadow: `0 0 0 ${border.thickness}px ${primaryColor}` };
                          }
                        }
                        return {};
                      })(),
                      ...(borderSettings.fullScreen?.zoom && borderSettings.fullScreen.zoom !== 100 ? {
                        transform: `scale(${borderSettings.fullScreen.zoom / 100})`,
                        transformOrigin: 'center center',
                      } : {}),
                      borderRadius: `${borderRadius}px`,
                    }}
                  >
                    <QADisplay qa={{ ...previewQA, layoutStyle: 1 }} disableBackground={true} />
                  </div>
                </div>
              ) : layoutStyle === 2 ? (
                /* Lower Third Layout - matches FullscreenOutputPage */
                <div className="relative w-full h-full" style={{ width: '100%', height: '100%' }}>
                  {(() => {
                    const border = borderSettings.lowerThird;
                    const borderType = (border as any)?.type || border?.position || 'line';
                    const hasBoxEdge = borderType === 'boxEdge' || borderType === 'boxInner' || borderType === 'inner';
                    const zoomPercent = (hasBoxEdge && border?.zoom !== undefined) ? border.zoom : 100;
                    const zoomScale = zoomPercent / 100;
                    const shouldZoom = hasBoxEdge && zoomPercent !== 100;
                    
                    return (
                      <div
                        className="absolute bottom-0 left-0 right-0"
                        style={{
                          height: '33.33%', // 1/3 of the height
                          ...(Object.keys(backgroundSettings.lowerThird || {}).length > 0 && backgroundSettings.lowerThird?.type !== 'transparent' ? (
                            backgroundSettings.lowerThird?.type === 'color' && backgroundSettings.lowerThird?.color
                              ? { background: backgroundSettings.lowerThird.color }
                              : backgroundSettings.lowerThird?.type === 'image' && backgroundSettings.lowerThird?.imageUrl
                              ? {
                                  backgroundImage: `url(${backgroundSettings.lowerThird.imageUrl})`,
                                  backgroundSize: 'cover',
                                  backgroundPosition: 'center',
                                  backgroundRepeat: 'no-repeat',
                                }
                              : {}
                          ) : {
                              background: 'linear-gradient(to top, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.85) 100%)',
                            }),
                          ...(() => {
                            if (border?.thickness && border.thickness > 0) {
                              const position = border.position || 'outer';
                              if (borderType === 'boxEdge' || borderType === 'boxInner' || borderType === 'inner') {
                                // Box Edge - full border box inset 10px from edges
                                const visibleThickness = Math.max(border.thickness, 1);
                                const isAt100PercentOrAbove = zoomPercent >= 100;
                                return {
                                  margin: isAt100PercentOrAbove ? '0' : '10px',
                                  borderTop: `${visibleThickness}px solid ${primaryColor}`,
                                  borderRight: `${visibleThickness}px solid ${primaryColor}`,
                                  borderBottom: `${visibleThickness}px solid ${primaryColor}`,
                                  borderLeft: `${visibleThickness}px solid ${primaryColor}`,
                                  boxSizing: 'border-box' as const,
                                  outline: 'none',
                                };
                              } else if (borderType === 'line') {
                                // Top border only (line) - use box-shadow instead of border to avoid affecting layout
                                return { 
                                  boxShadow: `0 -${border.thickness}px 0 0 ${primaryColor}`,
                                };
                              } else if (position === 'inner') {
                                return { boxShadow: `inset 0 0 0 ${border.thickness}px ${primaryColor}` };
                              } else {
                                return { boxShadow: `0 0 0 ${border.thickness}px ${primaryColor}` };
                              }
                            }
                            return {};
                          })(),
                          backdropFilter: 'blur(8px)',
                          // Only show default border if no border settings at all - use box-shadow so it doesn't affect layout
                          ...(Object.keys(borderSettings.lowerThird || {}).length === 0 ? { boxShadow: `0 -3px 0 0 ${primaryColor}` } : {}),
                          borderRadius: `${borderRadius}px`,
                          ...(shouldZoom ? {
                            transform: `scale(${zoomScale})`,
                            transformOrigin: 'center center',
                          } : {}),
                        }}
                      >
                        <div className="p-6">
                          <QADisplay qa={{ ...previewQA, layoutStyle: 2 }} disableBackground={true} />
                        </div>
                      </div>
                    );
                  })()}
                </div>
              ) : layoutStyle === 3 ? (
                /* PIP Layout - matches FullscreenOutputPage */
                <div className="relative w-full h-full" style={{ width: '100%', height: '100%' }}>
                  <div
                    className={`absolute top-6 ${splitScreenPosition === 'left' ? 'left-6' : 'right-6'} w-96 max-w-[35vw]`}
                    style={{
                      ...(Object.keys(backgroundSettings.pip || {}).length > 0 && backgroundSettings.pip?.type !== 'transparent' ? (
                        backgroundSettings.pip?.type === 'color' && backgroundSettings.pip?.color
                          ? { background: backgroundSettings.pip.color }
                          : backgroundSettings.pip?.type === 'image' && backgroundSettings.pip?.imageUrl
                          ? {
                              backgroundImage: `url(${backgroundSettings.pip.imageUrl})`,
                              backgroundSize: 'cover',
                              backgroundPosition: 'center',
                              backgroundRepeat: 'no-repeat',
                            }
                          : {}
                      ) : {
                          background: 'rgba(0,0,0,0.95)',
                        }),
                      ...(() => {
                        const border = borderSettings.pip;
                        if (border?.thickness && border.thickness > 0) {
                          return { border: `${border.thickness}px solid ${primaryColor}` };
                        }
                        return {};
                      })(),
                      ...(borderSettings.pip?.zoom && borderSettings.pip.zoom !== 100 ? {
                        transform: `scale(${borderSettings.pip.zoom / 100})`,
                        transformOrigin: splitScreenPosition === 'left' ? 'left top' : 'right top',
                      } : {}),
                      backdropFilter: 'blur(8px)',
                      border: Object.keys(borderSettings.pip || {}).length === 0 || !borderSettings.pip?.thickness ? `2px solid ${primaryColor}` : undefined,
                      borderRadius: `${borderRadius}px`,
                      maxHeight: '70vh',
                      overflowY: 'auto',
                    }}
                  >
                    <div className="p-4">
                      <QADisplay qa={{ ...previewQA, layoutStyle: 3, splitScreenPosition }} disableBackground={true} />
                    </div>
                  </div>
                </div>
              ) : (
                /* Split Screen Layout - Left/Right split */
                <div className="relative w-full h-full" style={{ width: '100%', height: '100%' }}>
                  <div
                    className={`absolute h-full ${splitScreenSide === 'left' ? 'left-0' : 'right-0'}`}
                    style={{
                      width: splitScreenWidth === 'half' ? '50%' : '33.33%',
                      ...(Object.keys(backgroundSettings.splitScreen || {}).length > 0 && backgroundSettings.splitScreen?.type !== 'transparent' ? (
                        backgroundSettings.splitScreen?.type === 'color' && backgroundSettings.splitScreen?.color
                          ? { background: backgroundSettings.splitScreen.color }
                          : backgroundSettings.splitScreen?.type === 'image' && backgroundSettings.splitScreen?.imageUrl
                          ? {
                              backgroundImage: `url(${backgroundSettings.splitScreen.imageUrl})`,
                              backgroundSize: 'cover',
                              backgroundPosition: 'center',
                              backgroundRepeat: 'no-repeat',
                            }
                          : {}
                      ) : {
                          background: 'rgba(0,0,0,0.95)',
                        }),
                      ...(() => {
                        const border = borderSettings.splitScreen;
                        if (border?.thickness && border.thickness > 0) {
                          const position = border.position || 'outer';
                          if (position === 'inner') {
                            return { boxShadow: `inset 0 0 0 ${border.thickness}px ${primaryColor}` };
                          } else {
                            return { boxShadow: `0 0 0 ${border.thickness}px ${primaryColor}` };
                          }
                        }
                        return {};
                      })(),
                      backdropFilter: 'blur(8px)',
                      borderRadius: `${borderRadius}px`,
                      ...(borderSettings.splitScreen?.zoom && borderSettings.splitScreen.zoom !== 100 ? {
                        transform: `scale(${borderSettings.splitScreen.zoom / 100})`,
                        transformOrigin: splitScreenSide === 'left' ? 'left center' : 'right center',
                      } : {}),
                    }}
                  >
                    <div className="p-4">
                      <QADisplay qa={{ ...previewQA, layoutStyle: 4, splitScreenSide, splitScreenWidth }} disableBackground={true} />
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Submit Buttons */}
        <div className="flex gap-3 pt-4 border-t border-gray-300">
          <button
            type="submit"
            disabled={loading}
            className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium"
          >
            {loading ? 'Saving...' : qa ? 'Update Q&A Session' : 'Create Q&A Session'}
          </button>
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
