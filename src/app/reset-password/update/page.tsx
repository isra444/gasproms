"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function ResetPasswordPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [stage, setStage] = useState<"request" | "update">("request");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Supabase coloca un "access_token" en la URL si el link es de reset
    const hash = window.location.hash;
    if (hash.includes("access_token")) {
      setStage("update");
    }
  }, []);

  const handleRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    if (error) {
      setError(error.message);
    } else {
      setMessage("📧 Revisa tu correo para restablecer tu contraseña.");
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);

    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      setError(error.message);
    } else {
      setMessage("✅ Contraseña actualizada. Serás redirigido al login...");
      setTimeout(() => (window.location.href = "/login"), 2000);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--bg)]">
      <div className="w-full max-w-md bg-[var(--panel)] p-8 rounded-2xl shadow-lg">
        {stage === "request" ? (
          <>
            <h2 className="text-2xl font-bold text-center mb-6">
              Recuperar contraseña
            </h2>
            <form onSubmit={handleRequest} className="space-y-4">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-2 border border-[var(--muted)] rounded-lg bg-[var(--bg)] text-[var(--text)] placeholder-[var(--text-muted)]"
                placeholder="tu@correo.com"
                required
              />
              {error && <p className="text-[var(--danger)] text-sm">{error}</p>}
              {message && <p className="text-[var(--success)] text-sm">{message}</p>}

              <button
                type="submit"
                className="w-full bg-[var(--primary)] text-white py-2 rounded-lg hover:opacity-90"
              >
                Enviar enlace
              </button>
            </form>
          </>
        ) : (
          <>
            <h2 className="text-2xl font-bold text-center mb-6">
              Nueva contraseña
            </h2>
            <form onSubmit={handleUpdate} className="space-y-4">
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-2 border border-[var(--muted)] rounded-lg bg-[var(--bg)] text-[var(--text)] placeholder-[var(--text-muted)]"
                placeholder="********"
                required
              />
              {error && <p className="text-[var(--danger)] text-sm">{error}</p>}
              {message && <p className="text-[var(--success)] text-sm">{message}</p>}

              <button
                type="submit"
                className="w-full bg-[var(--primary)] text-white py-2 rounded-lg hover:opacity-90"
              >
                Actualizar contraseña
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
