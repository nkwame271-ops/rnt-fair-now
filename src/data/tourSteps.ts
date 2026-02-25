import type { TourStep } from "@/components/TourGuide";

export const tenantTourSteps: TourStep[] = [
  {
    target: 'a[href="/tenant/dashboard"]',
    title: "Welcome to your Dashboard",
    description: "This is your home base. You'll see your rental overview, active cases, and payment status at a glance.",
    placement: "right",
  },
  {
    target: 'a[href="/tenant/marketplace"]',
    title: "Browse the Marketplace",
    description: "Find available properties to rent. You can filter by location, price, and amenities, and request viewings.",
    placement: "right",
  },
  {
    target: 'a[href="/tenant/rent-checker"]',
    title: "Check Fair Rent",
    description: "Use the Rent Checker to see if your rent is within the government-approved range for your area.",
    placement: "right",
  },
  {
    target: 'a[href="/tenant/file-complaint"]',
    title: "File a Complaint",
    description: "Have an issue with your landlord? File a formal complaint here and it will be reviewed by a regulator.",
    placement: "right",
  },
  {
    target: 'a[href="/tenant/payments"]',
    title: "Make Payments",
    description: "Pay your rent and tax here via Mobile Money. Track which months are validated and which are pending.",
    placement: "right",
  },
  {
    target: 'a[href="/tenant/my-agreements"]',
    title: "View Your Agreements",
    description: "See your tenancy agreements, download PDFs, and verify your registration status.",
    placement: "right",
  },
  {
    target: 'a[href="/tenant/legal-assistant"]',
    title: "AI Legal Assistant",
    description: "Ask questions about your rights as a tenant. The AI assistant knows Ghana's Rent Act and can guide you.",
    placement: "right",
  },
];

export const landlordTourSteps: TourStep[] = [
  {
    target: 'a[href="/landlord/dashboard"]',
    title: "Your Landlord Dashboard",
    description: "Overview of your properties, tenancies, and payment collection status all in one place.",
    placement: "right",
  },
  {
    target: 'a[href="/landlord/my-properties"]',
    title: "Manage Properties",
    description: "View all your registered properties and their units. See occupancy status and monthly rent details.",
    placement: "right",
  },
  {
    target: 'a[href="/landlord/register-property"]',
    title: "Register a Property",
    description: "Add a new property to the system. You'll enter the address, units, amenities, and set rent amounts.",
    placement: "right",
  },
  {
    target: 'a[href="/landlord/add-tenant"]',
    title: "Add a Tenant",
    description: "Create a tenancy agreement by adding a tenant to one of your units. The system generates a formal agreement with regulator-defined terms.",
    placement: "right",
  },
  {
    target: 'a[href="/landlord/agreements"]',
    title: "Agreements",
    description: "Review and manage all your tenancy agreements. Download PDFs and track agreement status.",
    placement: "right",
  },
  {
    target: 'a[href="/landlord/viewing-requests"]',
    title: "Viewing Requests",
    description: "See requests from tenants who want to view your properties. Accept or decline them here.",
    placement: "right",
  },
];

export const regulatorTourSteps: TourStep[] = [
  {
    target: 'a[href="/regulator/dashboard"]',
    title: "Admin Overview",
    description: "High-level stats on tenants, landlords, properties, and complaints across the system.",
    placement: "right",
  },
  {
    target: 'a[href="/regulator/tenants"]',
    title: "Manage Tenants",
    description: "View all registered tenants, their registration status, and tenancy details.",
    placement: "right",
  },
  {
    target: 'a[href="/regulator/landlords"]',
    title: "Manage Landlords",
    description: "View all registered landlords and their registration status.",
    placement: "right",
  },
  {
    target: 'a[href="/regulator/properties"]',
    title: "Properties Registry",
    description: "Browse all registered properties in the system with their details and compliance status.",
    placement: "right",
  },
  {
    target: 'a[href="/regulator/complaints"]',
    title: "Handle Complaints",
    description: "Review tenant complaints, update statuses, and take action on disputes.",
    placement: "right",
  },
  {
    target: 'a[href="/regulator/agreement-templates"]',
    title: "Agreement Templates",
    description: "Configure the terms, tax rates, and limits that are enforced in all tenancy agreements.",
    placement: "right",
  },
  {
    target: 'a[href="/regulator/analytics"]',
    title: "Analytics",
    description: "View charts and data about rent trends, complaints, and system usage.",
    placement: "right",
  },
  {
    target: 'a[href="/regulator/invite-staff"]',
    title: "Invite Staff",
    description: "Add other regulators or staff members to help manage the system.",
    placement: "right",
  },
];
