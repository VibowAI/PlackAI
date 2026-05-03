import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';

type ThemeMode = 'light' | 'dark' | 'system';

interface ThemeContextType {
  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [theme, setThemeState] = useState<ThemeMode>('system');

  useEffect(() => {
    // Initial load from localStorage
    const savedTheme = localStorage.getItem('theme') as ThemeMode || 'system';
    setThemeState(savedTheme);
  }, []);

  useEffect(() => {
    // Load from supabase if user is logged in
    const fetchTheme = async () => {
      if (user) {
        const { data } = await supabase
          .from('profiles')
          .select('theme')
          .eq('id', user.id)
          .single();
        
        if (data?.theme) {
          setThemeState(data.theme as ThemeMode);
          try { localStorage.setItem('theme', data.theme); } catch (e) {}
        }
      }
    };
    fetchTheme();
  }, [user]);

  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark');

    const applyTheme = (mode: ThemeMode) => {
      const root = window.document.documentElement;
      root.classList.remove('light', 'dark');

      if (mode === 'system') {
        const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        root.classList.add(systemDark ? 'dark' : 'light');
      } else {
        root.classList.add(mode);
      }
      try {
        localStorage.setItem('theme', mode);
      } catch (e) {
        console.error('Failed to save theme to localStorage', e);
      }
    };

    applyTheme(theme);

    if (theme === 'system') {
      const observer = window.matchMedia('(prefers-color-scheme: dark)');
      const listener = () => applyTheme('system');
      observer.addEventListener('change', listener);
      return () => observer.removeEventListener('change', listener);
    }
  }, [theme]);

  const setTheme = async (newTheme: ThemeMode) => {
    setThemeState(newTheme);
    try { localStorage.setItem('theme', newTheme); } catch(e) {}
    if (user) {
      await supabase.from('profiles').update({ theme: newTheme }).eq('id', user.id);
    }
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
