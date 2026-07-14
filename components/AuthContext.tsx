'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { User } from '@supabase/supabase-js';

interface Profile {
  id: string;
  display_name: string;
  created_at: string;
}

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshSession: () => Promise<void>;
  loginMock: (email: string, name?: string) => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  signOut: async () => {},
  refreshSession: async () => {},
  loginMock: () => {},
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  const isSupabaseConfigured = 
    process.env.NEXT_PUBLIC_SUPABASE_URL && 
    process.env.NEXT_PUBLIC_SUPABASE_URL !== 'undefined' && 
    process.env.NEXT_PUBLIC_SUPABASE_URL.trim() !== '' &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY !== 'undefined' &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY.trim() !== '';

  const loginMock = (email: string, name?: string) => {
    const mockUser = {
      id: 'mock-reporter-id',
      email: email,
      user_metadata: { display_name: name || 'Mock User' },
      aud: 'authenticated',
      created_at: new Date().toISOString()
    } as unknown as User;

    const mockProfile = {
      id: 'mock-reporter-id',
      display_name: name || email.split('@')[0],
      created_at: new Date().toISOString()
    };

    setUser(mockUser);
    setProfile(mockProfile);
    localStorage.setItem('pave_mock_user', JSON.stringify({ user: mockUser, profile: mockProfile }));
  };

  const fetchProfile = useCallback(async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
      if (!error && data) {
        setProfile(data);
      } else {
        setProfile(null);
      }
    } catch (err) {
      console.error('Error fetching profile:', err);
      setProfile(null);
    }
  }, [supabase]);

  const refreshSession = useCallback(async () => {
    if (!isSupabaseConfigured) {
      const saved = localStorage.getItem('pave_mock_user');
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          setUser(parsed.user);
          setProfile(parsed.profile);
        } catch {
          setUser(null);
          setProfile(null);
        }
      }
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setUser(session.user);
        await fetchProfile(session.user.id);
      } else {
        setUser(null);
        setProfile(null);
      }
    } catch (err) {
      console.error('Error refreshing session:', err);
    } finally {
      setLoading(false);
    }
  }, [isSupabaseConfigured, supabase, fetchProfile]);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      const saved = localStorage.getItem('pave_mock_user');
      Promise.resolve().then(() => {
        if (saved) {
          try {
            const parsed = JSON.parse(saved);
            setUser(parsed.user);
            setProfile(parsed.profile);
          } catch {}
        }
        setLoading(false);
      });
      return;
    }

    Promise.resolve().then(() => refreshSession());

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (session?.user) {
          setUser(session.user);
          await fetchProfile(session.user.id);
        } else {
          setUser(null);
          setProfile(null);
        }
        setLoading(false);
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, [isSupabaseConfigured, supabase, refreshSession, fetchProfile]);

  const signOut = async () => {
    setLoading(true);
    if (!isSupabaseConfigured) {
      localStorage.removeItem('pave_mock_user');
    } else {
      await supabase.auth.signOut();
    }
    setUser(null);
    setProfile(null);
    setLoading(false);
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, signOut, refreshSession, loginMock }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
