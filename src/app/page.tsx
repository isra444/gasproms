// src/app/page.tsx
import { redirect } from "next/navigation";

export default function Home() {
  // Home por defecto → /login
  redirect("/login");
}
