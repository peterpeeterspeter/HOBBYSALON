"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export type HeroSlide = {
  id: string;
  type: "product" | "workshop" | "creator" | "event" | "article" | "project";
  title: string;
  description?: string | null;
  imageUrl: string;
  href: string;
  label: string; // "Benodigdheden" | "Workshop" | "Creator" | etc.
};

type HeroSliderProps = {
  slides: HeroSlide[];
  autoplayIntervalMs?: number;
  className?: string;
};

function HeroSlider({ slides, autoplayIntervalMs = 6000, className }: HeroSliderProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);

  const goTo = useCallback(
    (index: number) => {
      setActiveIndex((index + slides.length) % slides.length);
    },
    [slides.length]
  );

  const next = useCallback(() => goTo(activeIndex + 1), [activeIndex, goTo]);
  const prev = useCallback(() => goTo(activeIndex - 1), [activeIndex, goTo]);

  useEffect(() => {
    if (slides.length <= 1 || isPaused) return;
    const id = setInterval(next, autoplayIntervalMs);
    return () => clearInterval(id);
  }, [activeIndex, isPaused, next, autoplayIntervalMs, slides.length]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!sectionRef.current?.contains(document.activeElement)) return;
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        prev();
      }
      if (e.key === "ArrowRight") {
        e.preventDefault();
        next();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [prev, next]);

  if (!slides.length) return null;

  return (
    <section
      ref={sectionRef}
      className={cn("relative overflow-hidden", className)}
      aria-label="Uitgelichte highlights"
      tabIndex={0}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      <div className="relative aspect-[21/9] min-h-[280px] w-full md:aspect-[3/1] md:min-h-[320px]">
        {slides.map((slide, i) => (
          <Link
            key={slide.id}
            href={slide.href}
            className={cn(
              "absolute inset-0 block transition-opacity duration-500 ease-out",
              i === activeIndex ? "z-10 opacity-100" : "z-0 opacity-0 pointer-events-none"
            )}
            aria-hidden={i !== activeIndex}
          >
            {/* Background image */}
            <div
              className="absolute inset-0 bg-cover bg-center"
              style={{ backgroundImage: `url(${slide.imageUrl})` }}
              aria-hidden
            />
            {/* Gradient overlay for text legibility */}
            <div
              className="absolute inset-0 bg-gradient-to-r from-[var(--foreground)]/80 via-[var(--foreground)]/40 to-transparent"
              aria-hidden
            />
            {/* Content */}
            <div className="relative flex h-full items-center px-4 md:px-8 lg:px-12">
              <div className="max-w-xl text-white">
                <span className="inline-block rounded-full bg-white/20 px-3 py-1 text-xs font-medium uppercase tracking-wider">
                  {slide.label}
                </span>
                <h2 className="mt-3 font-display text-2xl font-bold md:text-3xl lg:text-4xl">
                  {slide.title}
                </h2>
                {slide.description && (
                  <p className="mt-2 line-clamp-2 text-sm text-white/90 md:text-base">
                    {slide.description}
                  </p>
                )}
                <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-white underline underline-offset-4 hover:no-underline">
                  Bekijken
                  <ChevronRight size={18} aria-hidden />
                </span>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* Navigation */}
      {slides.length > 1 && (
        <>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              prev();
            }}
            className="absolute left-2 top-1/2 z-20 -translate-y-1/2 rounded-full bg-white/30 p-2 text-white backdrop-blur-sm hover:bg-white/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
            aria-label="Vorige slide"
          >
            <ChevronLeft size={24} aria-hidden />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              next();
            }}
            className="absolute right-2 top-1/2 z-20 -translate-y-1/2 rounded-full bg-white/30 p-2 text-white backdrop-blur-sm hover:bg-white/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
            aria-label="Volgende slide"
          >
            <ChevronRight size={24} aria-hidden />
          </button>
          {/* Dots */}
          <div className="absolute bottom-4 left-0 right-0 z-20 flex justify-center gap-2">
            {slides.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  setActiveIndex(i);
                }}
                className={cn(
                  "h-2 rounded-full transition-all",
                  i === activeIndex ? "w-6 bg-white" : "w-2 bg-white/50 hover:bg-white/70"
                )}
                aria-label={`Ga naar slide ${i + 1}`}
              />
            ))}
          </div>
        </>
      )}
    </section>
  );
}

export { HeroSlider };
