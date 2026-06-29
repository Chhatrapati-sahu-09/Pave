'use client';

import React, { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from './AuthContext';
import { X, Mail, Lock, User as UserIcon } from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function AuthModal({ isOpen, onClose, onSuccess }: AuthModalProps) {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const supabase = createClient();
  const { loginMock } = useAuth();

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setIsLoading(true);

    try {
      const isSupabaseConfigured = 
        process.env.NEXT_PUBLIC_SUPABASE_URL && 
        process.env.NEXT_PUBLIC_SUPABASE_URL !== 'undefined' && 
        process.env.NEXT_PUBLIC_SUPABASE_URL.trim() !== '' &&
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY !== 'undefined' &&
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY.trim() !== '';

      if (!isSupabaseConfigured) {
        if (isSignUp) {
          if (!displayName.trim()) {
            throw new Error('Display name is required');
          }
          loginMock(email, displayName.trim());
        } else {
          loginMock(email);
        }
        if (onSuccess) onSuccess();
        onClose();
        return;
      }

      if (isSignUp) {
        if (!displayName.trim()) {
          throw new Error('Display name is required');
        }

        // 1. Sign up user
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
        });

        if (error) throw error;

        if (data.user) {
          // 2. Insert profile record
          const { error: profileError } = await supabase
            .from('profiles')
            .insert([
              {
                id: data.user.id,
                display_name: displayName.trim(),
              },
            ]);

          if (profileError) {
            console.error('Profile creation failed:', profileError);
            const isMissingTable = profileError.code === 'PGRST205' || profileError.message?.includes('profiles');
            if (isMissingTable) {
              console.warn('Profiles table not found in database. Proceeding without setting display name in DB.');
            } else {
              throw new Error('Account created, but failed to set display name. Please login to update.');
            }
          }
        }
      } else {
        // Sign in
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) throw error;
      }

      // Success
      if (onSuccess) onSuccess();
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      {/* Modal Card */}
      <div className="card-brutal w-full max-w-md relative bg-[#F5F2EA] p-6">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="btn-brutal-sm absolute -top-3 -right-3 p-1 bg-[#FF3366] hover:bg-[#FF5500] text-black"
          aria-label="Close modal"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Heading */}
        <h2 className="font-space text-2xl font-black uppercase tracking-tight text-[#0A0A0A] mb-2">
          {isSignUp ? 'Join Pave' : 'Welcome Back'}
        </h2>
        <p className="text-sm text-[#0A0A0A]/70 mb-6 font-medium">
          {isSignUp
            ? 'Create an account to report issues and confirm accessibility map updates.'
            : 'Sign in to access reporting and confirmation tools.'}
        </p>

        {/* Error Message banner */}
        {errorMsg && (
          <div className="border-brutal-sm bg-[#FF3366] p-3 mb-4 text-white font-bold text-xs uppercase shadow-brutal-sm">
            {errorMsg}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {isSignUp && (
            <div>
              <label className="block font-space font-extrabold uppercase text-xs tracking-wider text-[#0A0A0A] mb-1">
                Display Name
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-[#0A0A0A]/50">
                  <UserIcon className="h-4 w-4" />
                </span>
                <input
                  type="text"
                  required
                  placeholder="e.g. WheelchairWayfarer"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="input-brutal w-full !pl-10 text-sm font-semibold"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block font-space font-extrabold uppercase text-xs tracking-wider text-[#0A0A0A] mb-1">
              Email Address
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-[#0A0A0A]/50">
                <Mail className="h-4 w-4" />
              </span>
              <input
                type="email"
                required
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input-brutal w-full !pl-10 text-sm font-semibold"
              />
            </div>
          </div>

          <div>
            <label className="block font-space font-extrabold uppercase text-xs tracking-wider text-[#0A0A0A] mb-1">
              Password
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-[#0A0A0A]/50">
                <Lock className="h-4 w-4" />
              </span>
              <input
                type="password"
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input-brutal w-full !pl-10 text-sm font-semibold"
              />
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isLoading}
            className="btn-brutal w-full py-3 mt-4 text-sm font-extrabold tracking-wide bg-[#0047FF] hover:bg-[#FF3399] disabled:opacity-50"
          >
            {isLoading ? 'Processing...' : isSignUp ? 'Create Account' : 'Sign In'}
          </button>
        </form>

        {/* Toggle link */}
        <div className="mt-6 text-center">
          <button
            onClick={() => {
              setIsSignUp(!isSignUp);
              setErrorMsg(null);
            }}
            className="text-xs font-bold uppercase tracking-wider text-[#0047FF] hover:underline"
          >
            {isSignUp ? 'Already have an account? Sign In' : "Don't have an account? Sign Up"}
          </button>
        </div>
      </div>
    </div>
  );
}
