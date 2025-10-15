// src/app/alumno/layout.tsx
"use client";

import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";
import RoleGuard from "@/components/RoleGuard";

import { Home, BookOpen, MessagesSquare } from "lucide-react";

export default function AlumnoLayout({ children }: { children: React.ReactNode }) {
  const alumnoMenu = [
    { href: "/alumno", label: "Inicio", icon: <Home size={16} /> },
    { href: "/alumno/modulos", label: "Mis módulos", icon: <BookOpen size={16} /> },
    { href: "/alumno/mensajes", label: "Mensajes", icon: <MessagesSquare size={16} /> },
  ];

  return (
    <RoleGuard allow={["alumno"]}>
      <div className="flex min-h-screen bg-[var(--bg)] text-[var(--text)]">
        <Sidebar items={alumnoMenu} title="GASPROM" />
        <main className="flex-1 flex flex-col">
          <Header />
          <div className="p-6">{children}</div>
        </main>
      </div>
    </RoleGuard>
  );
}
