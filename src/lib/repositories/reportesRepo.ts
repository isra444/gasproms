import { supabase } from "@/lib/supabaseClient";

export type KPI = { rol: string; total: number };

export async function kpisUsuariosPorRol(): Promise<KPI[]> {
  const roles = ["alumno", "docente", "coordinador", "admin"];
  const out: KPI[] = [];
  for (const rol of roles) {
    const { count, error } = await supabase
      .from("roles_usuario")
      .select("*", { count: "exact", head: true })
      .eq("rol", rol);
    if (error) throw error;
    out.push({ rol, total: count ?? 0 });
  }
  return out;
}

export async function exportUsuariosPorRolCSV(rol: "alumno" | "docente" | "coordinador" | "admin") {
  const { data, error } = await supabase
    .from("roles_usuario")
    .select("usuarios:usuario_id (nombre_completo, correo, celular, estado)")
    .eq("rol", rol);
  if (error) throw error;

  const rows = (data ?? []).map((r: any) => r.usuarios).filter(Boolean);
  const header = ["nombre_completo", "correo", "celular", "estado"];
  const csv = [
    header.join(","),
    ...rows.map((r: any) => header.map((h) => JSON.stringify(r?.[h] ?? "")).join(",")),
  ].join("\n");

  return new Blob([csv], { type: "text/csv;charset=utf-8" });
}
