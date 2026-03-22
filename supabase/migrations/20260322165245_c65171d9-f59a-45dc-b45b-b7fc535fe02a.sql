
CREATE TYPE public.garment_vibe AS ENUM ('corporate', 'casual', 'streetwear', 'brunch', 'evening', 'athletic', 'lazy_sunday', 'date_night');
CREATE TYPE public.garment_category AS ENUM ('tops', 'bottoms', 'outerwear', 'dresses', 'shoes', 'accessories', 'bags', 'activewear');
CREATE TYPE public.laundry_status AS ENUM ('clean', 'dirty', 'at_cleaners');

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  display_name text,
  body_photo_url text,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (user_id) VALUES (NEW.id);
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE TABLE public.garments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  image_url text NOT NULL,
  name text,
  brand text,
  category public.garment_category,
  color text,
  material text,
  vibes public.garment_vibe[] DEFAULT '{}',
  price numeric,
  wear_count integer DEFAULT 0 NOT NULL,
  laundry_status public.laundry_status DEFAULT 'clean' NOT NULL,
  last_worn_at timestamptz,
  source_url text,
  ai_tags jsonb DEFAULT '{}' NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);
ALTER TABLE public.garments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own garments" ON public.garments FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own garments" ON public.garments FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own garments" ON public.garments FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own garments" ON public.garments FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TABLE public.outfits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name text,
  look_image_url text,
  weather_suitable text,
  formal_level integer,
  notes text,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);
ALTER TABLE public.outfits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own outfits" ON public.outfits FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own outfits" ON public.outfits FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own outfits" ON public.outfits FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own outfits" ON public.outfits FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TABLE public.outfit_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  outfit_id uuid REFERENCES public.outfits(id) ON DELETE CASCADE NOT NULL,
  garment_id uuid REFERENCES public.garments(id) ON DELETE CASCADE NOT NULL,
  layer_order integer DEFAULT 0 NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);
ALTER TABLE public.outfit_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own outfit items" ON public.outfit_items FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.outfits WHERE outfits.id = outfit_items.outfit_id AND outfits.user_id = auth.uid()));
CREATE POLICY "Users can insert own outfit items" ON public.outfit_items FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.outfits WHERE outfits.id = outfit_items.outfit_id AND outfits.user_id = auth.uid()));
CREATE POLICY "Users can delete own outfit items" ON public.outfit_items FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.outfits WHERE outfits.id = outfit_items.outfit_id AND outfits.user_id = auth.uid()));
