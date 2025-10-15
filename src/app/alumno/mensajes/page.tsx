"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useUserStore } from "@/store/useUserStore";

type MensajeRow = {
  id: string;
  modulo_id: string;
  docente_id: string | null;
  contenido: string;
  fecha?: string | null;        // si tu tabla la usa
  created_at?: string | null;   // fallback típico
};

type Docente = { id: string; nombre_completo: string; correo: string };

type MensajeUI = MensajeRow & {
  docente?: Pick<Docente, "nombre_completo" | "correo"> | null;
};

type ModItem = { id: string; nombre_asignatura: string };

export default function AlumnoMensajes() {
  const user = useUserStore((s) => s.user);

  const [modulos, setModulos] = useState<ModItem[]>([]);
  const [moduloId, setModuloId] = useState<string>("");
  const [mensajes, setMensajes] = useState<MensajeUI[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);

  // Cargar módulos del alumno
  useEffect(() => {
    if (!user?.id) return;
    (async () => {
      setLoading(true);
      setErrorText(null);

      const { data, error } = await supabase
        .from("alumnos_modulos")
        .select("modulo:modulo_id(id, nombre_asignatura)")
        .eq("alumno_id", user.id);

      if (error) {
        console.error("alumnos_modulos error:", error);
        setErrorText(error.message ?? "No se pudieron cargar tus módulos.");
      } else {
        const list: ModItem[] = ((data as any) ?? []).map((r: any) => r.modulo);
        setModulos(list);
        if (list.length && !moduloId) setModuloId(list[0].id);
      }

      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // Cargar mensajes del módulo (2 pasos: mensajes -> docentes)
  useEffect(() => {
    if (!moduloId) return;
    (async () => {
      setLoadingMsgs(true);
      setErrorText(null);

      // 1) Selección segura sin joins ni order por columnas inciertas
      let msgs: any[] | null = null;
      let errText: string | null = null;

      const { data: d1, error: e1 } = await supabase
        .from("mensajes_modulo")
        .select("id, modulo_id, docente_id, contenido, fecha, created_at")
        .eq("modulo_id", moduloId);

      if (!e1) {
        msgs = d1 ?? [];
      } else {
        console.warn("mensajes_modulo select1 error:", e1);
        const { data: d2, error: e2 } = await supabase
          .from("mensajes_modulo")
          .select("*")
          .eq("modulo_id", moduloId);

        if (!e2) {
          msgs = d2 ?? [];
        } else {
          console.error("mensajes_modulo select2 error:", e2);
          errText = e2.message ?? "No se pudieron cargar los mensajes.";
        }
      }

      if (!msgs) {
        setErrorText(errText ?? "No se pudieron cargar los mensajes.");
        setMensajes([]);
        setLoadingMsgs(false);
        return;
      }

      // 2) Traer docentes por IN(...)
      const docenteIds = Array.from(
        new Set(msgs.map((m: any) => m.docente_id).filter((v: any): v is string => !!v))
      );

      const docentesMap = new Map<string, { nombre_completo: string; correo: string }>();
      if (docenteIds.length) {
        const { data: docentes, error: eUsers } = await supabase
          .from("usuarios")
          .select("id, nombre_completo, correo")
          .in("id", docenteIds);

        if (eUsers) {
          console.warn("usuarios error:", eUsers);
        } else {
          (docentes ?? []).forEach((u: any) =>
            docentesMap.set(u.id, { nombre_completo: u.nombre_completo, correo: u.correo })
          );
        }
      }

      // Orden local por fecha || created_at (desc)
      const pickDate = (m: any) => m.fecha ?? m.created_at ?? null;
      msgs.sort((a: any, b: any) => {
        const da = pickDate(a);
        const db = pickDate(b);
        return (db ? +new Date(db) : 0) - (da ? +new Date(da) : 0);
      });

      const withDocente: MensajeUI[] = msgs.map((m: any) => ({
        ...m,
        docente: m.docente_id ? docentesMap.get(m.docente_id) ?? null : null,
      }));

      setMensajes(withDocente);
      setLoadingMsgs(false);
    })();
  }, [moduloId]);

  const formatWhen = (m: MensajeRow) => {
    const iso = m.fecha ?? m.created_at;
    if (!iso) return "—";
    try {
      return new Date(iso).toLocaleString();
    } catch {
      return String(iso);
    }
  };

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Mensajes del docente</h1>

      <div className="flex items-center gap-3">
        <span className="text-sm text-[var(--text-muted)]">Módulo:</span>
        <select
          value={moduloId}
          onChange={(e) => setModuloId(e.target.value)}
          className="px-3 py-2 rounded-lg bg-[var(--panel)] border border-[var(--muted)]"
          disabled={loading || !modulos.length}
        >
          {modulos.map((m) => (
            <option key={m.id} value={m.id}>
              {m.nombre_asignatura}
            </option>
          ))}
        </select>
      </div>

      {errorText && (
        <div className="text-sm text-red-400 border border-red-600/40 bg-red-900/20 rounded-md px-3 py-2">
          {errorText}
        </div>
      )}

      <div className="rounded-2xl border border-[var(--muted)] overflow-hidden">
        <div className="bg-[var(--panel)] px-3 py-2 text-sm">
          {loadingMsgs ? "Cargando mensajes…" : `Total: ${mensajes.length}`}
        </div>
        <ul className="divide-y divide-[var(--muted)]">
          {mensajes.map((m) => (
            <li key={m.id} className="p-3">
              <div className="text-sm">
                <span className="font-semibold">
                  {m.docente?.nombre_completo ?? "Docente"}
                </span>{" "}
                <span className="text-[var(--text-muted)]">• {formatWhen(m)}</span>
              </div>
              <div className="whitespace-pre-wrap">{m.contenido}</div>
            </li>
          ))}
          {!mensajes.length && !loadingMsgs && (
            <li className="p-3 text-[var(--text-muted)]">No hay mensajes para este módulo.</li>
          )}
        </ul>
      </div>
    </div>
  );
}
