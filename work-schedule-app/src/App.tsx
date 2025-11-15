import { Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import Schedule from './pages/Schedule';
import Settings from './pages/Settings';

function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/schedule" element={<Schedule />} />
      <Route path="/settings" element={<Settings />} />
    </Routes>
  );
}

export default App;
