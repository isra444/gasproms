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
  } = useForm<SignupForm>({
    resolver: zodResolver(signupSchema),
  });

  const onSubmit = async (data: SignupForm) => {
    setError(null);
    setSuccess(null);

    // 1) Crear cuenta en Auth
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
    });
    if (authError) {
      setError(authError.message);
      return;
    }

    // 2) Insertar/asegurar fila en 'usuarios'
    const user = authData.user;
    if (user) {
      const { data: existente } = await supabase
        .from("usuarios")
        .select("id")
        .eq("correo", data.email)
        .maybeSingle();

      if (!existente) {
        const { error: dbError } = await supabase.from("usuarios").insert([
          {
            id: user.id,
            nombre_completo: data.nombre_completo,
            correo: data.email,
            celular: data.celular ?? null,
            género: data.género ?? null,
            profesión: data.profesión ?? null,
            universidad_titulado: data.universidad_titulado ?? null,
            cedula: data.cedula,
            expedido: data.expedido,
            fecha_inscripción: new Date().toISOString().split("T")[0],
            estado: "activo",
          },
        ]);
        if (dbError) {
          console.error("Error insertando en usuarios:", dbError.message);
          setError("Error registrando usuario en la base de datos.");
          return;
        }
      }
    }

    // 3) Aviso de confirmación
    setSuccess(
      "✅ Registro exitoso. Revisa tu correo y confirma tu cuenta. ATT: Gasproms"
      
    );
    setTimeout(() => {
      window.location.href = "/login";
    }, 3000);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--bg)]">
      <div className="w-full max-w-2xl bg-[var(--panel)] p-8 shadow-lg rounded-2xl text-[var(--text)]">
        <h2 className="text-2xl font-bold text-center mb-6">Crear cuenta</h2>

        <form
          onSubmit={handleSubmit(onSubmit)}
          className="grid grid-cols-1 md:grid-cols-2 gap-4"
        >
          {/* Nombre */}
          <div className="md:col-span-2">
            <label className="block text-[var(--text)] mb-1">
              Nombre completo
            </label>
            <input
              type="text"
              {...register("nombre_completo")}
              className="w-full px-4 py-2 border border-[var(--muted)] rounded-lg focus:ring-2 focus:ring-[var(--primary)] bg-[var(--bg)] text-[var(--text)] placeholder-[var(--text-muted)]"
              placeholder="Tu nombre"
            />
            {errors.nombre_completo && (
              <p className="text-[var(--danger)] text-sm">
                {errors.nombre_completo.message}
              </p>
            )}
          </div>

          {/* Correo */}
          <div>
            <label className="block text-[var(--text)] mb-1">Correo</label>
            <input
              type="email"
              {...register("email")}
              className="w-full px-4 py-2 border border-[var(--muted)] rounded-lg focus:ring-2 focus:ring-[var(--primary)] bg-[var(--bg)] text-[var(--text)] placeholder-[var(--text-muted)]"
              placeholder="ejemplo@correo.com"
            />
            {errors.email && (
              <p className="text-[var(--danger)] text-sm">
                {errors.email.message}
              </p>
            )}
          </div>

          {/* Contraseña */}
          <div>
            <label className="block text-[var(--text)] mb-1">Contraseña</label>
            <input
              type="password"
              {...register("password")}
              className="w-full px-4 py-2 border border-[var(--muted)] rounded-lg focus:ring-2 focus:ring-[var(--primary)] bg-[var(--bg)] text-[var(--text)] placeholder-[var(--text-muted)]"
              placeholder="********"
            />
            {errors.password && (
              <p className="text-[var(--danger)] text-sm">
                {errors.password.message}
              </p>
            )}
          </div>

          {/* Celular */}
          <div>
            <label className="block text-[var(--text)] mb-1">Celular</label>
            <input
              type="text"
              {...register("celular")}
              className="w-full px-4 py-2 border border-[var(--muted)] rounded-lg focus:ring-2 focus:ring-[var(--primary)] bg-[var(--bg)] text-[var(--text)] placeholder-[var(--text-muted)]"
              placeholder="Ej: 78912345"
            />
            {errors.celular && (
              <p className="text-[var(--danger)] text-sm">
                {errors.celular.message}
              </p>
            )}
          </div>

          {/* Género */}
          <div>
            <label className="block text-[var(--text)] mb-1">Género</label>
            <select
              {...register("género")}
              className="w-full px-4 py-2 border border-[var(--muted)] rounded-lg focus:ring-2 focus:ring-[var(--primary)] bg-[var(--bg)] text-[var(--text)]"
              defaultValue=""
            >
              <option value="">Seleccione…</option>
              <option value="masculino">Masculino</option>
              <option value="femenino">Femenino</option>
              <option value="otro">Otro</option>
            </select>
            {errors.género && (
              <p className="text-[var(--danger)] text-sm">
                {errors.género.message}
              </p>
            )}
          </div>

          {/* Profesión */}
          <div>
            <label className="block text-[var(--text)] mb-1">Profesión</label>
            <input
              type="text"
              {...register("profesión")}
              className="w-full px-4 py-2 border border-[var(--muted)] rounded-lg focus:ring-2 focus:ring-[var(--primary)] bg-[var(--bg)] text-[var(--text)] placeholder-[var(--text-muted)]"
              placeholder="Ej: Ingeniero(a)"
            />
            {errors.profesión && (
              <p className="text-[var(--danger)] text-sm">
                {errors.profesión.message}
              </p>
            )}
          </div>

          {/* Universidad */}
          <div>
            <label className="block text-[var(--text)] mb-1">
              Universidad de titulación
            </label>
            <input
              type="text"
              {...register("universidad_titulado")}
              className="w-full px-4 py-2 border border-[var(--muted)] rounded-lg focus:ring-2 focus:ring-[var(--primary)] bg-[var(--bg)] text-[var(--text)] placeholder-[var(--text-muted)]"
              placeholder="Ej: UMSA"
            />
            {errors.universidad_titulado && (
              <p className="text-[var(--danger)] text-sm">
                {errors.universidad_titulado.message}
              </p>
            )}
          </div>

          {/* Cédula */}
          <div>
            <label className="block text-[var(--text)] mb-1">
              Cédula de identidad
            </label>
            <input
              type="text"
              {...register("cedula")}
              className="w-full px-4 py-2 border border-[var(--muted)] rounded-lg focus:ring-2 focus:ring-[var(--primary)] bg-[var(--bg)] text-[var(--text)] placeholder-[var(--text-muted)]"
              placeholder="Ej: 12345678"
            />
            {errors.cedula && (
              <p className="text-[var(--danger)] text-sm">
                {errors.cedula.message}
              </p>
            )}
          </div>

          {/* Expedido */}
          <div>
            <label className="block text-[var(--text)] mb-1">Expedido</label>
            <select
              {...register("expedido")}
              className="w-full px-4 py-2 border border-[var(--muted)] rounded-lg focus:ring-2 focus:ring-[var(--primary)] bg-[var(--bg)] text-[var(--text)]"
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
              <p className="text-[var(--danger)] text-sm">
                {errors.expedido.message}
              </p>
            )}
          </div>

          {/* Mensajes */}
          {error && (
            <div className="md:col-span-2">
              <p className="text-[var(--danger)] text-sm">{error}</p>
            </div>
          )}
          {success && (
            <div className="md:col-span-2">
              <p className="text-[var(--success)] text-sm">{success}</p>
            </div>
          )}

          {/* Botón */}
          <div className="md:col-span-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-[var(--primary)] text-white py-2 rounded-lg hover:opacity-90 transition disabled:opacity-50"
            >
              {isSubmitting ? "Creando..." : "Registrarse"}
            </button>
          </div>
        </form>

        <p className="text-sm text-[var(--text-muted)] mt-4 text-center">
          ¿Ya tienes cuenta?{" "}
          <a href="/login" className="text-[var(--primary)] hover:underline">
            Inicia sesión
          </a>
        </p>
      </div>
    </div>
  );
}
