import { useState, useEffect, useMemo } from 'react';
import { getAllEvents, deleteEvent } from '../services/firestore';
import type { Event } from '../types';
import EventList from '../components/EventList';
import EventForm from '../components/EventForm';

type FilterType = 'all' | 'upcoming' | 'past';

export default function EventsPage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [filter, setFilter] = useState<FilterType>('upcoming');
  const [error, setError] = useState<string | null>(null);

  const loadEvents = async () => {
    try {
      setLoading(true);
      const allEvents = await getAllEvents();
      // Sort by date (upcoming first, then past)
      allEvents.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      setEvents(allEvents);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load events');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEvents();
  }, []);

  const handleDelete = async (eventId: string) => {
    if (window.confirm('Are you sure you want to delete this event?')) {
      try {
        await deleteEvent(eventId);
        await loadEvents();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to delete event');
      }
    }
  };

  const handleFormSuccess = () => {
    setShowForm(false);
    loadEvents();
  };

  const filteredEvents = useMemo(() => {
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
  }, [events, filter]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Header */}
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
            <div>
              <h1 className="text-5xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                ON-AIR GFX
              </h1>
              <p className="text-gray-600 mt-2">Manage your broadcast graphics events</p>
            </div>
            <div className="flex gap-3">
              <a
                href="/operators"
                className="bg-gray-600 text-white px-6 py-3 rounded-lg hover:bg-gray-700 transition-all shadow-lg hover:shadow-xl font-semibold flex items-center gap-2"
              >
                Operators
              </a>
              <button
                onClick={() => setShowForm(!showForm)}
                className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-3 rounded-lg hover:from-blue-700 hover:to-purple-700 transition-all shadow-lg hover:shadow-xl font-semibold flex items-center gap-2"
              >
                <span className="text-xl">+</span>
                {showForm ? 'Cancel' : 'New Event'}
              </button>
            </div>
          </div>

          {/* Filter Tabs */}
          <div className="flex gap-2 bg-white rounded-lg p-1 shadow-md">
            <button
              onClick={() => setFilter('upcoming')}
              className={`flex-1 px-4 py-2 rounded-md font-medium transition-all ${
                filter === 'upcoming'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              Upcoming
            </button>
            <button
              onClick={() => setFilter('past')}
              className={`flex-1 px-4 py-2 rounded-md font-medium transition-all ${
                filter === 'past'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              Past
            </button>
            <button
              onClick={() => setFilter('all')}
              className={`flex-1 px-4 py-2 rounded-md font-medium transition-all ${
                filter === 'all'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              All Events
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 text-red-700 rounded-lg shadow-md">
            <p className="font-medium">Error</p>
            <p>{error}</p>
          </div>
        )}

        {showForm && (
          <div className="mb-8 animate-fade-in">
            <EventForm onSuccess={handleFormSuccess} onCancel={() => setShowForm(false)} />
          </div>
        )}

        {loading ? (
          <div className="text-center py-16">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            <p className="text-gray-500 mt-4">Loading events...</p>
          </div>
        ) : (
          <div>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-semibold text-gray-800">
                {filter === 'upcoming' && `Upcoming Events (${filteredEvents.length})`}
                {filter === 'past' && `Past Events (${filteredEvents.length})`}
                {filter === 'all' && `All Events (${filteredEvents.length})`}
              </h2>
            </div>
            {filteredEvents.length === 0 ? (
              <div className="bg-white rounded-lg shadow-md p-12 text-center">
                <div className="text-6xl mb-4">📅</div>
                <p className="text-xl text-gray-600 mb-2">
                  {filter === 'upcoming' && "No upcoming events"}
                  {filter === 'past' && "No past events"}
                  {filter === 'all' && "No events yet"}
                </p>
                <p className="text-gray-500 mb-6">
                  {filter === 'all' && "Create your first event to get started!"}
                  {filter !== 'all' && "Try selecting a different filter or create a new event."}
                </p>
                {filter !== 'all' && (
                  <button
                    onClick={() => setShowForm(true)}
                    className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Create New Event
                  </button>
                )}
              </div>
            ) : (
              <EventList events={filteredEvents} onDelete={handleDelete} />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

