"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

type HomeRevealProps = {
  children: ReactNode;
  className?: string;
  delayMs?: number;
};

/** Soft fade-up when entering viewport. Honors prefers-reduced-motion. */
export function HomeReveal({ children, className, delayMs = 0 }: HomeRevealProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduceMotion(mq.matches);
    const onChange = () => setReduceMotion(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    if (reduceMotion) {
      setVisible(true);
      return;
    }
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -8% 0px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [reduceMotion]);

  return (
    <div
      ref={ref}
      className={cn(
        "transition-[opacity,transform] duration-700 ease-[cubic-bezier(0.16,1,0.3,1)]",
        visible || reduceMotion
          ? "translate-y-0 opacity-100"
          : "translate-y-3 opacity-0",
        className
      )}
      style={
        visible && !reduceMotion && delayMs
          ? { transitionDelay: `${delayMs}ms` }
          : undefined
      }
    >
      {children}
    </div>
  );
}
