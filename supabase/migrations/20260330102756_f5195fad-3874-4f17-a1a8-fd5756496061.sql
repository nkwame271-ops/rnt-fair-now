DROP TRIGGER IF EXISTS on_tenancy_rejected ON tenancies;

CREATE TRIGGER on_tenancy_rejected
  AFTER UPDATE ON tenancies
  FOR EACH ROW
  EXECUTE FUNCTION handle_tenancy_rejection();