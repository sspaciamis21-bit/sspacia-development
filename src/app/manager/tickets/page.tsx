'use client';

import { useEffect, useState } from 'react';
import { AlertCircle, Clock, CheckCircle, XCircle, Loader2, ShieldAlert, AlertTriangle } from 'lucide-react';
import { FadeUp } from '@/components/ui/fade-up';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';

interface Ticket {
  id: number;
  ticketNumber: string;
  name: string;
  category?: string;
  subCategory?: string;
  description?: string;
  hoursOpen?: number;
  isEscalated?: boolean;
  escalatedHours?: number;
  status: {
    name: string;
    displayName: string;
  };
  createdAt: string;
  locationRel?: {
    name: string;
  };
}

export default function ManagerTicketsPage() {
  const { user, hasPermission, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingStatus, setUpdatingStatus] = useState<number | null>(null);
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'ESCALATED'>('ALL');

  useEffect(() => {
    if (!authLoading && user) {
      if (!hasPermission('tickets.view')) {
        toast.error('Unauthorized to view tickets.');
        router.push('/manager/dashboard');
        return;
      }
      fetchTickets();
    }
  }, [user, authLoading, hasPermission, router]);

  const fetchTickets = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/tickets', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });

      if (!response.ok) throw new Error('Failed to fetch data');

      const data = await response.json();
      setTickets(data.data || []);
    } catch (error) {
      console.error(error);
      toast.error('Failed to load tickets');
    } finally {
      setLoading(false);
    }
  };

  const handleStatusUpdate = async (ticketId: number, statusName: string) => {
    try {
      setUpdatingStatus(ticketId);
      const response = await fetch('/api/admin/tickets', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: ticketId, status: statusName }),
        credentials: 'include',
      });

      if (!response.ok) throw new Error('Failed to update status');

      const data = await response.json();
      const isFinal = ['RESOLVED', 'CLOSED'].includes(statusName);
      
      // Update local state
      setTickets((prev) => 
        prev.map((t) => t.id === ticketId ? {
          ...t,
          status: data.data.status,
          isEscalated: isFinal ? false : t.isEscalated,
        } : t)
      );
      
      toast.success(`Ticket status updated to ${statusName.replace('_', ' ')}`);
    } catch (error) {
      console.error(error);
      toast.error('Failed to update ticket status');
    } finally {
      setUpdatingStatus(null);
    }
  };

  const getStatusColor = (status: string, isEscalated?: boolean) => {
    if (isEscalated) return 'bg-red-100 text-red-800 border border-red-300 font-black';
    switch (status) {
      case 'OPEN': return 'bg-amber-100 text-amber-800 border border-amber-200';
      case 'IN_PROGRESS': return 'bg-blue-100 text-blue-800 border border-blue-200';
      case 'RESOLVED': return 'bg-emerald-100 text-emerald-800 border border-emerald-200';
      case 'CLOSED': return 'bg-gray-100 text-gray-700 border border-gray-200';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const getStatusIcon = (status: string, isEscalated?: boolean) => {
    if (isEscalated) return <ShieldAlert size={14} className="text-red-600 animate-pulse" />;
    switch (status) {
      case 'OPEN': return <AlertCircle size={14} />;
      case 'IN_PROGRESS': return <Clock size={14} />;
      case 'RESOLVED': return <CheckCircle size={14} />;
      case 'CLOSED': return <XCircle size={14} />;
      default: return <AlertCircle size={14} />;
    }
  };

  const escalatedCount = tickets.filter(t => t.isEscalated).length;

  const filteredTickets = tickets.filter(t => {
    if (statusFilter === 'ESCALATED') return t.isEscalated;
    if (statusFilter === 'ALL') return true;
    return t.status.name === statusFilter;
  });

  if (loading || authLoading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4">
        <Loader2 size={40} className="text-[var(--primary)] animate-spin" />
        <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-[#9E9E9E] animate-pulse">Initializing...</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-10 pb-20 px-4">
      <FadeUp>
        <div className="flex items-center gap-4 mb-6">
          <div className="inline-flex p-3.5 bg-[var(--surface-low)] border border-[var(--outline-variant)] text-[var(--primary)]">
            <AlertCircle size={24} />
          </div>
          <div>
            <h1 className="text-3xl md:text-4xl font-display font-bold text-[#1B1C1C] uppercase tracking-tight">Service Threads</h1>
            <p className="text-[#616161] font-bold text-[11px] uppercase tracking-widest mt-1 opacity-60">Maintenance and support dispatch (48h SLA Monitored)</p>
          </div>
        </div>

        {/* 48h SLA Escalation Alert Banner */}
        {escalatedCount > 0 && (
          <div className="bg-red-950 text-white p-4 border border-red-800 shadow-md flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <ShieldAlert size={20} className="text-red-400 animate-pulse shrink-0" />
              <div>
                <h4 className="text-xs font-black uppercase tracking-wider text-red-200">
                  ⚠️ {escalatedCount} Overdue Tickets Exceeded 48-Hour SLA
                </h4>
                <p className="text-[11px] text-red-300 font-light mt-0.5">
                  These issues have been automatically escalated to Super Admin control panel.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setStatusFilter('ESCALATED')}
              className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-[10px] font-black uppercase tracking-wider transition-colors shrink-0"
            >
              Filter Overdue ({escalatedCount})
            </button>
          </div>
        )}

        <div className="bg-[var(--surface-lowest)] rounded-none border border-[var(--outline-variant)] shadow-sm overflow-hidden">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-8 gap-4 border-b border-[var(--outline-variant)]/30 bg-[var(--surface-low)]/20">
            <div className="flex items-center gap-3">
              <span className="text-[9px] font-bold text-[#9E9E9E] uppercase tracking-[0.3em]">Lifecycle:</span>
              <select 
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="bg-white text-[#1B1C1C] border border-[var(--outline-variant)] rounded-none px-4 py-2 text-[10px] font-bold uppercase tracking-widest focus:border-[var(--primary)] outline-none"
              >
                <option value="ALL">Full Registry</option>
                <option value="OPEN">Open Nodes</option>
                <option value="IN_PROGRESS">Active Work</option>
                <option value="RESOLVED">Resolved</option>
                <option value="ESCALATED">🚨 Overdue Escalated (&gt;48h)</option>
              </select>
            </div>
            <div className="text-[9px] font-bold text-[#616161] uppercase tracking-[0.2em] bg-white border border-[var(--outline-variant)] px-4 py-2">
              Index count: {filteredTickets.length}
            </div>
          </div>

          {filteredTickets.length === 0 ? (
            <div className="text-center py-20 bg-white">
              <p className="text-[10px] font-bold uppercase tracking-[0.4em] text-[#9E9E9E]">No matching registry entries</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[700px]">
                <thead>
                  <tr className="border-b border-[var(--outline-variant)]/30 bg-neutral-50/50">
                    <th className="py-6 px-8 text-[10px] font-bold text-[#9E9E9E] uppercase tracking-widest">Registry ID</th>
                    <th className="py-6 px-8 text-[10px] font-bold text-[#9E9E9E] uppercase tracking-widest">Subscriber / Issue</th>
                    <th className="py-6 px-8 text-[10px] font-bold text-[#9E9E9E] uppercase tracking-widest">Origin Node</th>
                    <th className="py-6 px-8 text-[10px] font-bold text-[#9E9E9E] uppercase tracking-widest">State Logic</th>
                    <th className="py-6 px-8 text-[10px] font-bold text-[#9E9E9E] uppercase tracking-widest">Timestamp &amp; SLA</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--outline-variant)]/10 bg-white">
                  {filteredTickets.map((ticket) => (
                    <tr key={ticket.id} className={`hover:bg-[var(--surface-low)]/30 transition-colors group ${ticket.isEscalated ? 'bg-red-50/30' : ''}`}>
                      <td className="py-8 px-8 font-display font-bold text-[var(--primary)] uppercase text-[13px] tracking-tight">
                        {ticket.ticketNumber}
                        {ticket.isEscalated && (
                          <span className="block text-[9px] font-black text-red-600 uppercase mt-0.5 animate-pulse">
                            🚨 48h Escalated
                          </span>
                        )}
                      </td>
                      <td className="py-8 px-8">
                         <p className="font-bold text-[#1B1C1C] text-[13px] uppercase tracking-tight">{ticket.name}</p>
                         <p className="text-[9px] text-[#9E9E9E] font-bold uppercase mt-1">Ref ID: #{ticket.id}</p>
                      </td>
                      <td className="py-8 px-8 text-[#616161] font-bold text-[10px] uppercase tracking-widest">{ticket.locationRel?.name || 'GENERIC'}</td>
                      <td className="py-8 px-8">
                        <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-none text-[9px] font-black uppercase tracking-widest border transition-all ${getStatusColor(ticket.status.name, ticket.isEscalated)}`}>
                          {updatingStatus === ticket.id ? (
                            <Loader2 size={12} className="animate-spin" />
                          ) : (
                            getStatusIcon(ticket.status.name, ticket.isEscalated)
                          )}
                          <select
                            value={ticket.status.name}
                            disabled={updatingStatus === ticket.id}
                            onChange={(e) => handleStatusUpdate(ticket.id, e.target.value)}
                            className="bg-transparent border-none p-0 ml-1 text-[9px] font-bold uppercase focus:ring-0 cursor-pointer outline-none active:outline-none"
                          >
                            <option value="OPEN" className="bg-white text-black">OPEN</option>
                            <option value="IN_PROGRESS" className="bg-white text-black">IN_PROGRESS</option>
                            <option value="RESOLVED" className="bg-white text-black">RESOLVED</option>
                            <option value="CLOSED" className="bg-white text-black">CLOSED</option>
                          </select>
                        </div>
                      </td>
                      <td className="py-8 px-8 text-[#9E9E9E] font-bold text-[10px] uppercase tracking-widest">
                        <div>{new Date(ticket.createdAt).toLocaleDateString()}</div>
                        {ticket.hoursOpen !== undefined && (
                          <div className={`text-[9px] font-mono mt-0.5 ${ticket.isEscalated ? 'text-red-600 font-bold' : 'text-neutral-400'}`}>
                            {ticket.isEscalated ? `+${ticket.escalatedHours}h overdue (${ticket.hoursOpen}h total)` : `${ticket.hoursOpen}h open`}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </FadeUp>
    </div>
  );
}
