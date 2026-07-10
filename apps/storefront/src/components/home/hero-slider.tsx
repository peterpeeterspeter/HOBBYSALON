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
  label: string;
};

const TYPE_SECONDARY_HREF: Record<HeroSlide["type"], string> = {
  workshop: "/workshops",
  event: "/agenda",
  product: "/materials",
  creator: "/creators",
  article: "/gratis-haakpatronen",
  project: "/workshops",
};

const TYPE_SECONDARY_LABEL: Record<HeroSlide["type"], string> = {
  workshop: "Ontdek alle workshops",
  event: "Bekijk de agenda",
  product: "Naar de marktplaats",
  creator: "Alle makers",
  article: "Lees meer artikelen",
  project: "Ontdek workshops",
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
      <div className="relative h-[340px] sm:h-[420px] lg:h-[520px] w-full">
        {slides.map((slide, i) => (
          <div
            key={slide.id}
            className={cn(
              "absolute inset-0 transition-opacity duration-500 ease-out",
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
            {/* Gradient overlay — left to right for text legibility */}
            <div
              className="absolute inset-0"
              style={{
                background:
                  "linear-gradient(to right, rgba(77,59,42,0.80) 0%, rgba(77,59,42,0.40) 55%, transparent 100%)",
              }}
              aria-hidden
            />
            {/* Content */}
            <div className="relative flex h-full flex-col justify-center px-8 sm:px-12 lg:px-20">
              <div className="max-w-[560px] text-white">
                <span className="text-xs font-semibold uppercase tracking-wider text-white/75">
                  {slide.label}
                </span>
                <Link
                  href={slide.href}
                  className="block"
                  tabIndex={i === activeIndex ? 0 : -1}
                >
                  <h2 className="mt-3 font-display text-3xl font-bold leading-tight md:text-4xl lg:text-5xl">
                    {slide.title}
                  </h2>
                </Link>
                {slide.description && (
                  <p className="mt-3 line-clamp-2 text-base text-white/85 leading-relaxed md:text-lg">
                    {slide.description}
                  </p>
                )}
                <div className="mt-6 flex flex-wrap gap-3">
                  <Link
                    href={slide.href}
                    tabIndex={i === activeIndex ? 0 : -1}
                    className="inline-flex min-h-[48px] items-center rounded-lg bg-[var(--accent)] px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-[var(--accent-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
                  >
                    Bekijken
                  </Link>
                  <Link
                    href={TYPE_SECONDARY_HREF[slide.type]}
                    tabIndex={i === activeIndex ? 0 : -1}
                    className="inline-flex min-h-[48px] items-center rounded-lg px-6 py-3 text-sm font-semibold text-white transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
                    style={{
                      background: "rgba(255,255,255,0.15)",
                      border: "1.5px solid rgba(255,255,255,0.40)",
                      backdropFilter: "blur(4px)",
                    }}
                  >
                    {TYPE_SECONDARY_LABEL[slide.type]}
                  </Link>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Navigation arrows */}
      {slides.length > 1 && (
        <>
          <button
            type="button"
            onClick={prev}
            className="absolute left-3 top-1/2 z-20 -translate-y-1/2 rounded-full bg-white/25 p-2 text-white backdrop-blur-sm transition-colors hover:bg-white/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
            aria-label="Vorige slide"
          >
            <ChevronLeft size={24} aria-hidden />
          </button>
          <button
            type="button"
            onClick={next}
            className="absolute right-3 top-1/2 z-20 -translate-y-1/2 rounded-full bg-white/25 p-2 text-white backdrop-blur-sm transition-colors hover:bg-white/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
            aria-label="Volgende slide"
          >
            <ChevronRight size={24} aria-hidden />
          </button>
          {/* Dots — left-aligned to match content padding */}
          <div className="absolute bottom-6 left-8 sm:left-12 lg:left-20 z-20 flex gap-2">
            {slides.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setActiveIndex(i)}
                className={cn(
                  "h-2 rounded-full transition-all duration-[var(--transition-normal)]",
                  i === activeIndex ? "w-6 bg-white" : "w-2 bg-white/40 hover:bg-white/70"
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
