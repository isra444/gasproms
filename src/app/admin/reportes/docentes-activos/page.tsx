// app/admin/reportes/docentes-activos/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import ReportToolbar from "src/components/ReportToolbar";
import Link from "next/link";

type Row = {
  docente_id: string;
  docente_nombre: string;
  docente_correo: string;
  celular: string | null;
  estado_usuario: string | null;
  modulo_id: string | null;
  modulo_nombre: string | null;
  programa_nombre: string | null;
};

export default function DocentesActivos() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("vw_docentes_activos")
        .select("*")
        .order("docente_nombre", { ascending: true });

      if (cancelled) return;
      if (error) console.error(error);
      setRows((data as Row[]) ?? []);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const exportRows = useMemo(() => rows, [rows]);

  const porDocente = useMemo(() => {
    const map = new Map<string, { docente: Row; modulos: Row[] }>();
    rows.forEach((r) => {
      if (!map.has(r.docente_id)) map.set(r.docente_id, { docente: r, modulos: [] });
      if (r.modulo_id) map.get(r.docente_id)!.modulos.push(r);
    });
    return Array.from(map.values());
  }, [rows]);

  return (
    <div className="p-6 text-slate-100">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Docentes activos</h1>
        <Link href="/admin/reportes" className="underline text-slate-300">Volver</Link>
      </div>

      <ReportToolbar fileName="docentes-activos" getRows={() => exportRows} />

      {loading ? (
        <p>Cargando…</p>
      ) : rows.length === 0 ? (
        <p>No hay datos.</p>
      ) : (
        <div className="space-y-4">
          {porDocente.map(({ docente, modulos }) => (
            <div key={docente.docente_id} className="bg-slate-900 rounded-2xl p-4 border border-slate-700">
              <div className="flex flex-col gap-1">
                <div className="text-lg font-medium">{docente.docente_nombre}</div>
                <div className="text-slate-300">{docente.docente_correo}</div>
                <div className="text-slate-400 text-sm">Celular: {docente.celular ?? "-"}</div>
              </div>
              {modulos.length > 0 ? (
                <div className="overflow-auto mt-3">
                  <table className="min-w-full text-sm">
                    <thead className="bg-slate-800">
                      <tr>
                        <th className="px-3 py-2 text-left">Programa</th>
                        <th className="px-3 py-2 text-left">Módulo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {modulos.map((m) => (
                        <tr key={m.modulo_id!} className="border-t border-slate-700">
                          <td className="px-3 py-2">{m.programa_nombre ?? "-"}</td>
                          <td className="px-3 py-2">{m.modulo_nombre ?? "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-sm text-slate-400 mt-2">Sin módulos asignados.</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
