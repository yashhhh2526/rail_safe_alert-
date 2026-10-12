import { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import Home from './pages/Home';
import TrainDetails from './pages/TrainDetails';
import ActiveAlarm from './pages/ActiveAlarm';
import Settings from './pages/Settings';
import Journeys from './pages/Journeys';
import { getSettings, applyTheme } from './utils/settingsService';

function App() {
  useEffect(() => {
    const settings = getSettings();
    applyTheme(settings.theme);
  }, []);

  return (
    <Router>
      <div style={{ width: '100%', maxWidth: '800px', margin: '0 auto', display: 'flex', flexDirection: 'column', minHeight: '100vh', padding: '1rem' }}>
        <Navbar />
        <main style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/train" element={<TrainDetails />} />
            <Route path="/tracking" element={<ActiveAlarm />} />
            <Route path="/journeys" element={<Journeys />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;
