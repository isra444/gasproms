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
  tag = "withTimeout",
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

  const { setUser, setRole, setRoles, startAuthLoading, stopAuthLoading } =
    useUserStore();

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
        "auth.signInWithPassword",
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
        "select roles_usuario",
      );

      if (rolesErr) {
        console.warn("Error obteniendo roles:", rolesErr.message);
      }

      const roles: string[] = (rolesRows ?? [])
        .map((r: any) =>
          String(r.rol || "")
            .toLowerCase()
            .trim(),
        )
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
        setError(
          "Tu cuenta aún no tiene rol asignado. Contacta con el administrador.",
        );
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

  const disabled = useMemo(
    () => isSubmitting || saving,
    [isSubmitting, saving],
  );

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--bg)]">
      <div className="flex w-full max-w-4xl overflow-hidden rounded-2xl bg-[var(--panel)] text-[var(--text)] shadow-lg">
        {/* Columna izquierda */}
        <div className="hidden w-1/2 flex-col items-center justify-center border-r border-[var(--muted)] bg-[var(--bg)] p-8 md:flex">
          <img
            src="/logo.png"
            alt="Logo"
            className="w-100 mb-6 h-20 rounded-md shadow"
          />
          <h2 className="mb-4 text-2xl font-bold">Bienvenido</h2>
          <p className="text-center text-[var(--text-muted)]">
            Accede con tu correo y contraseña. Si aún no tienes rol asignado,
            espera a que el administrador lo configure.
          </p>
          <img
            src="/illustration.png"
            alt="Ilustración"
            className="mt-8 h-40 w-40"
          />
        </div>

        {/* Columna derecha (formulario) */}
        <div className="flex w-full flex-col justify-center p-10 md:w-1/2">
          <h2 className="mb-6 text-center text-3xl font-bold">
            Iniciar sesión
          </h2>

          <form
            onSubmit={handleSubmit(onSubmit)}
            className="space-y-5"
            noValidate
          >
            <div>
              <label className="mb-1 block">Correo</label>
              <input
                type="email"
                {...register("email")}
                className="w-full rounded-lg border border-[var(--muted)] bg-[var(--bg)] px-4 py-2 text-[var(--text)] placeholder-[var(--text-muted)] focus:ring-2 focus:ring-[var(--primary)]"
                placeholder="ejemplo@correo.com"
                autoComplete="email"
                inputMode="email"
                required
              />
              {errors.email && (
                <p className="text-sm text-[var(--danger)]">
                  {errors.email.message}
                </p>
              )}
            </div>

            <div>
              <label className="mb-1 block">Contraseña</label>
              <input
                type="password"
                {...register("password")}
                className="w-full rounded-lg border border-[var(--muted)] bg-[var(--bg)] px-4 py-2 text-[var(--text)] placeholder-[var(--text-muted)] focus:ring-2 focus:ring-[var(--primary)]"
                placeholder="********"
                autoComplete="current-password"
                required
              />
              {errors.password && (
                <p className="text-sm text-[var(--danger)]">
                  {errors.password.message}
                </p>
              )}
            </div>

            {error && (
              <div className="border-[var(--danger)]/40 bg-[var(--danger)]/10 rounded-md border p-3 text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={disabled}
              className="w-full rounded-lg bg-[var(--primary)] py-2 text-white transition hover:opacity-90 disabled:opacity-50"
            >
              {disabled ? "Ingresando..." : "Ingresar"}
            </button>
          </form>

          <div className="mt-4 flex items-center justify-between text-sm text-[var(--text-muted)]">
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
