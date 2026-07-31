'use client';

import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { AddProductModal } from '@/components/admin/add-product-modal';
import {
  Users,
  Package,
  MapPin,
  CheckCircle2,
  Loader2,
  TrendingUp,
  Edit2,
  Trash2,
  XCircle,
  Star,
  Plus,
  LayoutDashboard,
  ChevronRight,
  ShieldCheck,
  FileText
} from 'lucide-react';
import { toast } from 'sonner';
import { FadeUp } from '@/components/ui/fade-up';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
// ─── Types ──────────────────────────────────────────────────
interface DashboardStats {
  totalProducts: number;
  totalLocations: number;
  totalUsers: number;
  activeListings: number;
}

interface RecentProduct {
  id: number;
  name: string;
  type: { name: string };
  category: { name: string };
  isActive: boolean;
  isFeatured: boolean;
  location: { name: string };
}

// ─── Display Helpers ────────────────────────────────────────
const TYPE_LABELS: Record<string, string> = {
  FLEX_DESK: 'Flex Desk',
  FIXED_DESK: 'Fixed Desk',
  DEDICATED_CABIN: 'Dedicated Cabin',
  PRIVATE_CABIN: 'Private Cabin',
  EXECUTIVE_CABIN: 'Executive Cabin',
  MEETING_ROOM: 'Meeting Room',
  BOARD_ROOM: 'Board Room',
  EVENT_ROOM: 'Event Room',
};

interface StatCardProps {
  name: string;
  value: string | number;
  icon: any;
  color: string;
  bg: string;
  delay: number;
}

// ─── Stat Card ──────────────────────────────────────────────
function StatCard({ name, value, icon: Icon, color, bg, delay }: StatCardProps) {
  return (
    <FadeUp delay={delay}>
      <div className="bg-white p-8 rounded-none border border-[var(--outline-variant)]/40 hover:border-[var(--primary)]/60 transition-all group relative overflow-hidden">
        <div className="absolute top-0 left-0 w-1 h-full bg-[var(--primary)] opacity-0 group-hover:opacity-100 transition-opacity" />
        <div className="flex items-center justify-between mb-6">
          <div className={`p-4 rounded-none bg-neutral-50 text-[var(--primary)] border border-[var(--primary)]/20 group-hover:bg-[var(--primary)] group-hover:text-white transition-all`}>
            <Icon size={24} />
          </div>
        </div>
        <div>
          <p className="text-[10px] font-black text-[#616161] uppercase tracking-[0.2em]">{name}</p>
          <h3 className="text-3xl font-display font-black text-[#1B1C1C] mt-2 tracking-tighter">{value}</h3>
        </div>
      </div>
    </FadeUp>
  );
}

// ─── Main Dashboard ─────────────────────────────────────────
export default function AdminDashboardPage() {
  const router = useRouter();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentProducts, setRecentProducts] = useState<RecentProduct[]>([]);
  const [statsLoading, setStatsLoading] = useState(true);
  const [productsLoading, setProductsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const fetchRecentProducts = () => {
    setProductsLoading(true);
    fetch('/api/admin/products')
      .then((r) => r.json())
      .then((json) => {
        if (json.data) setRecentProducts(json.data.slice(0, 5));
      })
      .catch(() => { })
      .finally(() => setProductsLoading(false));
  };

  useEffect(() => {
    // Fetch stats
    fetch('/api/admin/stats')
      .then((r) => r.json())
      .then((json) => {
        if (json.data) setStats(json.data);
      })
      .catch(() => { })
      .finally(() => setStatsLoading(false));

    // Fetch recent products (last 5)
    fetchRecentProducts();
  }, []);

  const handleDeactivate = async (id: number, name: string) => {
    if (!confirm(`Deactivate "${name}"?`)) return;
    try {
      const response = await fetch(`/api/admin/products/${id}`, {
        method: 'DELETE',
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error);
      toast.success(`"${name}" deactivated`);
      // refresh
      const r = await fetch('/api/admin/products');
      const updated = await r.json();
      if (updated.data) setRecentProducts(updated.data.slice(0, 5));
    } catch {
      toast.error('Failed to deactivate product');
    }
  };

  const statCards: Omit<StatCardProps, 'delay'>[] = [
    {
      name: 'Physical Assets',
      value: statsLoading ? '—' : (stats?.totalProducts ?? 0),
      icon: Package,
      color: 'text-[var(--primary)]',
      bg: 'bg-white',
    },
    {
      name: 'Control Nodes',
      value: statsLoading ? '—' : (stats?.totalLocations ?? 0),
      icon: MapPin,
      color: 'text-[var(--primary)]',
      bg: 'bg-white',
    },
    {
      name: 'Verified Personnel',
      value: statsLoading ? '—' : (stats?.totalUsers ?? 0),
      icon: Users,
      color: 'text-[var(--primary)]',
      bg: 'bg-white',
    },
    {
      name: 'Active Signals',
      value: statsLoading ? '—' : (stats?.activeListings ?? 0),
      icon: TrendingUp,
      color: 'text-[var(--primary)]',
      bg: 'bg-white',
    },
  ];

  return (
    <div className="space-y-12 pb-20">
      {/* Header */}
      <FadeUp>
        <div className="flex items-center gap-6">
          <div className="h-20 w-20 bg-white text-[var(--primary)] flex items-center justify-center rounded-none border border-[var(--outline-variant)]/40 shadow-xl">
            <LayoutDashboard size={40} />
          </div>
          <div>
            <h1 className="text-4xl font-display font-black text-[#1B1C1C] tracking-tighter uppercase">Command--Center</h1>
            <p className="text-[#616161] font-bold text-[11px] uppercase tracking-widest mt-1 opacity-60 italic">System overview and node verification</p>
          </div>
        </div>
      </FadeUp>

      {/* Stats Grid */}
      <div className="grid gap-px bg-[var(--outline-variant)]/20 border border-[var(--outline-variant)]/40 sm:grid-cols-2 lg:grid-cols-4 shadow-xl">
        {statCards.map((stat, i) => (
          <StatCard key={stat.name} {...stat} delay={i * 0.1} />
        ))}
      </div>

      {/* Bottom Section */}
      <div className="grid gap-10 lg:grid-cols-12">
        {/* Recent Products Table */}
        <FadeUp delay={0.4} className="lg:col-span-8">
          <div className="bg-white rounded-none border border-[var(--outline-variant)]/40 shadow-xl overflow-hidden flex flex-col h-full">
            <div className="px-8 py-6 border-b border-[var(--outline-variant)]/40 flex items-center justify-between bg-neutral-50/30">
              <h3 className="text-[10px] font-black text-[#1B1C1C] uppercase tracking-[0.3em]">
                Recent Asset Deployments
              </h3>
              <Link
                href="/admin/products"
                className="text-[9px] font-black text-[var(--primary)] uppercase tracking-widest hover:underline"
              >
                View Registry →
              </Link>
            </div>

            {productsLoading ? (
              <div className="flex-1 flex flex-col items-center justify-center p-20 py-24">
                <Loader2 className="h-10 w-10 text-[var(--primary)] animate-spin mb-4" />
                <p className="text-[10px] font-black text-[#1B1C1C] uppercase tracking-[0.3em] animate-pulse italic">Scanning Asset Database...</p>
              </div>
            ) : recentProducts.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center p-20">
                <p className="text-[10px] font-black text-[#616161] uppercase tracking-[0.3em] opacity-40">No records found</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-neutral-50/50 border-b border-[var(--outline-variant)]/20">
                      <th className="px-8 py-4 text-[9px] font-black text-[#9E9E9E] uppercase tracking-widest">Asset Name</th>
                      <th className="px-8 py-4 text-[9px] font-black text-[#9E9E9E] uppercase tracking-widest">Type</th>
                      <th className="px-8 py-4 text-[9px] font-black text-[#9E9E9E] uppercase tracking-widest">Node</th>
                      <th className="px-8 py-4 text-[9px] font-black text-[#9E9E9E] uppercase tracking-widest text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--outline-variant)]/20">
                    {recentProducts.map((product) => (
                      <motion.tr
                        key={product.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="hover:bg-neutral-50 transition-colors group"
                      >
                        <td className="px-8 py-5">
                          <p className="text-xs font-black text-[#1B1B1B] uppercase tracking-wider group-hover:text-[var(--primary)]">{product.name}</p>
                        </td>
                        <td className="px-8 py-5">
                          <span className="text-[8px] font-black bg-neutral-100 text-[#1B1B1B] px-2 py-1 uppercase tracking-widest">{product.type?.name ? TYPE_LABELS[product.type.name] || product.type.name : 'N/A'}</span>
                        </td>
                        <td className="px-8 py-5 text-[10px] uppercase font-bold text-[#616161]">{product.location.name}</td>
                        <td className="px-8 py-5 text-right">
                          <div className={`h-1.5 w-1.5 rounded-none inline-block mr-2 ${product.isActive ? 'bg-[#4DB6AC]' : 'bg-red-400'}`} />
                          <span className={`text-[9px] font-black uppercase tracking-widest ${product.isActive ? 'text-[#4DB6AC]' : 'text-red-400'}`}>{product.isActive ? 'Active' : 'Inactive'}</span>
                        </td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </FadeUp>

        {/* Agreement & Identity Status */}
        <FadeUp delay={0.45} className="lg:col-span-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-[var(--outline-variant)]/20 border border-[var(--outline-variant)]/40 shadow-xl">
            <div className="bg-white p-10 flex flex-col h-full">
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                  <div className="h-1.5 w-6 bg-indigo-600"></div>
                  <h3 className="text-[10px] font-black text-[#1B1C1C] uppercase tracking-[0.3em]">Agreement Registry</h3>
                </div>
                <Link href="/manager/contracts" className="text-[9px] font-bold text-[var(--primary)] uppercase tracking-widest">Open Center</Link>
              </div>
              <div className="flex-1 flex flex-col items-center justify-center py-10 border border-dashed border-neutral-100">
                <ShieldCheck size={32} className="text-[var(--primary)] opacity-20 mb-4" />
                <p className="text-[9px] font-bold uppercase tracking-[0.3em] text-[#9E9E9E]">Legal Protocol Matrix Active</p>
              </div>
            </div>
            <div className="bg-white p-10 flex flex-col h-full">
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                  <div className="h-1.5 w-6 bg-amber-500"></div>
                  <h3 className="text-[10px] font-black text-[#1B1C1C] uppercase tracking-[0.3em]">Identity Queue</h3>
                </div>
                <Link href="/manager/documents" className="text-[9px] font-bold text-[var(--primary)] uppercase tracking-widest">Open Center</Link>
              </div>
              <div className="flex-1 flex flex-col items-center justify-center py-10 border border-dashed border-neutral-100">
                <FileText size={32} className="text-[var(--primary)] opacity-20 mb-4" />
                <p className="text-[9px] font-bold uppercase tracking-[0.3em] text-[#9E9E9E]">Verification Engine Syncing</p>
              </div>
            </div>
          </div>
        </FadeUp>

        {/* Invoices & Billing Section */}
        <FadeUp delay={0.48} className="lg:col-span-8">
          <div className="bg-white p-10 border border-[var(--outline-variant)]/40 shadow-xl flex flex-col h-full space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-1.5 w-6 bg-[var(--primary)]"></div>
                <h3 className="text-[10px] font-black text-[#1B1C1C] uppercase tracking-[0.3em]">Invoices & Billing Workflow</h3>
              </div>
              <Link href="/admin/Invoices" className="text-[9px] font-bold text-[var(--primary)] uppercase tracking-widest hover:underline">
                Open Billing Hub →
              </Link>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
              <div className="p-3 bg-neutral-50 border border-neutral-200">
                <div className="text-[9px] font-bold uppercase tracking-wider text-neutral-500">CM Entries</div>
                <div className="text-lg font-black text-[#1B1C1C] mt-0.5">Active</div>
              </div>
              <div className="p-3 bg-blue-50/50 border border-blue-200">
                <div className="text-[9px] font-bold uppercase tracking-wider text-blue-700">Accountant</div>
                <div className="text-lg font-black text-blue-800 mt-0.5">Tally Sync</div>
              </div>
              <div className="p-3 bg-amber-50/50 border border-amber-200">
                <div className="text-[9px] font-bold uppercase tracking-wider text-amber-700">PDF Verification</div>
                <div className="text-lg font-black text-amber-800 mt-0.5">Pending</div>
              </div>
              <div className="p-3 bg-emerald-50/50 border border-emerald-200">
                <div className="text-[9px] font-bold uppercase tracking-wider text-emerald-700">Approvals</div>
                <div className="text-lg font-black text-emerald-800 mt-0.5">Finalized</div>
              </div>
            </div>

            <div className="flex-1 flex flex-col sm:flex-row items-center justify-between p-5 bg-neutral-50 border border-[var(--outline-variant)]/20 gap-4">
              <div className="space-y-1 text-center sm:text-left">
                <p className="text-xs font-bold text-[#1B1C1C]">Collaborative CM & Accountant Lifecycle</p>
                <p className="text-[11px] text-[#616161] font-light">Community Manager creates entries, Accountant attaches Tally PDF invoices, and CM reviews with revision feedback.</p>
              </div>
              <Link href="/admin/Invoices" className="px-5 py-3 bg-[var(--primary)] text-white text-[10px] font-black uppercase tracking-widest hover:bg-[#1B1B1B] transition-colors shrink-0">
                Launch Invoices Hub
              </Link>
            </div>
          </div>
        </FadeUp>

        {/* Quick Actions */}
        <FadeUp delay={0.5} className="lg:col-span-4">
          <div className="bg-white p-10 rounded-none border border-[var(--outline-variant)]/40 shadow-2xl h-full flex flex-col justify-between">
            <div>
              <h3 className="text-[11px] font-black text-[var(--primary)] uppercase tracking-[0.4em] mb-10">
                Primary Directives
              </h3>
              <div className="space-y-4">
                <button
                  onClick={() => setIsModalOpen(true)}
                  className="w-full flex items-center justify-between px-6 py-5 bg-[var(--primary)] text-white rounded-none font-black text-[10px] uppercase tracking-[0.2em] hover:bg-[#1B1B1B] transition-all shadow-xl group border border-transparent"
                >
                  <span className="flex items-center gap-3">
                    <Plus size={18} />
                    Deploy New Asset
                  </span>
                  <ChevronRight size={16} className="opacity-0 group-hover:opacity-100 transition-all translate-x--2 group-hover:translate-x-0" />
                </button>
                <button
                  onClick={() => router.push('/admin/locations')}
                  className="w-full flex items-center justify-between px-6 py-5 bg-neutral-50 border border-[var(--outline-variant)]/40 text-[#1B1B1B] rounded-none font-black text-[10px] uppercase tracking-[0.2em] hover:border-[var(--primary)] transition-all group"
                >
                  <span className="flex items-center gap-3">
                    <MapPin size={18} />
                    Register New Node
                  </span>
                  <ChevronRight size={16} className="opacity-0 group-hover:opacity-100 transition-all translate-x--2 group-hover:translate-x-0" />
                </button>
                <Link
                  href="/admin/users"
                  className="w-full flex items-center justify-between px-6 py-5 bg-neutral-50 border border-[var(--outline-variant)]/40 text-[#1B1B1B] rounded-none font-black text-[10px] uppercase tracking-[0.2em] hover:border-[var(--primary)] transition-all group"
                >
                  <span className="flex items-center gap-3">
                    <Users size={18} />
                    Personnel Hub
                  </span>
                  <ChevronRight size={16} className="opacity-0 group-hover:opacity-100 transition-all translate-x--2 group-hover:translate-x-0" />
                </Link>
                <Link
                  href="/manager/contracts"
                  className="w-full flex items-center justify-between px-6 py-5 bg-neutral-50 border border-[var(--outline-variant)]/40 text-[#1B1B1B] rounded-none font-black text-[10px] uppercase tracking-[0.2em] hover:border-[var(--primary)] transition-all group"
                >
                  <span className="flex items-center gap-3">
                    <ShieldCheck size={18} />
                    Agreements Center
                  </span>
                  <ChevronRight size={16} className="opacity-0 group-hover:opacity-100 transition-all translate-x--2 group-hover:translate-x-0" />
                </Link>
                <Link
                  href="/manager/documents"
                  className="w-full flex items-center justify-between px-6 py-5 bg-neutral-50 border border-[var(--outline-variant)]/40 text-[#1B1B1B] rounded-none font-black text-[10px] uppercase tracking-[0.2em] hover:border-[var(--primary)] transition-all group"
                >
                  <span className="flex items-center gap-3">
                    <FileText size={18} />
                    Identity Audit
                  </span>
                  <ChevronRight size={16} className="opacity-0 group-hover:opacity-100 transition-all translate-x--2 group-hover:translate-x-0" />
                </Link>
                <Link
                  href="/admin/Invoices"
                  className="w-full flex items-center justify-between px-6 py-5 bg-[var(--primary)]/10 border border-[var(--primary)]/30 text-[var(--primary)] rounded-none font-black text-[10px] uppercase tracking-[0.2em] hover:bg-[var(--primary)] hover:text-white transition-all group"
                >
                  <span className="flex items-center gap-3">
                    <FileText size={18} />
                    Invoices & Entries Hub
                  </span>
                  <ChevronRight size={16} className="opacity-0 group-hover:opacity-100 transition-all translate-x--2 group-hover:translate-x-0" />
                </Link>
              </div>
            </div>

            {/* Mini stats */}
            {!statsLoading && stats && (
              <div className="mt-12 pt-10 border-t border-[var(--outline-variant)]/20 space-y-4">
                <p className="text-[9px] font-black text-[#616161] uppercase tracking-[0.4em] opacity-40">
                  System Health Sync
                </p>
                <div className="flex justify-between items-center text-[10px]">
                  <span className="text-[#616161] font-bold uppercase tracking-widest">Active nodes</span>
                  <span className="font-black text-[var(--primary)] uppercase">
                    {stats.activeListings} / {stats.totalProducts}
                  </span>
                </div>
                <div className="flex justify-between items-center text-[10px]">
                  <span className="text-[#616161] font-bold uppercase tracking-widest">Verified Personnel</span>
                  <span className="font-black text-[var(--primary)] uppercase">
                    {stats.totalUsers}
                  </span>
                </div>
              </div>
            )}
          </div>
        </FadeUp>
      </div>

      <AddProductModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={fetchRecentProducts}
      />
    </div>
  );
}
