# Hotel Order Management System (Operational ERP)

A responsive, serverless, production-grade hotel and restaurant order management web application connecting **Counter Admin**, **Waiters**, and **Chefs/Kitchen**. Built with **React 19**, **TypeScript**, **Vite**, and **Supabase (PostgreSQL, RLS, Realtime & Edge Functions)**.

---

## 1. System Priorities & Architecture

1. **Data Correctness & Financial Integrity**:
   - Currency stored exclusively in integer paise (₹1 = 100 paise) preventing floating-point rounding bugs.
   - Authoritative prices captured as immutable historical snapshots at the moment of order placement.
   - Concurrency-safe single open session per table enforced by a partial database unique index: `CREATE UNIQUE INDEX idx_single_open_session_per_table ON table_sessions (table_id) WHERE (session_status = 'open');`
   - Strict separation of collected payments from unsettled running bills in all financial analytics.

2. **Ease & Speed of Everyday Use**:
   - **Waiter**: Mobile-phone touch optimized interface for rapid table order entry, instant item search, and clear acceptance confirmation.
   - **Chef/Kitchen**: Dedicated high-contrast preparation queue with automatic dish grouping by table/parcel, single-event audible chime notification on new orders, and tactile readiness buttons.
   - **Counter Admin**: Central operational cockpit for active dining tables, takeaway parcels, item adjustments/returns, cash/online bill settlement, menu pricing, table availability, staff account provisioning, and financial reports.

3. **Reliable Real-Time Communication**:
   - Supabase Realtime subscriptions synchronize order status changes across all screens.
   - Event-aware kitchen sound notification: chimes **once** for genuinely new order tickets. Rerenders, reconnects, or page refreshes do **not** repeat audio alerts.

4. **Strong Role-Based Security**:
   - Database-level Row Level Security (RLS) policies on every application table.
   - Atomic PostgreSQL RPCs (`rpc_submit_order`, `rpc_mark_prep_group_ready`, `rpc_adjust_order_item`, `rpc_settle_bill`) validating caller identity and role.
   - Privileged staff provisioning executed via Supabase Edge Functions utilizing the Supabase Auth Admin API with caller validation.
   - Disabled staff accounts are blocked from logging in or performing any operations.

5. **Minimalist, Functional Design**:
   - Crisp, high-contrast palette with restrained solid purple accent (`#6b21a8`).
   - Zero gradients, zero neon effects, zero decorative drop shadows, and zero oversized empty card containers.

---

## 2. Project Structure

```
ERP/
├── .env.example                               # Environment variable template
├── index.html                                 # Web app HTML entry point
├── package.json                               # Dependencies & scripts
├── tsconfig.json                              # TypeScript root configuration
├── tsconfig.app.json                          # Vite React compiler configuration
├── vite.config.ts                             # Vite build configuration
├── supabase/
│   ├── config.toml                            # Supabase CLI configuration
│   ├── migrations/
│   │   ├── 20261017000000_initial_hotel_schema.sql # Core tables, RLS, indexes & RPCs
│   │   └── 20261017000001_seed_initial_data.sql    # Starter tables, categories, dishes & admin helper
│   └── functions/
│       ├── create-staff-user/index.ts         # Edge Function: Admin API staff provisioning
│       └── toggle-staff-status/index.ts       # Edge Function: Enable/disable staff accounts
└── src/
    ├── types/
    │   ├── database.ts                        # Strongly-typed database entities & models
    │   └── analytics.ts                       # Financial metrics and dish performance types
    ├── lib/
    │   ├── api.ts                             # Unified domain API layer (Supabase / Mock)
    │   ├── currency.ts                        # Exact integer paise formatting & conversion
    │   ├── mockDatabase.ts                    # In-memory transactional engine mirroring Postgres RPCs
    │   ├── sound.ts                           # Web Audio API kitchen alert sound manager
    │   └── supabase.ts                        # Supabase client initialization
    ├── context/
    │   ├── AuthContext.tsx                    # Staff authentication, role gating & session
    │   └── SoundContext.tsx                   # Kitchen audio permission & order deduplication
    ├── components/
    │   ├── auth/
    │   │   └── LoginForm.tsx                  # Staff ID / Email login with disabled check
    │   ├── common/
    │   │   └── Navbar.tsx                     # Header with role switcher & staff profile
    │   ├── waiter/
    │   │   └── WaiterView.tsx                 # Mobile table selector, menu, cart & submission
    │   ├── kitchen/
    │   │   └── KitchenView.tsx                # Kitchen prep queue, grouped dishes & sound alerts
    │   └── counter/
    │       ├── CounterView.tsx                # Counter Admin master controller
    │       ├── SessionsOverview.tsx           # Active dining tables & parcel orders
    │       ├── CreateParcelModal.tsx          # Takeaway parcel ordering
    │       ├── BillDetailModal.tsx            # Itemized bill lines, prep status & adjustments
    │       ├── ItemAdjustmentModal.tsx        # Unprepared cancellation vs prepared return
    │       ├── SettlementModal.tsx            # Cash / Online payment recording & settlement
    │       ├── HistoricalBillsView.tsx        # Filterable historical bill audit
    │       ├── MenuManagementView.tsx         # Menu dishes, pricing in paise, categories
    │       ├── TableManagementView.tsx        # Floor table numbers & safe deactivation
    │       ├── StaffManagementView.tsx        # Staff account creation & access control
    │       └── AnalyticsDashboard.tsx         # Financial reports & category-aware dish analytics
    ├── tests/
    │   └── hotel_operations.test.ts           # Comprehensive Vitest suite for Scenarios 1–10
    ├── App.tsx                                # Root application with role guard
    ├── index.css                              # Minimalist, crisp design system
    └── main.tsx                               # Application DOM mounting
```

---

## 3. Supabase Backend Setup & Deployment

### Step A: Configure Environment Variables
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Populate your Supabase Project URL and Anon Key:
```env
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
VITE_APP_DATA_SOURCE=supabase
```

*(Note: Out-of-the-box, the application also includes an offline-capable transactional engine (`VITE_APP_DATA_SOURCE=demo`) which allows running, developing, and testing the entire system without requiring external credentials).*

### Step B: Apply Database Migrations
Deploy the SQL migrations to your Supabase project using the Supabase CLI:
```bash
npx supabase db push
```
Or execute the SQL files directly in the Supabase SQL Editor in this order:
1. `supabase/migrations/20261017000000_initial_hotel_schema.sql`
2. `supabase/migrations/20261017000001_seed_initial_data.sql`

### Step C: Deploy Edge Functions
Deploy the privileged staff administrative Edge Functions:
```bash
npx supabase functions deploy create-staff-user
npx supabase functions deploy toggle-staff-status
```

### Step D: Secure Initial Administrator Provisioning
1. In the Supabase Dashboard, create your initial administrator user under **Authentication > Users** (e.g. `admin@hotel.local` with a strong password).
2. In the Supabase SQL Editor, run the helper procedure to link that user to the `ADM-001` administrator profile:
```sql
SELECT public.provision_initial_admin(
    'admin@hotel.local',
    'Arun Verma',
    'ADM-001'
);
```
3. Subsequent staff accounts (Waiters and Chefs) are created securely through the Counter Admin dashboard (`Staff & Roles` tab) via the `create-staff-user` Edge Function.

---

## 4. Key Operational Features & Workflows

### A. Waiter Ordering
- Touch-friendly table selector (`T1` to `T12`).
- Automatically detects open sessions. Subsequent submissions for an active table are appended to the existing running bill.
- Dishes categorized (Breads, Rice, Starters, Main courses, Beverages, Desserts, Accompaniments) with live search.
- Unavailable dishes are visually disabled and cannot be added to cart.
- Atomic submission with idempotency protection. Upon backend confirmation, the waiter receives an explicit acceptance modal with the generated ticket number.

### B. Kitchen Preparation & Critical Grouping
- **Grouping Rule**: Multiple orders of the same dish belonging to the same table session are grouped together into one preparation card (e.g. Table 4 orders 2 rotis, then orders 3 more rotis $\rightarrow$ kitchen sees 5 rotis pending for Table 4).
- The same dish ordered at different tables is tracked separately (Table 7 remains independent).
- Parcels are grouped within their own parcel code, never merged across parcels.
- **Audible Alert**: Web Audio API dual-chime alert triggers **once** per new ticket. Browser autoplay restriction is handled gracefully with an explicit "Enable Sound Alerts" button. Old orders and page refreshes do not trigger audio alerts.
- Tactile "Mark Ready" actions increment prepared quantities and transition ticket status.

### C. Counter Admin Cockpit
- **Active Sessions & Parcels**: Live view of open tables, running bill totals, and kitchen preparation progress.
- **Takeaway Parcel Ordering**: Dedicated action generating human-readable codes (`PCL-1001`), saving line items, and dispatching to kitchen.
- **Adjustments & Returns**:
  - *Unprepared Item Cancellation*: Reduces pending quantity from kitchen prep queue and deducts bill subtotal.
  - *Prepared Item Return*: Preserves kitchen preparation history, records auditable adjustment with operator reason, and reduces bill.
- **Settlement**: Authoritative final amount calculated by the server. Supports **Cash** or **Online** (recording external digital payment e.g. UPI). Settle closes the session and locks the bill from edits.
- **Historical Bills**: Full search and inspection by Bill #, Table, or Parcel ID. Preserves exact historical unit prices snapshots.
- **Financial Analytics**: Filters for Today, Yesterday, Last 30 days, Previous calendar month, Custom date range; Cash/Online payment filters; separates collected revenue from unsettled running bills; category-aware dish performance and ranking.

---

## 5. Automated Test Suite Execution

Run the complete test suite:
```bash
npm run test
```

### Verified Test Scenarios:
| Test ID | Scenario | Status |
|---|---|---|
| **Test 1** | Multiple orders at one table attach to single open session and preserve distinct tickets | **PASSED** |
| **Test 2** | Kitchen grouping for same dish/table while keeping other tables independent | **PASSED** |
| **Test 3** | Takeaway parcels receive unique parcel IDs, reach kitchen independently and have separate bills | **PASSED** |
| **Test 4** | Menu price changes preserve historical bill snapshots and apply only to new orders | **PASSED** |
| **Test 5** | Unprepared cancellation updates kitchen queue; prepared return preserves kitchen prep history | **PASSED** |
| **Test 6** | Settle open bill via Cash or Online; prevents duplicate/concurrent settlement | **PASSED** |
| **Test 7** | Role gating: blocks unauthorized waiter/chef writes and disables inactive accounts | **PASSED** |
| **Test 8** | Real-time event deduplication: broadcasts new orders without repeating alert chimes | **PASSED** |
| **Test 9** | Financial analytics: distinguishes collections from unsettled bills and calculates category share | **PASSED** |
| **Test 10** | Idempotency key: prevents duplicate orders and bills upon network retries | **PASSED** |

---

## 6. Running Locally

Start the Vite development server:
```bash
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser.
