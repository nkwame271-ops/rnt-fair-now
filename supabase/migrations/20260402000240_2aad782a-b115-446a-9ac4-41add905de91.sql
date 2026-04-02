
CREATE TABLE public.payment_processing_errors (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  escrow_transaction_id UUID,
  reference TEXT,
  function_name TEXT NOT NULL,
  error_stage TEXT NOT NULL,
  error_message TEXT NOT NULL,
  error_context JSONB DEFAULT '{}'::jsonb,
  severity TEXT NOT NULL DEFAULT 'warning',
  resolved BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.payment_processing_errors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role manages payment errors"
  ON public.payment_processing_errors
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Regulators read payment errors"
  ON public.payment_processing_errors
  FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'regulator'::app_role));

CREATE POLICY "Regulators update payment errors"
  ON public.payment_processing_errors
  FOR UPDATE
  TO authenticated
  USING (has_role(auth.uid(), 'regulator'::app_role));

CREATE INDEX idx_payment_errors_severity ON public.payment_processing_errors (severity);
CREATE INDEX idx_payment_errors_resolved ON public.payment_processing_errors (resolved);
CREATE INDEX idx_payment_errors_created ON public.payment_processing_errors (created_at DESC);
