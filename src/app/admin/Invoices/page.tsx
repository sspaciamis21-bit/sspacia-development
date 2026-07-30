'use client';

import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  FileText,
  Plus,
  Trash2,
  Edit2,
  Search,
  Building2,
  Calendar,
  Clock,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Sparkles,
  DollarSign,
  Users,
  Briefcase,
  X,
  Filter,
  RefreshCw,
  Receipt,
  Send,
  Upload,
  Eye,
  MessageSquare,
  UserCheck,
  Calculator,
  FileCheck,
  AlertTriangle,
  RotateCcw,
  Check,
  Paperclip
} from 'lucide-react';
import { toast } from 'sonner';
import { FadeUp } from '@/components/ui/fade-up';
import { useAuth } from '@/context/AuthContext';

interface Location {
  id: number;
  name: string;
  slug: string;
}

interface ProductItem {
  id?: number;
  product: string;
  seats: number;
  ratePerSeat: number;
  fromDate: string;
  toDate: string;
  amount: number;
}

interface AttachedInvoice {
  id: number;
  entryId: number;
  fileUrl: string;
  fileName: string;
  fileSize: number | null;
  createdAt: string;
}

interface BillingEntry {
  id: number;
  centreId: number;
  company: string;
  client: string;
  durationMode: 'HOURS' | 'DAYS';
  meetingRoomUsedMinutes: number | null;
  meetingRoomUsedDays: number | null;
  complementaryMinutes: number | null;
  complementaryDays: number | null;
  toBeChargedMinutes: number | null;
  toBeChargedDays: number | null;
  boardRoomAmount: number | null;
  eventSpaceAmount: number | null;
  otherServicesAmount: number | null;
  finalAmount: number | null;
  lastDateOfPayment: string | null;
  gstNo: string | null;
  address: string | null;
  status: 'DRAFT' | 'SENT_TO_ACCOUNTANT' | 'INVOICE_ATTACHED' | 'APPROVED' | 'REJECTED_WITH_REMARKS';
  remarks: string | null;
  createdAt: string;
  centre: { id: number; name: string; slug: string };
  createdBy: { id: number; name: string; email: string };
  attachedInvoice?: AttachedInvoice | null;
  items: {
    id: number;
    product: string;
    seats: number;
    ratePerSeat: number;
    fromDate: string | null;
    toDate: string | null;
    amount: number;
  }[];
}

const DEFAULT_CENTRES = [
  { id: 1, name: 'Mercado' },
  { id: 2, name: 'Agarwal Complex' },
  { id: 3, name: 'Premiere House' }
];

const COMPANIES = ['SSPACIA', 'SS Infrazone'];

// Accountant-only email for Community Managers
const ACCOUNTANT_CM_EMAIL = 'ssinfrazone21@gmail.com';

export default function AdminInvoicesPage() {
  const { user, isRole } = useAuth();

  // Determine access permissions based on role and email
  const isAdmin = isRole('ADMIN');
  const isCommunityManager = isRole('COMMUNITY_MANAGER');
  const userEmail = user?.email?.toLowerCase() || '';

  // Admin: full access to both tabs
  // CM with ssinfrazone21@gmail.com: Accountant tab ONLY
  // CM with any other email: CM tab ONLY
  const canAccessCM = isAdmin || (isCommunityManager && userEmail !== ACCOUNTANT_CM_EMAIL);
  const canAccessAccountant = isAdmin || (isCommunityManager && userEmail === ACCOUNTANT_CM_EMAIL);

  // Main Role Switcher: 'CM' | 'ACCOUNTANT'
  const [userRoleView, setUserRoleView] = useState<'CM' | 'ACCOUNTANT'>(
    canAccessCM ? 'CM' : 'ACCOUNTANT'
  );

  // Auto-correct view if user doesn't have access to the current tab
  useEffect(() => {
    if (userRoleView === 'CM' && !canAccessCM) {
      setUserRoleView('ACCOUNTANT');
    } else if (userRoleView === 'ACCOUNTANT' && !canAccessAccountant) {
      setUserRoleView('CM');
    }
  }, [canAccessCM, canAccessAccountant, userRoleView]);

  const [activeTab, setActiveTab] = useState<'create' | 'entries'>('entries');
  const [entries, setEntries] = useState<BillingEntry[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [productsList, setProductsList] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  // Search & Filter
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCentreFilter, setSelectedCentreFilter] = useState('ALL');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState('ALL');

  // Modals
  const [showAddProductModal, setShowAddProductModal] = useState(false);
  const [newProductName, setNewProductName] = useState('');
  const [addingProduct, setAddingProduct] = useState(false);

  // Send Prompt Modal (Post Entry Creation)
  const [createdEntryForPrompt, setCreatedEntryForPrompt] = useState<BillingEntry | null>(null);

  // Accountant Upload Invoice Modal
  const [entryToAttachInvoice, setEntryToAttachInvoice] = useState<BillingEntry | null>(null);
  const [uploadingPdf, setUploadingPdf] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // Accountant Full Entry Viewer Modal
  const [entryToViewDetails, setEntryToViewDetails] = useState<BillingEntry | null>(null);

  // CM Review / Reject Remarks Modal
  const [entryToReviewInvoice, setEntryToReviewInvoice] = useState<BillingEntry | null>(null);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectRemarks, setRejectRemarks] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  // Form State
  const [centreId, setCentreId] = useState<number | ''>('');
  const [company, setCompany] = useState<string>('SSPACIA');
  const [client, setClient] = useState<string>('');

  // Line items
  const [items, setItems] = useState<ProductItem[]>([
    { product: 'Dedicated Cabin', seats: 1, ratePerSeat: 0, fromDate: '', toDate: '', amount: 0 }
  ]);

  // Duration State
  const [durationMode, setDurationMode] = useState<'HOURS' | 'DAYS'>('HOURS');
  const [usedHours, setUsedHours] = useState<number | ''>(0);
  const [usedMins, setUsedMins] = useState<number | ''>(0);
  const [usedDays, setUsedDays] = useState<number | ''>(0);

  const [compHours, setCompHours] = useState<number | ''>(0);
  const [compMins, setCompMins] = useState<number | ''>(0);
  const [compDays, setCompDays] = useState<number | ''>(0);

  // Additional Charges
  const [boardRoomAmount, setBoardRoomAmount] = useState<number | ''>('');
  const [eventSpaceAmount, setEventSpaceAmount] = useState<number | ''>('');
  const [otherServicesAmount, setOtherServicesAmount] = useState<number | ''>('');

  // Final Amount & Extra info
  const [finalAmount, setFinalAmount] = useState<number | ''>('');
  const [isFinalAmountOverridden, setIsFinalAmountOverridden] = useState(false);
  const [lastDateOfPayment, setLastDateOfPayment] = useState<string>('');
  const [gstNo, setGstNo] = useState<string>('');
  const [address, setAddress] = useState<string>('');

  // Fetch initial data
  const fetchData = async () => {
    setLoading(true);
    try {
      // 1. Fetch Entries
      const resEntries = await fetch('/api/admin/billing-entries');
      const jsonEntries = await resEntries.json();
      if (jsonEntries.success) {
        setEntries(jsonEntries.data);
      }

      // 2. Fetch Locations
      const resLoc = await fetch('/api/admin/locations?limit=100');
      const jsonLoc = await resLoc.json();
      if (jsonLoc.data && Array.isArray(jsonLoc.data) && jsonLoc.data.length > 0) {
        setLocations(jsonLoc.data);
        if (!centreId) setCentreId(jsonLoc.data[0].id);
      } else {
        setLocations(DEFAULT_CENTRES as any);
        if (!centreId) setCentreId(DEFAULT_CENTRES[0].id);
      }

      // 3. Fetch Products List
      const resProd = await fetch('/api/admin/invoice-products');
      const jsonProd = await resProd.json();
      if (jsonProd.success && Array.isArray(jsonProd.data)) {
        setProductsList(jsonProd.data.map((p: any) => p.name));
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to load initial data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Compute To Be Charged Display
  const toBeChargedDisplay = useMemo(() => {
    if (durationMode === 'HOURS') {
      const totalUsedMins = (Number(usedHours) || 0) * 60 + (Number(usedMins) || 0);
      const totalCompMins = (Number(compHours) || 0) * 60 + (Number(compMins) || 0);
      const diffMins = Math.max(0, totalUsedMins - totalCompMins);
      const hrs = Math.floor(diffMins / 60);
      const mins = diffMins % 60;
      return `${hrs} hrs ${mins} mins`;
    } else {
      const uDays = Number(usedDays) || 0;
      const cDays = Number(compDays) || 0;
      const diffDays = Math.max(0, uDays - cDays);
      return `${diffDays} days`;
    }
  }, [durationMode, usedHours, usedMins, usedDays, compHours, compMins, compDays]);

  // Calculated Product Total
  const productsSubtotal = useMemo(() => {
    return items.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);
  }, [items]);

  // Calculated Final Amount
  const calculatedFinalAmount = useMemo(() => {
    const subtotal = productsSubtotal;
    const br = Number(boardRoomAmount) || 0;
    const ev = Number(eventSpaceAmount) || 0;
    const oth = Number(otherServicesAmount) || 0;
    return subtotal + br + ev + oth;
  }, [productsSubtotal, boardRoomAmount, eventSpaceAmount, otherServicesAmount]);

  useEffect(() => {
    if (!isFinalAmountOverridden) {
      setFinalAmount(calculatedFinalAmount);
    }
  }, [calculatedFinalAmount, isFinalAmountOverridden]);

  // Add Product Row
  const handleAddProductRow = () => {
    setItems([
      ...items,
      {
        product: productsList[0] || 'Dedicated Cabin',
        seats: 1,
        ratePerSeat: 0,
        fromDate: '',
        toDate: '',
        amount: 0
      }
    ]);
  };

  // Remove Product Row
  const handleRemoveProductRow = (index: number) => {
    if (items.length === 1) {
      toast.error('At least one product item is required.');
      return;
    }
    setItems(items.filter((_, i) => i !== index));
  };

  // Update Item Row
  const handleUpdateItem = (index: number, field: keyof ProductItem, value: any) => {
    const newItems = [...items];
    const item = { ...newItems[index], [field]: value };

    if (field === 'seats' || field === 'ratePerSeat') {
      const seats = field === 'seats' ? Number(value) : item.seats;
      const rate = field === 'ratePerSeat' ? Number(value) : item.ratePerSeat;
      item.amount = (seats || 0) * (rate || 0);
    }

    newItems[index] = item;
    setItems(newItems);
  };

  // Add New Master Product
  const handleCreateNewProduct = async () => {
    if (!newProductName.trim()) {
      toast.error('Please enter product name');
      return;
    }

    setAddingProduct(true);
    try {
      const res = await fetch('/api/admin/invoice-products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newProductName.trim() })
      });
      const json = await res.json();
      if (json.success) {
        toast.success(`Product "${json.data.name}" added to master list`);
        setProductsList((prev) => Array.from(new Set([...prev, json.data.name])).sort());
        setShowAddProductModal(false);
        setNewProductName('');
      } else {
        toast.error(json.error || 'Failed to add product');
      }
    } catch {
      toast.error('Failed to add product');
    } finally {
      setAddingProduct(false);
    }
  };

  // Reset Form
  const resetForm = () => {
    setEditingId(null);
    setCompany('SSPACIA');
    setClient('');
    setItems([
      { product: productsList[0] || 'Dedicated Cabin', seats: 1, ratePerSeat: 0, fromDate: '', toDate: '', amount: 0 }
    ]);
    setDurationMode('HOURS');
    setUsedHours(0);
    setUsedMins(0);
    setUsedDays(0);
    setCompHours(0);
    setCompMins(0);
    setCompDays(0);
    setBoardRoomAmount('');
    setEventSpaceAmount('');
    setOtherServicesAmount('');
    setFinalAmount(0);
    setIsFinalAmountOverridden(false);
    setLastDateOfPayment('');
    setGstNo('');
    setAddress('');
  };

  // Populate Form for Editing
  const handleEditEntry = (entry: BillingEntry) => {
    setEditingId(entry.id);
    setCentreId(entry.centreId);
    setCompany(entry.company);
    setClient(entry.client);
    setDurationMode(entry.durationMode || 'HOURS');

    if (entry.durationMode === 'DAYS') {
      setUsedDays(entry.meetingRoomUsedDays || 0);
      setCompDays(entry.complementaryDays || 0);
    } else {
      const uMins = entry.meetingRoomUsedMinutes || 0;
      setUsedHours(Math.floor(uMins / 60));
      setUsedMins(uMins % 60);

      const cMins = entry.complementaryMinutes || 0;
      setCompHours(Math.floor(cMins / 60));
      setCompMins(cMins % 60);
    }

    setBoardRoomAmount(entry.boardRoomAmount ?? '');
    setEventSpaceAmount(entry.eventSpaceAmount ?? '');
    setOtherServicesAmount(entry.otherServicesAmount ?? '');
    setFinalAmount(entry.finalAmount ?? 0);
    setIsFinalAmountOverridden(true);

    if (entry.lastDateOfPayment) {
      setLastDateOfPayment(new Date(entry.lastDateOfPayment).toISOString().split('T')[0]);
    } else {
      setLastDateOfPayment('');
    }

    setGstNo(entry.gstNo || '');
    setAddress(entry.address || '');

    if (entry.items && entry.items.length > 0) {
      setItems(
        entry.items.map((it) => ({
          id: it.id,
          product: it.product,
          seats: it.seats,
          ratePerSeat: Number(it.ratePerSeat),
          fromDate: it.fromDate ? new Date(it.fromDate).toISOString().split('T')[0] : '',
          toDate: it.toDate ? new Date(it.toDate).toISOString().split('T')[0] : '',
          amount: Number(it.amount)
        }))
      );
    }

    setActiveTab('create');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Submit Handler (Create / Update)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!centreId) {
      toast.error('Please select a Centre');
      return;
    }
    if (!client.trim()) {
      toast.error('Please enter Client name');
      return;
    }
    if (items.length === 0) {
      toast.error('Please add at least one product');
      return;
    }

    setSubmitting(true);

    let meetingRoomUsedMinutes: number | null = null;
    let meetingRoomUsedDays: number | null = null;
    let complementaryMinutes: number | null = null;
    let complementaryDays: number | null = null;
    let toBeChargedMinutes: number | null = null;
    let toBeChargedDays: number | null = null;

    if (durationMode === 'HOURS') {
      meetingRoomUsedMinutes = (Number(usedHours) || 0) * 60 + (Number(usedMins) || 0);
      complementaryMinutes = (Number(compHours) || 0) * 60 + (Number(compMins) || 0);
      toBeChargedMinutes = Math.max(0, meetingRoomUsedMinutes - complementaryMinutes);
    } else {
      meetingRoomUsedDays = Number(usedDays) || 0;
      complementaryDays = Number(compDays) || 0;
      toBeChargedDays = Math.max(0, meetingRoomUsedDays - complementaryDays);
    }

    const payload = {
      centreId,
      company,
      client: client.trim(),
      durationMode,
      meetingRoomUsedMinutes,
      meetingRoomUsedDays,
      complementaryMinutes,
      complementaryDays,
      toBeChargedMinutes,
      toBeChargedDays,
      boardRoomAmount: Number(boardRoomAmount) || 0,
      eventSpaceAmount: Number(eventSpaceAmount) || 0,
      otherServicesAmount: Number(otherServicesAmount) || 0,
      finalAmount: Number(finalAmount) || 0,
      lastDateOfPayment: lastDateOfPayment || null,
      gstNo: gstNo.trim() || null,
      address: address.trim() || null,
      items: items.map((it) => ({
        product: it.product,
        seats: Number(it.seats) || 1,
        ratePerSeat: Number(it.ratePerSeat) || 0,
        fromDate: it.fromDate || null,
        toDate: it.toDate || null,
        amount: Number(it.amount) || 0
      }))
    };

    try {
      const url = editingId ? `/api/admin/billing-entries/${editingId}` : '/api/admin/billing-entries';
      const method = editingId ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const json = await res.json();

      if (json.success) {
        toast.success(editingId ? 'Billing entry updated!' : 'Billing entry saved!');
        const savedEntry = json.data;
        resetForm();
        fetchData();
        setActiveTab('entries');

        // Prompt CM to send to accountant if creating new entry
        if (!editingId) {
          setCreatedEntryForPrompt(savedEntry);
        }
      } else {
        toast.error(json.error || 'Operation failed');
      }
    } catch {
      toast.error('An error occurred while saving entry');
    } finally {
      setSubmitting(false);
    }
  };

  // Change Entry Status (Send to Accountant, Approve, Reject)
  const handleUpdateStatus = async (id: number, status: string, remarks?: string) => {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/admin/billing-entries/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, remarks })
      });
      const json = await res.json();
      if (json.success) {
        if (status === 'SENT_TO_ACCOUNTANT') toast.success('Entry sent to Accountant!');
        if (status === 'APPROVED') toast.success('Invoice Approved successfully!');
        if (status === 'REJECTED_WITH_REMARKS') toast.success('Revision requested & remarks sent to Accountant!');

        fetchData();
        setShowRejectModal(false);
        setRejectRemarks('');
        setEntryToReviewInvoice(null);
        setCreatedEntryForPrompt(null);
      } else {
        toast.error(json.error || 'Failed to update status');
      }
    } catch {
      toast.error('Error updating status');
    } finally {
      setActionLoading(false);
    }
  };

  // Accountant PDF File Upload
  const handleUploadInvoicePdf = async () => {
    if (!entryToAttachInvoice || !selectedFile) {
      toast.error('Please select a PDF file first');
      return;
    }

    setUploadingPdf(true);
    try {
      // 1. Upload File
      const formData = new FormData();
      formData.append('file', selectedFile);

      const uploadRes = await fetch('/api/admin/upload-pdf', {
        method: 'POST',
        body: formData
      });
      const uploadJson = await uploadRes.json();

      if (!uploadJson.success) {
        throw new Error(uploadJson.error || 'PDF Upload failed');
      }

      const { fileUrl, fileName, fileSize } = uploadJson.data;

      // 2. Attach Invoice to Entry
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
        setSelectedFile(null);
        fetchData();
      } else {
        toast.error(attachJson.error || 'Failed to attach invoice to entry');
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to process PDF upload');
    } finally {
      setUploadingPdf(false);
    }
  };

  // Delete Entry
  const handleDeleteEntry = async (id: number) => {
    if (!confirm('Are you sure you want to delete this billing entry?')) return;

    try {
      const res = await fetch(`/api/admin/billing-entries/${id}`, {
        method: 'DELETE'
      });
      const json = await res.json();
      if (json.success) {
        toast.success('Billing entry deleted');
        fetchData();
      } else {
        toast.error(json.error || 'Failed to delete');
      }
    } catch {
      toast.error('Failed to delete billing entry');
    }
  };

  // Filtered Entries for CM View
  const filteredEntriesCM = useMemo(() => {
    return entries.filter((e) => {
      const matchesSearch =
        e.client.toLowerCase().includes(searchTerm.toLowerCase()) ||
        e.company.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (e.gstNo && e.gstNo.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchesCentre =
        selectedCentreFilter === 'ALL' || String(e.centreId) === selectedCentreFilter;

      const matchesStatus =
        selectedStatusFilter === 'ALL' || e.status === selectedStatusFilter;

      return matchesSearch && matchesCentre && matchesStatus;
    });
  }, [entries, searchTerm, selectedCentreFilter, selectedStatusFilter]);

  // Filtered Entries for Accountant View
  const filteredEntriesAccountant = useMemo(() => {
    return entries.filter((e) => {
      const matchesSearch =
        e.client.toLowerCase().includes(searchTerm.toLowerCase()) ||
        e.company.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (e.gstNo && e.gstNo.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchesCentre =
        selectedCentreFilter === 'ALL' || String(e.centreId) === selectedCentreFilter;

      const matchesStatus =
        selectedStatusFilter === 'ALL'
          ? ['SENT_TO_ACCOUNTANT', 'REJECTED_WITH_REMARKS', 'INVOICE_ATTACHED', 'APPROVED'].includes(e.status)
          : e.status === selectedStatusFilter;

      return matchesSearch && matchesCentre && matchesStatus;
    });
  }, [entries, searchTerm, selectedCentreFilter, selectedStatusFilter]);

  // KPIs Summary
  const kpis = useMemo(() => {
    const totalEntries = entries.length;
    const totalRevenue = entries.reduce((acc, curr) => acc + (Number(curr.finalAmount) || 0), 0);
    const sentToAccountant = entries.filter((e) => e.status === 'SENT_TO_ACCOUNTANT').length;
    const pendingApproval = entries.filter((e) => e.status === 'INVOICE_ATTACHED').length;
    const approved = entries.filter((e) => e.status === 'APPROVED').length;
    const rejected = entries.filter((e) => e.status === 'REJECTED_WITH_REMARKS').length;

    return {
      totalEntries,
      totalRevenue,
      sentToAccountant,
      pendingApproval,
      approved,
      rejected
    };
  }, [entries]);

  // Status Badge Renderer
  const renderStatusBadge = (status: string) => {
    switch (status) {
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
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider bg-neutral-100 text-neutral-600 border border-neutral-200">
            <Clock size={11} /> Draft
          </span>
        );
    }
  };

  return (
    <div className="p-6 sm:p-10 max-w-7xl mx-auto space-y-8 bg-[#F8F9FA] min-h-screen text-[#1B1C1C]">
      {/* Role Switcher Banner */}
      <FadeUp>
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 bg-white border border-[var(--outline-variant)]/40 shadow-xs">
          <div className="flex items-center gap-3">
            <Receipt className="text-[var(--primary)] h-6 w-6" />
            <div>
              <div className="text-[10px] font-black uppercase tracking-[0.25em] text-[#616161]">
                Active Portal View Mode
              </div>
              <div className="text-sm font-bold text-[#1B1C1C]">
                {userRoleView === 'CM' ? 'Community Manager Workspace' : 'Accountant Workspace'}
              </div>
              {/* Show access restriction notice for Community Managers */}
              {isCommunityManager && (
                <div className="text-[9px] text-[var(--primary)] font-semibold mt-0.5 uppercase tracking-wider">
                  {canAccessCM && !canAccessAccountant && '🔒 Community Manager View Only'}
                  {canAccessAccountant && !canAccessCM && '🔒 Accountant View Only'}
                </div>
              )}
            </div>
          </div>

          {/* Only show switcher if user has access to both tabs */}
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
                <UserCheck size={16} /> Community Manager
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
                <Calculator size={16} /> Accountant
                {kpis.sentToAccountant + kpis.rejected > 0 && (
                  <span className="bg-red-500 text-white text-[9px] font-black px-1.5 py-0.2 rounded-full">
                    {kpis.sentToAccountant + kpis.rejected}
                  </span>
                )}
              </button>
            </div>
          ) : (
            <div className="flex items-center bg-[#F8F9FA] border border-[var(--outline-variant)] p-1 text-xs font-bold w-full sm:w-auto justify-center">
              <div className={`px-5 py-2 text-xs font-bold uppercase tracking-wider flex items-center gap-2 bg-[var(--primary)] text-white shadow-xs`}>
                {canAccessCM ? (
                  <><UserCheck size={16} /> Community Manager</>
                ) : (
                  <><Calculator size={16} /> Accountant</>
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
              <FileCheck size={16} /> {userRoleView === 'CM' ? 'CM Billing Portal' : 'Accountant Tally Processing'}
            </div>
            <h1 className="text-3xl sm:text-4xl font-display font-black tracking-tight text-[#1B1C1C]">
              Invoices & Entries Lifecycle
            </h1>
            <p className="text-sm text-[#616161] mt-1 font-light">
              {userRoleView === 'CM'
                ? 'Create seating entries, send to Accountant, and review attached Tally PDF invoices for final approval.'
                : 'View entries sent by CM, attach Tally PDF invoices, review CM revision remarks, and re-submit for approval.'}
            </p>
          </div>

          {userRoleView === 'CM' && (
            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  resetForm();
                  setActiveTab('create');
                }}
                className={`px-5 py-3 rounded-none font-bold text-xs uppercase tracking-widest transition-all flex items-center gap-2 shadow-sm ${
                  activeTab === 'create'
                    ? 'bg-[var(--primary)] text-white'
                    : 'bg-white text-[#1B1C1C] border border-[var(--outline-variant)] hover:border-[var(--primary)]'
                }`}
              >
                <Plus size={16} /> {editingId ? 'Edit Entry' : 'Create Entry'}
              </button>

              <button
                onClick={() => setActiveTab('entries')}
                className={`px-5 py-3 rounded-none font-bold text-xs uppercase tracking-widest transition-all flex items-center gap-2 shadow-sm ${
                  activeTab === 'entries'
                    ? 'bg-[var(--primary)] text-white'
                    : 'bg-white text-[#1B1C1C] border border-[var(--outline-variant)] hover:border-[var(--primary)]'
                }`}
              >
                <FileText size={16} /> Entries Registry ({entries.length})
              </button>
            </div>
          )}
        </div>
      </FadeUp>

      {/* KPI Cards */}
      <FadeUp delay={0.1}>
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="bg-white p-5 border border-[var(--outline-variant)]/40 shadow-xs">
            <div className="text-[10px] font-black uppercase tracking-[0.2em] text-[#616161]">Total Entries</div>
            <div className="text-2xl font-display font-black mt-1 text-[#1B1C1C]">{kpis.totalEntries}</div>
            <div className="text-[11px] text-[#616161] font-light">All recorded entries</div>
          </div>

          <div className="bg-white p-5 border border-blue-200 bg-blue-50/20 shadow-xs">
            <div className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-700">With Accountant</div>
            <div className="text-2xl font-display font-black mt-1 text-blue-800">{kpis.sentToAccountant}</div>
            <div className="text-[11px] text-blue-600 font-light">Awaiting Tally PDF</div>
          </div>

          <div className="bg-white p-5 border border-amber-200 bg-amber-50/20 shadow-xs">
            <div className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-700">Pending Approval</div>
            <div className="text-2xl font-display font-black mt-1 text-amber-800">{kpis.pendingApproval}</div>
            <div className="text-[11px] text-amber-600 font-light">Invoice attached by Accountant</div>
          </div>

          <div className="bg-white p-5 border border-emerald-200 bg-emerald-50/20 shadow-xs">
            <div className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-700">Approved Invoices</div>
            <div className="text-2xl font-display font-black mt-1 text-emerald-800">{kpis.approved}</div>
            <div className="text-[11px] text-emerald-600 font-light">Approved by CM</div>
          </div>

          <div className="bg-white p-5 border border-red-200 bg-red-50/20 shadow-xs col-span-2 lg:col-span-1">
            <div className="text-[10px] font-black uppercase tracking-[0.2em] text-red-700">Revisions Requested</div>
            <div className="text-2xl font-display font-black mt-1 text-red-800">{kpis.rejected}</div>
            <div className="text-[11px] text-red-600 font-light">CM remarks pending</div>
          </div>
        </div>
      </FadeUp>

      {/* COMMUNITY MANAGER VIEW */}
      {userRoleView === 'CM' && (
        <>
          {/* CREATE / EDIT FORM TAB */}
          {activeTab === 'create' && (
            <FadeUp delay={0.2}>
              <form onSubmit={handleSubmit} className="bg-white border border-[var(--outline-variant)]/40 p-6 sm:p-8 space-y-8 shadow-xs">
                {/* Header info */}
                <div className="flex items-center justify-between border-b border-neutral-200 pb-4">
                  <div>
                    <h2 className="text-xl font-bold text-[#1B1C1C]">
                      {editingId ? `Editing Entry #${editingId}` : 'New Billing Entry'}
                    </h2>
                    <p className="text-xs text-[#616161] font-light">
                      Fill in space allocations, product lines, and duration details below.
                    </p>
                  </div>
                  {editingId && (
                    <button
                      type="button"
                      onClick={resetForm}
                      className="text-xs text-red-600 font-bold uppercase tracking-wider hover:underline"
                    >
                      Cancel Edit
                    </button>
                  )}
                </div>

                {/* Section 1: Basic Info */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-[#616161] mb-2">
                      Centre / Location *
                    </label>
                    <select
                      value={centreId}
                      onChange={(e) => setCentreId(Number(e.target.value))}
                      className="w-full bg-[#F8F9FA] border border-[var(--outline-variant)] px-4 py-3 text-sm focus:outline-none focus:border-[var(--primary)] font-medium"
                      required
                    >
                      {locations.map((loc) => (
                        <option key={loc.id} value={loc.id}>
                          {loc.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-[#616161] mb-2">
                      Company Entity *
                    </label>
                    <select
                      value={company}
                      onChange={(e) => setCompany(e.target.value)}
                      className="w-full bg-[#F8F9FA] border border-[var(--outline-variant)] px-4 py-3 text-sm focus:outline-none focus:border-[var(--primary)] font-medium"
                      required
                    >
                      {COMPANIES.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-[#616161] mb-2">
                      Client Name *
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Angel One Limited"
                      value={client}
                      onChange={(e) => setClient(e.target.value)}
                      className="w-full bg-[#F8F9FA] border border-[var(--outline-variant)] px-4 py-3 text-sm focus:outline-none focus:border-[var(--primary)]"
                      required
                    />
                  </div>
                </div>

                {/* Section 2: Products Line Items */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between border-b border-neutral-200 pb-2">
                    <h3 className="text-sm font-bold uppercase tracking-wider text-[#1B1C1C] flex items-center gap-2">
                      <Briefcase size={16} className="text-[var(--primary)]" /> Products & Seating Line Items
                    </h3>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setShowAddProductModal(true)}
                        className="text-xs text-[var(--primary)] font-bold uppercase tracking-wider hover:underline flex items-center gap-1"
                      >
                        <Plus size={14} /> Add Master Product
                      </button>
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-[#F8F9FA] text-[#616161] uppercase tracking-wider border-b border-[var(--outline-variant)]">
                          <th className="p-3 font-bold">Product</th>
                          <th className="p-3 font-bold w-24">Seats</th>
                          <th className="p-3 font-bold w-36">Rate/Seat (₹)</th>
                          <th className="p-3 font-bold w-36">From Date</th>
                          <th className="p-3 font-bold w-36">To Date</th>
                          <th className="p-3 font-bold w-36">Amount (₹)</th>
                          <th className="p-3 font-bold w-12 text-center"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-100">
                        {items.map((row, idx) => (
                          <tr key={idx} className="hover:bg-neutral-50/50">
                            <td className="p-2">
                              <select
                                value={row.product}
                                onChange={(e) => handleUpdateItem(idx, 'product', e.target.value)}
                                className="w-full bg-white border border-[var(--outline-variant)] px-3 py-2 text-xs focus:outline-none focus:border-[var(--primary)] font-medium"
                              >
                                {productsList.map((p) => (
                                  <option key={p} value={p}>
                                    {p}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td className="p-2">
                              <input
                                type="number"
                                min="1"
                                value={row.seats}
                                onChange={(e) => handleUpdateItem(idx, 'seats', e.target.value)}
                                className="w-full bg-white border border-[var(--outline-variant)] px-3 py-2 text-xs focus:outline-none focus:border-[var(--primary)] text-center font-bold"
                              />
                            </td>
                            <td className="p-2">
                              <input
                                type="number"
                                min="0"
                                placeholder="0"
                                value={row.ratePerSeat || ''}
                                onChange={(e) => handleUpdateItem(idx, 'ratePerSeat', e.target.value)}
                                className="w-full bg-white border border-[var(--outline-variant)] px-3 py-2 text-xs focus:outline-none focus:border-[var(--primary)] font-bold text-right"
                              />
                            </td>
                            <td className="p-2">
                              <input
                                type="date"
                                value={row.fromDate}
                                onChange={(e) => handleUpdateItem(idx, 'fromDate', e.target.value)}
                                className="w-full bg-white border border-[var(--outline-variant)] px-2 py-2 text-xs focus:outline-none focus:border-[var(--primary)]"
                              />
                            </td>
                            <td className="p-2">
                              <input
                                type="date"
                                value={row.toDate}
                                onChange={(e) => handleUpdateItem(idx, 'toDate', e.target.value)}
                                className="w-full bg-white border border-[var(--outline-variant)] px-2 py-2 text-xs focus:outline-none focus:border-[var(--primary)]"
                              />
                            </td>
                            <td className="p-2 font-bold text-right text-[#1B1C1C]">
                              ₹{row.amount.toLocaleString('en-IN')}
                            </td>
                            <td className="p-2 text-center">
                              <button
                                type="button"
                                onClick={() => handleRemoveProductRow(idx)}
                                className="text-neutral-400 hover:text-red-600 transition-colors p-1"
                                title="Remove row"
                              >
                                <Trash2 size={16} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    <button
                      type="button"
                      onClick={handleAddProductRow}
                      className="px-4 py-2 bg-[#F8F9FA] border border-[var(--outline-variant)] text-xs font-bold uppercase tracking-wider hover:bg-neutral-100 flex items-center gap-1.5"
                    >
                      <Plus size={14} /> Add Product Row
                    </button>

                    <div className="text-sm font-bold text-[#1B1C1C]">
                      Products Subtotal: <span className="text-[var(--primary)]">₹{productsSubtotal.toLocaleString('en-IN')}</span>
                    </div>
                  </div>
                </div>

                {/* Section 3: Duration */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between border-b border-neutral-200 pb-2">
                    <h3 className="text-sm font-bold uppercase tracking-wider text-[#1B1C1C] flex items-center gap-2">
                      <Clock size={16} className="text-[var(--primary)]" /> Meeting Room Usage & Allowances
                    </h3>

                    <div className="flex items-center bg-[#F8F9FA] border border-[var(--outline-variant)] p-0.5 text-xs font-bold">
                      <button
                        type="button"
                        onClick={() => setDurationMode('HOURS')}
                        className={`px-3 py-1 text-[10px] uppercase tracking-widest transition-all ${
                          durationMode === 'HOURS'
                            ? 'bg-[var(--primary)] text-white shadow-xs'
                            : 'text-[#616161] hover:text-[#1B1C1C]'
                        }`}
                      >
                        Hours & Mins
                      </button>
                      <button
                        type="button"
                        onClick={() => setDurationMode('DAYS')}
                        className={`px-3 py-1 text-[10px] uppercase tracking-widest transition-all ${
                          durationMode === 'DAYS'
                            ? 'bg-[var(--primary)] text-white shadow-xs'
                            : 'text-[#616161] hover:text-[#1B1C1C]'
                        }`}
                      >
                        Days Mode
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-[#F8F9FA] p-4 border border-[var(--outline-variant)]/60">
                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-[#616161] mb-2">
                        Meeting Room Used
                      </label>
                      {durationMode === 'HOURS' ? (
                        <div className="flex gap-2">
                          <div className="flex-1">
                            <input
                              type="number"
                              min="0"
                              placeholder="Hrs"
                              value={usedHours}
                              onChange={(e) => setUsedHours(e.target.value === '' ? '' : Number(e.target.value))}
                              className="w-full bg-white border border-[var(--outline-variant)] px-3 py-2 text-xs focus:outline-none focus:border-[var(--primary)]"
                            />
                            <span className="text-[10px] text-[#616161]">Hours</span>
                          </div>
                          <div className="flex-1">
                            <input
                              type="number"
                              min="0"
                              max="59"
                              placeholder="Mins"
                              value={usedMins}
                              onChange={(e) => setUsedMins(e.target.value === '' ? '' : Number(e.target.value))}
                              className="w-full bg-white border border-[var(--outline-variant)] px-3 py-2 text-xs focus:outline-none focus:border-[var(--primary)]"
                            />
                            <span className="text-[10px] text-[#616161]">Minutes</span>
                          </div>
                        </div>
                      ) : (
                        <div>
                          <input
                            type="number"
                            min="0"
                            placeholder="Days"
                            value={usedDays}
                            onChange={(e) => setUsedDays(e.target.value === '' ? '' : Number(e.target.value))}
                            className="w-full bg-white border border-[var(--outline-variant)] px-3 py-2 text-xs focus:outline-none focus:border-[var(--primary)]"
                          />
                          <span className="text-[10px] text-[#616161]">Total Days</span>
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-[#616161] mb-2">
                        Complementary Allowance
                      </label>
                      {durationMode === 'HOURS' ? (
                        <div className="flex gap-2">
                          <div className="flex-1">
                            <input
                              type="number"
                              min="0"
                              placeholder="Hrs"
                              value={compHours}
                              onChange={(e) => setCompHours(e.target.value === '' ? '' : Number(e.target.value))}
                              className="w-full bg-white border border-[var(--outline-variant)] px-3 py-2 text-xs focus:outline-none focus:border-[var(--primary)]"
                            />
                            <span className="text-[10px] text-[#616161]">Hours</span>
                          </div>
                          <div className="flex-1">
                            <input
                              type="number"
                              min="0"
                              max="59"
                              placeholder="Mins"
                              value={compMins}
                              onChange={(e) => setCompMins(e.target.value === '' ? '' : Number(e.target.value))}
                              className="w-full bg-white border border-[var(--outline-variant)] px-3 py-2 text-xs focus:outline-none focus:border-[var(--primary)]"
                            />
                            <span className="text-[10px] text-[#616161]">Minutes</span>
                          </div>
                        </div>
                      ) : (
                        <div>
                          <input
                            type="number"
                            min="0"
                            placeholder="Days"
                            value={compDays}
                            onChange={(e) => setCompDays(e.target.value === '' ? '' : Number(e.target.value))}
                            className="w-full bg-white border border-[var(--outline-variant)] px-3 py-2 text-xs focus:outline-none focus:border-[var(--primary)]"
                          />
                          <span className="text-[10px] text-[#616161]">Total Days</span>
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-[#616161] mb-2">
                        To Be Charged Meeting Room
                      </label>
                      <div className="w-full bg-white border border-[var(--outline-variant)] px-4 py-3 text-xs font-bold text-[var(--primary)] flex items-center justify-between">
                        <span>{toBeChargedDisplay}</span>
                        <span className="text-[9px] bg-emerald-50 text-emerald-700 font-extrabold px-2 py-0.5 uppercase tracking-wider">
                          Auto Calculated
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Section 4: Additional Charges */}
                <div className="space-y-4">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-[#1B1C1C] border-b border-neutral-200 pb-2 flex items-center gap-2">
                    <DollarSign size={16} className="text-[var(--primary)]" /> Additional Services & Final Amount
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-[#616161] mb-2">
                        Board Room Amount (₹)
                      </label>
                      <input
                        type="number"
                        min="0"
                        placeholder="0"
                        value={boardRoomAmount}
                        onChange={(e) => setBoardRoomAmount(e.target.value === '' ? '' : Number(e.target.value))}
                        className="w-full bg-[#F8F9FA] border border-[var(--outline-variant)] px-4 py-3 text-sm focus:outline-none focus:border-[var(--primary)] font-bold text-right"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-[#616161] mb-2">
                        Event Space Amount (₹)
                      </label>
                      <input
                        type="number"
                        min="0"
                        placeholder="0"
                        value={eventSpaceAmount}
                        onChange={(e) => setEventSpaceAmount(e.target.value === '' ? '' : Number(e.target.value))}
                        className="w-full bg-[#F8F9FA] border border-[var(--outline-variant)] px-4 py-3 text-sm focus:outline-none focus:border-[var(--primary)] font-bold text-right"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-[#616161] mb-2">
                        Other Services (₹)
                      </label>
                      <input
                        type="number"
                        min="0"
                        placeholder="0"
                        value={otherServicesAmount}
                        onChange={(e) => setOtherServicesAmount(e.target.value === '' ? '' : Number(e.target.value))}
                        className="w-full bg-[#F8F9FA] border border-[var(--outline-variant)] px-4 py-3 text-sm focus:outline-none focus:border-[var(--primary)] font-bold text-right"
                      />
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="block text-[11px] font-bold uppercase tracking-wider text-[#1B1C1C]">
                          Final Total Amount (₹) *
                        </label>
                        {isFinalAmountOverridden && (
                          <button
                            type="button"
                            onClick={() => setIsFinalAmountOverridden(false)}
                            className="text-[9px] text-[var(--primary)] font-bold uppercase tracking-wider hover:underline"
                          >
                            Reset Auto
                          </button>
                        )}
                      </div>
                      <input
                        type="number"
                        min="0"
                        value={finalAmount}
                        onChange={(e) => {
                          setIsFinalAmountOverridden(true);
                          setFinalAmount(e.target.value === '' ? '' : Number(e.target.value));
                        }}
                        className="w-full bg-emerald-50 border border-emerald-300 px-4 py-3 text-base focus:outline-none focus:border-[var(--primary)] font-black text-right text-emerald-800"
                        required
                      />
                    </div>
                  </div>
                </div>

                {/* Section 5: Metadata */}
                <div className="space-y-4">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-[#1B1C1C] border-b border-neutral-200 pb-2 flex items-center gap-2">
                    <Calendar size={16} className="text-[var(--primary)]" /> Payment Terms & Billing Metadata
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-[#616161] mb-2">
                        Last Date of Payment
                      </label>
                      <input
                        type="date"
                        value={lastDateOfPayment}
                        onChange={(e) => setLastDateOfPayment(e.target.value)}
                        className="w-full bg-[#F8F9FA] border border-[var(--outline-variant)] px-4 py-3 text-sm focus:outline-none focus:border-[var(--primary)]"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-[#616161] mb-2">
                        GST Number
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. 27ABLFA3495P1ZN"
                        value={gstNo}
                        onChange={(e) => setGstNo(e.target.value)}
                        className="w-full bg-[#F8F9FA] border border-[var(--outline-variant)] px-4 py-3 text-sm focus:outline-none focus:border-[var(--primary)] font-mono uppercase"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-[#616161] mb-2">
                        Client Address
                      </label>
                      <input
                        type="text"
                        placeholder="Billing street address..."
                        value={address}
                        onChange={(e) => setAddress(e.target.value)}
                        className="w-full bg-[#F8F9FA] border border-[var(--outline-variant)] px-4 py-3 text-sm focus:outline-none focus:border-[var(--primary)]"
                      />
                    </div>
                  </div>
                </div>

                {/* Submit Buttons */}
                <div className="pt-4 border-t border-neutral-200 flex items-center justify-end gap-4">
                  <button
                    type="button"
                    onClick={resetForm}
                    className="px-6 py-3 bg-[#F8F9FA] border border-[var(--outline-variant)] text-xs font-bold uppercase tracking-widest text-[#616161] hover:bg-neutral-100"
                  >
                    Reset Form
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-8 py-3 bg-[var(--primary)] text-white text-xs font-bold uppercase tracking-widest hover:opacity-90 transition-all flex items-center gap-2 shadow-sm disabled:opacity-50"
                  >
                    {submitting ? (
                      <>
                        <Loader2 size={16} className="animate-spin" /> Saving...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 size={16} /> {editingId ? 'Update Entry' : 'Save Billing Entry'}
                      </>
                    )}
                  </button>
                </div>
              </form>
            </FadeUp>
          )}

          {/* CM ENTRIES REGISTRY TAB */}
          {activeTab === 'entries' && (
            <FadeUp delay={0.2}>
              <div className="bg-white border border-[var(--outline-variant)]/40 p-6 space-y-6 shadow-xs">
                {/* Search & Filter bar */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-b border-neutral-200 pb-4">
                  <div className="relative w-full sm:w-80">
                    <Search size={16} className="absolute left-3 top-3.5 text-[#616161]" />
                    <input
                      type="text"
                      placeholder="Search by client, company or GST..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full bg-[#F8F9FA] border border-[var(--outline-variant)] pl-9 pr-4 py-2.5 text-xs focus:outline-none focus:border-[var(--primary)]"
                    />
                  </div>

                  <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-[#616161]">
                      <Filter size={14} /> Centre:
                    </div>
                    <select
                      value={selectedCentreFilter}
                      onChange={(e) => setSelectedCentreFilter(e.target.value)}
                      className="bg-[#F8F9FA] border border-[var(--outline-variant)] px-3 py-2 text-xs focus:outline-none focus:border-[var(--primary)] font-medium"
                    >
                      <option value="ALL">All Centres</option>
                      {locations.map((loc) => (
                        <option key={loc.id} value={String(loc.id)}>
                          {loc.name}
                        </option>
                      ))}
                    </select>

                    <div className="flex items-center gap-1.5 text-xs font-bold text-[#616161]">
                      Status:
                    </div>
                    <select
                      value={selectedStatusFilter}
                      onChange={(e) => setSelectedStatusFilter(e.target.value)}
                      className="bg-[#F8F9FA] border border-[var(--outline-variant)] px-3 py-2 text-xs focus:outline-none focus:border-[var(--primary)] font-medium"
                    >
                      <option value="ALL">All Statuses</option>
                      <option value="DRAFT">Draft</option>
                      <option value="SENT_TO_ACCOUNTANT">Sent to Accountant</option>
                      <option value="INVOICE_ATTACHED">Invoice Attached (Pending Approval)</option>
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
                    <Loader2 size={20} className="animate-spin text-[var(--primary)]" /> Loading entries...
                  </div>
                ) : filteredEntriesCM.length === 0 ? (
                  <div className="py-16 text-center space-y-3">
                    <div className="text-4xl text-neutral-300">📁</div>
                    <div className="text-sm font-bold text-[#1B1C1C]">No billing entries found</div>
                    <p className="text-xs text-[#616161] max-w-sm mx-auto font-light">
                      No entries match your search or filter criteria.
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-[#F8F9FA] text-[#616161] uppercase tracking-wider border-b border-[var(--outline-variant)] font-bold">
                          <th className="p-3 w-12 text-center">#</th>
                          <th className="p-3">Centre & Client</th>
                          <th className="p-3">Company</th>
                          <th className="p-3">Allocated Products</th>
                          <th className="p-3 text-right">Final Amount</th>
                          <th className="p-3">Status</th>
                          <th className="p-3 text-center w-36">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-100">
                        {filteredEntriesCM.map((entry) => (
                          <tr key={entry.id} className="hover:bg-neutral-50/60 transition-colors">
                            <td className="p-3 text-center font-mono font-bold text-neutral-400">
                              #{entry.id}
                            </td>
                            <td className="p-3">
                              <div className="font-bold text-[#1B1C1C]">{entry.client}</div>
                              <div className="text-[10px] text-[#616161]">{entry.centre?.name}</div>
                              {entry.gstNo && (
                                <div className="text-[9px] font-mono text-neutral-400">GST: {entry.gstNo}</div>
                              )}
                            </td>
                            <td className="p-3">
                              <span className="inline-block px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-neutral-100 text-neutral-800">
                                {entry.company}
                              </span>
                            </td>
                            <td className="p-3 space-y-1">
                              {entry.items?.map((it, idx) => (
                                <div key={idx} className="text-[11px] text-[#1B1C1C]">
                                  <span className="font-semibold">{it.product}</span>{' '}
                                  <span className="text-[#616161]">
                                    ({it.seats} seat{it.seats > 1 ? 's' : ''} @ ₹{Number(it.ratePerSeat).toLocaleString('en-IN')})
                                  </span>
                                </div>
                              ))}
                            </td>
                            <td className="p-3 text-right font-black text-sm text-[var(--primary)]">
                              ₹{Number(entry.finalAmount || 0).toLocaleString('en-IN')}
                            </td>
                            <td className="p-3">
                              {renderStatusBadge(entry.status)}

                              {/* If CM rejected and typed remarks */}
                              {entry.status === 'REJECTED_WITH_REMARKS' && entry.remarks && (
                                <div className="mt-1 text-[10px] text-red-600 font-medium italic border-l-2 border-red-300 pl-1.5">
                                  Remarks: "{entry.remarks}"
                                </div>
                              )}
                            </td>
                            <td className="p-3 text-center">
                              <div className="flex flex-col gap-1 items-center justify-center">
                                {/* Send to Accountant (if DRAFT) */}
                                {entry.status === 'DRAFT' && (
                                  <button
                                    onClick={() => handleUpdateStatus(entry.id, 'SENT_TO_ACCOUNTANT')}
                                    disabled={actionLoading}
                                    className="px-2.5 py-1 bg-blue-600 text-white font-bold text-[9px] uppercase tracking-wider hover:bg-blue-700 transition-colors flex items-center gap-1 w-full justify-center"
                                  >
                                    <Send size={10} /> Send to Accountant
                                  </button>
                                )}

                                {/* Review Attached Tally Invoice PDF (if INVOICE_ATTACHED) */}
                                {entry.status === 'INVOICE_ATTACHED' && entry.attachedInvoice && (
                                  <button
                                    onClick={() => setEntryToReviewInvoice(entry)}
                                    className="px-2.5 py-1 bg-amber-600 text-white font-bold text-[9px] uppercase tracking-wider hover:bg-amber-700 transition-colors flex items-center gap-1 w-full justify-center shadow-xs"
                                  >
                                    <Eye size={10} /> Review Invoice PDF
                                  </button>
                                )}

                                {/* Edit & Delete */}
                                <div className="flex items-center gap-1 mt-0.5">
                                  <button
                                    onClick={() => handleEditEntry(entry)}
                                    className="p-1 text-neutral-500 hover:text-[var(--primary)] transition-colors hover:bg-neutral-100"
                                    title="Edit entry"
                                  >
                                    <Edit2 size={13} />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteEntry(entry.id)}
                                    className="p-1 text-neutral-500 hover:text-red-600 transition-colors hover:bg-neutral-100"
                                    title="Delete entry"
                                  >
                                    <Trash2 size={13} />
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
          )}
        </>
      )}

      {/* ACCOUNTANT WORKSPACE VIEW */}
      {userRoleView === 'ACCOUNTANT' && (
        <FadeUp delay={0.2}>
          <div className="bg-white border border-[var(--outline-variant)]/40 p-6 space-y-6 shadow-xs">
            {/* Header info */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-neutral-200 pb-4">
              <div>
                <h2 className="text-lg font-bold text-[#1B1C1C] flex items-center gap-2">
                  <Calculator size={20} className="text-[var(--primary)]" /> Accountant Pending Entry Processing Queue
                </h2>
                <p className="text-xs text-[#616161] font-light">
                  Inspect entries submitted by Community Managers, attach Tally PDF invoices, and re-process rejected revisions.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <select
                  value={selectedStatusFilter}
                  onChange={(e) => setSelectedStatusFilter(e.target.value)}
                  className="bg-[#F8F9FA] border border-[var(--outline-variant)] px-3 py-2 text-xs focus:outline-none focus:border-[var(--primary)] font-medium"
                >
                  <option value="ALL">All Accountant Records</option>
                  <option value="SENT_TO_ACCOUNTANT">Pending Tally Upload</option>
                  <option value="REJECTED_WITH_REMARKS">Needs Revision (CM Remarks)</option>
                  <option value="INVOICE_ATTACHED">Sent to CM (Pending Approval)</option>
                  <option value="APPROVED">Approved Invoices</option>
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

            {/* Accountant Table */}
            {loading ? (
              <div className="py-16 text-center text-[#616161] flex items-center justify-center gap-2">
                <Loader2 size={20} className="animate-spin text-[var(--primary)]" /> Loading processing queue...
              </div>
            ) : filteredEntriesAccountant.length === 0 ? (
              <div className="py-16 text-center space-y-3">
                <div className="text-4xl text-neutral-300">💼</div>
                <div className="text-sm font-bold text-[#1B1C1C]">No pending entries for Accountant</div>
                <p className="text-xs text-[#616161] max-w-sm mx-auto font-light">
                  All entries have been processed or none have been submitted by Community Managers yet.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-[#F8F9FA] text-[#616161] uppercase tracking-wider border-b border-[var(--outline-variant)] font-bold">
                      <th className="p-3 w-12 text-center">#</th>
                      <th className="p-3">Centre & Client</th>
                      <th className="p-3">Company</th>
                      <th className="p-3">Product Line Items</th>
                      <th className="p-3 text-right">Final Amount</th>
                      <th className="p-3">Status / CM Remarks</th>
                      <th className="p-3 text-center w-40">Accountant Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {filteredEntriesAccountant.map((entry) => (
                      <tr key={entry.id} className="hover:bg-neutral-50/60 transition-colors">
                        <td className="p-3 text-center font-mono font-bold text-neutral-400">
                          #{entry.id}
                        </td>
                        <td className="p-3">
                          <div className="font-bold text-[#1B1C1C]">{entry.client}</div>
                          <div className="text-[10px] text-[#616161]">{entry.centre?.name}</div>
                          {entry.gstNo && (
                            <div className="text-[9px] font-mono text-neutral-400">GST: {entry.gstNo}</div>
                          )}
                        </td>
                        <td className="p-3">
                          <span className="inline-block px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-neutral-100 text-neutral-800">
                            {entry.company}
                          </span>
                        </td>
                        <td className="p-3 space-y-1">
                          {entry.items?.map((it, idx) => (
                            <div key={idx} className="text-[11px] text-[#1B1C1C]">
                              <span className="font-semibold">{it.product}</span>{' '}
                              <span className="text-[#616161]">
                                ({it.seats} seat{it.seats > 1 ? 's' : ''} @ ₹{Number(it.ratePerSeat).toLocaleString('en-IN')})
                              </span>
                            </div>
                          ))}
                        </td>
                        <td className="p-3 text-right font-black text-sm text-[var(--primary)]">
                          ₹{Number(entry.finalAmount || 0).toLocaleString('en-IN')}
                        </td>
                        <td className="p-3">
                          {renderStatusBadge(entry.status)}

                          {/* Show CM Revision Remarks Alert */}
                          {entry.status === 'REJECTED_WITH_REMARKS' && entry.remarks && (
                            <div className="mt-2 p-2 bg-red-50 border border-red-200 text-red-800 text-[11px] space-y-1">
                              <div className="font-bold flex items-center gap-1">
                                <AlertTriangle size={12} /> CM Revision Remarks:
                              </div>
                              <div className="italic font-normal">"{entry.remarks}"</div>
                            </div>
                          )}

                          {entry.attachedInvoice && (
                            <div className="mt-1 text-[10px] text-emerald-700 font-medium">
                              File: {entry.attachedInvoice.fileName}
                            </div>
                          )}
                        </td>
                        <td className="p-3 text-center">
                          <div className="flex flex-col gap-1.5 items-center justify-center">
                            <button
                              onClick={() => setEntryToViewDetails(entry)}
                              className="px-3 py-1.5 bg-[#F8F9FA] border border-[var(--outline-variant)] hover:bg-neutral-100 text-[#1B1C1C] font-bold text-[10px] uppercase tracking-wider flex items-center justify-center gap-1.5 w-full transition-colors"
                              title="View full CM entry details"
                            >
                              <Eye size={12} className="text-[var(--primary)]" /> View Details
                            </button>

                            {['SENT_TO_ACCOUNTANT', 'REJECTED_WITH_REMARKS', 'INVOICE_ATTACHED'].includes(entry.status) ? (
                              <button
                                onClick={() => {
                                  setEntryToAttachInvoice(entry);
                                  setSelectedFile(null);
                                }}
                                className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-white transition-all flex items-center justify-center gap-1.5 w-full shadow-xs ${
                                  entry.status === 'REJECTED_WITH_REMARKS'
                                    ? 'bg-red-600 hover:bg-red-700'
                                    : entry.attachedInvoice
                                    ? 'bg-neutral-800 hover:bg-black'
                                    : 'bg-[var(--primary)] hover:opacity-90'
                                }`}
                              >
                                <Paperclip size={12} />
                                {entry.attachedInvoice ? 'Replace Tally PDF' : 'Attach Tally PDF'}
                              </button>
                            ) : (
                              <span className="text-[10px] text-emerald-700 font-bold uppercase tracking-wider flex items-center justify-center gap-1">
                                <CheckCircle2 size={12} /> Finalized
                              </span>
                            )}
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
      )}

      {/* MODAL 1: Post-Entry Creation Send Prompt */}
      <AnimatePresence>
        {createdEntryForPrompt && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white border border-[var(--outline-variant)] p-6 w-full max-w-md space-y-4 shadow-xl text-center"
            >
              <div className="h-12 w-12 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto">
                <Send size={24} />
              </div>

              <div>
                <h3 className="text-lg font-bold text-[#1B1C1C]">Entry Saved Successfully!</h3>
                <p className="text-xs text-[#616161] mt-1">
                  Would you like to send this entry for <strong>{createdEntryForPrompt.client}</strong> to the Accountant now for Tally invoice generation?
                </p>
              </div>

              <div className="flex items-center justify-center gap-3 pt-4 border-t border-neutral-200">
                <button
                  type="button"
                  onClick={() => setCreatedEntryForPrompt(null)}
                  className="px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-[#616161] bg-[#F8F9FA] hover:bg-neutral-100"
                >
                  Save as Draft
                </button>
                <button
                  type="button"
                  onClick={() => handleUpdateStatus(createdEntryForPrompt.id, 'SENT_TO_ACCOUNTANT')}
                  disabled={actionLoading}
                  className="px-6 py-2.5 bg-blue-600 text-white text-xs font-bold uppercase tracking-wider hover:bg-blue-700 flex items-center gap-2 shadow-xs"
                >
                  {actionLoading ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} Yes, Send to Accountant
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL 2: Accountant Attach / Replace Tally PDF Invoice */}
      <AnimatePresence>
        {entryToAttachInvoice && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white border border-[var(--outline-variant)] p-6 w-full max-w-lg space-y-4 shadow-xl"
            >
              <div className="flex items-center justify-between border-b border-neutral-200 pb-3">
                <h3 className="text-base font-bold text-[#1B1C1C] flex items-center gap-2">
                  <Paperclip size={18} className="text-[var(--primary)]" /> Attach Tally PDF Invoice
                </h3>
                <button
                  onClick={() => {
                    setEntryToAttachInvoice(null);
                    setSelectedFile(null);
                  }}
                  className="text-neutral-400 hover:text-neutral-700"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Entry details summary */}
              <div className="bg-[#F8F9FA] p-3 border border-[var(--outline-variant)]/60 text-xs space-y-1">
                <div className="font-bold text-[#1B1C1C]">Client: {entryToAttachInvoice.client}</div>
                <div className="text-[#616161]">
                  Centre: {entryToAttachInvoice.centre?.name} | Entity: {entryToAttachInvoice.company}
                </div>
                <div className="font-bold text-[var(--primary)]">
                  Final Amount: ₹{Number(entryToAttachInvoice.finalAmount || 0).toLocaleString('en-IN')}
                </div>
              </div>

              {/* Show CM Remarks if entry was rejected */}
              {entryToAttachInvoice.status === 'REJECTED_WITH_REMARKS' && entryToAttachInvoice.remarks && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-800 text-xs space-y-1">
                  <div className="font-bold flex items-center gap-1.5">
                    <AlertTriangle size={14} /> Community Manager Revision Remarks:
                  </div>
                  <div className="italic">"{entryToAttachInvoice.remarks}"</div>
                </div>
              )}

              {/* File Input */}
              <div className="space-y-2">
                <label className="block text-[11px] font-bold uppercase tracking-wider text-[#616161]">
                  Select Tally Invoice PDF File *
                </label>
                <input
                  type="file"
                  accept="application/pdf,.pdf"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      setSelectedFile(e.target.files[0]);
                    }
                  }}
                  className="w-full bg-[#F8F9FA] border border-[var(--outline-variant)] px-3 py-2 text-xs focus:outline-none"
                />
                {selectedFile && (
                  <div className="text-xs font-semibold text-emerald-700 flex items-center gap-1">
                    <Check size={14} /> Selected: {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)
                  </div>
                )}
              </div>

              {/* Modal Buttons */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-neutral-200">
                <button
                  type="button"
                  onClick={() => {
                    setEntryToAttachInvoice(null);
                    setSelectedFile(null);
                  }}
                  className="px-4 py-2 text-xs font-bold uppercase tracking-wider text-[#616161] hover:bg-neutral-100"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleUploadInvoicePdf}
                  disabled={uploadingPdf || !selectedFile}
                  className="px-6 py-2.5 bg-[var(--primary)] text-white text-xs font-bold uppercase tracking-wider hover:opacity-90 disabled:opacity-50 flex items-center gap-2"
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

      {/* MODAL 3: CM Review Attached Tally Invoice PDF */}
      <AnimatePresence>
        {entryToReviewInvoice && entryToReviewInvoice.attachedInvoice && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white border border-[var(--outline-variant)] p-6 w-full max-w-xl space-y-4 shadow-xl"
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

              {/* Summary */}
              <div className="bg-[#F8F9FA] p-3 border border-[var(--outline-variant)]/60 text-xs space-y-1">
                <div className="font-bold text-[#1B1C1C]">Client: {entryToReviewInvoice.client}</div>
                <div className="text-[#616161]">
                  Centre: {entryToReviewInvoice.centre?.name} | Amount: ₹{Number(entryToReviewInvoice.finalAmount || 0).toLocaleString('en-IN')}
                </div>
              </div>

              {/* PDF Preview Link Card */}
              <div className="p-4 border border-dashed border-neutral-300 bg-neutral-50 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <FileText className="h-8 w-8 text-red-600" />
                  <div>
                    <div className="text-xs font-bold text-[#1B1C1C]">
                      {entryToReviewInvoice.attachedInvoice.fileName}
                    </div>
                    <div className="text-[10px] text-[#616161]">Attached Tally PDF Invoice</div>
                  </div>
                </div>

                <a
                  href={entryToReviewInvoice.attachedInvoice.fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2 bg-[#1B1C1C] text-white font-bold text-xs uppercase tracking-wider hover:bg-neutral-800 transition-colors flex items-center gap-1.5"
                >
                  <Eye size={14} /> View / Download PDF
                </a>
              </div>

              {/* Actions: Approve or Reject */}
              <div className="flex items-center justify-between pt-4 border-t border-neutral-200">
                <button
                  type="button"
                  onClick={() => {
                    setShowRejectModal(true);
                  }}
                  className="px-5 py-2.5 bg-red-50 text-red-700 border border-red-200 text-xs font-bold uppercase tracking-wider hover:bg-red-100 flex items-center gap-1.5"
                >
                  <RotateCcw size={14} /> Request Revision / Reject
                </button>

                <button
                  type="button"
                  onClick={() => handleUpdateStatus(entryToReviewInvoice.id, 'APPROVED')}
                  disabled={actionLoading}
                  className="px-6 py-2.5 bg-emerald-600 text-white text-xs font-bold uppercase tracking-wider hover:bg-emerald-700 flex items-center gap-2 shadow-xs"
                >
                  {actionLoading ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />} Approve Invoice ✅
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL 4: CM Reject Remarks Modal */}
      <AnimatePresence>
        {showRejectModal && entryToReviewInvoice && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white border border-[var(--outline-variant)] p-6 w-full max-w-md space-y-4 shadow-xl"
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
                <label className="block text-[11px] font-bold uppercase tracking-wider text-[#616161] mb-2">
                  Enter Revision Remarks for Accountant *
                </label>
                <textarea
                  rows={4}
                  placeholder="Explain what is missing or needs correction in the Tally invoice (e.g. GST number missing, rate incorrect)..."
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
                  className="px-4 py-2 text-xs font-bold uppercase tracking-wider text-[#616161] hover:bg-neutral-100"
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
                  className="px-5 py-2.5 bg-red-600 text-white text-xs font-bold uppercase tracking-wider hover:bg-red-700 disabled:opacity-50 flex items-center gap-2"
                >
                  {actionLoading ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} Send Remarks to Accountant
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL 5: Add Master Product Modal */}
      <AnimatePresence>
        {showAddProductModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white border border-[var(--outline-variant)] p-6 w-full max-w-md space-y-4 shadow-xl"
            >
              <div className="flex items-center justify-between border-b border-neutral-200 pb-3">
                <h3 className="text-base font-bold text-[#1B1C1C] flex items-center gap-2">
                  <Plus size={18} className="text-[var(--primary)]" /> Add New Master Product
                </h3>
                <button
                  onClick={() => setShowAddProductModal(false)}
                  className="text-neutral-400 hover:text-neutral-700"
                >
                  <X size={18} />
                </button>
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-[#616161] mb-2">
                  Product Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Conference Pod, Soundproof Booth..."
                  value={newProductName}
                  onChange={(e) => setNewProductName(e.target.value)}
                  className="w-full bg-[#F8F9FA] border border-[var(--outline-variant)] px-4 py-3 text-sm focus:outline-none focus:border-[var(--primary)]"
                  autoFocus
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddProductModal(false)}
                  className="px-4 py-2 text-xs font-bold uppercase tracking-wider text-[#616161] hover:bg-neutral-100"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleCreateNewProduct}
                  disabled={addingProduct}
                  className="px-5 py-2 bg-[var(--primary)] text-white text-xs font-bold uppercase tracking-wider hover:opacity-90 disabled:opacity-50"
                >
                  {addingProduct ? 'Adding...' : 'Add Product'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL: Accountant Full Entry Details Viewer */}
      <AnimatePresence>
        {entryToViewDetails && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white border border-[var(--outline-variant)] p-6 sm:p-8 w-full max-w-3xl space-y-6 shadow-2xl my-8 max-h-[90vh] overflow-y-auto"
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between border-b border-neutral-200 pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold bg-neutral-100 text-neutral-700 px-2 py-0.5">
                      Entry #{entryToViewDetails.id}
                    </span>
                    {renderStatusBadge(entryToViewDetails.status)}
                  </div>
                  <h3 className="text-xl font-bold text-[#1B1C1C] mt-1">
                    Client Entry: {entryToViewDetails.client}
                  </h3>
                  <p className="text-xs text-[#616161]">
                    Submitted by {entryToViewDetails.createdBy?.name || 'Community Manager'} on{' '}
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

              {/* Section 1: Basic Info */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-[#F8F9FA] p-4 border border-[var(--outline-variant)]/40 text-xs">
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-[#616161]">Centre / Location</div>
                  <div className="font-bold text-[#1B1C1C] text-sm mt-0.5">{entryToViewDetails.centre?.name || 'N/A'}</div>
                </div>

                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-[#616161]">Company Entity</div>
                  <div className="font-bold text-[#1B1C1C] text-sm mt-0.5">{entryToViewDetails.company}</div>
                </div>

                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-[#616161]">Client Name</div>
                  <div className="font-bold text-[#1B1C1C] text-sm mt-0.5">{entryToViewDetails.client}</div>
                </div>
              </div>

              {/* Section 2: Products & Seating Line Items */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-[#1B1C1C] flex items-center gap-2">
                  <Briefcase size={14} className="text-[var(--primary)]" /> Products & Seating Line Items
                </h4>

                <div className="overflow-x-auto border border-[var(--outline-variant)]/60">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-[#F8F9FA] text-[#616161] uppercase tracking-wider border-b border-[var(--outline-variant)] font-bold">
                        <th className="p-2.5">Product</th>
                        <th className="p-2.5 text-center">Seats</th>
                        <th className="p-2.5 text-right">Rate/Seat (₹)</th>
                        <th className="p-2.5">From Date</th>
                        <th className="p-2.5">To Date</th>
                        <th className="p-2.5 text-right">Amount (₹)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100">
                      {entryToViewDetails.items?.map((it, idx) => (
                        <tr key={idx} className="hover:bg-neutral-50/50">
                          <td className="p-2.5 font-semibold text-[#1B1C1C]">{it.product}</td>
                          <td className="p-2.5 text-center font-bold">{it.seats}</td>
                          <td className="p-2.5 text-right font-mono">₹{Number(it.ratePerSeat).toLocaleString('en-IN')}</td>
                          <td className="p-2.5 text-neutral-600">
                            {it.fromDate ? new Date(it.fromDate).toLocaleDateString('en-IN') : 'N/A'}
                          </td>
                          <td className="p-2.5 text-neutral-600">
                            {it.toDate ? new Date(it.toDate).toLocaleDateString('en-IN') : 'N/A'}
                          </td>
                          <td className="p-2.5 text-right font-bold text-[#1B1C1C]">
                            ₹{Number(it.amount).toLocaleString('en-IN')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="text-right text-xs font-bold text-[#1B1C1C]">
                  Products Subtotal:{' '}
                  <span className="text-[var(--primary)] font-black">
                    ₹
                    {entryToViewDetails.items
                      ?.reduce((acc, curr) => acc + Number(curr.amount || 0), 0)
                      .toLocaleString('en-IN')}
                  </span>
                </div>
              </div>

              {/* Section 3: Meeting Room Usage & Allowances */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-[#1B1C1C] flex items-center gap-2">
                  <Clock size={14} className="text-[var(--primary)]" /> Meeting Room Usage & Allowances ({entryToViewDetails.durationMode === 'DAYS' ? 'Days Mode' : 'Hours/Mins'})
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-[#F8F9FA] p-3 border border-[var(--outline-variant)]/60 text-xs">
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-wider text-[#616161]">Meeting Room Used</div>
                    <div className="font-bold text-[#1B1C1C] mt-0.5">
                      {entryToViewDetails.durationMode === 'DAYS'
                        ? `${entryToViewDetails.meetingRoomUsedDays || 0} days`
                        : `${Math.floor((entryToViewDetails.meetingRoomUsedMinutes || 0) / 60)} hrs ${(entryToViewDetails.meetingRoomUsedMinutes || 0) % 60} mins`}
                    </div>
                  </div>

                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-wider text-[#616161]">Complementary Allowance</div>
                    <div className="font-bold text-[#1B1C1C] mt-0.5">
                      {entryToViewDetails.durationMode === 'DAYS'
                        ? `${entryToViewDetails.complementaryDays || 0} days`
                        : `${Math.floor((entryToViewDetails.complementaryMinutes || 0) / 60)} hrs ${(entryToViewDetails.complementaryMinutes || 0) % 60} mins`}
                    </div>
                  </div>

                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-wider text-[#616161]">To Be Charged</div>
                    <div className="font-extrabold text-[var(--primary)] mt-0.5">
                      {entryToViewDetails.durationMode === 'DAYS'
                        ? `${entryToViewDetails.toBeChargedDays || 0} days`
                        : `${Math.floor((entryToViewDetails.toBeChargedMinutes || 0) / 60)} hrs ${(entryToViewDetails.toBeChargedMinutes || 0) % 60} mins`}
                    </div>
                  </div>
                </div>
              </div>

              {/* Section 4: Additional Services & Final Amount */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-[#1B1C1C] flex items-center gap-2">
                  <DollarSign size={14} className="text-[var(--primary)]" /> Additional Services & Final Amount
                </h4>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                  <div className="bg-[#F8F9FA] p-3 border border-[var(--outline-variant)]/60">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-[#616161]">Board Room</div>
                    <div className="font-bold text-[#1B1C1C] mt-0.5">
                      ₹{Number(entryToViewDetails.boardRoomAmount || 0).toLocaleString('en-IN')}
                    </div>
                  </div>

                  <div className="bg-[#F8F9FA] p-3 border border-[var(--outline-variant)]/60">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-[#616161]">Event Space</div>
                    <div className="font-bold text-[#1B1C1C] mt-0.5">
                      ₹{Number(entryToViewDetails.eventSpaceAmount || 0).toLocaleString('en-IN')}
                    </div>
                  </div>

                  <div className="bg-[#F8F9FA] p-3 border border-[var(--outline-variant)]/60">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-[#616161]">Other Services</div>
                    <div className="font-bold text-[#1B1C1C] mt-0.5">
                      ₹{Number(entryToViewDetails.otherServicesAmount || 0).toLocaleString('en-IN')}
                    </div>
                  </div>

                  <div className="bg-emerald-50 border border-emerald-300 p-3 text-emerald-900">
                    <div className="text-[10px] font-extrabold uppercase tracking-wider">Final Total Amount</div>
                    <div className="font-black text-lg text-emerald-800 mt-0.5">
                      ₹{Number(entryToViewDetails.finalAmount || 0).toLocaleString('en-IN')}
                    </div>
                  </div>
                </div>
              </div>

              {/* Section 5: Payment Terms & Client Address */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-[#F8F9FA] p-4 border border-[var(--outline-variant)]/40 text-xs">
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-[#616161]">Last Date of Payment</div>
                  <div className="font-bold text-[#1B1C1C] mt-0.5">
                    {entryToViewDetails.lastDateOfPayment
                      ? new Date(entryToViewDetails.lastDateOfPayment).toLocaleDateString('en-IN')
                      : 'N/A'}
                  </div>
                </div>

                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-[#616161]">GST Number</div>
                  <div className="font-mono font-bold text-[#1B1C1C] mt-0.5">{entryToViewDetails.gstNo || 'N/A'}</div>
                </div>

                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-[#616161]">Client Address</div>
                  <div className="font-medium text-[#1B1C1C] mt-0.5">{entryToViewDetails.address || 'N/A'}</div>
                </div>
              </div>

              {/* Show CM Remarks if entry was rejected */}
              {entryToViewDetails.status === 'REJECTED_WITH_REMARKS' && entryToViewDetails.remarks && (
                <div className="p-4 bg-red-50 border border-red-200 text-red-800 text-xs space-y-1">
                  <div className="font-bold flex items-center gap-1.5">
                    <AlertTriangle size={16} /> Community Manager Revision Remarks:
                  </div>
                  <div className="italic font-normal">"{entryToViewDetails.remarks}"</div>
                </div>
              )}

              {/* Attached Invoice PDF if exists */}
              {entryToViewDetails.attachedInvoice && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 text-xs flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Paperclip className="text-emerald-700 h-4 w-4" />
                    <div>
                      <span className="font-bold text-emerald-900">Attached Tally Invoice: </span>
                      <span className="text-emerald-800">{entryToViewDetails.attachedInvoice.fileName}</span>
                    </div>
                  </div>
                  <a
                    href={entryToViewDetails.attachedInvoice.fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1 bg-emerald-700 text-white font-bold text-[10px] uppercase tracking-wider hover:bg-emerald-800"
                  >
                    View PDF
                  </a>
                </div>
              )}

              {/* Footer Actions */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-neutral-200">
                <button
                  type="button"
                  onClick={() => setEntryToViewDetails(null)}
                  className="px-5 py-2.5 bg-[#F8F9FA] border border-[var(--outline-variant)] text-xs font-bold uppercase tracking-wider text-[#616161] hover:bg-neutral-100"
                >
                  Close
                </button>

                {['SENT_TO_ACCOUNTANT', 'REJECTED_WITH_REMARKS', 'INVOICE_ATTACHED'].includes(entryToViewDetails.status) && (
                  <button
                    type="button"
                    onClick={() => {
                      const entry = entryToViewDetails;
                      setEntryToViewDetails(null);
                      setEntryToAttachInvoice(entry);
                      setSelectedFile(null);
                    }}
                    className="px-6 py-2.5 bg-[var(--primary)] text-white text-xs font-bold uppercase tracking-wider hover:opacity-90 flex items-center gap-2 shadow-xs"
                  >
                    <Paperclip size={14} />
                    {entryToViewDetails.attachedInvoice ? 'Replace Tally PDF' : 'Attach Tally PDF'}
                  </button>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

