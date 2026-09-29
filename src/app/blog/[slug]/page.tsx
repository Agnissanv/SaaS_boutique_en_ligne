import Link from "next/link";
import { notFound } from "next/navigation";
import { BLOG_POSTS, getBlogPost } from "@/lib/blog-posts";

export function generateStaticParams() {
  return BLOG_POSTS.map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = getBlogPost(slug);
  if (!post) return { title: "Article introuvable — KEVA" };
  return {
    title: `${post.title} — Blog KEVA`,
    description: post.excerpt,
  };
}

/**
 * Article de blog — voir `blog-posts.ts` pour le contexte complet de ce
 * chantier. Contenu stocké en dur, rendu simple (une section = un titre
 * optionnel + des paragraphes) : pas de rendu markdown, inutile tant que le
 * contenu est écrit directement ici plutôt qu'édité par Isaac dans un CMS.
 */
export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = getBlogPost(slug);
  if (!post) notFound();

  return (
    <div className="min-h-screen bg-brume">
      <header className="border-b border-ligne bg-white px-4 py-4">
        <Link href="/" className="mx-auto flex w-full max-w-2xl items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element -- logo statique */}
          <img src="/keva-logo.jpg" alt="KEVA" className="h-8 w-8 rounded-md object-cover" />
          <span className="font-display text-lg font-bold tracking-wide text-vert-sapin">KEVA</span>
        </Link>
      </header>

      <main className="mx-auto w-full max-w-2xl px-4 py-10">
        <Link href="/blog" className="text-sm text-vert-actif underline">
          ← Tous les articles
        </Link>

        <p className="mt-5 text-xs text-encre/50">
          {new Date(post.publishedAt).toLocaleDateString("fr-FR", {
            day: "numeric",
            month: "long",
            year: "numeric",
          })}
          {" · "}
          {post.readingMinutes} min de lecture
        </p>
        <h1 className="mt-2 font-display text-2xl font-semibold text-encre sm:text-3xl">
          {post.title}
        </h1>

        <div className="mt-8 flex flex-col gap-6">
          {post.sections.map((section, i) => (
            <div key={section.heading ?? i}>
              {section.heading ? (
                <h2 className="font-display text-lg font-semibold text-encre">
                  {section.heading}
                </h2>
              ) : null}
              {section.paragraphs.map((paragraph, j) => (
                <p
                  key={j}
                  className={`text-[15px] leading-relaxed text-encre/80 ${
                    section.heading || j > 0 ? "mt-2" : ""
                  }`}
                >
                  {paragraph}
                </p>
              ))}
            </div>
          ))}
        </div>

        <Link
          href="/inscription"
          className="mt-10 inline-flex items-center gap-2 rounded-lg bg-vert-actif px-6 py-3 text-sm font-semibold text-white transition hover:bg-vert-sapin"
        >
          Ouvrir ma boutique KEVA
          <span aria-hidden="true">→</span>
        </Link>
      </main>
    </div>
  );
}
