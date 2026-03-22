export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      garments: {
        Row: {
          ai_tags: Json
          brand: string | null
          category: Database["public"]["Enums"]["garment_category"] | null
          color: string | null
          created_at: string
          id: string
          image_url: string
          last_worn_at: string | null
          laundry_status: Database["public"]["Enums"]["laundry_status"]
          material: string | null
          name: string | null
          price: number | null
          source_url: string | null
          updated_at: string
          user_id: string
          vibes: Database["public"]["Enums"]["garment_vibe"][] | null
          wear_count: number
        }
        Insert: {
          ai_tags?: Json
          brand?: string | null
          category?: Database["public"]["Enums"]["garment_category"] | null
          color?: string | null
          created_at?: string
          id?: string
          image_url: string
          last_worn_at?: string | null
          laundry_status?: Database["public"]["Enums"]["laundry_status"]
          material?: string | null
          name?: string | null
          price?: number | null
          source_url?: string | null
          updated_at?: string
          user_id: string
          vibes?: Database["public"]["Enums"]["garment_vibe"][] | null
          wear_count?: number
        }
        Update: {
          ai_tags?: Json
          brand?: string | null
          category?: Database["public"]["Enums"]["garment_category"] | null
          color?: string | null
          created_at?: string
          id?: string
          image_url?: string
          last_worn_at?: string | null
          laundry_status?: Database["public"]["Enums"]["laundry_status"]
          material?: string | null
          name?: string | null
          price?: number | null
          source_url?: string | null
          updated_at?: string
          user_id?: string
          vibes?: Database["public"]["Enums"]["garment_vibe"][] | null
          wear_count?: number
        }
        Relationships: []
      }
      outfit_items: {
        Row: {
          created_at: string
          garment_id: string
          id: string
          layer_order: number
          outfit_id: string
        }
        Insert: {
          created_at?: string
          garment_id: string
          id?: string
          layer_order?: number
          outfit_id: string
        }
        Update: {
          created_at?: string
          garment_id?: string
          id?: string
          layer_order?: number
          outfit_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "outfit_items_garment_id_fkey"
            columns: ["garment_id"]
            isOneToOne: false
            referencedRelation: "garments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outfit_items_outfit_id_fkey"
            columns: ["outfit_id"]
            isOneToOne: false
            referencedRelation: "outfits"
            referencedColumns: ["id"]
          },
        ]
      }
      outfits: {
        Row: {
          created_at: string
          formal_level: number | null
          id: string
          look_image_url: string | null
          name: string | null
          notes: string | null
          updated_at: string
          user_id: string
          weather_suitable: string | null
        }
        Insert: {
          created_at?: string
          formal_level?: number | null
          id?: string
          look_image_url?: string | null
          name?: string | null
          notes?: string | null
          updated_at?: string
          user_id: string
          weather_suitable?: string | null
        }
        Update: {
          created_at?: string
          formal_level?: number | null
          id?: string
          look_image_url?: string | null
          name?: string | null
          notes?: string | null
          updated_at?: string
          user_id?: string
          weather_suitable?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          body_photo_url: string | null
          created_at: string
          display_name: string | null
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          body_photo_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          body_photo_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      garment_category:
        | "tops"
        | "bottoms"
        | "outerwear"
        | "dresses"
        | "shoes"
        | "accessories"
        | "bags"
        | "activewear"
      garment_vibe:
        | "corporate"
        | "casual"
        | "streetwear"
        | "brunch"
        | "evening"
        | "athletic"
        | "lazy_sunday"
        | "date_night"
      laundry_status: "clean" | "dirty" | "at_cleaners"
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
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
      garment_category: [
        "tops",
        "bottoms",
        "outerwear",
        "dresses",
        "shoes",
        "accessories",
        "bags",
        "activewear",
      ],
      garment_vibe: [
        "corporate",
        "casual",
        "streetwear",
        "brunch",
        "evening",
        "athletic",
        "lazy_sunday",
        "date_night",
      ],
      laundry_status: ["clean", "dirty", "at_cleaners"],
    },
  },
} as const
