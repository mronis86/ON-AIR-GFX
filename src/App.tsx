import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import EventsPage from './pages/EventsPage';
import EventDetailPage from './pages/EventDetailPage';
import OperatorsPage from './pages/OperatorsPage';
import FullscreenOutputPage from './pages/FullscreenOutputPage';
import PublicEventPage from './pages/PublicEventPage';
import PublicPollPage from './pages/PublicPollPage';
import PublicQAPage from './pages/PublicQAPage';
import QAModerationPage from './pages/QAModerationPage';
import './style.css';

function NotFoundPage() {
  const location = useLocation();
  return (
    <div style={{ padding: '20px', textAlign: 'center' }}>
      <h1>404 - Route Not Found</h1>
      <p>Current path: {location.pathname}</p>
      <p>Available routes: /, /events/:eventId, /events/:eventId/public, /operators, /output/:eventId, /poll/:pollId, /qa/:qaId</p>
    </div>
  );
}

function App() {
  console.log('App: Component rendered');
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<EventsPage />} />
        <Route path="/events/:eventId" element={<EventDetailPage />} />
        <Route path="/operators" element={<OperatorsPage />} />
        <Route path="/output/:eventId" element={<FullscreenOutputPage />} />
        <Route path="/output/:eventId/:layoutFilter" element={<FullscreenOutputPage />} />
        <Route path="/events/:eventId/public" element={<PublicEventPage />} />
        <Route path="/poll/:pollId" element={<PublicPollPage />} />
        <Route path="/qa/:qaId" element={<PublicQAPage />} />
        <Route path="/events/:eventId/qa/moderation" element={<QAModerationPage />} />
        {/* Catch-all route for debugging */}
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;

