import Link from "next/link";
import { BLOG_POSTS } from "@/lib/blog-posts";

const HOMEPAGE_TEASER_SIZE = 2;

/**
 * Bloc "Blog" de la page d'accueil — occupe, dans l'adaptation de la
 * référence d'Isaac, la position du bloc "Newsletter" (voir
 * `blog-posts.ts` pour le choix d'un blog plutôt qu'une collecte d'email).
 * Se contente d'un aperçu (titre + accroche) des derniers articles : le
 * contenu complet reste sur `/blog/[slug]`, pas dupliqué ici.
 */
export function BlogTeaser() {
  const posts = [...BLOG_POSTS]
    .sort((a, b) => (a.publishedAt < b.publishedAt ? 1 : -1))
    .slice(0, HOMEPAGE_TEASER_SIZE);

  if (posts.length === 0) return null;

  return (
    <section className="mt-10">
      <div className="mb-3 flex items-center justify-between px-1">
        <h2 className="font-display text-lg font-semibold text-encre">Sur le blog KEVA</h2>
        <Link href="/blog" className="text-xs font-medium text-vert-actif underline">
          Tout voir
        </Link>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {posts.map((post) => (
          <Link
            key={post.slug}
            href={`/blog/${post.slug}`}
            className="group rounded-xl border border-ligne bg-white p-5 transition hover:border-vert-actif hover:shadow-md"
          >
            <p className="text-xs text-encre/50">{post.readingMinutes} min de lecture</p>
            <h3 className="mt-1.5 font-display text-base font-semibold text-encre group-hover:text-vert-sapin">
              {post.title}
            </h3>
            <p className="mt-1.5 line-clamp-2 text-sm text-encre/70">{post.excerpt}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}
