// src/lib/repositories/usuariosRepo.ts
import { supabase } from "@/lib/supabaseClient";

/** =========================
 *  Tipos
 *  ========================= */
export type Rol = "admin" | "docente" | "alumno" | "coordinador";

export type Usuario = {
  id: string;
  nombre_completo: string;
  correo: string;
  celular?: string | null;
  estado?: string | null; // "activo" | "inactivo" | "abandono"
};

export type Programa = { id: string; nombre: string };
export type Modulo = { id: string; nombre: string };

/** Estado con tipado para helpers de alumnos */
export type UsuarioEstado = "activo" | "inactivo" | "abandono";

/** =========================
 *  Tablas y columnas (ajusta aquí si tu esquema difiere)
 *  ========================= */
const USUARIOS_TABLE = "usuarios";
const ROLES_TABLE = "roles_usuario";
const PROGRAMAS_TABLE = "programas";
const MODULOS_TABLE = "modulos";
const PIVOTE_ALUMNOS_TABLE = "modulos_alumnos";
const PIVOTE_DOCENTES_TABLE = "modulos_docentes"; // <-- cambia si tu pivote de docentes tiene otro nombre

// FKs más comunes en pivotes: *_id o usuario_id
const ALUMNO_FK_VARIANTS = ["alumno_id", "usuario_id"] as const;
const DOCENTE_FK_VARIANTS = ["docente_id", "usuario_id"] as const;

// Relación módulo → programa
const MODULO_PROGRAMA_FK = "programa_id"; // cámbialo si tu columna se llama distinto

/** =========================
 *  Helpers
 *  ========================= */
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function looksLikeId(v: unknown) {
  return typeof v === "string" && (UUID_RE.test(v) || v.length > 24);
}

function pickNiceName(
  row: Record<string, any>,
  preferred: string[] = ["nombre", "titulo", "name", "asignatura", "materia", "descripcion"]
) {
  // 1) intenta campos “bonitos”
  for (const k of preferred) {
    const v = row?.[k];
    if (typeof v === "string" && v.trim() && !looksLikeId(v)) return v;
  }
  // 2) 'codigo' solo si no parece ID
  const code = row?.codigo;
  if (typeof code === "string" && code.trim() && !looksLikeId(code)) return code;
  // 3) primer string usable
  for (const [k, v] of Object.entries(row ?? {})) {
    if (k === "id") continue;
    if (typeof v === "string" && v.trim() && !looksLikeId(v)) return v;
  }
  return "Sin nombre";
}

function toProgramaArray(data: any[] | null): Programa[] {
  const arr = Array.isArray(data) ? data : [];
  return arr.map((r: any) => ({ id: r?.id, nombre: pickNiceName(r, ["nombre", "titulo", "name"]) }));
}

function toModuloArray(data: any[] | null): Modulo[] {
  const arr = Array.isArray(data) ? data : [];
  return arr.map((r: any) => ({ id: r?.id, nombre: pickNiceName(r) }));
}

/** =========================
 *  Usuarios por rol (base)
 *  ========================= */
export async function listUsuariosByRol(rol: Rol, search?: string) {
  const { data, error, status, statusText } = await supabase
    .from(ROLES_TABLE)
    .select("usuario_id, rol, usuarios:usuario_id (id, nombre_completo, correo, celular, estado)")
    .eq("rol", rol);

  if (error) {
    console.error(`[listUsuariosByRol] ${status} ${statusText} - ${error.code} ${error.message}`);
    return [];
  }

  let usuarios = (data ?? []).map((r: any) => r.usuarios).filter(Boolean) as Usuario[];

  if (search && search.trim()) {
    const s = search.toLowerCase();
    usuarios = usuarios.filter(
      (u) => u?.nombre_completo?.toLowerCase().includes(s) || u?.correo?.toLowerCase().includes(s)
    );
  }
  return usuarios;
}

/** =========================
 *  Programas & Módulos
 *  ========================= */
export async function listProgramas(): Promise<Programa[]> {
  // intenta el camino feliz
  let res = await supabase.from(PROGRAMAS_TABLE).select("id, nombre").order("nombre", { ascending: true });
  if (!res.error && Array.isArray(res.data)) {
    return res.data.map((r: any) => ({ id: r.id, nombre: r.nombre ?? "Sin nombre" }));
  }
  // fallback: autodetecta nombre
  const all = await supabase.from(PROGRAMAS_TABLE).select("*");
  if (all.error) {
    console.error(`[listProgramas] ${all.status} ${all.statusText} - ${all.error.code} ${all.error.message}`);
    return [];
  }
  return toProgramaArray(all.data);
}

export async function listModulosByPrograma(programaId: string): Promise<Modulo[]> {
  // intenta el camino feliz
  let res = await supabase
    .from(MODULOS_TABLE)
    .select(`id, nombre, ${MODULO_PROGRAMA_FK}`)
    .eq(MODULO_PROGRAMA_FK, programaId)
    .order("nombre", { ascending: true });

  if (!res.error && Array.isArray(res.data)) {
    return res.data.map((r: any) => ({ id: r.id, nombre: r.nombre ?? "Sin nombre" }));
  }
  // fallback: autodetecta
  const all = await supabase.from(MODULOS_TABLE).select("*").eq(MODULO_PROGRAMA_FK, programaId);
  if (all.error) {
    console.error(
      `[listModulosByPrograma] ${all.status} ${all.statusText} - ${all.error.code} ${all.error.message}`
    );
    return [];
  }
  return toModuloArray(all.data);
}

// Global, por si necesitas "Todos los módulos"
export async function listModulos(): Promise<Modulo[]> {
  let res = await supabase.from(MODULOS_TABLE).select("id, nombre").order("nombre", { ascending: true });
  if (!res.error && Array.isArray(res.data)) {
    return res.data.map((r: any) => ({ id: r.id, nombre: r.nombre ?? "Sin nombre" }));
  }
  const all = await supabase.from(MODULOS_TABLE).select("*");
  if (all.error) {
    console.error(`[listModulos] ${all.status} ${all.statusText} - ${all.error.code} ${all.error.message}`);
    return [];
  }
  return toModuloArray(all.data);
}

/** =========================
 *  Alumnos (lista + filtro por módulo)
 *  ========================= */
export async function listAlumnos(params: { search?: string; moduloId?: string | null }) {
  const { search, moduloId } = params;

  if (moduloId) {
    // prueba variantes de FK en la pivote
    for (const fk of ALUMNO_FK_VARIANTS) {
      const joinAlias = `usuarios:${fk} (id, nombre_completo, correo, celular, estado)`;
      const sel = `${fk}, ${joinAlias}`;
      const { data, error, status, statusText } = await supabase
        .from(PIVOTE_ALUMNOS_TABLE)
        .select(sel)
        .eq("modulo_id", moduloId);

      if (error) {
        if (error.code === "42703") continue; // columna no existe → intenta con la siguiente variante
        console.error(`[listAlumnos/modulo/${fk}] ${status} ${statusText} - ${error.code} ${error.message}`);
        continue;
      }

      let usuarios = (data ?? []).map((r: any) => r.usuarios).filter(Boolean) as Usuario[];

      if (search && search.trim()) {
        const s = search.toLowerCase();
        usuarios = usuarios.filter(
          (u) => u?.nombre_completo?.toLowerCase().includes(s) || u?.correo?.toLowerCase().includes(s)
        );
      }
      return usuarios;
    }

    console.error(
      `[listAlumnos] No se pudo resolver la FK en ${PIVOTE_ALUMNOS_TABLE} (intentado: ${ALUMNO_FK_VARIANTS.join(", ")}).`
    );
    // fallback a por-rol
  }

  // Sin filtro de módulo → por rol
  return listUsuariosByRol("alumno", search);
}

/** =========================
 *  Docentes (lista + filtro por módulo)
 *  ========================= */
export async function listDocentes(params: { search?: string; moduloId?: string | null }) {
  const { search, moduloId } = params;

  if (moduloId) {
    for (const fk of DOCENTE_FK_VARIANTS) {
      const joinAlias = `usuarios:${fk} (id, nombre_completo, correo, celular, estado)`;
      const sel = `${fk}, ${joinAlias}`;
      const { data, error, status, statusText } = await supabase
        .from(PIVOTE_DOCENTES_TABLE)
        .select(sel)
        .eq("modulo_id", moduloId);

      if (error) {
        if (error.code === "42703") continue; // columna no existe → intenta la siguiente
        console.error(`[listDocentes/modulo/${fk}] ${status} ${statusText} - ${error.code} ${error.message}`);
        continue;
      }

      let usuarios = (data ?? []).map((r: any) => r.usuarios).filter(Boolean) as Usuario[];

      if (search && search.trim()) {
        const s = search.toLowerCase();
        usuarios = usuarios.filter(
          (u) => u?.nombre_completo?.toLowerCase().includes(s) || u?.correo?.toLowerCase().includes(s)
        );
      }
      return usuarios;
    }

    console.error(
      `[listDocentes] No se pudo resolver la FK en ${PIVOTE_DOCENTES_TABLE} (intentado: ${DOCENTE_FK_VARIANTS.join(", ")}).`
    );
    // fallback a por-rol
  }

  // Sin filtro de módulo → por rol
  return listUsuariosByRol("docente", search);
}

/** =========================
 *  CRUD Usuario
 *  ========================= */
export async function createUsuarioBasic(
  input: Omit<Usuario, "id"> & { estado?: string }
) {
  const { data, error, status, statusText } = await supabase
    .from(USUARIOS_TABLE)
    .insert({
      nombre_completo: input.nombre_completo,
      correo: input.correo,
      celular: input.celular ?? null,
      estado: input.estado ?? "activo",
    })
    .select("id")
    .maybeSingle();

  if (error) {
    console.error(`[createUsuarioBasic] ${status} ${statusText} - ${error.code} ${error.message}`);
    throw error;
  }
  return data?.id as string;
}

export async function updateUsuario(id: string, patch: Partial<Usuario>) {
  const { error, status, statusText } = await supabase
    .from(USUARIOS_TABLE)
    .update(patch)
    .eq("id", id);

  if (error) {
    console.error(`[updateUsuario] ${status} ${statusText} - ${error.code} ${error.message}`);
    throw error;
  }
}

export async function toggleUsuarioEstado(id: string) {
  const { data, error: selErr, status, statusText } = await supabase
    .from(USUARIOS_TABLE)
    .select("estado")
    .eq("id", id)
    .maybeSingle();

  if (selErr) {
    console.error(`[toggleUsuarioEstado/select] ${status} ${statusText} - ${selErr.code} ${selErr.message}`);
    throw selErr;
  }

  const next = (data?.estado ?? "activo") === "activo" ? "inactivo" : "activo";

  const { error: upErr, status: st2, statusText: stt2 } = await supabase
    .from(USUARIOS_TABLE)
    .update({ estado: next })
    .eq("id", id);

  if (upErr) {
    console.error(`[toggleUsuarioEstado/update] ${st2} ${stt2} - ${upErr.code} ${upErr.message}`);
    throw upErr;
  }
  return next;
}

/** === NUEVO: estados explícitos para alumnos (abandono) === */

/** Setea el estado explícitamente (activo | inactivo | abandono) */
export async function setUsuarioEstado(id: string, estado: UsuarioEstado) {
  const { error, status, statusText } = await supabase
    .from(USUARIOS_TABLE)
    .update({ estado })
    .eq("id", id);

  if (error) {
    console.error(`[setUsuarioEstado] ${status} ${statusText} - ${error.code} ${error.message}`);
    throw error;
  }
}

/** Marca/Desmarca abandono (si ya está en abandono lo vuelve a activo) */
export async function toggleAbandono(id: string) {
  const { data, error: selErr, status, statusText } = await supabase
    .from(USUARIOS_TABLE)
    .select("estado")
    .eq("id", id)
    .maybeSingle();

  if (selErr) {
    console.error(`[toggleAbandono/select] ${status} ${statusText} - ${selErr.code} ${selErr.message}`);
    throw selErr;
  }

  const current = (data?.estado as UsuarioEstado) ?? "activo";
  const next: UsuarioEstado = current === "abandono" ? "activo" : "abandono";

  const { error: upErr, status: st2, statusText: stt2 } = await supabase
    .from(USUARIOS_TABLE)
    .update({ estado: next })
    .eq("id", id);

  if (upErr) {
    console.error(`[toggleAbandono/update] ${st2} ${stt2} - ${upErr.code} ${upErr.message}`);
    throw upErr;
  }
  return next;
}

/** =========================
 *  Roles: set/añadir/quitar/leer
 *  ========================= */
export async function assignRoles(usuarioId: string, roles: Rol[]) {
  // Reemplaza todos los roles del usuario por 'roles'
  const { error: delErr, status, statusText } = await supabase
    .from(ROLES_TABLE)
    .delete()
    .eq("usuario_id", usuarioId);

  if (delErr) {
    console.error(`[assignRoles/delete] ${status} ${statusText} - ${delErr.code} ${delErr.message}`);
    throw delErr;
  }

  if (!roles.length) return;

  const rows = roles.map((r) => ({ usuario_id: usuarioId, rol: r }));
  const { error: insErr, status: st2, statusText: stt2 } = await supabase
    .from(ROLES_TABLE)
    .insert(rows);

  if (insErr) {
    console.error(`[assignRoles/insert] ${st2} ${stt2} - ${insErr.code} ${insErr.message}`);
    throw insErr;
  }
}

export async function addRole(usuarioId: string, rol: Rol) {
  const { data, error } = await supabase
    .from(ROLES_TABLE)
    .select("id")
    .eq("usuario_id", usuarioId)
    .eq("rol", rol)
    .maybeSingle();

  if (error) throw error;
  if (!data) {
    const { error: insErr } = await supabase
      .from(ROLES_TABLE)
      .insert({ usuario_id: usuarioId, rol });
    if (insErr) throw insErr;
  }
}

export async function removeRole(usuarioId: string, rol: Rol) {
  const { error } = await supabase
    .from(ROLES_TABLE)
    .delete()
    .eq("usuario_id", usuarioId)
    .eq("rol", rol);
  if (error) throw error;
}

export async function getRoles(usuarioId: string): Promise<Rol[]> {
  const { data, error, status, statusText } = await supabase
    .from(ROLES_TABLE)
    .select("rol")
    .eq("usuario_id", usuarioId);

  if (error) {
    console.error(`[getRoles] ${status} ${statusText} - ${error.code} ${error.message}`);
    return [];
  }
  return (data ?? []).map((r: any) => r.rol) as Rol[];
}

export async function ensureRole(usuarioId: string, rol: Rol) {
  const { data, error, status, statusText } = await supabase
    .from(ROLES_TABLE)
    .select("id")
    .eq("usuario_id", usuarioId)
    .eq("rol", rol)
    .maybeSingle();

  if (error) {
    console.error(`[ensureRole/select] ${status} ${statusText} - ${error.code} ${error.message}`);
    throw error;
  }

  if (!data) {
    const { error: insErr, status: st2, statusText: stt2 } = await supabase
      .from(ROLES_TABLE)
      .insert({ usuario_id: usuarioId, rol });

    if (insErr) {
      console.error(`[ensureRole/insert] ${st2} ${stt2} - ${insErr.code} ${insErr.message}`);
      throw insErr;
    }
  }
}
