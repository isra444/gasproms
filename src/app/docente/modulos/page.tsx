// src/app/docente/modulos/page.tsx
"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useUserStore } from "@/store/useUserStore";

type RowModulo = {
  id: string;
  nombre_asignatura: string;
  programa?: { nombre: string } | null;
};

type Mensaje = {
  id: string;
  modulo_id: string;
  docente_id: string | null;
  contenido: string;
  fecha: string; // timestamp
  docente?: { nombre_completo: string; correo: string } | null;
};

export default function MisModulos() {
  const user = useUserStore((s) => s.user);
  const [rows, setRows] = useState<RowModulo[]>([]);
  const [loading, setLoading] = useState(true);

  // Mensajes UI
  const [openModuloId, setOpenModuloId] = useState<string | null>(null);
  const [mensajes, setMensajes] = useState<Mensaje[]>([]);
  const [nuevo, setNuevo] = useState("");
  const [posting, setPosting] = useState(false);
  const [loadingMsgs, setLoadingMsgs] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("modulos")
        .select("id, nombre_asignatura, programa:programa_id(nombre)")
        .eq("docente_id", user.id)
        .order("nombre_asignatura");
      if (error) console.error(error);
      setRows((data as any) ?? []);
      setLoading(false);
    })();
  }, [user?.id]);

  async function abrirMensajes(moduloId: string) {
    setOpenModuloId(moduloId);
    setNuevo("");
    await cargarMensajes(moduloId);
  }

  async function cargarMensajes(moduloId: string) {
    setLoadingMsgs(true);
    const { data, error } = await supabase
      .from("mensajes_modulo")
      .select(
        "id, modulo_id, docente_id, contenido, fecha, docente:docente_id (nombre_completo, correo)"
      )
      .eq("modulo_id", moduloId)
      .order("fecha", { ascending: false });
    if (error) console.error(error);
    setMensajes(((data as any) ?? []) as Mensaje[]);
    setLoadingMsgs(false);
  }

  async function publicar() {
    if (!nuevo.trim() || !openModuloId || !user?.id) return;
    setPosting(true);
    const payload = {
      modulo_id: openModuloId,
      docente_id: user.id,
      contenido: nuevo.trim(),
    };
    const { data, error } = await supabase
      .from("mensajes_modulo")
      .insert([payload])
      .select(
        "id, modulo_id, docente_id, contenido, fecha, docente:docente_id (nombre_completo, correo)"
      )
      .single();
    if (error) {
      console.error(error);
      alert("No se pudo publicar el mensaje.");
    } else {
      // Optimista: agregar arriba
      setMensajes((prev) => [data as any as Mensaje, ...prev]);
      setNuevo("");
    }
    setPosting(false);
  }

  async function eliminarMensaje(id: string) {
    if (!confirm("¿Eliminar este mensaje?")) return;
    const { error } = await supabase.from("mensajes_modulo").delete().eq("id", id);
    if (error) {
      console.error(error);
      alert("No se pudo eliminar.");
    } else {
      setMensajes((prev) => prev.filter((m) => m.id !== id));
    }
  }

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-xl font-semibold">Mis módulos</h1>

      {loading ? (
        <div>Cargando…</div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-[var(--muted)]">
          <table className="min-w-full text-sm">
            <thead className="bg-[var(--panel)]">
              <tr>
                <th className="text-left p-3">Asignatura</th>
                <th className="text-left p-3">Programa</th>
                <th className="text-left p-3">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-[var(--muted)]">
                  <td className="p-3">{r.nombre_asignatura}</td>
                  <td className="p-3">{r.programa?.nombre ?? "—"}</td>
                  <td className="p-3 space-x-2">
                    <button
                      onClick={() =>
                        setOpenModuloId((cur) => (cur === r.id ? null : (abrirMensajes(r.id), r.id)))
                      }
                      className="px-3 py-1 rounded-lg bg-[var(--primary)] text-white"
                    >
                      {openModuloId === r.id ? "Cerrar mensajes" : "Mensajes"}
                    </button>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td className="p-3 text-[var(--text-muted)]" colSpan={3}>
                    Sin módulos.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Panel de mensajes */}
      {openModuloId && (
        <div className="rounded-2xl border border-[var(--muted)] p-4 space-y-4">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold">Mensajes del módulo</h2>
            <button
              onClick={() => abrirMensajes(openModuloId)}
              className="ml-auto px-3 py-1 rounded-lg bg-[var(--panel)] border border-[var(--muted)]"
            >
              Recargar
            </button>
            <button
              onClick={() => setOpenModuloId(null)}
              className="px-3 py-1 rounded-lg bg-[var(--muted)]"
            >
              Cerrar
            </button>
          </div>

          {/* Publicar nuevo */}
          <div className="grid md:grid-cols-12 gap-3">
            <textarea
              rows={3}
              value={nuevo}
              onChange={(e) => setNuevo(e.target.value)}
              placeholder="Escribe un aviso para tus alumnos…"
              className="md:col-span-10 w-full px-3 py-2 rounded-lg bg-[var(--panel)] border border-[var(--muted)]"
            />
            <div className="md:col-span-2 flex md:flex-col gap-2">
              <button
                onClick={publicar}
                disabled={posting || !nuevo.trim()}
                className="px-4 py-2 rounded-xl bg-[var(--success)] text-white disabled:opacity-60"
              >
                {posting ? "Publicando…" : "Publicar"}
              </button>
            </div>
          </div>

          {/* Lista de mensajes */}
          <div className="rounded-xl border border-[var(--muted)] overflow-hidden">
            <div className="bg-[var(--panel)] px-3 py-2 text-sm">
              {loadingMsgs ? "Cargando mensajes…" : `Total: ${mensajes.length}`}
            </div>
            <ul className="divide-y divide-[var(--muted)]">
              {mensajes.map((m) => (
                <li key={m.id} className="p-3 flex items-start gap-3">
                  <div className="flex-1">
                    <div className="text-sm">
                      <span className="font-semibold">{m.docente?.nombre_completo ?? "Docente"}</span>{" "}
                      <span className="text-[var(--text-muted)]">
                        • {new Date(m.fecha).toLocaleString()}
                      </span>
                    </div>
                    <div className="whitespace-pre-wrap">{m.contenido}</div>
                  </div>
                  {m.docente_id === user?.id && (
                    <button
                      onClick={() => eliminarMensaje(m.id)}
                      className="px-3 py-1 rounded-lg bg-[var(--danger)] text-white"
                    >
                      Eliminar
                    </button>
                  )}
                </li>
              ))}
              {!mensajes.length && !loadingMsgs && (
                <li className="p-3 text-[var(--text-muted)]">Aún no hay mensajes.</li>
              )}
            </ul>
          </div>

          <p className="text-[11px] text-[var(--text-muted)]">
            * Los alumnos verán estos avisos en su interfaz (podemos agregar un panel “Avisos” en
            la vista de Alumno o en cada módulo).
          </p>
        </div>
      )}
    </div>
  );
}
