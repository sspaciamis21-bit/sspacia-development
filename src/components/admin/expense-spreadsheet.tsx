"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  Save,
  Plus,
  Trash2,
  Download,
  Search,
  Loader2,
  FileSpreadsheet,
  Edit2,
  X,
  Lock,
  Unlock,
  Check,
  Columns
} from "lucide-react";
import { toast } from "sonner";

export interface ColumnConfig {
  id: string;
  label: string;
  type?: "text" | "number" | "date";
  width?: string;
}

export interface RowData {
  id: string;
  [key: string]: any;
}

interface ExpenseSpreadsheetProps {
  locationId: number;
  locationName: string;
  initialColumns: ColumnConfig[];
  initialRows: RowData[];
  isSuperAdmin?: boolean;
  onSaved?: () => void;
}

export function ExpenseSpreadsheet({
  locationId,
  locationName,
  initialColumns,
  initialRows,
  isSuperAdmin = false,
  onSaved
}: ExpenseSpreadsheetProps) {
  const [columns, setColumns] = useState<ColumnConfig[]>(initialColumns);
  const [rows, setRows] = useState<RowData[]>([]);
  const [editingCell, setEditingCell] = useState<{ rowId: string; colId: string } | null>(null);
  const [cellValue, setCellValue] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [saving, setSaving] = useState<boolean>(false);
  const [hasChanges, setHasChanges] = useState<boolean>(false);

  // Column renaming state
  const [editingColId, setEditingColId] = useState<string | null>(null);
  const [colLabelInput, setColLabelInput] = useState<string>("");

  // Freeze Settings
  const [freezeHeader, setFreezeHeader] = useState<boolean>(true);
  const [freezeFirstCol, setFreezeFirstCol] = useState<boolean>(true);

  // Initialize and ensure 100 rows exist out of the box
  useEffect(() => {
    setColumns(initialColumns.length > 0 ? initialColumns : [
      { id: 'col_1', label: 'Date', width: '140px' },
      { id: 'col_2', label: 'Expense Category / Item', width: '220px' },
      { id: 'col_3', label: 'Vendor / Paid To', width: '180px' },
      { id: 'col_4', label: 'Amount (₹)', width: '140px' },
      { id: 'col_5', label: 'Payment Mode', width: '140px' },
      { id: 'col_6', label: 'Receipt / Ref #', width: '140px' },
      { id: 'col_7', label: 'Remarks / Notes', width: '240px' },
    ]);

    let paddedRows = [...initialRows];
    if (paddedRows.length < 100) {
      const needed = 100 - paddedRows.length;
      const startIndex = paddedRows.length + 1;
      for (let i = 0; i < needed; i++) {
        const rowNum = startIndex + i;
        paddedRows.push({
          id: `row_${rowNum}`,
        });
      }
    }
    setRows(paddedRows);
    setHasChanges(false);
  }, [locationId, initialColumns, initialRows]);

  // Filter rows based on search query
  const filteredRows = useMemo(() => {
    if (!searchQuery.trim()) return rows;
    const query = searchQuery.toLowerCase();
    return rows.filter((row) =>
      Object.values(row).some((val) =>
        String(val || "").toLowerCase().includes(query)
      )
    );
  }, [rows, searchQuery]);

  // Calculate live sum total for numeric amount cells
  const totalAmount = useMemo(() => {
    return rows.reduce((sum, row) => {
      const amountKey = Object.keys(row).find(k => k.toLowerCase().includes('amount') || k === 'col_4') || 'col_4';
      const val = parseFloat(row[amountKey]);
      return sum + (isNaN(val) ? 0 : val);
    }, 0);
  }, [rows]);

  // Cell editing handlers
  const handleCellClick = (rowId: string, colId: string, currentValue: any) => {
    setEditingCell({ rowId, colId });
    setCellValue(currentValue !== undefined && currentValue !== null ? String(currentValue) : "");
  };

  const handleCellSave = () => {
    if (!editingCell) return;
    const { rowId, colId } = editingCell;

    setRows((prevRows) =>
      prevRows.map((r) => {
        if (r.id === rowId) {
          return { ...r, [colId]: cellValue };
        }
        return r;
      })
    );

    setEditingCell(null);
    setHasChanges(true);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleCellSave();
    } else if (e.key === "Escape") {
      setEditingCell(null);
    }
  };

  // Column Management: Add Column
  const handleAddColumn = () => {
    const newColNum = columns.length + 1;
    const newColId = `col_${Date.now()}`;
    const newColLabel = `Column ${newColNum}`;
    const newCol: ColumnConfig = {
      id: newColId,
      label: newColLabel,
      width: "160px"
    };

    setColumns([...columns, newCol]);
    setHasChanges(true);
    toast.success(`Added new column: ${newColLabel}`);
  };

  // Column Management: Rename Column
  const handleStartRenameCol = (colId: string, currentLabel: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingColId(colId);
    setColLabelInput(currentLabel);
  };

  const handleSaveRenameCol = (colId: string) => {
    if (!colLabelInput.trim()) {
      setEditingColId(null);
      return;
    }
    setColumns((prev) =>
      prev.map((c) => (c.id === colId ? { ...c, label: colLabelInput.trim() } : c))
    );
    setEditingColId(null);
    setHasChanges(true);
    toast.success("Column header updated!");
  };

  // Column Management: Delete Column
  const handleDeleteColumn = (colId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (columns.length <= 1) {
      toast.error("Spreadsheet must have at least 1 column!");
      return;
    }
    setColumns((prev) => prev.filter((c) => c.id !== colId));
    setHasChanges(true);
    toast.info("Column removed.");
  };

  // Row Management
  const handleAddRow = () => {
    const newRowId = `row_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
    const newRow: RowData = { id: newRowId };
    setRows([newRow, ...rows]);
    setHasChanges(true);
    toast.success("New row added!");
  };

  const handleDeleteRow = (rowId: string) => {
    setRows((prev) => prev.filter((r) => r.id !== rowId));
    setHasChanges(true);
    toast.info("Row deleted.");
  };

  const handleSaveSheet = async () => {
    try {
      setSaving(true);
      const res = await fetch(`/api/admin/expenses/${locationId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: `${locationName} Expense Sheet`,
          columns,
          rows
        })
      });

      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.error || "Failed to save expense sheet");
      }

      toast.success(`${locationName} Expense Sheet saved successfully!`);
      setHasChanges(false);
      if (onSaved) onSaved();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to save sheet");
    } finally {
      setSaving(false);
    }
  };

  const handleExportCSV = () => {
    if (rows.length === 0) {
      toast.error("No data to export!");
      return;
    }

    const headers = columns.map((c) => `"${c.label}"`);
    const csvRows = rows.map((row) =>
      columns.map((c) => `"${String(row[c.id] || "").replace(/"/g, '""')}"`).join(",")
    );

    const csvContent = [headers.join(","), ...csvRows].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute(
      "download",
      `SSPACIA_${locationName.replace(/\s+/g, "_")}_Expenses_${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Expense spreadsheet exported to CSV!");
  };

  return (
    <div className="bg-white border border-gray-200 shadow-sm flex flex-col overflow-hidden font-sans">
      
      {/* ── TOOLBAR BAR (EXCEL STYLE) ── */}
      <div className="bg-gray-50 border-b border-gray-200 px-5 py-3 flex flex-col md:flex-row md:items-center justify-between gap-4">
        
        {/* TITLE & UNSAVED INDICATOR */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-teal-50 border border-teal-200 text-[#1ab0bc] flex items-center justify-center font-bold">
            <FileSpreadsheet className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-display font-black text-base md:text-lg text-gray-900 uppercase tracking-tight flex items-center gap-2">
              <span>{locationName} Expense Sheet</span>
              {hasChanges && (
                <span className="bg-amber-100 text-amber-800 text-[10px] font-mono px-2 py-0.5 uppercase tracking-widest border border-amber-300">
                  Unsaved Edits
                </span>
              )}
            </h2>
          </div>
        </div>

        {/* TOOLBAR BUTTONS */}
        <div className="flex flex-wrap items-center gap-2">
          
          {/* SEARCH INPUT */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search spreadsheet..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 pr-3 py-1.5 bg-white border border-gray-300 text-xs text-gray-800 outline-none focus:border-[#1ab0bc] w-40 md:w-52 font-mono"
            />
          </div>

          {/* FREEZE CONTROLS */}
          <button
            onClick={() => setFreezeHeader(!freezeHeader)}
            className={`px-2.5 py-1.5 text-xs font-bold border transition-all flex items-center gap-1 cursor-pointer ${
              freezeHeader
                ? "bg-teal-50 text-[#1ab0bc] border-teal-300"
                : "bg-white text-gray-600 border-gray-300 hover:bg-gray-100"
            }`}
            title="Toggle Freeze Header Row"
          >
            {freezeHeader ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
            <span className="text-[11px]">Freeze Row</span>
          </button>

          <button
            onClick={() => setFreezeFirstCol(!freezeFirstCol)}
            className={`px-2.5 py-1.5 text-xs font-bold border transition-all flex items-center gap-1 cursor-pointer ${
              freezeFirstCol
                ? "bg-teal-50 text-[#1ab0bc] border-teal-300"
                : "bg-white text-gray-600 border-gray-300 hover:bg-gray-100"
            }`}
            title="Toggle Freeze Column #"
          >
            {freezeFirstCol ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
            <span className="text-[11px]">Freeze Col #</span>
          </button>

          {/* ADD COLUMN BUTTON */}
          <button
            onClick={handleAddColumn}
            className="bg-white hover:bg-gray-100 text-gray-800 px-3 py-1.5 text-xs font-bold uppercase tracking-wider border border-gray-300 flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <Columns className="w-4 h-4 text-[#1ab0bc]" />
            <span>+ Add Column</span>
          </button>

          {/* ADD ROW BUTTON */}
          <button
            onClick={handleAddRow}
            className="bg-white hover:bg-gray-100 text-gray-800 px-3 py-1.5 text-xs font-bold uppercase tracking-wider border border-gray-300 flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4 text-[#1ab0bc]" />
            <span>Add Row</span>
          </button>

          {/* EXPORT CSV */}
          <button
            onClick={handleExportCSV}
            className="bg-white hover:bg-gray-100 text-gray-800 px-3 py-1.5 text-xs font-bold uppercase tracking-wider border border-gray-300 flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <Download className="w-4 h-4 text-emerald-600" />
            <span>Export CSV</span>
          </button>

          {/* SAVE SHEET BUTTON */}
          <button
            onClick={handleSaveSheet}
            disabled={saving}
            className={`px-4 py-1.5 text-xs font-black uppercase tracking-wider flex items-center gap-2 transition-all shadow-sm cursor-pointer ${
              hasChanges
                ? "bg-[#1ab0bc] hover:bg-teal-600 text-white border border-teal-500 scale-105"
                : "bg-gray-800 hover:bg-black text-white"
            }`}
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            <span>{saving ? "Saving..." : "Save Sheet"}</span>
          </button>

        </div>
      </div>

      {/* ── SPREADSHEET CANVAS ── */}
      <div className="overflow-x-auto overflow-y-auto max-h-[680px] relative border-b border-gray-200 scrollbar-thin">
        <table className="w-full text-left border-collapse text-xs font-mono select-none">
          
          {/* HEADER ROW */}
          <thead className={`bg-gray-100 text-gray-700 font-bold uppercase tracking-wider ${freezeHeader ? "sticky top-0 z-20 shadow-xs" : ""}`}>
            <tr className="border-b border-gray-300">
              
              {/* INDEX COLUMN # */}
              <th className={`border-r border-gray-300 px-3 py-2.5 text-center w-12 text-[10px] text-gray-500 ${freezeFirstCol ? "sticky left-0 z-30 bg-gray-200" : "bg-gray-200"}`}>
                #
              </th>

              {/* DYNAMIC EDITABLE COLUMNS */}
              {columns.map((col) => {
                const isRenaming = editingColId === col.id;

                return (
                  <th
                    key={col.id}
                    style={{ width: col.width || "160px", minWidth: "130px" }}
                    className="px-3 py-2 border-r border-gray-300 bg-gray-100 text-gray-800 text-[11px] group relative"
                  >
                    {isRenaming ? (
                      <div className="flex items-center gap-1">
                        <input
                          autoFocus
                          type="text"
                          value={colLabelInput}
                          onChange={(e) => setColLabelInput(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && handleSaveRenameCol(col.id)}
                          className="w-full bg-white border border-[#1ab0bc] px-1 py-0.5 text-xs text-gray-900 outline-none font-bold"
                        />
                        <button
                          onClick={() => handleSaveRenameCol(col.id)}
                          className="p-1 text-emerald-600 hover:bg-emerald-50 cursor-pointer"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between gap-1">
                        <span
                          onDoubleClick={(e) => handleStartRenameCol(col.id, col.label, e)}
                          className="cursor-pointer hover:underline truncate"
                          title="Double-click to rename header"
                        >
                          {col.label}
                        </span>
                        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={(e) => handleStartRenameCol(col.id, col.label, e)}
                            className="p-0.5 hover:bg-gray-200 text-gray-500 rounded cursor-pointer"
                            title="Rename Column"
                          >
                            <Edit2 className="w-3 h-3" />
                          </button>
                          <button
                            onClick={(e) => handleDeleteColumn(col.id, e)}
                            className="p-0.5 hover:bg-red-100 text-red-500 rounded cursor-pointer"
                            title="Delete Column"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    )}
                  </th>
                );
              })}

              <th className="px-2 py-2 text-center w-16 border-r border-gray-300">
                Action
              </th>
            </tr>
          </thead>

          {/* SPREADSHEET BODY ROWS (100 PRE-BUILT ROWS) */}
          <tbody className="divide-y divide-gray-200 bg-white">
            {filteredRows.map((row, idx) => (
              <tr
                key={row.id}
                className="hover:bg-teal-50/40 transition-colors group border-b border-gray-200"
              >
                {/* ROW INDEX COLUMN */}
                <td className={`border-r border-gray-300 px-2 py-2 text-center text-gray-400 font-bold text-[10px] ${freezeFirstCol ? "sticky left-0 z-10 bg-gray-50" : "bg-gray-50"}`}>
                  {idx + 1}
                </td>

                {/* CELLS */}
                {columns.map((col) => {
                  const isEditing = editingCell?.rowId === row.id && editingCell?.colId === col.id;
                  const val = row[col.id];

                  return (
                    <td
                      key={col.id}
                      onClick={() => handleCellClick(row.id, col.id, val)}
                      className={`px-3 py-2 border-r border-gray-200 cursor-pointer relative transition-all min-h-[28px] ${
                        isEditing
                          ? "bg-amber-50 ring-2 ring-[#1ab0bc] z-10"
                          : "hover:bg-teal-50/60"
                      }`}
                    >
                      {isEditing ? (
                        <input
                          autoFocus
                          type="text"
                          value={cellValue}
                          onChange={(e) => setCellValue(e.target.value)}
                          onBlur={handleCellSave}
                          onKeyDown={handleKeyDown}
                          className="w-full bg-white border border-[#1ab0bc] px-1.5 py-0.5 text-xs text-gray-900 outline-none font-mono"
                        />
                      ) : (
                        <div className="flex items-center justify-between min-h-[20px]">
                          <span className="text-gray-900 truncate max-w-[240px] block">
                            {val !== "" && val !== undefined && val !== null ? String(val) : ""}
                          </span>
                        </div>
                      )}
                    </td>
                  );
                })}

                {/* ROW ACTIONS */}
                <td className="px-1 py-1.5 text-center border-r border-gray-200 whitespace-nowrap">
                  <button
                    onClick={() => handleDeleteRow(row.id)}
                    className="p-1 hover:bg-red-100 text-red-500 rounded-xs transition-colors opacity-40 group-hover:opacity-100 cursor-pointer"
                    title="Delete Row"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── BOTTOM SUMMARY BAR ── */}
      <div className="bg-gray-50 border-t border-gray-200 px-6 py-3 flex flex-col sm:flex-row items-center justify-between gap-4 font-mono text-xs text-gray-700">
        <div className="flex items-center gap-6">
          <div>
            <span className="text-gray-500 uppercase tracking-widest text-[10px] block">Pre-Built Grid Rows:</span>
            <span className="font-bold text-gray-900 text-sm">{rows.length} Rows</span>
          </div>
          <div className="h-6 w-px bg-gray-300" />
          <div>
            <span className="text-gray-500 uppercase tracking-widest text-[10px] block">Total Amount Sum:</span>
            <span className="font-black text-base text-emerald-600">
              ₹{totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </span>
          </div>
        </div>

        <div className="text-right text-[10px] text-gray-500">
          <span>Click any cell to edit • Double-click header to rename • Click "+ Add Column" to add columns</span>
        </div>
      </div>

    </div>
  );
}
