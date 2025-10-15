// app/components/ReportToolbar.tsx
"use client";

import { useCallback } from "react";

type Row = Record<string, unknown>;

type Props = {
  /** Nombre base para el archivo exportado, sin extensión */
  fileName: string;
  /** Debe devolver un array de objetos planos (cada obj = una fila) */
  getRows: () => Row[];
};

export default function ReportToolbar({ fileName, getRows }: Props) {
  const exportCSV = useCallback(() => {
    const rows = (getRows?.() ?? []) as Row[];
    if (rows.length === 0) return;

    // columnas únicas con tipado explícito
    const headers: string[] = [
      ...new Set<string>(
        rows.flatMap((r) => Object.keys(r ?? {}))
      ),
    ];

    const esc = (v: unknown) => {
      if (v === null || v === undefined) return "";
      const s = String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };

    const csv =
      headers.join(",") +
      "\n" +
      rows
        .map((r) => headers.map((h) => esc((r as Record<string, unknown>)[h])).join(","))
        .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${fileName}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [fileName, getRows]);

  const onPrint = useCallback(() => window.print(), []);

  return (
    <div className="flex items-center gap-2 my-3">
      <button
        onClick={exportCSV}
        className="px-3 py-2 rounded-xl bg-slate-700 text-white hover:bg-slate-600"
      >
        Exportar CSV
      </button>
      <button
        onClick={onPrint}
        className="px-3 py-2 rounded-xl bg-slate-700 text-white hover:bg-slate-600"
      >
        Imprimir
      </button>
    </div>
  );
}
