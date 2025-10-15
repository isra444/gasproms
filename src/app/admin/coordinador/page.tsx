"use client";

import { useEffect, useState } from "react";
import { listUsuariosByRol, createUsuarioBasic, updateUsuario, assignRoles, Usuario } from "@/lib/repositories/usuariosRepo";

export default function AdminCoordinadorPage() {
  const [rows, setRows] = useState<Usuario[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");

  async function load() {
    setLoading(true);
    try {
      const data = await listUsuariosByRol("coordinador", q);
      setRows(data);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, [q]);

  async function onCreate() {
    const nombre = prompt("Nombre completo");
    const correo = prompt("Correo");
    if (!nombre || !correo) return;
    const id = await createUsuarioBasic({ nombre_completo: nombre, correo, celular: null, estado: "activo" });
    await assignRoles(id, ["coordinador"]);
    await load();
  }

  async function onEdit(u: Usuario) {
    const nombre = prompt("Nuevo nombre", u.nombre_completo);
    if (!nombre || nombre === u.nombre_completo) return;
    await updateUsuario(u.id, { nombre_completo: nombre });
    await load();
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Coordinadores</h1>
        <button onClick={onCreate} className="px-3 py-2 rounded bg-[var(--accent)] text-[var(--onAccent)]">Nuevo</button>
      </div>

      <input
        placeholder="Buscar por nombre o correo…"
        className="w-full md:w-80 px-3 py-2 bg-[var(--muted)] rounded"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />

      {loading ? (
        <div>Cargando…</div>
      ) : (
        <div className="overflow-auto border border-[var(--border)] rounded">
          <table className="w-full text-sm">
            <thead className="bg-[var(--muted)]">
              <tr>
                <th className="text-left p-2">Nombre</th>
                <th className="text-left p-2">Correo</th>
                <th className="text-left p-2">Celular</th>
                <th className="text-left p-2">Estado</th>
                <th className="text-left p-2">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((u) => (
                <tr key={u.id} className="border-t border-[var(--border)]">
                  <td className="p-2">{u.nombre_completo}</td>
                  <td className="p-2">{u.correo}</td>
                  <td className="p-2">{u.celular ?? "—"}</td>
                  <td className="p-2">{u.estado ?? "activo"}</td>
                  <td className="p-2 space-x-2">
                    <button onClick={() => onEdit(u)} className="px-2 py-1 rounded border">Editar</button>
                  </td>
                </tr>
              ))}
              {!rows.length && (
                <tr><td className="p-3 text-center text-muted-foreground" colSpan={5}>Sin resultados</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
