import type { Database } from './database';

// Enums directly mapped from Database schema
export type DeliveryType = Database['public']['Enums']['delivery_type'];
export type PaymentMethod = Database['public']['Enums']['payment_method'];
export type OrderStatus = Database['public']['Enums']['order_status'];
export type StoreRole = Database['public']['Enums']['store_role'];

export type DayOfWeek =
  | 'monday'
  | 'tuesday'
  | 'wednesday'
  | 'thursday'
  | 'friday'
  | 'saturday'
  | 'sunday';

// Business domain opening schedule interfaces
export interface DaySchedule {
  open: string;
  close: string;
  closed: boolean;
}

export type StoreOpeningHours = Partial<Record<DayOfWeek, DaySchedule>>;

/**
 * Immutable snapshot of an ordered item.
 * Prices must be captured at order time to prevent historical inflation.
 */
export interface OrderItemSnapshot {
  product_id: string;
  name: string;
  price: number; // Snapshot numeric(10,2) as JS number
  qty: number;
}

/**
 * Input item payload for order placement via create_order_secure RPC.
 */
export interface OrderItemInput {
  product_id: string;
  qty: number;
}

// Concrete Domain Entity Aliases
export type Store = Omit<Database['public']['Tables']['stores']['Row'], 'opening_hours'> & {
  opening_hours: StoreOpeningHours;
};

export type Product = Database['public']['Tables']['products']['Row'];
export type Category = Database['public']['Tables']['categories']['Row'];
export type StoreMember = Database['public']['Tables']['store_members']['Row'];

export type Order = Omit<Database['public']['Tables']['orders']['Row'], 'items_json'> & {
  items_json: OrderItemSnapshot[];
};
