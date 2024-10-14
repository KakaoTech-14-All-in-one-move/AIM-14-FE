import Sidebar from "@/components/Home/Sidebar";

function App() {
  return (
    <div className='flex'>
      <Sidebar />
    </div>
  )
}

export default App;

/*
import React from 'react';
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import LoginForm from './components/LoginForm';
import Home from './components/Home';
import { useStore } from './store';

const App: React.FC = () => {
  const { isLoggedIn } = useStore();

  return (
    <Router>
      <div className="min-h-screen bg-gray-900">
        <Routes>
          <Route path="/login" element={
            isLoggedIn ? <Navigate to="/home" /> : <LoginForm />
          } />
          <Route path="/home" element={
            isLoggedIn ? <Home /> : <Navigate to="/login" />
          } />
          <Route path="/" element={<Navigate to="/login" />} />
        </Routes>
      </div>
    </Router>
  );
}*/