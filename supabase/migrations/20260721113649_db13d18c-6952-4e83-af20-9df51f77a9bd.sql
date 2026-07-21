
-- Sequential CAR case numbering per year: CAR 001/YYYY, resets each year
CREATE TABLE IF NOT EXISTS public.car_case_counters (
  year INT PRIMARY KEY,
  last_seq INT NOT NULL DEFAULT 0
);
GRANT SELECT ON public.car_case_counters TO authenticated;
GRANT ALL ON public.car_case_counters TO service_role;
ALTER TABLE public.car_case_counters ENABLE ROW LEVEL SECURITY;
CREATE POLICY "counters readable to authenticated" ON public.car_case_counters FOR SELECT TO authenticated USING (true);

CREATE OR REPLACE FUNCTION public.issue_car_case_number()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  y INT := EXTRACT(YEAR FROM now())::INT;
  n INT;
BEGIN
  INSERT INTO public.car_case_counters (year, last_seq) VALUES (y, 1)
  ON CONFLICT (year) DO UPDATE SET last_seq = public.car_case_counters.last_seq + 1
  RETURNING last_seq INTO n;
  RETURN 'CAR ' || lpad(n::text, 3, '0') || '/' || y::text;
END;
$$;

CREATE OR REPLACE FUNCTION public.generate_case_number()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN public.issue_car_case_number();
END;
$$;
