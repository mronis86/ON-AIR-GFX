import { useState, useEffect, type FormEvent } from 'react';
import { createPoll, updatePoll } from '../services/firestore';
import { PollType, PollDisplayType, type Poll, type PollOption } from '../types';
import PollDisplay from './PollDisplay';

interface PollFormEnhancedProps {
  eventId: string;
  poll?: Poll; // If provided, we're editing; otherwise creating
  onSuccess?: () => void;
  onCancel?: () => void;
}

const POLL_TYPE_OPTIONS = [
  { value: PollType.SINGLE_CHOICE, label: 'Single Choice' },
  { value: PollType.MULTIPLE_CHOICE, label: 'Multiple Choice' },
  { value: PollType.RATING_SCALE, label: 'Rating Scale' },
  { value: PollType.YES_NO, label: 'Yes/No' },
];

// Layout style labels for bars - only 3 options
const BARS_LAYOUT_LABELS = ['Full Screen', 'Lower Third', 'PIP'];

const MAX_OPTIONS = 6;

export default function PollFormEnhanced({ eventId, poll, onSuccess, onCancel }: PollFormEnhancedProps) {
  const isEditMode = !!poll;
  
  const [type, setType] = useState<PollType>(poll?.type || PollType.SINGLE_CHOICE);
  const [title, setTitle] = useState(poll?.title || '');
  const [options, setOptions] = useState<Array<{ id: string; text: string; imageUrl?: string }>>(
    poll?.options.map(opt => ({ id: opt.id, text: opt.text, imageUrl: opt.imageUrl })) || [
      { id: '1', text: '' },
      { id: '2', text: '' },
    ]
  );
  // Always use bars display type
  const displayType = PollDisplayType.BARS;
  const [layoutStyle, setLayoutStyle] = useState<number>(poll?.layoutStyle || 1);
  const [fullScreenStyle, setFullScreenStyle] = useState<'horizontal' | 'vertical'>(poll?.fullScreenStyle || 'horizontal');
  const [barEdgeStyle, setBarEdgeStyle] = useState<'square' | 'beveled' | 'rounded'>(poll?.barEdgeStyle || 'rounded');
  const [borderRadius, setBorderRadius] = useState<number>(poll?.borderRadius ?? 0);
  const [pipPosition, setPipPosition] = useState<'left' | 'right'>(poll?.pipPosition || 'right');
  const [primaryColor, setPrimaryColor] = useState(poll?.primaryColor || '#3B82F6');
  const [secondaryColor, setSecondaryColor] = useState(poll?.secondaryColor || '#60A5FA');
  const [emptyBarColor, setEmptyBarColor] = useState(poll?.emptyBarColor || 'rgba(255, 255, 255, 0.7)');
  const [showTitle, setShowTitle] = useState(poll?.showTitle !== false); // Default true
  const [showVoteCount, setShowVoteCount] = useState(poll?.showVoteCount !== false); // Default true
  // Per-layout title settings
  const [titleSettings, setTitleSettings] = useState<{
    fullScreen?: { fontSize?: number; yPosition?: number; justification?: 'left' | 'center' | 'right' };
    lowerThird?: { fontSize?: number; yPosition?: number; justification?: 'left' | 'center' | 'right' };
    pip?: { fontSize?: number; yPosition?: number; justification?: 'left' | 'center' | 'right' };
  }>(poll?.titleSettings || {});
  // Per-layout background settings
  const [backgroundSettings, setBackgroundSettings] = useState<{
    fullScreen?: { type?: 'color' | 'transparent' | 'image'; color?: string; imageUrl?: string };
    lowerThird?: { type?: 'color' | 'transparent' | 'image'; color?: string; imageUrl?: string };
    pip?: { type?: 'color' | 'transparent' | 'image'; color?: string; imageUrl?: string };
  }>(poll?.backgroundSettings || {});
  // Per-layout border settings
  const [borderSettings, setBorderSettings] = useState<{
    fullScreen?: { thickness?: number; position?: 'inner' | 'outer'; zoom?: number };
    lowerThird?: { thickness?: number; position?: 'inner' | 'outer' | 'line'; type?: 'line' | 'boxEdge'; zoom?: number; yPosition?: number };
    pip?: { thickness?: number; position?: 'inner' | 'outer'; zoom?: number; xPosition?: number; yPosition?: number };
  }>(poll?.borderSettings || {});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  // Update form state when poll prop changes (for editing)
  useEffect(() => {
    if (poll && isEditMode) {
      setType(poll.type || PollType.SINGLE_CHOICE);
      setTitle(poll.title || '');
      setOptions(poll.options.map(opt => ({ id: opt.id, text: opt.text, imageUrl: opt.imageUrl })) || []);
      setLayoutStyle(poll.layoutStyle || 1);
      setFullScreenStyle(poll.fullScreenStyle || 'horizontal');
      setBarEdgeStyle(poll.barEdgeStyle || 'rounded');
      setBorderRadius(poll.borderRadius ?? 0);
      setPipPosition(poll.pipPosition || 'right');
      setPrimaryColor(poll.primaryColor || '#3B82F6');
      setSecondaryColor(poll.secondaryColor || '#60A5FA');
      setEmptyBarColor(poll.emptyBarColor || 'rgba(255, 255, 255, 0.7)');
      setShowTitle(poll.showTitle !== false);
      setShowVoteCount(poll.showVoteCount !== false);
      setTitleSettings(poll.titleSettings || {});
      setBackgroundSettings(poll.backgroundSettings || {});
      setBorderSettings(poll.borderSettings || {});
    }
  }, [poll, isEditMode]);

  const addOption = () => {
    if (options.length < MAX_OPTIONS) {
      setOptions([...options, { id: Date.now().toString(), text: '', imageUrl: '' }]);
    }
  };

  const removeOption = (id: string) => {
    if (options.length > 2) {
      setOptions(options.filter((opt) => opt.id !== id));
    }
  };

  const updateOption = (id: string, field: 'text' | 'imageUrl', value: string) => {
    setOptions(options.map((opt) => (opt.id === id ? { ...opt, [field]: value } : opt)));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      // Filter out empty options
      const validOptions = options
        .filter((opt) => opt.text.trim() !== '')
        .map((opt) => ({
          id: opt.id,
          text: opt.text.trim(),
          imageUrl: opt.imageUrl?.trim() || undefined,
        }));

      if (validOptions.length < 2) {
        setError('Please provide at least 2 options for the poll.');
        setLoading(false);
        return;
      }

      if (isEditMode && poll) {
        // Update existing poll - preserve votes and imageUrl for existing options
        const updatedOptions = validOptions.map(opt => {
          const existingOption = poll.options.find(o => o.id === opt.id);
          const optionData: any = {
            id: opt.id,
            text: opt.text.trim(),
            votes: existingOption?.votes || 0,
          };
          // Only include imageUrl if it exists (not undefined, not empty string)
          const imageUrl = opt.imageUrl?.trim() || existingOption?.imageUrl?.trim();
          if (imageUrl) {
            optionData.imageUrl = imageUrl;
          }
          return optionData;
        });
        
        // Prepare update object - explicitly handle conditional fields
        const updateData: any = {
          type,
          title: title.trim(),
          options: updatedOptions,
          displayType,
          layoutStyle,
          barEdgeStyle,
          borderRadius,
          primaryColor,
          secondaryColor,
          emptyBarColor,
          showTitle,
          showVoteCount,
        };
        
        // Only include fullScreenStyle if layout is Full Screen (1)
        // If switching away from Full Screen, we'll delete it in updatePoll
        if (layoutStyle === 1) {
          updateData.fullScreenStyle = fullScreenStyle;
        }
        
        // Only include pipPosition if layout is PIP (3)
        // If switching away from PIP, we'll delete it in updatePoll
        if (layoutStyle === 3) {
          updateData.pipPosition = pipPosition;
        }
        
        // Include titleSettings if it has any values
        if (Object.keys(titleSettings).length > 0) {
          updateData.titleSettings = titleSettings;
        }
        
        // Include backgroundSettings if it has any values
        if (Object.keys(backgroundSettings).length > 0) {
          updateData.backgroundSettings = backgroundSettings;
        }
        
        // Include borderSettings if it has any values
        if (Object.keys(borderSettings).length > 0) {
          updateData.borderSettings = borderSettings;
        }
        
        await updatePoll(poll.id, updateData);
        
        // Show success message
        alert('Poll saved successfully!');
      } else {
        // Create new poll - clean options to remove undefined imageUrl
        const cleanOptions = validOptions.map(opt => {
          const optionData: any = {
            id: opt.id,
            text: opt.text.trim(),
          };
          if (opt.imageUrl?.trim()) {
            optionData.imageUrl = opt.imageUrl.trim();
          }
          return optionData;
        });
        
        await createPoll({
          eventId,
          type,
          title: title.trim(),
          options: cleanOptions,
          displayType,
          layoutStyle,
          fullScreenStyle: layoutStyle === 1 ? fullScreenStyle : undefined,
          barEdgeStyle,
          borderRadius,
          pipPosition: layoutStyle === 3 ? pipPosition : undefined,
          primaryColor,
          secondaryColor,
          emptyBarColor,
          showTitle,
          showVoteCount,
          titleSettings: Object.keys(titleSettings).length > 0 ? titleSettings : undefined,
          backgroundSettings: Object.keys(backgroundSettings).length > 0 ? backgroundSettings : undefined,
          borderSettings: Object.keys(borderSettings).length > 0 ? borderSettings : undefined,
        });
        
        // Show success message
        alert('Poll created successfully!');
      }

      if (onSuccess) {
        onSuccess();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save poll');
    } finally {
      setLoading(false);
    }
  };

  // Create preview poll object
  const previewPoll: Poll = {
    id: 'preview',
    eventId,
    type,
    title: title || 'Poll Title',
    options: options
      .filter(opt => opt.text.trim())
      .map((opt, idx) => ({
        id: opt.id,
        text: opt.text || `Option ${idx + 1}`,
        votes: Math.floor(Math.random() * 100) + 10, // Random votes for preview
        imageUrl: opt.imageUrl,
      })),
    isActive: false,
    displayType,
    layoutStyle,
    fullScreenStyle: layoutStyle === 1 ? fullScreenStyle : undefined,
    borderRadius,
    pipPosition: layoutStyle === 3 ? pipPosition : undefined,
    primaryColor,
    secondaryColor,
    emptyBarColor,
    showTitle,
    showVoteCount,
    titleSettings,
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
        {isEditMode ? 'Edit Poll' : 'Create New Poll'}
      </h2>

      {error && (
        <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Info */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="poll-type" className="block text-sm font-medium text-gray-700 mb-1">
              Poll Type *
            </label>
            <select
              id="poll-type"
              value={type}
              onChange={(e) => setType(e.target.value as PollType)}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {POLL_TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

              <div className="flex items-end gap-4">
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
                    checked={showVoteCount}
                    onChange={(e) => setShowVoteCount(e.target.checked)}
                    className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                  />
                  <span className={`text-sm font-medium ${isDarkTheme ? 'text-gray-300' : 'text-gray-700'}`}>Show Votes</span>
                </label>
              </div>
        </div>

        <div>
          <label htmlFor="poll-title" className="block text-sm font-medium text-gray-700 mb-1">
            Poll Title *
          </label>
          <input
            id="poll-title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Enter poll question or title"
          />
        </div>

        {/* Options with Images */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Options * (2-{MAX_OPTIONS} options)
          </label>
          <div className="space-y-3">
            {options.map((option, index) => (
              <div key={option.id} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    value={option.text}
                    onChange={(e) => updateOption(option.id, 'text', e.target.value)}
                    required
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder={`Option ${index + 1}`}
                  />
                  {options.length > 2 && (
                    <button
                      type="button"
                      onClick={() => removeOption(option.id)}
                      className="px-3 py-2 text-red-600 hover:text-red-800 border border-red-300 rounded-md hover:bg-red-50 transition-colors"
                    >
                      Remove
                    </button>
                  )}
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Image URL (PNG/Icon)</label>
                  <input
                    type="url"
                    value={option.imageUrl || ''}
                    onChange={(e) => updateOption(option.id, 'imageUrl', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    placeholder="https://example.com/icon.png"
                  />
                  {option.imageUrl && (
                    <div className="mt-2">
                      <img
                        src={option.imageUrl}
                        alt="Preview"
                        className="h-12 w-12 object-contain border border-gray-300 rounded"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
          {options.length < MAX_OPTIONS && (
            <button
              type="button"
              onClick={addOption}
              className="mt-2 px-4 py-2 text-blue-600 border border-blue-300 rounded-md hover:bg-blue-50 transition-colors"
            >
              + Add Option
            </button>
          )}
        </div>

        {/* Broadcast Layout Options */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Broadcast Layout *
          </label>
          <div className="flex gap-2">
            {BARS_LAYOUT_LABELS.map((label, index) => {
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

        {/* Full Screen Style Options (only show when Full Screen is selected) */}
        {layoutStyle === 1 && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Full Screen Style
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setFullScreenStyle('horizontal')}
                className={`flex-1 px-4 py-3 rounded-md border-2 transition-all font-medium ${
                  fullScreenStyle === 'horizontal'
                    ? 'border-blue-600 bg-blue-50 text-blue-700 font-semibold'
                    : 'border-gray-300 hover:border-gray-400'
                }`}
              >
                Horizontal
              </button>
              <button
                type="button"
                onClick={() => setFullScreenStyle('vertical')}
                className={`flex-1 px-4 py-3 rounded-md border-2 transition-all font-medium ${
                  fullScreenStyle === 'vertical'
                    ? 'border-blue-600 bg-blue-50 text-blue-700 font-semibold'
                    : 'border-gray-300 hover:border-gray-400'
                }`}
              >
                Vertical
              </button>
            </div>
          </div>
        )}


        {/* PIP Position (only show when PIP is selected) */}
        {layoutStyle === 3 && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              PIP Position
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setPipPosition('left')}
                className={`flex-1 px-4 py-3 rounded-md border-2 transition-all font-medium ${
                  pipPosition === 'left'
                    ? 'border-blue-600 bg-blue-50 text-blue-700 font-semibold'
                    : 'border-gray-300 hover:border-gray-400'
                }`}
              >
                Left
              </button>
              <button
                type="button"
                onClick={() => setPipPosition('right')}
                className={`flex-1 px-4 py-3 rounded-md border-2 transition-all font-medium ${
                  pipPosition === 'right'
                    ? 'border-blue-600 bg-blue-50 text-blue-700 font-semibold'
                    : 'border-gray-300 hover:border-gray-400'
                }`}
              >
                Right
              </button>
            </div>
          </div>
        )}

        {/* Bar Edge Style - Controls the bars themselves */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Bar Edge Style
          </label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setBarEdgeStyle('square')}
              className={`flex-1 px-4 py-3 rounded-md border-2 transition-all font-medium ${
                barEdgeStyle === 'square'
                  ? 'border-blue-600 bg-blue-50 text-blue-700 font-semibold'
                  : 'border-gray-300 hover:border-gray-400'
              }`}
            >
              Square
            </button>
            <button
              type="button"
              onClick={() => setBarEdgeStyle('beveled')}
              className={`flex-1 px-4 py-3 rounded-md border-2 transition-all font-medium ${
                barEdgeStyle === 'beveled'
                  ? 'border-blue-600 bg-blue-50 text-blue-700 font-semibold'
                  : 'border-gray-300 hover:border-gray-400'
              }`}
            >
              Beveled
            </button>
            <button
              type="button"
              onClick={() => setBarEdgeStyle('rounded')}
              className={`flex-1 px-4 py-3 rounded-md border-2 transition-all font-medium ${
                barEdgeStyle === 'rounded'
                  ? 'border-blue-600 bg-blue-50 text-blue-700 font-semibold'
                  : 'border-gray-300 hover:border-gray-400'
              }`}
            >
              Rounded
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-1">Controls the edge style of the poll bars</p>
        </div>

        {/* Per-Layout Title Settings (only show when title is shown and layout is selected) */}
        {showTitle && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-800">Title Settings</h3>
            
            {/* Full Screen Title Settings - only show when Full Screen is selected */}
            {layoutStyle === 1 && (
            <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
              <label className="block text-sm font-medium text-gray-700 mb-3">
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

            {/* Lower Third Title Settings - only show when Lower Third is selected */}
            {layoutStyle === 2 && (
            <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
              <label className="block text-sm font-medium text-gray-700 mb-3">
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
                    value={titleSettings.lowerThird?.yPosition || 0}
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
                          yPosition: prev.lowerThird?.yPosition || 0,
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

            {/* PIP Title Settings - only show when PIP is selected */}
            {layoutStyle === 3 && (
            <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
              <label className="block text-sm font-medium text-gray-700 mb-3">
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
          </div>
        )}

        {/* Per-Layout Background Settings - only show for selected layout */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-800">Background Settings</h3>
          
          {/* Full Screen Background Settings - only show when Full Screen is selected */}
          {layoutStyle === 1 && (
          <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
            <label className="block text-sm font-medium text-gray-700 mb-3">
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

          {/* Lower Third Background Settings - only show when Lower Third is selected */}
          {layoutStyle === 2 && (
          <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
            <label className="block text-sm font-medium text-gray-700 mb-3">
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

          {/* PIP Background Settings - only show when PIP is selected */}
          {layoutStyle === 3 && (
          <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
            <label className="block text-sm font-medium text-gray-700 mb-3">
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
        </div>

        {/* Per-Layout Border Settings - only show for selected layout */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-800">Border Settings</h3>
          
          {/* Full Screen Border Settings - only show when Full Screen is selected */}
          {layoutStyle === 1 && (
          <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
            <label className="block text-sm font-medium text-gray-700 mb-3">
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
              <p className="text-xs text-gray-500 mt-1">Scale the poll content (70-150%)</p>
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

          {/* Lower Third Border Settings - only show when Lower Third is selected */}
          {layoutStyle === 2 && (
          <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
            <label className="block text-sm font-medium text-gray-700 mb-3">
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
                <label className="block text-xs text-gray-600 mb-1">Border Type</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setBorderSettings(prev => ({
                      ...prev,
                      lowerThird: { ...prev.lowerThird, type: 'line', position: 'line' },
                    }))}
                    className={`flex-1 px-3 py-2 rounded-md border-2 transition-all font-medium text-xs ${
                      (borderSettings.lowerThird as any)?.type === 'line' || borderSettings.lowerThird?.position === 'line' || (!(borderSettings.lowerThird as any)?.type && !borderSettings.lowerThird?.position && borderSettings.lowerThird?.thickness)
                        ? 'border-blue-600 bg-blue-50 text-blue-700 font-semibold'
                        : 'border-gray-300 hover:border-gray-400'
                    }`}
                  >
                    Line
                  </button>
                  <button
                    type="button"
                    onClick={() => setBorderSettings(prev => ({
                      ...prev,
                      lowerThird: { ...prev.lowerThird, type: 'boxEdge', position: 'inner', zoom: prev.lowerThird?.zoom || 100 },
                    }))}
                    className={`flex-1 px-3 py-2 rounded-md border-2 transition-all font-medium text-xs ${
                      (borderSettings.lowerThird as any)?.type === 'boxEdge' || (borderSettings.lowerThird as any)?.type === 'boxInner' || (borderSettings.lowerThird as any)?.type === 'inner' || (borderSettings.lowerThird?.position === 'inner' && !(borderSettings.lowerThird as any)?.type)
                        ? 'border-blue-600 bg-blue-50 text-blue-700 font-semibold'
                        : 'border-gray-300 hover:border-gray-400'
                    }`}
                  >
                    Box Edge
                  </button>
                </div>
              </div>
              {/* Zoom and Y Position Options - Only show when Box Edge is selected */}
              {(borderSettings.lowerThird as any)?.type === 'boxEdge' || (borderSettings.lowerThird as any)?.type === 'boxInner' || (borderSettings.lowerThird as any)?.type === 'inner' || (borderSettings.lowerThird?.position === 'inner' && !(borderSettings.lowerThird as any)?.type) ? (
                <>
                  <div className="mt-4">
                    <label className="block text-xs text-gray-600 mb-1">Zoom ({borderSettings.lowerThird?.zoom || 100}%)</label>
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
                    <label className="block text-xs text-gray-600 mb-1">Y Position ({borderSettings.lowerThird?.yPosition ?? 0}px)</label>
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
                    <p className="text-xs text-gray-500 mt-1">Positive values move down, negative values move up</p>
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

          {/* PIP Border Settings - only show when PIP is selected */}
          {layoutStyle === 3 && (
          <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
            <label className="block text-sm font-medium text-gray-700 mb-3">
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
                <label className="block text-xs text-gray-600 mb-1">Border</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      // Border On - set thickness to default if not set, keep position as 'outer'
                      const currentThickness = borderSettings.pip?.thickness;
                      setBorderSettings(prev => ({
                        ...prev,
                        pip: { 
                          ...prev.pip, 
                          thickness: currentThickness && currentThickness > 0 ? currentThickness : 2,
                          position: 'outer',
                        },
                      }));
                    }}
                    className={`flex-1 px-4 py-2 rounded-md border-2 transition-all font-medium text-sm ${
                      borderSettings.pip?.thickness && borderSettings.pip.thickness > 0
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
                        pip: { ...prev.pip, thickness: 0, position: 'outer' },
                      }));
                    }}
                    className={`flex-1 px-4 py-2 rounded-md border-2 transition-all font-medium text-sm ${
                      !borderSettings.pip?.thickness || borderSettings.pip.thickness === 0
                        ? 'border-blue-600 bg-blue-50 text-blue-700 font-semibold'
                        : 'border-gray-300 hover:border-gray-400'
                    }`}
                  >
                    Border Off
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
        </div>

        {/* Colors - Simple Color Pickers */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Colors
          </label>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-gray-600 mb-1">Primary Color</label>
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
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm"
                  placeholder="#3B82F6"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">Secondary Color</label>
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
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm"
                  placeholder="#60A5FA"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">Empty Bar Color</label>
              <div className="flex gap-2">
                <input
                  type="color"
                  value={emptyBarColor.startsWith('rgba') ? '#FFFFFF' : emptyBarColor}
                  onChange={(e) => {
                    const hex = e.target.value;
                    const r = parseInt(hex.slice(1, 3), 16);
                    const g = parseInt(hex.slice(3, 5), 16);
                    const b = parseInt(hex.slice(5, 7), 16);
                    // Extract alpha from existing color if it's rgba, otherwise default to 0.7
                    const alphaMatch = emptyBarColor.match(/rgba?\([^)]+,\s*([\d.]+)\)/);
                    const alpha = alphaMatch ? parseFloat(alphaMatch[1]) : 0.7;
                    setEmptyBarColor(`rgba(${r}, ${g}, ${b}, ${alpha})`);
                  }}
                  className="w-16 h-12 rounded border border-gray-300 cursor-pointer"
                />
                <input
                  type="text"
                  value={emptyBarColor}
                  onChange={(e) => setEmptyBarColor(e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm"
                  placeholder="rgba(255, 255, 255, 0.7)"
                />
              </div>
              <div className="mt-1">
                <label className="block text-xs text-gray-600 mb-1">Opacity: {emptyBarColor.match(/rgba?\([^)]+,\s*([\d.]+)\)/) ? (parseFloat(emptyBarColor.match(/rgba?\([^)]+,\s*([\d.]+)\)/)![1]) * 100).toFixed(0) : '70'}%</label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={emptyBarColor.match(/rgba?\([^)]+,\s*([\d.]+)\)/) ? (parseFloat(emptyBarColor.match(/rgba?\([^)]+,\s*([\d.]+)\)/)![1]) * 100) : 70}
                  onChange={(e) => {
                    const alpha = parseFloat(e.target.value) / 100;
                    if (emptyBarColor.startsWith('rgba')) {
                      const match = emptyBarColor.match(/rgba\((\d+),\s*(\d+),\s*(\d+)/);
                      if (match) {
                        setEmptyBarColor(`rgba(${match[1]}, ${match[2]}, ${match[3]}, ${alpha})`);
                      }
                    } else if (emptyBarColor.startsWith('rgb')) {
                      const match = emptyBarColor.match(/rgb\((\d+),\s*(\d+),\s*(\d+)/);
                      if (match) {
                        setEmptyBarColor(`rgba(${match[1]}, ${match[2]}, ${match[3]}, ${alpha})`);
                      }
                    } else {
                      // If it's hex, convert to rgba
                      const hex = emptyBarColor.replace('#', '');
                      const r = parseInt(hex.slice(0, 2), 16);
                      const g = parseInt(hex.slice(2, 4), 16);
                      const b = parseInt(hex.slice(4, 6), 16);
                      setEmptyBarColor(`rgba(${r}, ${g}, ${b}, ${alpha})`);
                    }
                  }}
                  className="w-full"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Preview Toggle */}
        <div className="flex items-center justify-between border-t pt-4">
          <button
            type="button"
            onClick={() => setShowPreview(!showPreview)}
            className="px-4 py-2 text-blue-600 border border-blue-300 rounded-md hover:bg-blue-50 transition-colors"
          >
            {showPreview ? 'Hide Preview' : 'Show Preview'}
          </button>
          <div className="flex gap-2">
            {onCancel && (
              <button
                type="button"
                onClick={onCancel}
                className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
            )}
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? (isEditMode ? 'Saving...' : 'Creating...') : (isEditMode ? 'Save Changes' : 'Create Poll')}
            </button>
          </div>
        </div>

        {/* Preview - 16:9 Screen - Show only selected layout (matches FullscreenOutputPage exactly) */}
        {showPreview && (
          <div className="border-t pt-6 mt-6">
            <h3 className="text-lg font-semibold mb-4">Preview (16:9 Broadcast Screen)</h3>
            <div className="mx-auto" style={{ width: '960px' }}>
              {layoutStyle === 1 ? (
                /* Full Screen Layout - matches FullscreenOutputPage */
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <div className="text-sm font-medium text-gray-700">Full Screen</div>
                    <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">Selected</span>
                  </div>
                  <div className="relative bg-black rounded-lg overflow-hidden" style={{ width: '960px', height: '540px' }}>
                    <div
                      className="absolute inset-0 flex items-center justify-center"
                      style={{
                        ...(() => {
                          const bg = backgroundSettings.fullScreen;
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
                      <PollDisplay key={`preview-${barEdgeStyle}-${borderRadius}`} poll={{ ...previewPoll, layoutStyle: 1, fullScreenStyle, barEdgeStyle, borderRadius }} />
                    </div>
                  </div>
                </div>
              ) : layoutStyle === 2 ? (
                /* Lower Third Layout - matches FullscreenOutputPage */
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <div className="text-sm font-medium text-gray-700">Lower Third</div>
                    <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">Selected</span>
                  </div>
                  <div className="relative bg-black rounded-lg overflow-hidden" style={{ width: '960px', height: '540px' }}>
                    <div
                      className="absolute bottom-0 left-0 right-0"
                      style={{
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
                        borderRadius: `${borderRadius}px`,
                        ...(() => {
                          const border = borderSettings.lowerThird;
                          if (border?.thickness && border.thickness > 0) {
                            const position = border.position || 'outer';
                            const borderType = (border as any)?.type || position;
                            if (borderType === 'boxEdge' || borderType === 'boxInner' || borderType === 'inner') {
                              // Box Edge - full border box inset 10px from edges
                              // Ensure minimum 1px visibility - explicitly set all 4 borders
                              const visibleThickness = Math.max(border.thickness, 1);
                              // Check if we're at 100% zoom or above - if so, no margin for edge-to-edge
                              const zoomPercent = border?.zoom !== undefined ? border.zoom : 100;
                              const isAt100PercentOrAbove = zoomPercent >= 100;
                              return {
                                // Only add margin when zoomed below 100% - at 100%+ we want edge-to-edge
                                margin: isAt100PercentOrAbove ? '0' : '10px',
                                // Explicitly set all 4 borders to ensure visibility
                                borderTop: `${visibleThickness}px solid ${primaryColor}`,
                                borderRight: `${visibleThickness}px solid ${primaryColor}`,
                                borderBottom: `${visibleThickness}px solid ${primaryColor}`,
                                borderLeft: `${visibleThickness}px solid ${primaryColor}`,
                                boxSizing: 'border-box' as const,
                                outline: 'none',
                              };
                            } else if (borderType === 'line') {
                              // Top border only (line) - ensure visible even at 1px
                              // Use explicit border properties to ensure visibility
                              return { 
                                borderTop: `${border.thickness}px solid ${primaryColor}`,
                                borderTopWidth: `${border.thickness}px`,
                                borderTopStyle: 'solid' as const,
                                borderTopColor: primaryColor,
                                boxSizing: 'border-box' as const,
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
                        // Only show default border if no border settings at all (don't override explicit border settings)
                        ...(Object.keys(borderSettings.lowerThird || {}).length === 0 ? { borderTop: `3px solid ${primaryColor}` } : {}),
                        // Apply zoom transform to scale everything proportionally
                        // Only apply zoom if Box Edge is selected AND zoom is explicitly set and not 100%
                        ...(() => {
                          const border = borderSettings.lowerThird;
                          const borderType = (border as any)?.type || border?.position || 'line';
                          const hasBoxEdge = borderType === 'boxEdge' || borderType === 'boxInner' || borderType === 'inner';
                          const zoomPercent = (hasBoxEdge && border?.zoom !== undefined) ? border.zoom : 100;
                          if (hasBoxEdge && zoomPercent !== 100) {
                            const zoomScale = zoomPercent / 100;
                            return {
                              transform: `scale(${zoomScale})`,
                              transformOrigin: 'center center',
                            };
                          }
                          return {};
                        })(),
                        // Apply Y position adjustment (move down when positive)
                        ...(() => {
                          const border = borderSettings.lowerThird;
                          const borderType = (border as any)?.type || border?.position || 'line';
                          // Use nullish coalescing to properly handle 0 values
                          const yPosition = ((borderType === 'boxEdge' || borderType === 'boxInner' || borderType === 'inner') && border?.yPosition !== undefined && border?.yPosition !== null) 
                            ? border.yPosition 
                            : 0;
                          // Always apply Y position, even if 0, to ensure consistent positioning
                          // Positive values move down (reduce bottom offset), negative values move up (increase bottom offset)
                          return {
                            marginBottom: `${-yPosition}px`, // Negative because bottom: 0 means at bottom
                          };
                        })(),
                      }}
                    >
                      <div className="p-6">
                        <PollDisplay key={`preview-${barEdgeStyle}-${borderRadius}`} poll={{ ...previewPoll, layoutStyle: 2, barEdgeStyle, borderRadius }} />
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                /* PIP (Picture-in-Picture) Side Box Layout - matches FullscreenOutputPage */
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <div className="text-sm font-medium text-gray-700">PIP (Side Box) - {pipPosition === 'left' ? 'Left' : 'Right'}</div>
                    <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">Selected</span>
                  </div>
                  <div className="relative bg-black rounded-lg overflow-hidden" style={{ width: '960px', height: '540px' }}>
                    <div
                      className={`absolute w-96 max-w-[35vw] ${pipPosition === 'left' ? 'left-6' : 'right-6'}`}
                      style={{
                        top: `${24 + (borderSettings.pip?.yPosition ?? 0)}px`,
                        left: pipPosition === 'left' ? `${24 + (borderSettings.pip?.xPosition ?? 0)}px` : undefined,
                        right: pipPosition === 'right' ? `${24 - (borderSettings.pip?.xPosition ?? 0)}px` : undefined,
                        transform: borderSettings.pip?.zoom && borderSettings.pip.zoom !== 100
                          ? `scale(${borderSettings.pip.zoom / 100})`
                          : undefined,
                        transformOrigin: pipPosition === 'left' ? 'left top' : 'right top',
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
                            // For PIP, use CSS border instead of box-shadow
                            return { border: `${border.thickness}px solid ${primaryColor}` };
                          }
                          return {};
                        })(),
                        backdropFilter: 'blur(8px)',
                        // Only show default border if no border settings exist AND thickness is not explicitly 0
                        ...(Object.keys(borderSettings.pip || {}).length === 0 || (borderSettings.pip?.thickness === undefined && !borderSettings.pip)
                          ? { border: `2px solid ${primaryColor}` }
                          : (borderSettings.pip?.thickness === 0 ? {} : {})),
                        borderRadius: `${borderRadius}px`,
                        maxHeight: '70vh',
                        overflowY: 'auto',
                      }}
                    >
                      <div className="p-4">
                        <PollDisplay key={`preview-${barEdgeStyle}-${borderRadius}`} poll={{ ...previewPoll, layoutStyle: 3, pipPosition, barEdgeStyle, borderRadius }} />
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
        
      </form>
    </div>
  );
}

