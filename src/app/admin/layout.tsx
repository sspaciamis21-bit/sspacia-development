'use client';

import { useState, useEffect } from 'react';
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
  Shield,
  Calendar,
  Sparkles,
  ShieldCheck,
  FileText,
  Mail,
} from 'lucide-react';
import { toast } from 'sonner';

import { useAuth } from '@/context/AuthContext';
import { useSidebar } from '@/context/SidebarContext';
import { ManageProfileModal } from '@/components/profile/ManageProfileModal';
import { NotificationBell } from '@/components/notifications/NotificationBell';
import { TestEmailModal } from '@/components/admin/TestEmailModal';

const sidebarItems = [
  { name: 'Dashboard', href: '/admin/dashboard', icon: LayoutDashboard },
  { name: 'Locations', href: '/admin/locations', icon: MapPin },
  { name: 'Products', href: '/admin/products', icon: Package },
  { name: 'Amenities', href: '/admin/amenities', icon: Sparkles },
  { name: 'Users', href: '/admin/users', icon: Users },
  { name: 'Roles', href: '/admin/roles', icon: Shield },
  { name: 'Tickets', href: '/admin/tickets', icon: Ticket },
  { name: 'Bookings', href: '/admin/bookings', icon: Calendar },
  { name: 'Contracts', href: '/manager/contracts', icon: ShieldCheck },
  { name: 'Documents', href: '/manager/documents', icon: FileText },
  { name: 'Client Master', href: '/admin/client-master', icon: FileText },
  { name: 'Invoices', href: '/admin/Invoices', icon: FileText },

];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isSidebarOpen, setIsSidebarOpen } = useSidebar();
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isTestEmailModalOpen, setIsTestEmailModalOpen] = useState(false);
  const { user, isLoading, logout, isRole } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading) {
      if (!user) {
        router.push('/login');
      } else if (!isRole('ADMIN')) {
        toast.error('Unauthorized access');
        router.push('/');
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

  if (isLoading || !user || !isRole('ADMIN')) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8F9FA]">
        <Loader2 className="h-8 w-8 text-[#006064] animate-spin" />
      </div>
    );
  }

  return (
    <div className="h-screen overflow-hidden bg-[#F8F9FA] flex">
      {/* Sidebar */}
      <aside
        className={`${isSidebarOpen ? 'w-72' : 'w-20'
          } bg-white border-r border-[var(--outline-variant)]/40 transition-all duration-300 ease-in-out flex flex-col z-50 relative`}
      >
        <button
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          className="absolute -right-3 top-8 p-1.5 bg-white border border-[var(--outline-variant)]/60 rounded-none text-[#1B1C1C] shadow-sm hover:bg-[var(--primary)] hover:text-white transition-all z-[60]"
        >
          {isSidebarOpen ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
        </button>

        <div className="p-8 flex items-center justify-between overflow-hidden">
          <AnimatePresence mode="wait">
            {isSidebarOpen ? (
              <motion.div
                key="logo-full"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="font-display font-bold text-xl text-[#1B1C1C] whitespace-nowrap tracking-tighter"
              >
                SSPACIA <span className="text-[var(--primary)]">ADMIN</span>
              </motion.div>
            ) : (
              <motion.div
                key="logo-mini"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="font-display font-black text-xl text-[var(--primary)] mx-auto"
              >
                S
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <nav className="flex-1 px-4 py-8 space-y-2 overflow-y-auto">
          {sidebarItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-4 px-4 py-3.5 rounded-none transition-all group relative ${isActive
                  ? 'bg-[var(--primary)] text-white'
                  : 'text-[#616161] hover:bg-neutral-50 hover:text-[#1B1C1C]'
                  }`}
              >
                <item.icon size={20} className={`${isActive ? 'text-white' : 'group-hover:scale-110 transition-transform'}`} />
                {isSidebarOpen && (
                  <span className="font-bold text-[10px] uppercase tracking-[0.2em] whitespace-nowrap">{item.name}</span>
                )}
                {isActive && (
                  <motion.div
                    layoutId="active-indicator"
                    className="absolute left-0 w-1 h-8 bg-white/40"
                  />
                )}
              </Link>
            );
          })}
        </nav>

        {user && (
          <div className="border-t border-[var(--outline-variant)]/30 p-6 shrink-0 flex flex-col gap-4">
            {isSidebarOpen ? (
              <div 
                onClick={() => setIsProfileModalOpen(true)}
                className="flex items-center gap-4 px-2 w-full cursor-pointer hover:opacity-80 transition-opacity"
                title="Manage Profile"
              >
                <div className="h-10 w-10 shrink-0 rounded-none bg-white text-[var(--primary)] flex items-center justify-center border border-[var(--outline-variant)]/40 font-black text-sm">
                  {user.name?.charAt(0).toUpperCase()}
                </div>
                <div className="w-full min-w-0 overflow-hidden">
                  <p className="text-[11px] font-black text-[#1B1C1C] truncate w-full uppercase tracking-widest">{user.name}</p>
                  <p className="text-[9px] text-[#616161] font-bold uppercase tracking-[0.3em] truncate opacity-50">{user.role}</p>
                </div>
              </div>
            ) : (
              <div 
                onClick={() => setIsProfileModalOpen(true)}
                className="flex justify-center w-full cursor-pointer hover:opacity-80 transition-opacity"
                title="Manage Profile"
              >
                <div className="h-10 w-10 shrink-0 rounded-none bg-white text-[var(--primary)] flex items-center justify-center border border-[var(--outline-variant)]/40 font-black text-sm">
                  {user.name?.charAt(0).toUpperCase()}
                </div>
              </div>
            )}

            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-4 px-3 py-3 text-[#616161] hover:bg-neutral-100 hover:text-red-600 rounded-none transition-all group border border-transparent hover:border-red-100"
              title="Logout"
            >
              <LogOut size={18} className="shrink-0 group-hover:translate-x-1 transition-transform" />
              {isSidebarOpen && <span className="font-bold text-[9px] uppercase tracking-[0.3em] whitespace-nowrap">DISPATCH NODE</span>}
            </button>
          </div>
        )}
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 relative">
        {/* Top Navigation / Notification Header */}
        <header className="h-16 bg-white border-b border-[var(--outline-variant)]/40 px-8 flex items-center justify-between z-40 shrink-0 shadow-xs">
          <div className="flex items-center gap-3">
            <span className="text-[11px] font-black uppercase tracking-[0.2em] text-[#006064]">
              SSPACIA Admin Portal
            </span>
          </div>

          <div className="flex items-center gap-4">
            <NotificationBell />
          </div>
        </header>

        <div className="flex-1 p-10 overflow-y-auto relative z-0">
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
