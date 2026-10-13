"use client";

import Link from "next/link";
import { useShopCart } from "@/lib/cart/useShopCart";

export function CartLink({ shopSlug }: { shopSlug: string }) {
  const { count } = useShopCart(shopSlug);

  if (count === 0) return null;

  return (
    <Link
      href={`/${shopSlug}/panier`}
      // Posé au-dessus de la barre de navigation basse mobile et la suit quand
      // elle se cache au défilement (`--bottom-nav-offset`, publié par
      // bottom-nav.tsx) ; bottom-4 dès que cette barre disparaît (≥640px).
      className="fixed bottom-[calc(var(--bottom-nav-offset,0px)+1rem)] right-4 z-30 rounded-full bg-vert-actif px-4 py-2 text-sm font-medium text-ivoire shadow-lg transition-[bottom] duration-300 ease-out hover:bg-vert-sapin sm:bottom-4"
    >
      Panier ({count})
    </Link>
  );
}
