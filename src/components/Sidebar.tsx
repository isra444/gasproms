"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import * as Icons from "lucide-react";
import { LogOut } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { useUserStore } from "@/store/useUserStore";
import clsx from "clsx";
import { ReactNode } from "react";

type MenuItem = {
  href: string;
  label: string;
  /** Nombre del icono de lucide-react en PascalCase (ej: "Users", "Layers"), o un ReactNode personalizado */
  icon?: string | ReactNode;
};

export default function Sidebar({
  items,
  title = "GASPROM",
}: {
  items?: MenuItem[];
  title?: string;
}) {
  const pathname = usePathname();
  const user = useUserStore((s) => s.user);

  // Menú por defecto (por si no recibimos items)
  const defaultMenu: MenuItem[] =
    items ??
    [
      { href: "/admin", label: "Inicio", icon: "LayoutDashboard" },
      { href: "/admin/usuarios", label: "Usuarios", icon: "Users" },
      { href: "/admin/programas", label: "Programas", icon: "Layers" },
      { href: "/admin/alumnos", label: "Alumnos", icon: "GraduationCap" },
      { href: "/admin/docentes", label: "Docentes", icon: "BookOpen" },
      { href: "/admin/coordinador", label: "Coordinador", icon: "Briefcase" },
      { href: "/admin/reportes", label: "Reportes", icon: "BarChart3" },
    ];

  const logout = async () => {
    await supabase.auth.signOut();
    window.location.href = "/login";
  };

  function renderIcon(icon?: string | ReactNode) {
    if (!icon) return null;
    // Si es un ReactNode, lo devolvemos tal cual
    if (typeof icon !== "string") return icon;
    // Si es string, buscamos el componente en lucide-react
    const LucideIcon =
      (Icons as any)[icon as keyof typeof Icons] ?? Icons.Circle;
    return <LucideIcon className="h-4 w-4" aria-hidden />;
  }

  return (
    <aside className="w-[240px] bg-[#2e4256] text-white flex flex-col">
      <div className="flex items-center gap-2 p-4 border-b border-white/10">
        <Image src="/logo.png" alt="Logo" width={28} height={28} />
        <div className="font-bold tracking-wide">{title}</div>
      </div>

      <div className="px-4 py-3 text-xs opacity-80">
        <div className="text-[12px]">Bienvenido 👋</div>
        <div className="truncate">{user?.email}</div>
        {user?.role && <div className="text-[11px]">Rol: {user.role}</div>}
      </div>

      <nav className="flex-1 px-2 space-y-1">
        {defaultMenu.map((it) => {
          const active =
            pathname === it.href || pathname.startsWith(it.href + "/");
          return (
            <Link
              key={it.href}
              href={it.href}
              className={clsx(
                "flex items-center gap-2 px-3 py-2 rounded-lg transition",
                active ? "bg-[var(--primary)] text-white" : "hover:bg-white/5"
              )}
            >
              {renderIcon(it.icon)}
              <span className="text-sm">{it.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="p-3 border-t border-white/10">
        <button
          onClick={logout}
          className="w-full flex items-center justify-center gap-2 bg-[var(--danger)] text-white py-2 rounded-lg"
        >
          <LogOut size={18} />
          Cerrar sesión
        </button>
      </div>
    </aside>
  );
}

