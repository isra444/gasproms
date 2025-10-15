"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function ResetPasswordRequestPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    setError(null);

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password/update`,
    });

    if (error) {
      setError(error.message);
    } else {
      setMessage("📧 Revisa tu correo para restablecer tu contraseña.");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--bg)]">
      <div className="w-full max-w-md bg-[var(--panel)] p-8 rounded-2xl shadow-lg">
        <h2 className="text-2xl font-bold text-center mb-6">Recuperar contraseña</h2>

        <form onSubmit={handleReset} className="space-y-4">
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
      </div>
    </div>
  );
}
