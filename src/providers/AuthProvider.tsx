"use client";

import { useEffect, useRef } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useUserStore, Role, UsuarioEstado } from "@/store/useUserStore";
import type { AuthChangeEvent, Session } from "@supabase/supabase-js";

function uniqRoles(list: Role[]): Role[] {
  return Array.from(new Set(list.filter(Boolean)));
}

async function fetchProfileAndRoles(userId: string) {
  const [{ data: usr }, { data: rolesRows }] = await Promise.all([
    supabase
      .from("usuarios")
      .select("id, correo, nombre_completo, estado") // ⬅️ añadimos estado
      .eq("id", userId)
      .maybeSingle(),
    supabase.from("roles_usuario").select("rol").eq("usuario_id", userId),
  ]);

  const email = usr?.correo ?? null;
  const nombre = usr?.nombre_completo ?? null;
  const estado = (usr?.estado as UsuarioEstado) ?? "activo"; // ⬅️ normalizamos
  const rolesList = uniqRoles(
    ((rolesRows ?? []).map((r) => (r.rol as Role) || "alumno") as Role[]) || []
  );

  return { email, nombre, estado, rolesList };
}

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  const {
    setUser,
    setRole,          // compat
    setRoles,         // multirrol
    setActiveRole,    // rol activo de UI
    clearUser,
    startAuthLoading,
    stopAuthLoading,
    setAuthReady,
  } = useUserStore();

  const mountedRef = useRef(true);
  const pendingOps = useRef(0);
  const inFlightFocus = useRef(false);

  const beginOp = () => {
    pendingOps.current += 1;
    if (pendingOps.current === 1) {
      setAuthReady(false);
      startAuthLoading();
    }
  };
  const endOp = () => {
    pendingOps.current = Math.max(0, pendingOps.current - 1);
    if (pendingOps.current === 0) {
      stopAuthLoading();
      setAuthReady(true);
    }
  };

  /** Aplica user + roles + activeRole + estado (mantiene compat) */
  const setAll = (u: {
    id: string;
    email: string;
    nombre?: string | null;
    estado: UsuarioEstado;
    roles: Role[];
  }) => {
    const roles = uniqRoles(u.roles);
    const first = roles[0] ?? undefined;

    // conservar activeRole si sigue siendo válido
    const currActive = useUserStore.getState().activeRole;
    const nextActive =
      currActive && roles.includes(currActive as Role)
        ? currActive
        : (first ?? null);

    // setea el user (compat: .role = primer rol)
    setUser({
      id: u.id,
      email: u.email,
      nombre_completo: u.nombre ?? undefined,
      role: first,   // compat con código viejo
      roles,         // nuevo
      estado: u.estado, // ⬅️ importante para mostrar ABANDONO en alumno
    });

    // sincroniza helpers del store
    setRoles?.(roles);
    setRole?.(first);            // compat
    setActiveRole?.(nextActive); // UI basada en rol activo
  };

  // visible
  const applySessionVisible = async () => {
    beginOp();
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const u = session?.user ?? null;

      if (u) {
        const { email, nombre, estado, rolesList } = await fetchProfileAndRoles(u.id);
        if (!mountedRef.current) return;
        setAll({
          id: u.id,
          email: email ?? u.email ?? "",
          nombre,
          estado,
          roles: rolesList,
        });
      } else {
        if (!mountedRef.current) return;
        clearUser();
        setActiveRole?.(null);
      }
    } catch {
      if (!mountedRef.current) return;
      clearUser();
      setActiveRole?.(null);
    } finally {
      if (!mountedRef.current) return;
      endOp();
    }
  };

  // silencioso
  const applySessionSilent = async () => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const u = session?.user ?? null;
      if (u) {
        const { email, nombre, estado, rolesList } = await fetchProfileAndRoles(u.id);
        if (!mountedRef.current) return;
        setAll({
          id: u.id,
          email: email ?? u.email ?? "",
          nombre,
          estado,
          roles: rolesList,
        });
      }
      // si es null: no limpiamos (evita parpadeo)
    } catch {
      // ignore silencioso
    }
  };

  useEffect(() => {
    mountedRef.current = true;

    // bootstrap inicial
    applySessionVisible();

    // eventos de auth
    const handleAuth = async (event: AuthChangeEvent, session: Session | null) => {
      switch (event) {
        case "SIGNED_OUT": {
          beginOp();
          try {
            if (!mountedRef.current) return;
            clearUser();
            setActiveRole?.(null);
          } finally {
            if (!mountedRef.current) return;
            endOp();
          }
          break;
        }
        case "SIGNED_IN":
        case "USER_UPDATED":
        case "INITIAL_SESSION": {
          if (session?.user) {
            beginOp();
            try {
              const u = session.user;
              const { email, nombre, estado, rolesList } = await fetchProfileAndRoles(u.id);
              if (!mountedRef.current) return;
              setAll({
                id: u.id,
                email: email ?? u.email ?? "",
                nombre,
                estado,
                roles: rolesList,
              });
            } catch {
              // no limpiar aquí
            } finally {
              if (!mountedRef.current) return;
              endOp();
            }
          }
          break;
        }
        case "TOKEN_REFRESHED": {
          // silencioso
          if (session?.user) {
            const u = session.user;
            try {
              const { email, nombre, estado, rolesList } = await fetchProfileAndRoles(u.id);
              if (!mountedRef.current) return;
              setAll({
                id: u.id,
                email: email ?? u.email ?? "",
                nombre,
                estado,
                roles: rolesList,
              });
            } catch {
              // ignore
            }
          }
          break;
        }
        default:
          // PASSWORD_RECOVERY, MFA_CHALLENGE_VERIFIED, etc
          break;
      }
    };

    const { data: sub } = supabase.auth.onAuthStateChange(handleAuth);

    // revalidar al volver a foco (silencioso)
    const refetchOnFocus = () => {
      if (document.hidden) return;
      if (inFlightFocus.current) return;
      inFlightFocus.current = true;
      setTimeout(() => {
        if (!mountedRef.current) return;
        applySessionSilent().finally(() => {
          inFlightFocus.current = false;
        });
      }, 60);
    };
    window.addEventListener("visibilitychange", refetchOnFocus);
    window.addEventListener("focus", refetchOnFocus);

    return () => {
      mountedRef.current = false;
      sub?.subscription?.unsubscribe();
      window.removeEventListener("visibilitychange", refetchOnFocus);
      window.removeEventListener("focus", refetchOnFocus);
    };
  }, [
    setUser,
    setRole,
    setRoles,
    setActiveRole,
    clearUser,
    startAuthLoading,
    stopAuthLoading,
    setAuthReady,
  ]);

  return <>{children}</>;
}
