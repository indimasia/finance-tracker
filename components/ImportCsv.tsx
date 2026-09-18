"use client";

import { useRef, useState } from "react";
import Papa from "papaparse";
import { Download, Upload, X } from "lucide-react";
import { fmtCurrency } from "@/lib/format";
import { apiFetch } from "@/lib/apiFetch";
import { parseImportRow, type ParsedRow } from "@/lib/importCsv";

const TEMPLATE_CSV = `date,description,category,amount,type,account
2026-09-01,Grocery shopping,Food,150000,expense,Cash
2026-09-05,Monthly salary,Salary,15000000,income,Bank
`;

function downloadTemplate() {
  const blob = new Blob([TEMPLATE_CSV], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "transactions-template.csv";
  a.click();
  URL.revokeObjectURL(url);
}

export default function ImportCsv({
  onImported,
  defaultAccount,
}: {
  onImported: () => void;
  defaultAccount: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [checked, setChecked] = useState<boolean[]>([]);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  function handleFile(file: File) {
    setResult(null);
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (res) => {
        const parsed = res.data.map(parseImportRow);
        setRows(parsed);
        setChecked(parsed.map((r) => r.ok));
        setOpen(true);
      },
    });
  }

  function reset() {
    setRows([]);
    setChecked([]);
    setResult(null);
    setOpen(false);
    if (inputRef.current) inputRef.current.value = "";
  }

  async function confirmImport() {
    const selected = rows
      .map((r, i) => (checked[i] && r.ok ? r.row : null))
      .filter((r): r is NonNullable<typeof r> => r !== null);
    if (selected.length === 0) return;
    setImporting(true);
    const res = await apiFetch("/api/transactions/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ transactions: selected }),
    });
    const data = await res.json();
    setImporting(false);
    if (!res.ok) {
      setResult(data.error || "Import failed");
      return;
    }
    setResult(`Imported ${data.inserted} transaction${data.inserted === 1 ? "" : "s"}.`);
    onImported();
  }

  const validCount = checked.filter(Boolean).length;

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
        }}
      />
      <button
        onClick={() => inputRef.current?.click()}
        className="w-full flex items-center gap-2 rounded-md px-3 py-2.5 text-sm hover:bg-slate-100 dark:hover:bg-slate-800"
      >
        <Upload size={16} />
        Import CSV
      </button>
      <button
        onClick={downloadTemplate}
        className="w-full flex items-center gap-2 rounded-md px-3 py-2.5 text-sm text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
      >
        <Download size={16} />
        Download template
      </button>

      {open && (
        <div className="fixed inset-0 z-30 flex items-start justify-center bg-black/30 p-4 pt-10">
          <div className="w-full max-w-2xl rounded-xl bg-white dark:bg-slate-900 shadow-lg p-4 space-y-3 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between shrink-0">
              <h2 className="text-sm font-semibold">
                Preview import — {validCount} of {rows.length} row{rows.length === 1 ? "" : "s"} ready
              </h2>
              <button
                onClick={reset}
                className="inline-flex items-center justify-center w-9 h-9 rounded-full text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            <p className="text-xs text-slate-500 shrink-0">
              Expected columns: date, description, category, amount, type (optional — inferred from
              amount sign if missing), account (optional — blank rows use the workspace default
              account, currently {defaultAccount}). Nothing is saved until you confirm.{" "}
              <button onClick={downloadTemplate} className="underline hover:text-slate-700 dark:hover:text-slate-300">
                Download template
              </button>
              .
            </p>

            <div className="overflow-auto flex-1 border border-slate-200 dark:border-slate-800 rounded-lg">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800 sticky top-0">
                  <tr>
                    <th className="p-2 text-left w-8"></th>
                    <th className="p-2 text-left">Date</th>
                    <th className="p-2 text-left">Description</th>
                    <th className="p-2 text-left">Category</th>
                    <th className="p-2 text-right">Amount</th>
                    <th className="p-2 text-left">Type</th>
                    <th className="p-2 text-left">Account</th>
                    <th className="p-2 text-left">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr
                      key={i}
                      className={
                        "border-t border-slate-100 dark:border-slate-800 " +
                        (!r.ok ? "opacity-50" : "")
                      }
                    >
                      <td className="p-2">
                        <input
                          type="checkbox"
                          checked={checked[i]}
                          disabled={!r.ok}
                          onChange={(e) =>
                            setChecked((prev) => prev.map((c, j) => (j === i ? e.target.checked : c)))
                          }
                        />
                      </td>
                      {r.ok ? (
                        <>
                          <td className="p-2 tabular-nums">{r.row.date}</td>
                          <td className="p-2 truncate max-w-[10rem]">{r.row.description}</td>
                          <td className="p-2">{r.row.category}</td>
                          <td className="p-2 text-right tabular-nums">{fmtCurrency(r.row.amount)}</td>
                          <td className="p-2 capitalize">{r.row.type}</td>
                          <td className="p-2">{r.row.account || `${defaultAccount} (default)`}</td>
                          <td className="p-2 text-emerald-600">OK</td>
                        </>
                      ) : (
                        <td className="p-2 text-rose-600" colSpan={7}>
                          {r.error}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {result && <p className="text-sm text-emerald-600 shrink-0">{result}</p>}

            <div className="flex justify-end gap-2 shrink-0">
              <button
                onClick={reset}
                className="px-4 py-2 text-sm rounded-md text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                onClick={confirmImport}
                disabled={importing || validCount === 0}
                className="px-4 py-2 text-sm rounded-md bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 disabled:opacity-50"
              >
                {importing ? "Importing…" : `Import ${validCount} transaction${validCount === 1 ? "" : "s"}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
