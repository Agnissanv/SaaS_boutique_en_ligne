import { PartnerSettingsForm } from "./settings-form";
import { fcfa, formatDay, getMyPartner } from "../data";

/**
 * Réglages de la partenaire : ce qu'elle peut changer elle-même, et un
 * rappel en lecture seule de ce que fixe KEVA (montants, date de début).
 */
export default async function PartnerSettingsPage() {
  const partner = await getMyPartner();

  return (
    <div>
      <h1 className="font-display text-lg font-semibold text-encre">Réglages</h1>

      <PartnerSettingsForm
        displayName={partner.displayName}
        code={partner.code}
        payoutMethod={partner.payoutMethod}
        payoutPhone={partner.payoutPhone}
        codeLocked={!partner.isActive && Boolean(partner.endsOn)}
      />

      <section className="mt-5 max-w-md rounded-lg bg-white/60 p-4 text-sm text-encre/80">
        <p className="font-medium text-encre">Ton partenariat</p>
        <ul className="mt-2 space-y-1">
          <li>Depuis le {formatDay(partner.startsOn)}</li>
          {partner.endsOn && <li>Fin le {formatDay(partner.endsOn)}</li>}
          <li>{fcfa(partner.businessCommission)} / mois par abonnement Business actif</li>
          <li>{fcfa(partner.proCommission)} / mois par abonnement Pro actif</li>
        </ul>
        <p className="mt-2 text-xs text-encre/60">Ces conditions sont fixées par ton contrat avec KEVA.</p>
      </section>
    </div>
  );
}
