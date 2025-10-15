// store/useUserStore.ts
import { create } from "zustand";
import { persist } from "zustand/middleware";

export type Role = "admin" | "docente" | "alumno" | "coordinador" | string;

// ⬅️ Añadimos estado con "abandono" incluido
export type UsuarioEstado = "activo" | "inactivo" | "abandono";

export type User = {
  id: string;
  email: string;
  nombre_completo?: string;

  /** Compatibilidad: rol único usado en código previo */
  role?: Role;

  /** Nuevo: múltiples roles */
  roles?: Role[];

  /** ⬅️ Nuevo: estado del usuario (para mostrar ABANDONO en alumno) */
  estado?: UsuarioEstado;
} | null;

type State = {
  /** undefined: aún hidratando; null: sin sesión; objeto: logueado */
  user: User | undefined;

  /** Rol activo para la UI (ej. cuando un usuario tiene varios) */
  activeRole: Role | null;

  /** Cargando procesos de auth (útil para spinners de UI) */
  isAuthLoading: boolean;

  /** Hidratación de zustand-persist completada */
  hasHydrated: boolean;

  /** Indica que Auth ya resolvió la sesión (RoleGuard, redirects). */
  authReady: boolean;

  // --- setters principales ---
  setUser: (user: User) => void;

  /** Compat: rol único */
  setRole: (role: Role | undefined) => void;

  /** Nuevo: múltiples roles */
  setRoles: (roles: Role[] | undefined) => void;
  addRole: (role: Role) => void;
  removeRole: (role: Role) => void;

  /** Elegir rol activo para la UI */
  setActiveRole: (role: Role | null) => void;

  /** Limpiar sesión */
  clearUser: () => void;

  // --- banderas de loading ---
  startAuthLoading: () => void;
  stopAuthLoading: () => void;

  // --- hidratación y authReady ---
  setHasHydrated: (v: boolean) => void;
  setAuthReady: (v: boolean) => void;

  // --- helpers de consulta ---
  getRoles: () => Role[];
  getPrimaryRole: () => Role | null;
  hasAnyRole: (...r: Role[]) => boolean;

  // --- reset suave ---
  reset: () => void;
};

/** ACEPTA undefined para evitar el error de tipos durante hidratación */
function normalizeRoles(u: User | undefined): Role[] {
  if (!u) return [];
  const list = new Set<Role>([...(u.roles ?? []), ...(u.role ? [u.role] : [])]);
  return Array.from(list);
}

export const useUserStore = create<State>()(
  persist(
    (set, get) => ({
      user: undefined,
      activeRole: null,
      isAuthLoading: true,
      hasHydrated: false,
      authReady: false,

      setUser: (user) => {
        const roles = normalizeRoles(user);
        const currActive = get().activeRole;
        const nextActive =
          roles.includes(currActive as Role) ? currActive : roles[0] ?? null;

        // ⬇️ No tocamos el valor de 'estado' si viene desde AuthProvider/BD
        const nextUser =
          user && typeof user === "object" ? { ...user, roles } : user;

        set({ user: nextUser, activeRole: nextActive });
      },

      setRole: (role) => {
        const u = get().user;
        if (!u || typeof u !== "object") return;

        const nextRoles = new Set<Role>(normalizeRoles(u));
        if (role) nextRoles.add(role);

        const roles = Array.from(nextRoles);
        const nextActive =
          get().activeRole && roles.includes(get().activeRole!)
            ? get().activeRole
            : role ?? roles[0] ?? null;

        set({
          user: { ...u, role, roles },
          activeRole: nextActive,
        });
      },

      setRoles: (roles) => {
        const u = get().user;
        if (!u || typeof u !== "object") return;

        const rolesArr = Array.from(new Set<Role>(roles ?? []));
        const primary = u.role && rolesArr.includes(u.role) ? u.role : rolesArr[0];

        const currActive = get().activeRole;
        const nextActive =
          currActive && rolesArr.includes(currActive) ? currActive : primary ?? null;

        set({
          user: { ...u, role: primary, roles: rolesArr },
          activeRole: nextActive,
        });
      },

      addRole: (role) => {
        const u = get().user;
        if (!u || typeof u !== "object") return;

        const next = new Set<Role>(normalizeRoles(u));
        next.add(role);
        const roles = Array.from(next);

        const primary = u.role ?? roles[0];
        const nextActive =
          get().activeRole && roles.includes(get().activeRole!)
            ? get().activeRole
            : primary ?? null;

        set({
          user: { ...u, role: primary, roles },
          activeRole: nextActive,
        });
      },

      removeRole: (role) => {
        const u = get().user;
        if (!u || typeof u !== "object") return;

        const next = new Set<Role>(normalizeRoles(u));
        next.delete(role);
        const roles = Array.from(next);

        let primary = u.role;
        if (primary && !roles.includes(primary)) {
          primary = roles[0];
        }

        let active = get().activeRole;
        if (active && !roles.includes(active)) {
          active = primary ?? null;
        }

        set({
          user: { ...u, role: primary, roles },
          activeRole: active ?? null,
        });
      },

      setActiveRole: (role) => {
        const roles = get().getRoles();
        set({ activeRole: role && roles.includes(role) ? role : roles[0] ?? null });
      },

      clearUser: () => set({ user: null, activeRole: null }),

      startAuthLoading: () => set({ isAuthLoading: true }),
      stopAuthLoading: () => set({ isAuthLoading: false }),

      setHasHydrated: (v) => set({ hasHydrated: v }),
      setAuthReady: (v) => set({ authReady: v }),

      getRoles: () => normalizeRoles(get().user),
      getPrimaryRole: () => {
        const u = get().user;
        if (!u || typeof u !== "object") return null;
        const roles = normalizeRoles(u);
        return u.role && roles.includes(u.role) ? u.role : roles[0] ?? null;
      },
      hasAnyRole: (...r) => {
        const roles = normalizeRoles(get().user);
        return r.some((x) => roles.includes(x));
      },

      reset: () =>
        set({
          user: null,
          activeRole: null,
          isAuthLoading: false,
          hasHydrated: true,
          authReady: false,
        }),
    }),
    {
      name: "gasproms-user",
      /** Persistimos 'user' y 'activeRole'. */
      partialize: (state) => ({ user: state.user, activeRole: state.activeRole }),
      onRehydrateStorage: () => (state, error) => {
        if (error) {
          useUserStore.setState({ user: null, activeRole: null });
        }
        const curr = useUserStore.getState();
        if (curr.user === undefined) {
          useUserStore.setState({ user: null });
        }
        const roles = normalizeRoles(useUserStore.getState().user);
        const currActive = useUserStore.getState().activeRole;
        const nextActive = roles.includes(currActive as Role) ? currActive : roles[0] ?? null;

        useUserStore.setState({
          user:
            curr.user && typeof curr.user === "object"
              ? { ...curr.user, roles } // ⬅️ mantenemos 'estado' si venía del persist
              : curr.user,
          activeRole: nextActive,
          hasHydrated: true,
          isAuthLoading: false,
          authReady: false, // lo activará AuthProvider al terminar bootstrap
        });
      },
    }
  )
);
