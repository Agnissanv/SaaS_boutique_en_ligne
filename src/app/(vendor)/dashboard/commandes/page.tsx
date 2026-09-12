// Liste des commandes (En attente, Payée, En préparation, Livrée, Annulée)
// + détail, changement de statut, contact WhatsApp client. cf. §3.1.A.5.
export default function OrdersPage() {
  return (
    <div>
      <h1 className="text-lg font-semibold text-gray-900">Commandes</h1>
      <p className="mt-2 text-sm text-gray-600">
        Liste des commandes à venir, avec filtre par statut et lien WhatsApp
        direct vers le client.
      </p>
    </div>
  );
}
