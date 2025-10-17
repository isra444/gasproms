"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { supabase } from "@/lib/supabaseClient";

// Opciones típicas para "expedido" (BO)
const EXPEDIDOS = [
  { value: "CH", label: "Chuquisaca" },
  { value: "LP", label: "La Paz" },
  { value: "CB", label: "Cochabamba" },
  { value: "OR", label: "Oruro" },
  { value: "PT", label: "Potosí" },
  { value: "TJ", label: "Tarija" },
  { value: "SC", label: "Santa Cruz" },
  { value: "BE", label: "Beni" },
  { value: "PD", label: "Pando" },
] as const;

const signupSchema = z.object({
  nombre_completo: z.string().min(3, "El nombre es requerido"),
  email: z.string().email("Correo inválido"),
  password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres"),
  celular: z
    .string()
    .optional()
    .refine((v) => !v || /^\d{7,15}$/.test(v), "Solo dígitos, 7–15 caracteres"),
  género: z.enum(["masculino", "femenino", "otro"]).optional(),
  profesión: z.string().optional(),
  universidad_titulado: z.string().optional(),
  cedula: z.string().min(5, "Cédula inválida"),
  expedido: z.enum(EXPEDIDOS.map((e) => e.value) as [string, ...string[]]),
});

type SignupForm = z.infer<typeof signupSchema>;

export default function SignupPage() {
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignupForm>({ resolver: zodResolver(signupSchema) });

  const onSubmit = async (data: SignupForm) => {
    setError(null);
    setSuccess(null);

    // 1) Crear cuenta en Auth
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
      options: {
        emailRedirectTo:
          typeof window !== "undefined"
            ? `${location.origin}/auth/callback`
            : undefined,
        data: { nombre_completo: data.nombre_completo }, // útil para el trigger
      },
    });

    if (authError) {
      console.error("Error en signUp:", authError.message);
      setError(authError.message);
      return;
    }

    const newUser = authData.user;
    if (!newUser) {
      setError("No se obtuvo el usuario después del registro.");
      return;
    }

    // 2) (Opcional) Completar campos en `usuarios` SOLO si la sesión es del usuario recién creado
    //    Si tu proyecto requiere confirmar email, no habrá sesión aún → el trigger ya creó el perfil.
    try {
      const { data: sessData } = await supabase.auth.getSession();
      const sessionUserId = sessData.session?.user?.id;

      if (sessionUserId && sessionUserId === newUser.id) {
        // Actualizamos campos “extra” del perfil ya creado por el trigger
        const { error: updateErr } = await supabase
          .from("usuarios")
          .update({
            nombre_completo: data.nombre_completo,
            celular: data.celular ?? null,
            género: data.género ?? null,
            profesión: data.profesión ?? null,
            universidad_titulado: data.universidad_titulado ?? null,
            cedula: data.cedula,
            expedido: data.expedido,
            fecha_inscripción: new Date().toISOString().split("T")[0],
            estado: "activo",
          })
          .eq("id", newUser.id);

        if (updateErr) {
          // No bloqueamos el registro si falla el update; el admin igual verá al usuario
          console.warn(
            "No se pudo actualizar campos extra del perfil:",
            updateErr.message,
          );
        }
      } else {
        // Sin sesión o sesión distinta → omitimos update; el trigger ya creó el perfil
        console.info(
          "Sin sesión del usuario recién creado; se omite update del perfil.",
        );
      }
    } catch (e) {
      console.warn(
        "No se pudo verificar/actualizar el perfil del usuario nuevo:",
        e,
      );
    }

    // 3) Mensaje y redirección
    setSuccess(
      "✅ Registro exitoso. Revisa tu correo y confirma tu cuenta. ATT: Gasproms",
    );
    setTimeout(() => {
      window.location.href = "/login";
    }, 3000);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--bg)]">
      <div className="w-full max-w-2xl rounded-2xl bg-[var(--panel)] p-8 text-[var(--text)] shadow-lg">
        <h2 className="mb-6 text-center text-2xl font-bold">Crear cuenta</h2>

        <form
          onSubmit={handleSubmit(onSubmit)}
          className="grid grid-cols-1 gap-4 md:grid-cols-2"
        >
          {/* Nombre */}
          <div className="md:col-span-2">
            <label className="mb-1 block text-[var(--text)]">
              Nombre completo
            </label>
            <input
              type="text"
              {...register("nombre_completo")}
              className="w-full rounded-lg border border-[var(--muted)] bg-[var(--bg)] px-4 py-2 text-[var(--text)] placeholder-[var(--text-muted)] focus:ring-2 focus:ring-[var(--primary)]"
              placeholder="Tu nombre"
            />
            {errors.nombre_completo && (
              <p className="text-sm text-[var(--danger)]">
                {errors.nombre_completo.message}
              </p>
            )}
          </div>

          {/* Correo */}
          <div>
            <label className="mb-1 block text-[var(--text)]">Correo</label>
            <input
              type="email"
              {...register("email")}
              className="w-full rounded-lg border border-[var(--muted)] bg-[var(--bg)] px-4 py-2 text-[var(--text)] placeholder-[var(--text-muted)] focus:ring-2 focus:ring-[var(--primary)]"
              placeholder="ejemplo@correo.com"
            />
            {errors.email && (
              <p className="text-sm text-[var(--danger)]">
                {errors.email.message}
              </p>
            )}
          </div>

          {/* Contraseña */}
          <div>
            <label className="mb-1 block text-[var(--text)]">Contraseña</label>
            <input
              type="password"
              {...register("password")}
              className="w-full rounded-lg border border-[var(--muted)] bg-[var(--bg)] px-4 py-2 text-[var(--text)] placeholder-[var(--text-muted)] focus:ring-2 focus:ring-[var(--primary)]"
              placeholder="********"
            />
            {errors.password && (
              <p className="text-sm text-[var(--danger)]">
                {errors.password.message}
              </p>
            )}
          </div>

          {/* Celular */}
          <div>
            <label className="mb-1 block text-[var(--text)]">Celular</label>
            <input
              type="text"
              {...register("celular")}
              className="w-full rounded-lg border border-[var(--muted)] bg-[var(--bg)] px-4 py-2 text-[var(--text)] placeholder-[var(--text-muted)] focus:ring-2 focus:ring-[var(--primary)]"
              placeholder="Ej: 78912345"
            />
            {errors.celular && (
              <p className="text-sm text-[var(--danger)]">
                {errors.celular.message}
              </p>
            )}
          </div>

          {/* Género */}
          <div>
            <label className="mb-1 block text-[var(--text)]">Género</label>
            <select
              {...register("género")}
              className="w-full rounded-lg border border-[var(--muted)] bg-[var(--bg)] px-4 py-2 text-[var(--text)] focus:ring-2 focus:ring-[var(--primary)]"
              defaultValue=""
            >
              <option value="">Seleccione…</option>
              <option value="masculino">Masculino</option>
              <option value="femenino">Femenino</option>
              <option value="otro">Otro</option>
            </select>
            {errors.género && (
              <p className="text-sm text-[var(--danger)]">
                {errors.género.message}
              </p>
            )}
          </div>

          {/* Profesión */}
          <div>
            <label className="mb-1 block text-[var(--text)]">Profesión</label>
            <input
              type="text"
              {...register("profesión")}
              className="w-full rounded-lg border border-[var(--muted)] bg-[var(--bg)] px-4 py-2 text-[var(--text)] placeholder-[var(--text-muted)] focus:ring-2 focus:ring-[var(--primary)]"
              placeholder="Ej: Ingeniero(a)"
            />
            {errors.profesión && (
              <p className="text-sm text-[var(--danger)]">
                {errors.profesión.message}
              </p>
            )}
          </div>

          {/* Universidad */}
          <div>
            <label className="mb-1 block text-[var(--text)]">
              Universidad de titulación
            </label>
            <input
              type="text"
              {...register("universidad_titulado")}
              className="w-full rounded-lg border border-[var(--muted)] bg-[var(--bg)] px-4 py-2 text-[var(--text)] placeholder-[var(--text-muted)] focus:ring-2 focus:ring-[var(--primary)]"
              placeholder="Ej: UMSA"
            />
            {errors.universidad_titulado && (
              <p className="text-sm text-[var(--danger)]">
                {errors.universidad_titulado.message}
              </p>
            )}
          </div>

          {/* Cédula */}
          <div>
            <label className="mb-1 block text-[var(--text)]">
              Cédula de identidad
            </label>
            <input
              type="text"
              {...register("cedula")}
              className="w-full rounded-lg border border-[var(--muted)] bg-[var(--bg)] px-4 py-2 text-[var(--text)] placeholder-[var(--text-muted)] focus:ring-2 focus:ring-[var(--primary)]"
              placeholder="Ej: 12345678"
            />
            {errors.cedula && (
              <p className="text-sm text-[var(--danger)]">
                {errors.cedula.message}
              </p>
            )}
          </div>

          {/* Expedido */}
          <div>
            <label className="mb-1 block text-[var(--text)]">Expedido</label>
            <select
              {...register("expedido")}
              className="w-full rounded-lg border border-[var(--muted)] bg-[var(--bg)] px-4 py-2 text-[var(--text)] focus:ring-2 focus:ring-[var(--primary)]"
              defaultValue=""
            >
              <option value="" disabled>
                Seleccione…
              </option>
              {EXPEDIDOS.map((e) => (
                <option key={e.value} value={e.value}>
                  {e.label}
                </option>
              ))}
            </select>
            {errors.expedido && (
              <p className="text-sm text-[var(--danger)]">
                {errors.expedido.message}
              </p>
            )}
          </div>

          {/* Mensajes */}
          {error && (
            <div className="md:col-span-2">
              <p className="text-sm text-[var(--danger)]">{error}</p>
            </div>
          )}
          {success && (
            <div className="md:col-span-2">
              <p className="text-sm text-[var(--success)]">{success}</p>
            </div>
          )}

          {/* Botón */}
          <div className="md:col-span-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full rounded-lg bg-[var(--primary)] py-2 text-white transition hover:opacity-90 disabled:opacity-50"
            >
              {isSubmitting ? "Creando..." : "Registrarse"}
            </button>
          </div>
        </form>

        <p className="mt-4 text-center text-sm text-[var(--text-muted)]">
          ¿Ya tienes cuenta?{" "}
          <a href="/login" className="text-[var(--primary)] hover:underline">
            Inicia sesión
          </a>
        </p>
      </div>
    </div>
  );
}
