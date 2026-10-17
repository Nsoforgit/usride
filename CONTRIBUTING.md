# Contributing to USRide & UCRide

Thank you for your interest in contributing to **USRide & UCRide** — the smart campus mobility platform for the University of Benin (UNIBEN)! Whether you are fixing a bug, adding a new campus landmark, improving telemetry accuracy, or enhancing documentation, your contributions are welcome.

---

## 🛠️ How to Contribute (Pull Request Workflow)

### 1. Fork & Clone the Repository
1. Click the **Fork** button at the top-right of the [USRide GitHub Repository](https://github.com/Nsoforgit/usride) (or clone directly if you have collaborator access).
2. Clone your fork locally:
   ```bash
   git clone https://github.com/<your-username>/usride.git
   cd usride
   npm install
   ```

### 2. Create a Feature or Bugfix Branch
Always create a dedicated branch off `main` for your work:
```bash
git checkout -b feat/your-feature-name
# or for bug fixes:
git checkout -b fix/issue-description
# or for documentation:
git checkout -b docs/documentation-update
```

### 3. Set Up Your Local Environment
1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```
2. Add your Supabase and Paystack keys to `.env`.
3. Start the development server:
   ```bash
   npm run dev
   ```

### 4. Verify & Test Your Changes
Before committing, ensure TypeScript compilation and the production bundle succeed with zero errors:
```bash
npm run build
npm run lint
```

### 5. Commit Using Clear Messages
We follow [Conventional Commits](https://www.conventionalcommits.org/):
- `feat: add Faculty of Law pickup landmark`
- `fix: resolve rider searching state sync via 5s polling fallback`
- `docs: add architecture diagram and setup guide to README`
- `refactor: simplify proximity ring calculation in geofence utils`

### 6. Push & Open a Pull Request
1. Push your branch to GitHub:
   ```bash
   git push origin <your-branch-name>
   ```
2. Go to the repository on GitHub and click **Compare & pull request**.
3. Provide a clear title and description explaining:
   - **What problem** the PR solves or **what feature** it adds.
   - **Files modified** and key design decisions.
   - **How to test** the changes in the Rider, Driver, or Admin views.

---

## 🔒 Security & Credentials Policy
- **Never commit `.env` files** or secret keys (`sk_live_...`, `SUPABASE_SERVICE_ROLE_KEY`).
- All sensitive payment operations (bank account resolution, transfer initiation, and webhook signature verification) must remain server-side inside `supabase/functions/`.
