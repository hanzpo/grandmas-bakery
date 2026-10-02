export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      customers: {
        Row: {
          created_at: string
          email: string | null
          id: string
          is_b2b: boolean
          loyalty_points: number
          marketing_opt_in: boolean
          name: string
          notes: string | null
          organization: string | null
          phone: string | null
          preferred_language: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          is_b2b?: boolean
          loyalty_points?: number
          marketing_opt_in?: boolean
          name: string
          notes?: string | null
          organization?: string | null
          phone?: string | null
          preferred_language?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          is_b2b?: boolean
          loyalty_points?: number
          marketing_opt_in?: boolean
          name?: string
          notes?: string | null
          organization?: string | null
          phone?: string | null
          preferred_language?: string
        }
        Relationships: []
      }
      expenses: {
        Row: {
          amount_cents: number
          category: string
          created_at: string
          description: string | null
          id: string
          incurred_on: string
          is_recurring: boolean
          paid: boolean
          paid_on: string | null
          recurrence: string | null
          supplier_id: string | null
        }
        Insert: {
          amount_cents: number
          category: string
          created_at?: string
          description?: string | null
          id?: string
          incurred_on?: string
          is_recurring?: boolean
          paid?: boolean
          paid_on?: string | null
          recurrence?: string | null
          supplier_id?: string | null
        }
        Update: {
          amount_cents?: number
          category?: string
          created_at?: string
          description?: string | null
          id?: string
          incurred_on?: string
          is_recurring?: boolean
          paid?: boolean
          paid_on?: string | null
          recurrence?: string | null
          supplier_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "expenses_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      ingredients: {
        Row: {
          allergens: string[]
          cost_per_unit_cents: number
          created_at: string
          id: string
          name: string
          preferred_supplier_id: string | null
          quantity_on_hand: number
          reorder_threshold: number
          unit: Database["public"]["Enums"]["ingredient_unit"]
        }
        Insert: {
          allergens?: string[]
          cost_per_unit_cents?: number
          created_at?: string
          id?: string
          name: string
          preferred_supplier_id?: string | null
          quantity_on_hand?: number
          reorder_threshold?: number
          unit: Database["public"]["Enums"]["ingredient_unit"]
        }
        Update: {
          allergens?: string[]
          cost_per_unit_cents?: number
          created_at?: string
          id?: string
          name?: string
          preferred_supplier_id?: string | null
          quantity_on_hand?: number
          reorder_threshold?: number
          unit?: Database["public"]["Enums"]["ingredient_unit"]
        }
        Relationships: [
          {
            foreignKeyName: "ingredients_preferred_supplier_id_fkey"
            columns: ["preferred_supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_transactions: {
        Row: {
          created_by: string | null
          expires_on: string | null
          id: string
          ingredient_id: string
          lot_closed_at: string | null
          notes: string | null
          occurred_at: string
          order_id: string | null
          paid: boolean
          quantity: number
          supplier_id: string | null
          supplier_order_id: string | null
          type: Database["public"]["Enums"]["inventory_txn_type"]
          unit_cost_cents: number | null
        }
        Insert: {
          created_by?: string | null
          expires_on?: string | null
          id?: string
          ingredient_id: string
          lot_closed_at?: string | null
          notes?: string | null
          occurred_at?: string
          order_id?: string | null
          paid?: boolean
          quantity: number
          supplier_id?: string | null
          supplier_order_id?: string | null
          type: Database["public"]["Enums"]["inventory_txn_type"]
          unit_cost_cents?: number | null
        }
        Update: {
          created_by?: string | null
          expires_on?: string | null
          id?: string
          ingredient_id?: string
          lot_closed_at?: string | null
          notes?: string | null
          occurred_at?: string
          order_id?: string | null
          paid?: boolean
          quantity?: number
          supplier_id?: string | null
          supplier_order_id?: string | null
          type?: Database["public"]["Enums"]["inventory_txn_type"]
          unit_cost_cents?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_transactions_ingredient_id_fkey"
            columns: ["ingredient_id"]
            isOneToOne: false
            referencedRelation: "ingredients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_transactions_ingredient_id_fkey"
            columns: ["ingredient_id"]
            isOneToOne: false
            referencedRelation: "low_stock_ingredients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_transactions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_transactions_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_transactions_supplier_order_id_fkey"
            columns: ["supplier_order_id"]
            isOneToOne: false
            referencedRelation: "supplier_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          id: string
          notes: string | null
          order_id: string
          product_id: string
          quantity: number
          unit_price_cents: number
        }
        Insert: {
          id?: string
          notes?: string | null
          order_id: string
          product_id: string
          quantity: number
          unit_price_cents: number
        }
        Update: {
          id?: string
          notes?: string | null
          order_id?: string
          product_id?: string
          quantity?: number
          unit_price_cents?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_costs"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_sales"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          created_at: string
          customer_id: string | null
          id: string
          notes: string | null
          order_number: number
          pickup_at: string | null
          queue_rank: number | null
          source: Database["public"]["Enums"]["order_source"]
          status: Database["public"]["Enums"]["order_status"]
          status_changed_at: string
          stripe_checkout_session_id: string | null
          subtotal_cents: number
          tax_cents: number
          total_cents: number
          voice_call_id: string | null
        }
        Insert: {
          created_at?: string
          customer_id?: string | null
          id?: string
          notes?: string | null
          order_number?: never
          pickup_at?: string | null
          queue_rank?: number | null
          source: Database["public"]["Enums"]["order_source"]
          status?: Database["public"]["Enums"]["order_status"]
          status_changed_at?: string
          stripe_checkout_session_id?: string | null
          subtotal_cents?: number
          tax_cents?: number
          total_cents?: number
          voice_call_id?: string | null
        }
        Update: {
          created_at?: string
          customer_id?: string | null
          id?: string
          notes?: string | null
          order_number?: never
          pickup_at?: string | null
          queue_rank?: number | null
          source?: Database["public"]["Enums"]["order_source"]
          status?: Database["public"]["Enums"]["order_status"]
          status_changed_at?: string
          stripe_checkout_session_id?: string | null
          subtotal_cents?: number
          tax_cents?: number
          total_cents?: number
          voice_call_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount_cents: number
          external_ref: string | null
          id: string
          method: Database["public"]["Enums"]["payment_method"]
          notes: string | null
          order_id: string | null
          received_at: string
        }
        Insert: {
          amount_cents: number
          external_ref?: string | null
          id?: string
          method: Database["public"]["Enums"]["payment_method"]
          notes?: string | null
          order_id?: string | null
          received_at?: string
        }
        Update: {
          amount_cents?: number
          external_ref?: string | null
          id?: string
          method?: Database["public"]["Enums"]["payment_method"]
          notes?: string | null
          order_id?: string | null
          received_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          category: string
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          is_active: boolean
          is_flavor_of_month: boolean
          name: string
          price_cents: number
          slug: string
          sort_order: number
          translations: Json
        }
        Insert: {
          category?: string
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          is_flavor_of_month?: boolean
          name: string
          price_cents: number
          slug: string
          sort_order?: number
          translations?: Json
        }
        Update: {
          category?: string
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          is_flavor_of_month?: boolean
          name?: string
          price_cents?: number
          slug?: string
          sort_order?: number
          translations?: Json
        }
        Relationships: []
      }
      recipe_items: {
        Row: {
          ingredient_id: string
          product_id: string
          quantity: number
        }
        Insert: {
          ingredient_id: string
          product_id: string
          quantity: number
        }
        Update: {
          ingredient_id?: string
          product_id?: string
          quantity?: number
        }
        Relationships: [
          {
            foreignKeyName: "recipe_items_ingredient_id_fkey"
            columns: ["ingredient_id"]
            isOneToOne: false
            referencedRelation: "ingredients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recipe_items_ingredient_id_fkey"
            columns: ["ingredient_id"]
            isOneToOne: false
            referencedRelation: "low_stock_ingredients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recipe_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_costs"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "recipe_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_sales"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "recipe_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      staff: {
        Row: {
          created_at: string
          display_name: string
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string
          display_name: string
          role?: string
          user_id: string
        }
        Update: {
          created_at?: string
          display_name?: string
          role?: string
          user_id?: string
        }
        Relationships: []
      }
      supplier_order_items: {
        Row: {
          id: string
          ingredient_id: string
          order_id: string
          quantity: number
          quantity_received: number | null
          unit_cost_cents: number
        }
        Insert: {
          id?: string
          ingredient_id: string
          order_id: string
          quantity: number
          quantity_received?: number | null
          unit_cost_cents: number
        }
        Update: {
          id?: string
          ingredient_id?: string
          order_id?: string
          quantity?: number
          quantity_received?: number | null
          unit_cost_cents?: number
        }
        Relationships: [
          {
            foreignKeyName: "supplier_order_items_ingredient_id_fkey"
            columns: ["ingredient_id"]
            isOneToOne: false
            referencedRelation: "ingredients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_order_items_ingredient_id_fkey"
            columns: ["ingredient_id"]
            isOneToOne: false
            referencedRelation: "low_stock_ingredients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "supplier_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_orders: {
        Row: {
          arrived_on: string | null
          created_at: string
          created_by: string | null
          expected_on: string | null
          id: string
          notes: string | null
          ordered_on: string
          paid_on: string | null
          status: Database["public"]["Enums"]["supplier_order_status"]
          supplier_id: string
        }
        Insert: {
          arrived_on?: string | null
          created_at?: string
          created_by?: string | null
          expected_on?: string | null
          id?: string
          notes?: string | null
          ordered_on?: string
          paid_on?: string | null
          status?: Database["public"]["Enums"]["supplier_order_status"]
          supplier_id: string
        }
        Update: {
          arrived_on?: string | null
          created_at?: string
          created_by?: string | null
          expected_on?: string | null
          id?: string
          notes?: string | null
          ordered_on?: string
          paid_on?: string | null
          status?: Database["public"]["Enums"]["supplier_order_status"]
          supplier_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_orders_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_prices: {
        Row: {
          created_at: string
          effective_on: string
          id: string
          ingredient_id: string
          notes: string | null
          price_cents: number
          supplier_id: string
        }
        Insert: {
          created_at?: string
          effective_on?: string
          id?: string
          ingredient_id: string
          notes?: string | null
          price_cents: number
          supplier_id: string
        }
        Update: {
          created_at?: string
          effective_on?: string
          id?: string
          ingredient_id?: string
          notes?: string | null
          price_cents?: number
          supplier_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_prices_ingredient_id_fkey"
            columns: ["ingredient_id"]
            isOneToOne: false
            referencedRelation: "ingredients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_prices_ingredient_id_fkey"
            columns: ["ingredient_id"]
            isOneToOne: false
            referencedRelation: "low_stock_ingredients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_prices_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          contact_name: string | null
          created_at: string
          delivery_days: string[]
          email: string | null
          id: string
          is_local: boolean
          lead_time_days: number | null
          name: string
          notes: string | null
          phone: string | null
          website: string | null
        }
        Insert: {
          contact_name?: string | null
          created_at?: string
          delivery_days?: string[]
          email?: string | null
          id?: string
          is_local?: boolean
          lead_time_days?: number | null
          name: string
          notes?: string | null
          phone?: string | null
          website?: string | null
        }
        Update: {
          contact_name?: string | null
          created_at?: string
          delivery_days?: string[]
          email?: string | null
          id?: string
          is_local?: boolean
          lead_time_days?: number | null
          name?: string
          notes?: string | null
          phone?: string | null
          website?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      bills_due: {
        Row: {
          amount_cents: number | null
          description: string | null
          due_on: string | null
          id: string | null
          is_recurring: boolean | null
          kind: string | null
          payee: string | null
        }
        Relationships: []
      }
      customer_stats: {
        Row: {
          email: string | null
          id: string | null
          is_b2b: boolean | null
          last_order_at: string | null
          lifetime_cents: number | null
          loyalty_points: number | null
          name: string | null
          order_count: number | null
          organization: string | null
          phone: string | null
        }
        Relationships: []
      }
      daily_sales: {
        Row: {
          day: string | null
          orders: number | null
          revenue_cents: number | null
          source: Database["public"]["Enums"]["order_source"] | null
        }
        Relationships: []
      }
      expiring_lots: {
        Row: {
          expires_on: string | null
          id: string | null
          ingredient_id: string | null
          name: string | null
          quantity: number | null
          unit: Database["public"]["Enums"]["ingredient_unit"] | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_transactions_ingredient_id_fkey"
            columns: ["ingredient_id"]
            isOneToOne: false
            referencedRelation: "ingredients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_transactions_ingredient_id_fkey"
            columns: ["ingredient_id"]
            isOneToOne: false
            referencedRelation: "low_stock_ingredients"
            referencedColumns: ["id"]
          },
        ]
      }
      low_stock_ingredients: {
        Row: {
          allergens: string[] | null
          cost_per_unit_cents: number | null
          created_at: string | null
          id: string | null
          name: string | null
          preferred_supplier_id: string | null
          quantity_on_hand: number | null
          reorder_threshold: number | null
          unit: Database["public"]["Enums"]["ingredient_unit"] | null
        }
        Insert: {
          allergens?: string[] | null
          cost_per_unit_cents?: number | null
          created_at?: string | null
          id?: string | null
          name?: string | null
          preferred_supplier_id?: string | null
          quantity_on_hand?: number | null
          reorder_threshold?: number | null
          unit?: Database["public"]["Enums"]["ingredient_unit"] | null
        }
        Update: {
          allergens?: string[] | null
          cost_per_unit_cents?: number | null
          created_at?: string | null
          id?: string | null
          name?: string | null
          preferred_supplier_id?: string | null
          quantity_on_hand?: number | null
          reorder_threshold?: number | null
          unit?: Database["public"]["Enums"]["ingredient_unit"] | null
        }
        Relationships: [
          {
            foreignKeyName: "ingredients_preferred_supplier_id_fkey"
            columns: ["preferred_supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      product_costs: {
        Row: {
          ingredient_cost_cents: number | null
          margin_pct: number | null
          name: string | null
          price_cents: number | null
          product_id: string | null
        }
        Relationships: []
      }
      product_sales: {
        Row: {
          name: string | null
          product_id: string | null
          revenue_cents: number | null
          units: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      get_menu: {
        Args: never
        Returns: {
          allergens: string[]
          category: string
          description: string
          id: string
          image_url: string
          is_flavor_of_month: boolean
          name: string
          price_cents: number
          slug: string
          translations: Json
        }[]
      }
      is_staff: { Args: never; Returns: boolean }
      receive_supplier_order: {
        Args: { p_lines: Json; p_order_id: string }
        Returns: undefined
      }
    }
    Enums: {
      ingredient_unit: "g" | "kg" | "ml" | "l" | "each" | "dozen" | "lb" | "oz"
      inventory_txn_type: "purchase" | "usage" | "spoilage" | "adjustment"
      order_source: "online" | "walk_in" | "phone" | "voice_agent" | "b2b"
      order_status:
        | "pending_payment"
        | "new"
        | "in_progress"
        | "ready"
        | "completed"
        | "cancelled"
      payment_method: "stripe" | "card_terminal" | "cash" | "invoice"
      supplier_order_status: "ordered" | "arrived" | "cancelled"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      ingredient_unit: ["g", "kg", "ml", "l", "each", "dozen", "lb", "oz"],
      inventory_txn_type: ["purchase", "usage", "spoilage", "adjustment"],
      order_source: ["online", "walk_in", "phone", "voice_agent", "b2b"],
      order_status: [
        "pending_payment",
        "new",
        "in_progress",
        "ready",
        "completed",
        "cancelled",
      ],
      payment_method: ["stripe", "card_terminal", "cash", "invoice"],
      supplier_order_status: ["ordered", "arrived", "cancelled"],
    },
  },
} as const

