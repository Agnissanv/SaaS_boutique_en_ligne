import Link from "next/link";

export const metadata = {
  title: "Questions fréquentes — KEVA",
  description:
    "Commande sans compte, paiement à la livraison, ouverture d'une boutique, frais... Les réponses aux questions les plus courantes sur KEVA.",
};

/**
 * Page FAQ — ajoutée le 02/10/2026 (chantier GEO, voir decisions-techniques.md
 * et claude/audit-technique-2026-09-29.md pour le contexte SEO plus large).
 * KEVA n'avait jusqu'ici aucune page de questions/réponses — ni dans le
 * footer, ni listée dans `sitemap.ts` (vérifié avant d'écrire).
 *
 * Deux raisons d'exister, pas une seule :
 * 1. SEO classique : des questions formulées comme les vraies recherches des
 *    utilisateurs ("comment payer sur...", "faut-il un compte pour...").
 * 2. GEO : une réponse courte et factuelle juste après chaque question est le
 *    format que les moteurs IA génératifs extraient le plus facilement
 *    (contrairement à un paragraphe de blog qui noie la réponse dans le
 *    contexte) — renforcé par le balisage `FAQPage` ci-dessous.
 *
 * Contenu limité à ce qui est vrai AUJOURD'HUI sur KEVA (même discipline que
 * `blog-posts.ts`) : paiement à la livraison présenté comme le mode par
 * défaut, Mobile Money comme "en cours de déploiement" (jamais comme déjà
 * disponible pour les commandes — voir la marche arrière du 29/09/2026 dans
 * decisions-techniques.md), aucun prix chiffré (règle du calendrier de
 * contenu, `claude/calendrier-posts-2-semaines.md`).
 */
const FAQ_SECTIONS: { title: string; items: { question: string; answer: string }[] }[] = [
  {
    title: "Pour les acheteurs",
    items: [
      {
        question: "Dois-je créer un compte pour commander sur KEVA ?",
        answer:
          "Non. Tu peux parcourir les boutiques, ajouter des produits au panier et passer commande sans créer de compte.",
      },
      {
        question: "Comment je paie ma commande ?",
        answer:
          "Le paiement à la livraison est le mode disponible aujourd'hui sur KEVA : tu payes au moment où tu reçois ta commande. Le paiement par Mobile Money (Orange Money, MTN Money, Moov Money, Wave) est en cours de déploiement.",
      },
      {
        question: "KEVA vend-il lui-même les produits ?",
        answer:
          "Non. KEVA est une marketplace qui réunit des boutiques indépendantes : chaque vendeur gère ses propres produits, son stock et ses livraisons.",
      },
      {
        question: "Comment je contacte un vendeur ?",
        answer:
          "Chaque boutique et chaque fiche produit propose un bouton pour écrire directement au vendeur sur WhatsApp.",
      },
    ],
  },
  {
    title: "Pour les vendeurs",
    items: [
      {
        question: "Ouvrir une boutique sur KEVA, c'est gratuit ?",
        answer:
          "KEVA propose un plan gratuit pour démarrer, avec des plans payants si tu veux aller plus loin.",
      },
      {
        question: "Combien de temps faut-il pour ouvrir ma boutique ?",
        answer:
          "Quelques minutes : nom de la boutique, photo de couverture, catégorie, puis tes premiers produits.",
      },
      {
        question: "Dans quelles catégories puis-je vendre ?",
        answer:
          "Mode, beauté, électronique, maison, alimentation et bien d'autres catégories.",
      },
      {
        question: "Comment mes clientes me paient-elles ?",
        answer:
          "Le paiement à la livraison est le mode par défaut du parcours de commande KEVA, sans rien à configurer de ton côté. Le Mobile Money est en cours de déploiement.",
      },
      {
        question: "Puis-je proposer des promotions ?",
        answer: "Oui, tu peux créer des codes promo sur tes produits directement depuis ton tableau de bord.",
      },
      {
        question: "Existe-t-il un programme de parrainage ?",
        answer: "Oui, KEVA propose un programme de parrainage pour les vendeurs.",
      },
    ],
  },
];

/** JSON-LD `FAQPage` — même esprit que `OrganizationJsonLd` dans layout.tsx :
 * les réponses y sont dupliquées telles quelles (texte brut, sans le
 * <details>/<summary> de la mise en page) pour rester exploitables par les
 * outils qui lisent le balisage structuré plutôt que le DOM rendu. */
function FaqJsonLd() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQ_SECTIONS.flatMap((section) =>
      section.items.map((item) => ({
        "@type": "Question",
        name: item.question,
        acceptedAnswer: {
          "@type": "Answer",
          text: item.answer,
        },
      }))
    ),
  };
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}

export default function FaqPage() {
  return (
    <div className="min-h-screen bg-brume">
      <FaqJsonLd />
      <header className="border-b border-ligne bg-white px-4 py-4">
        <Link href="/" className="mx-auto flex w-full max-w-2xl items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element -- logo statique */}
          <img src="/keva-logo.jpg" alt="KEVA" className="h-8 w-8 rounded-md object-cover" />
          <span className="font-display text-lg font-bold tracking-wide text-vert-sapin">KEVA</span>
        </Link>
      </header>

      <main className="mx-auto w-full max-w-2xl px-4 py-10">
        <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-vert-actif">
          Aide
        </p>
        <h1 className="mt-2 font-display text-2xl font-semibold text-encre sm:text-3xl">
          Questions fréquentes
        </h1>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-encre/70">
          Les réponses aux questions les plus courantes sur KEVA. Une autre
          question ?{" "}
          <Link href="/contact" className="text-vert-actif underline">
            Contacte-nous
          </Link>
          .
        </p>

        {FAQ_SECTIONS.map((section) => (
          <div key={section.title} className="mt-8">
            <h2 className="font-display text-lg font-semibold text-encre">
              {section.title}
            </h2>
            <div className="mt-3 flex flex-col gap-2">
              {section.items.map((item) => (
                <details
                  key={item.question}
                  className="group rounded-lg border border-ligne bg-white px-4 py-3 open:border-vert-actif"
                >
                  <summary className="cursor-pointer list-none text-sm font-medium text-encre [&::-webkit-details-marker]:hidden">
                    <span className="flex items-center justify-between gap-3">
                      {item.question}
                      <span
                        aria-hidden="true"
                        className="text-encre/40 transition group-open:rotate-45"
                      >
                        +
                      </span>
                    </span>
                  </summary>
                  <p className="mt-2 text-sm leading-relaxed text-encre/70">
                    {item.answer}
                  </p>
                </details>
              ))}
            </div>
          </div>
        ))}

        <Link href="/" className="mt-10 inline-block text-sm text-vert-actif underline">
          Retour à l&apos;accueil
        </Link>
      </main>
    </div>
  );
}
