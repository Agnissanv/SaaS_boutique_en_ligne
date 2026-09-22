import Link from "next/link";
import { ViewTransition } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getShopSubscription } from "@/lib/subscription";
import { getAccessibleShop } from "@/lib/shop-access";
import { ProductForm } from "../product-form";

export default async function NewProductPage({
  searchParams,
}: {
  searchParams: Promise<{ depuis?: string }>;
}) {
  const { depuis } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Accessible à un collaborateur actif (plan Pro), pas seulement au
  // propriétaire — voir src/lib/shop-access.ts.
  const access = user ? await getAccessibleShop(supabase, user.id) : null;

  // Pas de boutique : impossible d'attacher un produit à quoi que ce soit.
  if (!access) {
    redirect("/dashboard/boutique");
  }
  const shop = { id: access.shopId };

  // Duplication d'un produit existant (?depuis=<id>) — demandé par Isaac le
  // 14/09/2026 : au lieu de repartir d'un formulaire vide pour un produit très
  // proche d'un autre déjà en ligne, le formulaire est pré-rempli avec les
  // infos de la source (titre, description, catégorie, prix, stock, tags,
  // variantes, points forts, prix soldé). Volontairement PAS les photos : le
  // vendeur doit toujours en ajouter des nouvelles pour le nouveau produit —
  // dupliquer les mêmes photos donnerait deux fiches produit strictement
  // identiques visuellement. Même raisonnement pour le SKU/code-barres
  // (produit et variantes) — ajouté le 22/09/2026 (migration 0031) — ce sont
  // des identifiants censés être propres à CE produit, jamais recopiés
  // silencieusement sur un doublon. `.eq("shop_id", shop.id)` empêche de
  // dupliquer le produit d'un autre vendeur en devinant/modifiant l'id dans
  // l'URL.
  let duplicateFrom: {
    title: string;
    description: string | null;
    category: string | null;
    price: number;
    compare_at_price: number | null;
    stock: number;
    tags: string[] | null;
    stock_alert_threshold: number | null;
    highlights: string[] | null;
    sale_price: number | null;
    sale_starts_at: string | null;
    sale_ends_at: string | null;
  } | null = null;
  let duplicateVariants: { name: string; value: string }[] = [];

  if (depuis) {
    const { data: source } = await supabase
      .from("products")
      .select(
        "title, description, category, price, compare_at_price, stock, tags, stock_alert_threshold, highlights, sale_price, sale_starts_at, sale_ends_at"
      )
      .eq("id", depuis)
      .eq("shop_id", shop.id)
      .is("deleted_at", null)
      .maybeSingle();

    // Id invalide, produit d'une autre boutique, ou supprimé : on ignore
    // silencieusement plutôt que de bloquer avec une erreur — le vendeur
    // se retrouve juste avec un formulaire vide, comme une création normale.
    if (source) {
      duplicateFrom = source;
      const { data: variants } = await supabase
        .from("product_variants")
        .select("name, value")
        .eq("product_id", depuis);
      duplicateVariants = variants ?? [];
    }
  }

  // Abonnement expiré (au-delà de la période de grâce) : on évite de montrer
  // un formulaire qui échouera de toute façon à la soumission (le vrai
  // contrôle est côté action, voir actions.ts) — meilleure expérience que de
  // laisser remplir le formulaire pour rien.
  const subscription = await getShopSubscription(supabase, shop.id);
  if (subscription.state === "expired") {
    return (
      <ViewTransition enter="kv-content-in" default="none">
      <div>
        <h1 className="text-lg font-semibold text-encre">Nouveau produit</h1>
        <div className="mt-4 rounded-md border border-erreur/30 bg-erreur/10 p-4 text-sm text-erreur">
          Ton abonnement est expiré : impossible d&apos;ajouter un nouveau
          produit tant qu&apos;il n&apos;est pas renouvelé. Contacte-nous pour
          le renouveler — tes produits existants restent gérables.
        </div>
        <Link
          href="/dashboard/produits"
          className="mt-4 inline-block text-sm text-encre/60 underline"
        >
          Retour aux produits
        </Link>
      </div>
      </ViewTransition>
    );
  }

  return (
    <ViewTransition
      enter={{ "nav-forward": "nav-forward", "nav-back": "nav-back", default: "none" }}
      exit={{ "nav-forward": "nav-forward", "nav-back": "nav-back", default: "none" }}
      default="none"
    >
    <ViewTransition enter="kv-content-in" default="none">
    <div>
      <h1 className="text-lg font-semibold text-encre">Nouveau produit</h1>
      {duplicateFrom ? (
        <p className="mt-2 text-sm text-encre/70">
          Produit dupliqué à partir de « {duplicateFrom.title} ». Ajoute de
          nouvelles photos et modifie le titre si ce n&apos;est pas le même
          produit.
        </p>
      ) : (
        <p className="mt-2 text-sm text-encre/70">
          Renseigne les informations du produit à ajouter à ta boutique.
        </p>
      )}
      <ProductForm
        product={duplicateFrom}
        variants={duplicateVariants}
        images={[]}
        canManageStock={subscription.features.canManageStock}
        canUseVariants={subscription.features.canUseVariants}
        canUseAdvancedStockAlerts={subscription.features.hasAdvancedStockAlerts}
      />
    </div>
    </ViewTransition>
    </ViewTransition>
  );
}
