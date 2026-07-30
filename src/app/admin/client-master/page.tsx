'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  MapPin,
  Building2,
  Plus,
  Trash2,
  Edit2,
  Search,
  Calendar,
  CheckCircle2,
  Loader2,
  DollarSign,
  Users,
  X,
  Filter,
  RefreshCw,
  Send,
  Eye,
  UserCheck,
  Paperclip,
  UserPlus,
  Percent,
  Download,
  CheckSquare,
  Square,
  Clock,
  Shield,
  FileText
} from 'lucide-react';
import { toast } from 'sonner';
import { FadeUp } from '@/components/ui/fade-up';
import { useAuth } from '@/context/AuthContext';

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

interface ClientMasterEntry {
  id: number;
  srNo: number;
  companyName: string;
  hoAddress: string | null;
  gstStatus: 'REGISTERED' | 'UNREGISTERED';
  gstNo: string | null;
  gstPdfUrl: string | null;
  gstPdfName: string | null;
  agreementStartDate: string | null;
  agreementEndDate: string | null;
  lockinEndDate: string | null;
  noticePeriodMonths: number | null;
  noticePeriodApplicable: string | null;
  escalationPercent: number | null;
  escalationApplicable: number | null;
  cabinName: string | null;
  noOfSeats: number | null;
  ratePerAgreement: number | null;
  amount: number | null;
  gstPercent: number | null;
  totalAmount: number | null;
  willDeductTds: boolean;
  tanNo: string | null;
  tdsPdfUrl: string | null;
  tdsPdfName: string | null;
  clientId: string | null;
  sorAmount: number | null;
  sorRecdDate: string | null;
  clientStatus: string | null;
  createdAt: string;
  createdBy: { id: number; name: string; email: string; assignedLocations?: { location: LocationOption }[] };
  contactPersons: ContactPerson[];
}

const CLIENT_STATUS_OPTIONS = ['Active', 'Inactive', 'On Notice', 'Terminated', 'Pending Renewal'];
const NOTICE_APPLICABLE_OPTIONS = ['After Lock-in', 'Before Lock-in'];

export default function ClientMasterRegistryPage() {
  const { user, isRole } = useAuth();
  const userRole = (user?.role || '').toUpperCase();
  const isAdmin = userRole === 'ADMIN' || userRole === 'SUPER_ADMIN' || userRole === 'SUPER-ADMIN' || isRole('ADMIN');
  const isCommunityManager = isRole('COMMUNITY_MANAGER');
  const userEmail = user?.email?.toLowerCase() || '';
  const isAccountant = isCommunityManager && userEmail === 'ssinfrazone21@gmail.com';

  if (isAccountant && !isAdmin) {
    return (
      <div className="p-10 max-w-lg mx-auto text-center space-y-4 bg-white border border-red-200 mt-20 shadow-sm">
        <div className="text-4xl text-red-500">🔒</div>
        <h2 className="text-xl font-bold text-red-700">Access Denied</h2>
        <p className="text-xs text-[#616161]">
          Accountants do not have access to the Client Master Data Entry repository. Please visit the <strong>Invoices Section</strong> to process Tally PDF invoices.
        </p>
      </div>
    );
  }

  const [entries, setEntries] = useState<ClientMasterEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  // Search & Filter
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedClientStatusFilter, setSelectedClientStatusFilter] = useState('ALL');

  // Node/Location filter (Admin only)
  const [locations, setLocations] = useState<LocationOption[]>([]);
  const [selectedLocationFilter, setSelectedLocationFilter] = useState('ALL');

  // Multi-select for manual dispatch
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [dispatching, setDispatching] = useState(false);

  // Big Popup Modal for Add Client / Edit Client
  const [showAddClientModal, setShowAddClientModal] = useState(false);

  // View Details Modal
  const [entryToViewDetails, setEntryToViewDetails] = useState<ClientMasterEntry | null>(null);

  // ---------------- FORM STATE ----------------
  const [srNoDisplay, setSrNoDisplay] = useState<number>(1);
  const [companyName, setCompanyName] = useState('');
  const [hoAddress, setHoAddress] = useState('');
  const [gstStatus, setGstStatus] = useState<'REGISTERED' | 'UNREGISTERED'>('UNREGISTERED');
  const [gstNo, setGstNo] = useState('');
  const [gstPdfUrl, setGstPdfUrl] = useState('');
  const [gstPdfName, setGstPdfName] = useState('');
  const [uploadingGstPdf, setUploadingGstPdf] = useState(false);

  const [contactPersons, setContactPersons] = useState<ContactPerson[]>([
    { name: '', designation: '', mobileNo: '', email: '' }
  ]);

  const [agreementStartDate, setAgreementStartDate] = useState('');
  const [agreementEndDate, setAgreementEndDate] = useState('');
  const [lockinEndDate, setLockinEndDate] = useState('');
  const [noticePeriodMonths, setNoticePeriodMonths] = useState<number | ''>('');
  const [noticePeriodApplicable, setNoticePeriodApplicable] = useState('After Lock-in');

  const [escalationPercent, setEscalationPercent] = useState<number | ''>('');
  const [escalationApplicable, setEscalationApplicable] = useState<number | ''>('');
  const [cabinName, setCabinName] = useState('');
  const [noOfSeats, setNoOfSeats] = useState<number | ''>('');
  const [ratePerAgreement, setRatePerAgreement] = useState<number | ''>('');

  const [amount, setAmount] = useState<number | ''>('');
  const [isAmountManuallyEdited, setIsAmountManuallyEdited] = useState(false);

  const [gstPercent, setGstPercent] = useState<number | ''>(18);
  const [totalAmount, setTotalAmount] = useState<number | ''>('');
  const [isTotalAmountManuallyEdited, setIsTotalAmountManuallyEdited] = useState(false);

  const [willDeductTds, setWillDeductTds] = useState(false);
  const [tanNo, setTanNo] = useState('');
  const [tdsPdfUrl, setTdsPdfUrl] = useState('');
  const [tdsPdfName, setTdsPdfName] = useState('');
  const [uploadingTdsPdf, setUploadingTdsPdf] = useState(false);

  const [clientId, setClientId] = useState('');
  const [sorAmount, setSorAmount] = useState<number | ''>('');
  const [sorRecdDate, setSorRecdDate] = useState('');
  const [clientStatus, setClientStatus] = useState('Active');

  // Compute Auto Amount (seats * rate)
  const computedAmount = useMemo(() => {
    const seats = Number(noOfSeats) || 0;
    const rate = Number(ratePerAgreement) || 0;
    return seats * rate;
  }, [noOfSeats, ratePerAgreement]);

  useEffect(() => {
    if (!isAmountManuallyEdited) {
      setAmount(computedAmount);
    }
  }, [computedAmount, isAmountManuallyEdited]);

  // Compute Auto Total Amount (Amount + GST %)
  const computedTotalAmount = useMemo(() => {
    const baseAmt = Number(amount) || 0;
    const gstPct = Number(gstPercent) || 0;
    const gstVal = (baseAmt * gstPct) / 100;
    return Math.round((baseAmt + gstVal) * 100) / 100;
  }, [amount, gstPercent]);

  useEffect(() => {
    if (!isTotalAmountManuallyEdited) {
      setTotalAmount(computedTotalAmount);
    }
  }, [computedTotalAmount, isTotalAmountManuallyEdited]);

  // Fetch locations for Admin filter dropdown
  const fetchLocations = useCallback(async () => {
    if (!isAdmin) return;
    try {
      const res = await fetch('/api/admin/locations?limit=100');
      const json = await res.json();
      const locList = json.data || json.locations || (Array.isArray(json) ? json : []);
      if (Array.isArray(locList)) {
        setLocations(locList.map((l: any) => ({ id: l.id, name: l.name })));
      }
    } catch { /* ignore */ }
  }, [isAdmin]);

  // Fetch data
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (isAdmin && selectedLocationFilter !== 'ALL') {
        params.set('locationId', selectedLocationFilter);
      }
      const url = `/api/admin/client-master${params.toString() ? '?' + params.toString() : ''}`;
      const res = await fetch(url);
      const json = await res.json();
      if (json.success) {
        setEntries(json.data);
        if (json.data.length > 0) {
          const maxSr = Math.max(...json.data.map((e: any) => e.srNo || 0));
          setSrNoDisplay(maxSr + 1);
        } else {
          setSrNoDisplay(1);
        }
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to load client master entries');
    } finally {
      setLoading(false);
    }
  }, [isAdmin, selectedLocationFilter]);

  useEffect(() => {
    fetchLocations();
  }, [fetchLocations]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Contact Persons Handlers
  const handleAddContactPerson = () => {
    setContactPersons([
      ...contactPersons,
      { name: '', designation: '', mobileNo: '', email: '' }
    ]);
  };

  const handleRemoveContactPerson = (index: number) => {
    if (contactPersons.length === 1) {
      toast.error('At least one contact person is required');
      return;
    }
    setContactPersons(contactPersons.filter((_, i) => i !== index));
  };

  const handleUpdateContactPerson = (index: number, field: keyof ContactPerson, val: string) => {
    const updated = [...contactPersons];
    updated[index] = { ...updated[index], [field]: val };
    setContactPersons(updated);
  };

  // Upload Handlers for GST and TDS PDFs
  const handleFileUpload = async (file: File, type: 'GST' | 'TDS') => {
    if (type === 'GST') setUploadingGstPdf(true);
    if (type === 'TDS') setUploadingTdsPdf(true);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/admin/upload-pdf', {
        method: 'POST',
        body: formData
      });
      const json = await res.json();

      if (json.success) {
        if (type === 'GST') {
          setGstPdfUrl(json.data.fileUrl);
          setGstPdfName(json.data.fileName);
          toast.success('GST PDF uploaded successfully');
        } else {
          setTdsPdfUrl(json.data.fileUrl);
          setTdsPdfName(json.data.fileName);
          toast.success('TDS PDF uploaded successfully');
        }
      } else {
        toast.error(json.error || 'Upload failed');
      }
    } catch {
      toast.error('File upload failed');
    } finally {
      if (type === 'GST') setUploadingGstPdf(false);
      if (type === 'TDS') setUploadingTdsPdf(false);
    }
  };

  // Reset Form
  const resetForm = () => {
    setEditingId(null);
    setCompanyName('');
    setHoAddress('');
    setGstStatus('UNREGISTERED');
    setGstNo('');
    setGstPdfUrl('');
    setGstPdfName('');
    setContactPersons([{ name: '', designation: '', mobileNo: '', email: '' }]);
    setAgreementStartDate('');
    setAgreementEndDate('');
    setLockinEndDate('');
    setNoticePeriodMonths('');
    setNoticePeriodApplicable('After Lock-in');
    setEscalationPercent('');
    setEscalationApplicable('');
    setCabinName('');
    setNoOfSeats('');
    setRatePerAgreement('');
    setAmount('');
    setIsAmountManuallyEdited(false);
    setGstPercent(18);
    setTotalAmount('');
    setIsTotalAmountManuallyEdited(false);
    setWillDeductTds(false);
    setTanNo('');
    setTdsPdfUrl('');
    setTdsPdfName('');
    setClientId('');
    setSorAmount('');
    setSorRecdDate('');
    setClientStatus('Active');

    const maxSr = entries.length > 0 ? Math.max(...entries.map((e) => e.srNo || 0)) : 0;
    setSrNoDisplay(maxSr + 1);
  };

  // Populate Form for Editing
  const handleEditEntry = (entry: ClientMasterEntry) => {
    setEditingId(entry.id);
    setSrNoDisplay(entry.srNo);
    setCompanyName(entry.companyName);
    setHoAddress(entry.hoAddress || '');
    setGstStatus(entry.gstStatus || 'UNREGISTERED');
    setGstNo(entry.gstNo || '');
    setGstPdfUrl(entry.gstPdfUrl || '');
    setGstPdfName(entry.gstPdfName || '');

    if (entry.contactPersons && entry.contactPersons.length > 0) {
      setContactPersons(
        entry.contactPersons.map((cp) => ({
          name: cp.name || '',
          designation: cp.designation || '',
          mobileNo: cp.mobileNo || '',
          email: cp.email || ''
        }))
      );
    } else {
      setContactPersons([{ name: '', designation: '', mobileNo: '', email: '' }]);
    }

    setAgreementStartDate(entry.agreementStartDate ? new Date(entry.agreementStartDate).toISOString().split('T')[0] : '');
    setAgreementEndDate(entry.agreementEndDate ? new Date(entry.agreementEndDate).toISOString().split('T')[0] : '');
    setLockinEndDate(entry.lockinEndDate ? new Date(entry.lockinEndDate).toISOString().split('T')[0] : '');
    setNoticePeriodMonths(entry.noticePeriodMonths ?? '');
    setNoticePeriodApplicable(entry.noticePeriodApplicable || 'After Lock-in');

    setEscalationPercent(entry.escalationPercent ?? '');
    setEscalationApplicable(entry.escalationApplicable ?? '');
    setCabinName(entry.cabinName || '');
    setNoOfSeats(entry.noOfSeats ?? '');
    setRatePerAgreement(entry.ratePerAgreement ?? '');
    setAmount(entry.amount ?? '');
    setIsAmountManuallyEdited(true);
    setGstPercent(entry.gstPercent ?? 18);
    setTotalAmount(entry.totalAmount ?? '');
    setIsTotalAmountManuallyEdited(true);

    setWillDeductTds(Boolean(entry.willDeductTds));
    setTanNo(entry.tanNo || '');
    setTdsPdfUrl(entry.tdsPdfUrl || '');
    setTdsPdfName(entry.tdsPdfName || '');

    setClientId(entry.clientId || '');
    setSorAmount(entry.sorAmount ?? '');
    setSorRecdDate(entry.sorRecdDate ? new Date(entry.sorRecdDate).toISOString().split('T')[0] : '');
    setClientStatus(entry.clientStatus || 'Active');

    setShowAddClientModal(true);
  };

  // Submit Handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!companyName.trim()) {
      toast.error('Please enter Company Name');
      return;
    }

    if (gstStatus === 'REGISTERED' && !gstNo.trim()) {
      toast.error('Please enter GST No for Registered GST status');
      return;
    }

    if (willDeductTds && !tanNo.trim()) {
      toast.error('Please enter TAN No when TDS deduction is Yes');
      return;
    }

    setSubmitting(true);

    const payload = {
      companyName: companyName.trim(),
      hoAddress: hoAddress.trim() || null,
      gstStatus,
      gstNo: gstStatus === 'REGISTERED' ? gstNo.trim() : null,
      gstPdfUrl: gstStatus === 'REGISTERED' ? gstPdfUrl : null,
      gstPdfName: gstStatus === 'REGISTERED' ? gstPdfName : null,
      agreementStartDate: agreementStartDate || null,
      agreementEndDate: agreementEndDate || null,
      lockinEndDate: lockinEndDate || null,
      noticePeriodMonths: noticePeriodMonths !== '' ? Number(noticePeriodMonths) : null,
      noticePeriodApplicable,
      escalationPercent: escalationPercent !== '' ? Number(escalationPercent) : null,
      escalationApplicable: escalationApplicable !== '' ? Number(escalationApplicable) : null,
      cabinName: cabinName.trim() || null,
      noOfSeats: noOfSeats !== '' ? Number(noOfSeats) : null,
      ratePerAgreement: ratePerAgreement !== '' ? Number(ratePerAgreement) : null,
      amount: amount !== '' ? Number(amount) : null,
      gstPercent: gstPercent !== '' ? Number(gstPercent) : null,
      totalAmount: totalAmount !== '' ? Number(totalAmount) : null,
      willDeductTds,
      tanNo: willDeductTds ? tanNo.trim() : null,
      tdsPdfUrl: willDeductTds ? tdsPdfUrl : null,
      tdsPdfName: willDeductTds ? tdsPdfName : null,
      clientId: clientId.trim() || null,
      sorAmount: sorAmount !== '' ? Number(sorAmount) : null,
      sorRecdDate: sorRecdDate || null,
      clientStatus,
      contactPersons: contactPersons.filter((cp) => cp.name.trim() !== '')
    };

    try {
      const url = editingId ? `/api/admin/client-master/${editingId}` : '/api/admin/client-master';
      const method = editingId ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const json = await res.json();

      if (json.success) {
        toast.success(editingId ? 'Client entry updated!' : 'Client added to Master Registry!');
        setShowAddClientModal(false);
        resetForm();
        fetchData();
      } else {
        toast.error(json.error || 'Operation failed');
      }
    } catch {
      toast.error('An error occurred while saving client entry');
    } finally {
      setSubmitting(false);
    }
  };

  // Dispatch to Invoices Section Handler
  const handleDispatchToInvoices = async (sendType: 'MANUAL' | 'AUTOMATIC_MONTH_END', ids: number[] = []) => {
    setDispatching(true);
    try {
      const res = await fetch('/api/admin/client-master/dispatch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sendType, clientMasterIds: ids })
      });
      const json = await res.json();

      if (json.success) {
        toast.success(`✅ ${json.message}`);
        setSelectedIds([]);
      } else {
        toast.error(json.error || 'Failed to dispatch to Invoices section');
      }
    } catch {
      toast.error('Error dispatching to Invoices section');
    } finally {
      setDispatching(false);
    }
  };

  // Delete Entry
  const handleDeleteEntry = async (id: number) => {
    if (!confirm('Are you sure you want to delete this client entry from Master Registry?')) return;

    try {
      const res = await fetch(`/api/admin/client-master/${id}`, {
        method: 'DELETE'
      });
      const json = await res.json();
      if (json.success) {
        toast.success('Client entry deleted');
        fetchData();
      } else {
        toast.error(json.error || 'Failed to delete');
      }
    } catch {
      toast.error('Failed to delete client entry');
    }
  };

  // Multi-select toggle
  const toggleSelectAll = () => {
    if (selectedIds.length === filteredEntries.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredEntries.map((e) => e.id));
    }
  };

  const toggleSelectId = (id: number) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  };

  // Filtered Entries
  const filteredEntries = useMemo(() => {
    return entries.filter((e) => {
      const matchesSearch =
        e.companyName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (e.gstNo && e.gstNo.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (e.clientId && e.clientId.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (e.cabinName && e.cabinName.toLowerCase().includes(searchTerm.toLowerCase())) ||
        e.contactPersons.some((cp) => cp.name.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchesClientStatus =
        selectedClientStatusFilter === 'ALL' || e.clientStatus === selectedClientStatusFilter;

      return matchesSearch && matchesClientStatus;
    });
  }, [entries, searchTerm, selectedClientStatusFilter]);

  // KPIs
  const kpis = useMemo(() => {
    const totalClients = entries.length;
    const activeClients = entries.filter((e) => e.clientStatus === 'Active').length;
    const onNotice = entries.filter((e) => e.clientStatus === 'On Notice').length;
    const totalSeats = entries.reduce((acc, curr) => acc + (Number(curr.noOfSeats) || 0), 0);
    const totalRev = entries.reduce((acc, curr) => acc + (Number(curr.totalAmount) || 0), 0);

    return { totalClients, activeClients, onNotice, totalSeats, totalRev };
  }, [entries]);

  return (
    <div className="p-6 sm:p-10 max-w-[1600px] mx-auto space-y-8 bg-[#F8F9FA] min-h-screen text-[#1B1C1C]">
      {/* Header Banner: Automatic Dispatch Notice */}
      <FadeUp>
        <div className="bg-emerald-950 text-emerald-100 p-4 border border-emerald-800 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 bg-emerald-800/60 rounded-full flex items-center justify-center shrink-0">
              <Clock className="h-5 w-5 text-emerald-400" />
            </div>
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                Data Entry Repository & Automatic Month-End Dispatch System
              </div>
              <div className="text-xs font-light text-emerald-200">
                All active client records here automatically generate monthly entries in the <strong>Invoices Section</strong> on the last working day of every month.
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => handleDispatchToInvoices('AUTOMATIC_MONTH_END')}
            disabled={dispatching}
            className="px-4 py-2 bg-emerald-700 hover:bg-emerald-600 text-white font-bold text-xs uppercase tracking-wider transition-colors shrink-0 flex items-center gap-1.5 shadow-xs"
          >
            {dispatching ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} Run Month-End Auto Dispatch Now
          </button>
        </div>
      </FadeUp>

      {/* Title Header */}
      <FadeUp delay={0.05}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-[var(--outline-variant)]/40">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.25em] text-[#006064] mb-1">
              <Building2 size={16} /> Client Master Repository
            </div>
            <h1 className="text-3xl sm:text-4xl font-display font-black tracking-tight text-[#1B1C1C]">
              Client Master Data Entry
            </h1>
            <p className="text-sm text-[#616161] mt-1 font-light">
              Add new clients, maintain company records, seating allocations, agreement terms, and dispatch records to Invoices.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {selectedIds.length > 0 && (
              <button
                onClick={() => handleDispatchToInvoices('MANUAL', selectedIds)}
                disabled={dispatching}
                className="px-5 py-3 bg-blue-600 text-white font-bold text-xs uppercase tracking-widest transition-all flex items-center gap-2 shadow-md hover:bg-blue-700"
              >
                {dispatching ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                Send Selected ({selectedIds.length}) to Invoices
              </button>
            )}

            <button
              onClick={() => {
                resetForm();
                setShowAddClientModal(true);
              }}
              className="px-6 py-3 bg-[#006064] text-white font-bold text-xs uppercase tracking-widest transition-all flex items-center gap-2 shadow-md hover:bg-[#004D40]"
            >
              <Plus size={18} /> Add New Client Master Entry
            </button>
          </div>
        </div>
      </FadeUp>

      {/* KPI Summary Cards */}
      <FadeUp delay={0.1}>
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="bg-white p-5 border border-[var(--outline-variant)]/40 shadow-xs">
            <div className="text-[10px] font-black uppercase tracking-[0.2em] text-[#616161]">Total Master Clients</div>
            <div className="text-2xl font-display font-black mt-1 text-[#1B1C1C]">{kpis.totalClients}</div>
            <div className="text-[11px] text-[#616161] font-light">All records in database</div>
          </div>

          <div className="bg-white p-5 border border-emerald-200 bg-emerald-50/20 shadow-xs">
            <div className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-700">Active Agreements</div>
            <div className="text-2xl font-display font-black mt-1 text-emerald-800">{kpis.activeClients}</div>
            <div className="text-[11px] text-emerald-600 font-light">Included in month-end dispatch</div>
          </div>

          <div className="bg-white p-5 border border-amber-200 bg-amber-50/20 shadow-xs">
            <div className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-700">On Notice Clients</div>
            <div className="text-2xl font-display font-black mt-1 text-amber-800">{kpis.onNotice}</div>
            <div className="text-[11px] text-amber-600 font-light">Pending lock-in / exit</div>
          </div>

          <div className="bg-white p-5 border border-blue-200 bg-blue-50/20 shadow-xs">
            <div className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-700">Total Allocated Seats</div>
            <div className="text-2xl font-display font-black mt-1 text-blue-800">{kpis.totalSeats}</div>
            <div className="text-[11px] text-blue-600 font-light">Seats allocated in cabins</div>
          </div>

          <div className="bg-white p-5 border border-purple-200 bg-purple-50/20 shadow-xs col-span-2 lg:col-span-1">
            <div className="text-[10px] font-black uppercase tracking-[0.2em] text-purple-700">Total Contract Value</div>
            <div className="text-2xl font-display font-black mt-1 text-purple-800">
              ₹{kpis.totalRev.toLocaleString('en-IN')}
            </div>
            <div className="text-[11px] text-purple-600 font-light">Monthly sum of all agreements</div>
          </div>
        </div>
      </FadeUp>

      {/* MASTER DATA TABLE */}
      <FadeUp delay={0.15}>
        <div className="bg-white border border-[var(--outline-variant)]/40 p-6 space-y-6 shadow-xs">
          {/* Search & Filter */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-b border-neutral-200 pb-4">
            <div className="relative w-full sm:w-96">
              <Search size={16} className="absolute left-3 top-3.5 text-[#616161]" />
              <input
                type="text"
                placeholder="Search by company, GST, Client ID, Cabin or Contact..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-[#F8F9FA] border border-[var(--outline-variant)] pl-9 pr-4 py-2.5 text-xs focus:outline-none focus:border-[#006064] font-medium"
              />
            </div>

            <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
              {/* Admin-only Node/Location filter */}
              {isAdmin && locations.length > 0 && (
                <>
                  <div className="flex items-center gap-1.5 text-xs font-bold text-[#616161]">
                    <MapPin size={14} /> Node:
                  </div>
                  <select
                    value={selectedLocationFilter}
                    onChange={(e) => setSelectedLocationFilter(e.target.value)}
                    className="bg-[#F8F9FA] border border-[var(--outline-variant)] px-3 py-2 text-xs focus:outline-none focus:border-[#006064] font-medium"
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
                <Filter size={14} /> Client Status:
              </div>
              <select
                value={selectedClientStatusFilter}
                onChange={(e) => setSelectedClientStatusFilter(e.target.value)}
                className="bg-[#F8F9FA] border border-[var(--outline-variant)] px-3 py-2 text-xs focus:outline-none focus:border-[#006064] font-medium"
              >
                <option value="ALL">All Statuses</option>
                {CLIENT_STATUS_OPTIONS.map((st) => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                ))}
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
              <Loader2 size={20} className="animate-spin text-[#006064]" /> Loading client master database...
            </div>
          ) : filteredEntries.length === 0 ? (
            <div className="py-16 text-center space-y-3">
              <div className="text-4xl text-neutral-300">🏢</div>
              <div className="text-sm font-bold text-[#1B1C1C]">No master records found</div>
              <p className="text-xs text-[#616161] max-w-sm mx-auto font-light">
                No entries match your search criteria. Click "Add New Client Master Entry" to add data.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-[#F8F9FA] text-[#616161] uppercase tracking-wider border-b border-[var(--outline-variant)] font-bold">
                    <th className="p-3 w-10 text-center">
                      <button onClick={toggleSelectAll} className="text-neutral-500 hover:text-black">
                        {selectedIds.length === filteredEntries.length && filteredEntries.length > 0 ? (
                          <CheckSquare size={16} className="text-[#006064]" />
                        ) : (
                          <Square size={16} />
                        )}
                      </button>
                    </th>
                    <th className="p-3 w-12 text-center">SR.No</th>
                    <th className="p-3">Company & Address</th>
                    {isAdmin && <th className="p-3">Node / Created By</th>}
                    <th className="p-3">Client ID</th>
                    <th className="p-3">GST Details</th>
                    <th className="p-3">Contact Persons</th>
                    <th className="p-3">Agreement Dates</th>
                    <th className="p-3">Cabin & Seats</th>
                    <th className="p-3 text-right">Amount (₹)</th>
                    <th className="p-3 text-right">Total Amt (₹)</th>
                    <th className="p-3">Status</th>
                    <th className="p-3 text-center w-36">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100 font-medium">
                  {filteredEntries.map((entry) => {
                    const isSelected = selectedIds.includes(entry.id);
                    return (
                      <tr
                        key={entry.id}
                        className={`transition-colors ${isSelected ? 'bg-blue-50/40' : 'hover:bg-neutral-50/60'}`}
                      >
                        <td className="p-3 text-center">
                          <button onClick={() => toggleSelectId(entry.id)} className="text-neutral-500 hover:text-black">
                            {isSelected ? <CheckSquare size={16} className="text-[#006064]" /> : <Square size={16} />}
                          </button>
                        </td>

                        <td className="p-3 text-center font-mono font-bold text-neutral-600 bg-neutral-50/50">
                          #{entry.srNo}
                        </td>

                        <td className="p-3">
                          <div className="font-bold text-[#1B1C1C] text-sm">{entry.companyName}</div>
                          {entry.hoAddress && (
                            <div className="text-[10px] text-[#616161] line-clamp-1" title={entry.hoAddress}>
                              HO: {entry.hoAddress}
                            </div>
                          )}
                        </td>

                        {isAdmin && (
                          <td className="p-3">
                            <div className="space-y-0.5">
                              {entry.createdBy?.assignedLocations && entry.createdBy.assignedLocations.length > 0 ? (
                                entry.createdBy.assignedLocations.map((al: any, i: number) => (
                                  <div key={i} className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-teal-50 text-teal-700 text-[9px] font-bold uppercase tracking-wider mr-1">
                                    <MapPin size={9} /> {al.location.name}
                                  </div>
                                ))
                              ) : (
                                <span className="text-[9px] text-neutral-400">No Node</span>
                              )}
                              <div className="text-[10px] text-[#616161] mt-0.5">
                                by {entry.createdBy?.name || 'Unknown'}
                              </div>
                            </div>
                          </td>
                        )}

                        <td className="p-3 font-mono font-bold text-neutral-700">
                          {entry.clientId || 'N/A'}
                        </td>

                        <td className="p-3 space-y-0.5">
                          <span
                            className={`inline-block px-1.5 py-0.2 text-[9px] font-bold uppercase ${
                              entry.gstStatus === 'REGISTERED' ? 'bg-emerald-50 text-emerald-700' : 'bg-neutral-100 text-neutral-600'
                            }`}
                          >
                            {entry.gstStatus}
                          </span>
                          {entry.gstNo && <div className="font-mono text-[10px]">{entry.gstNo}</div>}
                        </td>

                        <td className="p-3 space-y-1">
                          {entry.contactPersons?.slice(0, 2).map((cp, idx) => (
                            <div key={idx} className="text-[10px]">
                              <span className="font-bold text-[#1B1C1C]">{cp.name}</span>
                              {cp.designation && <span className="text-neutral-500"> ({cp.designation})</span>}
                            </div>
                          ))}
                          {entry.contactPersons && entry.contactPersons.length > 2 && (
                            <div className="text-[9px] text-[#006064] font-bold">
                              +{entry.contactPersons.length - 2} more
                            </div>
                          )}
                        </td>

                        <td className="p-3 text-[10px] space-y-0.5">
                          {entry.agreementStartDate && (
                            <div>
                              Start: <span className="font-bold">{new Date(entry.agreementStartDate).toLocaleDateString('en-IN')}</span>
                            </div>
                          )}
                          {entry.agreementEndDate && (
                            <div>
                              End: <span className="font-bold">{new Date(entry.agreementEndDate).toLocaleDateString('en-IN')}</span>
                            </div>
                          )}
                        </td>

                        <td className="p-3">
                          <div className="font-bold">{entry.cabinName || 'N/A'}</div>
                          <div className="text-[10px] text-[#616161]">
                            {entry.noOfSeats || 0} seats @ ₹{Number(entry.ratePerAgreement || 0).toLocaleString('en-IN')}
                          </div>
                        </td>

                        <td className="p-3 text-right font-bold text-[#1B1C1C]">
                          ₹{Number(entry.amount || 0).toLocaleString('en-IN')}
                        </td>

                        <td className="p-3 text-right font-black text-sm text-[#006064]">
                          ₹{Number(entry.totalAmount || 0).toLocaleString('en-IN')}
                        </td>

                        <td className="p-3">
                          <span className="inline-block px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-800 border border-slate-200">
                            {entry.clientStatus || 'Active'}
                          </span>
                        </td>

                        <td className="p-3 text-center">
                          <div className="flex flex-col gap-1 items-center justify-center">
                            <button
                              onClick={() => setEntryToViewDetails(entry)}
                              className="p-1 text-xs text-neutral-600 hover:text-[#006064] font-bold uppercase tracking-wider flex items-center gap-1 hover:bg-neutral-100 w-full justify-center"
                              title="View full client master record"
                            >
                              <Eye size={12} /> View Record
                            </button>

                            <button
                              onClick={() => handleDispatchToInvoices('MANUAL', [entry.id])}
                              disabled={dispatching}
                              className="px-2 py-1 bg-blue-600 text-white font-bold text-[9px] uppercase tracking-wider hover:bg-blue-700 w-full flex items-center justify-center gap-1"
                            >
                              <Send size={10} /> Send to Invoice
                            </button>

                            <div className="flex items-center gap-1 mt-0.5">
                              <button
                                onClick={() => handleEditEntry(entry)}
                                className="p-1 text-neutral-500 hover:text-[#006064] hover:bg-neutral-100"
                                title="Edit entry"
                              >
                                <Edit2 size={12} />
                              </button>
                              <button
                                onClick={() => handleDeleteEntry(entry.id)}
                                className="p-1 text-neutral-500 hover:text-red-600 hover:bg-neutral-100"
                                title="Delete entry"
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </FadeUp>

      {/* BIG POPUP MODAL: ADD CLIENT / EDIT CLIENT */}
      <AnimatePresence>
        {showAddClientModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/70 backdrop-blur-xs overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 15 }}
              className="bg-white border border-[var(--outline-variant)] w-full max-w-5xl my-6 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
            >
              {/* Modal Header */}
              <div className="p-6 bg-[#006064] text-white flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 bg-white/10 flex items-center justify-center font-bold text-lg">
                    #{srNoDisplay}
                  </div>
                  <div>
                    <h2 className="text-xl font-bold tracking-tight">
                      {editingId ? `Edit Client Master Entry (#${srNoDisplay})` : 'Add New Client Master Entry'}
                    </h2>
                    <p className="text-xs text-white/80 font-light">
                      Enter company details, GST/TDS options, seating allocations, and agreement parameters below.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setShowAddClientModal(false)}
                  className="text-white/80 hover:text-white p-2 hover:bg-white/10 transition-colors"
                >
                  <X size={22} />
                </button>
              </div>

              {/* Modal Form Scrollable Area */}
              <form onSubmit={handleSubmit} className="p-6 sm:p-8 space-y-8 overflow-y-auto flex-1 text-xs">
                {/* SECTION 1: Basic Info */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-[#1B1C1C] border-b border-neutral-200 pb-2">
                    <Building2 size={16} className="text-[#006064]" /> 1. Primary Company Details
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div>
                      <label className="block font-bold uppercase tracking-wider text-[#616161] mb-1.5">
                        SR. No (Automatic)
                      </label>
                      <input
                        type="text"
                        value={`#${srNoDisplay}`}
                        disabled
                        className="w-full bg-neutral-100 border border-neutral-300 px-4 py-3 text-sm font-mono font-bold text-neutral-600"
                      />
                    </div>

                    <div>
                      <label className="block font-bold uppercase tracking-wider text-[#616161] mb-1.5">
                        Company Name *
                      </label>
                      <input
                        type="text"
                        placeholder="Enter company name..."
                        value={companyName}
                        onChange={(e) => setCompanyName(e.target.value)}
                        className="w-full bg-[#F8F9FA] border border-[var(--outline-variant)] px-4 py-3 text-sm focus:outline-none focus:border-[#006064] font-medium"
                        required
                      />
                    </div>

                    <div>
                      <label className="block font-bold uppercase tracking-wider text-[#616161] mb-1.5">
                        Head Office (HO) Address
                      </label>
                      <input
                        type="text"
                        placeholder="Head Office address..."
                        value={hoAddress}
                        onChange={(e) => setHoAddress(e.target.value)}
                        className="w-full bg-[#F8F9FA] border border-[var(--outline-variant)] px-4 py-3 text-sm focus:outline-none focus:border-[#006064]"
                      />
                    </div>
                  </div>
                </div>

                {/* SECTION 2: GST Details */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-[#1B1C1C] border-b border-neutral-200 pb-2">
                    <FileText size={16} className="text-[#006064]" /> 2. GST Registration Status & Attachment
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-[#F8F9FA] p-4 border border-[var(--outline-variant)]/60">
                    <div>
                      <label className="block font-bold uppercase tracking-wider text-[#616161] mb-1.5">
                        GST Registration Status *
                      </label>
                      <select
                        value={gstStatus}
                        onChange={(e) => setGstStatus(e.target.value as 'REGISTERED' | 'UNREGISTERED')}
                        className="w-full bg-white border border-[var(--outline-variant)] px-4 py-3 text-sm focus:outline-none focus:border-[#006064] font-bold"
                      >
                        <option value="UNREGISTERED">Unregister (No GST required)</option>
                        <option value="REGISTERED">Register (Enter GST & PDF)</option>
                      </select>
                    </div>

                    {gstStatus === 'REGISTERED' && (
                      <>
                        <div>
                          <label className="block font-bold uppercase tracking-wider text-[#616161] mb-1.5">
                            GST Number *
                          </label>
                          <input
                            type="text"
                            placeholder="e.g. 24AAACC1234H1ZD"
                            value={gstNo}
                            onChange={(e) => setGstNo(e.target.value.toUpperCase())}
                            className="w-full bg-white border border-[var(--outline-variant)] px-4 py-3 text-sm focus:outline-none focus:border-[#006064] font-mono uppercase font-bold"
                            required={gstStatus === 'REGISTERED'}
                          />
                        </div>

                        <div>
                          <label className="block font-bold uppercase tracking-wider text-[#616161] mb-1.5">
                            Attach GST PDF
                          </label>
                          <div className="flex items-center gap-2">
                            <input
                              type="file"
                              accept="application/pdf,.pdf"
                              onChange={(e) => {
                                if (e.target.files && e.target.files[0]) {
                                  handleFileUpload(e.target.files[0], 'GST');
                                }
                              }}
                              className="w-full bg-white border border-[var(--outline-variant)] px-3 py-2 text-xs"
                            />
                            {uploadingGstPdf && <Loader2 size={16} className="animate-spin text-[#006064]" />}
                          </div>
                          {gstPdfName && (
                            <div className="text-[11px] text-emerald-700 font-bold mt-1 flex items-center gap-1">
                              <CheckCircle2 size={12} /> Attached: {gstPdfName}
                            </div>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* SECTION 3: Contact Persons (Add More) */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between border-b border-neutral-200 pb-2">
                    <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-[#1B1C1C]">
                      <Users size={16} className="text-[#006064]" /> 3. Contact Person(s) Details
                    </div>
                    <button
                      type="button"
                      onClick={handleAddContactPerson}
                      className="text-xs text-[#006064] font-bold uppercase tracking-wider hover:underline flex items-center gap-1"
                    >
                      <UserPlus size={14} /> Add More Contact Person
                    </button>
                  </div>

                  <div className="space-y-3">
                    {contactPersons.map((cp, idx) => (
                      <div
                        key={idx}
                        className="grid grid-cols-1 md:grid-cols-12 gap-3 bg-[#F8F9FA] p-3 border border-[var(--outline-variant)]/60 items-center"
                      >
                        <div className="md:col-span-3">
                          <label className="block text-[10px] font-bold uppercase text-[#616161] mb-1">
                            Contact Name #{idx + 1}
                          </label>
                          <input
                            type="text"
                            placeholder="Full name..."
                            value={cp.name}
                            onChange={(e) => handleUpdateContactPerson(idx, 'name', e.target.value)}
                            className="w-full bg-white border border-[var(--outline-variant)] px-3 py-2 text-xs focus:outline-none focus:border-[#006064]"
                          />
                        </div>

                        <div className="md:col-span-3">
                          <label className="block text-[10px] font-bold uppercase text-[#616161] mb-1">
                            Designation
                          </label>
                          <input
                            type="text"
                            placeholder="e.g. Director, Manager..."
                            value={cp.designation}
                            onChange={(e) => handleUpdateContactPerson(idx, 'designation', e.target.value)}
                            className="w-full bg-white border border-[var(--outline-variant)] px-3 py-2 text-xs focus:outline-none focus:border-[#006064]"
                          />
                        </div>

                        <div className="md:col-span-3">
                          <label className="block text-[10px] font-bold uppercase text-[#616161] mb-1">
                            Mobile No.
                          </label>
                          <input
                            type="text"
                            placeholder="+91 98765 43210"
                            value={cp.mobileNo}
                            onChange={(e) => handleUpdateContactPerson(idx, 'mobileNo', e.target.value)}
                            className="w-full bg-white border border-[var(--outline-variant)] px-3 py-2 text-xs focus:outline-none focus:border-[#006064]"
                          />
                        </div>

                        <div className="md:col-span-2">
                          <label className="block text-[10px] font-bold uppercase text-[#616161] mb-1">
                            Email
                          </label>
                          <input
                            type="email"
                            placeholder="email@domain.com"
                            value={cp.email}
                            onChange={(e) => handleUpdateContactPerson(idx, 'email', e.target.value)}
                            className="w-full bg-white border border-[var(--outline-variant)] px-3 py-2 text-xs focus:outline-none focus:border-[#006064]"
                          />
                        </div>

                        <div className="md:col-span-1 text-center">
                          <button
                            type="button"
                            onClick={() => handleRemoveContactPerson(idx)}
                            className="text-neutral-400 hover:text-red-600 p-1.5 transition-colors mt-4 md:mt-0"
                            title="Remove contact"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* SECTION 4: Agreement Dates & Notice Period */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-[#1B1C1C] border-b border-neutral-200 pb-2">
                    <Calendar size={16} className="text-[#006064]" /> 4. Agreement Dates, Lock-in & Notice Terms
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                    <div>
                      <label className="block font-bold uppercase text-[#616161] mb-1">
                        Agreement Start Date
                      </label>
                      <input
                        type="date"
                        value={agreementStartDate}
                        onChange={(e) => setAgreementStartDate(e.target.value)}
                        className="w-full bg-[#F8F9FA] border border-[var(--outline-variant)] px-3 py-2.5 text-xs focus:outline-none focus:border-[#006064]"
                      />
                    </div>

                    <div>
                      <label className="block font-bold uppercase text-[#616161] mb-1">
                        Agreement End Date
                      </label>
                      <input
                        type="date"
                        value={agreementEndDate}
                        onChange={(e) => setAgreementEndDate(e.target.value)}
                        className="w-full bg-[#F8F9FA] border border-[var(--outline-variant)] px-3 py-2.5 text-xs focus:outline-none focus:border-[#006064]"
                      />
                    </div>

                    <div>
                      <label className="block font-bold uppercase text-[#616161] mb-1">
                        Lock-in End Date
                      </label>
                      <input
                        type="date"
                        value={lockinEndDate}
                        onChange={(e) => setLockinEndDate(e.target.value)}
                        className="w-full bg-[#F8F9FA] border border-[var(--outline-variant)] px-3 py-2.5 text-xs focus:outline-none focus:border-[#006064]"
                      />
                    </div>

                    <div>
                      <label className="block font-bold uppercase text-[#616161] mb-1">
                        Notice Period (Months)
                      </label>
                      <input
                        type="number"
                        min="0"
                        placeholder="e.g. 2"
                        value={noticePeriodMonths}
                        onChange={(e) => setNoticePeriodMonths(e.target.value === '' ? '' : Number(e.target.value))}
                        className="w-full bg-[#F8F9FA] border border-[var(--outline-variant)] px-3 py-2.5 text-xs focus:outline-none focus:border-[#006064] font-bold"
                      />
                    </div>

                    <div>
                      <label className="block font-bold uppercase text-[#616161] mb-1">
                        Notice Applicable
                      </label>
                      <select
                        value={noticePeriodApplicable}
                        onChange={(e) => setNoticePeriodApplicable(e.target.value)}
                        className="w-full bg-[#F8F9FA] border border-[var(--outline-variant)] px-3 py-2.5 text-xs focus:outline-none focus:border-[#006064] font-medium"
                      >
                        {NOTICE_APPLICABLE_OPTIONS.map((opt) => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {/* SECTION 5: Escalation & Seating */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-[#1B1C1C] border-b border-neutral-200 pb-2">
                    <DollarSign size={16} className="text-[#006064]" /> 5. Cabin, Seats, Rates & Billing Amounts
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div>
                      <label className="block font-bold uppercase text-[#616161] mb-1">
                        Escalation %
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="e.g. 5.0"
                        value={escalationPercent}
                        onChange={(e) => setEscalationPercent(e.target.value === '' ? '' : Number(e.target.value))}
                        className="w-full bg-[#F8F9FA] border border-[var(--outline-variant)] px-3 py-2.5 text-xs focus:outline-none focus:border-[#006064] font-bold"
                      />
                    </div>

                    <div>
                      <label className="block font-bold uppercase text-[#616161] mb-1">
                        Escalation Applicable (Amt)
                      </label>
                      <input
                        type="number"
                        min="0"
                        placeholder="Applicable amount..."
                        value={escalationApplicable}
                        onChange={(e) => setEscalationApplicable(e.target.value === '' ? '' : Number(e.target.value))}
                        className="w-full bg-[#F8F9FA] border border-[var(--outline-variant)] px-3 py-2.5 text-xs focus:outline-none focus:border-[#006064] font-bold"
                      />
                    </div>

                    <div>
                      <label className="block font-bold uppercase text-[#616161] mb-1">
                        Cabin Name
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Cabin A-102"
                        value={cabinName}
                        onChange={(e) => setCabinName(e.target.value)}
                        className="w-full bg-[#F8F9FA] border border-[var(--outline-variant)] px-3 py-2.5 text-xs focus:outline-none focus:border-[#006064] font-medium"
                      />
                    </div>

                    <div>
                      <label className="block font-bold uppercase text-[#616161] mb-1">
                        No of Seats
                      </label>
                      <input
                        type="number"
                        min="1"
                        placeholder="e.g. 10"
                        value={noOfSeats}
                        onChange={(e) => setNoOfSeats(e.target.value === '' ? '' : Number(e.target.value))}
                        className="w-full bg-[#F8F9FA] border border-[var(--outline-variant)] px-3 py-2.5 text-xs focus:outline-none focus:border-[#006064] font-bold"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div>
                      <label className="block font-bold uppercase text-[#616161] mb-1">
                        Rate as per Agreement (₹)
                      </label>
                      <input
                        type="number"
                        min="0"
                        placeholder="Rate per seat..."
                        value={ratePerAgreement}
                        onChange={(e) => setRatePerAgreement(e.target.value === '' ? '' : Number(e.target.value))}
                        className="w-full bg-[#F8F9FA] border border-[var(--outline-variant)] px-3 py-2.5 text-xs focus:outline-none focus:border-[#006064] font-bold text-right"
                      />
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block font-bold uppercase text-[#616161]">
                          Amount (Seats * Rate)
                        </label>
                        {isAmountManuallyEdited && (
                          <button
                            type="button"
                            onClick={() => setIsAmountManuallyEdited(false)}
                            className="text-[9px] text-[#006064] font-bold hover:underline"
                          >
                            Reset Auto
                          </button>
                        )}
                      </div>
                      <input
                        type="number"
                        min="0"
                        value={amount}
                        onChange={(e) => {
                          setIsAmountManuallyEdited(true);
                          setAmount(e.target.value === '' ? '' : Number(e.target.value));
                        }}
                        className="w-full bg-blue-50 border border-blue-200 px-3 py-2.5 text-xs focus:outline-none font-bold text-right text-blue-900"
                      />
                    </div>

                    <div>
                      <label className="block font-bold uppercase text-[#616161] mb-1">
                        GST %
                      </label>
                      <input
                        type="number"
                        min="0"
                        placeholder="18"
                        value={gstPercent}
                        onChange={(e) => setGstPercent(e.target.value === '' ? '' : Number(e.target.value))}
                        className="w-full bg-[#F8F9FA] border border-[var(--outline-variant)] px-3 py-2.5 text-xs focus:outline-none focus:border-[#006064] font-bold"
                      />
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block font-bold uppercase text-[#1B1C1C]">
                          Total Amount (Amt + GST)
                        </label>
                        {isTotalAmountManuallyEdited && (
                          <button
                            type="button"
                            onClick={() => setIsTotalAmountManuallyEdited(false)}
                            className="text-[9px] text-[#006064] font-bold hover:underline"
                          >
                            Reset Auto
                          </button>
                        )}
                      </div>
                      <input
                        type="number"
                        min="0"
                        value={totalAmount}
                        onChange={(e) => {
                          setIsTotalAmountManuallyEdited(true);
                          setTotalAmount(e.target.value === '' ? '' : Number(e.target.value));
                        }}
                        className="w-full bg-emerald-50 border border-emerald-300 px-3 py-2.5 text-sm focus:outline-none font-black text-right text-emerald-800"
                      />
                    </div>
                  </div>
                </div>

                {/* SECTION 6: TDS Deduction Options */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-[#1B1C1C] border-b border-neutral-200 pb-2">
                    <Percent size={16} className="text-[#006064]" /> 6. TDS Deduction & TAN Attachment
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-[#F8F9FA] p-4 border border-[var(--outline-variant)]/60">
                    <div>
                      <label className="block font-bold uppercase text-[#616161] mb-1.5">
                        Will Client Deduct TDS? *
                      </label>
                      <select
                        value={willDeductTds ? 'YES' : 'NO'}
                        onChange={(e) => setWillDeductTds(e.target.value === 'YES')}
                        className="w-full bg-white border border-[var(--outline-variant)] px-4 py-3 text-sm focus:outline-none focus:border-[#006064] font-bold"
                      >
                        <option value="NO">No (Leave TDS details)</option>
                        <option value="YES">Yes (Enter TAN No & PDF)</option>
                      </select>
                    </div>

                    {willDeductTds && (
                      <>
                        <div>
                          <label className="block font-bold uppercase text-[#616161] mb-1.5">
                            TAN Number *
                          </label>
                          <input
                            type="text"
                            placeholder="e.g. MUMB12345F"
                            value={tanNo}
                            onChange={(e) => setTanNo(e.target.value.toUpperCase())}
                            className="w-full bg-white border border-[var(--outline-variant)] px-4 py-3 text-sm focus:outline-none focus:border-[#006064] font-mono uppercase font-bold"
                            required={willDeductTds}
                          />
                        </div>

                        <div>
                          <label className="block font-bold uppercase text-[#616161] mb-1.5">
                            Attach TDS PDF
                          </label>
                          <div className="flex items-center gap-2">
                            <input
                              type="file"
                              accept="application/pdf,.pdf"
                              onChange={(e) => {
                                if (e.target.files && e.target.files[0]) {
                                  handleFileUpload(e.target.files[0], 'TDS');
                                }
                              }}
                              className="w-full bg-white border border-[var(--outline-variant)] px-3 py-2 text-xs"
                            />
                            {uploadingTdsPdf && <Loader2 size={16} className="animate-spin text-[#006064]" />}
                          </div>
                          {tdsPdfName && (
                            <div className="text-[11px] text-emerald-700 font-bold mt-1 flex items-center gap-1">
                              <CheckCircle2 size={12} /> Attached: {tdsPdfName}
                            </div>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* SECTION 7: Client ID, SOR & Status */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-[#1B1C1C] border-b border-neutral-200 pb-2">
                    <Shield size={16} className="text-[#006064]" /> 7. Client ID, Security Deposit (SOR) & Status
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div>
                      <label className="block font-bold uppercase text-[#616161] mb-1">
                        Client ID (Manual)
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. CLT-2026-004"
                        value={clientId}
                        onChange={(e) => setClientId(e.target.value)}
                        className="w-full bg-[#F8F9FA] border border-[var(--outline-variant)] px-3 py-2.5 text-xs focus:outline-none focus:border-[#006064] font-mono font-bold"
                      />
                    </div>

                    <div>
                      <label className="block font-bold uppercase text-[#616161] mb-1">
                        SOR Amount (Security Deposit)
                      </label>
                      <input
                        type="number"
                        min="0"
                        placeholder="Security Deposit..."
                        value={sorAmount}
                        onChange={(e) => setSorAmount(e.target.value === '' ? '' : Number(e.target.value))}
                        className="w-full bg-[#F8F9FA] border border-[var(--outline-variant)] px-3 py-2.5 text-xs focus:outline-none focus:border-[#006064] font-bold text-right"
                      />
                    </div>

                    <div>
                      <label className="block font-bold uppercase text-[#616161] mb-1">
                        SOR Received Date
                      </label>
                      <input
                        type="date"
                        value={sorRecdDate}
                        onChange={(e) => setSorRecdDate(e.target.value)}
                        className="w-full bg-[#F8F9FA] border border-[var(--outline-variant)] px-3 py-2.5 text-xs focus:outline-none focus:border-[#006064]"
                      />
                    </div>

                    <div>
                      <label className="block font-bold uppercase text-[#616161] mb-1">
                        Client Status
                      </label>
                      <select
                        value={clientStatus}
                        onChange={(e) => setClientStatus(e.target.value)}
                        className="w-full bg-[#F8F9FA] border border-[var(--outline-variant)] px-3 py-2.5 text-xs focus:outline-none focus:border-[#006064] font-bold"
                      >
                        {CLIENT_STATUS_OPTIONS.map((st) => (
                          <option key={st} value={st}>
                            {st}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {/* Submit Buttons Footer */}
                <div className="pt-6 border-t border-neutral-200 flex items-center justify-end gap-4 shrink-0">
                  <button
                    type="button"
                    onClick={() => setShowAddClientModal(false)}
                    className="px-6 py-3 bg-[#F8F9FA] border border-[var(--outline-variant)] text-xs font-bold uppercase tracking-widest text-[#616161] hover:bg-neutral-100"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-8 py-3 bg-[#006064] text-white text-xs font-bold uppercase tracking-widest hover:opacity-90 transition-all flex items-center gap-2 shadow-md disabled:opacity-50"
                  >
                    {submitting ? (
                      <>
                        <Loader2 size={16} className="animate-spin" /> Saving Client...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 size={16} /> {editingId ? 'Update Client Entry' : 'Confirm & Save to Master'}
                      </>
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* FULL RECORD VIEWER */}
      <AnimatePresence>
        {entryToViewDetails && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white border border-[var(--outline-variant)] p-6 sm:p-8 w-full max-w-4xl space-y-6 shadow-2xl my-8 max-h-[90vh] overflow-y-auto text-xs"
            >
              <div className="flex items-center justify-between border-b border-neutral-200 pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold bg-neutral-100 text-neutral-700 px-2 py-0.5">
                      SR.No #{entryToViewDetails.srNo}
                    </span>
                    <span className="font-bold uppercase tracking-wider bg-slate-100 px-2 py-0.5">
                      Status: {entryToViewDetails.clientStatus || 'Active'}
                    </span>
                  </div>
                  <h3 className="text-xl font-bold text-[#1B1C1C] mt-1">
                    {entryToViewDetails.companyName}
                  </h3>
                  <p className="text-[#616161]">
                    Created by {entryToViewDetails.createdBy?.name || 'Community Manager'} on{' '}
                    {new Date(entryToViewDetails.createdAt).toLocaleDateString('en-IN')}
                  </p>
                </div>
                <button
                  onClick={() => setEntryToViewDetails(null)}
                  className="text-neutral-400 hover:text-neutral-700 p-1"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Company & Address */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-[#F8F9FA] p-4 border border-[var(--outline-variant)]/40">
                <div>
                  <div className="font-bold uppercase text-[#616161] text-[10px]">Head Office (HO) Address</div>
                  <div className="font-medium text-[#1B1C1C] mt-0.5">{entryToViewDetails.hoAddress || 'N/A'}</div>
                </div>
                <div>
                  <div className="font-bold uppercase text-[#616161] text-[10px]">Client ID</div>
                  <div className="font-mono font-bold text-[#1B1C1C] mt-0.5">{entryToViewDetails.clientId || 'N/A'}</div>
                </div>
                <div>
                  <div className="font-bold uppercase text-[#616161] text-[10px]">GST Status & Number</div>
                  <div className="font-bold text-[#1B1C1C] mt-0.5">
                    {entryToViewDetails.gstStatus === 'REGISTERED' ? (
                      <span className="text-emerald-700">{entryToViewDetails.gstNo || 'Registered'}</span>
                    ) : (
                      <span className="text-neutral-500">Unregistered</span>
                    )}
                  </div>
                  {entryToViewDetails.gstPdfUrl && (
                    <a
                      href={entryToViewDetails.gstPdfUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[10px] text-[#006064] font-bold hover:underline flex items-center gap-1 mt-1"
                    >
                      <Download size={10} /> Download GST PDF
                    </a>
                  )}
                </div>
              </div>

              {/* Contact Persons */}
              <div className="space-y-2">
                <h4 className="font-bold uppercase tracking-wider text-[#1B1C1C] flex items-center gap-2">
                  <Users size={14} className="text-[#006064]" /> Contact Person(s)
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {entryToViewDetails.contactPersons?.map((cp, idx) => (
                    <div key={idx} className="bg-[#F8F9FA] p-3 border border-[var(--outline-variant)]/60 space-y-1">
                      <div className="font-bold text-[#1B1C1C] text-sm">{cp.name}</div>
                      {cp.designation && <div className="text-neutral-600">Designation: {cp.designation}</div>}
                      {cp.mobileNo && <div className="text-neutral-600 font-mono">Mobile: {cp.mobileNo}</div>}
                      {cp.email && <div className="text-neutral-600 font-mono">Email: {cp.email}</div>}
                    </div>
                  ))}
                </div>
              </div>

              {/* Agreement Dates & Terms */}
              <div className="space-y-2">
                <h4 className="font-bold uppercase tracking-wider text-[#1B1C1C] flex items-center gap-2">
                  <Calendar size={14} className="text-[#006064]" /> Agreement Terms & Dates
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 bg-[#F8F9FA] p-3 border border-[var(--outline-variant)]/60">
                  <div>
                    <div className="text-[10px] font-bold uppercase text-[#616161]">Start Date</div>
                    <div className="font-bold mt-0.5">
                      {entryToViewDetails.agreementStartDate
                        ? new Date(entryToViewDetails.agreementStartDate).toLocaleDateString('en-IN')
                        : 'N/A'}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] font-bold uppercase text-[#616161]">End Date</div>
                    <div className="font-bold mt-0.5">
                      {entryToViewDetails.agreementEndDate
                        ? new Date(entryToViewDetails.agreementEndDate).toLocaleDateString('en-IN')
                        : 'N/A'}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] font-bold uppercase text-[#616161]">Lock-in End Date</div>
                    <div className="font-bold text-amber-800 mt-0.5">
                      {entryToViewDetails.lockinEndDate
                        ? new Date(entryToViewDetails.lockinEndDate).toLocaleDateString('en-IN')
                        : 'N/A'}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] font-bold uppercase text-[#616161]">Notice Period</div>
                    <div className="font-bold mt-0.5">
                      {entryToViewDetails.noticePeriodMonths ? `${entryToViewDetails.noticePeriodMonths} months` : 'N/A'}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] font-bold uppercase text-[#616161]">Notice Applicable</div>
                    <div className="font-bold mt-0.5">{entryToViewDetails.noticePeriodApplicable || 'N/A'}</div>
                  </div>
                </div>
              </div>

              {/* Cabin, Seats & Financials */}
              <div className="space-y-2">
                <h4 className="font-bold uppercase tracking-wider text-[#1B1C1C] flex items-center gap-2">
                  <DollarSign size={14} className="text-[#006064]" /> Cabin & Billing Amounts
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                  <div className="bg-[#F8F9FA] p-3 border border-[var(--outline-variant)]/60">
                    <div className="text-[10px] font-bold uppercase text-[#616161]">Cabin Name</div>
                    <div className="font-bold mt-0.5">{entryToViewDetails.cabinName || 'N/A'}</div>
                  </div>
                  <div className="bg-[#F8F9FA] p-3 border border-[var(--outline-variant)]/60">
                    <div className="text-[10px] font-bold uppercase text-[#616161]">Seats & Rate</div>
                    <div className="font-bold mt-0.5">
                      {entryToViewDetails.noOfSeats || 0} seats @ ₹
                      {Number(entryToViewDetails.ratePerAgreement || 0).toLocaleString('en-IN')}
                    </div>
                  </div>
                  <div className="bg-[#F8F9FA] p-3 border border-[var(--outline-variant)]/60">
                    <div className="text-[10px] font-bold uppercase text-[#616161]">Base Amount</div>
                    <div className="font-bold mt-0.5">
                      ₹{Number(entryToViewDetails.amount || 0).toLocaleString('en-IN')}
                    </div>
                  </div>
                  <div className="bg-[#F8F9FA] p-3 border border-[var(--outline-variant)]/60">
                    <div className="text-[10px] font-bold uppercase text-[#616161]">GST %</div>
                    <div className="font-bold mt-0.5">{entryToViewDetails.gstPercent ?? 18}%</div>
                  </div>
                  <div className="bg-emerald-50 border border-emerald-300 p-3 text-emerald-900">
                    <div className="text-[10px] font-black uppercase">Total Amount</div>
                    <div className="font-black text-base text-emerald-800 mt-0.5">
                      ₹{Number(entryToViewDetails.totalAmount || 0).toLocaleString('en-IN')}
                    </div>
                  </div>
                </div>
              </div>

              {/* TDS & SOR Details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-[#F8F9FA] p-4 border border-[var(--outline-variant)]/40">
                <div>
                  <div className="font-bold uppercase text-[#616161] text-[10px]">TDS Deduction & TAN</div>
                  <div className="font-bold text-[#1B1C1C] mt-0.5">
                    {entryToViewDetails.willDeductTds ? (
                      <span className="text-blue-800">TDS Yes - TAN: {entryToViewDetails.tanNo || 'N/A'}</span>
                    ) : (
                      <span className="text-neutral-500">TDS Deduction No</span>
                    )}
                  </div>
                  {entryToViewDetails.tdsPdfUrl && (
                    <a
                      href={entryToViewDetails.tdsPdfUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[10px] text-[#006064] font-bold hover:underline flex items-center gap-1 mt-1"
                    >
                      <Download size={10} /> Download TDS PDF
                    </a>
                  )}
                </div>

                <div>
                  <div className="font-bold uppercase text-[#616161] text-[10px]">Security Deposit (SOR)</div>
                  <div className="font-bold text-[#1B1C1C] mt-0.5">
                    Amount: ₹{Number(entryToViewDetails.sorAmount || 0).toLocaleString('en-IN')}
                  </div>
                  {entryToViewDetails.sorRecdDate && (
                    <div className="text-neutral-600 text-[10px]">
                      Recd Date: {new Date(entryToViewDetails.sorRecdDate).toLocaleDateString('en-IN')}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-neutral-200">
                <button
                  type="button"
                  onClick={() => handleDispatchToInvoices('MANUAL', [entryToViewDetails.id])}
                  disabled={dispatching}
                  className="px-5 py-2.5 bg-blue-600 text-white font-bold uppercase tracking-wider hover:bg-blue-700 flex items-center gap-1.5"
                >
                  <Send size={14} /> Send Record to Invoices Section
                </button>

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
    </div>
  );
}
