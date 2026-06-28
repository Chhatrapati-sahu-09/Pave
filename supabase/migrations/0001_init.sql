-- Enable PostGIS extension
CREATE EXTENSION IF NOT EXISTS postgis;

-- 1. PROFILES Table
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  display_name text NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Enable RLS on profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 2. REPORTS Table
CREATE TABLE IF NOT EXISTS public.reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  location geography(Point, 4326) NOT NULL,
  issue_type text NOT NULL CHECK (issue_type IN ('no_curb_cut', 'broken_pavement', 'steps_no_ramp', 'blocked_path', 'steep_grade', 'other')),
  severity smallint NOT NULL CHECK (severity >= 1 AND severity <= 3),
  description text,
  photo_url text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'resolved', 'disputed')),
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Enable RLS on reports
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

-- Create PostGIS spatial index on reports.location
CREATE INDEX IF NOT EXISTS reports_location_gix ON public.reports USING gist (location);

-- 3. CONFIRMATIONS Table
CREATE TABLE IF NOT EXISTS public.confirmations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid NOT NULL REFERENCES public.reports(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  vote text NOT NULL CHECK (vote IN ('confirm', 'dispute')),
  created_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT unique_report_user_vote UNIQUE (report_id, user_id)
);

-- Enable RLS on confirmations
ALTER TABLE public.confirmations ENABLE ROW LEVEL SECURITY;

-- 4. RLS POLICIES

-- Profiles policies
CREATE POLICY "Profiles are viewable by everyone" 
  ON public.profiles FOR SELECT USING (true);

CREATE POLICY "Users can insert their own profile" 
  ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update their own profile" 
  ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- Reports policies
CREATE POLICY "Reports are viewable by everyone" 
  ON public.reports FOR SELECT USING (true);

CREATE POLICY "Authenticated users can insert reports" 
  ON public.reports FOR INSERT WITH CHECK (auth.role() = 'authenticated' AND auth.uid() = reporter_id);

CREATE POLICY "Users can update their own reports" 
  ON public.reports FOR UPDATE USING (auth.uid() = reporter_id);

CREATE POLICY "Users can delete their own reports" 
  ON public.reports FOR DELETE USING (auth.uid() = reporter_id);

-- Confirmations policies
CREATE POLICY "Confirmations are viewable by everyone" 
  ON public.confirmations FOR SELECT USING (true);

CREATE POLICY "Authenticated users can insert confirmations" 
  ON public.confirmations FOR INSERT WITH CHECK (auth.role() = 'authenticated' AND auth.uid() = user_id);

CREATE POLICY "Users can update their own confirmations" 
  ON public.confirmations FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own confirmations" 
  ON public.confirmations FOR DELETE USING (auth.uid() = user_id);


-- 5. TRIGGER FOR AUTO-DISPUTE STATUS
CREATE OR REPLACE FUNCTION check_report_dispute_status()
RETURNS TRIGGER AS $$
DECLARE
  v_confirms bigint;
  v_disputes bigint;
  v_report_id uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_report_id := OLD.report_id;
  ELSE
    v_report_id := NEW.report_id;
  END IF;

  -- Count confirmations and disputes for this report
  SELECT 
    COALESCE(COUNT(CASE WHEN vote = 'confirm' THEN 1 END), 0),
    COALESCE(COUNT(CASE WHEN vote = 'dispute' THEN 1 END), 0)
  INTO v_confirms, v_disputes
  FROM public.confirmations
  WHERE report_id = v_report_id;

  -- Auto-update status to 'disputed' if disputes >= 3 and confirms <= 1 (few/no confirms)
  IF v_disputes >= 3 AND v_confirms <= 1 THEN
    UPDATE public.reports
    SET status = 'disputed'
    WHERE id = v_report_id AND status = 'active';
  ELSE
    -- Revert back to active if dispute conditions are no longer met
    UPDATE public.reports
    SET status = 'active'
    WHERE id = v_report_id AND status = 'disputed';
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_check_report_dispute_status
AFTER INSERT OR UPDATE OR DELETE ON public.confirmations
FOR EACH ROW
EXECUTE FUNCTION check_report_dispute_status();


-- 6. VIEWPORT FETCH FUNCTION WITH FILTERS
CREATE OR REPLACE FUNCTION public.reports_in_viewport(
  min_lng double precision,
  min_lat double precision,
  max_lng double precision,
  max_lat double precision,
  filter_issue_types text[] DEFAULT NULL,
  filter_min_severity smallint DEFAULT 1
)
RETURNS TABLE (
  id uuid,
  reporter_id uuid,
  reporter_name text,
  location_lng double precision,
  location_lat double precision,
  issue_type text,
  severity smallint,
  description text,
  photo_url text,
  status text,
  created_at timestamptz,
  confirm_count bigint,
  dispute_count bigint
) SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT
    r.id,
    r.reporter_id,
    p.display_name as reporter_name,
    ST_X(r.location::geometry) as location_lng,
    ST_Y(r.location::geometry) as location_lat,
    r.issue_type,
    r.severity,
    r.description,
    r.photo_url,
    r.status,
    r.created_at,
    COALESCE(COUNT(CASE WHEN c.vote = 'confirm' THEN 1 END), 0) as confirm_count,
    COALESCE(COUNT(CASE WHEN c.vote = 'dispute' THEN 1 END), 0) as dispute_count
  FROM public.reports r
  LEFT JOIN public.profiles p ON r.reporter_id = p.id
  LEFT JOIN public.confirmations c ON r.id = c.report_id
  WHERE 
    r.status IN ('active', 'disputed')
    AND r.location && ST_MakeEnvelope(min_lng, min_lat, max_lng, max_lat, 4326)::geography
    AND (filter_issue_types IS NULL OR r.issue_type = ANY(filter_issue_types))
    AND r.severity >= filter_min_severity
  GROUP BY r.id, p.display_name;
END;
$$ LANGUAGE plpgsql;
