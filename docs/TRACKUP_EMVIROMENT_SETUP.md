# TRACKUP ENVIRONMENT SETUP & TOOLING SPECIFICATION (PHASE 0)

## 1. Purpose & Execution Rules
Before writing any application code or generating project scaffolding, Google Antigravity must audit the local Windows development environment, verify installed versions, configure database inspection tooling, and produce a verification report.

### Strict Guardrails for Antigravity
1. **Audit Before Install:** Never blindly install global packages. Run version checks first and install only missing or incompatible dependencies after developer confirmation.
2. **No Destructive Commands:** Never run `supabase db reset` on linked remote databases, drop tables, or overwrite existing directories without explicit user approval.
3. **Zero Paid Resource Creation:** Do not create paid cloud instances, upgrade billing tiers, or provision paid add-ons via CLI or MCP.
4. **Secret Protection:** Never write API keys, Personal Access Tokens (PATs), or database passwords into committed files or terminal logs tracked in Git.

---

## 2. Automated Local Tooling Audit
Antigravity must execute the following read-only verification checks in the Windows terminal and log the exact outputs:

| Tool | Verification Command | Minimum Required Version | Purpose in TrackUp |
| :--- | :--- | :--- | :--- |
| **Node.js** | `node --version` | `v20.11.0+` (LTS) | Vite build runtime, TypeScript compilation, Playwright test runner |
| **npm** | `npm --version` | `v10.0.0+` | Package management and script execution |
| **Git** | `git --version` | `v2.40.0+` | Version control and GitHub deployment triggers |
| **Supabase CLI** | `npx supabase --version` | `v1.180.0+` | Local migration management (`supabase/migrations/`) and TypeScript type generation |
| **Playwright** | `npx playwright --version` | `v1.45.0+` | End-to-end automated browser and mobile viewport testing |

### Conditional Installation Policy
- If **Node.js** or **Git** is missing or below the minimum version, Antigravity must **halt** and instruct the developer to install/update them manually (or request permission to run `winget`).
- **Supabase CLI** and **Playwright** must be installed as **local project `devDependencies`** inside `package.json` (`npm install -D supabase @playwright/test`) rather than forced global installs, preventing global PATH pollution on Windows.
- After installing `@playwright/test`, Antigravity must run `npx playwright install chromium` to ensure the headless browser binary is ready for automated testing.

---

## 3. Classification of Tools & Services
To maintain clear architectural boundaries, tools are categorized as follows:

1. **Hosted Cloud Services (External Infrastructure):**
   - **Supabase Cloud Platform:** Hosted PostgreSQL database, GoTrue Auth server, Edge Functions, and Storage buckets.
   - **Vercel:** Cloud build pipeline, CDN edge network, and preview/production web hosting.
   - **TMDB & AniList APIs:** Third-party external metadata providers.
2. **MCP Servers (AI Agent Inspection & Tooling Layer):**
   - **Official Supabase MCP Server (`https://mcp.supabase.com/mcp`):** Model Context Protocol bridge allowing Antigravity to inspect database schemas, check RLS advisors, and query logs safely.
3. **Local Development Dependencies (`package.json`):**
   - **Build & UI:** Vite, React, TypeScript, Tailwind CSS, `shadcn/ui` primitives, `lucide-react`.
   - **State & Parsing:** `@tanstack/react-query`, `zustand`, `papaparse`, `zod`.
   - **CLI & Testing:** `supabase` (local CLI binary), `@playwright/test`, `vitest`.

---

## 4. Official Supabase MCP Server Configuration

### 4.1 Capabilities & Official Setup
Supabase provides an official hosted MCP server (`https://mcp.supabase.com/mcp`) and an official CLI/stdio package (`@supabase/mcp-server-supabase`).
- **Supported Capabilities:** `list_tables`, `list_extensions`, `list_migrations`, `apply_migration` (DDL), `execute_sql`, `get_advisors` (security/performance linting), and TypeScript type generation.
- **Security Scoping Parameters:** The official Supabase MCP server supports URL query parameters to restrict LLM capabilities:
  - `project_ref=<PROJECT_ID>`: Locks the MCP server to the single TrackUp development project and disables account-wide tools (`create_project`, `delete_project`).
  - `read_only=true`: Executes queries under a read-only Postgres role when only inspection is needed.
  - `features=database,docs`: Restricts exposed tools to database and documentation operations.

### 4.2 Configuring Supabase MCP in Antigravity
1. Check Antigravity's active MCP configuration file.
2. Configure the official hosted endpoint scoped strictly to the **TrackUp Development Project**:
   ```json
   {
     "mcpServers": {
       "supabase-trackup-dev": {
         "type": "http",
         "url": "[https://mcp.supabase.com/mcp?project_ref=YOUR_DEV_PROJECT_REF&features=database,docs](https://mcp.supabase.com/mcp?project_ref=YOUR_DEV_PROJECT_REF&features=database,docs)"
       }
     }
   }