import { useParams, Link } from 'react-router-dom';

export default function LiveDataExportPage() {
  const { eventId } = useParams<{ eventId: string }>();
  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-xl font-semibold mb-2">Live data export</h1>
      <p className="text-gray-600 mb-4">
        Configure the CSV export and Google Sheet on the event page. Use Operators to go live and push Q&A to the sheet.
      </p>
      {eventId && (
        <Link
          to={`/events/${eventId}`}
          className="text-blue-600 hover:underline"
        >
          ← Back to event
        </Link>
      )}
    </div>
  );
}
