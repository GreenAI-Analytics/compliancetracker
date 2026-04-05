# Compliance Track — User Flow & Workflows

---

## Page Map

### A. Public-Facing Pages (Pre-Login)
1. Landing / Homepage
2. Login / Signup Page

### B. Core Application Pages (Post-Login)
3. Onboarding Wizard
4. Main Dashboard
5. Compliance Hub
6. Custom Category Manager
7. Hidden Sections Archive
8. Profile & Settings
9. Subscription & Billing

### C. Super Admin Pages
10. Super Admin Dashboard

---

## Page-by-Page Breakdown

### 1. Landing / Homepage
- **Purpose:** Marketing and lead generation
- Value proposition: "Simplify EU Compliance for Your SME"
- Key features list
- "Start Your 30-Day Free Trial" button → leads to Signup
- Login link

---

### 2. Login / Signup Page
- **Purpose:** User authentication
- Email / Password fields
- Social login: Google, Microsoft, LinkedIn
- "Forgot Password?" link
- Toggle between Login and Signup forms

---

### 3. Onboarding Wizard
- **Purpose:** Collect initial company data to personalise the app
- Triggered immediately after signup

#### Step 1 — Country Selection
- "Where is your company based?"
- Large dropdown to select country of registration

#### Step 2 — Company Profile
- Fields: Business Name, Business Address, Number of Employees
- NACE Code dropdown (populated based on Step 1 country)
- Multi-select: "Which other EU countries do you operate in?"
- Checkbox: "Does your business have suppliers outside the European Union?"

#### Step 3 — Module Selection
- "We recommend these compliance modules for you:"
- Modules with toggles and short descriptions:
  - GDPR
  - Tax
  - HR
  - Non-EU Suppliers *(shown only if non-EU supplier box was checked in Step 2)*
- Modules are auto-selected based on company profile; user can toggle on/off

#### Step 4 — Team Setup
- "Invite your team (optional)"
- Input fields to add emails and assign roles: Org Admin / User

---

### 4. Main Dashboard
- **Purpose:** Central overview and homepage post-login

| Widget | Description |
|---|---|
| Compliance Health Score | Visual gauge showing overall compliance % |
| Priority Tasks | Overdue/upcoming tasks with "Mark as Complete" |
| Upcoming Requirements | Horizontal timeline (next 3–6 months) with hover tooltips |
| Compliance Calendar | Monthly calendar with deadline dots and hover tooltips |
| My Modules | Tiled overview of active compliance categories |
| Regulatory Updates Feed | Recent legal changes relevant to user's country |

**Top bar:** Global search, notification bell, user profile menu (Logout only — no Login/Signup shown to authenticated users)

**Left sidebar:** Dashboard · Compliance Hub · Customize · Settings

---

### 5. Compliance Hub
- **Purpose:** View and manage all compliance categories and tasks
- **Data source:** GitHub repository (managed by Super Admin)
- **URL:** `/compliance` or `/modules`

**Layout:**
- Sub-navigation tabs: All Modules · GDPR · Tax · HR · Non-EU Suppliers · [Custom Category Names]
- Page header: "Compliance Hub" + `+ Create Custom Category` button
- Category cards: active categories with tasks from GitHub + custom tasks
- "Hidden Sections" card: collapsed section for hidden items

---

### 6. Custom Category Manager
- **Purpose:** Create and manage custom categories stored locally for the business
- Form to create custom categories and tasks
- List of existing custom categories with management options

---

### 7. Hidden Sections Archive
- **Purpose:** Review and restore hidden items
- **URL:** `/compliance/hidden`
- Lists hidden categories and tasks
- Restore functionality for each item

---

### 8. Profile & Settings
- **Purpose:** Manage organisation and user settings
- **URL:** `/settings`

| Tab | Access | Content |
|---|---|---|
| Profile | All users | Personal settings, language preference |
| Organisation | Org Admin only | Business name, address, team management |
| Notifications | All users | Email and WhatsApp alert preferences |

---

### 9. Subscription & Billing
- **Purpose:** Manage payment plan
- **URL:** `/billing`
- Current plan and trial status
- Payment management via Stripe
- **Free/sponsored users:** Sees "Your account is sponsored. No payment required." — no payment form shown

---

### 10. Super Admin Dashboard
- **Purpose:** Central control panel for application owners
- **URL:** `yourapp.com/admin`

| Section | Description |
|---|---|
| Dashboard | System overview |
| Pricing Management | Create/edit subscription tiers |
| Compliance Framework | Sync tasks from GitHub (`Pull Latest from GitHub`), fallback to local backup, edit master tasks |
| Communication Settings | Email and WhatsApp configuration |
| Analytics | Usage metrics, popular custom categories, feature adoption |
| User Management | Create users, set Paid / Free (Sponsored), bypass trial option |

---

## User Workflows

### Workflow 1 — Super Admin: Managing the System & Creating Free Users

1. Navigate to `yourapp.com/admin` and log in with Super Admin credentials
2. Go to **User Management** → click **Create User**
3. Fill in: Email, Name, Company, Role (Org Admin/User), Subscription Type (`Free (Sponsored)`), check **Bypass Trial**
4. Click **Create & Send Invite** — system sends invitation email to the new user
5. Navigate to **Compliance Framework**
6. Click **Pull Latest from GitHub** to sync new compliance tasks
7. Review newly loaded tasks in the list editor
8. Navigate to **Analytics** to review usage metrics and trends

**Outcome:** New free user created; compliance content updated — no code changes required.

---

### Workflow 2 — Org Admin (Paying Customer): Onboarding & Customisation

1. Sign up via the website (e.g. Google account)
2. Redirected immediately into the **Onboarding Wizard**
   - Step 1: Select country (e.g. Germany)
   - Step 2: Enter business name, NACE code, tick non-EU suppliers checkbox if applicable
   - Step 3: Review and confirm auto-selected modules (GDPR, Tax, HR, Non-EU Suppliers)
   - Step 4: Invite team members and assign roles
3. Land on the **Dashboard** — review Compliance Health Score and Priority Tasks
4. Click **Mark as Complete** on a task — Health Score updates
5. Navigate to **Compliance Hub** → click `+ Create Custom Category`
6. Add a custom category (e.g. "Quality Assurance") and create tasks within it
7. Return to Dashboard — hover over calendar dots to view upcoming deadlines and statuses

**Outcome:** Company onboarded, compliance tracking started, app customised to business needs.

---

### Workflow 3 — User (Team Member): Daily Task Management

1. Receive invite email → log in (e.g. Microsoft account)
2. Land on personalised **Dashboard** — view role-relevant tasks only
3. In the Priority Tasks widget, click a task to open the relevant compliance module
4. Complete the task and click **Mark as Complete**
5. Find an irrelevant task → click `...` menu → select **Hide Permanently** (task moves to Hidden Sections archive)
6. Navigate to the **Knowledge Hub** — already filtered for user's country
7. Search for a topic (e.g. "US data transfer") and read the relevant article
8. Click profile picture → **Logout**

**Outcome:** Team member completes compliance responsibilities efficiently without irrelevant distractions.

---

### Workflow 4 — Org Admin (Free/Sponsored User): Using a Sponsored Account

1. Receive invite email from Super Admin → click activation link
2. Taken directly into the **Onboarding Wizard** (no payment info requested)
3. Set up company profile for relevant country
4. Access full platform features — same as a paying customer
5. Create custom categories to simulate different client scenarios
6. Navigate to **Subscription & Billing** — sees "Your account is sponsored. No payment required."

**Outcome:** Full platform access with no cost — ideal for partner demos and channel sales.

---

### Workflow 5 — System: Content Update from GitHub

1. **Developer** commits updated `compliance-tasks.json` and knowledge base articles to GitHub
2. **Super Admin** logs in → goes to Compliance Framework → clicks **Pull Latest from GitHub**
3. New tasks appear in the list editor for relevant countries/NACE codes
4. **End users** log in and see a notification: "New compliance requirement added"
5. Dashboard Health Score adjusts; new task appears in the relevant module with a "New" badge
6. Associated article becomes available in the **Knowledge Hub**

**Outcome:** Legal changes rapidly deployed to all relevant users — app stays always up to date.
