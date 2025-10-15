// src/app/admin/alumnos/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import {
  listAlumnos,
  listProgramas,
  listModulosByPrograma,
  updateUsuario,
  toggleUsuarioEstado,
  toggleAbandono,            // ⬅️ nuevo
  getRoles,
  assignRoles,
  type Usuario,
  type Rol,
  type Programa,
  type Modulo,
  type UsuarioEstado,        // ⬅️ nuevo
} from "@/lib/repositories/usuariosRepo";
import UsuarioForm from "@/components/forms/UsuarioForm";
import RolesDialog from "@/components/forms/RolesDialog";

/** Badge visual para el estado (activo / inactivo / abandono) */
function EstadoBadge({ estado }: { estado?: string | null }) {
  const e = (estado as UsuarioEstado) ?? "activo";
  const cls =
    e === "activo"
      ? "bg-emerald-900/30 text-emerald-300"
      : e === "abandono"
      ? "bg-amber-900/30 text-amber-300"
      : "bg-zinc-800 text-zinc-300"; // inactivo
  return <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs ${cls}`}>{e}</span>;
}

export default function AdminAlumnosPage() {
  const [rows, setRows] = useState<Usuario[]>([]);
  const [loading, setLoading] = useState(true);

  const [q, setQ] = useState("");
  const [programas, setProgramas] = useState<Programa[]>([]);
  const [programaId, setProgramaId] = useState<string | "">("");
  const [modulos, setModulos] = useState<Modulo[]>([]);
  const [moduloId, setModuloId] = useState<string | "">("");

  // Estado para modales
  const [editOpen, setEditOpen] = useState(false);
  const [editUser, setEditUser] = useState<Usuario | null>(null);

  const [rolesOpen, setRolesOpen] = useState(false);
  const [rolesUserId, setRolesUserId] = useState<string | null>(null);
  const [rolesCurrent, setRolesCurrent] = useState<Rol[]>([]);

  /** Carga programas al montar */
  useEffect(() => {
    (async () => {
      try {
        setProgramas(await listProgramas());
      } catch (e: any) {
        console.error("Error cargando programas:", e?.message ?? e);
      }
    })();
  }, []);

  /** Cuando cambia el programa, carga sus módulos */
  useEffect(() => {
    (async () => {
      try {
        setModuloId(""); // reset módulo
        if (!programaId) {
          setModulos([]);
          return;
        }
        const ms = await listModulosByPrograma(programaId);
        setModulos(ms);
      } catch (e: any) {
        console.error("Error cargando módulos:", e?.message ?? e);
        setModulos([]);
      }
    })();
  }, [programaId]);

  /** Carga alumnos (búsqueda + módulo) */
  async function refreshList() {
    setLoading(true);
    try {
      const data = await listAlumnos({
        search: q,
        moduloId: moduloId || undefined,
      });
      setRows(data);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    refreshList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, moduloId]);

  /** Acciones por fila */
  function openEdit(u: Usuario) {
    setEditUser(u);
    setEditOpen(true);
  }
  async function saveEdit(values: { nombre_completo: string; correo: string; celular: string | null }) {
    if (!editUser) return;
    try {
      await updateUsuario(editUser.id, values);
      await refreshList();
    } catch (e: any) {
      alert(`No se pudo guardar: ${e?.message ?? e}`);
    }
  }

  async function onToggle(u: Usuario) {
    await toggleUsuarioEstado(u.id);
    await refreshList();
  }

  async function onToggleAbandono(u: Usuario) {
    try {
      await toggleAbandono(u.id);
      await refreshList();
    } catch (e: any) {
      alert(`No se pudo cambiar a abandono: ${e?.message ?? e}`);
    }
  }

  async function openRoles(u: Usuario) {
    const rs = await getRoles(u.id);
    setRolesUserId(u.id);
    setRolesCurrent(rs);
    setRolesOpen(true);
  }
  async function saveRoles(newRoles: Rol[]) {
    if (!rolesUserId) return;
    try {
      await assignRoles(rolesUserId, newRoles);
      await refreshList();
    } catch (e: any) {
      alert(`No se pudieron actualizar los roles: ${e?.message ?? e}`);
    }
  }

  const hayFiltros = useMemo(() => Boolean(q || programaId || moduloId), [q, programaId, moduloId]);

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="text-xl font-semibold">Alumnos</h1>
        <div className="flex gap-2 items-center flex-wrap">
          <input
            placeholder="Buscar por nombre o correo…"
            className="w-64 px-3 py-2 bg-[var(--muted)] rounded border border-[var(--border)]"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />

          {/* Filtro: Programa */}
          <select
            className="px-3 py-2 bg-[var(--muted)] rounded border border-[var(--border)]"
            value={programaId}
            onChange={(e) => setProgramaId(e.target.value)}
          >
            <option value="">Todos los programas</option>
            {programas.map((p) => (
              <option key={p.id} value={p.id}>{p.nombre}</option>
            ))}
          </select>

          {/* Sub-filtro: Módulo del programa */}
          <select
            className="px-3 py-2 bg-[var(--muted)] rounded border border-[var(--border)]"
            value={moduloId}
            onChange={(e) => setModuloId(e.target.value)}
            disabled={!programaId || !modulos.length}
            title={!programaId ? "Selecciona un programa primero" : undefined}
          >
            <option value="">Todos los módulos del programa</option>
            {modulos.map((m) => (
              <option key={m.id} value={m.id}>{m.nombre}</option>
            ))}
          </select>

          {hayFiltros && (
            <button
              className="px-3 py-2 rounded border border-[var(--border)]"
              onClick={() => {
                setQ("");
                setProgramaId("");
                setModuloId("");
                setModulos([]);
              }}
            >
              Limpiar
            </button>
          )}
        </div>
      </div>

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
                <th className="text-left p-2 w-[360px]">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((u) => (
                <tr key={u.id} className="border-t border-[var(--border)]">
                  <td className="p-2">{u.nombre_completo}</td>
                  <td className="p-2">{u.correo}</td>
                  <td className="p-2">{u.celular ?? "—"}</td>
                  <td className="p-2">
                    <EstadoBadge estado={u.estado} />
                  </td>
                  <td className="p-2">
                    <div className="flex gap-2 flex-wrap">
                      <button
                        onClick={() => openEdit(u)}
                        className="px-2 py-1 rounded border border-[var(--border)]"
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => openRoles(u)}
                        className="px-2 py-1 rounded border border-[var(--border)]"
                      >
                        Cambiar roles
                      </button>
                      <button
                        onClick={() => onToggle(u)}
                        className="px-2 py-1 rounded border border-[var(--border)]"
                      >
                        {(u.estado ?? "activo") === "activo" ? "Desactivar" : "Activar"}
                      </button>
                      <button
                        onClick={() => onToggleAbandono(u)}
                        className="px-2 py-1 rounded border border-[var(--border)]"
                        title="Marca al alumno como abandono o lo devuelve a activo"
                      >
                        {(u.estado ?? "activo") === "abandono" ? "Quitar abandono" : "Marcar abandono"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}

              {!rows.length && (
                <tr>
                  <td className="p-3 text-center text-muted-foreground" colSpan={5}>
                    Sin resultados
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal Editar */}
      <UsuarioForm
        key={editUser?.id ?? "new"}
        open={editOpen}
        onClose={() => setEditOpen(false)}
        usuario={editUser}
        onSubmit={saveEdit}
      />

      {/* Modal Roles */}
      <RolesDialog
        open={rolesOpen}
        onClose={() => setRolesOpen(false)}
        initialRoles={rolesCurrent}
        onSave={saveRoles}
        title="Cambiar roles del usuario"
      />
    </div>
  );
}
