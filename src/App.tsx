import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ChatProvider } from './contexts/ChatContext';
import { ThemeProvider } from './contexts/ThemeContext';
import AuthPage from './pages/AuthPage';
import ChatPage from './pages/ChatPage';
import SettingsPage from './pages/SettingsPage';
import { AnimatePresence, motion } from 'motion/react';

const AppContent: React.FC = () => {
  const { user, loading, isGuest } = useAuth();

  if (loading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <motion.div 
          animate={{ scale: [1, 1.1, 1] }}
          transition={{ repeat: Infinity, duration: 1.5 }}
          className="text-2xl font-bold text-slate-400"
        >
          Lack Chat
        </motion.div>
      </div>
    );
  }

  return (
    <AnimatePresence mode="wait">
      <Routes>
        <Route 
          path="/auth" 
          element={user || isGuest ? <Navigate to="/" /> : <AuthPage />} 
        />
        <Route 
          path="/settings" 
          element={user || isGuest ? <SettingsPage /> : <Navigate to="/auth" />} 
        />
        <Route 
          path="/" 
          element={user || isGuest ? <ChatPage /> : <Navigate to="/auth" />} 
        />
      </Routes>
    </AnimatePresence>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <ThemeProvider>
        <ChatProvider>
          <Router>
            <AppContent />
          </Router>
        </ChatProvider>
      </ThemeProvider>
    </AuthProvider>
  );
}
