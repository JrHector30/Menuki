export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      stores: {
        Row: {
          id: string;
          slug: string;
          name: string;
          phone_whatsapp: string | null;
          currency: string;
          yape_number: string | null;
          plin_number: string | null;
          logo_url: string | null;
          accent_color: string;
          opening_hours: Json;
          is_open_manual: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          slug: string;
          name: string;
          phone_whatsapp?: string | null;
          currency?: string;
          yape_number?: string | null;
          plin_number?: string | null;
          logo_url?: string | null;
          accent_color?: string;
          opening_hours?: Json;
          is_open_manual?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          slug?: string;
          name?: string;
          phone_whatsapp?: string | null;
          currency?: string;
          yape_number?: string | null;
          plin_number?: string | null;
          logo_url?: string | null;
          accent_color?: string;
          opening_hours?: Json;
          is_open_manual?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      store_members: {
        Row: {
          user_id: string;
          store_id: string;
          role: Database['public']['Enums']['store_role'];
          created_at: string;
        };
        Insert: {
          user_id: string;
          store_id: string;
          role?: Database['public']['Enums']['store_role'];
          created_at?: string;
        };
        Update: {
          user_id?: string;
          store_id?: string;
          role?: Database['public']['Enums']['store_role'];
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'store_members_store_id_fkey';
            columns: ['store_id'];
            isOneToOne: false;
            referencedRelation: 'stores';
            referencedColumns: ['id'];
          },
        ];
      };
      categories: {
        Row: {
          id: string;
          store_id: string;
          name: string;
          sort_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          store_id: string;
          name: string;
          sort_order?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          store_id?: string;
          name?: string;
          sort_order?: number;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'categories_store_id_fkey';
            columns: ['store_id'];
            isOneToOne: false;
            referencedRelation: 'stores';
            referencedColumns: ['id'];
          },
        ];
      };
      products: {
        Row: {
          id: string;
          store_id: string;
          category_id: string | null;
          name: string;
          description: string | null;
          price: number;
          image_url: string | null;
          is_available: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          store_id: string;
          category_id?: string | null;
          name: string;
          description?: string | null;
          price: number;
          image_url?: string | null;
          is_available?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          store_id?: string;
          category_id?: string | null;
          name?: string;
          description?: string | null;
          price?: number;
          image_url?: string | null;
          is_available?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'fk_products_store_category';
            columns: ['store_id', 'category_id'];
            isOneToOne: false;
            referencedRelation: 'categories';
            referencedColumns: ['store_id', 'id'];
          },
          {
            foreignKeyName: 'products_store_id_fkey';
            columns: ['store_id'];
            isOneToOne: false;
            referencedRelation: 'stores';
            referencedColumns: ['id'];
          },
        ];
      };
      orders: {
        Row: {
          id: string;
          store_id: string;
          customer_name: string;
          customer_phone: string;
          delivery_type: Database['public']['Enums']['delivery_type'];
          address: string | null;
          payment_method: Database['public']['Enums']['payment_method'];
          items_json: Json;
          total: number;
          status: Database['public']['Enums']['order_status'];
          client_request_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          store_id: string;
          customer_name: string;
          customer_phone: string;
          delivery_type: Database['public']['Enums']['delivery_type'];
          address?: string | null;
          payment_method: Database['public']['Enums']['payment_method'];
          items_json: Json;
          total: number;
          status?: Database['public']['Enums']['order_status'];
          client_request_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          store_id?: string;
          customer_name?: string;
          customer_phone?: string;
          delivery_type?: Database['public']['Enums']['delivery_type'];
          address?: string | null;
          payment_method?: Database['public']['Enums']['payment_method'];
          items_json?: Json;
          total?: number;
          status?: Database['public']['Enums']['order_status'];
          client_request_id?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'orders_store_id_fkey';
            columns: ['store_id'];
            isOneToOne: false;
            referencedRelation: 'stores';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      is_store_member: {
        Args: {
          lookup_store_id: string;
        };
        Returns: boolean;
      };
      is_store_admin: {
        Args: {
          lookup_store_id: string;
        };
        Returns: boolean;
      };
      create_order_secure: {
        Args: {
          p_store_id: string;
          p_customer_name: string;
          p_customer_phone: string;
          p_delivery_type: Database['public']['Enums']['delivery_type'];
          p_address: string | null;
          p_payment_method: Database['public']['Enums']['payment_method'];
          p_items: Json;
          p_client_request_id?: string | null;
        };
        Returns: Json;
      };
      create_store: {
        Args: {
          p_slug: string;
          p_name: string;
          p_whatsapp: string;
          p_owner_user_id: string;
        };
        Returns: Json;
      };
    };
    Enums: {
      delivery_type: 'delivery' | 'pickup' | 'dine_in';
      payment_method: 'cash' | 'yape' | 'plin' | 'card';
      order_status: 'pending' | 'confirmed' | 'preparing' | 'delivered' | 'cancelled';
      store_role: 'owner' | 'admin' | 'staff';
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
}
