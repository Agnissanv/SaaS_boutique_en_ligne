"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ProductImage } from "@/components/product-image";

export type HeroSlide = {
  id: string;
  /** Une seule diapo porte le <h1> de la page (positionnement) ; les autres sont des <h2>. */
  headingLevel: "h1" | "h2";
  eyebrow?: string;
  title: string;
  text?: string;
  cta: { label: string; href: string };
  secondary?: { label: string; href: string };
  tone: "sapin" | "ivoire" | "cuivre";
  images: { src?: string; alt: string; href: string; caption?: string }[];
};

const ROTATE_MS = 6000;

const TONES: Record<HeroSlide["tone"], { bg: string; text: string; sub: string; cta: string; link: string }> = {
  sapin: {
    bg: "bg-vert-sapin",
    text: "text-white",
    sub: "text-white/75",
    cta: "bg-white text-vert-sapin hover:bg-ivoire",
    link: "text-white underline hover:text-ivoire",
  },
  ivoire: {
    bg: "bg-ivoire",
    text: "text-vert-sapin",
    sub: "text-encre/70",
    cta: "bg-vert-sapin text-white hover:bg-vert-actif",
    link: "text-vert-sapin underline hover:text-vert-actif",
  },
  cuivre: {
    bg: "bg-cuivre-profond",
    text: "text-white",
    sub: "text-white/80",
    cta: "bg-white text-cuivre-profond hover:bg-ivoire",
    link: "text-white underline hover:text-ivoire",
  },
};

/**
 * Grande bannière rotative du hero (06/10/2026, demande d'Isaac : "une hero
 * section comme les grandes marketplaces" — Jumia/Amazon). Toutes les diapos
 * restent dans le DOM, empilées, et seule la diapo active est visible et
 * interactive (`inert` sur les autres) : le <h1> de positionnement reste donc
 * lisible par les moteurs de recherche même quand une autre diapo est à
 * l'écran. Rotation automatique en pause au survol/focus et désactivée sous
 * `prefers-reduced-motion`, comme les autres animations du hero.
 */
export function HeroBannerCarousel({ slides, className }: { slides: HeroSlide[]; className?: string }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (slides.length <= 1 || paused) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = setInterval(() => setIndex((i) => (i + 1) % slides.length), ROTATE_MS);
    return () => clearInterval(id);
  }, [slides.length, paused]);

  const go = (delta: number) => setIndex((i) => (i + delta + slides.length) % slides.length);

  return (
    <div
      className={`group/carousel relative overflow-hidden rounded-lg ${className ?? ""}`}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      role="region"
      aria-roledescription="carrousel"
      aria-label="À la une"
    >
      {slides.map((slide, i) => {
        const tone = TONES[slide.tone];
        const active = i === index;
        const Heading = slide.headingLevel;
        const [main, ...rest] = slide.images;
        return (
          <div
            key={slide.id}
            inert={!active}
            aria-hidden={!active}
            className={`absolute inset-0 flex items-center transition-opacity duration-500 ${tone.bg} ${tone.text} ${
              active ? "z-10 opacity-100" : "z-0 opacity-0"
            }`}
          >
            <div className="w-full px-6 py-8 sm:w-[62%] sm:pl-8 sm:pr-2 lg:pl-9">
              {slide.eyebrow ? (
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] opacity-80">{slide.eyebrow}</p>
              ) : null}
              <Heading className="mt-2 text-balance font-display text-2xl font-black leading-[1.08] tracking-tight sm:text-[1.7rem] lg:text-[2rem]">
                {slide.title}
              </Heading>
              {slide.text ? (
                <p className={`mt-3 max-w-sm text-sm leading-relaxed ${tone.sub}`}>{slide.text}</p>
              ) : null}
              <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-3">
                <Link
                  href={slide.cta.href}
                  className={`flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold transition ${tone.cta}`}
                >
                  {slide.cta.label}
                  <span aria-hidden="true">→</span>
                </Link>
                {slide.secondary ? (
                  <Link href={slide.secondary.href} className={`text-sm font-medium transition ${tone.link}`}>
                    {slide.secondary.label}
                  </Link>
                ) : null}
              </div>
            </div>

            {main ? (
              <div className="absolute inset-y-6 right-5 hidden w-[34%] grid-cols-2 gap-2 sm:grid">
                <BannerTile image={main} className={rest.length > 0 ? "row-span-2" : "col-span-2"} />
                {rest.slice(0, 2).map((image) => (
                  <BannerTile key={image.href} image={image} />
                ))}
              </div>
            ) : null}
          </div>
        );
      })}

      {slides.length > 1 ? (
        <>
          <button
            type="button"
            onClick={() => go(-1)}
            aria-label="Diapo précédente"
            className="absolute left-2 top-1/2 z-20 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-vert-sapin opacity-0 shadow transition group-hover/carousel:opacity-100 focus-visible:opacity-100 md:flex"
          >
            <Chevron direction="left" />
          </button>
          <button
            type="button"
            onClick={() => go(1)}
            aria-label="Diapo suivante"
            className="absolute right-2 top-1/2 z-20 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-vert-sapin opacity-0 shadow transition group-hover/carousel:opacity-100 focus-visible:opacity-100 md:flex"
          >
            <Chevron direction="right" />
          </button>
          <div className="absolute bottom-3 left-6 z-20 flex items-center gap-1.5 sm:left-8 lg:left-9">
            {slides.map((slide, i) => (
              <button
                key={slide.id}
                type="button"
                onClick={() => setIndex(i)}
                aria-label={`Aller à la diapo ${i + 1}`}
                aria-current={i === index}
                className={`h-1.5 rounded-full transition-all ${i === index ? "w-6 bg-white" : "w-1.5 bg-white/45"}`}
              />
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}

function BannerTile({
  image,
  className,
}: {
  image: HeroSlide["images"][number];
  className?: string;
}) {
  return (
    <Link
      href={image.href}
      className={`group relative block overflow-hidden rounded-md bg-white shadow-sm ${className ?? ""}`}
    >
      <ProductImage
        src={image.src}
        alt={image.alt}
        className="h-full w-full transition duration-500 group-hover:scale-[1.04]"
      />
      {image.caption ? (
        <span className="absolute bottom-1.5 left-1.5 rounded bg-white/95 px-2 py-1 font-mono text-[11px] font-semibold text-vert-sapin">
          {image.caption}
        </span>
      ) : null}
    </Link>
  );
}

function Chevron({ direction }: { direction: "left" | "right" }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4" aria-hidden="true">
      <path d={direction === "left" ? "M12 4l-6 6 6 6" : "M8 4l6 6-6 6"} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
