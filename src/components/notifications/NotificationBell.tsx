'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'motion/react';
import {
  Bell,
  Calendar,
  AlertTriangle,
  Clock,
  UserCheck,
  Phone,
  Mail,
  ChevronRight,
  RefreshCw,
  X,
  Building2,
  MapPin,
  CheckCircle2,
  Lock,
  FileText,
  ExternalLink,
  ShieldAlert,
  Ticket as TicketIcon
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

interface ContactPerson {
  id?: number;
  name: string;
  designation?: string | null;
  mobileNo?: string | null;
  email?: string | null;
}

interface NotificationItem {
  id: number;
  srNo?: number;
  companyName: string;
  agreementStartDate?: string | null;
  agreementEndDate?: string | null;
  lockinEndDate?: string | null;
  targetDate?: string;
  noticePeriodMonths?: number | null;
  noticePeriodApplicable?: string | null;
  daysRemaining?: number;
  isExpired?: boolean;
  statusTag?: 'EXPIRED' | 'URGENT' | 'DUE_SOON';
  type: 'AGREEMENT' | 'LOCK_IN' | 'TICKET_ESCALATION';
  cabinName?: string | null;
  noOfSeats?: number | null;
  totalAmount?: number | null;
  contactPersons?: ContactPerson[];
  locationName?: string | null;
  // Ticket escalation fields
  ticketNumber?: string;
  reporterName?: string;
  email?: string;
  phone?: string;
  category?: string;
  subCategory?: string;
  description?: string;
  createdAt?: string;
  hoursOpen?: number;
  overdueHours?: number;
  statusName?: string;
}

interface NotificationSummary {
  agreementCount: number;
  lockinCount: number;
  ticketCount: number;
  totalCount: number;
}

export function NotificationBell() {
  const { isRole } = useAuth();
  const router = useRouter();
  
  const [isOpen, setIsOpen] = useState(false);
  const [isHoveredBell, setIsHoveredBell] = useState(false);
  const [activeTab, setActiveTab] = useState<'AGREEMENT' | 'LOCK_IN' | 'TICKET'>('AGREEMENT');
  
  const [summary, setSummary] = useState<NotificationSummary>({ agreementCount: 0, lockinCount: 0, ticketCount: 0, totalCount: 0 });
  const [agreements, setAgreements] = useState<NotificationItem[]>([]);
  const [lockins, setLockins] = useState<NotificationItem[]>([]);
  const [escalatedTickets, setEscalatedTickets] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(false);
  
  const [expandedContactId, setExpandedContactId] = useState<number | null>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Fetch agreement, lock-in, and 48h ticket notifications
  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/agreement-notifications');
      if (res.ok) {
        const json = await res.json();
        if (json.success) {
          const sum = json.summary || { agreementCount: 0, lockinCount: 0, ticketCount: 0, totalCount: 0 };
          setSummary(sum);
          setAgreements(json.agreements || []);
          setLockins(json.lockins || []);
          setEscalatedTickets(json.escalatedTickets || []);

          // Auto-select tab with alerts if active tab is empty
          if (sum.agreementCount === 0 && sum.lockinCount > 0) {
            setActiveTab('LOCK_IN');
          } else if (sum.agreementCount === 0 && sum.lockinCount === 0 && sum.ticketCount > 0) {
            setActiveTab('TICKET');
          }
        }
      }
    } catch (err) {
      console.error('Failed to load notifications', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  // Close popover on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const totalCount = summary.totalCount;

  const handleNavigateToClientMaster = (companyName: string) => {
    setIsOpen(false);
    const targetPath = isRole('ADMIN') ? '/admin/client-master' : '/manager/client-master';
    router.push(`${targetPath}?search=${encodeURIComponent(companyName)}`);
  };

  const handleNavigateToTickets = () => {
    setIsOpen(false);
    const targetPath = isRole('ADMIN') ? '/admin/tickets' : '/manager/tickets';
    router.push(targetPath);
  };

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return 'N/A';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      });
    } catch {
      return dateStr;
    }
  };

  const getActiveList = () => {
    if (activeTab === 'AGREEMENT') return agreements;
    if (activeTab === 'LOCK_IN') return lockins;
    return escalatedTickets;
  };

  const activeList = getActiveList();

  return (
    <div className="relative" ref={popoverRef}>
      {/* Bell Button Wrapper with Hover Summary Listener */}
      <div
        className="relative inline-block"
        onMouseEnter={() => setIsHoveredBell(true)}
        onMouseLeave={() => setIsHoveredBell(false)}
      >
        <button
          type="button"
          onClick={() => {
            setIsOpen((prev) => !prev);
            setIsHoveredBell(false);
          }}
          className={`relative p-2.5 bg-white hover:bg-neutral-100 border text-[#1B1C1C] transition-all flex items-center justify-center group shadow-xs focus:outline-none ${
            isOpen ? 'border-[#006064] bg-teal-50/50' : 'border-[var(--outline-variant)]/60'
          }`}
          title="System Alerts & Escalations"
          aria-label="System Alerts & Escalations"
        >
          <Bell size={18} className="text-[#1B1C1C] group-hover:scale-110 transition-transform" />

          {/* Red Notification Badge */}
          {totalCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 h-5 min-w-5 px-1.5 bg-red-600 text-white text-[10px] font-black flex items-center justify-center border-2 border-white rounded-full animate-pulse shadow-xs">
              {totalCount > 99 ? '99+' : totalCount}
            </span>
          )}
        </button>

        {/* Hover Summary Card */}
        <AnimatePresence>
          {isHoveredBell && !isOpen && (
            <motion.div
              initial={{ opacity: 0, y: 5, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 5, scale: 0.95 }}
              transition={{ duration: 0.15 }}
              className="absolute right-0 top-full mt-2 w-72 bg-[#1B1C1C] text-white p-3.5 shadow-2xl z-50 border border-neutral-700 pointer-events-none text-xs"
            >
              <div className="text-[10px] font-black uppercase tracking-widest text-teal-400 border-b border-neutral-800 pb-1.5 mb-2 flex items-center justify-between">
                <span className="flex items-center gap-1">
                  <Bell size={12} /> Live Operations Summary
                </span>
                <span className="bg-red-600 text-white px-1.5 py-0.2 rounded-full font-mono text-[9px]">
                  {totalCount} Total
                </span>
              </div>

              <div className="space-y-1.5 text-[11px]">
                <div className="flex items-center justify-between py-1 px-2 bg-neutral-800/80 border border-neutral-700/60">
                  <span className="flex items-center gap-1.5 text-neutral-200">
                    <FileText size={12} className="text-teal-400" /> Agreements (60d):
                  </span>
                  <span className={`font-bold font-mono ${summary.agreementCount > 0 ? 'text-amber-400' : 'text-neutral-400'}`}>
                    {summary.agreementCount}
                  </span>
                </div>

                <div className="flex items-center justify-between py-1 px-2 bg-neutral-800/80 border border-neutral-700/60">
                  <span className="flex items-center gap-1.5 text-neutral-200">
                    <Lock size={12} className="text-amber-400" /> Lock-Ins (15d):
                  </span>
                  <span className={`font-bold font-mono ${summary.lockinCount > 0 ? 'text-red-400' : 'text-neutral-400'}`}>
                    {summary.lockinCount}
                  </span>
                </div>

                <div className="flex items-center justify-between py-1 px-2 bg-neutral-800/80 border border-neutral-700/60">
                  <span className="flex items-center gap-1.5 text-neutral-200">
                    <ShieldAlert size={12} className="text-red-400" /> Escalated Tickets (&gt;48h):
                  </span>
                  <span className={`font-bold font-mono ${summary.ticketCount > 0 ? 'text-red-400 animate-pulse' : 'text-neutral-400'}`}>
                    {summary.ticketCount}
                  </span>
                </div>
              </div>

              <div className="mt-2.5 pt-1.5 border-t border-neutral-800 text-[9px] text-neutral-400 text-center italic">
                Click bell icon to open sectioned detail views
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Main YouTube-Style Sectioned Popover */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="absolute right-0 mt-3 w-[390px] sm:w-[480px] bg-white border border-neutral-300 shadow-2xl z-50 overflow-hidden text-xs"
          >
            {/* Header */}
            <div className="p-4 bg-[#006064] text-white border-b border-teal-800">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <div className="h-8 w-8 bg-teal-800/80 flex items-center justify-center text-teal-200">
                    <Bell size={16} />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm uppercase tracking-wider flex items-center gap-2">
                      Control Room Alerts
                      {totalCount > 0 && (
                        <span className="bg-red-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full">
                          {totalCount} Alerts
                        </span>
                      )}
                    </h3>
                    <p className="text-[10px] text-teal-100 font-light mt-0.5">
                      Agreements, Lock-ins &amp; 48h Escalations
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={fetchNotifications}
                    className="p-1.5 hover:bg-teal-700 text-teal-200 hover:text-white transition-colors"
                    title="Refresh Alerts"
                  >
                    <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsOpen(false)}
                    className="p-1.5 hover:bg-teal-700 text-teal-200 hover:text-white transition-colors"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>

              {/* 3 Section Tabs */}
              <div className="grid grid-cols-3 gap-1 bg-teal-950/70 p-1 border border-teal-700/60">
                <button
                  type="button"
                  onClick={() => setActiveTab('AGREEMENT')}
                  className={`py-2 px-1.5 text-[9px] font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-1 ${
                    activeTab === 'AGREEMENT'
                      ? 'bg-white text-[#006064] shadow-xs'
                      : 'text-teal-200 hover:text-white hover:bg-teal-800/50'
                  }`}
                >
                  <FileText size={11} />
                  <span>Agreements</span>
                  <span className={`px-1 rounded-full font-mono text-[8px] ${
                    activeTab === 'AGREEMENT' ? 'bg-[#006064] text-white' : 'bg-teal-800 text-teal-100'
                  }`}>
                    {summary.agreementCount}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('LOCK_IN')}
                  className={`py-2 px-1.5 text-[9px] font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-1 ${
                    activeTab === 'LOCK_IN'
                      ? 'bg-white text-amber-900 shadow-xs'
                      : 'text-amber-200 hover:text-white hover:bg-teal-800/50'
                  }`}
                >
                  <Lock size={11} />
                  <span>Lock-Ins</span>
                  <span className={`px-1 rounded-full font-mono text-[8px] ${
                    activeTab === 'LOCK_IN' ? 'bg-amber-600 text-white' : 'bg-amber-900/80 text-amber-100'
                  }`}>
                    {summary.lockinCount}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('TICKET')}
                  className={`py-2 px-1.5 text-[9px] font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-1 ${
                    activeTab === 'TICKET'
                      ? 'bg-red-600 text-white shadow-xs font-black'
                      : 'text-red-200 hover:text-white hover:bg-red-900/40'
                  }`}
                >
                  <ShieldAlert size={11} />
                  <span>48h Escalations</span>
                  <span className="px-1 rounded-full font-mono text-[8px] bg-red-800 text-white">
                    {summary.ticketCount}
                  </span>
                </button>
              </div>
            </div>

            {/* Notification List Container */}
            <div className="max-h-[440px] overflow-y-auto divide-y divide-neutral-100">
              {loading && activeList.length === 0 ? (
                <div className="p-8 text-center text-neutral-400 space-y-2">
                  <RefreshCw size={24} className="animate-spin mx-auto text-[#006064]" />
                  <p className="text-xs font-bold">Checking alerts...</p>
                </div>
              ) : activeList.length === 0 ? (
                <div className="p-10 text-center space-y-3">
                  <div className="h-12 w-12 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto text-xl">
                    <CheckCircle2 size={24} />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-[#1B1C1C]">
                      {activeTab === 'AGREEMENT'
                        ? 'No Agreements Ending Soon!'
                        : activeTab === 'LOCK_IN'
                        ? 'No Lock-ins Ending Soon!'
                        : 'No 48h Overdue Tickets!'}
                    </h4>
                    <p className="text-xs text-neutral-500 font-light mt-1 max-w-xs mx-auto">
                      {activeTab === 'AGREEMENT'
                        ? 'No active client agreements are ending in the next 60 days.'
                        : activeTab === 'LOCK_IN'
                        ? 'No active client lock-in periods are ending in the next 15 days.'
                        : 'All client support tickets are being resolved within the 48-hour SLA.'}
                    </p>
                  </div>
                </div>
              ) : activeTab === 'TICKET' ? (
                /* 🚨 ESCALATED SUPPORT TICKETS LIST (>48h SLA) */
                activeList.map((item) => (
                  <div key={item.id} className="p-4 hover:bg-red-50/40 transition-colors relative space-y-2 bg-red-50/20">
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-0.5">
                        <span className="text-[10px] font-mono font-bold text-neutral-500 uppercase">
                          ID: {item.ticketNumber}
                        </span>
                        <h4 className="font-bold text-sm text-[#1B1C1C] flex items-center gap-1.5">
                          <Building2 size={14} className="text-red-600 shrink-0" />
                          <span>{item.companyName}</span>
                        </h4>
                      </div>

                      <span className="shrink-0 px-2 py-0.5 bg-red-600 text-white text-[9px] font-black uppercase tracking-wider shadow-xs border border-red-700 animate-pulse">
                        ESCALATED ({item.hoursOpen}h Open)
                      </span>
                    </div>

                    <div className="text-xs text-neutral-700 bg-white p-2.5 border border-red-200 space-y-1">
                      <div className="flex items-center justify-between text-[11px] font-bold text-red-900 border-b border-neutral-100 pb-1">
                        <span>Category: {item.category} {item.subCategory ? `› ${item.subCategory}` : ''}</span>
                        <span className="font-mono text-[10px] text-red-600">+{item.overdueHours}h overdue</span>
                      </div>
                      <p className="line-clamp-2 text-neutral-800 text-[11px] font-medium pt-0.5">
                        "{item.description}"
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] pt-1">
                      <div className="text-neutral-600 font-medium">
                        Reporter: <strong className="text-[#1B1C1C]">{item.reporterName}</strong> ({item.email})
                      </div>

                      <button
                        type="button"
                        onClick={handleNavigateToTickets}
                        className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white font-bold text-[10px] uppercase tracking-wider transition-colors flex items-center gap-1 shadow-xs"
                      >
                        Resolve Ticket <ChevronRight size={12} />
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                /* AGREEMENT / LOCK-IN ALERTS LIST */
                activeList.map((item) => {
                  const isExpanded = expandedContactId === item.id;

                  return (
                    <div
                      key={item.id}
                      className="p-4 hover:bg-neutral-50/90 transition-colors relative group"
                    >
                      {/* Top Info Bar */}
                      <div className="flex items-start justify-between gap-2 mb-1.5">
                        <button
                          type="button"
                          onClick={() => handleNavigateToClientMaster(item.companyName)}
                          className="font-bold text-sm text-[#1B1C1C] hover:text-[#006064] text-left leading-snug flex items-center gap-1.5 group-hover:underline"
                        >
                          <Building2 size={15} className="text-[#006064] shrink-0" />
                          <span>{item.companyName}</span>
                        </button>

                        {/* Status Tag Pill */}
                        <span
                          className={`shrink-0 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider ${
                            item.statusTag === 'EXPIRED'
                              ? 'bg-red-100 text-red-800 border border-red-200'
                              : item.statusTag === 'URGENT'
                              ? 'bg-amber-100 text-amber-800 border border-amber-200'
                              : 'bg-teal-50 text-teal-800 border border-teal-200'
                          }`}
                        >
                          {item.type === 'LOCK_IN' ? (
                            item.statusTag === 'EXPIRED'
                              ? `LOCK-IN EXPIRED (${Math.abs(item.daysRemaining || 0)}d ago)`
                              : `LOCK-IN ENDS (${item.daysRemaining}d left)`
                          ) : (
                            item.statusTag === 'EXPIRED'
                              ? `EXPIRED (${Math.abs(item.daysRemaining || 0)}d ago)`
                              : `${item.daysRemaining} days left`
                          )}
                        </span>
                      </div>

                      {/* Date & Details */}
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-neutral-600 mb-2.5 font-medium">
                        <div className="flex items-center gap-1 text-neutral-700">
                          {item.type === 'LOCK_IN' ? (
                            <Lock size={12} className="text-amber-600" />
                          ) : (
                            <Calendar size={12} className="text-neutral-400" />
                          )}
                          <span>
                            {item.type === 'LOCK_IN' ? 'Lock-In End: ' : 'Agreement End: '}
                            <strong className="text-[#1B1C1C]">{formatDate(item.targetDate)}</strong>
                          </span>
                        </div>

                        {item.noticePeriodMonths && (
                          <div className="text-[11px] text-amber-800 font-bold bg-amber-50 px-1.5 py-0.2 border border-amber-200">
                            Notice: {item.noticePeriodMonths} Mon ({item.noticePeriodApplicable || 'Applicable'})
                          </div>
                        )}

                        {item.cabinName && (
                          <div className="text-[11px] text-neutral-500">
                            Cabin: <span className="font-semibold text-neutral-700">{item.cabinName}</span>
                          </div>
                        )}

                        {item.locationName && (
                          <div className="flex items-center gap-1 text-[11px] text-teal-800 font-bold">
                            <MapPin size={10} /> {item.locationName}
                          </div>
                        )}
                      </div>

                      {/* Bottom Row: Contact Trigger & Action Link */}
                      <div className="flex items-center justify-between border-t border-neutral-100 pt-2 mt-2">
                        {/* Persistent Toggle Contact Person Button */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setExpandedContactId(isExpanded ? null : item.id);
                          }}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider transition-all border ${
                            isExpanded
                              ? 'bg-[#006064] text-white border-[#006064] shadow-xs'
                              : 'bg-neutral-100 hover:bg-neutral-200 text-[#1B1C1C] border-neutral-200'
                          }`}
                        >
                          <UserCheck size={12} className={isExpanded ? 'text-teal-200' : 'text-[#006064]'} />
                          <span>Contact Persons ({(item.contactPersons || []).length})</span>
                          <span className="text-[9px] opacity-70">{isExpanded ? '▲' : '▼'}</span>
                        </button>

                        {/* Open in Client Master Link */}
                        <button
                          type="button"
                          onClick={() => handleNavigateToClientMaster(item.companyName)}
                          className="text-[10px] font-bold uppercase tracking-wider text-[#006064] hover:text-black flex items-center gap-1"
                        >
                          View Record <ExternalLink size={11} />
                        </button>
                      </div>

                      {/* Inline Expandable Contact Details Drawer */}
                      <AnimatePresence>
                        {isExpanded && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.2 }}
                            className="overflow-hidden mt-2.5"
                          >
                            <div className="bg-[#00363A] text-white p-3 space-y-2 border border-teal-800 shadow-inner">
                              <div className="text-[10px] font-black uppercase tracking-widest text-teal-300 border-b border-teal-700/60 pb-1.5 flex items-center justify-between">
                                <span className="flex items-center gap-1">
                                  <UserCheck size={12} /> Contact Persons Directory
                                </span>
                                <span className="text-[9px] text-teal-200 font-normal">
                                  {item.companyName}
                                </span>
                              </div>

                              {(item.contactPersons || []).length === 0 ? (
                                <p className="text-[10px] text-teal-200/70 italic py-1">
                                  No contact persons recorded for this company.
                                </p>
                              ) : (
                                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                                  {(item.contactPersons || []).map((cp, cIdx) => (
                                    <div
                                      key={cIdx}
                                      className="bg-teal-950/80 p-2 text-xs space-y-1 border border-teal-700/50"
                                    >
                                      <div className="font-bold text-white flex items-center justify-between">
                                        <span className="text-teal-100">{cp.name}</span>
                                        {cp.designation && (
                                          <span className="text-[9px] text-teal-300 bg-teal-900/80 px-1.5 py-0.5 font-mono uppercase">
                                            {cp.designation}
                                          </span>
                                        )}
                                      </div>

                                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 pt-0.5 text-[11px]">
                                        {cp.mobileNo && (
                                          <div className="text-neutral-200 flex items-center gap-1.5">
                                            <Phone size={11} className="text-teal-400 shrink-0" />
                                            <a
                                              href={`tel:${cp.mobileNo}`}
                                              className="hover:underline font-mono text-teal-200 font-bold"
                                            >
                                              {cp.mobileNo}
                                            </a>
                                          </div>
                                        )}

                                        {cp.email && (
                                          <div className="text-neutral-300 flex items-center gap-1.5 truncate">
                                            <Mail size={11} className="text-teal-400 shrink-0" />
                                            <a
                                              href={`mailto:${cp.email}`}
                                              className="hover:underline text-teal-200 truncate font-mono text-[10px]"
                                            >
                                              {cp.email}
                                            </a>
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer */}
            {totalCount > 0 && (
              <div className="p-3 bg-[#F8F9FA] border-t border-neutral-200 text-center">
                <button
                  type="button"
                  onClick={() => {
                    setIsOpen(false);
                    const targetPath = activeTab === 'TICKET'
                      ? (isRole('ADMIN') ? '/admin/tickets' : '/manager/tickets')
                      : (isRole('ADMIN') ? '/admin/client-master' : '/manager/client-master');
                    router.push(targetPath);
                  }}
                  className="text-xs font-bold uppercase tracking-wider text-[#006064] hover:underline inline-flex items-center gap-1"
                >
                  {activeTab === 'TICKET' ? 'Manage All Tickets' : 'Manage All Records in Client Master'} <ChevronRight size={14} />
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
