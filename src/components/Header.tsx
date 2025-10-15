"use client";

import { useUserStore } from "@/store/useUserStore";
import { supabase } from "@/lib/supabaseClient"; // ✅ usamos la única instancia

export default function Header() {
  const user = useUserStore((s) => s.user);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = "/login";
  };

  return (
    <header className="flex items-center justify-between bg-[var(--panel)] text-[var(--text)] px-6 py-4 shadow">
      {/* Info del usuario */}
      {user ? (
        <div>
          <p className="font-semibold">Hola, {user.email.split("@")[0]}</p>
          <p className="text-sm text-[var(--text-muted)]">
            Rol: {user.role ?? "pendiente"}
          </p>
        </div>
      ) : (
        <p>No hay sesión activa</p>
      )}

      {/* Botón cerrar sesión */}
      <button
        onClick={handleLogout}
        className="bg-[var(--danger)] text-white px-4 py-2 rounded-md hover:bg-red-700 transition"
      >
        Cerrar sesión
      </button>
    </header>
  );
}
