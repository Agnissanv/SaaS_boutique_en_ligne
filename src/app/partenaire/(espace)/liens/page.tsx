import { ShareRow } from "./share-row";
import { CopyCode } from "./copy-code";
import { getMyPartner } from "../data";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

/**
 * Liens et code de la partenaire : un lien général + un par réseau (pour
 * savoir d'où viennent ses inscrits), et son code pour ceux qui arrivent
 * sans lien. Message de partage exact sur le mois offert : il est offert à
 * TOUTE nouvelle boutique, on ne le présente donc pas comme une exclusivité
 * du code (le contrat interdit les présentations trompeuses).
 */
export default async function PartnerLinksPage() {
  const partner = await getMyPartner();
  const base = `${siteUrl.replace(/\/$/, "")}/p/${partner.code}`;
  const message = `Crée ta boutique en ligne sur KEVA avec mon code ${partner.code} : ton premier mois Pro est offert.`;

  const links = [
    { label: "Lien général", url: base },
    { label: "Pour TikTok", url: `${base}/tiktok` },
    { label: "Pour Instagram", url: `${base}/instagram` },
    { label: "Pour Facebook", url: `${base}/facebook` },
  ];

  return (
    <div>
      <h1 className="font-display text-lg font-semibold text-encre">Liens et code</h1>
      <p className="mt-1 text-sm text-encre/60">
        Chaque boutique créée avec ton lien ou ton code t&apos;est attribuée. Le lien est mémorisé
        30 jours : la personne peut visiter le site et s&apos;inscrire plus tard.
      </p>

      <section className="mt-5 rounded-lg border border-ligne bg-white p-4">
        <p className="text-xs text-encre/60">Ton code partenaire</p>
        <div className="mt-1">
          <CopyCode code={partner.code} />
        </div>
        <p className="mt-2 text-xs text-encre/60">
          Pour ceux qui n&apos;ont pas cliqué sur ton lien : ils le saisissent à l&apos;inscription ou
          sur leur page Abonnement, avant leur premier paiement.
        </p>
      </section>

      <section className="mt-4 rounded-lg border border-ligne bg-white px-4 py-1">
        <ul className="divide-y divide-ligne">
          {links.map((link) => (
            <ShareRow key={link.url} label={link.label} url={link.url} message={message} />
          ))}
        </ul>
      </section>

      <section className="mt-4 rounded-lg bg-white/60 p-4 text-sm text-encre/80">
        <p className="font-medium text-encre">Une phrase exacte à utiliser</p>
        <p className="mt-1 italic">« {message} »</p>
        <p className="mt-2 text-xs text-encre/60">
          Le mois Pro est offert à toute nouvelle boutique : évite de dire qu&apos;il n&apos;existe
          qu&apos;avec ton code.
        </p>
      </section>
    </div>
  );
}
