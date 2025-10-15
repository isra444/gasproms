"use client";

import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";
import RoleGuard from "@/components/RoleGuard";

type NavItem = {
  label: string;
  href: string;
  icon?: string; // nombre del icono en lucide-react (PascalCase)
};

const adminItems: NavItem[] = [
  { label: "Inicio",      href: "/admin",             icon: "LayoutDashboard" },
  { label: "Usuarios",    href: "/admin/usuarios",    icon: "Users" },
  { label: "Programas",   href: "/admin/programas",   icon: "Layers" },
  { label: "Alumnos",     href: "/admin/alumnos",     icon: "GraduationCap" },
  { label: "Docentes",    href: "/admin/docentes",    icon: "BookOpen" },
  { label: "Coordinador", href: "/admin/coordinador", icon: "Briefcase" },
  { label: "Reportes",    href: "/admin/reportes",    icon: "BarChart3" },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <RoleGuard allow={["admin"]} fallback={<div className="p-6">Cargando…</div>}>
      <div className="flex min-h-screen bg-[var(--bg)] text-[var(--fg)]">
        <Sidebar items={adminItems} />
        <div className="flex-1 flex flex-col border-l border-[var(--border)]">
          <Header />
          <main className="flex-1 p-6">{children}</main>
        </div>
      </div>
    </RoleGuard>
  );
}
