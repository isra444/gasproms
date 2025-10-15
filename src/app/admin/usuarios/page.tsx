"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import RoleGuard from "@/components/RoleGuard";
import { Search, UserPlus, Shield } from "lucide-react";

type Usuario = {
  id: string;
  nombre_completo: string;
  correo: string;
  estado: string;
  rol?: string | null;
};

export default function UsuariosPage() {
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  // Cargar usuarios
  const fetchUsuarios = async () => {
    setLoading(true);

    const { data, error } = await supabase
      .from("usuarios")
      .select("id, nombre_completo, correo, estado, roles_usuario(rol)");

    if (error) {
      console.error("Error cargando usuarios:", error.message);
      setLoading(false);
      return;
    }

    const usuariosFormateados: Usuario[] = (data ?? []).map((u: any) => ({
      id: u.id,
      nombre_completo: u.nombre_completo,
      correo: u.correo,
      estado: u.estado,
      rol: u.roles_usuario?.[0]?.rol ?? null,
    }));

    setUsuarios(usuariosFormateados);
    setLoading(false);
  };

  const asignarRol = async (usuarioId: string, nuevoRol: string) => {
    const { data: existente } = await supabase
      .from("roles_usuario")
      .select("id")
      .eq("usuario_id", usuarioId)
      .maybeSingle();

    if (existente) {
      await supabase
        .from("roles_usuario")
        .update({ rol: nuevoRol })
        .eq("usuario_id", usuarioId);
    } else {
      await supabase
        .from("roles_usuario")
        .insert({ usuario_id: usuarioId, rol: nuevoRol });
    }

    fetchUsuarios();
  };

  useEffect(() => {
    fetchUsuarios();
  }, []);

  // Solo usuarios sin rol
  const usuariosSinRol = usuarios.filter(
    (u) =>
      !u.rol &&
      (u.nombre_completo.toLowerCase().includes(search.toLowerCase()) ||
        u.correo.toLowerCase().includes(search.toLowerCase()) ||
        u.id.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <RoleGuard allowedRoles={["admin"]}>
      <div className="p-8 min-h-screen bg-[var(--bg)] text-[var(--text)]">
        {/* Header */}
        <div className="flex items-center gap-2 mb-6">
          <UserPlus className="w-6 h-6 text-[var(--primary)]" />
          <h1 className="text-2xl font-bold">Nuevos Registrados</h1>
        </div>

        {/* Buscador */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-[var(--text-muted)] w-5 h-5" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre, correo o CI..."
            className="w-full pl-10 pr-4 py-2 border border-[var(--muted)] rounded-lg bg-[var(--bg)] text-[var(--text)] placeholder-[var(--text-muted)]"
          />
        </div>

        {/* Tabla */}
        {loading ? (
          <p>Cargando usuarios...</p>
        ) : usuariosSinRol.length === 0 ? (
          <p className="text-[var(--text-muted)]">No hay usuarios pendientes.</p>
        ) : (
          <table className="w-full border border-[var(--muted)] rounded-lg overflow-hidden">
            <thead className="bg-[var(--panel)]">
              <tr>
                <th className="p-2 border">Nombre</th>
                <th className="p-2 border">Correo</th>
                <th className="p-2 border">Estado</th>
                <th className="p-2 border flex items-center justify-center gap-1">
                  <Shield className="w-4 h-4" /> Rol
                </th>
              </tr>
            </thead>
            <tbody>
              {usuariosSinRol.map((u) => (
                <tr key={u.id} className="text-center hover:bg-[var(--muted)]/30">
                  <td className="p-2 border">{u.nombre_completo}</td>
                  <td className="p-2 border">{u.correo}</td>
                  <td className="p-2 border">{u.estado}</td>
                  <td className="p-2 border">
                    <select
                      onChange={(e) => asignarRol(u.id, e.target.value)}
                      className="px-2 py-1 border border-[var(--muted)] rounded bg-[var(--bg)]"
                    >
                      <option value="">Asignar rol</option>
                      <option value="admin">Administrador</option>
                      <option value="docente">Docente</option>
                      <option value="alumno">Alumno</option>
                      <option value="coordinador">Coordinador</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </RoleGuard>
  );
}
