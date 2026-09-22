import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { TagIcon } from "@/components/admin/admin-icons";

const PAGE_SIZE = 50;

type PromoCodeRow = {
  id: string;
  code: string;
  discount_type: string;
  discount_value: number;
  is_active: boolean;
  max_uses: number | null;
  used_count: number;
  expires_at: string | null;
  created_at: string;
  shop: { name: string; slug: string } | { name: string; slug: string }[] | null;
};

type StatusFilter = "all" | "active" | "inactive" | "expired";

const STATUS_TABS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "Tous" },
  { value: "active", label: "Actifs" },
  { value: "inactive", label: "Désactivés" },
  { value: "expired", label: "Expirés" },
];

function formatDiscount(type: string, value: number): string {
  return type === "percentage" ? `-${value}%` : `-${value} FCFA`;
}

/**
 * Visibilité admin sur les codes promo — dernier point du bloc "priorité 2"
 * de l'audit back-office (22/09/2026). `promo_codes` (0023_promo_codes.sql,
 * 16/09/2026) n'avait jamais de policy admin ni de page : l'admin n'avait
 * aucun moyen de repérer un usage abusif (code jamais désactivé après une
 * campagne, réduction disproportionnée) à l'échelle de la plateforme. Lecture
 * seule volontairement — gérer un code promo reste une décision du vendeur
 * propriétaire, cette page sert à surveiller, pas à agir à sa place.
 *
 * Statut "Expiré" calculé à la volée (`expires_at < now`), pas lu depuis
 * `is_active` — même raisonnement que `computeSubscriptionState` : rien ne
 * remet `is_active` à false automatiquement à l'expiration.
 */
export default async function AdminPromoCodesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; page?: string }>;
}) {
  const { status: statusParam, page: pageParam } = await searchParams;
  const status: StatusFilter =
    statusParam === "active" || statusParam === "inactive" || statusParam === "expired"
      ? statusParam
      : "all";
  const page = Math.max(1, Number(pageParam) || 1);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const supabase = await createClient();

  let query = supabase
    .from("promo_codes")
    .select(
      "id, code, discount_type, discount_value, is_active, max_uses, used_count, expires_at, created_at, shop:shops(name, slug)",
      { count: "exact" }
    )
    .order("created_at", { ascending: false })
    .range(from, to);

  // Le filtre "Expiré" ne peut pas se traduire en `.eq()` (calculé, pas une
  // colonne) — filtré côté serveur avec `.lt()` sur `expires_at` à la place ;
  // "Actifs"/"Désactivés" restent des filtres directs sur `is_active`.
  if (status === "active") query = query.eq("is_active", true);
  if (status === "inactive") query = query.eq("is_active", false);
  if (status === "expired") query = query.lt("expires_at", new Date().toISOString());

  const { data: codes, count, error } = await query;
  const totalPages = count ? Math.ceil(count / PAGE_SIZE) : 1;
  // Calculé une seule fois avant le rendu (pas dans le `.map()` ci-dessous) —
  // `new Date()` plutôt que `Date.now()` : eslint (`react-hooks/purity`)
  // signale `Date.now` comme impur où qu'il soit appelé dans le corps du
  // composant, y compris hissé avant le `return`, alors que `new Date()`
  // passe (même pattern que `dashboard/page.tsx:67`).
  const now = new Date();

  return (
    <div>
      <h1 className="font-display text-lg font-semibold text-encre">Codes promo</h1>
      <p className="mt-1 text-sm text-encre/70">
        Codes promo de toutes les boutiques, en lecture seule — la gestion reste au vendeur.
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        {STATUS_TABS.map((tab) => (
          <Link
            key={tab.value}
            href={tab.value === "all" ? "/admin/codes-promo" : `/admin/codes-promo?status=${tab.value}`}
            className={`rounded-md border px-3 py-1.5 text-sm transition-colors ${
              status === tab.value
                ? "border-vert-actif bg-vert-actif/10 font-medium text-vert-sapin"
                : "border-ligne text-encre/70 hover:border-vert-actif"
            }`}
          >
            {tab.label}
          </Link>
        ))}
      </div>

      {error && (
        <p className="mt-4 rounded-md border border-erreur/30 bg-erreur/5 px-3 py-2 text-sm text-erreur">
          Impossible de charger les codes promo pour l&apos;instant. Réessaie dans un instant.
        </p>
      )}

      {!error && (codes ?? []).length === 0 ? (
        <div className="mt-6 flex flex-col items-center gap-2 rounded-lg border border-dashed border-ligne bg-white py-12 text-center">
          <TagIcon className="h-8 w-8 text-encre/30" />
          <p className="text-sm text-encre/60">Aucun code promo ici.</p>
        </div>
      ) : error ? null : (
        <div className="mt-6 overflow-x-auto rounded-lg border border-ligne bg-white">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b border-ligne text-xs text-encre/50">
                <th className="py-3 pl-4 pr-4">Code</th>
                <th className="py-3 pr-4">Boutique</th>
                <th className="py-3 pr-4">Réduction</th>
                <th className="py-3 pr-4">Utilisation</th>
                <th className="py-3 pr-4">Statut</th>
                <th className="py-3 pr-4">Expire le</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ligne">
              {(codes as PromoCodeRow[]).map((c) => {
                const shop = Array.isArray(c.shop) ? c.shop[0] : c.shop;
                const isExpired = c.expires_at ? new Date(c.expires_at) < now : false;
                return (
                  <tr key={c.id} className="transition-colors hover:bg-brume/60">
                    <td className="py-3 pl-4 pr-4 font-mono font-medium text-encre">{c.code}</td>
                    <td className="py-3 pr-4 text-encre/70">
                      {shop ? (
                        <Link href={`/admin/vendeurs/${shop.slug}`} className="underline hover:text-vert-actif">
                          {shop.name}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="py-3 pr-4 font-mono text-encre/70">
                      {formatDiscount(c.discount_type, c.discount_value)}
                    </td>
                    <td className="py-3 pr-4 text-encre/70">
                      {c.used_count}
                      {c.max_uses !== null ? ` / ${c.max_uses}` : ""}
                    </td>
                    <td className="py-3 pr-4">
                      <span
                        className={`rounded px-1.5 py-0.5 text-xs ${
                          isExpired
                            ? "bg-erreur/15 text-erreur"
                            : c.is_active
                              ? "bg-succes/15 text-succes"
                              : "bg-sable text-encre/60"
                        }`}
                      >
                        {isExpired ? "Expiré" : c.is_active ? "Actif" : "Désactivé"}
                      </span>
                    </td>
                    <td className="py-3 pr-4 text-encre/50">
                      {c.expires_at ? new Date(c.expires_at).toLocaleDateString("fr-FR") : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {!error && totalPages > 1 && (
        <div className="mt-6 flex items-center justify-center gap-2 text-sm">
          {page > 1 ? (
            <Link
              href={`/admin/codes-promo?${new URLSearchParams({ ...(status !== "all" ? { status } : {}), page: String(page - 1) })}`}
              className="rounded-md border border-ligne px-3 py-1.5 text-encre transition hover:border-vert-actif"
            >
              ‹ Précédent
            </Link>
          ) : (
            <span className="rounded-md border border-ligne px-3 py-1.5 text-encre/30">‹ Précédent</span>
          )}
          <span className="px-2 font-mono text-encre/70">
            {page} / {totalPages}
          </span>
          {page < totalPages ? (
            <Link
              href={`/admin/codes-promo?${new URLSearchParams({ ...(status !== "all" ? { status } : {}), page: String(page + 1) })}`}
              className="rounded-md border border-ligne px-3 py-1.5 text-encre transition hover:border-vert-actif"
            >
              Suivant ›
            </Link>
          ) : (
            <span className="rounded-md border border-ligne px-3 py-1.5 text-encre/30">Suivant ›</span>
          )}
        </div>
      )}
    </div>
  );
}
