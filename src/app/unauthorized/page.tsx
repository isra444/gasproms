export default function UnauthorizedPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--bg)] text-[var(--text)]">
      <div className="rounded-2xl border border-[var(--muted)] p-8 max-w-md w-full text-center">
        <h1 className="text-2xl font-semibold mb-2">Acceso denegado</h1>
        <p className="text-[var(--text-muted)] mb-6">
          No tienes permisos para ver esta página.
        </p>
        <a
          href="/login"
          className="inline-block px-4 py-2 rounded-xl bg-[var(--primary)] text-white"
        >
          Ir a iniciar sesión
        </a>
      </div>
    </div>
  );
}
