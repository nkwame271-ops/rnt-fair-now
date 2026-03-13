# External Agency API System — Plan

## Overview

Build a secure, API-key-authenticated backend API layer (edge functions) that exposes read-only data endpoints to external government agencies. Each agency gets a scoped API key that limits access to only the endpoints they are authorized to use.

## Data Inventory — What the Platform Knows

Based on the full database schema, here is every queryable data domain:

### Tenants & Landlords

- All registered tenants (name, ID code, region, registration status, fee paid, expiry)
- All registered landlords (same fields)
- KYC verification status per user (Ghana Card number, AI match score, approval status)
- Citizen vs non-citizen breakdown
- Profiles (occupation, nationality, address, emergency contacts)
- Tenants without active tenancies (no landlord)
- Tenants with expired registrations
- Rent card delivery list (verified tenants with delivery address on file)

### Properties

- All registered properties (address, region, GPS, condition, marketplace listing status)
- Units per property (type, rent, amenities, vacancy status)
- Property location audit trail

### Financial / Tax

- All rent payments (monthly rent, 8% tax amount, payment status, dates)
- Total tax collected per landlord, per region, per period
- Registration fee revenue
- Complaint filing fees, listing fees, viewing fees
- Landlord rental income summaries

### Tenancies & Agreements

- Active tenancy agreements (parties, rent, advance period, dates)
- Agreement registration codes
- Tenancy compliance status (tax paid vs unpaid months)

### Complaints & Disputes

- All filed complaints (type, region, status, landlord name)
- Resolution timelines

### Platform Analytics

- Regional distribution of tenants, landlords, properties
- Complaint trends by type

---

## Target Agencies & Their API Scopes


| Agency                                      | Data They Need                                                                        | Justification                                  |
| ------------------------------------------- | ------------------------------------------------------------------------------------- | ---------------------------------------------- |
| **GRA** (Ghana Revenue Authority)           | Landlord income summaries, rent tax collected, landlord profiles                      | Income tax assessment on rental income         |
| **NIA** (National Identification Authority) | Ghana Card numbers used for KYC, verification counts                                  | Identity cross-referencing and fraud detection |
| **Ghana Statistical Service**               | Tenant/landlord counts by region, citizen vs non-citizen, property types, rent ranges | National housing census data                   |
| **Metropolitan/District Assemblies**        | Properties by region/area, vacancy rates, complaint counts by area                    | Local planning and zoning                      |
| **Rent Control HQ / Regional Offices**      | All data (they are the regulator)                                                     | Already served by the regulator portal         |
| **Ghana Police Service**                    | Complaint records, tenant/landlord identity data (on request)                         | Law enforcement for housing disputes           |
| **Ministry of Works & Housing**             | Property counts, types, conditions, regional distribution                             | National housing policy                        |


---

## Technical Architecture

### 1. API Keys Table (new migration)

```sql
CREATE TABLE public.api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_name text NOT NULL,
  api_key_hash text NOT NULL,
  scopes text[] NOT NULL DEFAULT '{}',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz,
  created_by uuid
);
```

Scopes define which endpoints each key can access (e.g., `tax:read`, `tenants:read`, `properties:read`, `complaints:read`, `stats:read`, `identity:read`).

### 2. Single Edge Function: `agency-api`

One edge function with path-based routing via the request body:

```
POST /agency-api
Header: X-API-Key: <key>
Body: { "endpoint": "tax/landlord-income", "filters": { "region": "Greater Accra", "period": "2026-Q1" } }
```

The function:

1. Validates the API key against `api_keys` table (hashed comparison)
2. Checks if the requested endpoint is within the key's scopes
3. Queries the database using the service role (read-only queries only)
4. Returns JSON response with pagination support

### 3. Available Endpoints (grouped by scope)

`**tax:read**` — For GRA

- `tax/landlord-income` — Per-landlord rental income summary for a period
- `tax/rent-tax-collected` — Total rent tax collected, filterable by region/period
- `tax/landlord-list` — All landlords with total taxable income

`**tenants:read**` — For Statistical Service, Assemblies

- `tenants/registered` — All registered tenants with region/status
- `tenants/without-landlord` — Tenants with no active tenancy
- `tenants/expired-registration` — Tenants with expired registration
- `tenants/rent-card-delivery` — Verified tenants needing physical rent card delivery (have delivery address)
- `tenants/non-citizens` — Non-citizen tenant list

`**landlords:read**`

- `landlords/registered` — All registered landlords
- `landlords/unregistered-fee` — Landlords who haven't paid registration fee
- `landlords/property-count` — Landlords with property counts

`**properties:read**` — For Assemblies, Ministry of Housing

- `properties/by-region` — Properties grouped by region with counts
- `properties/vacant-units` — All vacant units with rent and location
- `properties/conditions` — Property condition summary

`**complaints:read**` — For Police, Assemblies

- `complaints/list` — Complaints filterable by type/region/status
- `complaints/summary` — Complaint counts by type and region

`**stats:read**` — For Statistical Service

- `stats/overview` — Platform-wide counts (tenants, landlords, properties, revenue)
- `stats/regional-breakdown` — All metrics broken down by region
- `stats/citizen-breakdown` — Citizen vs non-citizen counts

`**identity:read**` — For NIA (restricted)

- `identity/kyc-stats` — Verification counts by status (no PII)
- `identity/ghana-card-usage` — Count of Ghana Cards used for verification

### 4. Regulator Admin UI — API Key Management Page

New page at `/regulator/api-keys`:

- Create new API key (generates random key, stores hash, shows key once)
- Assign agency name and scopes via checkboxes
- Enable/disable keys
- View last-used timestamp
- Audit log of API calls (future phase)

### 5. Security

- API keys are hashed (SHA-256) before storage — raw key shown only once at creation
- Rate limiting via a simple counter (future: use a rate_limits table)
- All queries are read-only — no mutations exposed
- No PII in `identity:*` endpoints by default — only aggregate counts
- `verify_jwt = false` on the edge function (external callers have no Supabase auth)

---

## Implementation Steps

1. **Database migration**: Create `api_keys` table with RLS (regulator-only management)
2. **Edge function**: `agency-api/index.ts` with key validation, scope checking, and endpoint routing
3. **Regulator UI**: New page for API key CRUD with scope assignment
4. **Config.toml**: Register the new function with `verify_jwt = false`
5. **Navigation**: Add "Agency APIs" link to regulator sidebar

---

## Scope Summary

This creates a production-grade, secure API gateway that lets the Rent Control Department grant controlled, auditable access to specific platform data for any government agency — without giving them direct database access or a login to the platform.

&nbsp;

 we see api service on the landing page and  show what api is avalable and what Agency can benefit and dtata we van make avalabe and we have the api section on admi dashbaord so we have give out uniqe api keys 