/**
 * Types for the schema in supabase/migrations/20260917120000_init.sql.
 *
 * Hand-written for now. Once a Supabase project exists, regenerate with:
 *   npx supabase gen types typescript --project-id <ref> > src/lib/supabase/database.types.ts
 */

export type SubscriptionStatus =
  | "trialing"
  | "active"
  | "past_due"
  | "cancelled";

export type BookingStatus = "booked" | "cancelled" | "no_show" | "completed";

export type DepositStatus = "requested" | "paid";

export type ContactKind = "whatsapp" | "instagram";

// These are type aliases rather than interfaces on purpose: supabase-js checks
// them against Record<string, unknown>, and only type aliases get the implicit
// index signature that check needs.
export type ProfileRow = {
  id: string;
  slug: string;
  business_name: string;
  instagram_handle: string | null;
  bio: string | null;
  photo_path: string | null;
  timezone: string;
  currency: string;
  deposit_link: string | null;
  no_show_policy: string | null;
  subscription_status: SubscriptionStatus;
  paddle_customer_id: string | null;
  paddle_subscription_id: string | null;
  first_booking_at: string | null;
  created_at: string;
  updated_at: string;
}

/** The columns anonymous visitors are granted on a live booking page. */
export type PublicProfile = Pick<
  ProfileRow,
  | "id"
  | "slug"
  | "business_name"
  | "instagram_handle"
  | "bio"
  | "photo_path"
  | "timezone"
  | "currency"
  | "deposit_link"
  | "no_show_policy"
>;

export type ServiceRow = {
  id: string;
  profile_id: string;
  name: string;
  duration_minutes: number;
  price_cents: number;
  deposit_cents: number;
  swatch: string;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export type AvailabilityRow = {
  id: string;
  profile_id: string;
  weekday: number;
  start_minute: number;
  end_minute: number;
  created_at: string;
}

export type BlockedDateRow = {
  id: string;
  profile_id: string;
  blocked_on: string;
  note: string | null;
  created_at: string;
}

export type BookingRow = {
  id: string;
  profile_id: string;
  service_id: string | null;
  client_name: string;
  client_contact: string;
  contact_kind: ContactKind;
  starts_at: string;
  ends_at: string;
  status: BookingStatus;
  deposit_status: DepositStatus;
  service_name: string;
  price_cents: number;
  deposit_cents: number;
  created_at: string;
  updated_at: string;
}

/** What a visitor may read: busy times, never who booked them. */
export type BusyBooking = Pick<
  BookingRow,
  "profile_id" | "starts_at" | "ends_at" | "status"
>;

type Writable<Row, Required extends keyof Row, Generated extends keyof Row> = {
  [K in Required]: Row[K];
} & Partial<Omit<Row, Required | Generated>>;

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: ProfileRow;
        Insert: Writable<ProfileRow, "id" | "slug", "created_at" | "updated_at">;
        Update: Partial<ProfileRow>;
        Relationships: [];
      };
      services: {
        Row: ServiceRow;
        Insert: Writable<
          ServiceRow,
          "profile_id" | "name" | "duration_minutes" | "price_cents",
          "id" | "created_at" | "updated_at"
        >;
        Update: Partial<ServiceRow>;
        Relationships: [];
      };
      availability: {
        Row: AvailabilityRow;
        Insert: Writable<
          AvailabilityRow,
          "profile_id" | "weekday" | "start_minute" | "end_minute",
          "id" | "created_at"
        >;
        Update: Partial<AvailabilityRow>;
        Relationships: [];
      };
      blocked_dates: {
        Row: BlockedDateRow;
        Insert: Writable<
          BlockedDateRow,
          "profile_id" | "blocked_on",
          "id" | "created_at"
        >;
        Update: Partial<BlockedDateRow>;
        Relationships: [];
      };
      bookings: {
        Row: BookingRow;
        Insert: Writable<
          BookingRow,
          | "profile_id"
          | "client_name"
          | "client_contact"
          | "contact_kind"
          | "starts_at"
          | "ends_at"
          | "service_name"
          | "price_cents"
          | "deposit_cents",
          "id" | "created_at" | "updated_at"
        >;
        Update: Partial<BookingRow>;
        Relationships: [];
      };
    };
    Views: { [_ in never]: never };
    Functions: {
      is_page_live: {
        Args: { p_profile_id: string };
        Returns: boolean;
      };
      set_slug: {
        Args: { p_slug: string };
        Returns: string;
      };
      set_weekly_hours: {
        Args: {
          p_windows: {
            weekday: number;
            start_minute: number;
            end_minute: number;
          }[];
        };
        Returns: undefined;
      };
    };
    Enums: {
      subscription_status: SubscriptionStatus;
      booking_status: BookingStatus;
      deposit_status: DepositStatus;
      contact_kind: ContactKind;
    };
    CompositeTypes: { [_ in never]: never };
  };
}
