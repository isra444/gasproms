"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useUserStore } from "@/store/useUserStore";

type Row = { alumno: { id:string; nombre_completo:string; correo:string }, modulo: { id:string; nombre_asignatura:string } };

export default function AlumnosDocente() {
  const user = useUserStore((s) => s.user);
  const [rows, setRows] = useState<Row[]>([]);
  const [q, setQ] = useState("");

  useEffect(() => {
    if (!user?.id) return;
    (async () => {
      const { data } = await supabase
        .from("alumnos_modulos")
        .select(`
          alumno:alumno_id(id, nombre_completo, correo),
          modulo:modulo_id(id, nombre_asignatura, docente_id)
        `)
        .order("id");
      const mine = ((data as any) ?? []).filter((r: any) => r.modulo?.docente_id === user.id);
      setRows(mine);
    })();
  }, [user?.id]);

  const filtered = rows.filter(r =>
    r.alumno?.nombre_completo?.toLowerCase().includes(q.toLowerCase()) ||
    r.alumno?.correo?.toLowerCase().includes(q.toLowerCase()) ||
    r.modulo?.nombre_asignatura?.toLowerCase().includes(q.toLowerCase())
  );

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-xl font-semibold">Alumnos</h1>

      <input
        value={q}
        onChange={(e)=>setQ(e.target.value)}
        placeholder="Buscar por alumno, correo o módulo…"
        className="w-full md:w-2/3 px-3 py-2 rounded-lg bg-[var(--panel)] border border-[var(--muted)]"
      />

      <div className="overflow-x-auto rounded-2xl border border-[var(--muted)]">
        <table className="min-w-full text-sm">
          <thead className="bg-[var(--panel)]">
            <tr>
              <th className="text-left p-3">Alumno</th>
              <th className="text-left p-3">Correo</th>
              <th className="text-left p-3">Módulo</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r, i) => (
              <tr key={i} className="border-t border-[var(--muted)]">
                <td className="p-3">{r.alumno?.nombre_completo}</td>
                <td className="p-3">{r.alumno?.correo}</td>
                <td className="p-3">{r.modulo?.nombre_asignatura}</td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td className="p-3 text-[var(--text-muted)]" colSpan={3}>Sin resultados.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
