"use client";

import Link from "next/link";
import { useShopCart } from "@/lib/cart/useShopCart";

export function CartLink({ shopSlug }: { shopSlug: string }) {
  const { count } = useShopCart(shopSlug);

  if (count === 0) return null;

  return (
    <Link
      href={`/${shopSlug}/panier`}
      // Décalé au-dessus de la barre de navigation basse mobile (bottom-nav.tsx,
      // sm:hidden, ~64px + zone de sécurité) pour ne pas la chevaucher — revient
      // à bottom-4 dès que cette barre disparaît (≥640px).
      className="fixed bottom-20 right-4 z-30 rounded-full bg-vert-actif px-4 py-2 text-sm font-medium text-ivoire shadow-lg hover:bg-vert-sapin sm:bottom-4"
    >
      Panier ({count})
    </Link>
  );
}
