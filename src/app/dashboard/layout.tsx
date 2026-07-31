'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'motion/react';
import {
  LayoutDashboard,
  LifeBuoy,
  LogOut,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Ticket,
  Calendar,
  Sparkles,
  X,
  Phone,
  Briefcase,
  Building2,
  ArrowRight,
  User,
  FileText,
  ShieldCheck,
  Receipt
} from 'lucide-react';
import { toast } from 'sonner';

import { useAuth } from '@/context/AuthContext';
import { useSidebar } from '@/context/SidebarContext';
import { ManageProfileModal } from '@/components/profile/ManageProfileModal';

const sidebarItems = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Bookings', href: '/dashboard/bookings', icon: Calendar },
  { name: 'Contracts', href: '/dashboard/contracts', icon: ShieldCheck },
  { name: 'Documents', href: '/dashboard/documents', icon: FileText },
  { name: 'Help', href: '/dashboard/support', icon: LifeBuoy },
  { name: 'Tickets', href: '/dashboard/tickets', icon: Ticket },
  { name: 'Profile', href: '/dashboard/profile', icon: User },
];

export default function UserLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isSidebarOpen, setIsSidebarOpen } = useSidebar();
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);
  const { user, isLoading, logout, isRole, refreshUser } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  const [savingProfile, setSavingProfile] = useState(false);
  const [profileData, setProfileData] = useState({
    name: '', phone: '', designation: '', companyName: '',
    companyStreet: '', companyCity: '', companyState: '', companyZip: ''
  });

  const isRegularUser = user && !isRole('ADMIN') && !isRole('MANAGER') && !isRole('COMMUNITY_MANAGER');
  
  const [hasSkippedProfile, setHasSkippedProfile] = useState(false);

  useEffect(() => {
    if (user?.id) {
      setHasSkippedProfile(localStorage.getItem(`sspacia_skipped_profile_${user.id}`) === 'true');
      
      // Initialize form with existing user data if available
      setProfileData({
        name: user.name || '',
        phone: user.phone || '',
        designation: user.designation || '',
        companyName: user.companyName || '',
        companyStreet: user.companyStreet || '',
        companyCity: user.companyCity || '',
        companyState: user.companyState || '',
        companyZip: user.companyZip || '',
      });
    }
  }, [user]);

  const isProfileComplete = !!(user?.companyName && user?.phone && user?.designation);
  const needsProfileCompletion = isRegularUser && !isProfileComplete && !hasSkippedProfile;

  useEffect(() => {
    if (!isLoading && isRegularUser) {
      if (needsProfileCompletion) return; // Don't show welcome if profile is pending
      const hasSeenWelcome = localStorage.getItem(`sspacia_welcomed_${user.id}`);
      if (!hasSeenWelcome) {
        const timer = setTimeout(() => setShowWelcome(true), 1500);
        return () => clearTimeout(timer);
      }
    }
  }, [user, isLoading, isRegularUser, needsProfileCompletion]);

  const closeWelcome = () => {
    setShowWelcome(false);
    if (user?.id) {
      localStorage.setItem(`sspacia_welcomed_${user.id}`, 'true');
    }
  };

  useEffect(() => {
    if (!isLoading) {
      if (!user) {
        router.push('/login');
      } else if (isRole('ADMIN')) {
        router.push('/admin/dashboard');
      } else if (isRole('MANAGER')) {
        router.push('/manager/dashboard');
      }
    }
  }, [user, isLoading, router, isRole]);

  const handleLogout = async () => {
    try {
      await logout();
      toast.success('Logged out successfully');
    } catch {
      toast.error('Logout failed');
    }
  };

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    try {
      const res = await fetch('/api/auth/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profileData),
      });

      if (!res.ok) throw new Error('Failed to update profile');
      toast.success('Profile created successfully!');
      await refreshUser();
    } catch {
      toast.error('Could not save profile. Please try again.');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleSkipProfile = () => {
    if (user?.id) {
      localStorage.setItem(`sspacia_skipped_profile_${user.id}`, 'true');
      setHasSkippedProfile(true);
    }
  };

  if (isLoading || !user || isRole('ADMIN') || isRole('MANAGER')) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--surface)]">
        <Loader2 className="h-10 w-10 text-[var(--primary)] animate-spin" />
      </div>
    );
  }

  return (
    <div className="h-screen overflow-hidden bg-[var(--surface)] flex relative font-sans">
      {/* ── Welcome Dialog: One-Time Onboarding ── */}
      <AnimatePresence>
        {showWelcome && (
          <div className="fixed inset-0 z-[999] flex items-center justify-center p-6 bg-[var(--surface-low)]/60 backdrop-blur-xl">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative max-w-lg w-full bg-[var(--surface-lowest)] shadow-[0_30px_60px_rgba(0,0,0,0.08)] p-12 md:p-14 border border-[var(--outline-variant)] overflow-hidden rounded-none group"
            >
               <div className="absolute top-0 right-0 w-48 h-48 bg-[var(--primary)]/5 blur-[80px] -mr-16 -mt-16 group-hover:bg-[var(--primary)]/10 transition-colors duration-1000" />
               <button 
                onClick={closeWelcome}
                className="absolute top-10 right-10 p-3 hover:bg-[var(--primary)]/10 rounded-none transition-all group/btn"
                title="Dismiss"
              >
                <X className="h-5 w-5 text-[#616161] group-hover/btn:text-[var(--primary)] transition-all duration-300" />
              </button>

              <div className="relative z-10 space-y-10">
                 <div className="h-16 w-16 bg-[var(--primary)]/10 rounded-none flex items-center justify-center border border-[var(--primary)]/10 group-hover:scale-105 transition-transform duration-500">
                   <Sparkles className="h-8 w-8 text-[var(--primary)]" />
                 </div>
                 
                 <div className="space-y-4">
                    <h2 className="font-display text-4xl font-bold tracking-tight text-[var(--primary)] uppercase leading-none">
                      Welcome to <br />
                      <span className="text-[#1B1C1C]">Sspacia.</span>
                    </h2>
                    <p className="text-base text-[#616161] font-medium leading-relaxed opacity-70 uppercase tracking-tighter">
                      Experience Ahmedabad&apos;s workspace ecosystem.
                    </p>
                 </div>

                 <div className="pt-4 flex flex-col gap-4">
                    <button 
                      onClick={closeWelcome}
                      className="w-full bg-[#1B1B1B] text-white py-5 rounded-none font-bold text-[11px] uppercase tracking-[0.2em] shadow-lg hover:bg-[var(--primary)] active:scale-[0.98] transition-all duration-300"
                    >
                      Initialize Dashboard
                    </button>

                 </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {needsProfileCompletion && (
          <div className="fixed inset-0 z-[9999] bg-[var(--surface-lowest)] overflow-y-auto w-full h-full flex flex-col md:p-10">
            <motion.div 
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              className="relative max-w-5xl w-full mx-auto px-10 py-16 md:py-20 flex-1 flex flex-col justify-center bg-[var(--surface-lowest)] rounded-none border-none md:border border-[var(--outline-variant)] shadow-2xl overflow-hidden"
            >
               <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-[var(--primary)]/5 blur-[120px] -mr-[200px] -mt-[200px] pointer-events-none" />
               <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-[var(--primary)]/5 blur-[120px] -ml-[200px] -mb-[200px] pointer-events-none" />

               <button 
                onClick={handleSkipProfile}
                className="absolute top-8 right-8 md:top-12 md:right-12 p-3 hover:bg-[var(--primary)]/5 rounded-none transition-all group z-20"
                title="Dismiss"
              >
                <X className="h-6 w-6 text-[#9E9E9E] group-hover:text-[var(--primary)] transition-all duration-300" />
              </button>

              <div className="space-y-14 relative z-10">
                 <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-8">
                   <div>
                      <h2 className="font-display text-5xl md:text-6xl font-bold text-[var(--primary)] tracking-tighter italic uppercase leading-none">Update <br /><span className="text-[#1B1C1C] not-italic">Profile</span></h2>
                   </div>
                   <div className="h-24 w-24 bg-[var(--primary)]/10 rounded-none flex items-center justify-center shrink-0 border border-[var(--primary)]/20">
                     <User className="h-10 w-10 text-[var(--primary)]" />
                   </div>
                 </div>

                 <form onSubmit={handleProfileSubmit} className="space-y-14">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-16">
                      <div className="space-y-10">
                        <div className="space-y-4">
                           <div className="flex items-center gap-3 ml-1 mb-2">
                              <div className="h-6 w-6 bg-[var(--primary)]/5 rounded-none flex items-center justify-center text-[var(--primary)]">
                                 <User size={14} />
                              </div>
                              <h3 className="text-[9px] font-black uppercase tracking-[0.2em] text-[#1B1C1C] opacity-40">Personal Information</h3>
                           </div>
                           
                           <div className="space-y-8">
                              <div className="space-y-2.5">
                                <label className="text-[9px] font-bold text-[#9E9E9E] uppercase tracking-[0.1em] ml-1">Designation <span className="text-red-500">*</span></label>
                                <div className="relative group/field">
                                  <Briefcase className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9E9E9E] group-focus-within/field:text-[var(--primary)] transition-colors" />
                                  <input required type="text" value={profileData.designation} onChange={e => setProfileData(p => ({...p, designation: e.target.value}))} className="w-full pl-14 pr-5 py-4 rounded-none border border-[var(--outline-variant)] focus:border-[var(--primary)] outline-none text-[14px] transition-all bg-[var(--surface-low)] font-bold text-[#1B1C1C] placeholder:text-[#9E9E9E]/40" placeholder="E.g., Manager" />
                                </div>
                              </div>

                              <div className="space-y-2.5">
                                <label className="text-[9px] font-bold text-[#9E9E9E] uppercase tracking-[0.1em] ml-1">Contact Number <span className="text-red-500">*</span></label>
                                <div className="relative group/field">
                                  <Phone className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9E9E9E] group-focus-within/field:text-[var(--primary)] transition-colors" />
                                  <input required type="tel" value={profileData.phone} onChange={e => setProfileData(p => ({...p, phone: e.target.value}))} className="w-full pl-14 pr-5 py-4 rounded-none border border-[var(--outline-variant)] focus:border-[var(--primary)] outline-none text-[14px] transition-all bg-[var(--surface-low)] font-bold text-[#1B1C1C] placeholder:text-[#9E9E9E]/40" placeholder="+91 00000 00000" />
                                </div>
                              </div>
                           </div>
                        </div>
                      </div>

                      <div className="space-y-10">
                        <div className="space-y-4">
                           <div className="flex items-center gap-3 ml-1 mb-2">
                              <div className="h-6 w-6 bg-[var(--primary)]/5 rounded-none flex items-center justify-center text-[var(--primary)]">
                                 <Building2 size={14} />
                              </div>
                              <h3 className="text-[9px] font-black uppercase tracking-[0.2em] text-[#1B1C1C] opacity-40">Company Details</h3>
                           </div>

                           <div className="space-y-8">
                              <div className="space-y-2.5">
                                <label className="text-[9px] font-bold text-[#9E9E9E] uppercase tracking-[0.1em] ml-1">Company Name <span className="text-red-500">*</span></label>
                                <div className="relative group/field">
                                  <Building2 className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9E9E9E] group-focus-within/field:text-[var(--primary)] transition-colors" />
                                  <input required type="text" value={profileData.companyName} onChange={e => setProfileData(p => ({...p, companyName: e.target.value}))} className="w-full pl-14 pr-5 py-4 rounded-none border border-[var(--outline-variant)] focus:border-[var(--primary)] outline-none text-[14px] transition-all bg-[var(--surface-low)] font-bold text-[#1B1C1C] placeholder:text-[#9E9E9E]/40" placeholder="Your Company" />
                                </div>
                              </div>

                              <div className="grid grid-cols-2 gap-6">
                                <div className="space-y-2.5">
                                  <label className="text-[9px] font-bold text-[#9E9E9E] uppercase tracking-[0.1em] ml-1">City</label>
                                  <input type="text" value={profileData.companyCity} onChange={e => setProfileData(p => ({...p, companyCity: e.target.value}))} className="w-full px-5 py-4 rounded-none border border-[var(--outline-variant)] focus:border-[var(--primary)] outline-none text-[14px] transition-all bg-[var(--surface-low)] font-bold text-[#1B1C1C] placeholder:text-[#9E9E9E]/40" placeholder="Ahmedabad" />
                                </div>
                                <div className="space-y-2.5">
                                  <label className="text-[9px] font-bold text-[#9E9E9E] uppercase tracking-[0.1em] ml-1">Postal Code</label>
                                  <input type="text" value={profileData.companyZip} onChange={e => setProfileData(p => ({...p, companyZip: e.target.value}))} className="w-full px-5 py-4 rounded-none border border-[var(--outline-variant)] focus:border-[var(--primary)] outline-none text-[14px] transition-all bg-[var(--surface-low)] font-bold text-[#1B1C1C] placeholder:text-[#9E9E9E]/40" placeholder="380001" />
                                </div>
                              </div>
                           </div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="pt-12 border-t border-[var(--outline-variant)]/40 flex flex-col sm:flex-row items-center justify-between gap-10">
                      <button 
                        type="button" 
                        onClick={handleSkipProfile} 
                        className="w-full sm:w-auto px-8 py-4 rounded-none font-bold text-[10px] text-[#616161] hover:text-[var(--primary)] hover:bg-[var(--primary)]/5 transition-all uppercase tracking-[0.2em]"
                      >
                        Skip
                      </button>
                      <button 
                        disabled={savingProfile} 
                        type="submit" 
                        className="w-full sm:w-auto bg-[#1B1B1B] text-white px-12 py-5 rounded-none font-bold text-[11px] uppercase tracking-[0.3em] shadow-xl hover:bg-[var(--primary)] active:scale-[0.98] transition-all duration-300 disabled:opacity-70 flex items-center justify-center gap-4 group/btn"
                      >
                        {savingProfile ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
                        {savingProfile ? 'Updating...' : 'Save Profile'}
                        {!savingProfile && <ArrowRight className="w-5 h-5 group-hover/btn:translate-x-1 transition-transform duration-300" />}
                      </button>
                    </div>
                 </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>


      {/* Sidebar */}
      <aside
        className={`${isSidebarOpen ? 'w-80' : 'w-24'
          } bg-[var(--surface-lowest)] border-r border-[var(--outline-variant)]/30 transition-all duration-500 cubic-bezier(0.4, 0, 0.2, 1) flex flex-col z-50 relative`}
      >
        <button
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          className="absolute -right-3.5 top-10 h-7 w-7 bg-[var(--surface-lowest)] border border-[var(--outline-variant)] text-[var(--primary)] shadow-sm hover:bg-[var(--primary)] hover:text-white transition-all z-[60] flex items-center justify-center rounded-none"
        >
          {isSidebarOpen ? <ChevronLeft size={14} /> : <ChevronRight size={14} />}
        </button>

        <div className="p-8 flex items-center justify-between overflow-hidden">
          <AnimatePresence mode="wait">
            {isSidebarOpen ? (
              <motion.div
                key="logo-full"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="font-display text-xl font-bold text-[var(--primary)] whitespace-nowrap uppercase tracking-tighter italic"
              >
                SSPACIA <span className="text-[#1B1C1C] opacity-30 ml-1">MEMBER</span>
              </motion.div>
            ) : (
              <motion.div
                key="logo-mini"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className="font-display font-bold text-2xl text-[var(--primary)] mx-auto italic"
              >
                S
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <nav className="flex-1 px-5 py-6 space-y-2 overflow-y-auto no-scrollbar">
          {(isRole('COMMUNITY_MANAGER') || isRole('MANAGER') || isRole('ADMIN')
            ? [...sidebarItems, { name: 'Client Master', href: '/manager/Invoices', icon: Receipt }]
            : sidebarItems
          ).map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-4 px-5 py-4 rounded-none transition-all group relative ${isActive
                    ? 'bg-[var(--primary)] text-white'
                    : 'text-[#616161] hover:bg-[var(--primary)]/5 hover:text-[var(--primary)]'
                  }`}
              >
                <item.icon size={22} className={`${isActive ? '' : 'opacity-70 group-hover:opacity-100 group-hover:scale-110'} transition-all`} />
                {isSidebarOpen && (
                  <span className="font-bold text-[12px] whitespace-nowrap uppercase tracking-widest">{item.name}</span>
                )}
                {!isSidebarOpen && (
                  <div className={`absolute left-full ml-4 px-3 py-1.5 bg-[#1B1C1C] text-white text-[9px] font-bold uppercase tracking-widest rounded-none opacity-0 translate-x-[-5px] group-hover:opacity-100 group-hover:translate-x-0 transition-all shadow-xl pointer-events-none whitespace-nowrap z-[100]`}>
                    {item.name}
                  </div>
                )}
                {isActive && (
                   <motion.div layoutId="active-pill" className="absolute right-0 w-1 h-full bg-white/30" />
                )}
              </Link>
            );
          })}
        </nav>

        {user && (
          <div className="border-t border-[var(--outline-variant)]/20 p-6 shrink-0 flex flex-col gap-4">
            {isSidebarOpen ? (
              <div 
                onClick={() => setIsProfileModalOpen(true)}
                className="flex items-center gap-4 px-1 mb-2 w-full group cursor-pointer hover:opacity-80 transition-opacity"
                title="Manage Profile"
              >
                <div className="h-10 w-10 shrink-0 rounded-none bg-[var(--surface-low)] text-[var(--primary)] flex items-center justify-center border border-[var(--outline-variant)] font-display font-bold text-base transition-all group-hover:bg-[var(--primary)] group-hover:text-white">
                  {user.name?.charAt(0).toUpperCase()}
                </div>
                <div className="w-full min-w-0 overflow-hidden">
                  <p className="text-[12px] font-bold text-[#1B1C1C] truncate w-full uppercase tracking-tight">{user.name}</p>
                  <p className="text-[9px] text-[var(--primary)] font-bold uppercase tracking-widest opacity-60">{user.role || 'Member'}</p>
                </div>
              </div>
            ) : (
              <div 
                onClick={() => setIsProfileModalOpen(true)}
                className="flex justify-center mb-2 w-full cursor-pointer hover:opacity-80 transition-opacity"
                title="Manage Profile"
              >
                <div className="h-10 w-10 shrink-0 rounded-none bg-[var(--surface-low)] text-[var(--primary)] flex items-center justify-center border border-[var(--outline-variant)] font-display font-bold text-base shadow-inner shadow-black/5">
                  {user.name?.charAt(0).toUpperCase()}
                </div>
              </div>
            )}

            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-4 px-5 py-3.5 text-[#616161] hover:bg-neutral-100 hover:text-black rounded-none transition-all group"
              title="Logout"
            >
              <LogOut size={18} className="shrink-0 group-hover:-translate-x-0.5 transition-transform" />
              {isSidebarOpen && <span className="font-bold text-[11px] uppercase tracking-widest">Logout</span>}
            </button>
          </div>
        )}
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 relative">
        <div className="flex-1 p-10 overflow-y-auto relative z-0 bg-[var(--surface)] custom-scrollbar">
          {children}
        </div>
      </main>

      <ManageProfileModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
      />
    </div>
  );
}
