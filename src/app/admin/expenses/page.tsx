"use client";

import React, { useState, useEffect } from "react";
import {
  Building2,
  Loader2,
  RefreshCcw
} from "lucide-react";
import { toast } from "sonner";
import { FadeUp } from "@/components/ui/fade-up";
import { ExpenseSpreadsheet } from "@/components/admin/expense-spreadsheet";

interface LocationInfo {
  id: number;
  name: string;
  slug: string;
  city?: { name: string };
}

interface ExpenseSheetData {
  id: number;
  locationId: number;
  title: string;
  columns: any[];
  rows: any[];
  location: LocationInfo;
  updatedAt: string;
}

export default function SuperAdminExpensesPage() {
  const [loading, setLoading] = useState(true);
  const [locations, setLocations] = useState<LocationInfo[]>([]);
  const [sheets, setSheets] = useState<ExpenseSheetData[]>([]);
  const [activeLocationId, setActiveLocationId] = useState<number | null>(null);

  useEffect(() => {
    fetchExpensesData();
  }, []);

  const fetchExpensesData = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/admin/expenses");
      if (!res.ok) {
        throw new Error("Failed to load center expenses");
      }
      const data = await res.json();
      setLocations(data.locations || []);
      setSheets(data.sheets || []);

      if (data.locations && data.locations.length > 0 && !activeLocationId) {
        setActiveLocationId(data.locations[0].id);
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to load expense sheets");
    } finally {
      setLoading(false);
    }
  };

  const activeSheet = sheets.find((s) => s.locationId === activeLocationId);
  const activeLocation = locations.find((l) => l.id === activeLocationId);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Loader2 className="w-10 h-10 animate-spin text-[#1ab0bc]" />
        <p className="text-xs font-mono font-bold text-gray-500 uppercase tracking-widest">
          Loading Center Expense Spreadsheets...
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-20 font-sans">
      
      {/* ── HEADER ── */}
      <FadeUp>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-gray-200">
          <div>
            <h1 className="text-2xl md:text-3xl font-display font-black text-[#1B1C1C] uppercase tracking-tight flex items-center gap-3">
              <span>Center Expense Spreadsheets</span>
              <span className="bg-[#1ab0bc] text-white text-[9px] font-mono px-2.5 py-0.5 uppercase tracking-widest">
                SUPER ADMIN MASTER
              </span>
            </h1>
            <p className="text-xs text-gray-500 font-bold uppercase tracking-widest mt-1">
              Center-wise Community Manager Expense Spreadsheets & Financial Audit
            </p>
          </div>

          <button
            onClick={fetchExpensesData}
            className="bg-white hover:bg-gray-100 text-gray-800 px-4 py-2 text-xs font-bold uppercase tracking-wider border border-gray-300 transition-all flex items-center gap-2 shadow-xs cursor-pointer self-start md:self-auto"
          >
            <RefreshCcw className="w-4 h-4 text-[#1ab0bc]" />
            <span>Refresh Sheets</span>
          </button>
        </div>
      </FadeUp>

      {/* ── TOP CENTER TABS (PREMIER HOUSE, MERCADO, AGARWAL COMPLEX, ETC.) ── */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none border-b border-gray-200">
          <span className="text-[10px] font-bold uppercase tracking-widest text-[#1ab0bc] shrink-0 mr-2 flex items-center gap-1">
            <Building2 className="w-4 h-4" /> SELECT CENTER:
          </span>

          {locations.map((loc) => {
            const isSelected = activeLocationId === loc.id;
            return (
              <button
                key={loc.id}
                onClick={() => setActiveLocationId(loc.id)}
                className={`px-5 py-2.5 text-xs font-black uppercase tracking-wider transition-all whitespace-nowrap border flex items-center gap-2 cursor-pointer ${
                  isSelected
                    ? "bg-[#1ab0bc] text-white border-[#1ab0bc] shadow-md scale-105"
                    : "bg-white text-gray-700 border-gray-300 hover:bg-gray-100 hover:text-gray-900"
                }`}
              >
                <Building2 className={`w-4 h-4 ${isSelected ? "text-white" : "text-[#1ab0bc]"}`} />
                <span>{loc.name}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── LIVE INTERACTIVE EXPENSE SPREADSHEET FOR SELECTED CENTER ── */}
      {activeLocationId && activeLocation ? (
        <ExpenseSpreadsheet
          key={activeLocationId}
          locationId={activeLocationId}
          locationName={activeLocation.name}
          initialColumns={activeSheet?.columns || []}
          initialRows={activeSheet?.rows || []}
          isSuperAdmin={true}
          onSaved={fetchExpensesData}
        />
      ) : (
        <div className="bg-white p-12 text-center border border-gray-200 text-gray-400 italic">
          Please select a center tab above to view its expense spreadsheet.
        </div>
      )}

    </div>
  );
}
