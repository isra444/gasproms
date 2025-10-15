// src/components/RoleGuard.tsx
"use client";

import { useEffect, useMemo, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useUserStore, Role } from "@/store/useUserStore";

type RolCanon = "admin" | "docente" | "alumno" | "coordinador";

type Props = {
  children: React.ReactNode;
  allow?: RolCanon[];
  allowedRoles?: string[];
  redirectTo?: string;
  fallback?: React.ReactNode;
  publicRoutes?: string[];
};

const ROLE_HOME: Record<RolCanon, string> = {
  admin: "/admin",
  docente: "/docente",
  coordinador: "/coordinador",
  alumno: "/alumno",
};

export default function RoleGuard({
  children,
  allow,
  allowedRoles,
  redirectTo,
  fallback,
  publicRoutes,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();

  // Selecciona SÓLO valores planos del store (sin construir arrays/objetos aquí)
  const authReady = useUserStore((s) => s.authReady);
  const user = useUserStore((s) => s.user);
  const activeRole = useUserStore((s) => s.activeRole as RolCanon | null);
  const setActiveRole = useUserStore((s) => s.setActiveRole);

  // Para evitar el warning, selecciona roles “raw” y combínalos luego con useMemo
  const rawRoles = useUserStore((s) => s.user?.roles);
  const compatRole = useUserStore((s) => s.user?.role);

  // ---- Derivados (con memo) ----
  const publicPrefixes = useMemo(() => {
    const base = ["/login", "/signup", "/reset-password", "/unauthorized"];
    return [...new Set([...(publicRoutes ?? []), ...base])];
  }, [publicRoutes]);

  const isPublic = useMemo(
    () => publicPrefixes.some((p) => pathname === p || pathname.startsWith(p + "/")),
    [pathname, publicPrefixes]
  );

  const normalizedAllow = useMemo<RolCanon[] | undefined>(() => {
    const list = (allow && allow.length ? allow : allowedRoles) ?? [];
    const cleaned = list
      .map((r: any) => String(r).toLowerCase().trim())
      .filter(Boolean) as RolCanon[];
    return cleaned.length ? (Array.from(new Set(cleaned)) as RolCanon[]) : undefined;
  }, [allow, allowedRoles]);

  const userRoles = useMemo<RolCanon[]>(() => {
    const arr: Role[] = [
      ...(rawRoles ?? []),
      ...(compatRole ? [compatRole] : []),
    ];
    const cleaned = arr
      .map((r) => String(r).toLowerCase().trim())
      .filter(Boolean) as RolCanon[];
    return Array.from(new Set(cleaned));
  }, [rawRoles, compatRole]);

  const status: "waiting" | "guest" | "authed" = useMemo(() => {
    if (typeof user === "undefined") return "waiting";
    if (user === null) return authReady ? "guest" : "waiting";
    return "authed";
  }, [user, authReady]);

  // Evitar replace duplicados
  const redirected = useRef<string | null>(null);
  useEffect(() => {
    redirected.current = null;
  }, [pathname]);

  // Alinear activeRole si la ruta exige un rol específico
  useEffect(() => {
    if (status !== "authed") return;
    if (!normalizedAllow || normalizedAllow.length === 0) return;
    if (!userRoles.length) return;

    const activeOk = activeRole ? normalizedAllow.includes(activeRole) : false;
    if (!activeOk) {
      const candidate = normalizedAllow.find((r) => userRoles.includes(r)) ?? null;
      if (candidate) setActiveRole(candidate);
    }
  }, [status, normalizedAllow, userRoles, activeRole, setActiveRole]);

  // Lógica de protección y redirects
  useEffect(() => {
    if (redirected.current) return;

    if (status === "waiting") return;
    if (isPublic) return;

    if (status === "guest") {
      redirected.current = "/login";
      router.replace("/login");
      return;
    }

    if (status === "authed" && normalizedAllow && normalizedAllow.length > 0) {
      const hasAccess =
        userRoles.length > 0 && normalizedAllow.some((r) => userRoles.includes(r));
      if (!hasAccess) {
        const firstRole = (activeRole ?? userRoles[0]) as RolCanon | undefined;
        const dest =
          redirectTo || (firstRole ? ROLE_HOME[firstRole] : "/unauthorized");
        redirected.current = dest;
        router.replace(dest);
      }
    }
  }, [status, isPublic, normalizedAllow, userRoles, activeRole, redirectTo, router]);

  // Fallbacks
  if (status === "waiting") {
    return (
      <>
        {fallback ?? (
          <div className="flex items-center justify-center min-h-screen">
            <p className="text-lg font-semibold animate-pulse">Cargando…</p>
          </div>
        )}
      </>
    );
  }

  if (!isPublic && status === "guest") {
    return (
      <>
        {fallback ?? (
          <div className="flex items-center justify-center min-h-screen">
            <p className="text-lg font-semibold">Redirigiendo…</p>
          </div>
        )}
      </>
    );
  }

  if (status === "authed" && normalizedAllow && normalizedAllow.length > 0) {
    const hasAccess =
      userRoles.length > 0 && normalizedAllow.some((r) => userRoles.includes(r));
    if (!hasAccess) {
      return (
        <>
          {fallback ?? (
            <div className="flex items-center justify-center min-h-screen">
              <p className="text-lg font-semibold">Redirigiendo…</p>
            </div>
          )}
        </>
      );
    }
  }

  return <>{children}</>;
}
