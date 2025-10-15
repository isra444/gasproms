"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import RoleGuard from "@/components/RoleGuard";

export default function AdminDashboardPage() {
  const [stats, setStats] = useState({
    alumnos: 0,
    docentes: 0,
    programas: 0,
    nuevos: 0,
  });
  const [loading, setLoading] = useState(true);

  const fetchStats = async () => {
    setLoading(true);

    // alumnos
    const { count: alumnos } = await supabase
      .from("roles_usuario")
      .select("*", { count: "exact", head: true })
      .eq("rol", "alumno");

    // docentes
    const { count: docentes } = await supabase
      .from("roles_usuario")
      .select("*", { count: "exact", head: true })
      .eq("rol", "docente");

    // programas (si no existe la tabla aún, capturamos error)
    let programas = 0;
    try {
      const { count: progs } = await supabase
        .from("programas")
        .select("*", { count: "exact", head: true });
      programas = progs ?? 0;
    } catch {
      programas = 0;
    }

    // nuevos sin rol
    // usamos relación para detectar usuarios sin roles_usuario
    const { data: usuarios } = await supabase
      .from("usuarios")
      .select("id, roles_usuario(rol)");

    const nuevos = (usuarios ?? []).filter((u: any) => !u.roles_usuario?.length)
      .length;

    setStats({
      alumnos: alumnos ?? 0,
      docentes: docentes ?? 0,
      programas,
      nuevos,
    });
    setLoading(false);
  };

  useEffect(() => {
    fetchStats();
  }, []);

  return (
    <RoleGuard allowedRoles={["admin"]}>
      <div className="p-8 min-h-screen bg-[var(--bg)] text-[var(--text)]">
        <h1 className="text-2xl font-bold mb-6">Panel de Administrador</h1>

        {loading ? (
          <p>Cargando estadísticas...</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-[var(--panel)] p-6 rounded-xl shadow text-center">
              <h2 className="text-lg font-semibold">Alumnos</h2>
              <p className="text-3xl font-bold">{stats.alumnos}</p>
            </div>
            <div className="bg-[var(--panel)] p-6 rounded-xl shadow text-center">
              <h2 className="text-lg font-semibold">Docentes</h2>
              <p className="text-3xl font-bold">{stats.docentes}</p>
            </div>
            <div className="bg-[var(--panel)] p-6 rounded-xl shadow text-center">
              <h2 className="text-lg font-semibold">Programas</h2>
              <p className="text-3xl font-bold">{stats.programas}</p>
            </div>
            <div className="bg-[var(--panel)] p-6 rounded-xl shadow text-center">
              <h2 className="text-lg font-semibold">Nuevos pendientes</h2>
              <p className="text-3xl font-bold">{stats.nuevos}</p>
            </div>
          </div>
        )}
      </div>
    </RoleGuard>
  );
}
