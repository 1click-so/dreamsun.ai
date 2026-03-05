"use client";

import { cn } from "@/lib/cn";
import { type ReactNode } from "react";

/**
 * Modal overlay + centered content panel.
 * Consistent backdrop, border, padding across all modals.
 */

interface ModalProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const sizeStyles = {
  sm: "max-w-xs",
  md: "max-w-sm",
  lg: "max-w-2xl",
};

export function Modal({ open, onClose, children, size = "md", className }: ModalProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={onClose}
    >
      <div
        className={cn(
          "w-full rounded-xl border border-border bg-surface p-5",
          sizeStyles[size],
          className
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}
