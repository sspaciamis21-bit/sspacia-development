'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import { User, Mail, Lock, ArrowRight, Loader2, LogIn, Eye, EyeOff, X, KeyRound } from 'lucide-react';
import { SectionLabel } from '@/components/ui/section-label';
import { useAuth } from '@/context/AuthContext';
import Image from 'next/image';

export default function LoginClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams ? searchParams.get('redirect') : null;
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    username: '',
    password: '',
  });
  const [showPassword, setShowPassword] = useState(false);

  // Forgot Password Modal State
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotData, setForgotData] = useState({
    username: '',
    email: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [forgotLoading, setForgotLoading] = useState(false);
  const [showForgotNewPassword, setShowForgotNewPassword] = useState(false);

  const { refreshUser } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    const { username, password } = formData;

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Login failed');
      }

      toast.success('Welcome back to SSPACIA!');

      await refreshUser();

      if (redirect) {
        router.push(decodeURIComponent(redirect));
        return;
      }

      const role = data.user.role?.toUpperCase();
      if (role === 'ADMIN') {
        router.push('/admin/dashboard');
      } else if (role === 'USER') {
        router.push('/dashboard');
      } else {
        router.push('/manager/dashboard');
      }

      router.refresh();
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const { username, email, newPassword, confirmPassword } = forgotData;

    if (!username.trim() || !email.trim() || !newPassword.trim()) {
      toast.error('All fields are required');
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error('New passwords do not match');
      return;
    }

    setForgotLoading(true);

    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: username.trim(),
          email: email.trim(),
          newPassword: newPassword.trim(),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to reset password');
      }

      toast.success(data.message || 'Password reset successfully!');
      setShowForgotModal(false);
      setForgotData({ username: '', email: '', newPassword: '', confirmPassword: '' });
    } catch (err: any) {
      toast.error(err.message || 'Something went wrong');
    } finally {
      setForgotLoading(false);
    }
  };

  return (
    <div className="min-h-[90vh] flex bg-surface-lowest">
      {/* Visual Side */}
      <div className="hidden lg:flex w-1/2 relative bg-surface-high border-r border-outline-variant/10 overflow-hidden group">
        <Image
          src="/IMAGES_SSPACIA/MERCADO IMAGES/Reception.jpg"
          alt="SSPACIA Auth"
          fill
          className="object-cover grayscale group-hover:grayscale-0 transition-all duration-1000 group-hover:scale-105"
          priority
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent z-10" />
        <div className="absolute top-0 right-12 w-[1px] h-full bg-white/10 z-20"></div>
        <div className="absolute bottom-12 left-12 z-20 space-y-4">
          <SectionLabel className="bg-white/10 text-white border-white/20 backdrop-blur-md">
            <LogIn className="h-3 w-3" /> Member Access
          </SectionLabel>
          <h2 className="text-4xl font-display font-bold text-white tracking-tighter shadow-sm">Your premium space awaits.</h2>
          <p className="text-white/80 max-w-sm font-light">Sign in to manage your bookings, access the community, and explore exclusive perks.</p>
        </div>
      </div>

      {/* Form Side */}
      <div className="flex w-full lg:w-1/2 items-center justify-center p-8 sm:p-16 relative">
        <div className="absolute top-0 right-12 w-[1px] h-full bg-outline-variant/10 hidden md:block"></div>
        <div className="absolute top-12 left-0 w-full h-[1px] bg-outline-variant/10 hidden md:block"></div>

        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="w-full max-w-md relative z-10"
        >
          <div className="mb-12">
            <h1 className="text-5xl font-display font-bold tracking-tighter text-on-surface mb-4 relative inline-block">
              Welcome Back
              <span className="absolute -bottom-2 left-0 w-1/3 h-1 bg-primary"></span>
            </h1>
            <p className="text-tertiary mt-6 text-lg font-light">Sign in to your SSPACIA workspace</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Username Input */}
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-tertiary ml-2">Username</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-tertiary group-focus-within:text-primary transition-colors">
                  <User size={18} />
                </div>
                <input
                  type="text"
                  required
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  placeholder="-"
                  className="w-full rounded-none border-b-2 border-outline-variant/30 bg-surface-high pl-12 pr-4 py-4 text-sm outline-none transition-all focus:border-primary focus:bg-white text-on-surface placeholder:text-tertiary/50"
                />
              </div>
            </div>

            {/* Password Input */}
            <div className="space-y-2">
              <div className="flex justify-between items-center ml-2 mr-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-tertiary">Password</label>
                <button
                  type="button"
                  onClick={() => setShowForgotModal(true)}
                  className="text-[10px] font-bold uppercase tracking-wider text-primary hover:underline transition-all"
                >
                  Forgot Password?
                </button>
              </div>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-tertiary group-focus-within:text-primary transition-colors">
                  <Lock size={18} />
                </div>
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder="••••••••"
                  className="w-full rounded-none border-b-2 border-outline-variant/30 bg-surface-high pl-12 pr-12 py-4 text-sm outline-none transition-all focus:border-primary focus:bg-white text-on-surface placeholder:text-tertiary/50"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-4 flex items-center text-tertiary hover:text-primary transition-colors outline-none"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="liquid-hover group flex w-full items-center justify-center gap-4 rounded-none bg-primary px-8 py-5 text-[10px] font-bold uppercase tracking-[0.2em] text-white shadow-xl shadow-primary/20 transition-all hover:bg-primary-container disabled:opacity-50 disabled:cursor-not-allowed mt-8"
            >
              {isLoading ? (
                <Loader2 className="animate-spin" size={20} />
              ) : (
                <>
                  Sign In to Workspace
                  <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>
          </form>

          <div className="mt-12 pt-8 border-t border-outline-variant/20 flex flex-col items-center">
            <p className="text-tertiary font-light text-sm">
              Don&apos;t have an account yet?{' '}
              <Link
                href={`/signup${redirect ? `?redirect=${encodeURIComponent(redirect)}` : ''}`}
                className="text-primary font-bold hover:text-primary-container transition-colors ml-1 uppercase text-[10px] tracking-widest relative after:content-[''] after:absolute after:-bottom-1 after:left-0 after:w-full after:h-[1px] after:bg-primary after:scale-x-0 hover:after:scale-x-100 after:transition-transform after:origin-left"
              >
                Create Account
              </Link>
            </p>
          </div>
        </motion.div>
      </div>

      {/* Forgot Password Modal */}
      <AnimatePresence>
        {showForgotModal && (
          <div className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="relative w-full max-w-md bg-white border border-outline-variant/30 shadow-2xl overflow-hidden rounded-none p-6 sm:p-8"
            >
              <div className="flex items-center justify-between pb-4 border-b border-outline-variant/20">
                <div className="flex items-center gap-2">
                  <KeyRound size={20} className="text-primary" />
                  <h3 className="font-display font-bold text-lg text-on-surface uppercase tracking-wider">
                    Reset Password
                  </h3>
                </div>
                <button
                  onClick={() => setShowForgotModal(false)}
                  className="p-2 text-tertiary hover:text-on-surface hover:bg-surface-high transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              <p className="text-xs text-tertiary mt-4 mb-6">
                Enter your registered Username and Email ID to set a new password.
              </p>

              <form onSubmit={handleForgotSubmit} className="space-y-4">
                {/* Username */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-tertiary">
                    Registered Username
                  </label>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-tertiary">
                      <User size={16} />
                    </div>
                    <input
                      type="text"
                      required
                      value={forgotData.username}
                      onChange={(e) => setForgotData({ ...forgotData, username: e.target.value })}
                      placeholder="-"
                      className="w-full border border-outline-variant/30 bg-surface-high pl-10 pr-3 py-2.5 text-sm outline-none focus:border-primary text-on-surface rounded-none"
                    />
                  </div>
                </div>

                {/* Email ID */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-tertiary">
                    Registered Email ID
                  </label>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-tertiary">
                      <Mail size={16} />
                    </div>
                    <input
                      type="email"
                      required
                      value={forgotData.email}
                      onChange={(e) => setForgotData({ ...forgotData, email: e.target.value })}
                      placeholder=""
                      className="w-full border border-outline-variant/30 bg-surface-high pl-10 pr-3 py-2.5 text-sm outline-none focus:border-primary text-on-surface rounded-none"
                    />
                  </div>
                </div>

                {/* New Password */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-tertiary">
                    New Password
                  </label>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-tertiary">
                      <Lock size={16} />
                    </div>
                    <input
                      type={showForgotNewPassword ? 'text' : 'password'}
                      required
                      value={forgotData.newPassword}
                      onChange={(e) => setForgotData({ ...forgotData, newPassword: e.target.value })}
                      placeholder="••••••••"
                      className="w-full border border-outline-variant/30 bg-surface-high pl-10 pr-10 py-2.5 text-sm outline-none focus:border-primary text-on-surface rounded-none"
                    />
                    <button
                      type="button"
                      onClick={() => setShowForgotNewPassword(!showForgotNewPassword)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-tertiary hover:text-primary"
                    >
                      {showForgotNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                {/* Confirm Password */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-tertiary">
                    Confirm New Password
                  </label>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-tertiary">
                      <Lock size={16} />
                    </div>
                    <input
                      type={showForgotNewPassword ? 'text' : 'password'}
                      required
                      value={forgotData.confirmPassword}
                      onChange={(e) => setForgotData({ ...forgotData, confirmPassword: e.target.value })}
                      placeholder="••••••••"
                      className="w-full border border-outline-variant/30 bg-surface-high pl-10 pr-3 py-2.5 text-sm outline-none focus:border-primary text-on-surface rounded-none"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={forgotLoading}
                  className="w-full flex items-center justify-center gap-2 bg-primary text-white py-3 px-4 font-bold text-xs uppercase tracking-widest hover:bg-primary-container disabled:opacity-50 transition-colors mt-6 rounded-none"
                >
                  {forgotLoading ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    'Reset & Save Password'
                  )}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
