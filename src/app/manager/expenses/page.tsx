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

export default function CommunityManagerExpensesPage() {
  const [loading, setLoading] = useState(true);
  const [locations, setLocations] = useState<LocationInfo[]>([]);
  const [sheets, setSheets] = useState<ExpenseSheetData[]>([]);

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
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to load expense sheet");
    } finally {
      setLoading(false);
    }
  };

  const assignedLocation = locations.length > 0 ? locations[0] : null;
  const assignedSheet = sheets.length > 0 ? sheets[0] : null;

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Loader2 className="w-10 h-10 animate-spin text-[#1ab0bc]" />
        <p className="text-xs font-mono font-bold text-gray-500 uppercase tracking-widest">
          Loading Center Expense Sheet...
        </p>
      </div>
    );
  }

  if (!assignedLocation || !assignedSheet) {
    return (
      <div className="bg-white p-12 text-center border border-gray-200 shadow-sm max-w-2xl mx-auto my-12 space-y-4">
        <div className="w-16 h-16 bg-amber-50 text-amber-600 rounded-full flex items-center justify-center mx-auto border border-amber-200">
          <Building2 className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-gray-900 uppercase tracking-tight">No Center Assigned Yet</h2>
        <p className="text-xs text-gray-500 max-w-md mx-auto">
          You are currently not assigned to any specific coworking location center.
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
              <span>{assignedLocation.name} Expense Sheet</span>
              <span className="bg-[#1ab0bc] text-white text-[9px] font-mono px-2.5 py-0.5 uppercase tracking-widest">
                COMMUNITY MANAGER
              </span>
            </h1>
            <p className="text-xs text-gray-500 font-bold uppercase tracking-widest mt-1">
              Daily Center Operating Expenses Spreadsheet
            </p>
          </div>

          <button
            onClick={fetchExpensesData}
            className="bg-white hover:bg-gray-100 text-gray-800 px-4 py-2 text-xs font-bold uppercase tracking-wider border border-gray-300 transition-all flex items-center gap-2 shadow-xs cursor-pointer self-start md:self-auto"
          >
            <RefreshCcw className="w-4 h-4 text-[#1ab0bc]" />
            <span>Refresh Sheet</span>
          </button>
        </div>
      </FadeUp>

      {/* ── CLEAN FULL-SCREEN SPREADSHEET ── */}
      <ExpenseSpreadsheet
        key={assignedLocation.id}
        locationId={assignedLocation.id}
        locationName={assignedLocation.name}
        initialColumns={assignedSheet.columns || []}
        initialRows={assignedSheet.rows || []}
        isSuperAdmin={false}
        onSaved={fetchExpensesData}
      />

    </div>
  );
}
