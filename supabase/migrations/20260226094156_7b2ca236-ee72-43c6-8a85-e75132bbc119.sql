
-- Beta feedback table
CREATE TABLE public.beta_feedback (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  page_url TEXT,
  category TEXT NOT NULL DEFAULT 'bug',
  message TEXT NOT NULL,
  rating INTEGER,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.beta_feedback ENABLE ROW LEVEL SECURITY;

-- Any authenticated user can submit feedback
CREATE POLICY "Authenticated users can insert feedback"
ON public.beta_feedback FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can see their own feedback
CREATE POLICY "Users can read own feedback"
ON public.beta_feedback FOR SELECT
USING (auth.uid() = user_id);

-- Regulators can read all feedback
CREATE POLICY "Regulators can read all feedback"
ON public.beta_feedback FOR SELECT
USING (has_role(auth.uid(), 'regulator'::app_role));
