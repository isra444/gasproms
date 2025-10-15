"use client";

import { useEffect } from "react";
import clsx from "clsx";

type Props = {
  open: boolean;
  title?: string;
  onClose: () => void;
  children: React.ReactNode;
  widthClass?: string; // ej. "max-w-lg"
};

export default function Modal({
  open,
  title,
  onClose,
  children,
  widthClass = "max-w-lg",
}: Props) {
  useEffect(() => {
    function onEsc(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    if (open) document.addEventListener("keydown", onEsc);
    return () => document.removeEventListener("keydown", onEsc);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
        aria-hidden
      />
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div
          className={clsx(
            "w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--fg)] shadow-xl",
            widthClass
          )}
          role="dialog"
          aria-modal="true"
        >
          <div className="px-4 py-3 border-b border-[var(--border)] flex items-center justify-between">
            <h3 className="font-semibold">{title}</h3>
            <button
              onClick={onClose}
              className="text-sm opacity-70 hover:opacity-100"
              aria-label="Cerrar"
            >
              ✕
            </button>
          </div>
          <div className="p-4">{children}</div>
        </div>
      </div>
    </div>
  );
}
