'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'motion/react';
import { toast } from 'sonner';
import { Mail, Lock, ArrowRight, Loader2, LogIn, Eye, EyeOff } from 'lucide-react';
import { SectionLabel } from '@/components/ui/section-label';
import { useAuth } from '@/context/AuthContext';
import Image from 'next/image';

export default function LoginClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams ? searchParams.get('redirect') : null;
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });
  const [showPassword, setShowPassword] = useState(false);

  const { refreshUser } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    const { email, password } = formData;

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
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
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-tertiary ml-2">Email Address</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-tertiary group-focus-within:text-primary transition-colors">
                  <Mail size={18} />
                </div>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="name@example.com"
                  className="w-full rounded-none border-b-2 border-outline-variant/30 bg-surface-high pl-12 pr-4 py-4 text-sm outline-none transition-all focus:border-primary focus:bg-white text-on-surface placeholder:text-tertiary/50"
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center ml-2 mr-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-tertiary">Password</label>
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
    </div>
  );
}
