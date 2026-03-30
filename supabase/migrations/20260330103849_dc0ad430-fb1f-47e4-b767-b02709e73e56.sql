DROP TRIGGER IF EXISTS on_tenancy_rejected ON public.tenancies;

CREATE TRIGGER on_tenancy_rejected
  AFTER UPDATE OF status ON public.tenancies
  FOR EACH ROW
  WHEN (NEW.status = 'rejected' AND OLD.status IS DISTINCT FROM 'rejected')
  EXECUTE FUNCTION public.handle_tenancy_rejection();