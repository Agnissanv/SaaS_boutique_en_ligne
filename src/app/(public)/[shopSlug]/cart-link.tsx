"use client";

import Link from "next/link";
import { useShopCart } from "@/lib/cart/useShopCart";

export function CartLink({ shopSlug }: { shopSlug: string }) {
  const { count } = useShopCart(shopSlug);

  if (count === 0) return null;

  return (
    <Link
      href={`/${shopSlug}/panier`}
      className="fixed bottom-4 right-4 rounded-full bg-gray-900 px-4 py-2 text-sm font-medium text-white shadow-lg"
    >
      Panier ({count})
    </Link>
  );
}
