import Link from "next/link";
import { ShopCard, type MarketplaceShop } from "@/components/shop-card";

/**
 * Section "Promotions" — ajoutée le 29/09/2026, à la demande d'Isaac
 * ("adapte ces parties : hero, promotions, newsletter, footer") d'après une
 * page de référence e-commerce générique. Cette référence affichait deux
 * bannières de fausses réductions ("-50%") — jamais reproduit ici : KEVA
 * n'a aucune remise à afficher aujourd'hui, et inventer un chiffre irait
 * contre la discipline déjà en place sur cette page (compteurs réels,
 * "Mobile Money bientôt" plutôt qu'une fausse promesse, etc.).
 *
 * À la place, deux vrais avantages (choix laissé à Claude par Isaac, "1 et 2
 * à toi de voir") :
 * 1. Un vrai avantage KEVA côté vendeur — 0% commission cachée — reprend mot
 *    pour mot la bannière déjà validée dans
 *    claude/affiches-et-posts-lancement.md (Affiche 3) et précédemment
 *    utilisée dans hero-banner-carousel.tsx (retirée du hero le même jour,
 *    simplifié à la demande d'Isaac — ce message vendeur est relogé ici
 *    plutôt que perdu).
 * 2. Les nouveaux vendeurs de la semaine — vraies boutiques (`newestShops`,
 *    triées par date de création côté page.tsx), jamais une liste inventée.
 *    Double bénéfice : donne de la visibilité aux 9 premières boutiques
 *    (diagnostic croissance du 29/09/2026, decisions-techniques.md) et
 *    remplit le rôle "preuve sociale" que jouaient les bannières vendeur du
 *    carrousel du hero.
 */
export function PromotionsSection({ newestShops }: { newestShops: MarketplaceShop[] }) {
  return (
    <section className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-2">
      <Link
        href="/inscription"
        className="group flex flex-col justify-between rounded-2xl bg-gradient-to-br from-vert-sapin to-vert-actif p-8 text-white transition hover:brightness-105"
      >
        <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-ivoire/80">
          Deviens vendeur
        </p>
        <div>
          <p className="font-display text-2xl font-black leading-tight sm:text-3xl">
            0% commission cachée
          </p>
          <p className="mt-2 max-w-sm text-sm text-ivoire/80">
            Ton lien, tes prix, ta marge reste à toi.
          </p>
          <span className="mt-5 inline-flex items-center gap-2 rounded-lg bg-white px-5 py-2.5 text-sm font-semibold text-vert-sapin transition group-hover:bg-brume">
            Ouvrir ma boutique
            <span aria-hidden="true">→</span>
          </span>
        </div>
      </Link>

      {newestShops.length > 0 ? (
        <div className="flex flex-col justify-between rounded-2xl border border-ligne bg-white p-6">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-display text-lg font-semibold text-encre">
              Nouveaux vendeurs de la semaine
            </h2>
            <Link
              href="/categories"
              className="shrink-0 text-xs font-medium text-vert-actif underline"
            >
              Tout voir
            </Link>
          </div>
          <div className="-mx-1 mt-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-1 pb-1 scroll-smooth">
            {newestShops.map((shop) => (
              <ShopCard key={shop.slug} shop={shop} className="w-32 shrink-0 snap-start" />
            ))}
          </div>
        </div>
      ) : (
        <div className="flex flex-col justify-center rounded-2xl border border-dashed border-ligne bg-brume p-6 text-center">
          <p className="font-display text-lg font-semibold text-encre">
            Sois le premier vendeur mis en avant ici
          </p>
          <p className="mt-2 text-sm text-encre/70">
            Chaque nouvelle boutique KEVA apparaît dans cet encart.
          </p>
        </div>
      )}
    </section>
  );
}
