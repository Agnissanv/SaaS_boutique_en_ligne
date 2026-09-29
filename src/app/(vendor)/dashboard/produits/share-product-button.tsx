"use client";

import { useState } from "react";

/**
 * Partage d'une fiche produit — ajouté le 29/09/2026, retour d'Isaac ("les
 * vendeurs ne peuvent pas partager leurs fiches produits"). Vérifié avant de
 * coder : `/dashboard/produits` n'offrait que Modifier/Dupliquer/Supprimer —
 * pour envoyer le lien d'un produit précis à une cliente sur WhatsApp, un
 * vendeur devait ouvrir sa propre boutique publique, retrouver le produit
 * dedans, puis copier l'URL depuis la barre d'adresse. Aucun raccourci.
 *
 * Web Share API en priorité (mobile — Chrome/Safari Android/iOS) : ouvre le
 * vrai sélecteur d'apps du téléphone (WhatsApp, Instagram, SMS...), sans
 * privilégier un canal plutôt qu'un autre — cohérent avec le choix déjà fait
 * sur ce projet de laisser le vendeur choisir (voir `ShareShopLinks`,
 * dashboard/boutique). Repli sur `navigator.clipboard` (desktop, ou mobile
 * sans support Web Share) — même pattern que `CopyLink`/`ShareShopLinks` :
 * copie silencieuse, confirmation "Copié !" pendant 2 secondes.
 *
 * URL construite depuis `window.location.origin` plutôt qu'une variable
 * d'environnement : reste exacte quel que soit l'environnement (prod,
 * preview Vercel, localhost) sans dépendre de `NEXT_PUBLIC_SITE_URL`.
 *
 * Pas de paramètre `?src=` ajouté ici : le suivi de trafic par canal
 * (migration 0043, `ShareShopLinks`) ne couvre aujourd'hui QUE le lien de
 * boutique, explicitement pas les fiches produit (voir le commentaire de
 * cette migration) — en ajouter un ici sans le lire côté page produit
 * n'aurait rien compté, et l'aurait fait paraître suivi à tort.
 */
export function ShareProductButton({
  shopSlug,
  slug,
  title,
}: {
  shopSlug: string;
  slug: string;
  title: string;
}) {
  const [copied, setCopied] = useState(false);

  async function share() {
    const url = `${window.location.origin}/${shopSlug}/${slug}`;

    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title, url });
        return;
      } catch {
        // Partage annulé par le vendeur, ou API refusée par le navigateur —
        // on retombe sur la copie presse-papier ci-dessous dans les deux cas.
      }
    }

    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Presse-papier indisponible — échec silencieux, comme CopyLink.
    }
  }

  return (
    <button type="button" onClick={share} className="underline hover:text-vert-actif">
      {copied ? "Lien copié !" : "Partager"}
    </button>
  );
}
