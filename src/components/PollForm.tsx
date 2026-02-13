import { useState, type FormEvent } from 'react';
import { createPoll } from '../services/firestore';
import { PollType, PollDisplayType } from '../types';

interface PollFormProps {
  eventId: string;
  onSuccess?: () => void;
  onCancel?: () => void;
}

const POLL_TYPE_OPTIONS = [
  { value: PollType.SINGLE_CHOICE, label: 'Single Choice' },
  { value: PollType.MULTIPLE_CHOICE, label: 'Multiple Choice' },
  { value: PollType.RATING_SCALE, label: 'Rating Scale' },
  { value: PollType.YES_NO, label: 'Yes/No' },
];

const DISPLAY_TYPE_OPTIONS = [
  { value: PollDisplayType.CARDS, label: 'Cards', icon: '📋' },
  { value: PollDisplayType.BARS, label: 'Bars', icon: '📊' },
  { value: PollDisplayType.PIE_CHART, label: 'Pie Chart', icon: '🥧' },
  { value: PollDisplayType.NUMBERS, label: 'Numbers', icon: '🔢' },
  { value: PollDisplayType.LIST, label: 'List', icon: '📝' },
  { value: PollDisplayType.GRID, label: 'Grid', icon: '⚏' },
  { value: PollDisplayType.CIRCULAR, label: 'Circular', icon: '⭕' },
  { value: PollDisplayType.ANIMATED_BARS, label: 'Animated Bars', icon: '📈' },
];

const COLOR_PRESETS = [
  { name: 'Blue', primary: '#3B82F6', secondary: '#60A5FA' },
  { name: 'Purple', primary: '#8B5CF6', secondary: '#A78BFA' },
  { name: 'Red', primary: '#EF4444', secondary: '#F87171' },
  { name: 'Green', primary: '#10B981', secondary: '#34D399' },
  { name: 'Orange', primary: '#F59E0B', secondary: '#FBBF24' },
  { name: 'Pink', primary: '#EC4899', secondary: '#F472B6' },
  { name: 'Teal', primary: '#14B8A6', secondary: '#5EEAD4' },
  { name: 'Indigo', primary: '#6366F1', secondary: '#818CF8' },
];

const MAX_OPTIONS = 6;

export default function PollForm({ eventId, onSuccess, onCancel }: PollFormProps) {
  const [type, setType] = useState<PollType>(PollType.SINGLE_CHOICE);
  const [title, setTitle] = useState('');
  const [options, setOptions] = useState<Array<{ id: string; text: string }>>([
    { id: '1', text: '' },
    { id: '2', text: '' },
  ]);
  const [displayType, setDisplayType] = useState<PollDisplayType>(PollDisplayType.CARDS);
  const [primaryColor, setPrimaryColor] = useState('#3B82F6');
  const [secondaryColor, setSecondaryColor] = useState('#60A5FA');
  const [emptyBarColor, setEmptyBarColor] = useState('rgba(255, 255, 255, 0.7)');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addOption = () => {
    if (options.length < MAX_OPTIONS) {
      setOptions([...options, { id: Date.now().toString(), text: '' }]);
    }
  };

  const removeOption = (id: string) => {
    if (options.length > 2) {
      setOptions(options.filter((opt) => opt.id !== id));
    }
  };

  const updateOption = (id: string, text: string) => {
    setOptions(options.map((opt) => (opt.id === id ? { ...opt, text } : opt)));
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
        }));

      if (validOptions.length < 2) {
        setError('Please provide at least 2 options for the poll.');
        setLoading(false);
        return;
      }

      await createPoll({
        eventId,
        type,
        title: title.trim(),
        options: validOptions,
        displayType,
        primaryColor,
        secondaryColor,
        emptyBarColor,
      });

      // Reset form
      setTitle('');
      setOptions([
        { id: '1', text: '' },
        { id: '2', text: '' },
      ]);
      setType(PollType.SINGLE_CHOICE);
      setDisplayType(PollDisplayType.CARDS);
      setPrimaryColor('#3B82F6');
      setSecondaryColor('#60A5FA');
      setEmptyBarColor('rgba(255, 255, 255, 0.7)');

      if (onSuccess) {
        onSuccess();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create poll');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white p-6 rounded-lg shadow-md">
      <h2 className="text-2xl font-bold mb-4 text-gray-800">Create New Poll</h2>

      {error && (
        <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
          {error}
        </div>
      )}

      <div className="mb-4">
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

      <div className="mb-4">
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

      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Options * (2-{MAX_OPTIONS} options)
        </label>
        {options.map((option, index) => (
          <div key={option.id} className="flex gap-2 mb-2">
            <input
              type="text"
              value={option.text}
              onChange={(e) => updateOption(option.id, e.target.value)}
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
        ))}
        {options.length < MAX_OPTIONS && (
          <button
            type="button"
            onClick={addOption}
            className="mt-2 px-4 py-2 text-blue-600 border border-blue-300 rounded-md hover:bg-blue-50 transition-colors"
          >
            + Add Option
          </button>
        )}
        {options.length >= MAX_OPTIONS && (
          <p className="mt-2 text-xs text-gray-500">
            Maximum {MAX_OPTIONS} options reached
          </p>
        )}
      </div>

      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Display Type *
        </label>
        <div className="grid grid-cols-4 gap-2">
          {DISPLAY_TYPE_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setDisplayType(option.value)}
              className={`p-3 rounded-lg border-2 transition-all ${
                displayType === option.value
                  ? 'border-blue-600 bg-blue-50'
                  : 'border-gray-300 hover:border-gray-400'
              }`}
            >
              <div className="text-2xl mb-1">{option.icon}</div>
              <div className="text-xs font-medium">{option.label}</div>
            </button>
          ))}
        </div>
      </div>

      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Colors
        </label>
        <div className="grid grid-cols-4 gap-2 mb-3">
          {COLOR_PRESETS.map((preset) => (
            <button
              key={preset.name}
              type="button"
              onClick={() => {
                setPrimaryColor(preset.primary);
                setSecondaryColor(preset.secondary);
              }}
              className="p-2 rounded border-2 border-gray-300 hover:border-gray-400 transition-all"
              title={preset.name}
            >
              <div className="flex gap-1">
                <div
                  className="w-8 h-8 rounded"
                  style={{ backgroundColor: preset.primary }}
                />
                <div
                  className="w-8 h-8 rounded"
                  style={{ backgroundColor: preset.secondary }}
                />
              </div>
              <div className="text-xs mt-1">{preset.name}</div>
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-xs text-gray-600 mb-1">Primary Color</label>
            <div className="flex gap-2">
              <input
                type="color"
                value={primaryColor}
                onChange={(e) => setPrimaryColor(e.target.value)}
                className="w-12 h-10 rounded border border-gray-300 cursor-pointer"
              />
              <input
                type="text"
                value={primaryColor}
                onChange={(e) => setPrimaryColor(e.target.value)}
                className="flex-1 px-2 py-2 border border-gray-300 rounded-md text-sm"
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
                className="w-12 h-10 rounded border border-gray-300 cursor-pointer"
              />
              <input
                type="text"
                value={secondaryColor}
                onChange={(e) => setSecondaryColor(e.target.value)}
                className="flex-1 px-2 py-2 border border-gray-300 rounded-md text-sm"
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
                className="w-12 h-10 rounded border border-gray-300 cursor-pointer"
              />
              <input
                type="text"
                value={emptyBarColor}
                onChange={(e) => setEmptyBarColor(e.target.value)}
                className="flex-1 px-2 py-2 border border-gray-300 rounded-md text-sm"
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

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={loading}
          className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? 'Creating...' : 'Create Poll'}
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
  );
}

