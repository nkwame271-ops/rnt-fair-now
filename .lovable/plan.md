# Statistical Reports Module

Build the digital version of the annual statistical report: a public 4-step submission wizard for office staff, and an admin Reports area with individual and consolidated reports.

## 1. Public entry (no login)
- "Reports" link next to "Staff Portal" in the homepage footer, opening `/reports`.
- Intro step: Full Name, Position, Office (searchable list from the office database), Reporting Period, Reporting Year, and the **Office Submission PIN**.
- 4 pages with a progress bar, live totals and red highlights on mismatches; Next is blocked until figures reconcile.
  1. **Cases Received**: Digital + Manual = Total; Tenant M/F + Landlord M/F = Total.
  2. **Outcomes**: Settled + Struck Off + Withdrawn + Referred to Court + Pending = Total Cases. Arrears, Absconded and Other Matters are case classifications, captured but not summed. AG Landlords + AG Tenants = Referred to Court.
  3. **Recoveries and Activity**: Total Recovered is calculated automatically and can't be edited. Also captures inspections, agreements, rent cards, and landlords/tenants registered.
  4. **Awareness and Timeline**: radio and TV engagement counts, with a repeatable list of station names; average number of sittings before settlement (a number).
- Review screen, then submit. The user sees a confirmation with a Report ID (e.g. `RPT-2026-Q3-000123`).
- If a report already exists for that office and period, the user must confirm it as a revision. The old version is kept in history.
- Anti-abuse: office PIN check, a rate limit per IP and per office, and a honeypot field.

## 2. Admin Portal → Reports
- Super Admin only by default. Super Admin can grant these permissions to individual admins: View, Export, Consolidate, Manage/Reopen, Configure.
- **Individual reports**: a paginated table with Report ID, office, region, submitter, position, period, year, date and status. Each report opens as a formatted document with PDF, Excel and Print.
- **Consolidated**: filters for this week, this month, last month, quarter, year, previous years, custom range, office, region or all offices. Every field is summed and the same checks are rerun. Includes national totals plus regional and office-by-office breakdowns, with PDF and Excel export.

## 3. Engine Room → Reporting configuration
Reporting periods (Q1–Q4, Annual), open years, submissions on or off, deadline per period, whether late reports are accepted, and setting or resetting each office's PIN.

## Technical details
- Tables: `statistical_reports` (header, office, period, year, submitter, status, revision_no, is_current), `report_case_statistics`, `report_recovery_statistics`, `report_registration_statistics`, `report_awareness_activity` (one row per station), `report_submission_revisions` (immutable snapshot and actor), `report_audit_log` (append-only), `reporting_config`, `office_report_pins` (bcrypt hash), `report_permissions` (user_id, permission).
- A DB trigger enforces every reconciliation formula and computes total_recovered, so inconsistent data is rejected even if someone bypasses the form.
- There are no public inserts. Everything goes through a `submit-statistical-report` edge function (service role) that handles PIN verification, rate limits, deadline and late-report rules, duplicate or revision handling and ID generation.
- RLS: reads use `is_super_admin()` or a `has_report_permission(uid, perm)` security-definer helper, wrapped in a sub-select. Audit tables have no UPDATE or DELETE policy.
- Consolidation uses a SQL RPC with office, region and date filters, grouped by office, region and nation. It runs server-side, so the 1,000-row limit doesn't apply.
- Exports use the existing jsPDF and xlsx libraries.
