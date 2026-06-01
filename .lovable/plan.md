## Fix Serial Lookup overload ambiguity

`public.lookup_serial_details` has two overloads in the database:
- `lookup_serial_details(p_serials text[])`
- `lookup_serial_details(p_serials text[], p_actor uuid)`

The frontend (`SerialLookup.tsx`) calls it with only `p_serials`, but PostgREST treats `p_actor` as optional and can't disambiguate, returning PGRST203.

### Change

Single migration:

```sql
DROP FUNCTION IF EXISTS public.lookup_serial_details(text[], uuid);
```

Keep the single-argument version that `SerialLookup.tsx` already calls. No frontend or edge function changes required.