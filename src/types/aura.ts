// Local types matching our database schema
export type GarmentVibe = 'corporate' | 'casual' | 'streetwear' | 'brunch' | 'evening' | 'athletic' | 'lazy_sunday' | 'date_night';
export type GarmentCategory = 'tops' | 'bottoms' | 'outerwear' | 'dresses' | 'shoes' | 'accessories' | 'bags' | 'activewear';
export type LaundryStatus = 'clean' | 'dirty' | 'at_cleaners';

export interface Garment {
  id: string;
  user_id: string;
  image_url: string;
  name: string | null;
  brand: string | null;
  category: GarmentCategory | null;
  color: string | null;
  material: string | null;
  vibes: GarmentVibe[];
  price: number | null;
  wear_count: number;
  laundry_status: LaundryStatus;
  last_worn_at: string | null;
  source_url: string | null;
  ai_tags: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface Profile {
  id: string;
  user_id: string;
  display_name: string | null;
  body_photo_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface Outfit {
  id: string;
  user_id: string;
  name: string | null;
  look_image_url: string | null;
  weather_suitable: string | null;
  formal_level: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}
