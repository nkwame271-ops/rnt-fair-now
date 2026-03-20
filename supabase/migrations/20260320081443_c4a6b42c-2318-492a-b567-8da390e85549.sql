
-- 1. Admin Audit Log table
CREATE TABLE public.admin_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id uuid NOT NULL,
  action text NOT NULL,
  target_type text NOT NULL,
  target_id text NOT NULL,
  reason text NOT NULL,
  old_state jsonb DEFAULT '{}',
  new_state jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Regulators can read audit log"
ON public.admin_audit_log FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'regulator'::app_role));

CREATE POLICY "Service role manages audit log"
ON public.admin_audit_log FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- 2. Alter rent_card_serial_stock — add revocation columns
ALTER TABLE public.rent_card_serial_stock
  ADD COLUMN revoked_at timestamptz,
  ADD COLUMN revoked_by uuid,
  ADD COLUMN revoke_reason text;

-- 3. Alter rent_cards — add card_role
ALTER TABLE public.rent_cards
  ADD COLUMN card_role text;

-- 4. Alter tenancies — add rent_card_id_2
ALTER TABLE public.tenancies
  ADD COLUMN rent_card_id_2 uuid REFERENCES public.rent_cards(id);

-- 5. Alter landlords — add account_status
ALTER TABLE public.landlords
  ADD COLUMN account_status text NOT NULL DEFAULT 'active';

-- 6. Alter tenants — add account_status
ALTER TABLE public.tenants
  ADD COLUMN account_status text NOT NULL DEFAULT 'active';
