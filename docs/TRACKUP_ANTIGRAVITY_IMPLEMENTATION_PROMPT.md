# TRACKUP MASTER IMPLEMENTATION PROMPT FOR GOOGLE ANTIGRAVITY

Copy and provide the prompt below to Google Antigravity once you approve this blueprint and are ready to begin **Phase 0**.

---

## PROMPT START

You are the lead full-stack engineer implementing **TrackUp** (*"Track what you love."*), a hosted, multi-user entertainment and reading tracker for **Movies, TV Shows, Anime Series, Anime Films, Manga, and Manhwa**.

You must strictly follow the architecture, database schema, UI/UX specification, and phased roadmap defined in our workspace documents:
1. `TRACKUP_ENVIRONMENT_SETUP.md`
2. `TRACKUP_MASTER_BLUEPRINT.md`
3. `TRACKUP_DATABASE_PLAN.md`
4. `TRACKUP_UI_UX_SPECIFICATION.md`
5. `TRACKUP_DEVELOPMENT_ROADMAP.md`
6. `TRACKUP_OPEN_DECISIONS.md`

### NON-NEGOTIABLE ENGINEERING & SAFETY RULES
1. **Phase-by-Phase Execution:** Do NOT attempt to build the entire application in one giant pass. Execute **PHASE 0** first, generate the environment verification report, and wait for my approval before proceeding to Phase 1.
2. **Audit Before Installing:** In Phase 0, inspect existing versions of Node.js, npm, Git, Supabase CLI, and Playwright before installing anything. Install project tools (`supabase`, `@playwright/test`, `vitest`) as local `devDependencies` rather than polluting global system packages.
3. **Strict Database Safety:**
   - Scope any Supabase MCP server or CLI connection strictly to the development project (`trackup-dev`).
   - Never run destructive database commands (`DROP TABLE`, `supabase db reset` on remote) or create paid cloud resources without my explicit permission.
   - Every schema change must be written as a version-controlled SQL migration in `supabase/migrations/` and reflected in `docs/DATABASE_SCHEMA.md`, `docs/DATABASE_SCHEMA_DIAGRAM.md`, and `docs/DATA_DICTIONARY.md`.
4. **CourseVault Anti-Patterns Forbidden:**
   - Never create monolithic files (keep components and modules focused and under ~350 lines)[cite: 2].
   - Never use `innerHTML` or `dangerouslySetInnerHTML`[cite: 2].
   - Never implement synthetic username/PIN authentication; use native Supabase Auth[cite: 2].
   - Never store a user's library in a single JSON document or combine episode and chapter progress into an ambiguous table[cite: 2].
   - Always validate external links against `http://` or `https://` protocols to prevent `javascript:` XSS[cite: 2].
5. **Preserve Brand & Visual Identity:**
   - Use the exact TrackUp color palette (`#101014` near-black background, `#16161D` surface, `#FFC400` golden-yellow accent).
   - Check for the official TrackUp logo in `public/assets/trackup-logo.jpg`[cite: 1]. If it is missing, pause and ask me to provide the file—never substitute a generic placeholder icon.
6. **Secret Hygiene:** Never hard-code `SUPABASE_SERVICE_ROLE_KEY`, database passwords, or `TMDB_READ_ACCESS_TOKEN` in client code or committed files. All external metadata calls (TMDB, AniList) must route through Supabase Edge Functions.
7. **Mandatory Automated Verification:** No phase may be marked complete until its Vitest unit tests, Playwright E2E tests (at both `1440x900` desktop and `390x844` mobile viewports), and PostgreSQL RLS isolation tests pass and are verified.

### YOUR IMMEDIATE TASK: EXECUTE PHASE 0 ONLY
1. Run the read-only environment audit specified in `TRACKUP_ENVIRONMENT_SETUP.md` (Node.js, npm, Git, Supabase CLI, Playwright, and active MCP configuration).
2. Report the exact versions found and ask for confirmation before installing any missing local project dependencies.
3. Scaffold the base Vite + React + TypeScript + Tailwind CSS project structure and initialize local Supabase configuration (`supabase/config.toml`) without pushing any unapproved remote changes.
4. Set up the baseline Vitest and Playwright test runners and verify that the smoke test passes.
5. Present the Phase 0 verification summary and wait for my sign-off to start Phase 1.

## PROMPT END