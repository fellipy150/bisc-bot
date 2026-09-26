# Análise de Uso do MongoDB e Plano de Migração para Supabase

## Visão Geral

O **bisc-bot** utiliza **MongoDB + Mongoose** como camada de persistência principal. O projeto está estruturado com uma arquitetura em camadas (models → services → commands/events) que facilita a migração.

---

## 1. Estrutura Atual do MongoDB

### 1.1 Dependências (`package.json`)
```json
"dependencies": {
  "mongodb": "^6.16.0",
  "mongoose": "^8.14.1"
}
```

### 1.2 Conexão e Configuração
- **Arquivo**: `src/infra/MongoDB.js`
- **Config**: `src/config/env.js` → `config.db.uri` (env `MONGODB_URI`)
- **Opção**: `family: 4` (força IPv4 para evitar timeouts DNS SRV no Termux)

### 1.3 Models (Schema Mongoose)

| Model | Arquivo | Coleção | Índices |
|-------|---------|---------|---------|
| **User** | `src/infra/database/models/userModel.js` | `users` | `{ userId: 1, guildId: 1 }` único |
| **Welcome** | `src/infra/database/models/welcomeModel.js` | `welcomes` | `{ guildId: 1 }` único |
| **Bye** | `src/infra/database/models/byeModel.js` | `byes` | `{ guildId: 1 }` único |

#### User Schema (documento rico, ~40 campos)
- **Identidade**: `userId`, `guildId` (chave composta)
- **Economia**: `wallet`, `bank` (Number, min: 0)
- **Leveling**: `xp`, `level` (fórmula: `level * 500 XP`)
- **Estatísticas**: `dailyStreak`
- **Perfil Social**: `profile.bio`, `profile.background`, `profile.badges[]`
- **Cooldowns**: objeto aninhado `{ daily, work, crime, rob: Date }`
- **Inventário**: array de objetos `{ itemId, name, amount, equipped }`

#### Welcome/Bye Schema (configuração por servidor)
- `guildId` (único)
- `chatId` (canal)
- `message`: objeto complexo com `content` + `embed` completo (title, url, description, color, fields[], image, thumbnail, footer, author, timestamp)
- `enabled` (Boolean)
- `timestamps: true`

### 1.4 Services (Camada de Acesso a Dados)
| Service | Métodos Principais |
|---------|-------------------|
| **userService** | `getUser`, `addXp`, `addBiscoins`, `removeBiscoins`, `updateUser`, `bankTransaction`, `checkCooldown`, `setCooldown` |
| **welcomeService** | `getGuildWelcome`, `setGuildWelcome` (upsert), `removeGuildWelcome`, `hasWelcomeConfig` |
| **byeService** | `getGuildBye`, `setGuildBye` (upsert), `removeGuildBye` |

### 1.5 Consumidores (Commands + Events)

#### Economy Commands
- `daily.js` — usa `getUser`, manipula `cooldowns.daily`, `dailyStreak`, `xp`, `wallet`, `level` → `user.save()`
- `pay.js` — `removeBiscoins` + `addBiscoins` (transferência com taxa 3%)
- `banco.js`, `depositar.js`, `sacar.js` — `bankTransaction`
- `carteira.js`, `perfil.js` — `getUser` (leitura)

#### Welcome/Bye Commands
- `welcome.js` (evento `GuildMemberAdd`) — `WelcomeService.getGuildWelcome` → renderiza EmbedBuilder
- `setwelcome`, `viewwelcome`, `removewelcome` — CRUD via WelcomeService
- `bye.js`, `setbye`, `viewbye`, `removebye` — CRUD via ByeService

#### Events
- `MessageCreate.js` — `addXp` a cada mensagem (15-25 XP aleatório)
- `GuildMemberAdd.js` — `welcomeSystem.handleNewMember`

---

## 2. Mapeamento MongoDB → Supabase (PostgreSQL)

### 2.1 Estratégia de Mapeamento

| Conceito MongoDB | Supabase/PostgreSQL |
|------------------|---------------------|
| Database | Database (mesmo) |
| Collection | Table |
| Document | Row |
| `_id` (ObjectId) | `id` UUID (PK) ou `BIGSERIAL` |
| Embedded document | JSONB column ou tabela separada (FK) |
| Array de objetos | JSONB ou tabela 1:N |
| Índice único composto | `UNIQUE (user_id, guild_id)` |
| `timestamps: true` | `created_at`, `updated_at` com `DEFAULT now()` |

### 2.2 Esquema Proposto (SQL)

```sql
-- Habilitar extensão UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Tabela users (principal)
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id TEXT NOT NULL,
    guild_id TEXT NOT NULL,
    wallet BIGINT DEFAULT 0 CHECK (wallet >= 0),
    bank BIGINT DEFAULT 0 CHECK (bank >= 0),
    xp BIGINT DEFAULT 0,
    level INTEGER DEFAULT 1 CHECK (level >= 1),
    daily_streak INTEGER DEFAULT 0,
    profile_bio TEXT DEFAULT 'Olá! Sou novo por aqui.',
    profile_background TEXT DEFAULT 'default_bg.png',
    profile_badges TEXT[] DEFAULT '{}',
    cooldowns JSONB DEFAULT '{}'::jsonb,
    inventory JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE (user_id, guild_id)
);

-- Índices para queries comuns
CREATE INDEX idx_users_guild ON users (guild_id);
CREATE INDEX idx_users_level ON users (guild_id, level DESC);

-- Tabela welcomes (config por servidor)
CREATE TABLE welcomes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    guild_id TEXT NOT NULL UNIQUE,
    chat_id TEXT NOT NULL,
    message_content TEXT,
    message_embed JSONB, -- embed completo serializado
    enabled BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Tabela byes (config por servidor)
CREATE TABLE byes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    guild_id TEXT NOT NULL UNIQUE,
    chat_id TEXT NOT NULL,
    message_content TEXT,
    message_embed JSONB,
    enabled BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Trigger para updated_at automático
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_welcomes_updated_at BEFORE UPDATE ON welcomes
    FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_byes_updated_at BEFORE UPDATE ON byes
    FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
```

---

## 3. Plano de Migração (Fases)

### Fase 1: Preparação e Setup
- [ ] Adicionar `@supabase/supabase-js` e remover `mongoose`, `mongodb`
- [ ] Criar `src/infra/supabase.js` (cliente + helpers de conexão)
- [ ] Configurar variáveis de ambiente: `SUPABASE_URL`, `SUPABASE_ANON_KEY` (ou `SERVICE_ROLE_KEY` para backend)
- [ ] Executar migração SQL no Supabase Dashboard ou via CLI

### Fase 2: Repository Layer (Substitui Models + Services)
Criar pasta `src/infra/database/repositories/` com API idêntica aos services atuais:

```js
// src/infra/database/repositories/userRepository.js
import { supabase } from '../supabase.js';

export const userRepo = {
  async getUser(userId, guildId) {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('user_id', userId)
      .eq('guild_id', guildId)
      .single();
    if (error && error.code !== 'PGRST116') throw error; // PGRST116 = not found
    return data;
  },

  async ensureUser(userId, guildId) {
    let user = await this.getUser(userId, guildId);
    if (!user) {
      const { data, error } = await supabase
        .from('users')
        .insert({ user_id: userId, guild_id: guildId })
        .select()
        .single();
      if (error) throw error;
      user = data;
    }
    return user;
  },

  async updateUser(userId, guildId, updates) {
    const { data, error } = await supabase
      .from('users')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('user_id', userId)
      .eq('guild_id', guildId)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  // Operações atômicas para economia (evitam race conditions)
  async addBiscoins(userId, guildId, amount, dest = 'wallet') {
    const col = dest === 'bank' ? 'bank' : 'wallet';
    const { data, error } = await supabase.rpc('increment_field', {
      p_user_id: userId,
      p_guild_id: guildId,
      p_field: col,
      p_amount: amount
    });
    if (error) throw error;
    return data;
  },

  async removeBiscoins(userId, guildId, amount, src = 'wallet') {
    const col = src === 'bank' ? 'bank' : 'wallet';
    const { data, error } = await supabase.rpc('decrement_field_safe', {
      p_user_id: userId,
      p_guild_id: guildId,
      p_field: col,
      p_amount: amount
    });
    if (error) throw error;
    return data; // { success: boolean, new_balance: number }
  },

  // XP + Level atomico
  async addXp(userId, guildId, amount) {
    const { data, error } = await supabase.rpc('add_xp_and_check_level', {
      p_user_id: userId,
      p_guild_id: guildId,
      p_xp_amount: amount
    });
    if (error) throw error;
    return data; // { user, leveled_up: boolean, new_level: number }
  }
};
```

> **Dica**: Use **PostgreSQL Functions (RPC)** para operações atômicas (economia, XP, cooldowns). Evita race conditions e reduz round-trips.

### Fase 3: Database Functions (SQL para operações críticas)

```sql
-- Incremento atômico seguro
CREATE OR REPLACE FUNCTION increment_field(
    p_user_id TEXT, p_guild_id TEXT, p_field TEXT, p_amount BIGINT
) RETURNS JSONB AS $$
DECLARE
    v_new_val BIGINT;
BEGIN
    EXECUTE format('UPDATE users SET %I = %I + $1, updated_at = now()
                    WHERE user_id = $2 AND guild_id = $3
                    RETURNING %I', p_field, p_field, p_field)
    USING p_amount, p_user_id, p_guild_id
    INTO v_new_val;
    RETURN jsonb_build_object('success', true, 'new_balance', v_new_val);
END;
$$ LANGUAGE plpgsql;

-- Decremento com verificação de saldo
CREATE OR REPLACE FUNCTION decrement_field_safe(
    p_user_id TEXT, p_guild_id TEXT, p_field TEXT, p_amount BIGINT
) RETURNS JSONB AS $$
DECLARE
    v_current BIGINT;
    v_new_val BIGINT;
BEGIN
    EXECUTE format('SELECT %I FROM users WHERE user_id = $1 AND guild_id = $2', p_field)
    USING p_user_id, p_guild_id
    INTO v_current;

    IF v_current < p_amount THEN
        RETURN jsonb_build_object('success', false, 'balance', v_current);
    END IF;

    EXECUTE format('UPDATE users SET %I = %I - $1, updated_at = now()
                    WHERE user_id = $2 AND guild_id = $3
                    RETURNING %I', p_field, p_field, p_field)
    USING p_amount, p_user_id, p_guild_id
    INTO v_new_val;

    RETURN jsonb_build_object('success', true, 'new_balance', v_new_val);
END;
$$ LANGUAGE plpgsql;

-- XP + Level up atômico
CREATE OR REPLACE FUNCTION add_xp_and_check_level(
    p_user_id TEXT, p_guild_id TEXT, p_xp_amount BIGINT
) RETURNS JSONB AS $$
DECLARE
    v_user users%ROWTYPE;
    v_next_xp BIGINT;
    v_leveled_up BOOLEAN := false;
    v_new_level INTEGER;
BEGIN
    SELECT * INTO v_user FROM users WHERE user_id = p_user_id AND guild_id = p_guild_id;
    
    IF NOT FOUND THEN
        INSERT INTO users (user_id, guild_id, xp) VALUES (p_user_id, p_guild_id, p_xp_amount)
        RETURNING * INTO v_user;
        RETURN jsonb_build_object('user', to_jsonb(v_user), 'leveled_up', false, 'new_level', 1);
    END IF;

    v_user.xp := v_user.xp + p_xp_amount;
    v_next_xp := v_user.level * 500;

    IF v_user.xp >= v_next_xp THEN
        v_user.level := v_user.level + 1;
        v_user.xp := v_user.xp - v_next_xp;
        v_leveled_up := true;
        v_new_level := v_user.level;
    END IF;

    UPDATE users SET xp = v_user.xp, level = v_user.level, updated_at = now()
    WHERE user_id = p_user_id AND guild_id = p_guild_id;

    RETURN jsonb_build_object('user', to_jsonb(v_user), 'leveled_up', v_leveled_up, 'new_level', v_new_level);
END;
$$ LANGUAGE plpgsql;
```

### Fase 4: Welcome/Bye Repositories

```js
// src/infra/database/repositories/welcomeRepository.js
import { supabase } from '../supabase.js';

export const welcomeRepo = {
  async getGuildWelcome(guildId) {
    const { data, error } = await supabase
      .from('welcomes')
      .select('*')
      .eq('guild_id', guildId)
      .single();
    if (error && error.code !== 'PGRST116') throw error;
    return data;
  },

  async setGuildWelcome(guildId, chatId, messageEmbed) {
    const { data, error } = await supabase
      .from('welcomes')
      .upsert({
        guild_id: guildId,
        chat_id: chatId,
        message_embed: messageEmbed,
        updated_at: new Date().toISOString()
      }, { onConflict: 'guild_id' })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async removeGuildWelcome(guildId) {
    const { data, error } = await supabase
      .from('welcomes')
      .delete()
      .eq('guild_id', guildId)
      .select()
      .single();
    if (error && error.code !== 'PGRST116') throw error;
    return data;
  },

  async hasWelcomeConfig(guildId) {
    const { count, error } = await supabase
      .from('welcomes')
      .select('*', { count: 'exact', head: true })
      .eq('guild_id', guildId);
    if (error) throw error;
    return count > 0;
  }
};
```

### Fase 5: Atualizar Consumers (Commands + Events)

| Arquivo | Mudança |
|---------|---------|
| `src/commands/economy/daily.js` | Substituir manipulação direta do doc Mongoose por chamadas ao `userRepo` + RPC `add_xp_and_check_level` |
| `src/commands/economy/pay.js` | Usar `removeBiscoins` + `addBiscoins` (RPC atômico) |
| `src/commands/economy/banco.js` | Nova RPC `transfer_between_wallet_bank` |
| `src/events/MessageCreate.js` | `addXp` via RPC |
| `src/commands/welcome/welcome.js` | `welcomeRepo.getGuildWelcome` (mesma interface) |
| `src/infra/database/services/*.js` | **Remover** — substituídos pelos repositories |

### Fase 6: Migração de Dados (One-time)

```js
// scripts/migrate-mongo-to-supabase.js
import mongoose from 'mongoose';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function migrate() {
  await mongoose.connect(process.env.MONGODB_URI);
  
  // Users
  const users = await mongoose.connection.db.collection('users').find().toArray();
  for (const u of users) {
    await supabase.from('users').upsert({
      user_id: u.userId,
      guild_id: u.guildId,
      wallet: u.wallet ?? 0,
      bank: u.bank ?? 0,
      xp: u.xp ?? 0,
      level: u.level ?? 1,
      daily_streak: u.dailyStreak ?? 0,
      profile_bio: u.profile?.bio ?? 'Olá! Sou novo por aqui.',
      profile_background: u.profile?.background ?? 'default_bg.png',
      profile_badges: u.profile?.badges ?? [],
      cooldowns: u.cooldowns ?? {},
      inventory: u.inventory ?? [],
      created_at: u.createdAt ?? new Date().toISOString()
    }, { onConflict: 'user_id,guild_id' });
  }

  // Welcomes
  const welcomes = await mongoose.connection.db.collection('welcomes').find().toArray();
  for (const w of welcomes) {
    await supabase.from('welcomes').upsert({
      guild_id: w.guildId,
      chat_id: w.chatId,
      message_content: w.message?.content ?? null,
      message_embed: w.message?.embed ?? null,
      enabled: w.enabled ?? true
    }, { onConflict: 'guild_id' });
  }

  // Byes (mesmo padrão)
  // ...
  
  console.log('Migração concluída');
  process.exit(0);
}

migrate().catch(console.error);
```

### Fase 7: Limpeza e Validação
- [ ] Remover `mongoose`, `mongodb` do `package.json`
- [ ] Remover pasta `src/infra/database/models/`
- [ ] Remover pasta `src/infra/database/services/`
- [ ] Remover `src/infra/MongoDB.js`
- [ ] Atualizar `src/infra/index.js` → exportar `connectToSupabase` + repositories
- [ ] Testes de integração (economy, welcome, bye, leveling)
- [ ] Atualizar `.env.example` com variáveis Supabase

---

## 4. Riscos e Mitigações

| Risco | Impacto | Mitigação |
|-------|---------|-----------|
| Race condition em economia (transferências simultâneas) | Perda/duplicação de moedas | **RPC atômicas** no Postgres (Fase 3) |
| Diff de schema (embedded docs vs JSONB) | Queries complexas no embed | Manter `message_embed` como JSONB; acessar via `->>` no SQL |
| Cooldowns aninhados (`user.cooldowns.daily`) | Mudança de API | JSONB `cooldowns` mantém mesma estrutura; `userRepo.setCooldown` faz `jsonb_set` |
| Migração de dados existente | Downtime / perda | Script one-time (Fase 6) + backup; testar em staging primeiro |
| Latência Supabase (edge) vs MongoDB local | Latência extra | Supabase tem Pooler (PgBouncer); usar `supabase-js` com `fetch` nativo; conexão persistente |

---

## 5. Estimativa de Esforço

| Fase | Arquivos Afetados | Esforço |
|------|-------------------|---------|
| 1. Setup | `package.json`, `env.js`, novo `supabase.js` | ~2h |
| 2. Repositories (User) | 1 arquivo novo + RPCs SQL | ~4h |
| 3. Repositories (Welcome/Bye) | 2 arquivos novos | ~2h |
| 4. Update Consumers | ~15 command/event files | ~6h |
| 5. Migration Script | 1 script | ~2h |
| 6. Cleanup + Testes | Remoção legacy + validação | ~3h |
| **Total** | | **~19h** |

---

## 6. Benefícios Pós-Migração

1. **Custo**: Supabase Free Tier (500MB, 2GB bandwidth) vs MongoDB Atlas M0 (512MB, shared CPU)
2. **SQL Nativo**: Joins, transações ACID, constraints, triggers
3. **Real-time**: Supabase Realtime para eventos (ex: leaderboard ao vivo)
4. **Auth Integrado**: Futuro painel web/admin com Supabase Auth
5. **TypeScript**: Tipos gerados automaticamente (`supabase gen types`)
6. **Observabilidade**: Logs SQL, métricas, explain analyze no Dashboard

---

## 7. Decisão: Prisma vs supabase-js Direto

| Critério | Prisma ORM | supabase-js (Recomendado) |
|----------|------------|---------------------------|
| Bundle size | +1.5MB | ~200KB |
| Type safety | Excelente | Boa (com `supabase gen types`) |
| SQL bruto | Via `$queryRaw` | Nativo (`.rpc()`, `.select()`) |
| Edge/Serverless | Requer Data Proxy | Nativo (fetch) |
| Migração schema | `prisma migrate` | SQL manual ou Supabase CLI |
| Curva de aprendizado | Média | Baixa (API REST-like) |

> **Recomendação**: **supabase-js direto** — o projeto já usa padrão Repository (services), a API do Supabase mapeia 1:1, e evita abstração extra no Termux/Node.js.

---

## 8. Próximos Passos Imediatos

1. Criar projeto no Supabase → anotar `SUPABASE_URL`, `SUPABASE_ANON_KEY`
2. Executar SQL da **Seção 2.2** no SQL Editor do Supabase
3. Criar `src/infra/supabase.js` com cliente tipado
4. Implementar `userRepo` com RPCs de economia/XP (Fases 2-3)
5. Testar `daily.js` e `pay.js` ponta-a-ponta

---

*Documento gerado em $(date -Iseconds) — baseado na análise do código em `src/infra/database/`, `src/commands/economy/`, `src/commands/welcome/`, `src/events/`.*