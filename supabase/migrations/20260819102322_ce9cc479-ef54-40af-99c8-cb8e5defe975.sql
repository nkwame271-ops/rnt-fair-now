REVOKE ALL ON FUNCTION public.post_receipt_to_cashbook() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.confirm_complaint_receipt(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.payment_reconciliation_summary(text, timestamptz, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.post_receipt_to_cashbook() TO service_role;
GRANT EXECUTE ON FUNCTION public.confirm_complaint_receipt(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.payment_reconciliation_summary(text, timestamptz, timestamptz) TO service_role;