'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  MapPin,
  FileText,
  Trash2,
  Search,
  Building2,
  Calendar,
  Clock,
  CheckCircle2,
  Loader2,
  X,
  Filter,
  RefreshCw,
  Receipt,
  Send,
  Upload,
  Eye,
  UserCheck,
  Calculator,
  FileCheck,
  AlertTriangle,
  RotateCcw,
  Check,
  Paperclip,
  Shield,
  Download,
  Tag,
  Edit2
} from 'lucide-react';
import { toast } from 'sonner';
import { FadeUp } from '@/components/ui/fade-up';
import { useAuth } from '@/context/AuthContext';

interface AttachedInvoice {
  id: number;
  invoiceRecordId: number;
  fileUrl: string;
  fileName: string;
  fileSize: number | null;
  createdAt: string;
}

interface ContactPerson {
  id?: number;
  name: string;
  designation: string;
  mobileNo: string;
  email: string;
}

interface LocationOption {
  id: number;
  name: string;
}

interface InvoiceRecord {
  id: number;
  clientMasterId: number;
  srNo: number;
  companyName: string;
  cabinName: string | null;
  noOfSeats: number | null;
  ratePerAgreement: number | null;
  amount: number | null;
  gstPercent: number | null;
  totalAmount: number | null;
  gstNo: string | null;
  billingMonth: string | null;
  sendType: 'MANUAL' | 'AUTOMATIC_MONTH_END';
  sentAt: string;
  status: 'PENDING_CM_REVIEW' | 'SENT_TO_ACCOUNTANT' | 'INVOICE_ATTACHED' | 'APPROVED' | 'REJECTED_WITH_REMARKS';
  remarks: string | null;
  createdAt: string;
  createdBy: { id: number; name: string; email: string; assignedLocations?: { location: LocationOption }[] };
  clientMaster?: {
    hoAddress?: string | null;
    gstStatus?: string | null;
    gstNo?: string | null;
    agreementStartDate?: string | null;
    agreementEndDate?: string | null;
    lockinEndDate?: string | null;
    noticePeriodMonths?: number | null;
    noticePeriodApplicable?: string | null;
    escalationPercent?: number | null;
    escalationApplicable?: number | null;
    willDeductTds?: boolean;
    tanNo?: string | null;
    clientId?: string | null;
    sorAmount?: number | null;
    sorRecdDate?: string | null;
    contactPersons?: ContactPerson[];
    products?: {
      id?: number;
      cabinName: string | null;
      noOfSeats: number | null;
      ratePerAgreement: number | null;
      amount: number | null;
      gstPercent: number | null;
      totalAmount: number | null;
    }[];
  };
  attachedInvoice?: AttachedInvoice | null;
}

const ACCOUNTANT_CM_EMAIL = 'ssinfrazone21@gmail.com';

export default function AdminInvoicesWorkflowPage() {
  const { user, isRole } = useAuth();

  const userRole = (user?.role || '').toUpperCase();
  const isAdmin = userRole === 'ADMIN' || userRole === 'SUPER_ADMIN' || userRole === 'SUPER-ADMIN' || isRole('ADMIN');
  const isCommunityManager = isRole('COMMUNITY_MANAGER');
  const userEmail = user?.email?.toLowerCase() || '';

  // Determine strict access permission
  // CM with ssinfrazone21@gmail.com: Accountant ONLY
  // CM with any other email: CM ONLY
  // Admin: Both
  const canAccessCM = isAdmin || (isCommunityManager && userEmail !== ACCOUNTANT_CM_EMAIL);
  const canAccessAccountant = isAdmin || (isCommunityManager && userEmail === ACCOUNTANT_CM_EMAIL);

  const [userRoleView, setUserRoleView] = useState<'CM' | 'ACCOUNTANT'>(
    canAccessCM ? 'CM' : 'ACCOUNTANT'
  );

  useEffect(() => {
    if (userRoleView === 'CM' && !canAccessCM) {
      setUserRoleView('ACCOUNTANT');
    } else if (userRoleView === 'ACCOUNTANT' && !canAccessAccountant) {
      setUserRoleView('CM');
    }
  }, [canAccessCM, canAccessAccountant, userRoleView]);

  const [invoices, setInvoices] = useState<InvoiceRecord[]>([]);
  const [loading, setLoading] = useState(true);

  // Search & Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState('ALL');

  // Node/Location Filter for Admin
  const [locations, setLocations] = useState<LocationOption[]>([]);
  const [selectedLocationFilter, setSelectedLocationFilter] = useState('ALL');

  // Accountant Upload Invoice Modal
  const [entryToAttachInvoice, setEntryToAttachInvoice] = useState<InvoiceRecord | null>(null);
  const [uploadingPdf, setUploadingPdf] = useState(false);
  const [selectedInvoiceFile, setSelectedInvoiceFile] = useState<File | null>(null);

  // CM Review Attached PDF Modal
  const [entryToReviewInvoice, setEntryToReviewInvoice] = useState<InvoiceRecord | null>(null);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectRemarks, setRejectRemarks] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  // View Full Record Details Modal
  const [entryToViewDetails, setEntryToViewDetails] = useState<InvoiceRecord | null>(null);

  // Edit Invoice Record Modal State
  const [entryToEditInvoice, setEntryToEditInvoice] = useState<InvoiceRecord | null>(null);
  const [editCompanyName, setEditCompanyName] = useState('');
  const [editCabinName, setEditCabinName] = useState('');
  const [editNoOfSeats, setEditNoOfSeats] = useState<number | ''>('');
  const [editRatePerAgreement, setEditRatePerAgreement] = useState<number | ''>('');
  const [editAmount, setEditAmount] = useState<number | ''>('');
  const [editGstPercent, setEditGstPercent] = useState<number | ''>('');
  const [editTotalAmount, setEditTotalAmount] = useState<number | ''>('');
  const [editGstNo, setEditGstNo] = useState('');
  const [editBillingMonth, setEditBillingMonth] = useState('');
  const [editStatus, setEditStatus] = useState<InvoiceRecord['status']>('PENDING_CM_REVIEW');

  const handleOpenEditModal = (inv: InvoiceRecord) => {
    setEntryToEditInvoice(inv);
    setEditCompanyName(inv.companyName || '');
    setEditCabinName(inv.cabinName || '');
    setEditNoOfSeats(inv.noOfSeats ?? '');
    setEditRatePerAgreement(inv.ratePerAgreement ?? '');
    setEditAmount(inv.amount ?? '');
    setEditGstPercent(inv.gstPercent ?? '');
    setEditTotalAmount(inv.totalAmount ?? '');
    setEditGstNo(inv.gstNo || '');
    setEditBillingMonth(inv.billingMonth || '');
    setEditStatus(inv.status);
  };

  const canUseNodeFilter = isAdmin || canAccessAccountant;

  // Fetch locations for Admin & Accountant filter dropdown
  const fetchLocations = useCallback(async () => {
    if (!canUseNodeFilter) return;
    try {
      const res = await fetch('/api/admin/locations?limit=100');
      const json = await res.json();
      const locList = json.data || json.locations || (Array.isArray(json) ? json : []);
      if (Array.isArray(locList)) {
        setLocations(locList.map((l: any) => ({ id: l.id, name: l.name })));
      }
    } catch { /* ignore */ }
  }, [canUseNodeFilter]);

  // Fetch data
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (canUseNodeFilter && selectedLocationFilter !== 'ALL') {
        params.set('locationId', selectedLocationFilter);
      }
      const url = `/api/admin/Invoices${params.toString() ? '?' + params.toString() : ''}`;
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(`Server returned ${res.status}`);
      }
      const json = await res.json();
      if (json.success) {
        setInvoices(json.data);
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to load invoice records');
    } finally {
      setLoading(false);
    }
  }, [canUseNodeFilter, selectedLocationFilter]);

  useEffect(() => {
    fetchLocations();
  }, [fetchLocations]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Update Status (Send to Accountant, Approve, Reject)
  const handleUpdateStatus = async (id: number, status: string, remarks?: string) => {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/admin/Invoices/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, remarks })
      });
      if (!res.ok) {
        throw new Error(`Server returned ${res.status}`);
      }
      const json = await res.json();
      if (json.success) {
        if (status === 'SENT_TO_ACCOUNTANT') toast.success('Sent to Accountant for Tally PDF processing!');
        if (status === 'APPROVED') toast.success('Invoice Approved successfully! ✅');
        if (status === 'REJECTED_WITH_REMARKS') toast.success('Revision remarks sent back to Accountant!');

        fetchData();
        setShowRejectModal(false);
        setRejectRemarks('');
        setEntryToReviewInvoice(null);
      } else {
        toast.error(json.error || 'Failed to update status');
      }
    } catch {
      toast.error('Error updating invoice status');    
    } finally {
      setActionLoading(false);
    }
  };

  // Save Edit Invoice Record
  const handleSaveEditInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!entryToEditInvoice) return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/admin/Invoices/${entryToEditInvoice.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyName: editCompanyName,
          cabinName: editCabinName,
          noOfSeats: editNoOfSeats,
          ratePerAgreement: editRatePerAgreement,
          amount: editAmount,
          gstPercent: editGstPercent,
          totalAmount: editTotalAmount,
          gstNo: editGstNo,
          billingMonth: editBillingMonth,
          status: editStatus,
        }),
      });

      const json = await res.json();
      if (json.success) {
        toast.success('Invoice record updated successfully!');
        setEntryToEditInvoice(null);
        fetchData();
      } else {
        toast.error(json.error || 'Failed to update invoice record');
      }
    } catch {
      toast.error('Error updating invoice record');
    } finally {
      setActionLoading(false);
    }
  };

  // Delete Invoice Record
  const handleDeleteInvoice = async (id: number) => {
    if (!confirm('Are you sure you want to delete this invoice record from the Invoices section?')) return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/admin/Invoices/${id}`, {
        method: 'DELETE',
      });
      const json = await res.json();
      if (json.success) {
        toast.success('Invoice record deleted successfully!');
        fetchData();
      } else {
        toast.error(json.error || 'Failed to delete invoice record');
      }
    } catch {
      toast.error('Error deleting invoice record');
    } finally {
      setActionLoading(false);
    }
  };

  // Accountant PDF Upload
  const handleUploadInvoicePdf = async () => {
    if (!entryToAttachInvoice || !selectedInvoiceFile) {
      toast.error('Please select a PDF file first');
      return;
    }

    setUploadingPdf(true);
    try {
      const formData = new FormData();
      formData.append('file', selectedInvoiceFile);

      const uploadRes = await fetch('/api/admin/upload-pdf', {
        method: 'POST',
        body: formData
      });
      const uploadJson = await uploadRes.json();

      if (!uploadJson.success) {
        throw new Error(uploadJson.error || 'PDF Upload failed');
      }

      const { fileUrl, fileName, fileSize } = uploadJson.data;

      const attachRes = await fetch('/api/admin/attached-invoice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entryId: entryToAttachInvoice.id,
          fileUrl,
          fileName,
          fileSize
        })
      });
      const attachJson = await attachRes.json();

      if (attachJson.success) {
        toast.success('Tally Invoice PDF attached & sent to Community Manager!');
        setEntryToAttachInvoice(null);
        setSelectedInvoiceFile(null);
        fetchData();
      } else {
        toast.error(attachJson.error || 'Failed to attach invoice');
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to process PDF upload');
    } finally {
      setUploadingPdf(false);
    }
  };

  // Filtered entries for CM View vs Accountant View
  const filteredInvoices = useMemo(() => {
    return invoices.filter((e) => {
      const matchesSearch =
        e.companyName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (e.gstNo && e.gstNo.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (e.cabinName && e.cabinName.toLowerCase().includes(searchTerm.toLowerCase()));

      let matchesRoleFilter = true;
      if (userRoleView === 'ACCOUNTANT') {
        matchesRoleFilter = ['SENT_TO_ACCOUNTANT', 'REJECTED_WITH_REMARKS', 'INVOICE_ATTACHED', 'APPROVED'].includes(e.status);
      }

      const matchesStatus =
        selectedStatusFilter === 'ALL' || e.status === selectedStatusFilter;

      return matchesSearch && matchesRoleFilter && matchesStatus;
    });
  }, [invoices, searchTerm, userRoleView, selectedStatusFilter]);

  // KPIs
  const kpis = useMemo(() => {
    const totalInvoices = invoices.length;
    const pendingCM = invoices.filter((e) => e.status === 'PENDING_CM_REVIEW').length;
    const sentToAccountant = invoices.filter((e) => e.status === 'SENT_TO_ACCOUNTANT').length;
    const pendingCMApproval = invoices.filter((e) => e.status === 'INVOICE_ATTACHED').length;
    const approved = invoices.filter((e) => e.status === 'APPROVED').length;
    const rejected = invoices.filter((e) => e.status === 'REJECTED_WITH_REMARKS').length;

    return { totalInvoices, pendingCM, sentToAccountant, pendingCMApproval, approved, rejected };
  }, [invoices]);

  // Status Badge Renderer
  const renderStatusBadge = (status: string) => {
    switch (status) {
      case 'PENDING_CM_REVIEW':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider bg-purple-50 text-purple-700 border border-purple-200">
            <Clock size={11} /> Arrived from Client Master (CM Review)
          </span>
        );
      case 'SENT_TO_ACCOUNTANT':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider bg-blue-50 text-blue-700 border border-blue-200">
            <Send size={11} /> Sent to Accountant
          </span>
        );
      case 'INVOICE_ATTACHED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider bg-amber-50 text-amber-700 border border-amber-200">
            <Paperclip size={11} /> Invoice Attached (Pending CM Approval)
          </span>
        );
      case 'APPROVED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 size={11} /> Invoice Approved ✅
          </span>
        );
      case 'REJECTED_WITH_REMARKS':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider bg-red-50 text-red-700 border border-red-200">
            <AlertTriangle size={11} /> Revision Requested ❌
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="p-6 sm:p-10 max-w-[1600px] mx-auto space-y-8 bg-[#F8F9FA] min-h-screen text-[#1B1C1C]">
      {/* Role Banner with STRICT ISOLATION */}
      <FadeUp>
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 bg-white border border-[var(--outline-variant)]/40 shadow-xs">
          <div className="flex items-center gap-3">
            <Receipt className="text-[var(--primary)] h-6 w-6" />
            <div>
              <div className="text-[10px] font-black uppercase tracking-[0.25em] text-[#616161]">
                Invoices Workflow Section
              </div>
              <div className="text-sm font-bold text-[#1B1C1C]">
                {userRoleView === 'CM' ? 'Community Manager Invoice Review' : 'Accountant Tally PDF Processing'}
              </div>
              {/* Show strict role notification */}
              {isCommunityManager && (
                <div className="text-[9px] text-[var(--primary)] font-semibold mt-0.5 uppercase tracking-wider">
                  {canAccessCM && !canAccessAccountant && '🔒 Community Manager View (Accountant view hidden)'}
                  {canAccessAccountant && !canAccessCM && '🔒 Accountant View (CM view hidden)'}
                </div>
              )}
            </div>
          </div>

          {/* Admin view switcher (only visible to Admin if user has access to both) */}
          {canAccessCM && canAccessAccountant ? (
            <div className="flex items-center bg-[#F8F9FA] border border-[var(--outline-variant)] p-1 text-xs font-bold w-full sm:w-auto justify-center">
              <button
                type="button"
                onClick={() => setUserRoleView('CM')}
                className={`px-5 py-2 text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-2 ${
                  userRoleView === 'CM'
                    ? 'bg-[var(--primary)] text-white shadow-xs'
                    : 'text-[#616161] hover:text-[#1B1C1C]'
                }`}
              >
                <UserCheck size={16} /> Community Manager View
              </button>
              <button
                type="button"
                onClick={() => setUserRoleView('ACCOUNTANT')}
                className={`px-5 py-2 text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-2 ${
                  userRoleView === 'ACCOUNTANT'
                    ? 'bg-[var(--primary)] text-white shadow-xs'
                    : 'text-[#616161] hover:text-[#1B1C1C]'
                }`}
              >
                <Calculator size={16} /> Accountant View
              </button>
            </div>
          ) : (
            <div className="flex items-center bg-[#F8F9FA] border border-[var(--outline-variant)] p-1 text-xs font-bold">
              <div className="px-5 py-2 text-xs font-bold uppercase tracking-wider bg-[var(--primary)] text-white shadow-xs flex items-center gap-2">
                {canAccessCM ? (
                  <><UserCheck size={16} /> Community Manager Workspace</>
                ) : (
                  <><Calculator size={16} /> Accountant Processing Workspace</>
                )}
              </div>
            </div>
          )}
        </div>
      </FadeUp>

      {/* Header */}
      <FadeUp delay={0.05}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-[var(--outline-variant)]/40">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.25em] text-[var(--primary)] mb-1">
              <FileCheck size={16} /> {userRoleView === 'CM' ? 'CM Monthly Invoices Review' : 'Accountant Tally PDF Attachment'}
            </div>
            <h1 className="text-3xl sm:text-4xl font-display font-black tracking-tight text-[#1B1C1C]">
              Invoices & Tally PDF Processing
            </h1>
            <p className="text-sm text-[#616161] mt-1 font-light">
              {userRoleView === 'CM'
                ? 'Review entries that arrived automatically or manually from Client Master, send to Accountant, and review attached Tally PDF invoices.'
                : 'Inspect client entries sent by CM, attach Tally PDF invoices, review CM revision remarks, and re-submit.'}
            </p>
          </div>
        </div>
      </FadeUp>

      {/* KPI Cards */}
      <FadeUp delay={0.1}>
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="bg-white p-5 border border-[var(--outline-variant)]/40 shadow-xs">
            <div className="text-[10px] font-black uppercase tracking-[0.2em] text-[#616161]">Total Invoices</div>
            <div className="text-2xl font-display font-black mt-1 text-[#1B1C1C]">{kpis.totalInvoices}</div>
            <div className="text-[11px] text-[#616161] font-light">Dispatched from Client Master</div>
          </div>

          <div className="bg-white p-5 border border-purple-200 bg-purple-50/20 shadow-xs">
            <div className="text-[10px] font-black uppercase tracking-[0.2em] text-purple-700">Pending CM Review</div>
            <div className="text-2xl font-display font-black mt-1 text-purple-800">{kpis.pendingCM}</div>
            <div className="text-[11px] text-purple-600 font-light">New arrivals</div>
          </div>

          <div className="bg-white p-5 border border-blue-200 bg-blue-50/20 shadow-xs">
            <div className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-700">With Accountant</div>
            <div className="text-2xl font-display font-black mt-1 text-blue-800">{kpis.sentToAccountant}</div>
            <div className="text-[11px] text-blue-600 font-light">Pending Tally PDF</div>
          </div>

          <div className="bg-white p-5 border border-amber-200 bg-amber-50/20 shadow-xs">
            <div className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-700">Pending CM Approval</div>
            <div className="text-2xl font-display font-black mt-1 text-amber-800">{kpis.pendingCMApproval}</div>
            <div className="text-[11px] text-amber-600 font-light">Tally PDF attached</div>
          </div>

          <div className="bg-white p-5 border border-emerald-200 bg-emerald-50/20 shadow-xs col-span-2 lg:col-span-1">
            <div className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-700">Approved Invoices</div>
            <div className="text-2xl font-display font-black mt-1 text-emerald-800">{kpis.approved}</div>
            <div className="text-[11px] text-emerald-600 font-light">Approved by CM</div>
          </div>
        </div>
      </FadeUp>

      {/* TABLE WORKFLOW */}
      <FadeUp delay={0.2}>
        <div className="bg-white border border-[var(--outline-variant)]/40 p-6 space-y-6 shadow-xs">
          {/* Search & Filter */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-b border-neutral-200 pb-4">
            <div className="relative w-full sm:w-80">
              <Search size={16} className="absolute left-3 top-3.5 text-[#616161]" />
              <input
                type="text"
                placeholder="Search by company, GST or cabin..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-[#F8F9FA] border border-[var(--outline-variant)] pl-9 pr-4 py-2.5 text-xs focus:outline-none focus:border-[var(--primary)]"
              />
            </div>

            <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
              {/* Admin & Accountant Node Filter */}
              {canUseNodeFilter && locations.length > 0 && (
                <>
                  <div className="flex items-center gap-1.5 text-xs font-bold text-[#616161]">
                    <MapPin size={14} /> Node:
                  </div>
                  <select
                    value={selectedLocationFilter}
                    onChange={(e) => setSelectedLocationFilter(e.target.value)}
                    className="bg-[#F8F9FA] border border-[var(--outline-variant)] px-3 py-2 text-xs focus:outline-none focus:border-[var(--primary)] font-medium"
                  >
                    <option value="ALL">All Nodes</option>
                    {locations.map((loc) => (
                      <option key={loc.id} value={String(loc.id)}>
                        {loc.name}
                      </option>
                    ))}
                  </select>
                </>
              )}

              <div className="flex items-center gap-1.5 text-xs font-bold text-[#616161]">
                <Filter size={14} /> Workflow Status:
              </div>
              <select
                value={selectedStatusFilter}
                onChange={(e) => setSelectedStatusFilter(e.target.value)}
                className="bg-[#F8F9FA] border border-[var(--outline-variant)] px-3 py-2 text-xs focus:outline-none focus:border-[var(--primary)] font-medium"
              >
                <option value="ALL">All Statuses</option>
                <option value="PENDING_CM_REVIEW">Pending CM Review (New Arrivals)</option>
                <option value="SENT_TO_ACCOUNTANT">Sent to Accountant</option>
                <option value="INVOICE_ATTACHED">Invoice Attached (Pending CM Approval)</option>
                <option value="APPROVED">Approved</option>
                <option value="REJECTED_WITH_REMARKS">Revision Requested</option>
              </select>

              <button
                onClick={fetchData}
                className="p-2 border border-[var(--outline-variant)] hover:bg-neutral-50 text-[#616161]"
                title="Refresh"
              >
                <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              </button>
            </div>
          </div>

          {/* Table */}
          {loading ? (
            <div className="py-16 text-center text-[#616161] flex items-center justify-center gap-2">
              <Loader2 size={20} className="animate-spin text-[var(--primary)]" /> Loading workflow queue...
            </div>
          ) : filteredInvoices.length === 0 ? (
            <div className="py-16 text-center space-y-3">
              <div className="text-4xl text-neutral-300">📁</div>
              <div className="text-sm font-bold text-[#1B1C1C]">No invoices found in queue</div>
              <p className="text-xs text-[#616161] max-w-sm mx-auto font-light">
                {userRoleView === 'CM'
                  ? 'No entries have arrived from Client Master yet. Dispatches will appear here.'
                  : 'No entries sent by Community Manager pending Accountant action.'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-[#F8F9FA] text-[#616161] uppercase tracking-wider border-b border-[var(--outline-variant)] font-bold">
                    <th className="p-3 w-12 text-center">SR.No</th>
                    <th className="p-3">Company Name</th>
                    <th className="p-3">Node & Person</th>
                    <th className="p-3">Cabin & Seats</th>
                    <th className="p-3">Arrival Date & Dispatch Type</th>
                    <th className="p-3">Billing Month</th>
                    <th className="p-3 text-right">Total Amt (₹)</th>
                    <th className="p-3">Workflow Status</th>
                    <th className="p-3 text-center w-40">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100 font-medium">
                  {filteredInvoices.map((invoice) => (
                    <tr key={invoice.id} className="hover:bg-neutral-50/60 transition-colors">
                      <td className="p-3 text-center font-mono font-bold text-neutral-600 bg-neutral-50/50">
                        #{invoice.srNo}
                      </td>

                      <td className="p-3">
                        <div className="font-bold text-[#1B1C1C] text-sm">{invoice.companyName}</div>
                        {invoice.gstNo && <div className="text-[10px] font-mono text-neutral-500">GST: {invoice.gstNo}</div>}
                      </td>

                      <td className="p-3">
                        <div className="space-y-0.5">
                          {invoice.createdBy?.assignedLocations && invoice.createdBy.assignedLocations.length > 0 ? (
                            invoice.createdBy.assignedLocations.map((al: any, i: number) => (
                              <div key={i} className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-teal-50 text-teal-800 border border-teal-200 text-[9px] font-bold uppercase tracking-wider mr-1">
                                <MapPin size={9} /> {al.location.name}
                              </div>
                            ))
                          ) : (
                            <span className="text-[9px] text-neutral-400">No Node</span>
                          )}
                          <div className="text-[11px] font-bold text-[#1B1C1C] mt-0.5">
                            {invoice.createdBy?.name || 'System'}
                          </div>
                          <div className="text-[9px] text-neutral-400">
                            {invoice.createdBy?.email}
                          </div>
                        </div>
                      </td>

                      <td className="p-3">
                        <div className="font-bold">{invoice.cabinName || 'N/A'}</div>
                        <div className="text-[10px] text-[#616161]">
                          {invoice.noOfSeats || 0} seats @ ₹{Number(invoice.ratePerAgreement || 0).toLocaleString('en-IN')}
                        </div>
                      </td>

                      <td className="p-3">
                        <div className="font-bold text-[#1B1C1C]">
                          {new Date(invoice.sentAt).toLocaleDateString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric'
                          })}
                        </div>
                        <div className="mt-0.5">
                          <span
                            className={`inline-flex items-center gap-1 px-1.5 py-0.2 text-[9px] font-extrabold uppercase ${
                              invoice.sendType === 'AUTOMATIC_MONTH_END'
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-blue-100 text-blue-800'
                            }`}
                          >
                            <Tag size={9} />
                            {invoice.sendType === 'AUTOMATIC_MONTH_END' ? 'AUTOMATIC MONTH-END' : 'MANUAL DISPATCH'}
                          </span>
                        </div>
                      </td>

                      <td className="p-3 font-bold text-neutral-700">
                        {invoice.billingMonth || 'N/A'}
                      </td>

                      <td className="p-3 text-right font-black text-sm text-[var(--primary)]">
                        ₹{Number(invoice.totalAmount || 0).toLocaleString('en-IN')}
                      </td>

                      <td className="p-3">
                        {renderStatusBadge(invoice.status)}

                        {/* Show Revision Remarks if rejected by CM */}
                        {invoice.status === 'REJECTED_WITH_REMARKS' && invoice.remarks && (
                          <div className="mt-2 p-2 bg-red-50 border border-red-200 text-red-800 text-[10px] space-y-1">
                            <div className="font-bold flex items-center gap-1">
                              <AlertTriangle size={11} /> CM Revision Remarks:
                            </div>
                            <div className="italic">"{invoice.remarks}"</div>
                          </div>
                        )}
                      </td>

                      <td className="p-3 text-center">
                        <div className="flex flex-col gap-1.5 items-center justify-center">
                          {/* CM ACTIONS */}
                          {userRoleView === 'CM' && (
                            <>
                              {invoice.status === 'PENDING_CM_REVIEW' && (
                                <button
                                  onClick={() => handleUpdateStatus(invoice.id, 'SENT_TO_ACCOUNTANT')}
                                  disabled={actionLoading}
                                  className="px-3 py-1.5 bg-blue-600 text-white font-bold text-[10px] uppercase tracking-wider hover:bg-blue-700 flex items-center gap-1 w-full justify-center shadow-xs"
                                >
                                  <Send size={11} /> Send to Accountant
                                </button>
                              )}

                              {invoice.status === 'INVOICE_ATTACHED' && invoice.attachedInvoice && (
                                <button
                                  onClick={() => setEntryToReviewInvoice(invoice)}
                                  className="px-3 py-1.5 bg-amber-600 text-white font-bold text-[10px] uppercase tracking-wider hover:bg-amber-700 flex items-center gap-1 w-full justify-center shadow-xs"
                                >
                                  <Eye size={11} /> Review Tally PDF
                                </button>
                              )}
                            </>
                          )}

                          {/* ACCOUNTANT ACTIONS */}
                          {userRoleView === 'ACCOUNTANT' && (
                            <>
                              {['SENT_TO_ACCOUNTANT', 'REJECTED_WITH_REMARKS', 'INVOICE_ATTACHED'].includes(invoice.status) ? (
                                <button
                                  onClick={() => {
                                    setEntryToAttachInvoice(invoice);
                                    setSelectedInvoiceFile(null);
                                  }}
                                  className={`px-3 py-1.5 font-bold text-[10px] uppercase tracking-wider text-white flex items-center justify-center gap-1 w-full shadow-xs ${
                                    invoice.status === 'REJECTED_WITH_REMARKS'
                                      ? 'bg-red-600 hover:bg-red-700'
                                      : 'bg-[var(--primary)] hover:opacity-90'
                                  }`}
                                >
                                  <Paperclip size={11} />
                                  {invoice.attachedInvoice ? 'Replace Tally PDF' : 'Attach Tally PDF'}
                                </button>
                              ) : (
                                <span className="text-[10px] text-emerald-700 font-bold uppercase tracking-wider flex items-center justify-center gap-1">
                                  <CheckCircle2 size={12} /> Finalized
                                </span>
                              )}
                            </>
                          )}

                          <div className="flex items-center gap-1 mt-1 border-t border-neutral-100 pt-1 w-full justify-center">
                            <button
                              onClick={() => setEntryToViewDetails(invoice)}
                              className="p-1 text-neutral-500 hover:text-black hover:bg-neutral-100"
                              title="View details"
                            >
                              <Eye size={12} />
                            </button>
                            {userRoleView === 'CM' && (
                              <button
                                onClick={() => handleOpenEditModal(invoice)}
                                className="p-1 text-neutral-500 hover:text-[#006064] hover:bg-neutral-100"
                                title="Edit invoice record"
                              >
                                <Edit2 size={12} />
                              </button>
                            )}
                            <button
                              onClick={() => handleDeleteInvoice(invoice.id)}
                              className="p-1 text-neutral-500 hover:text-red-600 hover:bg-neutral-100"
                              title="Delete invoice record"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </FadeUp>

      {/* MODAL 1: Accountant Attach Tally Invoice PDF */}
      <AnimatePresence>
        {entryToAttachInvoice && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white border border-[var(--outline-variant)] p-6 w-full max-w-lg space-y-4 shadow-xl text-xs"
            >
              <div className="flex items-center justify-between border-b border-neutral-200 pb-3">
                <h3 className="text-base font-bold text-[#1B1C1C] flex items-center gap-2">
                  <Paperclip size={18} className="text-[var(--primary)]" /> Attach Tally PDF Invoice
                </h3>
                <button
                  onClick={() => {
                    setEntryToAttachInvoice(null);
                    setSelectedInvoiceFile(null);
                  }}
                  className="text-neutral-400 hover:text-neutral-700"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="bg-[#F8F9FA] p-3 border border-[var(--outline-variant)]/60 space-y-1">
                <div className="font-bold text-[#1B1C1C] text-sm">Company: {entryToAttachInvoice.companyName}</div>
                <div className="text-[#616161]">
                  SR No: #{entryToAttachInvoice.srNo} | Billing Month: {entryToAttachInvoice.billingMonth}
                </div>
                <div className="font-bold text-[var(--primary)]">
                  Total Amount: ₹{Number(entryToAttachInvoice.totalAmount || 0).toLocaleString('en-IN')}
                </div>
              </div>

              {entryToAttachInvoice.status === 'REJECTED_WITH_REMARKS' && entryToAttachInvoice.remarks && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-800 space-y-1">
                  <div className="font-bold flex items-center gap-1.5">
                    <AlertTriangle size={14} /> Community Manager Revision Remarks:
                  </div>
                  <div className="italic">"{entryToAttachInvoice.remarks}"</div>
                </div>
              )}

              <div className="space-y-2">
                <label className="block font-bold uppercase tracking-wider text-[#616161]">
                  Select Tally Invoice PDF File *
                </label>
                <input
                  type="file"
                  accept="application/pdf,.pdf"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      setSelectedInvoiceFile(e.target.files[0]);
                    }
                  }}
                  className="w-full bg-[#F8F9FA] border border-[var(--outline-variant)] px-3 py-2 text-xs"
                />
                {selectedInvoiceFile && (
                  <div className="text-xs font-semibold text-emerald-700 flex items-center gap-1">
                    <Check size={14} /> Selected: {selectedInvoiceFile.name} ({(selectedInvoiceFile.size / 1024).toFixed(1)} KB)
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-neutral-200">
                <button
                  type="button"
                  onClick={() => {
                    setEntryToAttachInvoice(null);
                    setSelectedInvoiceFile(null);
                  }}
                  className="px-4 py-2 font-bold uppercase tracking-wider text-[#616161] hover:bg-neutral-100"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleUploadInvoicePdf}
                  disabled={uploadingPdf || !selectedInvoiceFile}
                  className="px-6 py-2.5 bg-[var(--primary)] text-white font-bold uppercase tracking-wider hover:opacity-90 disabled:opacity-50 flex items-center gap-2"
                >
                  {uploadingPdf ? (
                    <>
                      <Loader2 size={14} className="animate-spin" /> Uploading PDF...
                    </>
                  ) : (
                    <>
                      <Upload size={14} /> Attach & Send to CM
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL 2: CM Review Attached Tally Invoice PDF */}
      <AnimatePresence>
        {entryToReviewInvoice && entryToReviewInvoice.attachedInvoice && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white border border-[var(--outline-variant)] p-6 w-full max-w-xl space-y-4 shadow-xl text-xs"
            >
              <div className="flex items-center justify-between border-b border-neutral-200 pb-3">
                <h3 className="text-base font-bold text-[#1B1C1C] flex items-center gap-2">
                  <Eye size={18} className="text-[var(--primary)]" /> Review Attached Tally Invoice PDF
                </h3>
                <button
                  onClick={() => setEntryToReviewInvoice(null)}
                  className="text-neutral-400 hover:text-neutral-700"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="bg-[#F8F9FA] p-3 border border-[var(--outline-variant)]/60 space-y-1">
                <div className="font-bold text-[#1B1C1C] text-sm">Company: {entryToReviewInvoice.companyName}</div>
                <div className="text-[#616161]">
                  SR No: #{entryToReviewInvoice.srNo} | Billing Month: {entryToReviewInvoice.billingMonth}
                </div>
                <div className="font-bold text-[var(--primary)]">
                  Total Amount: ₹{Number(entryToReviewInvoice.totalAmount || 0).toLocaleString('en-IN')}
                </div>
              </div>

              <div className="p-4 border border-dashed border-neutral-300 bg-neutral-50 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <FileText className="h-8 w-8 text-red-600" />
                  <div>
                    <div className="font-bold text-[#1B1C1C]">
                      {entryToReviewInvoice.attachedInvoice.fileName}
                    </div>
                    <div className="text-[10px] text-[#616161]">Attached Tally PDF Invoice</div>
                  </div>
                </div>

                <a
                  href={entryToReviewInvoice.attachedInvoice.fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2 bg-[#1B1C1C] text-white font-bold uppercase tracking-wider hover:bg-neutral-800 transition-colors flex items-center gap-1.5"
                >
                  <Eye size={14} /> View / Download PDF
                </a>
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-neutral-200">
                <button
                  type="button"
                  onClick={() => setShowRejectModal(true)}
                  className="px-5 py-2.5 bg-red-50 text-red-700 border border-red-200 font-bold uppercase tracking-wider hover:bg-red-100 flex items-center gap-1.5"
                >
                  <RotateCcw size={14} /> Request Revision / Reject
                </button>

                <button
                  type="button"
                  onClick={() => handleUpdateStatus(entryToReviewInvoice.id, 'APPROVED')}
                  disabled={actionLoading}
                  className="px-6 py-2.5 bg-emerald-600 text-white font-bold uppercase tracking-wider hover:bg-emerald-700 flex items-center gap-2 shadow-xs"
                >
                  {actionLoading ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />} Approve Invoice ✅
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL 3: CM Reject Remarks Modal */}
      <AnimatePresence>
        {showRejectModal && entryToReviewInvoice && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white border border-[var(--outline-variant)] p-6 w-full max-w-md space-y-4 shadow-xl text-xs"
            >
              <div className="flex items-center justify-between border-b border-neutral-200 pb-3">
                <h3 className="text-base font-bold text-red-700 flex items-center gap-2">
                  <AlertTriangle size={18} /> Request Revision (CM Remarks)
                </h3>
                <button
                  onClick={() => setShowRejectModal(false)}
                  className="text-neutral-400 hover:text-neutral-700"
                >
                  <X size={18} />
                </button>
              </div>

              <div>
                <label className="block font-bold uppercase tracking-wider text-[#616161] mb-2">
                  Enter Revision Remarks for Accountant *
                </label>
                <textarea
                  rows={4}
                  placeholder="Explain what needs correction in the Tally invoice..."
                  value={rejectRemarks}
                  onChange={(e) => setRejectRemarks(e.target.value)}
                  className="w-full bg-[#F8F9FA] border border-[var(--outline-variant)] p-3 text-xs focus:outline-none focus:border-red-500"
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-neutral-200">
                <button
                  type="button"
                  onClick={() => setShowRejectModal(false)}
                  className="px-4 py-2 font-bold uppercase tracking-wider text-[#616161] hover:bg-neutral-100"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (!rejectRemarks.trim()) {
                      toast.error('Please enter revision remarks');
                      return;
                    }
                    handleUpdateStatus(entryToReviewInvoice.id, 'REJECTED_WITH_REMARKS', rejectRemarks.trim());
                  }}
                  disabled={actionLoading || !rejectRemarks.trim()}
                  className="px-5 py-2.5 bg-red-600 text-white font-bold uppercase tracking-wider hover:bg-red-700 disabled:opacity-50 flex items-center gap-2"
                >
                  {actionLoading ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} Send Remarks to Accountant
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL 4: Full Invoice Record Viewer */}
      <AnimatePresence>
        {entryToViewDetails && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white border border-[var(--outline-variant)] p-6 sm:p-8 w-full max-w-4xl space-y-6 shadow-2xl my-8 max-h-[92vh] overflow-y-auto text-xs"
            >
              {/* Header */}
              <div className="flex items-start justify-between border-b border-neutral-200 pb-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span className="font-mono font-bold bg-neutral-100 text-neutral-700 px-2 py-0.5">
                      SR.No #{entryToViewDetails.srNo}
                    </span>
                    {renderStatusBadge(entryToViewDetails.status)}
                    {entryToViewDetails.createdBy?.assignedLocations && entryToViewDetails.createdBy.assignedLocations.length > 0 && (
                      entryToViewDetails.createdBy.assignedLocations.map((al: any, i: number) => (
                        <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 bg-teal-50 text-teal-800 border border-teal-200 text-[10px] font-bold uppercase">
                          <MapPin size={10} /> {al.location.name}
                        </span>
                      ))
                    )}
                  </div>
                  <h3 className="text-2xl font-bold text-[#1B1C1C]">
                    {entryToViewDetails.companyName}
                  </h3>
                  <p className="text-[#616161] mt-0.5">
                    Dispatched on {new Date(entryToViewDetails.sentAt).toLocaleDateString('en-IN')} via{' '}
                    <span className="font-bold">{entryToViewDetails.sendType === 'AUTOMATIC_MONTH_END' ? 'AUTOMATIC MONTH-END' : 'MANUAL DISPATCH'}</span> by{' '}
                    <span className="font-bold text-[#1B1C1C]">{entryToViewDetails.createdBy?.name || 'System'}</span> ({entryToViewDetails.createdBy?.email})
                  </p>
                </div>
                <button
                  onClick={() => setEntryToViewDetails(null)}
                  className="text-neutral-400 hover:text-neutral-700 p-1"
                >
                  <X size={20} />
                </button>
              </div>

              {/* SECTION 1: Cabin, Seating & Line-Item Products Breakdown */}
              <div className="space-y-3">
                <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--primary)] flex items-center gap-1.5">
                  <Building2 size={14} /> Cabin, Seating & Billing Amounts
                </div>

                {entryToViewDetails.clientMaster?.products && entryToViewDetails.clientMaster.products.length > 0 ? (
                  <div className="space-y-3">
                    {entryToViewDetails.clientMaster.products.map((p, idx) => {
                      const isParking = p.cabinName?.toLowerCase().includes('parking');
                      return (
                        <div key={idx} className="bg-[#F8F9FA] p-4 border border-[var(--outline-variant)]/50 relative">
                          <div className="flex items-center justify-between border-b border-neutral-200 pb-2 mb-3">
                            <div className="font-extrabold uppercase text-[#006064] text-[10px] tracking-wider flex items-center gap-2">
                              ITEM #{idx + 1}
                              {isParking && (
                                <span className="px-1.5 py-0.2 bg-amber-100 text-amber-800 text-[8px] font-black uppercase tracking-wider">
                                  PARKING MODE
                                </span>
                              )}
                            </div>
                            <div className="font-mono font-bold text-xs text-[#006064]">
                              Total: ₹{Number(p.totalAmount || 0).toLocaleString('en-IN')}
                            </div>
                          </div>

                          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs">
                            <div>
                              <div className="font-bold uppercase text-[#616161] text-[9px]">Cabin / Product Name</div>
                              <div className="font-bold text-[#1B1C1C] mt-0.5">{p.cabinName || 'N/A'}</div>
                            </div>

                            <div>
                              <div className="font-bold uppercase text-[#616161] text-[9px]">
                                {isParking ? 'No of Parking' : 'No of Seats'}
                              </div>
                              <div className="font-bold text-[#1B1C1C] mt-0.5">{p.noOfSeats || 0}</div>
                            </div>

                            <div>
                              <div className="font-bold uppercase text-[#616161] text-[9px]">Rate As Per Agreement (₹)</div>
                              <div className="font-bold text-[#1B1C1C] mt-0.5">₹{Number(p.ratePerAgreement || 0).toLocaleString('en-IN')}</div>
                            </div>

                            <div>
                              <div className="font-bold uppercase text-[#616161] text-[9px]">Amount (₹)</div>
                              <div className="font-bold text-blue-700 mt-0.5">₹{Number(p.amount || 0).toLocaleString('en-IN')}</div>
                            </div>

                            <div>
                              <div className="font-bold uppercase text-[#616161] text-[9px]">GST (%)</div>
                              <div className="font-bold text-neutral-700 mt-0.5">{p.gstPercent ?? 18}%</div>
                            </div>
                          </div>
                        </div>
                      );
                    })}

                    {/* GRAND TOTAL SUMMARY BAR */}
                    <div className="p-4 bg-[#00363A] text-white flex flex-wrap items-center justify-between gap-4">
                      <div className="font-extrabold uppercase text-xs tracking-wider">
                        Grand Total (All Items)
                      </div>
                      <div className="flex items-center gap-6 text-xs font-mono">
                        <div>
                          <span className="text-white/70 text-[9px] uppercase tracking-wider block">Total Subtotal</span>
                          <span className="font-bold text-sm">
                            ₹{Number(
                              entryToViewDetails.clientMaster.products.reduce((sum, p) => sum + (Number(p.amount) || 0), 0)
                            ).toLocaleString('en-IN')}
                          </span>
                        </div>
                        <div>
                          <span className="text-white/70 text-[9px] uppercase tracking-wider block">Total GST</span>
                          <span className="font-bold text-sm">
                            ₹{Number(
                              entryToViewDetails.clientMaster.products.reduce((sum, p) => sum + (Number(p.totalAmount || 0) - Number(p.amount || 0)), 0)
                            ).toLocaleString('en-IN')}
                          </span>
                        </div>
                        <div className="bg-white/10 px-3 py-1.5 border border-white/20">
                          <span className="text-white/70 text-[9px] uppercase tracking-wider block">Grand Total</span>
                          <span className="font-black text-base text-emerald-300">
                            ₹{Number(
                              entryToViewDetails.clientMaster.products.reduce((sum, p) => sum + (Number(p.totalAmount) || 0), 0)
                            ).toLocaleString('en-IN')}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-[#F8F9FA] p-4 border border-[var(--outline-variant)]/40">
                    <div>
                      <div className="font-bold uppercase text-[#616161] text-[9px]">Cabin Name</div>
                      <div className="font-bold text-[#1B1C1C] mt-0.5 text-sm">{entryToViewDetails.cabinName || 'N/A'}</div>
                    </div>
                    <div>
                      <div className="font-bold uppercase text-[#616161] text-[9px]">Seats & Agreement Rate</div>
                      <div className="font-bold text-[#1B1C1C] mt-0.5">
                        {entryToViewDetails.noOfSeats || 0} seats @ ₹
                        {Number(entryToViewDetails.ratePerAgreement || 0).toLocaleString('en-IN')}
                      </div>
                    </div>
                    <div>
                      <div className="font-bold uppercase text-[#616161] text-[9px]">GST %</div>
                      <div className="font-bold text-[#1B1C1C] mt-0.5">{entryToViewDetails.gstPercent ?? 18}%</div>
                    </div>
                    <div>
                      <div className="font-bold uppercase text-[#616161] text-[9px]">Total Amount (Amt + GST)</div>
                      <div className="font-black text-base text-[var(--primary)] mt-0.5">
                        ₹{Number(entryToViewDetails.totalAmount || 0).toLocaleString('en-IN')}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* SECTION 2: Head Office & GST Details */}
              <div className="space-y-2">
                <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--primary)] flex items-center gap-1.5">
                  <FileText size={14} /> Head Office Address & GST Status
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-[#F8F9FA] p-4 border border-[var(--outline-variant)]/40">
                  <div>
                    <div className="font-bold uppercase text-[#616161] text-[9px]">Head Office (HO) Address</div>
                    <div className="font-medium text-[#1B1C1C] mt-0.5">
                      {entryToViewDetails.clientMaster?.hoAddress || 'Not Provided'}
                    </div>
                  </div>
                  <div>
                    <div className="font-bold uppercase text-[#616161] text-[9px]">GST Number & Status</div>
                    <div className="font-mono font-bold text-[#1B1C1C] mt-0.5">
                      {entryToViewDetails.gstNo ? `GST: ${entryToViewDetails.gstNo}` : (entryToViewDetails.clientMaster?.gstStatus || 'UNREGISTERED')}
                    </div>
                  </div>
                </div>
              </div>

              {/* SECTION 3: Agreement Dates, Lock-In & Notice Terms */}
              <div className="space-y-2">
                <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--primary)] flex items-center gap-1.5">
                  <Calendar size={14} /> Agreement Dates, Lock-In & Notice Terms
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-[#F8F9FA] p-4 border border-[var(--outline-variant)]/40">
                  <div>
                    <div className="font-bold uppercase text-[#616161] text-[9px]">Agreement Start Date</div>
                    <div className="font-bold text-[#1B1C1C] mt-0.5">
                      {entryToViewDetails.clientMaster?.agreementStartDate
                        ? new Date(entryToViewDetails.clientMaster.agreementStartDate).toLocaleDateString('en-IN')
                        : 'N/A'}
                    </div>
                  </div>
                  <div>
                    <div className="font-bold uppercase text-[#616161] text-[9px]">Agreement End Date</div>
                    <div className="font-bold text-[#1B1C1C] mt-0.5">
                      {entryToViewDetails.clientMaster?.agreementEndDate
                        ? new Date(entryToViewDetails.clientMaster.agreementEndDate).toLocaleDateString('en-IN')
                        : 'N/A'}
                    </div>
                  </div>
                  <div>
                    <div className="font-bold uppercase text-[#616161] text-[9px]">Lock-In End Date</div>
                    <div className="font-bold text-[#1B1C1C] mt-0.5">
                      {entryToViewDetails.clientMaster?.lockinEndDate
                        ? new Date(entryToViewDetails.clientMaster.lockinEndDate).toLocaleDateString('en-IN')
                        : 'N/A'}
                    </div>
                  </div>
                  <div>
                    <div className="font-bold uppercase text-[#616161] text-[9px]">Notice Period</div>
                    <div className="font-bold text-[#1B1C1C] mt-0.5">
                      {entryToViewDetails.clientMaster?.noticePeriodMonths
                        ? `${entryToViewDetails.clientMaster.noticePeriodMonths} Months (${entryToViewDetails.clientMaster.noticePeriodApplicable || 'After Lock-in'})`
                        : 'N/A'}
                    </div>
                  </div>
                  <div>
                    <div className="font-bold uppercase text-[#616161] text-[9px]">Escalation %</div>
                    <div className="font-bold text-[#1B1C1C] mt-0.5">
                      {entryToViewDetails.clientMaster?.escalationPercent
                        ? `${entryToViewDetails.clientMaster.escalationPercent}%`
                        : 'N/A'}
                    </div>
                  </div>
                  <div>
                    <div className="font-bold uppercase text-[#616161] text-[9px]">Escalation Applicable Date</div>
                    <div className="font-bold text-[#1B1C1C] mt-0.5">
                      {entryToViewDetails.clientMaster?.escalationApplicable
                        ? new Date(entryToViewDetails.clientMaster.escalationApplicable).toLocaleDateString('en-IN')
                        : 'N/A'}
                    </div>
                  </div>
                </div>
              </div>

              {/* SECTION 4: TDS & Security Deposit (SDR) */}
              <div className="space-y-2">
                <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--primary)] flex items-center gap-1.5">
                  <Tag size={14} /> TDS Deduction, TAT & Security Deposit (SDR)
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-[#F8F9FA] p-4 border border-[var(--outline-variant)]/40">
                  <div>
                    <div className="font-bold uppercase text-[#616161] text-[9px]">Will Deduct TDS?</div>
                    <div className="font-bold text-[#1B1C1C] mt-0.5">
                      {entryToViewDetails.clientMaster?.willDeductTds ? 'Yes' : 'No'}
                    </div>
                  </div>
                  <div>
                    <div className="font-bold uppercase text-[#616161] text-[9px]">TAT Number</div>
                    <div className="font-mono font-bold text-[#1B1C1C] mt-0.5">
                      {entryToViewDetails.clientMaster?.tanNo || 'N/A'}
                    </div>
                  </div>
                  <div>
                    <div className="font-bold uppercase text-[#616161] text-[9px]">Client ID (Manual)</div>
                    <div className="font-mono font-bold text-[#1B1C1C] mt-0.5">
                      {entryToViewDetails.clientMaster?.clientId || 'N/A'}
                    </div>
                  </div>
                  <div>
                    <div className="font-bold uppercase text-[#616161] text-[9px]">Security Deposit (SDR)</div>
                    <div className="font-bold text-[#1B1C1C] mt-0.5">
                      {entryToViewDetails.clientMaster?.sorAmount
                        ? `₹${Number(entryToViewDetails.clientMaster.sorAmount).toLocaleString('en-IN')}`
                        : 'N/A'}
                      {entryToViewDetails.clientMaster?.sorRecdDate && (
                        <span className="text-[10px] text-neutral-500 font-normal block">
                          SDR Recd: {new Date(entryToViewDetails.clientMaster.sorRecdDate).toLocaleDateString('en-IN')}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* SECTION 5: Contact Person(s) */}
              {entryToViewDetails.clientMaster?.contactPersons && entryToViewDetails.clientMaster.contactPersons.length > 0 && (
                <div className="space-y-2">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--primary)] flex items-center gap-1.5">
                    <UserCheck size={14} /> Contact Person(s) Details
                  </div>
                  <div className="border border-[var(--outline-variant)]/40 overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-[#F8F9FA] font-bold text-[#616161] uppercase text-[9px] border-b border-neutral-200">
                        <tr>
                          <th className="p-2.5">Name</th>
                          <th className="p-2.5">Designation</th>
                          <th className="p-2.5">Mobile No</th>
                          <th className="p-2.5">Email</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-100 font-medium">
                        {entryToViewDetails.clientMaster.contactPersons.map((cp, idx) => (
                          <tr key={idx}>
                            <td className="p-2.5 font-bold text-[#1B1C1C]">{cp.name}</td>
                            <td className="p-2.5 text-neutral-600">{cp.designation || 'N/A'}</td>
                            <td className="p-2.5 font-mono">{cp.mobileNo || 'N/A'}</td>
                            <td className="p-2.5 font-mono">{cp.email || 'N/A'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* SECTION 6: Attached Tally PDF Invoice */}
              {entryToViewDetails.attachedInvoice && (
                <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-xs flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Paperclip className="text-emerald-700 h-5 w-5" />
                    <div>
                      <span className="font-bold text-emerald-900">Attached Tally Invoice PDF: </span>
                      <span className="text-emerald-800">{entryToViewDetails.attachedInvoice.fileName}</span>
                    </div>
                  </div>
                  <a
                    href={entryToViewDetails.attachedInvoice.fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-1.5 bg-emerald-700 text-white font-bold text-[10px] uppercase tracking-wider hover:bg-emerald-800 flex items-center gap-1"
                  >
                    <Eye size={12} /> View Tally PDF
                  </a>
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-neutral-200">
                <button
                  type="button"
                  onClick={() => setEntryToViewDetails(null)}
                  className="px-5 py-2.5 bg-[#F8F9FA] border border-[var(--outline-variant)] font-bold uppercase tracking-wider text-[#616161] hover:bg-neutral-100"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL 4: EDIT INVOICE RECORD MODAL */}
      <AnimatePresence>
        {entryToEditInvoice && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/70 backdrop-blur-xs overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 15 }}
              className="bg-white border border-[var(--outline-variant)] w-full max-w-2xl shadow-2xl overflow-hidden font-sans text-xs"
            >
              <div className="p-5 bg-[#006064] text-white flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 bg-white/10 flex items-center justify-center font-bold text-sm">
                    #{entryToEditInvoice.srNo}
                  </div>
                  <div>
                    <h2 className="text-base font-bold tracking-tight uppercase">
                      Edit Invoice Record (#{entryToEditInvoice.srNo})
                    </h2>
                    <p className="text-xs text-white/80 font-light">
                      Modify company name, seat rates, billing month, and status parameters.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setEntryToEditInvoice(null)}
                  className="text-white/80 hover:text-white p-1.5 hover:bg-white/10 transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleSaveEditInvoice} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-[#616161] mb-1">
                      Company Name
                    </label>
                    <input
                      type="text"
                      required
                      value={editCompanyName}
                      onChange={(e) => setEditCompanyName(e.target.value)}
                      className="w-full bg-white border border-[var(--outline-variant)] px-3 py-2 text-xs font-bold focus:outline-none focus:border-[#006064]"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-[#616161] mb-1">
                      Cabin Name / Product
                    </label>
                    <input
                      type="text"
                      value={editCabinName}
                      onChange={(e) => setEditCabinName(e.target.value)}
                      placeholder="e.g. Dedicated Cabin"
                      className="w-full bg-white border border-[var(--outline-variant)] px-3 py-2 text-xs font-bold focus:outline-none focus:border-[#006064]"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-[#616161] mb-1">
                      No of Seats
                    </label>
                    <input
                      type="number"
                      value={editNoOfSeats}
                      onChange={(e) => setEditNoOfSeats(e.target.value === '' ? '' : Number(e.target.value))}
                      className="w-full bg-white border border-[var(--outline-variant)] px-3 py-2 text-xs font-bold focus:outline-none focus:border-[#006064]"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-[#616161] mb-1">
                      Rate Per Agreement (₹)
                    </label>
                    <input
                      type="number"
                      value={editRatePerAgreement}
                      onChange={(e) => setEditRatePerAgreement(e.target.value === '' ? '' : Number(e.target.value))}
                      className="w-full bg-white border border-[var(--outline-variant)] px-3 py-2 text-xs font-bold focus:outline-none focus:border-[#006064]"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-[#616161] mb-1">
                      Amount (₹)
                    </label>
                    <input
                      type="number"
                      value={editAmount}
                      onChange={(e) => setEditAmount(e.target.value === '' ? '' : Number(e.target.value))}
                      className="w-full bg-white border border-[var(--outline-variant)] px-3 py-2 text-xs font-bold focus:outline-none focus:border-[#006064]"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-[#616161] mb-1">
                      GST (%)
                    </label>
                    <input
                      type="number"
                      value={editGstPercent}
                      onChange={(e) => setEditGstPercent(e.target.value === '' ? '' : Number(e.target.value))}
                      className="w-full bg-white border border-[var(--outline-variant)] px-3 py-2 text-xs font-bold focus:outline-none focus:border-[#006064]"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-[#616161] mb-1">
                      Total Amount (₹)
                    </label>
                    <input
                      type="number"
                      value={editTotalAmount}
                      onChange={(e) => setEditTotalAmount(e.target.value === '' ? '' : Number(e.target.value))}
                      className="w-full bg-white border border-[var(--outline-variant)] px-3 py-2 text-xs font-bold focus:outline-none focus:border-[#006064] text-[#006064]"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-[#616161] mb-1">
                      GST No
                    </label>
                    <input
                      type="text"
                      value={editGstNo}
                      onChange={(e) => setEditGstNo(e.target.value)}
                      className="w-full bg-white border border-[var(--outline-variant)] px-3 py-2 text-xs font-mono font-bold focus:outline-none focus:border-[#006064]"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-[#616161] mb-1">
                      Billing Month
                    </label>
                    <input
                      type="text"
                      value={editBillingMonth}
                      onChange={(e) => setEditBillingMonth(e.target.value)}
                      placeholder="e.g. August 2026"
                      className="w-full bg-white border border-[var(--outline-variant)] px-3 py-2 text-xs font-bold focus:outline-none focus:border-[#006064]"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-[#616161] mb-1">
                      Workflow Status
                    </label>
                    <select
                      value={editStatus}
                      onChange={(e) => setEditStatus(e.target.value as any)}
                      className="w-full bg-white border border-[var(--outline-variant)] px-3 py-2 text-xs font-bold focus:outline-none focus:border-[#006064]"
                    >
                      <option value="PENDING_CM_REVIEW">Pending CM Review</option>
                      <option value="SENT_TO_ACCOUNTANT">Sent to Accountant</option>
                      <option value="INVOICE_ATTACHED">Invoice Attached</option>
                      <option value="APPROVED">Approved</option>
                      <option value="REJECTED_WITH_REMARKS">Rejected with Remarks</option>
                    </select>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 pt-4 border-t border-neutral-200">
                  <button
                    type="button"
                    onClick={() => setEntryToEditInvoice(null)}
                    className="px-4 py-2 bg-neutral-100 hover:bg-neutral-200 text-[#1B1C1C] font-bold text-xs uppercase tracking-wider"
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    disabled={actionLoading}
                    className="px-5 py-2 bg-[#006064] hover:bg-teal-900 text-white font-bold text-xs uppercase tracking-wider flex items-center gap-2"
                  >
                    {actionLoading ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                    Save Invoice Changes
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
