'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'motion/react';
import { 
  LayoutDashboard, 
  Users, 
  Package, 
  LogOut, 
  Loader2,
  MapPin,
  ChevronLeft,
  ChevronRight,
  Ticket,
  Calendar,
  FileText,
  ShieldCheck,
  Receipt,
} from 'lucide-react';
import { toast } from 'sonner';

import { useAuth } from '@/context/AuthContext';
import { useSidebar } from '@/context/SidebarContext';
import { ManageProfileModal } from '@/components/profile/ManageProfileModal';
import { NotificationBell } from '@/components/notifications/NotificationBell';

export default function ManagerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isSidebarOpen, setIsSidebarOpen } = useSidebar();
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const { user, isLoading, logout, isRole, hasPermission } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading) {
      if (!user) {
        router.push('/login');
        return;
      }

      // Allow any role that is not USER (or explicitly ADMIN/MANAGER/COMMUNITY_MANAGER)
      // The dashboard items are driven strictly by permissions.
      if (isRole('USER')) {
        toast.error('Unauthorized access.');
        router.push('/dashboard');
        return;
      }

      // Ensure they have assigned locations if they aren't admin/community manager and just a basic staff
      if (!isRole('ADMIN') && !isRole('COMMUNITY_MANAGER') && (!user.assignedLocations || user.assignedLocations.length === 0)) {
        toast.error('No assigned locations. Contact admin.');
        router.push('/dashboard');
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

  const sidebarItems = useMemo(() => {
    const items = [
      { name: 'Dashboard', href: '/manager/dashboard', icon: LayoutDashboard }
    ];

    // Core Manager Routes
    items.push({ name: 'Products', href: '/manager/products', icon: Package });
    items.push({ name: 'Bookings', href: '/manager/bookings', icon: Calendar });
    items.push({ name: 'Tickets', href: '/manager/tickets', icon: Ticket });
    items.push({ name: 'Contracts', href: '/manager/contracts', icon: ShieldCheck });
    items.push({ name: 'Documents', href: '/manager/documents', icon: FileText });
    items.push({ name: 'Agreements', href: '/manager/agreements', icon: FileText });
    items.push({ name: 'Users', href: '/manager/users', icon: Users });
    const userEmail = user?.email?.toLowerCase() || '';
    const isAccountant = userEmail === 'ssinfrazone21@gmail.com';

    // Only non-accountants (Admin & Community Manager) see Client Master
    if (!isAccountant || isRole('ADMIN')) {
      items.push({ name: 'Client Master', href: '/manager/client-master', icon: FileText });
    }
    items.push({ name: 'Invoices', href: '/manager/Invoices', icon: Receipt });

    // Optional/Permission based routes (Keeping Locations if managed by some)
    if (hasPermission('view_location_details') || isRole('ADMIN')) {
      items.push({ name: 'Locations', href: '/manager/locations', icon: MapPin });
    }

    return items;
  }, [hasPermission, isRole]);

  if (isLoading || !user || isRole('USER')) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[var(--surface)] gap-4">
        <Loader2 size={40} className="text-[var(--primary)] animate-spin" />
        <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-[#9E9E9E] animate-pulse">Initializing...</p>
      </div>
    );
  }

  return (
    <div className="h-screen overflow-hidden bg-[var(--surface)] flex font-sans">
      <aside 
        className={`${
          isSidebarOpen ? 'w-80' : 'w-24'
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
                className="font-display text-xl font-bold text-[var(--primary)] whitespace-nowrap uppercase tracking-widest"
              >
                SSPACIA <span className="text-[#1B1C1C] opacity-30 ml-1">{user.role?.split('_')[0] || 'PORTAL'}</span>
              </motion.div>
            ) : (
              <motion.div
                key="logo-mini"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className="font-display font-bold text-2xl text-[var(--primary)] mx-auto"
              >
                S
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <nav className="flex-1 px-5 py-6 space-y-2 overflow-y-auto no-scrollbar">
          {sidebarItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-4 px-5 py-4 rounded-none transition-all group relative ${
                  isActive 
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
                  <p className="text-[9px] text-[var(--primary)] font-bold uppercase tracking-widest opacity-60 truncate">{user.role}</p>
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

      <main className="flex-1 flex flex-col min-w-0 relative">
        {/* Top Navigation / Notification Header */}
        <header className="h-16 bg-[var(--surface-lowest)] border-b border-[var(--outline-variant)]/30 px-8 flex items-center justify-between z-40 shrink-0 shadow-xs">
          <div className="flex items-center gap-3">
            <span className="text-[11px] font-black uppercase tracking-[0.2em] text-[var(--primary)]">
              SSPACIA Portal
            </span>
          </div>

          <div className="flex items-center gap-4">
            <NotificationBell />
          </div>
        </header>

        <div className="flex-1 p-8 overflow-y-auto relative z-0">
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
