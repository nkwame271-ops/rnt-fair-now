
-- ============ WALLETS ============
CREATE TABLE public.wallets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  currency TEXT NOT NULL DEFAULT 'GHS',
  available_balance NUMERIC(14,2) NOT NULL DEFAULT 0,
  escrow_balance NUMERIC(14,2) NOT NULL DEFAULT 0,
  pending_balance NUMERIC(14,2) NOT NULL DEFAULT 0,
  reserved_balance NUMERIC(14,2) NOT NULL DEFAULT 0,
  total_received NUMERIC(14,2) NOT NULL DEFAULT 0,
  total_withdrawn NUMERIC(14,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.wallets TO authenticated;
GRANT ALL ON public.wallets TO service_role;
ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own wallet select" ON public.wallets FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  OR public.is_super_admin(auth.uid())
  OR public.has_role(auth.uid(), 'regulator'::app_role)
  OR EXISTS (SELECT 1 FROM public.agent_assignments a
    WHERE a.agent_user_id = auth.uid() AND a.owner_user_id = wallets.user_id AND a.active = true)
);
CREATE POLICY "own wallet update" ON public.wallets FOR UPDATE TO authenticated
USING (user_id = auth.uid() OR public.is_super_admin(auth.uid()))
WITH CHECK (user_id = auth.uid() OR public.is_super_admin(auth.uid()));

-- ============ WALLET ENTRIES (append-only ledger) ============
CREATE TABLE public.wallet_entries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  wallet_id UUID NOT NULL REFERENCES public.wallets(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('credit','debit')),
  amount NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  entry_type TEXT NOT NULL,
  bucket TEXT NOT NULL DEFAULT 'available' CHECK (bucket IN ('available','escrow','pending','reserved')),
  reference TEXT,
  related_table TEXT,
  related_id UUID,
  description TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_wallet_entries_wallet ON public.wallet_entries(wallet_id, created_at DESC);
CREATE INDEX idx_wallet_entries_user ON public.wallet_entries(user_id, created_at DESC);
CREATE INDEX idx_wallet_entries_reference ON public.wallet_entries(reference);
GRANT SELECT ON public.wallet_entries TO authenticated;
GRANT ALL ON public.wallet_entries TO service_role;
ALTER TABLE public.wallet_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own entries select" ON public.wallet_entries FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  OR public.is_super_admin(auth.uid())
  OR public.has_role(auth.uid(), 'regulator'::app_role)
  OR EXISTS (SELECT 1 FROM public.agent_assignments a
    WHERE a.agent_user_id = auth.uid() AND a.owner_user_id = wallet_entries.user_id AND a.active = true)
);

-- ============ WALLET HOLDS ============
CREATE TABLE public.wallet_holds (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  wallet_id UUID NOT NULL REFERENCES public.wallets(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  amount NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  hold_type TEXT NOT NULL CHECK (hold_type IN ('escrow','reserved','disputed','pending_withdrawal')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','released','captured','cancelled')),
  reference TEXT,
  reason TEXT,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.wallet_holds TO authenticated;
GRANT ALL ON public.wallet_holds TO service_role;
ALTER TABLE public.wallet_holds ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own holds select" ON public.wallet_holds FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  OR public.is_super_admin(auth.uid())
  OR public.has_role(auth.uid(), 'regulator'::app_role)
);

-- ============ PAYOUT ACCOUNTS ============
CREATE TABLE public.wallet_payout_accounts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_type TEXT NOT NULL CHECK (account_type IN ('mobile_money','bank')),
  provider_code TEXT NOT NULL,
  provider_name TEXT,
  account_number TEXT NOT NULL,
  account_name TEXT NOT NULL,
  paystack_recipient_code TEXT,
  is_verified BOOLEAN NOT NULL DEFAULT false,
  is_default BOOLEAN NOT NULL DEFAULT false,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_payout_accounts_user ON public.wallet_payout_accounts(user_id, active);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.wallet_payout_accounts TO authenticated;
GRANT ALL ON public.wallet_payout_accounts TO service_role;
ALTER TABLE public.wallet_payout_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own payout accounts" ON public.wallet_payout_accounts FOR ALL TO authenticated
USING (user_id = auth.uid() OR public.is_super_admin(auth.uid()))
WITH CHECK (user_id = auth.uid() OR public.is_super_admin(auth.uid()));

-- ============ WALLET SETTINGS ============
CREATE TABLE public.wallet_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  default_payout_account_id UUID REFERENCES public.wallet_payout_accounts(id) ON DELETE SET NULL,
  auto_withdraw_enabled BOOLEAN NOT NULL DEFAULT false,
  auto_withdraw_threshold NUMERIC(14,2),
  monthly_fee_opted_in BOOLEAN NOT NULL DEFAULT true,
  notifications_enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.wallet_settings TO authenticated;
GRANT ALL ON public.wallet_settings TO service_role;
ALTER TABLE public.wallet_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own wallet settings" ON public.wallet_settings FOR ALL TO authenticated
USING (user_id = auth.uid() OR public.is_super_admin(auth.uid()))
WITH CHECK (user_id = auth.uid() OR public.is_super_admin(auth.uid()));

-- ============ PAYMENT LINKS (QR + shareable) ============
CREATE TABLE public.wallet_payment_links (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT,
  amount NUMERIC(14,2),
  currency TEXT NOT NULL DEFAULT 'GHS',
  fixed_amount BOOLEAN NOT NULL DEFAULT true,
  active BOOLEAN NOT NULL DEFAULT true,
  expires_at TIMESTAMPTZ,
  total_collected NUMERIC(14,2) NOT NULL DEFAULT 0,
  payment_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_payment_links_user ON public.wallet_payment_links(user_id, active);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.wallet_payment_links TO authenticated;
GRANT SELECT ON public.wallet_payment_links TO anon;
GRANT ALL ON public.wallet_payment_links TO service_role;
ALTER TABLE public.wallet_payment_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own payment links manage" ON public.wallet_payment_links FOR ALL TO authenticated
USING (user_id = auth.uid() OR public.is_super_admin(auth.uid()))
WITH CHECK (user_id = auth.uid() OR public.is_super_admin(auth.uid()));
CREATE POLICY "public payment link view" ON public.wallet_payment_links FOR SELECT TO anon
USING (active = true);
CREATE POLICY "public payment link view auth" ON public.wallet_payment_links FOR SELECT TO authenticated
USING (active = true);

-- ============ TRIGGERS ============
CREATE TRIGGER trg_wallets_updated BEFORE UPDATE ON public.wallets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_wallet_holds_updated BEFORE UPDATE ON public.wallet_holds
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_wallet_payout_updated BEFORE UPDATE ON public.wallet_payout_accounts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_wallet_settings_updated BEFORE UPDATE ON public.wallet_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_payment_links_updated BEFORE UPDATE ON public.wallet_payment_links
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ HELPER: post wallet entry ============
CREATE OR REPLACE FUNCTION public.wallet_post_entry(
  _user_id UUID,
  _direction TEXT,
  _amount NUMERIC,
  _entry_type TEXT,
  _bucket TEXT DEFAULT 'available',
  _reference TEXT DEFAULT NULL,
  _related_table TEXT DEFAULT NULL,
  _related_id UUID DEFAULT NULL,
  _description TEXT DEFAULT NULL,
  _metadata JSONB DEFAULT '{}'::jsonb
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_wallet_id UUID;
  v_entry_id UUID;
  v_delta NUMERIC;
BEGIN
  INSERT INTO public.wallets(user_id) VALUES (_user_id)
    ON CONFLICT (user_id) DO NOTHING;
  SELECT id INTO v_wallet_id FROM public.wallets WHERE user_id = _user_id;

  INSERT INTO public.wallet_entries(
    wallet_id, user_id, direction, amount, entry_type, bucket,
    reference, related_table, related_id, description, metadata
  ) VALUES (
    v_wallet_id, _user_id, _direction, _amount, _entry_type, _bucket,
    _reference, _related_table, _related_id, _description, _metadata
  ) RETURNING id INTO v_entry_id;

  v_delta := CASE WHEN _direction = 'credit' THEN _amount ELSE -_amount END;

  UPDATE public.wallets SET
    available_balance = CASE WHEN _bucket = 'available' THEN available_balance + v_delta ELSE available_balance END,
    escrow_balance    = CASE WHEN _bucket = 'escrow'    THEN escrow_balance + v_delta    ELSE escrow_balance END,
    pending_balance   = CASE WHEN _bucket = 'pending'   THEN pending_balance + v_delta   ELSE pending_balance END,
    reserved_balance  = CASE WHEN _bucket = 'reserved'  THEN reserved_balance + v_delta  ELSE reserved_balance END,
    total_received    = total_received + CASE WHEN _direction = 'credit' THEN _amount ELSE 0 END,
    total_withdrawn   = total_withdrawn + CASE WHEN _direction = 'debit' AND _entry_type = 'withdrawal' THEN _amount ELSE 0 END,
    updated_at        = now()
  WHERE id = v_wallet_id;

  RETURN v_entry_id;
END;
$$;

-- ============ AUTO-PROVISION WALLET ON SIGNUP ============
CREATE OR REPLACE FUNCTION public.create_wallet_for_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.wallets(user_id) VALUES (NEW.id)
    ON CONFLICT (user_id) DO NOTHING;
  INSERT INTO public.wallet_settings(user_id) VALUES (NEW.id)
    ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_create_wallet_on_signup ON auth.users;
CREATE TRIGGER trg_create_wallet_on_signup
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.create_wallet_for_new_user();

-- Backfill wallets for existing users
INSERT INTO public.wallets(user_id) SELECT id FROM auth.users ON CONFLICT (user_id) DO NOTHING;
INSERT INTO public.wallet_settings(user_id) SELECT id FROM auth.users ON CONFLICT (user_id) DO NOTHING;
