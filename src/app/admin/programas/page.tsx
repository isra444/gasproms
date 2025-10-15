// src/app/admin/programas/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

type Programa = {
  id: string;
  nombre: string;
  grado_academico: string | null;
  versión: string | null;       // columna con tilde en tu BD
  modalidad: string | null;
  sede: string | null;
  fecha_inicio: string | null;  // date (YYYY-MM-DD)
  fecha_fin: string | null;     // date (YYYY-MM-DD)
  coordinador_id: string | null;
};

type Persona = { id: string; nombre_completo: string; correo: string };

const emptyForm: Omit<Programa, "id"> = {
  nombre: "",
  grado_academico: "",
  versión: "",
  modalidad: "",
  sede: "",
  fecha_inicio: "",
  fecha_fin: "",
  coordinador_id: "",
};

export default function ProgramasPage() {
  const [items, setItems] = useState<Programa[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");

  // Form
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Programa | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Coordinadores (usuarios con rol 'coordinador')
  const [coordinadores, setCoordinadores] = useState<Persona[]>([]);

  async function loadCoordinadores() {
    const { data, error } = await supabase
      .from("usuarios")
      .select("id, nombre_completo, correo, roles_usuario!inner(rol)")
      .eq("roles_usuario.rol", "coordinador")
      .order("nombre_completo", { ascending: true });
    if (!error) setCoordinadores((data as any) ?? []);
  }

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("programas")
      .select("*")
      .order("fecha_inicio", { ascending: false })
      .order("nombre", { ascending: true });

    if (!error) setItems((data as any) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
    loadCoordinadores();
  }, []);

  const filtered = useMemo(() => {
    if (!q) return items;
    const s = q.toLowerCase();
    return items.filter(
      (p) =>
        p.nombre.toLowerCase().includes(s) ||
        (p.grado_academico ?? "").toLowerCase().includes(s) ||
        (p.versión ?? "").toLowerCase().includes(s) ||
        (p.modalidad ?? "").toLowerCase().includes(s) ||
        (p.sede ?? "").toLowerCase().includes(s)
    );
  }, [items, q]);

  function startCreate() {
    setEditing(null);
    setForm(emptyForm);
    setError(null);
    setShowForm(true);
  }

  function startEdit(p: Programa) {
    setEditing(p);
    setForm({
      nombre: p.nombre ?? "",
      grado_academico: p.grado_academico ?? "",
      versión: p.versión ?? "",
      modalidad: p.modalidad ?? "",
      sede: p.sede ?? "",
      fecha_inicio: p.fecha_inicio ?? "",
      fecha_fin: p.fecha_fin ?? "",
      coordinador_id: p.coordinador_id ?? "",
    });
    setError(null);
    setShowForm(true);
  }

  function cancelForm() {
    setEditing(null);
    setForm(emptyForm);
    setError(null);
    setShowForm(false);
  }

  async function save() {
    setError(null);

    if (!form.nombre?.trim()) {
      setError("El nombre es obligatorio.");
      return;
    }
    if (form.fecha_inicio && form.fecha_fin && form.fecha_fin < form.fecha_inicio) {
      setError("La fecha de fin no puede ser anterior a la fecha de inicio.");
      return;
    }

    setSaving(true);
    const payload = {
      nombre: form.nombre.trim(),
      grado_academico: form.grado_academico || null,
      versión: form.versión || null, // respeta el nombre exacto de la columna
      modalidad: form.modalidad || null,
      sede: form.sede || null,
      fecha_inicio: form.fecha_inicio || null,
      fecha_fin: form.fecha_fin || null,
      coordinador_id: form.coordinador_id || null,
    };

    try {
      if (editing) {
        const { error } = await supabase.from("programas").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("programas").insert([payload]);
        if (error) throw error;
      }
      await load();
      cancelForm(); // limpia y cierra
    } catch (e: any) {
      setError(e?.message || "No se pudo guardar el programa.");
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("¿Eliminar este programa?")) return;
    const { error } = await supabase.from("programas").delete().eq("id", id);
    if (!error) load();
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-xl font-semibold">Programas</h1>
        <button
          onClick={startCreate}
          className="px-4 py-2 rounded-xl bg-[var(--primary)] text-white"
        >
          Nuevo programa
        </button>
      </div>

      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Buscar por nombre, grado, versión, modalidad o sede…"
        className="w-full md:w-2/3 rounded-xl px-4 py-2 bg-[var(--panel)] border border-[var(--muted)] outline-none"
      />

      {/* Formulario crear/editar */}
      {showForm && (
        <div className="rounded-2xl border border-[var(--muted)] p-4 grid md:grid-cols-3 gap-3">
          {error && (
            <div className="md:col-span-3 p-3 rounded-lg bg-[var(--danger)]/10 border border-[var(--danger)] text-[var(--danger)]">
              {error}
            </div>
          )}
          <input
            className="px-3 py-2 rounded-lg bg-[var(--panel)] border border-[var(--muted)]"
            placeholder="Nombre *"
            value={form.nombre}
            onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
          />
          <input
            className="px-3 py-2 rounded-lg bg-[var(--panel)] border border-[var(--muted)]"
            placeholder="Grado académico"
            value={form.grado_academico ?? ""}
            onChange={(e) => setForm((f) => ({ ...f, grado_academico: e.target.value }))}
          />
          <input
            className="px-3 py-2 rounded-lg bg-[var(--panel)] border border-[var(--muted)]"
            placeholder="Versión"
            value={form.versión ?? ""}
            onChange={(e) => setForm((f) => ({ ...f, versión: e.target.value }))}
          />
          <input
            className="px-3 py-2 rounded-lg bg-[var(--panel)] border border-[var(--muted)]"
            placeholder="Modalidad"
            value={form.modalidad ?? ""}
            onChange={(e) => setForm((f) => ({ ...f, modalidad: e.target.value }))}
          />
          <input
            className="px-3 py-2 rounded-lg bg-[var(--panel)] border border-[var(--muted)]"
            placeholder="Sede"
            value={form.sede ?? ""}
            onChange={(e) => setForm((f) => ({ ...f, sede: e.target.value }))}
          />
          <input
            type="date"
            className="px-3 py-2 rounded-lg bg-[var(--panel)] border border-[var(--muted)]"
            value={form.fecha_inicio ?? ""}
            onChange={(e) => setForm((f) => ({ ...f, fecha_inicio: e.target.value }))}
          />
          <input
            type="date"
            className="px-3 py-2 rounded-lg bg-[var(--panel)] border border-[var(--muted)]"
            value={form.fecha_fin ?? ""}
            onChange={(e) => setForm((f) => ({ ...f, fecha_fin: e.target.value }))}
          />
          <select
            className="px-3 py-2 rounded-lg bg-[var(--panel)] border border-[var(--muted)]"
            value={form.coordinador_id ?? ""}
            onChange={(e) => setForm((f) => ({ ...f, coordinador_id: e.target.value }))}
          >
            <option value="">— Coordinador —</option>
            {coordinadores.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre_completo} ({c.correo})
              </option>
            ))}
          </select>

          <div className="col-span-full flex gap-2">
            <button
              onClick={save}
              disabled={saving}
              className="px-4 py-2 rounded-xl bg-[var(--success)] text-white disabled:opacity-60"
            >
              {editing ? "Guardar cambios" : "Crear programa"}
            </button>
            <button onClick={cancelForm} className="px-4 py-2 rounded-xl bg-[var(--muted)]">
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Tabla */}
      {loading ? (
        <div className="opacity-70">Cargando…</div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-[var(--muted)]">
          <table className="min-w-full text-sm">
            <thead className="bg-[var(--panel)]">
              <tr>
                <th className="text-left p-3">Nombre</th>
                <th className="text-left p-3">Grado</th>
                <th className="text-left p-3">Versión</th>
                <th className="text-left p-3">Modalidad</th>
                <th className="text-left p-3">Sede</th>
                <th className="text-left p-3">Inicio</th>
                <th className="text-left p-3">Fin</th>
                <th className="text-left p-3">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <tr key={p.id} className="border-t border-[var(--muted)]">
                  <td className="p-3">
                    <Link href={`/admin/programas/${p.id}`} className="underline hover:opacity-80">
                      {p.nombre}
                    </Link>
                  </td>
                  <td className="p-3">{p.grado_academico || "—"}</td>
                  <td className="p-3">{p.versión || "—"}</td>
                  <td className="p-3">{p.modalidad || "—"}</td>
                  <td className="p-3">{p.sede || "—"}</td>
                  <td className="p-3">{p.fecha_inicio || "—"}</td>
                  <td className="p-3">{p.fecha_fin || "—"}</td>
                  <td className="p-3 flex gap-2">
                    <button
                      onClick={() => startEdit(p)}
                      className="px-3 py-1 rounded-lg bg-[var(--primary)] text-white"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => remove(p.id)}
                      className="px-3 py-1 rounded-lg bg-[var(--danger)] text-white"
                    >
                      Eliminar
                    </button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td className="p-3 text-[var(--text-muted)]" colSpan={8}>
                    Sin resultados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
