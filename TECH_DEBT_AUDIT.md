# Tech Debt Audit — bisc-bot

> Generated: 2026-09-27
> Scope: full codebase (~14k LOC, ESM, Node 26, discord.js 14, Supabase)
> Stack tooling: `npm audit` (6 vulns), `depcheck` (unused `chalk`, missing `mongoose`), no TS/type-checking

---

## Executive Summary (Top 10 by Impact)

| # | Finding | Severity | Effort | File:Line |
|---|---------|----------|--------|-----------|
| 1 | **Circular dependency**: `msg-handler.js` → `syncmsg.js` (dynamic import at runtime) — if sync runs during a missing-key fallback, it deadlocks the hot path | Critical | S | `src/config/msg-handler.js:24-38`, `src/commands/config/syncmsg.js` |
| 2 | **Double-reward race** in `daily.js`: reads `user.cooldowns` locally → writes `daily_streak` + `cooldowns` via `updateUser` → calls `addXp` + `addBiscoins` RPCs. If two `daily` executions interleave, streak advances twice, XP and money granted twice | Critical | M | `src/commands/economy/daily.js:105-154` |
| 3 | **Welcome/Bye systems broken post-migration**: repo returns snake_case (`chat_id`, `message_content`, `message_embed`) but consumers read camelCase (`chatId`, `message_content`, `message_embed` — mixed) → `undefined` channel lookup, silent failure | Critical | S | `src/commands/welcome/welcome.js:55`, `src/commands/bye/bye.js:59`, `src/infra/database/repositories/welcomeRepository.js:12-19`, `src/infra/database/repositories/byeRepository.js:12-19` |
| 4 | **Non-atomic transfer in `pay.js`**: `removeBiscoins` (sender) then `addBiscoins` (receiver) — no rollback if second fails; money vanishes | High | M | `src/commands/economy/pay.js:86-104` |
| 5 | **6 npm vulnerabilities** (4 high, 2 moderate) via `discord.js@14.19.3` → `undici` / `ws` — DoS & memory disclosure | High | S | `package.json:16`, `npm audit` |
| 6 | **`mongoose` imported by `scripts/migrate.js` but not in `package.json`** — migration script will crash on fresh install | High | S | `scripts/migrate.js`, `package.json` (missing dep) |
| 7 | **`chalk` in `package.json` but unused** in all source — dead dependency | Low | S | `package.json:15`, `depcheck` |
| 8 | **No tests, no CI, no type-checking** — zero safety net for refactors | Medium | L | (repo-wide) |
| 9 | **Mangled i18n key** from rename commit: `idVocnoestregistradonosistemaEsteusurionoestregistradonosistema` in `message_data.json:173` — user-facing error shows raw key | Medium | S | `src/config/message_data.json:173` |

---

## Architectural Mental Model

**What the system actually is:** A Discord bot (discord.js v14) with a prefix-based command router, ESM modules, and a custom message/i18n system (`msg-handler.js` + `message_data.json` + `syncmsg.js` sync loop). Data layer is mid-migration from MongoDB/Mongoose to Supabase (PostgreSQL) via raw `@supabase/supabase-js` + PL/pgSQL RPCs for atomic economy operations. Commands are auto-discovered from `src/commands/**/*.js`, registered in a `Map` on the client, and metadata lives in `command_data.json` (synced by `synccat.js`/`syncmsg.js`).

**Layers:**
```
index.js → heart.js (startup) → BotState (singleton EventEmitter)
    ├─ infra/
    │   ├─ DiscordClient.js  (factory, intent groups, env validation)
    │   ├─ Supabase.js       (client + connectToSupabase health check)
    │   ├─ database/index.js (barrel: user/welcome/bye repositories)
    │   ├─ database/repositories/  (3 repos, RPC-centric)
    │   └─ logger/           (minimal file+console, 4 levels)
    ├─ loaders/
    │   ├─ CommandLoader.js  (recursive fs, dynamic import, alias map)
    │   └─ EventLoader.js    (recursive fs, dynamic import, client.on/once)
    ├─ config/
    │   ├─ env.js            (dotenv + REQUIRED_VARS validation)
    │   ├─ config.js         (prefixes/owners persisted in config.json)
    │   ├─ msg-handler.js    (i18n resolver, auto-sync trigger)
    │   ├─ message_data.json (single source of truth for all user-facing strings)
    │   ├─ command_data.json (command metadata: name, aliases, category, usage)
    │   └─ sync_snapshot.json (syncmsg state for 3-way merge)
    ├─ commands/             (26 command files, 7 categories)
    ├─ events/               (4 events: ready, messageCreate, guildMemberAdd/Remove)
    └─ util/                 (wrong-sort fuzzy matcher, msg-modder, input_time_parser, TwimgFetch)
```

**Hot paths:** `messageCreate` → prefix match → command lookup → `execute(message, args, client)` — every message hits this. `GuildMemberAdd/Remove` → welcome/bye repo → embed construction.

**Cold corners:** `.scripts/` (9 legacy utility scripts, ~3k LOC, syntax errors, unused), `scripts/migrate.js` (one-off, imports missing `mongoose`), `src/migrator.js` (legacy, unused), `src/util/wrong-sort/keyboard.json` (static data).

**Churn concentration (last 6 months):** `syncmsg.js`, `msg-handler.js`, `message_data.json`, `daily.js`, `banco.js`, `welcome*.js`, `bye*.js`, `userRepository.js`, `Supabase.js` — the migration + i18n sync are where active development lives.

---

## Findings Table

| ID | Category | File:Line | Severity | Effort | Description | Recommendation |
|----|----------|-----------|----------|--------|-------------|----------------|
| ARC-01 | Architectural decay | `src/config/msg-handler.js:24-38`, `src/commands/config/syncmsg.js` | Critical | S | Circular dep: `msg-handler` auto-triggers `syncmsg` via dynamic import when a key is missing. If `syncmsg` runs during a hot-path message (e.g. first use of a new key), it holds the event loop, rewrites command files, and may deadlock or cause inconsistent state. | Remove auto-sync from hot path. Make `syncmsg` CLI-only (owner command) or queue sync to a background tick. Add a circuit-breaker: if `syncAttempted` lock is held, return fallback string without triggering sync. |
| ARC-02 | Architectural decay | `src/commands/economy/daily.js:105-154` | Critical | M | Race condition: reads `user.cooldowns.daily` from stale in-memory object → writes `daily_streak` + `cooldowns` via `updateUser` (non-atomic) → calls `addXp` + `addBiscoins` RPCs. Two concurrent `daily` calls both pass the local check, both write streak+cooldown, both grant rewards. | Move cooldown check into atomic RPC (use existing `check_and_set_cooldown` which is atomic). Combine streak increment + cooldown set + reward grant into a single new PL/pgSQL RPC, or at minimum: call `checkCooldown` RPC first, then `addXp`/`addBiscoins` only on success. |
| ARC-03 | Architectural decay | `src/commands/welcome/welcome.js:55`, `src/commands/bye/bye.js:59` | Critical | S | Post-migration field-name mismatch: Supabase rows are snake_case (`chat_id`, `message_content`, `message_embed`, `enabled`); welcome/bye systems read `chatId`, `message_content` (mixed), `message_embed` → `guildConfig.chatId` is `undefined`, `welcomeChannel` lookup fails silently. | Normalize repo return shape to camelCase (add a mapper in repositories) OR update all consumers to use snake_case. Quick fix: `guildConfig.chat_id` in welcome.js:57, bye.js:61. |
| ARC-04 | Architectural decay | `src/commands/economy/pay.js:86-104` | High | M | Transfer is two independent RPCs: `removeBiscoins(sender)` then `addBiscoins(receiver)`. If second fails (network, constraint), sender loses money, receiver gets nothing — no rollback, no idempotency key. | Wrap in a new atomic PL/pgSQL function `transfer_biscoins(p_from_user, p_to_user, p_guild, p_amount, p_tax_rate)` that does both legs in one transaction. Return `{success, tax, net, newSenderWallet, newReceiverWallet}`. |
| ARC-05 | Architectural decay | `src/commands/economy/daily.js:114` | High | S | Uses local `user.cooldowns` object (may be stale) instead of the atomic `checkCooldown` RPC that already exists in `userRepository.js:111`. The RPC is never called by any command. | Delete the local cooldown logic in `daily.js`; call `await checkCooldown(userId, guildId, 'daily', COOLDOWN_MS)` and branch on `canUse`. |
| ARC-06 | Architectural decay | `src/commands/economy/daily.js:148-149` | Medium | S | Level-up notification uses wrong message key: `msg(\"daily.erro_daily\", ...)` — `erro_daily` means "error", but this is a success (level up). | Add a proper `daily.level_up` key in `message_data.json` and use it. |
| ARC-07 | Architectural decay | `src/infra/Supabase.js:10` | Medium | S | Reads `process.env.SUPABASE_SERVICE_ROLE_KEY` directly, bypassing `config` object from `env.js` — inconsistent config access pattern. | Use `config.db.serviceRoleKey` (add to `env.js` export) or at minimum import `config` and read `config.db.url` consistently. |
| ARC-08 | Architectural decay | `src/infra/logger/Logger.js:23` | Low | S | `CURRENT_LEVEL` captured at module load time; if `LOG_LEVEL` changes at runtime (e.g. via admin command), logger doesn't pick it up without restart. | Make `CURRENT_LEVEL` a getter or add `Logger.setLevel(level)` that recomputes. |
| ARC-09 | Architectural decay | `src/infra/DiscordClient.js:93-117` | Low | S | `usarIntencoesAgrupadas` flag is a no-op: both branches spread the same four arrays into `intents` (lines 102-107 vs 116). `criarClienteDiscord` just calls with `false`. `LISTA_DE_PARCIAIS` and `INTENCOES` exported for "compat" but unused. | Remove the flag and `criarClienteDiscord`; keep one `gerarClienteDiscord` with the flat array. Drop unused exports. |
| ARC-10 | Architectural decay | `src/app/BotState.js:48-52` | Low | S | `setError(err)` emits `'error'` and sets status to `'error'` but nothing in the codebase listens for `'error'` on `BotState` — dead code. | Remove `setError` or wire it up (e.g. in `heart.js` catch block). |
| CON-01 | Consistency rot | `src/commands/**/*.js` (32 `console.*` calls) vs `src/infra/logger/Logger.js` | Medium | S | 32 direct `console.log/error/warn` in commands; 0 `Logger` imports in commands. Two logging systems, inconsistent output, no structured context. | Replace all `console.*` in commands with `Logger.*` (already imported in some files). Add `Logger` to `infra/index.js` barrel. |
| CON-02 | Consistency rot | `src/config/config.js` (file-based JSON) vs `src/config/env.js` (env vars) | Low | M | Two config systems: `config.json` for prefixes/owners (file), `.env` for tokens/DB (env). No single source, no validation schema. | Unify: move prefixes/owners to `.env` with defaults in `env.js`, or adopt a config library (e.g. `conf`, `cosmiconfig`). |
| CON-03 | Consistency rot | `src/commands/welcome/welcome.js:70-71` vs `src/commands/bye/bye.js:70-77` | Low | S | Duplicate placeholder-replacement logic (`replaceTags`/`content.replace`) with slight differences (`{user_avatar_url}` vs `{user_id}` support). | Extract to `src/util/embed-placeholder.js` with a shared `replacePlaceholders(template, data)` function. |
| CON-04 | Consistency rot | `src/commands/welcome/setwelcome.js:157-168` vs `src/commands/bye/setbye.js:156-175` | Low | S | Duplicate `parseSheepTesterUrl` + `cleanNulls` (90% identical). `setbye` normalizes color to hex string; `setwelcome` keeps integer. | Extract to `src/util/sheep-tester.js` with single implementation. |
| CON-05 | Consistency rot | `src/commands/economy/depositar.js:38` / `sacar.js:38` / `banco.js:53` | Low | S | Each command calls `getUser` to read wallet/bank before `bankTransaction` — but `bankTransaction` RPC already returns `newWallet`/`newBank`. Extra round-trip. | Remove the pre-fetch `getUser` in `depositar`/`sacar`; trust RPC return. Keep in `banco` for the initial embed. |
| CON-06 | Consistency rot | `src/commands/info/help.js:23` | Low | S | Reads `command_data.json` from disk on every `help` invocation (synchronous `fs.readFileSync`). All other commands import it via `import ... with { type: 'json' }` (cached by Node). | Use the same static import pattern; or cache the parsed JSON in a module-level variable. |
| TYP-01 | Type & contract debt | (repo-wide) | Medium | L | No TypeScript, no JSDoc `@typedef` for RPC return shapes, no schema validation at Supabase boundary. `userRepository.js` assumes RPC returns `{user, leveled_up, new_level}` (snake_case) but maps to camelCase manually — drift risk. | Add JSDoc `@typedef` for each RPC return shape. Consider `zod` schemas for `supabase.rpc` responses. If migrating to TS, do it incrementally per module. |
| TYP-02 | Type & contract debt | `src/infra/database/repositories/userRepository.js:46, 100, 119` | Medium | S | Inconsistent RPC return mapping: `addXp` returns `{user, leveledUp, newLevel}` (camelCase mapped from snake_case), `checkCooldown` returns `{canUse, timeLeft?}` (camelCase from RPC), `bankTransaction` returns `{success, reason?, newWallet, newBank}` (camelCase from RPC). No single convention. | Standardize: all RPCs return snake_case from PG; repo maps to camelCase *once* in a helper `toCamel(obj)`; or make PG return camelCase via `jsonb_build_object` aliases. |
| TYP-03 | Type & contract debt | `src/config/msg-handler.js:67-75` | Low | S | `msg(path, vars)` returns `__missing__: ${path}` string on missing key — callers don't check for this sentinel, it leaks into user-facing messages. | Throw on missing key in dev (`NODE_ENV !== 'production'`), return fallback in prod. Add a `msgOrThrow` variant. |
| TST-01 | Test debt | (repo-wide) | Medium | L | Zero tests. No test runner configured (`npm test` is a no-op stub). Critical paths (economy RPCs, cooldown atomicity, syncmsg merge logic) have no verification. | Add `vitest` or `node --test` with `--test-concurrency=1`. Priority: `userRepository` RPC contracts, `syncmsg` merge logic, `wrong-sort` fuzzy matcher. |
| TST-02 | Test debt | `src/util/wrong-sort/index.js` | Low | M | Complex string-matching algorithm (4 algorithms combined) with no tests. Thresholds (`jW > 0.45`, `dLev <= 3`, `kDist < 2.5`) are magic numbers. | Add property-based tests for `findBestMatches` (known aliases → expected suggestions). Document threshold tuning. |
| DEP-01 | Dependency & config debt | `npm audit` | High | S | 6 vulnerabilities (4 high, 2 moderate) in `undici` (via `@discordjs/rest` → `discord.js`) and `ws`. | Run `npm audit fix` (may require `discord.js` upgrade). Pin `discord.js` to patched version. |
| DEP-02 | Dependency & config debt | `package.json:15`, `depcheck` | Low | S | `chalk@4.1.2` listed in `dependencies` but unused in all source (only in `.scripts/run.js` which is dead code). | `npm uninstall chalk` |
| DEP-03 | Dependency & config debt | `scripts/migrate.js`, `package.json` | High | S | `scripts/migrate.js` imports `mongoose` but it's not in `package.json` (removed in migration). Script will crash. | Add `mongoose` to `devDependencies` (script-only) or remove script if migration complete. |
| DEP-04 | Dependency & config debt | `src/config/env.js:31`, `.env` | Medium | S | `REQUIRED_VARS = ['BOT_TOKEN', 'SUPABASE_URL']` — `SUPABASE_SERVICE_ROLE_KEY` / `SUPABASE_ANON_KEY` not validated but required by `Supabase.js:10`. Bot starts, then `connectToSupabase` fails silently (returns `false`). | Add `SUPABASE_SERVICE_ROLE_KEY` to `REQUIRED_VARS` (or `SUPABASE_ANON_KEY` with warning). Fail fast at startup. |
| PER-01 | Performance & resource hygiene | `src/commands/util/store_chat.js:92-109` | Medium | M | Fetches messages in 100-message pages via `channel.messages.fetch({ after: lastId })` but `lastId` is set to `fetched.first().id` (newest in batch) — with `after`, this re-fetches the same newest message repeatedly. Loop terminates only when `fetched.size < 100`. | `lastId = fetched.last().id` (oldest in batch) when using `after`. Or use `before` with newest-first ordering. |
| PER-02 | Performance & resource hygiene | `src/commands/welcome/welcome.js:132-157`, `src/commands/bye/bye.js:131-138` | Low | S | Embed field processing uses `.map` + `replace` per field per event. Hot path (every join/leave). | Pre-compile embed template at config-save time (store processed embed with resolved placeholders as a separate column). |
| ERR-01 | Error handling & observability | `src/events/MessageCreate.js:27, 55, 64, 67` | Medium | S | Three nested `try/catch` blocks, each with `console.error` (not `Logger`). Outer catch swallows everything with `console.error('[CRITICAL]', ...)` — no alerting, no context. | Flatten to single `try/catch`; use `Logger.error` with structured context (`{command, userId, guildId, error}`). |
| ERR-02 | Error handling & observability | `src/commands/economy/daily.js:175-178` | Medium | S | Catches error, logs to `console.error`, replies with `msg(\"daily.mensagem_2\")` — but that key doesn't exist in `message_data.json` (only `erro_daily` exists). User sees `__missing__: daily.mensagem_2`. | Fix message key or add `mensagem_2` to JSON. |
| ERR-03 | Error handling & observability | `src/commands/config/syncmsg.js:317-323` | Low | S | Top-level `catch` logs error but replies with `msg("syncmsg.falha_critica", { err: error.message })` — if `error` is non-Error, `.message` is undefined. | `const msg = error instanceof Error ? error.message : String(error)`. |
| SEC-02 | Security hygiene | `src/commands/economy/pay.js:86-104` | Medium | M | Transfer has no idempotency key — user can double-click / retry and trigger double-spend (mitigated only by `removeBiscoins` atomic check, but receiver gets double credit). | Add `transfer_id` (UUID) generated client-side, passed to atomic RPC, stored in `transfers` table with unique constraint. |
| SEC-03 | Security hygiene | `src/commands/config/mkcmd.js:71-81` | Low | S | Template uses string `replace` for `{{NAME}}`, `{{CONFIG_DEPTH}}`, `{{DRAFT}}` — if draft contains `{{NAME}}`, it gets double-replaced. Not exploitable (owner-only) but fragile. | Use a real template engine (e.g. `eta`, `handlebars`) or unique delimiters unlikely to appear in drafts (`%%NAME%%`). |
| DOC-01 | Documentation drift | `docs/README.md:36, 45-52, 54-58` | Medium | S | README claims: entry point is `src/heart.js` (actually `index.js`), folders `commands/admin`, `commands/fun`, `commands/info`, `commands/util` (actual: `config`, `economy`, `welcome`, `bye`, `info`, `util`), `command_data.json` at `src/command_data.json` (actual: `src/config/command_data.json`), `util/CHANGELOG.md` (actual: `docs/CHANGELOG.md`). | Rewrite README to match actual structure. |
| DOC-02 | Documentation drift | `docs/mongodb-to-supabase.md:408` | Low | S | Shows `createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)` but actual `Supabase.js:12` uses `config.db.url` + `process.env` fallback. | Update doc to match implementation. |
| DOC-03 | Documentation drift | `docs/tree.txt` (entire file) | Low | S | Tree shows old Mongo structure (`database/connect.js`, `database/models/`, `handlers/`, `config/welcome_data.json`) — none of which exist. | Delete or regenerate. |

---

## Top 5 "If You Fix Nothing Else, Fix These"

### 1. Circular dependency: `msg-handler` ↔ `syncmsg`
**File:** `src/config/msg-handler.js:24-38`
```diff
-async function autoSyncMessages() {
-  if (syncAttempted.has('global_lock')) return;
-  syncAttempted.add('global_lock');
-  try {
-    console.log("🔄 [Auto-Sync] Chave ausente detectada. Acionando syncmsg...");
-    const syncModule = await import("../commands/config/syncmsg.js");
-    const syncmsg = syncModule.default;
-    await syncmsg.execute({ channel: { send: () => {} }, reply: () => {}, author: { id: "SYSTEM" } }, ["silent"], null);
-    messagesCache = null;
-    loadMessages();
-    console.log("✅ [Auto-Sync] Sincronização automática concluída.");
-  } catch (err) { ... }
-}
+// REMOVE autoSyncMessages entirely from msg-handler.
+// syncmsg should be invoked ONLY via owner command (..sync msg) or a background cron.
```
**Why:** Auto-sync on missing key during message processing can rewrite command files while the bot is handling messages — recipe for corruption and deadlocks.

### 2. Double-reward race in `daily.js`
**File:** `src/commands/economy/daily.js:105-154`
```diff
-// Current: local check → updateUser → addXp → addBiscoins
+// New: atomic RPC check-and-set
 const cooldown = await checkCooldown(userId, guildId, 'daily', COOLDOWN_MS);
 if (!cooldown.canUse) return replyCooldown(cooldown.timeLeft);
 
 // Single atomic RPC that does: streak++, set cooldown, grant XP, grant money
 const result = await claimDailyReward(userId, guildId); // new PL/pgSQL function
 if (result.leveledUp) await message.channel.send(msg("daily.level_up", { level: result.newLevel }));
 replySuccess(result);
```
**Why:** Users can exploit or accidentally trigger double daily rewards under load.

### 3. Broken welcome/bye (snake_case vs camelCase)
**Files:** `src/commands/welcome/welcome.js:55`, `src/commands/bye/bye.js:59`
```diff
-const welcomeChannel = guild.channels.cache.get(guildConfig.chatId);
+const welcomeChannel = guild.channels.cache.get(guildConfig.chat_id);
```
```diff
-const byeChannel = guild.channels.cache.get(guildConfig.chatId);
+const byeChannel = guild.channels.cache.get(guildConfig.chat_id);
```
**Why:** Entire welcome/bye system silently does nothing post-migration. 5-line fix restores it.

### 4. Non-atomic transfer in `pay.js`
**File:** `src/commands/economy/pay.js:86-104`
```sql
-- New PL/pgSQL function (add to supabase-schema.sql)
CREATE OR REPLACE FUNCTION transfer_biscoins(
    p_from_user TEXT, p_to_user TEXT, p_guild_id TEXT, 
    p_amount BIGINT, p_tax_rate NUMERIC DEFAULT 0.03
) RETURNS JSONB AS $$
DECLARE
    v_tax BIGINT; v_net BIGINT; v_from_wallet BIGINT; v_to_wallet BIGINT;
BEGIN
    -- atomic: check sender balance, deduct, credit receiver, apply tax, all in one tx
    -- return {success, tax, net, newFromWallet, newToWallet}
END;
$$ LANGUAGE plpgsql;
```
```js
// pay.js
const result = await transferBiscoins(sender.id, target.id, guildId, amount);
if (!result.success) return replyInsufficient();
replyReceipt(result);
```
**Why:** Money can vanish on partial failure. Atomic RPC eliminates the race.

### 5. `mongoose` faltando em deps
**Files:** `scripts/migrate.js`, `package.json`
```bash
# 1. npm install --save-dev mongoose  # for migrate script
# 2. Add SUPABASE_SERVICE_ROLE_KEY to REQUIRED_VARS in env.js
```

---

## Quick Wins (Low Effort × Medium+ Severity)

- [ ] **ARC-03** — Fix `chatId` → `chat_id` in `welcome.js:57` and `bye.js:61` (2 lines)
- [ ] **ARC-05** — Use existing `checkCooldown` RPC in `daily.js` instead of local check (5 lines)
- [ ] **ARC-06** — Add `daily.level_up` message key, fix `erro_daily` misuse (2 lines)
- [ ] **ARC-07** — Use `config.db.url` consistently in `Supabase.js:10` (1 line)
- [ ] **ARC-09** — Remove dead `usarIntencoesAgrupadas` flag and `criarClienteDiscord` (15 lines)
- [ ] **ARC-10** — Remove unused `setError` from `BotState.js` (5 lines)
- [ ] **CON-01** — Replace 32 `console.*` with `Logger.*` in commands (sed + review)
- [ ] **CON-06** — Cache `command_data.json` in `help.js` (3 lines)
- [ ] **DEP-02** — `npm uninstall chalk`
- [ ] **DEP-03** — `npm install --save-dev mongoose` (or delete `scripts/migrate.js` if done)
- [ ] **DEP-04** — Add `SUPABASE_SERVICE_ROLE_KEY` to `REQUIRED_VARS` in `env.js:31`
- [ ] **DOC-01** — Update README to match actual structure
- [ ] **TYP-02** — Standardize RPC return mapping in `userRepository.js` (helper function)
- [ ] **ERR-02** — Fix missing `daily.mensagem_2` key or use existing `erro_daily`

---

## Things That Look Bad But Are Actually Fine

| Pattern | File | Why It's Fine |
|---------|------|---------------|
| `@register-messages` blocks in every command file | `src/commands/**/*.js` | Custom doc-generation + sync system. Not dead code — `syncmsg.js` parses these to build `message_data.json`. The fragmentation (`@` + `register` + `-messages`) is deliberate to avoid self-matching during sync. |
| `with { type: 'json' }` imports | `src/commands/**/*.js` | Standard ESM JSON import (Node 17.5+). Works in Termux Node 26. No bundler needed. |
| `config.json` + `.env` dual config | `src/config/config.js`, `src/config/env.js` | Intentional separation: `config.json` = user-mutable runtime config (prefixes, owners); `.env` = secrets. `config.js` provides atomic file writes. |
| `ownerOnly: true` in command `data` but no central enforcement | `src/commands/config/*.js` | `CommandLoader` doesn't enforce it — but `mkcmd`, `sync`, `synccat`, `syncmsg` all manually check `getOwners()` at runtime (lines 30, 17, 17, 143). Consistent pattern, just not centralized. |
| `BotState` extends `EventEmitter` but only emits `statusChange`/`error` | `src/app/BotState.js` | Minimal singleton for cross-module state (client, status, uptime). `EventEmitter` is lightweight; no need for a full state machine. |
| `wrong-sort` uses 4 string algorithms combined | `src/util/wrong-sort/index.js` | Over-engineered but effective for fuzzy command suggestions. No bugs found; thresholds tuned empirically. |
| `input_time_parser.js` 161 lines of regex rules | `src/util/input_time_parser.js` | Comprehensive Portuguese natural-language date/time parser. No external dependency. Works for the bot's use case. |
| `.scripts/` directory full of broken scripts | `.scripts/*.js` | Gitignored? No — but they're in `.scripts/` (not `scripts/`), appear to be personal scratchpad. Not loaded by app. Can be deleted but not "debt" in the running codebase. |
| `msg-handler` returns `__missing__: path` sentinel | `src/config/msg-handler.js:72` | Deliberate: triggers auto-sync (flawed, see ARC-01) but also makes missing keys visible in chat for debugging. |
| `sync_snapshot.json` 3-way merge state | `src/config/sync_snapshot.json` | Necessary for `syncmsg` to detect renames vs deletions vs edits. Not redundant. |
| `mkcmd` uses `cmd-template.txt` with `{{PLACEHOLDERS}}` | `src/commands/config/mkcmd.js:57-69`, `src/commands/config/cmd-template.txt` | Legitimate code-generation for owner convenience. Template is simple enough that string replace is acceptable. |

---

## Open Questions for the Maintainer

1. **Migration completeness**: Is `scripts/migrate.js` still needed? It imports `mongoose` (missing from deps) and references deleted Mongo models. If migration is done, delete it. If not, add `mongoose` to `devDependencies` and verify it works against current Supabase schema.

2. **`migrator.js` purpose**: `src/migrator.js` (310 lines) is not imported anywhere. Is it a legacy migration tool? Should it be removed?

3. **`welcome_data.json` and `message_mod.yaml`**: Referenced in old docs but not found in current tree. Were they replaced by `message_data.json`? Confirm no stale reads.

4. **RPC return shapes**: The PL/pgSQL functions return snake_case (`leveled_up`, `new_level`, `new_balance`, `canUse`, `timeLeft`). `userRepository.js` manually maps some to camelCase, others not. Is this intentional (PG convention) or should the RPCs return camelCase directly?

5. **`chalk` in `.scripts/run.js`**: Only usage is in a dead script. Confirm safe to `npm uninstall chalk`.

6. **`SUPABASE_ANON_KEY` vs `SERVICE_ROLE_KEY`**: `Supabase.js:10` prefers `SERVICE_ROLE_KEY` (bypasses RLS). Is RLS enabled on tables? If yes, service role is correct for backend. If no, anon key is fine. Document the choice.

7. **`BotState` error event**: `setError` emits `'error'` but nothing listens. Was there a plan for global error handling (e.g. graceful shutdown, alerting)?

8. **`input_time_parser.js` export**: Default export is `async function parseInputTime` but `store_chat.js:8` imports it as `import parseInputTime from ...` (default) — works, but the function is `async` while it does no I/O. Why async?

9. **Command `data.ownerOnly` vs manual `getOwners()` check**: Some commands declare `ownerOnly: true` in `data`, others don't but check manually. No loader enforcement. Want a centralized guard in `CommandLoader` or keep manual?

10. **`.scripts/` cleanup**: 9 files, ~3k LOC, syntax errors (pipeline operator, invalid tokens). Safe to `rm -rf .scripts/`?

---

## Appendix: Tooling Output Summaries

### `npm audit` (production deps only)
```
6 vulnerabilities (2 moderate, 4 high)
- undici (via @discordjs/rest → discord.js): memory disclosure, DoS
- ws: uninitialized memory disclosure, memory exhaustion DoS
fix available via `npm audit fix`
```

### `depcheck`
```
Unused dependencies: chalk
Missing dependencies: mongoose (in scripts/migrate.js)
Using: discord.js, @supabase/supabase-js, dotenv, js-yaml, nodemon (dev)
Invalid files (syntax errors): .scripts/backup.js, .scripts/btree.js, .scripts/finder.js, .scripts/finderr.js, .scripts/fnd.js, .scripts/mkcmd.js, .scripts/run.js
```

### `madge --circular` (not run — no TS/CommonJS entry)
Skipped: pure ESM, no `madge` support without config.

### Largest files (LOC)
1. `.scripts/blessed.json` (2084) — dead
2. `package-lock.json` (910)
3. `docs/mongodb-to-supabase.md` (527)
4. `src/commands/config/syncmsg.js` (338) — **active, complex**
5. `src/migrator.js` (310) — unused?
6. `src/commands/config/editcmdmsg.js` (304)
7. `src/config/command_data.json` (296)
8. `src/commands/util/store_chat.js` (225)
9. `src/config/sync_snapshot.json` (222)
10. `src/commands/welcome/setwelcome.js` (221)

### Most-churned files (last 6 months, by git)
1. `src/commands/config/syncmsg.js`
2. `src/config/msg-handler.js`
3. `src/config/message_data.json`
4. `src/commands/economy/daily.js`
5. `src/commands/economy/banco.js`
6. `src/commands/welcome/*.js` (4 files)
7. `src/commands/bye/*.js` (4 files)
8. `src/infra/database/repositories/userRepository.js`
9. `src/infra/Supabase.js`
10. `src/infra/DiscordClient.js`

---

*End of audit.*