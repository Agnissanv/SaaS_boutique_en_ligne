import Link from "next/link";
import { BLOG_POSTS } from "@/lib/blog-posts";

export const metadata = {
  title: "Blog — Conseils pour vendre en ligne en Côte d'Ivoire | KEVA",
  description:
    "Des conseils concrets pour les vendeuses et vendeurs indépendants en Côte d'Ivoire : vendre sur WhatsApp, gérer les commandes, rassurer une nouvelle cliente.",
};

/**
 * Page "Blog" — ajoutée le 29/09/2026 à la place du bloc Newsletter de la
 * page de référence d'Isaac (voir `blog-posts.ts` pour le raisonnement
 * complet : SEO sans collecte d'email, cohérent avec la décision
 * WhatsApp-first déjà actée). Listing volontairement simple (pas de
 * pagination, pas de filtre par catégorie) : seulement deux articles pour
 * l'instant, à réévaluer si Isaac publie plus régulièrement.
 */
export default function BlogPage() {
  const posts = [...BLOG_POSTS].sort((a, b) => (a.publishedAt < b.publishedAt ? 1 : -1));

  return (
    <div className="min-h-screen bg-brume">
      <header className="border-b border-ligne bg-white px-4 py-4">
        <Link href="/" className="mx-auto flex w-full max-w-3xl items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element -- logo statique */}
          <img src="/keva-logo.jpg" alt="KEVA" className="h-8 w-8 rounded-md object-cover" />
          <span className="font-display text-lg font-bold tracking-wide text-vert-sapin">KEVA</span>
        </Link>
      </header>

      <main className="mx-auto w-full max-w-3xl px-4 py-10">
        <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-vert-actif">
          Le blog KEVA
        </p>
        <h1 className="mt-2 font-display text-2xl font-semibold text-encre sm:text-3xl">
          Conseils pour vendre en ligne en Côte d&apos;Ivoire
        </h1>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-encre/70">
          Des astuces concrètes pour les vendeuses et jeunes revendeurs qui
          vendent au quotidien sur WhatsApp, Instagram ou une boutique KEVA.
        </p>

        <div className="mt-8 flex flex-col gap-4">
          {posts.map((post) => (
            <Link
              key={post.slug}
              href={`/blog/${post.slug}`}
              className="group rounded-xl border border-ligne bg-white p-5 transition hover:border-vert-actif hover:shadow-md"
            >
              <p className="text-xs text-encre/50">
                {new Date(post.publishedAt).toLocaleDateString("fr-FR", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
                {" · "}
                {post.readingMinutes} min de lecture
              </p>
              <h2 className="mt-1.5 font-display text-lg font-semibold text-encre group-hover:text-vert-sapin">
                {post.title}
              </h2>
              <p className="mt-1.5 text-sm text-encre/70">{post.excerpt}</p>
              <span className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-vert-actif">
                Lire l&apos;article
                <span aria-hidden="true">→</span>
              </span>
            </Link>
          ))}
        </div>

        <Link href="/" className="mt-10 inline-block text-sm text-vert-actif underline">
          Retour à l&apos;accueil
        </Link>
      </main>
    </div>
  );
}
