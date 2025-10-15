// src/app/docente/notas/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useUserStore } from "@/store/useUserStore";

type OpcionModulo = { id: string; nombre_asignatura: string };
type Alumno = { id: string; nombre_completo: string; correo: string };

type Row = {
  alumno_modulo_id: string;
  alumno: Alumno;

  asistencia: number | null;
  teoria: number | null;
  practica: number | null;
  examen_final: number | null;

  nota_final: number | null;   // si existía en BD
  literal: string | null;      // si existía en BD
  observacion: string | null;  // si existía en BD

  revalida?: string | null;    // solo UI (concat al guardar si Reprobado)
  editing?: boolean;           // modo edición por fila
};

// -------- Utilidades --------
function clamp01(x: number) {
  if (Number.isNaN(x)) return 0;
  return Math.max(0, Math.min(100, x));
}

// Ponderación: Asistencia 40%, Teoría 20%, Práctica 20%, Examen 20% (redondeo a entero)
function calcFinal(a?: number | null, t?: number | null, p?: number | null, e?: number | null) {
  const A = clamp01(a ?? 0), T = clamp01(t ?? 0), P = clamp01(p ?? 0), E = clamp01(e ?? 0);
  return Math.round(A * 0.40 + T * 0.20 + P * 0.20 + E * 0.20);
}

// 0..100 a palabras
function numeroALetras0a100(n: number): string {
  const u = [
    "Cero","Uno","Dos","Tres","Cuatro","Cinco","Seis","Siete","Ocho","Nueve",
    "Diez","Once","Doce","Trece","Catorce","Quince","Dieciséis","Diecisiete","Dieciocho","Diecinueve"
  ];
  const d = ["","Diez","Veinte","Treinta","Cuarenta","Cincuenta","Sesenta","Setenta","Ochenta","Noventa"];
  if (n < 0) n = 0;
  if (n <= 19) return u[n];
  if (n === 20) return "Veinte";
  if (n < 30) return "Veinti" + u[n - 20].toLowerCase();
  if (n % 10 === 0) return d[Math.floor(n / 10)];
  const D = Math.floor(n / 10), R = n % 10;
  return `${d[D]} y ${u[R].toLowerCase()}`;
}

function estadoAprobacion(nf: number | null | undefined) {
  if (nf == null) return "";
  return nf >= 71 ? "Aprobado" : "Reprobado";
}

// -------- Página --------
export default function SubirNotas() {
  const user = useUserStore((s) => s.user);
  const [modulos, setModulos] = useState<OpcionModulo[]>([]);
  const [moduloId, setModuloId] = useState<string>("");
  const [rows, setRows] = useState<Row[]>([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);

  // Módulos del docente
  useEffect(() => {
    if (!user?.id) return;
    (async () => {
      const { data, error } = await supabase
        .from("modulos")
        .select("id, nombre_asignatura")
        .eq("docente_id", user.id)
        .order("nombre_asignatura");
      if (error) console.error(error);
      const list = (data as any) ?? [];
      setModulos(list);
      if (list.length && !moduloId) setModuloId(list[0].id);
    })();
  }, [user?.id]);

  // Cargar alumnos + notas (sin depender de relación inversa)
  useEffect(() => {
    if (!moduloId) return;
    (async () => {
      setLoading(true);
      // 1) alumnos_modulos + alumno
      const { data: am, error: e1 } = await supabase
        .from("alumnos_modulos")
        .select(`id, alumno:alumno_id(id, nombre_completo, correo)`)
        .eq("modulo_id", moduloId)
        .order("id");
      if (e1) console.error(e1);

      // Tipar explícitamente la base para evitar 'any'
      type AMBase = { alumno_modulo_id: string; alumno: Alumno };
      const base: AMBase[] = (((am as any) ?? []) as any[]).map(
        (r: any): AMBase => ({
          alumno_modulo_id: r.id as string,
          alumno: r.alumno as Alumno,
        })
      );

      // 2) notas por esos alumno_modulo_id
      const ids: string[] = base.map((b: AMBase) => b.alumno_modulo_id);
      let notasMap = new Map<string, any>();
      if (ids.length) {
        const { data: ns, error: e2 } = await supabase
          .from("notas")
          .select("*")
          .in("alumno_modulo_id", ids);
        if (e2) console.error(e2);
        (ns ?? []).forEach((n: any) => notasMap.set(n.alumno_modulo_id, n));
      }

      // 3) Mezclar y decidir modo (lectura si ya tiene nota; edición si no)
      const merged: Row[] = base.map((b) => {
        const n = notasMap.get(b.alumno_modulo_id) || {};
        let revalida: string | null = null;
        let obs: string | null = n.observacion ?? null;
        if (obs && obs.includes("Revalida:")) {
          const part = obs.split("Revalida:")[1];
          revalida = part?.trim() || null;
          obs = obs.split("|")[0]?.trim() || obs;
        }
        const hasNotas =
          [n.asistencia, n.teoria, n.practica, n.examen_final, n.nota_final].some((x: any) => x != null) ||
          typeof n.literal === "string" ||
          typeof n.observacion === "string";

        return {
          alumno_modulo_id: b.alumno_modulo_id,
          alumno: b.alumno,
          asistencia: n.asistencia ?? null,
          teoria: n.teoria ?? null,
          practica: n.practica ?? null,
          examen_final: n.examen_final ?? null,
          nota_final: n.nota_final ?? null,
          literal: n.literal ?? null,
          observacion: obs,
          revalida,
          editing: !hasNotas,
        };
      });

      setRows(merged);
      setLoading(false);
    })();
  }, [moduloId]);

  // Derivados por fila
  const withComputed = useMemo(
    () =>
      rows.map((r) => {
        const nf = calcFinal(r.asistencia, r.teoria, r.practica, r.examen_final);
        const lit = numeroALetras0a100(nf);
        const estado = estadoAprobacion(nf);
        return { ...r, _nf: nf, _lit: lit, _estado: estado };
      }),
    [rows]
  );

  function setCell(i: number, key: keyof Row, val: any) {
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, [key]: val } : r)));
  }

  async function saveRow(r: Row & { _nf: number; _lit: string; _estado: string }) {
    setSaving(true);
    try {
      const obs =
        r._estado === "Reprobado"
          ? (r.revalida ? `Reprobado | Revalida: ${r.revalida}` : "Reprobado")
          : "Aprobado";

      const payload = {
        alumno_modulo_id: r.alumno_modulo_id,
        asistencia: r.asistencia,
        teoria: r.teoria,
        practica: r.practica,
        examen_final: r.examen_final,
        nota_final: r._nf,
        literal: r._lit,
        observacion: obs,
      };

      const { error } = await supabase.from("notas").upsert(payload, { onConflict: "alumno_modulo_id" });
      if (error) {
        console.error(error);
        alert("Error guardando notas: " + error.message);
        return;
      }
      setRows((prev) =>
        prev.map((x) => (x.alumno_modulo_id === r.alumno_modulo_id ? { ...x, editing: false } : x))
      );
    } finally {
      setSaving(false);
    }
  }

  async function saveAll() {
    setSaving(true);
    try {
      const batch = withComputed.map((r) => {
        const obs =
          r._estado === "Reprobado"
            ? (r.revalida ? `Reprobado | Revalida: ${r.revalida}` : "Reprobado")
            : "Aprobado";
        return {
          alumno_modulo_id: r.alumno_modulo_id,
          asistencia: r.asistencia,
          teoria: r.teoria,
          practica: r.practica,
          examen_final: r.examen_final,
          nota_final: r._nf,
          literal: r._lit,
          observacion: obs,
        };
      });
      if (batch.length) {
        const { error } = await supabase.from("notas").upsert(batch, { onConflict: "alumno_modulo_id" });
        if (error) {
          console.error(error);
          alert("Error guardando notas: " + error.message);
          return;
        }
      }
      setRows((prev) => prev.map((x) => ({ ...x, editing: false })));
      alert("Notas guardadas.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-xl font-semibold">Subir notas</h1>

      <div className="flex gap-2 items-center">
        <span className="text-sm text-[var(--text-muted)]">Módulo:</span>
        <select
          value={moduloId}
          onChange={(e) => setModuloId(e.target.value)}
          className="px-3 py-2 rounded-lg bg-[var(--panel)] border border-[var(--muted)]"
        >
          {modulos.map((m) => (
            <option key={m.id} value={m.id}>
              {m.nombre_asignatura}
            </option>
          ))}
        </select>

        <button
          onClick={saveAll}
          disabled={saving || loading}
          className="ml-auto px-4 py-2 rounded-xl bg-[var(--success)] text-white disabled:opacity-60"
        >
          {saving ? "Guardando…" : "Guardar todo"}
        </button>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-[var(--muted)]">
        <table className="min-w-full text-xs">
          <thead className="bg-[var(--panel)]">
            <tr>
              <th className="p-2 text-left">Alumno</th>
              <th className="p-2">Asist. (40%)</th>
              <th className="p-2">Teoría (20%)</th>
              <th className="p-2">Práctica (20%)</th>
              <th className="p-2">Examen (20%)</th>
              <th className="p-2">Final</th>
              <th className="p-2">Literal</th>
              <th className="p-2">Estado</th>
              <th className="p-2">Revalida</th>
              <th className="p-2">Acción</th>
            </tr>
          </thead>
          <tbody>
            {withComputed.map((r, i) => (
              <tr key={r.alumno_modulo_id} className="border-t border-[var(--muted)]">
                <td className="p-2 text-left">{r.alumno.nombre_completo}</td>

                {(["asistencia", "teoria", "practica", "examen_final"] as const).map((k) => (
                  <td key={k} className="p-2">
                    {r.editing ? (
                      <input
                        type="number"
                        min={0}
                        max={100}
                        step="1"
                        value={(r as any)[k] ?? ""}
                        onChange={(e) => {
                          const v = e.target.value === "" ? null : Number(e.target.value);
                          setCell(i, k, v);
                        }}
                        className="w-24 px-2 py-1 rounded bg-[var(--panel)] border border-[var(--muted)] text-right"
                      />
                    ) : (
                      <div className="text-center">{(r as any)[k] ?? "—"}</div>
                    )}
                  </td>
                ))}

                <td className="p-2 text-center font-semibold">{r._nf}</td>
                <td className="p-2 text-center">{r._lit}</td>

                <td className="p-2 text-center">
                  <span
                    className={`px-2 py-1 rounded text-[10px] ${
                      r._estado === "Aprobado" ? "bg-[var(--success)] text-white" : "bg-[var(--danger)] text-white"
                    }`}
                  >
                    {r._estado}
                  </span>
                </td>

                <td className="p-2">
                  {r._estado === "Reprobado" ? (
                    r.editing ? (
                      <input
                        value={r.revalida ?? ""}
                        onChange={(e) => setCell(i, "revalida", e.target.value)}
                        className="w-40 px-2 py-1 rounded bg-[var(--panel)] border border-[var(--muted)]"
                        placeholder="Fecha / detalle"
                      />
                    ) : (
                      <span>{r.revalida ?? "—"}</span>
                    )
                  ) : (
                    <span className="text-[var(--text-muted)]">—</span>
                  )}
                </td>

                <td className="p-2">
                  {r.editing ? (
                    <button
                      onClick={() => saveRow(r as any)}
                      disabled={saving}
                      className="px-3 py-1 rounded-lg bg-[var(--primary)] text-white disabled:opacity-60"
                    >
                      Guardar
                    </button>
                  ) : (
                    <button
                      onClick={() => setCell(i, "editing", true)}
                      className="px-3 py-1 rounded-lg bg-[var(--panel)] border border-[var(--muted)]"
                    >
                      Editar
                    </button>
                  )}
                </td>
              </tr>
            ))}

            {(!withComputed.length || loading) && (
              <tr>
                <td className="p-3 text-[var(--text-muted)]" colSpan={10}>
                  {loading ? "Cargando…" : "Sin alumnos en este módulo."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="text-[11px] text-[var(--text-muted)]">
        * La nota final se calcula automáticamente (Asist. 40%, Teoría 20%, Práctica 20%, Examen 20%) y se redondea al entero. Aprobación desde 71 puntos.
      </p>
    </div>
  );
}
