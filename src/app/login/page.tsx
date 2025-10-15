// src/app/login/page.tsx
"use client";

import { useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { useUserStore } from "@/store/useUserStore";

const loginSchema = z.object({
  email: z.string().email("Correo inválido"),
  password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres"),
});
type LoginForm = z.infer<typeof loginSchema>;

/** Acepta Promise o Thenable (PromiseLike) y evita quedarse en “Ingresando…” */
async function withTimeout<T>(
  p: PromiseLike<T>,
  ms = 15000,
  tag = "withTimeout"
): Promise<T> {
  let t: any;
  const timeout = new Promise<never>((_, reject) => {
    t = setTimeout(() => reject(new Error(`Timeout ${tag} (${ms}ms)`)), ms);
  });
  try {
    // Forzamos a T para que no derive a unknown
    return (await Promise.race([p as any, timeout])) as T;
  } finally {
    clearTimeout(t);
  }
}

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false); // evita doble submit

  const { setUser, setRole, setRoles, startAuthLoading, stopAuthLoading } = useUserStore();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    mode: "onSubmit",
  });

  const redirectByRole = (role: string) => {
    const map: Record<string, string> = {
      admin: "/admin",
      docente: "/docente",
      alumno: "/alumno",
      coordinador: "/coordinador",
    };
    router.replace(map[role] ?? "/unauthorized");
  };

  const lastSubmitRef = useRef<number>(0);

  const onSubmit = async (data: LoginForm) => {
    // Anti-doble click (y doble disparo de StrictMode) en 400ms
    const now = Date.now();
    if (now - lastSubmitRef.current < 400 || saving) return;
    lastSubmitRef.current = now;

    setError(null);
    setSaving(true);
    startAuthLoading();

    try {
      // 1) Login (Thenable) con timeout
      const { data: authData, error: authError } = await withTimeout(
        supabase.auth.signInWithPassword({
          email: data.email,
          password: data.password,
        }),
        15000,
        "auth.signInWithPassword"
      );

      if (authError) {
        setError(authError.message || "Credenciales inválidas.");
        return;
      }

      const user = authData?.user;
      if (!user) {
        setError("No se pudo obtener el usuario.");
        return;
      }

      // 2) Usuario base en el store (sin rol aún)
      setUser({
        id: user.id,
        email: user.email ?? "",
      });

      // 3) Roles (Thenable) con timeout — nombres y comillas CORRECTOS
      const { data: rolesRows, error: rolesErr } = await withTimeout(
        supabase.from("roles_usuario").select("rol").eq("usuario_id", user.id),
        12000,
        "select roles_usuario"
      );

      if (rolesErr) {
        console.warn("Error obteniendo roles:", rolesErr.message);
      }

      const roles: string[] = (rolesRows ?? [])
        .map((r: any) => String(r.rol || "").toLowerCase().trim())
        .filter(Boolean);

      const primaryRole = roles[0] ?? "";

      // 4) Store (compat `role` + array `roles`)
      setRoles?.(roles);
      setRole?.(primaryRole || undefined);
      setUser({
        id: user.id,
        email: user.email ?? "",
        role: primaryRole || undefined,
        roles,
      });

      // 5) Redirección por rol
      if (!primaryRole) {
        setError("Tu cuenta aún no tiene rol asignado. Contacta con el administrador.");
        return;
      }
      redirectByRole(primaryRole);
    } catch (e: any) {
      console.error(e);
      setError(e?.message ?? "Error inesperado. Intenta de nuevo.");
    } finally {
      stopAuthLoading();
      setSaving(false);
    }
  };

  const disabled = useMemo(() => isSubmitting || saving, [isSubmitting, saving]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--bg)]">
      <div className="w-full max-w-4xl bg-[var(--panel)] shadow-lg rounded-2xl flex overflow-hidden text-[var(--text)]">
        {/* Columna izquierda */}
        <div className="hidden md:flex flex-col justify-center items-center w-1/2 bg-[var(--bg)] border-r border-[var(--muted)] p-8">
          <img src="/logo.png" alt="Logo" className="w-24 h-24 mb-6 rounded-full shadow" />
          <h2 className="text-2xl font-bold mb-4">Bienvenido</h2>
          <p className="text-[var(--text-muted)] text-center">
            Accede con tu correo y contraseña. Si aún no tienes rol asignado,
            espera a que el administrador lo configure.
          </p>
          <img src="/illustration.png" alt="Ilustración" className="w-40 h-40 mt-8" />
        </div>

        {/* Columna derecha (formulario) */}
        <div className="w-full md:w-1/2 p-10 flex flex-col justify-center">
          <h2 className="text-3xl font-bold mb-6 text-center">Iniciar sesión</h2>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
            <div>
              <label className="block mb-1">Correo</label>
              <input
                type="email"
                {...register("email")}
                className="w-full px-4 py-2 border border-[var(--muted)] rounded-lg focus:ring-2 focus:ring-[var(--primary)] bg-[var(--bg)] text-[var(--text)] placeholder-[var(--text-muted)]"
                placeholder="ejemplo@correo.com"
                autoComplete="email"
                inputMode="email"
                required
              />
              {errors.email && <p className="text-[var(--danger)] text-sm">{errors.email.message}</p>}
            </div>

            <div>
              <label className="block mb-1">Contraseña</label>
              <input
                type="password"
                {...register("password")}
                className="w-full px-4 py-2 border border-[var(--muted)] rounded-lg focus:ring-2 focus:ring-[var(--primary)] bg-[var(--bg)] text-[var(--text)] placeholder-[var(--text-muted)]"
                placeholder="********"
                autoComplete="current-password"
                required
              />
              {errors.password && <p className="text-[var(--danger)] text-sm">{errors.password.message}</p>}
            </div>

            {error && (
              <div className="rounded-md border border-[var(--danger)]/40 bg-[var(--danger)]/10 p-3 text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={disabled}
              className="w-full bg-[var(--primary)] text-white py-2 rounded-lg hover:opacity-90 transition disabled:opacity-50"
            >
              {disabled ? "Ingresando..." : "Ingresar"}
            </button>
          </form>

          <div className="flex justify-between items-center mt-4 text-sm text-[var(--text-muted)]">
            <a href="/reset-password" className="hover:underline">
              ¿Olvidaste tu contraseña?
            </a>
            <a href="/signup" className="text-[var(--primary)] hover:underline">
              Registrarse
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
