import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getShopSubscription } from "@/lib/subscription";
import { ProductForm } from "../product-form";

export default async function NewProductPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: shop } = await supabase
    .from("shops")
    .select("id")
    .eq("owner_id", user?.id ?? "")
    .maybeSingle();

  // Pas de boutique : impossible d'attacher un produit à quoi que ce soit.
  if (!shop) {
    redirect("/dashboard/boutique");
  }

  // Abonnement expiré (au-delà de la période de grâce) : on évite de montrer
  // un formulaire qui échouera de toute façon à la soumission (le vrai
  // contrôle est côté action, voir actions.ts) — meilleure expérience que de
  // laisser remplir le formulaire pour rien.
  const subscription = await getShopSubscription(supabase, shop.id);
  if (subscription.state === "expired") {
    return (
      <div>
        <h1 className="text-lg font-semibold text-gray-900">Nouveau produit</h1>
        <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          Ton abonnement est expiré : impossible d&apos;ajouter un nouveau
          produit tant qu&apos;il n&apos;est pas renouvelé. Contacte-nous pour
          le renouveler — tes produits existants restent gérables.
        </div>
        <Link
          href="/dashboard/produits"
          className="mt-4 inline-block text-sm text-gray-500 underline"
        >
          Retour aux produits
        </Link>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-lg font-semibold text-gray-900">Nouveau produit</h1>
      <p className="mt-2 text-sm text-gray-600">
        Renseigne les informations du produit à ajouter à ta boutique.
      </p>
      <ProductForm product={null} variants={[]} images={[]} />
    </div>
  );
}
