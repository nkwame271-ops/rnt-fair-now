<p align="center">
  <img src="public/cfled-logo.png" alt="RentGhana Pilot" width="120" />
</p>

<h1 align="center">RentGhana Pilot</h1>

<p align="center">
  <strong>A digital platform modernising rental regulation in Ghana — built for the Rent Control Department (RCD) under the Commission for Lands, Estate & Development (CFLED).</strong>
</p>

<p align="center">
  <a href="https://rentghanapilot.lovable.app">Live Demo</a> •
  <a href="#features">Features</a> •
  <a href="#architecture">Architecture</a> •
  <a href="#getting-started">Getting Started</a>
</p>

---

## Overview

RentGhana Pilot is a multi-role web application that digitises the operations of the Rent Control Department. It provides dedicated portals for **tenants**, **landlords**, and **regulators** to manage rental agreements, payments, complaints, property registration, and KYC verification — all aligned with Ghana's Rent Act (Act 220).

## Features

### 🏠 Tenant Portal
- **Dashboard** — personalised overview with active tenancies, payment status, and notifications
- **Marketplace** — browse listed properties, save to watchlist, request viewings, and apply for units
- **Payments** — view rent tax obligations, pay via Paystack (GHS), and track payment history
- **File Complaint** — submit formal complaints against landlords (with filing fee)
- **My Cases** — track complaint status and regulator responses
- **My Agreements** — view and download tenancy agreements as PDF
- **Legal Assistant** — AI-powered chatbot for guidance on Act 220 and tenant rights
- **Rent Checker** — verify fair rent pricing for an area
- **Preferences** — set budget, location, and property type preferences
- **Messaging** — in-app communication with landlords via marketplace listings

### 🏢 Landlord Portal
- **Dashboard** — property overview, tenant count, income summary
- **Register Property** — multi-step property registration with units, amenities, GPS confirmation, and image upload
- **Edit Property** — update property details, manage units
- **Add Tenant** — create tenancy agreements with configurable advance months and tax calculation
- **Agreements** — manage tenancy agreements with dual-party acceptance workflow
- **Marketplace Listing** — list vacant units on the marketplace (with listing fee)
- **Viewing Requests** — manage property viewing requests from prospective tenants
- **Rental Applications** — review and approve/reject tenant applications
- **Messages** — respond to enquiries from tenants

### 🏛️ Regulator Portal
- **Dashboard** — real-time analytics on registrations, properties, and complaints
- **Tenant & Landlord Management** — view and manage all registered users
- **Property Registry** — full property database with GPS verification and location locking
- **Complaints Management** — review, assign, and resolve complaints
- **Agreement Templates** — configure standard agreement terms, tax rates, and custom fields
- **KYC Verification** — review identity documents with AI-assisted face matching
- **Analytics** — charts and stats on platform activity
- **Staff Management** — invite regulator staff via email
- **Support Chats** — respond to user support conversations
- **Feedback** — review beta feedback and user ratings

### 🔐 Cross-Cutting Features
- **Authentication** — email/password signup with email verification, role-based access control
- **KYC Gate** — certain actions (filing complaints, adding tenants) require verified identity
- **Role-Based Routing** — protected routes enforce tenant/landlord/regulator access
- **Notifications** — real-time in-app notification bell
- **Live Chat** — floating support chat widget
- **Beta Feedback** — embedded feedback widget for pilot users
- **Tour Guide** — interactive onboarding walkthrough
- **PDF Generation** — downloadable tenancy agreements and profile cards with QR codes
- **GPS Verification** — browser geolocation for property and complaint location confirmation
- **Responsive Design** — mobile-first layouts with dedicated mobile navigation

## Architecture

### Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, TypeScript, Vite |
| Styling | Tailwind CSS, shadcn/ui, Framer Motion |
| State | TanStack React Query, React Context |
| Routing | React Router v6 |
| Backend | Lovable Cloud (Supabase) |
| Auth | Supabase Auth with RLS |
| Payments | Paystack (GHS) |
| SMS | Arkesel V2 API |
| AI | Lovable AI Gateway (Gemini 2.5 Flash) |
| Maps | Leaflet / React Leaflet |
| PDF | jsPDF with QR codes |

### Backend Functions (Edge Functions)

| Function | Purpose |
|----------|---------|
| `paystack-checkout` | Initialise Paystack payment sessions for rent tax, registration fees, complaints, listings, and viewings |
| `paystack-webhook` | HMAC-verified webhook handler for confirming payments and updating records |
| `legal-assistant` | AI-powered legal guidance chatbot using Gemini via Lovable AI Gateway |
| `kyc-face-match` | AI-assisted face matching between selfie and Ghana Card photo |
| `send-sms` | SMS notifications via Arkesel V2 API |
| `invite-staff` | Regulator staff invitation with auth account creation |
| `verify-registration` | Registration code verification for tenants/landlords |
| `contact-assistant` | Contact form / support assistant |

### Database Schema

Key tables: `profiles`, `tenants`, `landlords`, `properties`, `units`, `property_images`, `tenancies`, `rent_payments`, `complaints`, `viewing_requests`, `rental_applications`, `marketplace_messages`, `watchlist`, `tenant_preferences`, `kyc_verifications`, `ratings`, `notifications`, `support_conversations`, `support_messages`, `beta_feedback`, `agreement_template_config`, `user_roles`, `property_location_edits`

All tables use Row-Level Security (RLS) with a `has_role()` security-definer function.

### Project Structure

```
src/
├── components/          # Reusable UI and layout components
│   ├── ui/              # shadcn/ui primitives
│   ├── TenantLayout.tsx
│   ├── LandlordLayout.tsx
│   ├── RegulatorLayout.tsx
│   ├── ProtectedRoute.tsx
│   ├── KycGate.tsx
│   └── ...
├── pages/
│   ├── tenant/          # Tenant portal pages
│   ├── landlord/        # Landlord portal pages
│   ├── regulator/       # Regulator portal pages
│   ├── shared/          # Profile, verification
│   ├── Index.tsx        # Landing / role select
│   ├── Login.tsx
│   └── ...
├── hooks/               # Custom React hooks (useAuth, useKycStatus, etc.)
├── data/                # Dummy data and tour step definitions
├── lib/                 # Utilities (formatters, PDF generators, GPS, SMS)
├── integrations/        # Auto-generated Supabase client and types
└── assets/              # Images and logos

supabase/
├── functions/           # Edge functions (see table above)
└── config.toml          # Function configuration
```

## Getting Started

### Prerequisites

- Node.js 18+ and npm

### Installation

```bash
# Clone the repository
git clone <YOUR_GIT_URL>
cd <YOUR_PROJECT_NAME>

# Install dependencies
npm install

# Start development server
npm run dev
```

The app will be available at `http://localhost:5173`.

### Environment Variables

Environment variables are managed automatically by Lovable Cloud. No manual `.env` configuration is needed for deployment.

### Running Tests

```bash
npm test          # Run tests once
npm run test:watch  # Watch mode
```

## Payment Flow

1. **Initiation** — Client calls `paystack-checkout` edge function with payment type and metadata
2. **Redirect** — User is redirected to Paystack's hosted payment page (GHS currency)
3. **Webhook** — On success, Paystack sends a `charge.success` event to `paystack-webhook`
4. **Verification** — Webhook verifies HMAC SHA-512 signature against secret key
5. **Settlement** — Database records are updated based on payment reference prefix (`rent_`, `treg_`, `lreg_`, `comp_`, `list_`, `view_`, `rentbulk_`)

### Payment Types

| Type | Fee | Description |
|------|-----|-------------|
| `tenant_registration` | GH₵ 2.00 | Annual tenant ID registration |
| `landlord_registration` | GH₵ 2.00 | Annual landlord ID registration |
| `complaint_fee` | GH₵ 2.00 | Complaint filing fee |
| `listing_fee` | GH₵ 2.00 | Marketplace property listing |
| `viewing_fee` | GH₵ 2.00 | Property viewing request |
| `rent_tax` | 8% of rent | Single month rent tax payment |
| `rent_tax_bulk` | 8% of total | Bulk advance rent tax payment |

## Changelog

### v1.0.0 — Pilot Launch

#### Core Platform
- Multi-role authentication system (tenant, landlord, regulator) with email verification
- Role-based routing and protected routes
- KYC verification workflow with AI face matching
- In-app notification system with real-time bell indicator
- Beta feedback widget for pilot user input
- Interactive tour guide for onboarding
- Error boundary components for graceful error handling

#### Tenant Features
- Full tenant dashboard with tenancy overview
- Property marketplace with search, filtering, watchlist, and viewing requests
- Rental application workflow
- Rent tax payment integration via Paystack
- Complaint filing system with payment gate
- AI legal assistant (Act 220 guidance)
- Rent checker tool
- Tenancy agreement PDF download with QR codes
- Tenant preferences management
- In-app messaging with landlords

#### Landlord Features
- Landlord dashboard with property and income summary
- Multi-step property registration with unit management
- Property editing with image upload
- Tenant onboarding with agreement generation
- Dual-party agreement acceptance workflow
- Marketplace listing with fee payment
- Viewing request management
- Rental application review
- Landlord messaging system

#### Regulator Features
- Regulator dashboard with real-time analytics
- Tenant and landlord registry management
- Property database with GPS verification and location locking
- Complaint management and resolution workflow
- Configurable agreement templates (terms, tax rate, custom fields)
- KYC document review with AI-assisted face matching
- Staff invitation system
- Support chat management
- Feedback review dashboard
- Platform analytics with charts

#### Backend & Infrastructure
- Paystack payment integration (checkout + webhook with HMAC verification)
- Arkesel V2 SMS notifications
- AI-powered legal assistant via Lovable AI Gateway (Gemini 2.5 Flash)
- KYC face-match edge function
- Staff invitation edge function
- Registration verification edge function
- Row-Level Security on all database tables
- GPS utility functions for location verification

#### UI/UX
- Responsive design with mobile-first approach
- Animated page transitions with Framer Motion
- Staggered grid layouts
- Custom logo loader / splash screen
- Floating action hub
- Rating dialog system
- Property map integration with Leaflet
- Semantic design tokens and dark mode support

---

## License

This project is proprietary software developed for the Commission for Lands, Estate & Development (CFLED), Ghana.

## Contact

For enquiries about the RentGhana Pilot programme, please contact the Rent Control Department.
