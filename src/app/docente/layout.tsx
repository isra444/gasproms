"use client";

import RoleGuard from "@/components/RoleGuard";
import Header from "@/components/Header";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut, Home, BookOpen, FileChartColumn, Users, Upload } from "lucide-react";

function Item({ href, label, icon: Icon }: { href: string; label: string; icon: any }) {
  const pathname = usePathname();
  const active = pathname === href;
  return (
    <Link
      href={href}
      className={`flex items-center gap-2 px-3 py-2 rounded-xl hover:opacity-90 ${
        active ? "bg-[var(--primary)] text-white" : "hover:bg-[var(--panel)]"
      }`}
    >
      <Icon size={18} />
      <span>{label}</span>
    </Link>
  );
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <RoleGuard allowedRoles={["docente"]}>
      <div className="min-h-dvh grid grid-cols-12">
        {/* Sidebar */}
        <aside className="col-span-12 md:col-span-3 lg:col-span-2 p-4 border-r border-[var(--muted)] space-y-4">
          <div className="flex items-center gap-2">
            <img src="/logo.png" alt="logo" className="w-8 h-8 rounded" />
            <div className="font-semibold">GASPROMs • Docente</div>
          </div>

          <nav className="space-y-2">
            <Item href="/docente" label="Inicio" icon={Home} />
            <Item href="/docente/modulos" label="Mis módulos" icon={BookOpen} />
            <Item href="/docente/notas" label="Subir notas" icon={Upload} />
            <Item href="/docente/alumnos" label="Alumnos" icon={Users} />
            <Item href="/docente/reportes" label="Reportes" icon={FileChartColumn} />
          </nav>

          <Link
            href="/login?logout=1"
            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-[var(--danger)] text-white"
          >
            <LogOut size={18} /> Cerrar sesión
          </Link>
        </aside>

        {/* Main */}
        <main className="col-span-12 md:col-span-9 lg:col-span-10">
          <Header />
          {children}
        </main>
      </div>
    </RoleGuard>
  );
}
