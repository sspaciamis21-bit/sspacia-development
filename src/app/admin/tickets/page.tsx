"use client";

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';
import {
  Loader2,
  Ticket as TicketIcon,
  Clock,
  CheckCircle,
  AlertCircle,
  ExternalLink,
  RefreshCw,
  User as UserIcon,
  MapPin,
  Layers,
  ChevronRight,
  ShieldAlert,
  AlertTriangle,
  Filter
} from 'lucide-react';

interface TicketAttachment {
  id: number;
  url: string;
}

interface SupportTicket {
  id: number;
  ticketNumber: string;
  name: string;
  organization: string | null;
  spaceType: string | null;
  location: string | null;
  locationRel: { id: number; name: string } | null;
  productTypeId: number | null;
  productType: { id: number; name: string; displayName: string } | null;
  category: string | null;
  subCategory: string | null;
  description: string;
  status: any;
  attachments: TicketAttachment[];
  createdAt: string;
  hoursOpen?: number;
  isEscalated?: boolean;
  escalatedHours?: number;
  user: {
    name: string;
    email: string;
  } | null;
}

function Label({ htmlFor, children, required }: { htmlFor: string; children: React.ReactNode; required?: boolean }) {
  return (
    <label htmlFor={htmlFor} className="block text-[10px] font-black text-[#616161] uppercase tracking-[0.2em] mb-2">
      {children} {required && <span className="text-[var(--primary)]">*</span>}
    </label>
  );
}

export default function AdminTicketsPage() {
  const { isRole } = useAuth();
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filterMode, setFilterMode] = useState<'ALL' | 'OPEN' | 'ESCALATED'>('ALL');

  const fetchTickets = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/admin/tickets`);
      const json = await res.json();
      setTickets(json.data ?? []);
    } catch (error) {
      toast.error('Direct link failed: Signal lost');
      setTickets([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isRole('ADMIN')) fetchTickets();
  }, [isRole]);

  const handleStatusChange = async (id: number, newStatus: string) => {
    try {
      const res = await fetch(`/api/admin/tickets`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status: newStatus }),
      });
      if (!res.ok) throw new Error();
      toast.success('System state updated');
      setTickets(prev => prev.map(t => {
        if (t.id === id) {
          const isFinal = ['RESOLVED', 'CLOSED'].includes(newStatus);
          return {
            ...t,
            status: { ...t.status, name: newStatus, displayName: newStatus },
            isEscalated: isFinal ? false : t.isEscalated,
          };
        }
        return t;
      }));
    } catch {
      toast.error('Command rejected: Handshake unsuccessful');
    }
  };

  if (!isRole('ADMIN')) return null;

  // Filter calculations
  const totalCount = tickets.length;
  const openCount = tickets.filter(t => !['RESOLVED', 'CLOSED'].includes(t.status?.name?.toUpperCase())).length;
  const escalatedTickets = tickets.filter(t => t.isEscalated);
  const escalatedCount = escalatedTickets.length;

  const filteredTickets = tickets.filter(t => {
    if (filterMode === 'ESCALATED') return t.isEscalated;
    if (filterMode === 'OPEN') return !['RESOLVED', 'CLOSED'].includes(t.status?.name?.toUpperCase());
    return true;
  });

  return (
    <div className="space-y-8 pb-20">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-8 pb-6 border-b border-[var(--outline-variant)]/40">
        <div className="flex items-center gap-6">
          <div className="h-20 w-20 bg-white text-[var(--primary)] flex items-center justify-center rounded-none border border-[var(--outline-variant)]/40 shadow-xl shrink-0">
            <TicketIcon size={40} />
          </div>
          <div>
            <h1 className="text-3xl sm:text-4xl font-display font-black text-[#1B1C1C] tracking-tighter uppercase">
              Support & Issue Terminal
            </h1>
            <p className="text-[#616161] font-bold text-[11px] uppercase tracking-widest mt-1 opacity-60 italic">
              Processing client support requests and 48-hour resolution SLA monitoring
            </p>
          </div>
        </div>

        <button 
          onClick={fetchTickets}
          className="flex items-center justify-center gap-3 px-8 py-4 bg-[var(--primary)] text-white rounded-none text-[11px] font-black uppercase tracking-[0.2em] hover:bg-neutral-900 transition-all shadow-xl border border-transparent group shrink-0"
        >
          <RefreshCw className="w-4 h-4 group-hover:rotate-180 transition-transform duration-500" />
          Poll Registry
        </button>
      </div>

      {/* KPI Cards & 48h Escalation Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Card 1: Total */}
        <div 
          onClick={() => setFilterMode('ALL')}
          className={`p-6 border transition-all cursor-pointer ${
            filterMode === 'ALL'
              ? 'bg-white border-[#006064] shadow-md ring-2 ring-[#006064]/20'
              : 'bg-white border-neutral-200 hover:border-neutral-300'
          }`}
        >
          <div className="flex items-center justify-between text-[#616161]">
            <span className="text-[10px] font-black uppercase tracking-widest">Total System Tickets</span>
            <TicketIcon size={18} className="text-[#006064]" />
          </div>
          <p className="text-3xl font-black text-[#1B1C1C] mt-2 font-display">{totalCount}</p>
          <p className="text-[10px] text-neutral-500 mt-1">All tickets recorded in terminal</p>
        </div>

        {/* Card 2: Open */}
        <div 
          onClick={() => setFilterMode('OPEN')}
          className={`p-6 border transition-all cursor-pointer ${
            filterMode === 'OPEN'
              ? 'bg-white border-amber-600 shadow-md ring-2 ring-amber-500/20'
              : 'bg-white border-neutral-200 hover:border-neutral-300'
          }`}
        >
          <div className="flex items-center justify-between text-amber-800">
            <span className="text-[10px] font-black uppercase tracking-widest">Active Unresolved</span>
            <Clock size={18} className="text-amber-600" />
          </div>
          <p className="text-3xl font-black text-amber-900 mt-2 font-display">{openCount}</p>
          <p className="text-[10px] text-amber-700 mt-1">Tickets in Open / In-Progress status</p>
        </div>

        {/* Card 3: 48h+ Escalated to Super Admin */}
        <div 
          onClick={() => setFilterMode('ESCALATED')}
          className={`p-6 border transition-all cursor-pointer relative overflow-hidden ${
            filterMode === 'ESCALATED'
              ? 'bg-red-950 text-white border-red-600 shadow-xl ring-2 ring-red-500/40'
              : escalatedCount > 0
              ? 'bg-red-900/90 text-white border-red-700 shadow-md hover:bg-red-900'
              : 'bg-white border-neutral-200 hover:border-neutral-300 text-neutral-700'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5">
              <ShieldAlert size={14} className={escalatedCount > 0 ? 'text-red-400 animate-pulse' : ''} />
              48h+ Super Admin Escalations
            </span>
            <AlertTriangle size={18} className={escalatedCount > 0 ? 'text-red-400' : 'text-neutral-400'} />
          </div>
          <p className="text-3xl font-black mt-2 font-display">{escalatedCount}</p>
          <p className={`text-[10px] mt-1 ${escalatedCount > 0 ? 'text-red-200 font-bold' : 'text-neutral-500'}`}>
            {escalatedCount > 0 ? '⚠️ Unresolved >48h — SLA Breached!' : 'Zero overdue tickets past 48h SLA'}
          </p>
        </div>
      </div>

      {/* Filter Tabs Header */}
      <div className="flex items-center justify-between border-b border-neutral-200 pb-3">
        <div className="flex items-center gap-2">
          <Filter size={14} className="text-[#006064]" />
          <span className="text-xs font-bold uppercase tracking-wider text-[#616161]">Filter View:</span>
          <div className="flex items-center gap-1 ml-2">
            <button
              type="button"
              onClick={() => setFilterMode('ALL')}
              className={`px-3 py-1 text-[10px] font-bold uppercase tracking-wider transition-all ${
                filterMode === 'ALL' ? 'bg-[#006064] text-white' : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
              }`}
            >
              All ({totalCount})
            </button>
            <button
              type="button"
              onClick={() => setFilterMode('OPEN')}
              className={`px-3 py-1 text-[10px] font-bold uppercase tracking-wider transition-all ${
                filterMode === 'OPEN' ? 'bg-amber-600 text-white' : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
              }`}
            >
              Active Open ({openCount})
            </button>
            <button
              type="button"
              onClick={() => setFilterMode('ESCALATED')}
              className={`px-3 py-1 text-[10px] font-bold uppercase tracking-wider transition-all flex items-center gap-1 ${
                filterMode === 'ESCALATED' ? 'bg-red-600 text-white font-black' : 'bg-red-100 text-red-800 hover:bg-red-200'
              }`}
            >
              <ShieldAlert size={12} /> 48h Escalations ({escalatedCount})
            </button>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="bg-white border border-[var(--outline-variant)]/40 rounded-none shadow-2xl px-10 py-40 flex flex-col items-center justify-center text-center">
          <Loader2 className="h-10 w-10 text-[var(--primary)] animate-spin mb-6" />
          <p className="text-[11px] font-black text-[#1B1C1C] uppercase tracking-[0.4em] animate-pulse">Establishing Secure Uplink...</p>
        </div>
      ) : filteredTickets.length === 0 ? (
        <div className="bg-white border border-[var(--outline-variant)]/40 rounded-none shadow-2xl px-10 py-24 text-center">
          <TicketIcon size={48} className="mx-auto mb-6 text-[#1B1C1C] opacity-20" />
          <p className="text-[11px] font-black text-[#1B1C1C] uppercase tracking-[0.4em]">No Tickets Match Criteria</p>
          <p className="text-[9px] text-[#616161] font-bold uppercase tracking-widest mt-2 opacity-60 italic">
            {filterMode === 'ESCALATED' ? 'All support tickets are within the 48-hour SLA window!' : 'Terminal is in standby mode.'}
          </p>
        </div>
      ) : (
        <div className="grid gap-6">
          {filteredTickets.map((ticket, idx) => {
            const isEscalated = ticket.isEscalated;

            return (
              <motion.div
                key={ticket.id}
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: idx * 0.04 }}
                className={`bg-white rounded-none border p-8 shadow-sm hover:shadow-2xl transition-all relative overflow-hidden group ${
                  isEscalated ? 'border-red-500/80 shadow-red-500/10' : 'border-[var(--outline-variant)]/40'
                }`}
              >
                {/* Left Accent Stripe */}
                <div className={`absolute top-0 left-0 w-2.5 h-full ${isEscalated ? 'bg-red-600' : 'bg-[var(--primary)]'}`} />
                
                <div className="flex flex-col lg:flex-row gap-8">
                  {/* Main Content */}
                  <div className="flex-1 space-y-6">
                    {/* Overdue Escalation Banner */}
                    {isEscalated && (
                      <div className="bg-red-950 text-white px-4 py-2.5 border border-red-700 flex items-center justify-between shadow-xs">
                        <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-red-200">
                          <ShieldAlert size={16} className="text-red-400 animate-pulse shrink-0" />
                          <span>🚨 ESCALATED TO SUPER ADMIN — Unresolved for {ticket.hoursOpen}h (exceeded 48h SLA)</span>
                        </div>
                        <span className="bg-red-600 text-white text-[9px] font-mono font-bold px-2 py-0.5 uppercase">
                          +{ticket.escalatedHours}h Overdue
                        </span>
                      </div>
                    )}

                    <div className="flex flex-wrap items-center gap-4">
                      <span className="text-[10px] font-black text-[#1B1C1C] bg-neutral-100 px-4 py-1.5 rounded-none tracking-widest border border-[var(--outline-variant)]/40 shadow-sm uppercase">
                        ID: {ticket.ticketNumber}
                      </span>
                      
                      <span className="inline-flex items-center gap-2 px-4 py-1.5 bg-white text-[var(--primary)] text-[9px] font-black uppercase tracking-widest border border-[var(--outline-variant)]/40">
                        <div className={`h-2 w-2 rounded-none ${
                          ['RESOLVED', 'CLOSED'].includes(ticket.status?.name?.toUpperCase())
                            ? 'bg-[#4DB6AC]'
                            : isEscalated
                            ? 'bg-red-600 shadow-[0_0_8px_rgba(220,38,38,0.8)]'
                            : 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]'
                        }`} />
                        {ticket.status.displayName || ticket.status.name}
                      </span>

                      <div className="ml-auto flex items-center gap-2 text-[10px] font-black text-[#9E9E9E] uppercase tracking-widest opacity-80">
                        <Clock className="w-4 h-4 text-neutral-500" />
                        {new Date(ticket.createdAt).toLocaleString()} 
                        <span className="text-neutral-400 font-mono">({ticket.hoursOpen}h ago)</span>
                      </div>
                    </div>
                    
                    <div>
                      <h3 className="text-xl font-display font-black text-[#1B1C1C] tracking-tighter uppercase mb-2">
                        {ticket.productType?.displayName || ticket.spaceType || 'Unknown Asset'} › {ticket.locationRel?.name || ticket.location || 'Unknown Sector'}
                      </h3>
                      <div className="flex items-center gap-3">
                        <span className="text-[9px] font-black text-[var(--primary)] uppercase tracking-widest bg-white px-3 py-1 border border-[var(--outline-variant)]/40 shadow-sm">
                          {ticket.category || 'GENERAL_REPORT'}
                        </span>
                        {ticket.subCategory && (
                          <span className="text-[9px] font-black text-[#616161] uppercase tracking-widest bg-neutral-100 px-3 py-1">
                            {ticket.subCategory}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="bg-neutral-50 p-6 border border-[var(--outline-variant)]/20 text-sm font-bold text-[#424242] leading-relaxed uppercase tracking-wide">
                      {ticket.description}
                    </div>

                    {ticket.attachments && ticket.attachments.length > 0 && (
                      <div className="space-y-3">
                        <h4 className="text-[10px] font-black text-[#9E9E9E] uppercase tracking-[0.3em]">Payload Attachments ({ticket.attachments.length})</h4>
                        <div className="flex flex-wrap gap-2">
                          {ticket.attachments.map((att, i) => (
                            <a key={att.id} href={att.url} target="_blank" rel="noreferrer" className="flex items-center gap-3 px-4 py-2.5 bg-white border border-[var(--outline-variant)]/40 text-[9px] font-black text-[#1B1B1B] uppercase tracking-widest hover:bg-[#1B1B1B] hover:text-[var(--primary)] transition-all shadow-sm">
                              <ExternalLink size={12} /> SCAN_ATTACHMENT_0{i + 1}
                            </a>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Info & Action Panel */}
                  <div className="lg:w-80 space-y-6">
                    <div className="p-6 bg-neutral-50 border border-[var(--outline-variant)]/20 space-y-6">
                      <div>
                        <h4 className="text-[10px] font-black text-[#9E9E9E] uppercase tracking-[0.2em] mb-4 pb-2 border-b border-[var(--outline-variant)]/10">Reporter Profile</h4>
                        <div className="flex flex-col gap-4">
                          <div className="flex items-center gap-4">
                            <div className="h-10 w-10 bg-white text-[var(--primary)] flex items-center justify-center border border-[var(--outline-variant)]/40 shadow-sm shrink-0">
                              <UserIcon size={18} />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-[11px] font-black text-[#1B1C1C] uppercase tracking-wider truncate">{ticket.name}</p>
                              {ticket.organization && <p className="text-[9px] text-[#616161] font-bold uppercase tracking-widest opacity-60 mt-0.5 truncate">{ticket.organization}</p>}
                            </div>
                          </div>
                          {ticket.user && (
                            <div className="p-3 bg-white border border-[var(--outline-variant)]/20 text-[10px] font-mono text-[#616161] lowercase italic break-all">
                              {ticket.user.email}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="space-y-4 pt-4 border-t border-[var(--outline-variant)]/10">
                        <Label htmlFor={`status-${ticket.id}`} required>Override Status</Label>
                        <div className="relative">
                          <select
                            id={`status-${ticket.id}`}
                            value={ticket.status.name}
                            onChange={(e) => handleStatusChange(ticket.id, e.target.value)}
                            className={`w-full px-4 py-3 border rounded-none text-[10px] font-black uppercase tracking-widest focus:outline-none transition-all appearance-none cursor-pointer ${
                              isEscalated
                                ? 'bg-red-50 border-red-400 text-red-950 focus:border-red-600'
                                : 'bg-white border-[var(--outline-variant)]/40 text-[#1B1B1B] focus:border-[var(--primary)]'
                            }`}
                          >
                            <option value="OPEN">SIGNAL_OPEN (Active)</option>
                            <option value="IN_PROGRESS">IN_TRANSMISSION (In Progress)</option>
                            <option value="RESOLVED">SYNC_COMPLETE (Resolved)</option>
                            <option value="CLOSED">COMM_CLOSED (Closed)</option>
                          </select>
                          <ChevronRight className="absolute right-4 top-1/2 -translate-y-1/2 rotate-90 text-[#9E9E9E] pointer-events-none" size={14} />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
