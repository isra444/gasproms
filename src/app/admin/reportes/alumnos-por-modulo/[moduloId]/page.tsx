// app/admin/reportes/alumnos-por-modulo/[moduloId]/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import ReportToolbar from "src/components/ReportToolbar";
import Link from "next/link";

type Row = {
  modulo_id: string;
  modulo_nombre: string;
  alumno_id: string;
  alumno_nombre: string;
  alumno_correo: string;
  estado_inscripcion: string | null;
};

export default function AlumnosPorModulo({ params }: { params: { moduloId: string } }) {
  const { moduloId } = params;
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("vw_alumnos_por_modulo")
        .select("*")
        .eq("modulo_id", moduloId)
        .order("alumno_nombre", { ascending: true });

      if (cancelled) return;
      if (error) console.error(error);
      setRows((data as Row[]) ?? []);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [moduloId]);

  const heading = useMemo(() => {
    if (!rows.length) return "Alumnos inscritos";
    return `Alumnos inscritos — ${rows[0].modulo_nombre}`;
  }, [rows]);

  return (
    <div className="p-6 text-slate-100">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">{heading}</h1>
        <Link href="/admin/reportes" className="underline text-slate-300">Volver</Link>
      </div>

      <ReportToolbar fileName={`alumnos-modulo-${moduloId}`} getRows={() => rows} />

      {loading ? (
        <p>Cargando…</p>
      ) : rows.length === 0 ? (
        <p>No hay datos.</p>
      ) : (
        <div className="overflow-auto rounded-2xl border border-slate-700">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-800">
              <tr>
                <th className="px-3 py-2 text-left">Alumno</th>
                <th className="px-3 py-2 text-left">Correo</th>
                <th className="px-3 py-2 text-left">Estado inscripción</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.alumno_id} className="border-t border-slate-700">
                  <td className="px-3 py-2">{r.alumno_nombre}</td>
                  <td className="px-3 py-2">{r.alumno_correo}</td>
                  <td className="px-3 py-2">{r.estado_inscripcion ?? "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
