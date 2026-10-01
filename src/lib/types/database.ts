/**
 * Types du schéma Supabase (`public`) — 30/09/2026, audit technique complet
 * demandé par Isaac ("corrige tout").
 *
 * Pourquoi ce fichier existe
 * --------------------------
 * Jusqu'au 30/09/2026, ce fichier contenait `export type Database = any`,
 * un placeholder posé à la toute première migration (0001) en attendant une
 * génération réelle qui n'a jamais eu lieu. Les trois clients Supabase
 * (`src/lib/supabase/server.ts`, `client.ts`, et le client service role) sont
 * tous typés `SupabaseClient<Database>` : avec `any`, AUCUN appel
 * `.from("table").select/insert/update(...)` ni `.rpc("fonction", {...})` du
 * projet n'était vérifié à la compilation — une faute de frappe sur un nom
 * de colonne, de table ou de paramètre RPC ne se voyait qu'en production.
 * C'était le problème de qualité de code le plus impactant relevé par
 * l'audit.
 *
 * Comment ce typage a été construit
 * ---------------------------------
 * Faute d'accès direct à la base (pas de credentials disponibles pendant
 * l'audit pour lancer `supabase gen types typescript`), ce fichier est
 * RECONSTITUÉ À LA MAIN en rejouant mentalement, dans l'ordre, les 50
 * migrations de `supabase/migrations/` (0001_init.sql →
 * 0050_commercial_commission_idempotency.sql inclus) : chaque `create
 * table`, `alter table add/drop column`, `drop/add constraint`, `create or
 * replace function`, `drop function`... Il suit volontairement le même
 * format que la sortie de `supabase gen types typescript` (Tables → Row /
 * Insert / Update / Relationships, Functions → Args / Returns) pour qu'un
 * remplacement par le fichier généré soit transparent pour tout le code.
 *
 * Écarts VOLONTAIRES par rapport à la sortie brute du générateur (plus
 * stricts, jamais plus laxistes) :
 * - Les colonnes `text` protégées par une contrainte `check (col in (...))`
 *   (ensemble fermé de valeurs) sont typées en union de littéraux plutôt
 *   qu'en `string` — le générateur ne sait pas lire les `check`, seulement
 *   les vrais `enum` Postgres (aucun dans ce projet).
 * - Les colonnes de `RETURNS TABLE` issues d'une colonne nullable (ex.
 *   `shops.notification_email`) sont typées `| null` — le générateur les
 *   déclare toutes non nulles, ce qui est faux.
 * - Les paramètres RPC dont le corps SQL gère explicitement `null`
 *   (`coalesce(p_x, ...)`, `default null`) acceptent `| null`.
 * - `products.attributes` (jsonb) est typée `ProductAttributes` (clé ->
 *   texte) plutôt que `Json` — voir le commentaire du type plus bas.
 *
 * Point d'attention découvert pendant cette reconstitution : deux fonctions
 * existent en base sous PLUSIEURS signatures (surcharges jamais supprimées,
 * `create_order` et `get_shop_best_sellers` — détail en section Functions).
 * Un appel `.rpc()` dont les arguments nommés correspondent à plus d'une
 * surcharge est refusé par PostgREST (erreur PGRST203) : toujours nommer
 * explicitement le dernier paramètre optionnel de la version voulue.
 *
 * Maintenance
 * -----------
 * - Chaque nouvelle migration qui touche au schéma (table, colonne,
 *   contrainte `check`, fonction appelée via `.rpc()`) DOIT être reportée
 *   ici dans le même chantier, sinon `tsc` refusera le code qui l'utilise
 *   (c'est précisément le but).
 * - Si un écart apparaît entre ce fichier et la vraie base, la source de
 *   vérité reste la base : Isaac peut régénérer ce fichier depuis sa machine
 *   avec
 *
 *     npx supabase gen types typescript --project-id <PROJECT_ID> > src/lib/types/database.ts
 *
 *   ce qui remplacerait avantageusement cette reconstitution manuelle (en
 *   perdant seulement les unions de littéraux/nullabilités plus strictes
 *   décrites ci-dessus, à reporter à la main si on veut les garder).
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

// ----------------------------------------------------------------------------
// Ensembles fermés de valeurs (contraintes `check` en base).
// ----------------------------------------------------------------------------

/** `profiles_role_check` — état final : migration 0046. */
export type ProfileRole = "vendor" | "admin" | "customer" | "commercial";

/** `shops_category_check` — état final : migration 0015 (24 valeurs, cf. src/lib/categories.ts). */
export type ShopCategory =
  | "mode"
  | "mode_femme"
  | "mode_homme"
  | "mode_enfant"
  | "chaussures"
  | "bijoux"
  | "beaute"
  | "sante_bienetre"
  | "electronique"
  | "telephonie"
  | "informatique"
  | "electromenager"
  | "maison"
  | "decoration"
  | "cuisine"
  | "alimentation"
  | "bebe"
  | "jouets"
  | "sport"
  | "auto_moto"
  | "bricolage_jardin"
  | "papeterie"
  | "livres"
  | "autre";

/** `shops.status` — migration 0001. */
export type ShopStatus = "active" | "suspended";

/** `shops.mobile_money_operator` — migration 0047. */
export type MobileMoneyOperator = "wave" | "orange_money" | "mtn_momo" | "moov";

/** `orders.status` — migration 0001. */
export type OrderStatus = "pending" | "paid" | "preparing" | "delivered" | "cancelled";

/** `orders.payment_method` — migration 0001. */
export type PaymentMethod = "mobile_money" | "cash_on_delivery";

/** `payments.status` — migration 0001. */
export type PaymentStatus = "pending" | "success" | "failed";

/** `subscriptions.status` — migration 0001. */
export type SubscriptionStatus = "active" | "expired" | "grace_period";

/** `notifications_kind_check` — migration 0030. */
export type NotificationKindValue =
  | "new_order"
  | "order_cancelled"
  | "status_change"
  | "review_ready"
  | "admin_message"
  | "info";

/** `promo_codes.discount_type` — migration 0023. */
export type PromoDiscountType = "percentage" | "fixed";

/** `shop_collaborators.status` — migration 0024. */
export type CollaboratorStatus = "pending" | "active";

/** `contact_messages.status` — migration 0038. */
export type ContactMessageStatus = "new" | "handled";

/**
 * `products.attributes` (jsonb, migration 0032) — seule colonne jsonb typée
 * plus finement que `Json` : sa forme (clé technique -> valeur texte) n'est
 * PAS garantie par une contrainte en base, mais par son unique chemin
 * d'écriture (`dashboard/produits/actions.ts`, qui ne construit qu'un
 * `Record<string, string>`) et par tous ses lecteurs (fiche produit, filtres
 * marketplace, formulaire vendeur), qui supposent tous cette forme depuis
 * le 22/09/2026 — voir src/lib/category-attributes.ts.
 */
export type ProductAttributes = { [key: string]: string };

// ----------------------------------------------------------------------------
// Arguments communs aux 4 surcharges de `create_order` encore présentes en
// base (voir la section Functions plus bas).
// ----------------------------------------------------------------------------
type CreateOrderBaseArgs = {
  p_shop_id: string;
  p_customer_name: string;
  p_customer_phone: string;
  p_delivery_address: string | null;
  p_payment_method: PaymentMethod;
  p_items: Json;
};

export type Database = {
  public: {
    Tables: {
      // ----------------------------------------------------------------------
      // 0045/0046 (rôle commercial) ; 0008/0014/0046 (contrainte de rôle) ;
      // 0040 (charte vendeur). `guest_claim_*` ajoutées en 0035 puis
      // retirées en 0036 (déplacées dans `guest_claim_rate_limits`).
      // ----------------------------------------------------------------------
      profiles: {
        Row: {
          id: string;
          phone: string | null;
          display_name: string | null;
          avatar_url: string | null;
          role: ProfileRole;
          created_at: string;
          shop_charter_accepted_at: string | null;
          shop_charter_version: number;
          referred_by_code: string | null;
          commercial_code: string | null;
          referred_by_agent_code: string | null;
        };
        Insert: {
          id: string;
          phone?: string | null;
          display_name?: string | null;
          avatar_url?: string | null;
          role?: ProfileRole;
          created_at?: string;
          shop_charter_accepted_at?: string | null;
          shop_charter_version?: number;
          referred_by_code?: string | null;
          commercial_code?: string | null;
          referred_by_agent_code?: string | null;
        };
        Update: {
          id?: string;
          phone?: string | null;
          display_name?: string | null;
          avatar_url?: string | null;
          role?: ProfileRole;
          created_at?: string;
          shop_charter_accepted_at?: string | null;
          shop_charter_version?: number;
          referred_by_code?: string | null;
          commercial_code?: string | null;
          referred_by_agent_code?: string | null;
        };
        // `profiles.id` référence `auth.users` (schéma `auth`, hors périmètre
        // du type généré) : aucune relation déclarée ici.
        Relationships: [];
      };

      // ----------------------------------------------------------------------
      // 0001 + view_count (0005), delivery_fee (0012), whatsapp_number /
      // notification_email (0013), accent_color (0022), plan_rank /
      // is_verified (0042), mobile_money_* (0047). `admin_notes` ajoutée en
      // 0007 puis retirée en 0008 (déplacée dans `shop_admin_notes`).
      // ----------------------------------------------------------------------
      shops: {
        Row: {
          id: string;
          owner_id: string;
          name: string;
          slug: string;
          description: string | null;
          category: ShopCategory;
          cover_url: string | null;
          logo_url: string | null;
          status: ShopStatus;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
          view_count: number;
          delivery_fee: number | null;
          whatsapp_number: string | null;
          notification_email: string | null;
          accent_color: string | null;
          plan_rank: number;
          is_verified: boolean;
          mobile_money_number: string | null;
          mobile_money_operator: MobileMoneyOperator | null;
          ville: string | null;
          commune: string | null;
        };
        Insert: {
          id?: string;
          owner_id: string;
          name: string;
          slug: string;
          description?: string | null;
          category: ShopCategory;
          cover_url?: string | null;
          logo_url?: string | null;
          status?: ShopStatus;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
          view_count?: number;
          delivery_fee?: number | null;
          whatsapp_number?: string | null;
          notification_email?: string | null;
          accent_color?: string | null;
          plan_rank?: number;
          is_verified?: boolean;
          mobile_money_number?: string | null;
          mobile_money_operator?: MobileMoneyOperator | null;
          ville?: string | null;
          commune?: string | null;
        };
        Update: {
          id?: string;
          owner_id?: string;
          name?: string;
          slug?: string;
          description?: string | null;
          category?: ShopCategory;
          cover_url?: string | null;
          logo_url?: string | null;
          status?: ShopStatus;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
          view_count?: number;
          delivery_fee?: number | null;
          whatsapp_number?: string | null;
          notification_email?: string | null;
          accent_color?: string | null;
          plan_rank?: number;
          is_verified?: boolean;
          mobile_money_number?: string | null;
          mobile_money_operator?: MobileMoneyOperator | null;
          ville?: string | null;
          commune?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "shops_owner_id_fkey";
            columns: ["owner_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };

      // ----------------------------------------------------------------------
      // 0001 + tags (0011), stock_alert_threshold (0021), view_count (0025),
      // highlights / sku / barcode / sale_* (0031), attributes (0032).
      // `category` reste un simple `text` sans contrainte (cf. 0015).
      // ----------------------------------------------------------------------
      products: {
        Row: {
          id: string;
          shop_id: string;
          slug: string;
          title: string;
          description: string | null;
          price: number;
          compare_at_price: number | null;
          stock: number;
          category: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
          tags: string[];
          stock_alert_threshold: number | null;
          view_count: number;
          highlights: string[];
          sku: string | null;
          barcode: string | null;
          sale_price: number | null;
          sale_starts_at: string | null;
          sale_ends_at: string | null;
          attributes: ProductAttributes;
        };
        Insert: {
          id?: string;
          shop_id: string;
          slug: string;
          title: string;
          description?: string | null;
          price: number;
          compare_at_price?: number | null;
          stock?: number;
          category?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
          tags?: string[];
          stock_alert_threshold?: number | null;
          view_count?: number;
          highlights?: string[];
          sku?: string | null;
          barcode?: string | null;
          sale_price?: number | null;
          sale_starts_at?: string | null;
          sale_ends_at?: string | null;
          attributes?: ProductAttributes;
        };
        Update: {
          id?: string;
          shop_id?: string;
          slug?: string;
          title?: string;
          description?: string | null;
          price?: number;
          compare_at_price?: number | null;
          stock?: number;
          category?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
          tags?: string[];
          stock_alert_threshold?: number | null;
          view_count?: number;
          highlights?: string[];
          sku?: string | null;
          barcode?: string | null;
          sale_price?: number | null;
          sale_starts_at?: string | null;
          sale_ends_at?: string | null;
          attributes?: ProductAttributes;
        };
        Relationships: [
          {
            foreignKeyName: "products_shop_id_fkey";
            columns: ["shop_id"];
            isOneToOne: false;
            referencedRelation: "shops";
            referencedColumns: ["id"];
          },
        ];
      };

      product_images: {
        Row: {
          id: string;
          product_id: string;
          url: string;
          position: number;
        };
        Insert: {
          id?: string;
          product_id: string;
          url: string;
          position?: number;
        };
        Update: {
          id?: string;
          product_id?: string;
          url?: string;
          position?: number;
        };
        Relationships: [
          {
            foreignKeyName: "product_images_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
        ];
      };

      // 0001 + sku / barcode (0031).
      product_variants: {
        Row: {
          id: string;
          product_id: string;
          name: string;
          value: string;
          stock: number;
          extra_price: number;
          sku: string | null;
          barcode: string | null;
        };
        Insert: {
          id?: string;
          product_id: string;
          name: string;
          value: string;
          stock?: number;
          extra_price?: number;
          sku?: string | null;
          barcode?: string | null;
        };
        Update: {
          id?: string;
          product_id?: string;
          name?: string;
          value?: string;
          stock?: number;
          extra_price?: number;
          sku?: string | null;
          barcode?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "product_variants_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
        ];
      };

      // ----------------------------------------------------------------------
      // 0001 + delivery_lat/lng (0006), delivery_fee / customer_email (0012),
      // customer_id (0014), promo_code_id / discount_amount (0023).
      // ----------------------------------------------------------------------
      orders: {
        Row: {
          id: string;
          shop_id: string;
          customer_name: string;
          customer_phone: string;
          delivery_address: string | null;
          status: OrderStatus;
          payment_method: PaymentMethod;
          total_amount: number;
          created_at: string;
          updated_at: string;
          delivery_lat: number | null;
          delivery_lng: number | null;
          delivery_fee: number;
          customer_email: string | null;
          customer_id: string | null;
          promo_code_id: string | null;
          discount_amount: number;
        };
        Insert: {
          id?: string;
          shop_id: string;
          customer_name: string;
          customer_phone: string;
          delivery_address?: string | null;
          status?: OrderStatus;
          payment_method: PaymentMethod;
          total_amount: number;
          created_at?: string;
          updated_at?: string;
          delivery_lat?: number | null;
          delivery_lng?: number | null;
          delivery_fee?: number;
          customer_email?: string | null;
          customer_id?: string | null;
          promo_code_id?: string | null;
          discount_amount?: number;
        };
        Update: {
          id?: string;
          shop_id?: string;
          customer_name?: string;
          customer_phone?: string;
          delivery_address?: string | null;
          status?: OrderStatus;
          payment_method?: PaymentMethod;
          total_amount?: number;
          created_at?: string;
          updated_at?: string;
          delivery_lat?: number | null;
          delivery_lng?: number | null;
          delivery_fee?: number;
          customer_email?: string | null;
          customer_id?: string | null;
          promo_code_id?: string | null;
          discount_amount?: number;
        };
        Relationships: [
          {
            foreignKeyName: "orders_shop_id_fkey";
            columns: ["shop_id"];
            isOneToOne: false;
            referencedRelation: "shops";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "orders_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "orders_promo_code_id_fkey";
            columns: ["promo_code_id"];
            isOneToOne: false;
            referencedRelation: "promo_codes";
            referencedColumns: ["id"];
          },
        ];
      };

      // 0001, `variant_id` retirée en 0010 (remplacée par order_item_variants).
      order_items: {
        Row: {
          id: string;
          order_id: string;
          product_id: string;
          quantity: number;
          unit_price: number;
        };
        Insert: {
          id?: string;
          order_id: string;
          product_id: string;
          quantity: number;
          unit_price: number;
        };
        Update: {
          id?: string;
          order_id?: string;
          product_id?: string;
          quantity?: number;
          unit_price?: number;
        };
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "order_items_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
        ];
      };

      // 0010 — clé primaire composite (order_item_id, variant_id).
      order_item_variants: {
        Row: {
          order_item_id: string;
          variant_id: string;
        };
        Insert: {
          order_item_id: string;
          variant_id: string;
        };
        Update: {
          order_item_id?: string;
          variant_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "order_item_variants_order_item_id_fkey";
            columns: ["order_item_id"];
            isOneToOne: false;
            referencedRelation: "order_items";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "order_item_variants_variant_id_fkey";
            columns: ["variant_id"];
            isOneToOne: false;
            referencedRelation: "product_variants";
            referencedColumns: ["id"];
          },
        ];
      };

      // 0001 + intent_plan_code (0017), provider_notify_token (0018).
      // `provider` n'a pas de contrainte `check` (défaut 'cinetpay').
      payments: {
        Row: {
          id: string;
          shop_id: string | null;
          order_id: string | null;
          subscription_id: string | null;
          provider: string;
          provider_transaction_id: string | null;
          amount: number | null;
          currency: string;
          status: PaymentStatus;
          raw_payload: Json | null;
          created_at: string;
          intent_plan_code: string | null;
          provider_notify_token: string | null;
        };
        Insert: {
          id?: string;
          shop_id?: string | null;
          order_id?: string | null;
          subscription_id?: string | null;
          provider?: string;
          provider_transaction_id?: string | null;
          amount?: number | null;
          currency?: string;
          status?: PaymentStatus;
          raw_payload?: Json | null;
          created_at?: string;
          intent_plan_code?: string | null;
          provider_notify_token?: string | null;
        };
        Update: {
          id?: string;
          shop_id?: string | null;
          order_id?: string | null;
          subscription_id?: string | null;
          provider?: string;
          provider_transaction_id?: string | null;
          amount?: number | null;
          currency?: string;
          status?: PaymentStatus;
          raw_payload?: Json | null;
          created_at?: string;
          intent_plan_code?: string | null;
          provider_notify_token?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "payments_shop_id_fkey";
            columns: ["shop_id"];
            isOneToOne: false;
            referencedRelation: "shops";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "payments_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "payments_subscription_id_fkey";
            columns: ["subscription_id"];
            isOneToOne: false;
            referencedRelation: "subscriptions";
            referencedColumns: ["id"];
          },
        ];
      };

      // 0001 + rank (0042, not null default 3). `code` sans contrainte
      // `check` (valeurs actuelles : 'starter' | 'business' | 'pro', 0016).
      subscription_plans: {
        Row: {
          id: string;
          code: string;
          name: string;
          price: number;
          duration_days: number;
          features: Json;
          rank: number;
        };
        Insert: {
          id?: string;
          code: string;
          name: string;
          price?: number;
          duration_days?: number;
          features?: Json;
          rank?: number;
        };
        Update: {
          id?: string;
          code?: string;
          name?: string;
          price?: number;
          duration_days?: number;
          features?: Json;
          rank?: number;
        };
        Relationships: [];
      };

      // 0001 + is_trial (0029) + contrainte unique(shop_id) (0036) : relation
      // shops -> subscriptions désormais un-à-un.
      subscriptions: {
        Row: {
          id: string;
          shop_id: string;
          plan_id: string;
          status: SubscriptionStatus;
          started_at: string;
          expires_at: string;
          is_trial: boolean;
        };
        Insert: {
          id?: string;
          shop_id: string;
          plan_id: string;
          status?: SubscriptionStatus;
          started_at?: string;
          expires_at: string;
          is_trial?: boolean;
        };
        Update: {
          id?: string;
          shop_id?: string;
          plan_id?: string;
          status?: SubscriptionStatus;
          started_at?: string;
          expires_at?: string;
          is_trial?: boolean;
        };
        Relationships: [
          {
            foreignKeyName: "subscriptions_shop_id_fkey";
            columns: ["shop_id"];
            isOneToOne: true;
            referencedRelation: "shops";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "subscriptions_plan_id_fkey";
            columns: ["plan_id"];
            isOneToOne: false;
            referencedRelation: "subscription_plans";
            referencedColumns: ["id"];
          },
        ];
      };

      transaction_logs: {
        Row: {
          id: string;
          actor_id: string | null;
          shop_id: string | null;
          action: string;
          metadata: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          actor_id?: string | null;
          shop_id?: string | null;
          action: string;
          metadata?: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          actor_id?: string | null;
          shop_id?: string | null;
          action?: string;
          metadata?: Json;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "transaction_logs_actor_id_fkey";
            columns: ["actor_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "transaction_logs_shop_id_fkey";
            columns: ["shop_id"];
            isOneToOne: false;
            referencedRelation: "shops";
            referencedColumns: ["id"];
          },
        ];
      };

      // 0001 + link / kind (0030).
      notifications: {
        Row: {
          id: string;
          profile_id: string;
          title: string;
          body: string | null;
          is_read: boolean;
          created_at: string;
          link: string | null;
          kind: NotificationKindValue;
        };
        Insert: {
          id?: string;
          profile_id: string;
          title: string;
          body?: string | null;
          is_read?: boolean;
          created_at?: string;
          link?: string | null;
          kind?: NotificationKindValue;
        };
        Update: {
          id?: string;
          profile_id?: string;
          title?: string;
          body?: string | null;
          is_read?: boolean;
          created_at?: string;
          link?: string | null;
          kind?: NotificationKindValue;
        };
        Relationships: [
          {
            foreignKeyName: "notifications_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };

      // 0008 — `shop_id` est la clé primaire : relation un-à-un avec shops.
      shop_admin_notes: {
        Row: {
          shop_id: string;
          note: string | null;
          updated_at: string;
        };
        Insert: {
          shop_id: string;
          note?: string | null;
          updated_at?: string;
        };
        Update: {
          shop_id?: string;
          note?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "shop_admin_notes_shop_id_fkey";
            columns: ["shop_id"];
            isOneToOne: true;
            referencedRelation: "shops";
            referencedColumns: ["id"];
          },
        ];
      };

      // 0011 + seller_reply / seller_reply_at (0028).
      product_reviews: {
        Row: {
          id: string;
          product_id: string;
          order_id: string | null;
          customer_name: string;
          rating: number;
          comment: string | null;
          created_at: string;
          seller_reply: string | null;
          seller_reply_at: string | null;
        };
        Insert: {
          id?: string;
          product_id: string;
          order_id?: string | null;
          customer_name: string;
          rating: number;
          comment?: string | null;
          created_at?: string;
          seller_reply?: string | null;
          seller_reply_at?: string | null;
        };
        Update: {
          id?: string;
          product_id?: string;
          order_id?: string | null;
          customer_name?: string;
          rating?: number;
          comment?: string | null;
          created_at?: string;
          seller_reply?: string | null;
          seller_reply_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "product_reviews_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "product_reviews_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
        ];
      };

      // 0023.
      promo_codes: {
        Row: {
          id: string;
          shop_id: string;
          code: string;
          discount_type: PromoDiscountType;
          discount_value: number;
          is_active: boolean;
          max_uses: number | null;
          used_count: number;
          expires_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          shop_id: string;
          code: string;
          discount_type: PromoDiscountType;
          discount_value: number;
          is_active?: boolean;
          max_uses?: number | null;
          used_count?: number;
          expires_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          shop_id?: string;
          code?: string;
          discount_type?: PromoDiscountType;
          discount_value?: number;
          is_active?: boolean;
          max_uses?: number | null;
          used_count?: number;
          expires_at?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "promo_codes_shop_id_fkey";
            columns: ["shop_id"];
            isOneToOne: false;
            referencedRelation: "shops";
            referencedColumns: ["id"];
          },
        ];
      };

      // 0024.
      shop_collaborators: {
        Row: {
          id: string;
          shop_id: string;
          user_id: string | null;
          invited_email: string;
          status: CollaboratorStatus;
          invited_at: string;
          accepted_at: string | null;
        };
        Insert: {
          id?: string;
          shop_id: string;
          user_id?: string | null;
          invited_email: string;
          status?: CollaboratorStatus;
          invited_at?: string;
          accepted_at?: string | null;
        };
        Update: {
          id?: string;
          shop_id?: string;
          user_id?: string | null;
          invited_email?: string;
          status?: CollaboratorStatus;
          invited_at?: string;
          accepted_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "shop_collaborators_shop_id_fkey";
            columns: ["shop_id"];
            isOneToOne: false;
            referencedRelation: "shops";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "shop_collaborators_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };

      // 0036 — RLS sans aucune policy (accès security definer uniquement).
      guest_claim_rate_limits: {
        Row: {
          profile_id: string;
          attempts: number;
          window_started_at: string | null;
        };
        Insert: {
          profile_id: string;
          attempts?: number;
          window_started_at?: string | null;
        };
        Update: {
          profile_id?: string;
          attempts?: number;
          window_started_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "guest_claim_rate_limits_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: true;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };

      // 0038.
      contact_messages: {
        Row: {
          id: string;
          name: string;
          email: string;
          subject: string;
          message: string;
          status: ContactMessageStatus;
          created_at: string;
          handled_at: string | null;
          handled_by: string | null;
        };
        Insert: {
          id?: string;
          name: string;
          email: string;
          subject: string;
          message: string;
          status?: ContactMessageStatus;
          created_at?: string;
          handled_at?: string | null;
          handled_by?: string | null;
        };
        Update: {
          id?: string;
          name?: string;
          email?: string;
          subject?: string;
          message?: string;
          status?: ContactMessageStatus;
          created_at?: string;
          handled_at?: string | null;
          handled_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "contact_messages_handled_by_fkey";
            columns: ["handled_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };

      // 0043 — `source` validée par `increment_shop_view` (whatsapp /
      // instagram / facebook / tiktok / direct) mais SANS contrainte `check`
      // en base : typée `string`.
      shop_page_views: {
        Row: {
          id: string;
          shop_id: string;
          source: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          shop_id: string;
          source?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          shop_id?: string;
          source?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "shop_page_views_shop_id_fkey";
            columns: ["shop_id"];
            isOneToOne: false;
            referencedRelation: "shops";
            referencedColumns: ["id"];
          },
        ];
      };

      // 0044.
      abandoned_carts: {
        Row: {
          id: string;
          shop_id: string;
          customer_phone: string;
          customer_name: string;
          cart_snapshot: Json;
          cart_total: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          shop_id: string;
          customer_phone: string;
          customer_name: string;
          cart_snapshot: Json;
          cart_total?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          shop_id?: string;
          customer_phone?: string;
          customer_name?: string;
          cart_snapshot?: Json;
          cart_total?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "abandoned_carts_shop_id_fkey";
            columns: ["shop_id"];
            isOneToOne: false;
            referencedRelation: "shops";
            referencedColumns: ["id"];
          },
        ];
      };

      // 0045 — `referred_shop_id` unique : un-à-un avec shops de ce côté.
      referrals: {
        Row: {
          id: string;
          referrer_shop_id: string;
          referred_shop_id: string;
          created_at: string;
          rewarded_at: string | null;
          reward_days: number;
        };
        Insert: {
          id?: string;
          referrer_shop_id: string;
          referred_shop_id: string;
          created_at?: string;
          rewarded_at?: string | null;
          reward_days?: number;
        };
        Update: {
          id?: string;
          referrer_shop_id?: string;
          referred_shop_id?: string;
          created_at?: string;
          rewarded_at?: string | null;
          reward_days?: number;
        };
        Relationships: [
          {
            foreignKeyName: "referrals_referrer_shop_id_fkey";
            columns: ["referrer_shop_id"];
            isOneToOne: false;
            referencedRelation: "shops";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "referrals_referred_shop_id_fkey";
            columns: ["referred_shop_id"];
            isOneToOne: true;
            referencedRelation: "shops";
            referencedColumns: ["id"];
          },
        ];
      };

      // 0046 — `referred_shop_id` unique : un-à-un avec shops de ce côté.
      commercial_referrals: {
        Row: {
          id: string;
          commercial_id: string;
          referred_shop_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          commercial_id: string;
          referred_shop_id: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          commercial_id?: string;
          referred_shop_id?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "commercial_referrals_commercial_id_fkey";
            columns: ["commercial_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "commercial_referrals_referred_shop_id_fkey";
            columns: ["referred_shop_id"];
            isOneToOne: true;
            referencedRelation: "shops";
            referencedColumns: ["id"];
          },
        ];
      };

      // 0046 + payment_id (0050, unique PARTIEL `where payment_id is not
      // null` — un index partiel ne rend pas la relation un-à-un pour
      // PostgREST).
      commercial_commission_events: {
        Row: {
          id: string;
          commercial_id: string;
          referred_shop_id: string;
          plan_code: string;
          amount: number;
          created_at: string;
          paid_at: string | null;
          payment_id: string | null;
        };
        Insert: {
          id?: string;
          commercial_id: string;
          referred_shop_id: string;
          plan_code: string;
          amount: number;
          created_at?: string;
          paid_at?: string | null;
          payment_id?: string | null;
        };
        Update: {
          id?: string;
          commercial_id?: string;
          referred_shop_id?: string;
          plan_code?: string;
          amount?: number;
          created_at?: string;
          paid_at?: string | null;
          payment_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "commercial_commission_events_commercial_id_fkey";
            columns: ["commercial_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "commercial_commission_events_referred_shop_id_fkey";
            columns: ["referred_shop_id"];
            isOneToOne: false;
            referencedRelation: "shops";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "commercial_commission_events_payment_id_fkey";
            columns: ["payment_id"];
            isOneToOne: false;
            referencedRelation: "payments";
            referencedColumns: ["id"];
          },
        ];
      };

      // 0048 — RLS sans aucune policy (accès via check_rate_limit uniquement).
      endpoint_rate_limits: {
        Row: {
          id: string;
          scope: string;
          identifier: string;
          window_started_at: string;
          attempt_count: number;
        };
        Insert: {
          id?: string;
          scope: string;
          identifier: string;
          window_started_at?: string;
          attempt_count?: number;
        };
        Update: {
          id?: string;
          scope?: string;
          identifier?: string;
          window_started_at?: string;
          attempt_count?: number;
        };
        Relationships: [];
      };

      // 0052 — un profil peut avoir plusieurs abonnements (un par
      // appareil/navigateur où il a activé les notifications push).
      push_subscriptions: {
        Row: {
          id: string;
          profile_id: string;
          endpoint: string;
          p256dh: string;
          auth: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          profile_id: string;
          endpoint: string;
          p256dh: string;
          auth: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          profile_id?: string;
          endpoint?: string;
          p256dh?: string;
          auth?: string;
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    // ------------------------------------------------------------------------
    // Fonctions non-trigger du schéma `public` (les fonctions `returns
    // trigger` — handle_new_user, prevent_* , sync_shop_plan_denormalization
    // — ne sont pas appelables via `.rpc()` et sont exclues, comme le fait le
    // générateur). Une fonction encore présente en base sous plusieurs
    // signatures (surcharges jamais supprimées par un `drop function`) est
    // typée comme une union, exactement comme le générateur le ferait.
    // ------------------------------------------------------------------------
    Functions: {
      // 0024.
      accept_shop_collaboration: {
        Args: { p_shop_id: string };
        Returns: undefined;
      };
      // 0030.
      cancel_order: {
        Args: { p_order_id: string };
        Returns: undefined;
      };
      // 0048.
      check_rate_limit: {
        Args: {
          p_scope: string;
          p_identifier: string;
          p_max_attempts: number;
          p_window_minutes: number;
        };
        Returns: boolean;
      };
      // 0014, corps durci en 0035/0036 (signature inchangée).
      claim_guest_orders: {
        Args: never;
        Returns: number;
      };
      // 0044.
      clear_abandoned_cart: {
        Args: { p_shop_id: string; p_customer_phone: string };
        Returns: undefined;
      };
      // 0046.
      create_commercial_referral: {
        Args: { p_referred_shop_id: string; p_agent_code: string | null };
        Returns: undefined;
      };
      // Quatre surcharges coexistent en base : chaque ajout de paramètre
      // (0006, 0012, 0023) a créé une NOUVELLE fonction via `create or
      // replace` au lieu de remplacer l'ancienne, et aucune migration ne les
      // a supprimées. Seule la version à 10 paramètres (0023, corps actuel
      // 0031) est à jour ; les autres sont des reliquats (celle à 6
      // paramètres de 0004 insère même encore dans `order_items.variant_id`,
      // colonne supprimée en 0010).
      create_order:
        | {
            Args: CreateOrderBaseArgs;
            Returns: string;
          }
        | {
            Args: CreateOrderBaseArgs & {
              p_delivery_lat?: number | null;
              p_delivery_lng?: number | null;
            };
            Returns: string;
          }
        | {
            Args: CreateOrderBaseArgs & {
              p_delivery_lat?: number | null;
              p_delivery_lng?: number | null;
              p_customer_email?: string | null;
            };
            Returns: string;
          }
        | {
            Args: CreateOrderBaseArgs & {
              p_delivery_lat?: number | null;
              p_delivery_lng?: number | null;
              p_customer_email?: string | null;
              p_promo_code?: string | null;
            };
            Returns: string;
          };
      // 0045.
      create_referral: {
        Args: { p_referred_shop_id: string; p_referrer_slug: string | null };
        Returns: undefined;
      };
      // 0033 — `category is not null` filtré dans la requête.
      get_available_categories: {
        Args: never;
        Returns: { category: string }[];
      };
      // 0015.
      get_best_selling_products: {
        Args: { p_limit?: number };
        Returns: { product_id: string; total_sold: number }[];
      };
      // 0021.
      get_low_stock_alert_info: {
        Args: { p_order_id: string };
        Returns: {
          shop_name: string;
          notification_email: string | null;
          product_title: string;
          stock_after: number;
          threshold: number;
        }[];
      };
      // 0020 (forme actuelle, après drop/recreate).
      get_order_notification_info: {
        Args: { p_order_id: string };
        Returns: {
          shop_name: string;
          notification_email: string | null;
          customer_name: string;
          total_amount: number;
          order_url_path: string;
          has_order_notifications: boolean;
        }[];
      };
      // 0012 (forme actuelle, après drop/recreate).
      get_order_receipt: {
        Args: { p_order_id: string };
        Returns: {
          id: string;
          customer_name: string;
          customer_phone: string;
          customer_email: string | null;
          delivery_address: string | null;
          delivery_lat: number | null;
          delivery_lng: number | null;
          delivery_fee: number;
          status: OrderStatus;
          payment_method: PaymentMethod;
          total_amount: number;
          created_at: string;
          shop_name: string;
          shop_slug: string;
        }[];
      };
      // 0011 (forme actuelle, après drop/recreate).
      get_order_receipt_items: {
        Args: { p_order_id: string };
        Returns: {
          product_id: string;
          product_title: string;
          variant_label: string | null;
          quantity: number;
          unit_price: number;
        }[];
      };
      // 0036 — `coalesce(sum(...), 0)`, scalaire.
      get_platform_revenue: {
        Args: never;
        Returns: number;
      };
      // 0027.
      get_products_ratings: {
        Args: { p_product_ids: string[] };
        Returns: { product_id: string; average: number; review_count: number }[];
      };
      // 0033.
      get_shop_available_categories: {
        Args: { p_shop_id: string };
        Returns: { category: string }[];
      };
      // Deux surcharges coexistent : (uuid, integer) de 0025, jamais
      // supprimée, et (uuid, integer, timestamptz) recréée en 0049 avec
      // `revenue` (le `drop function` de 0049 ne vise que la version à 3
      // paramètres).
      get_shop_best_sellers:
        | {
            Args: { p_shop_id: string; p_limit?: number };
            Returns: { product_id: string; title: string; quantity_sold: number }[];
          }
        | {
            Args: { p_shop_id: string; p_limit?: number; p_since?: string | null };
            Returns: {
              product_id: string;
              title: string;
              quantity_sold: number;
              revenue: number;
            }[];
          };
      // 0026.
      get_shop_category_breakdown: {
        Args: { p_shop_id: string; p_since: string };
        Returns: { category: string; revenue: number; quantity_sold: number }[];
      };
      // 0026.
      get_shop_customer_period_stats: {
        Args: { p_shop_id: string; p_since: string };
        Returns: {
          unique_customers: number;
          new_customers: number;
          returning_customers: number;
        }[];
      };
      // 0049.
      get_shop_customer_segments: {
        Args: { p_shop_id: string; p_since: string };
        Returns: {
          nouveau: number;
          occasionnel: number;
          regulier: number;
          fidele: number;
        }[];
      };
      // 0026.
      get_shop_top_customers: {
        Args: { p_shop_id: string; p_limit?: number };
        Returns: {
          customer_phone: string;
          customer_name: string;
          total_spent: number;
          order_count: number;
        }[];
      };
      // 0043.
      get_shop_traffic_sources: {
        Args: { p_shop_id: string };
        Returns: { source: string; visits: number }[];
      };
      // 0025.
      increment_product_view: {
        Args: { p_product_id: string };
        Returns: undefined;
      };
      // 0043 (version à 1 paramètre de 0005 explicitement supprimée).
      increment_shop_view: {
        Args: { p_shop_slug: string; p_source?: string | null };
        Returns: undefined;
      };
      // 0007.
      is_admin: {
        Args: never;
        Returns: boolean;
      };
      // 0024.
      is_shop_collaborator: {
        Args: { p_shop_id: string };
        Returns: boolean;
      };
      // 0035.
      names_plausibly_match: {
        Args: { p_a: string; p_b: string };
        Returns: boolean;
      };
      // 0035.
      normalize_name_ci: {
        Args: { p_name: string | null };
        Returns: string;
      };
      // 0014.
      normalize_phone_ci: {
        Args: { p_phone: string | null };
        Returns: string;
      };
      // 0028, corps étendu aux collaborateurs en 0034.
      reply_to_product_review: {
        Args: { p_review_id: string; p_reply: string | null };
        Returns: undefined;
      };
      // 0044.
      save_abandoned_cart: {
        Args: {
          p_shop_id: string;
          p_customer_name: string;
          p_customer_phone: string;
          p_cart_snapshot: Json;
          p_cart_total: number;
        };
        Returns: undefined;
      };
      // 0037.
      shop_branding_level: {
        Args: { p_shop_id: string };
        Returns: string;
      };
      // 0007, corps mis à jour en 0016/0029/0036 (signature inchangée).
      start_free_subscription: {
        Args: { p_shop_id: string };
        Returns: undefined;
      };
      // 0011, garde-fou "commande livrée" ajouté en 0030.
      submit_product_review: {
        Args: {
          p_order_id: string;
          p_product_id: string;
          p_rating: number;
          p_comment: string | null;
        };
        Returns: undefined;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

// ----------------------------------------------------------------------------
// Utilitaires standard du fichier généré par `supabase gen types typescript`
// (mêmes noms, pour qu'un remplacement par le fichier généré reste
// transparent si du code commence à s'en servir).
// ----------------------------------------------------------------------------
type PublicSchema = Database["public"];

export type Tables<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Row"];
export type TablesInsert<T extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][T]["Insert"];
export type TablesUpdate<T extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][T]["Update"];
