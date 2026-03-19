
-- Step 1: Add database indexes for stress-test readiness
CREATE INDEX IF NOT EXISTS idx_tenancies_tenant_user_id ON public.tenancies(tenant_user_id);
CREATE INDEX IF NOT EXISTS idx_tenancies_landlord_user_id ON public.tenancies(landlord_user_id);
CREATE INDEX IF NOT EXISTS idx_tenancies_status ON public.tenancies(status);
CREATE INDEX IF NOT EXISTS idx_complaints_tenant_user_id ON public.complaints(tenant_user_id);
CREATE INDEX IF NOT EXISTS idx_complaints_status ON public.complaints(status);
CREATE INDEX IF NOT EXISTS idx_rent_payments_tenancy_id ON public.rent_payments(tenancy_id);
CREATE INDEX IF NOT EXISTS idx_rent_payments_status ON public.rent_payments(status);
CREATE INDEX IF NOT EXISTS idx_units_property_id ON public.units(property_id);
CREATE INDEX IF NOT EXISTS idx_units_status ON public.units(status);
CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON public.profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_messages_sender ON public.marketplace_messages(sender_user_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_messages_receiver ON public.marketplace_messages(receiver_user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON public.user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_properties_landlord_user_id ON public.properties(landlord_user_id);
CREATE INDEX IF NOT EXISTS idx_viewing_requests_tenant ON public.viewing_requests(tenant_user_id);
CREATE INDEX IF NOT EXISTS idx_viewing_requests_landlord ON public.viewing_requests(landlord_user_id);
CREATE INDEX IF NOT EXISTS idx_termination_apps_tenancy ON public.termination_applications(tenancy_id);
CREATE INDEX IF NOT EXISTS idx_side_payments_tenancy ON public.side_payment_declarations(tenancy_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_rent_cards_landlord ON public.rent_cards(landlord_user_id);
CREATE INDEX IF NOT EXISTS idx_rent_cards_tenant ON public.rent_cards(tenant_user_id);
CREATE INDEX IF NOT EXISTS idx_escrow_transactions_user ON public.escrow_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_receipts_user ON public.payment_receipts(user_id);
CREATE INDEX IF NOT EXISTS idx_kyc_verifications_user ON public.kyc_verifications(user_id);
