import React from 'react';
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import Home from '../src/components/Home';
import Login from '../src/components/Login';
import RecordingPage from '../src/page/RecordingPage';
import { useStore } from './stores/login';

const App: React.FC = () => {
  const { isLoggedIn } = useStore();

  return (
    <Router>
      <div className="min-h-screen bg-gray-900">
        <Routes>
          <Route path="/login" element={isLoggedIn ? <Navigate to="/home" /> : <Login />} />
          <Route path="/home" element={isLoggedIn ? <Home /> : <Navigate to="/login" />} />
          {/*<Route path="/feedback" element={isLoggedIn ? <RecordingPage /> : <Navigate to="/login" />} />*/}
          <Route path="/feedback" element={<RecordingPage />} />
          <Route path="/" element={<Navigate to="/login" />} />
        </Routes>
      </div>
    </Router>
  );
};

export default App;
