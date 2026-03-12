"use client";

import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { X, CheckCircle, AlertCircle, Info } from "lucide-react";
import { useEffect, useState } from "react";

const toastVariants = cva(
  "fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-lg px-4 py-3 shadow-[var(--shadow-lg)] text-white transition-all duration-[var(--transition-normal)] max-w-sm",
  {
    variants: {
      variant: {
        success: "bg-[var(--success)]",
        error: "bg-[var(--error)]",
        info: "bg-[var(--info)]",
      },
    },
    defaultVariants: {
      variant: "success",
    },
  }
);

type ToastProps = VariantProps<typeof toastVariants> & {
  message: string;
  duration?: number;
  onClose?: () => void;
  className?: string;
};

const icons = {
  success: CheckCircle,
  error: AlertCircle,
  info: Info,
} as const;

function Toast({
  message,
  variant = "success",
  duration = 4000,
  onClose,
  className,
}: ToastProps) {
  const [visible, setVisible] = useState(true);
  const Icon = icons[variant || "success"];

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false);
      onClose?.();
    }, duration);
    return () => clearTimeout(timer);
  }, [duration, onClose]);

  if (!visible) return null;

  return (
    <div
      className={cn(toastVariants({ variant }), className)}
      role="status"
      aria-live="polite"
    >
      <Icon size={20} aria-hidden="true" className="shrink-0" />
      <span className="text-sm font-medium">{message}</span>
      <button
        onClick={() => {
          setVisible(false);
          onClose?.();
        }}
        className="ml-auto shrink-0 rounded p-1 hover:bg-white/20"
        aria-label="Sluiten"
      >
        <X size={16} />
      </button>
    </div>
  );
}

export { Toast, toastVariants };
export type { ToastProps };
