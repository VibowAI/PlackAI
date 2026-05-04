import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { UserContextType, Profile } from '../types';

const AuthContext = createContext<UserContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<any | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isGuest, setIsGuest] = useState(false);
  const [isDevMode, setIsDevMode] = useState(() => {
    return localStorage.getItem('lack_dev_mode') === 'true';
  });

  useEffect(() => {
    try {
      localStorage.setItem('lack_dev_mode', isDevMode.toString());
    } catch (e) {}
  }, [isDevMode]);

  useEffect(() => {
    // Check initial session
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (error) {
        console.error('Initial session fetch error:', error);
        if (error.message.toLowerCase().includes('refresh token')) {
          supabase.auth.signOut();
        }
      }

      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
      } else {
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('Auth state changed:', event, session?.user?.id);

      if (event === 'SIGNED_OUT') {
        setUser(null);
        setProfile(null);
        setLoading(false);
        return;
      }

      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
        setIsGuest(false);
      } else {
        if (!isGuest) {
          setProfile(null);
          setLoading(false);
        }
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchProfile = async (id: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // Profile doesn't exist, create it
          const { data: newUser } = await supabase.auth.getUser();
          if (newUser.user) {
            const { data: newProfile, error: createError } = await supabase
              .from('profiles')
              .insert([{ id }])
              .select()
              .single();

            if (createError) throw createError;

            const localAvatar = localStorage.getItem(`avatar_${id}`);
            setProfile({ ...newProfile, image_url: localAvatar || newProfile.image_url });
          }
        } else {
          console.error('Error fetching profile:', error);
          throw error;
        }
      } else {
        // Source of truth: database
        const localAvatar = localStorage.getItem(`avatar_${id}`);
        setProfile({ ...data, image_url: data.image_url || localAvatar });
      }
    } catch (err) {
      console.error('Error in fetchProfile:', err);
      setProfile(null);
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setIsGuest(false);
  };

  const enterGuestMode = () => {
    setIsGuest(true);
  };

  const deleteAccount = async (confirmText: string) => {
    if (confirmText !== 'DELETE') return false;

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return false;

    try {
      const response = await fetch('/.netlify/functions/delete-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ confirm: true })
      });

      if (response.ok) {
        await signOut();
        return true;
      }
    } catch (err) {
      console.error('Account deletion error:', err);
    }

    return false;
  };

  const updateProfile = (newProfile: Partial<Profile>) => {
    setProfile(prev => prev ? { ...prev, ...newProfile } : null);
  };

  const saveAvatar = async (avatarUrl: string) => {
    if (!user) return;

    try {
      localStorage.setItem(`avatar_${user.id}`, avatarUrl);
    } catch (e) {
      console.warn('Could not save avatar to localStorage (quota exceeded?):', e);
    }

    const { error } = await supabase
      .from('profiles')
      .update({ image_url: avatarUrl })
      .eq('id', user.id);

    if (error) {
      console.error('Failed to update avatar in database:', error);
      if (error.code === 'PGRST204' || error.message?.includes('image_url')) {
        alert("Please run this in your Supabase SQL editor:\n\nALTER TABLE profiles ADD COLUMN image_url TEXT;\nNOTIFY pgrst, 'reload schema';");
      } else {
        alert(`Database error: ` + error.message);
      }
      throw error;
    }

    setProfile(prev => prev ? { ...prev, image_url: avatarUrl } : null);
  };

  const resetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth`,
    });
    if (error) throw error;
  };

  const toggleDevMode = () => {
    if (user?.email === 'talkgte.vibow@gmail.com') {
      setIsDevMode(!isDevMode);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        loading,
        isGuest,
        signOut,
        enterGuestMode,
        deleteAccount,
        updateProfile,
        saveAvatar,
        resetPassword,
        isDevMode,
        toggleDevMode
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};