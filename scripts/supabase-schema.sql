-- ============================================================
-- bisc-bot: Schema Supabase (PostgreSQL)
-- Migração MongoDB -> Supabase (docs/mongodb-to-supabase.md)
-- Executar no SQL Editor do Supabase Dashboard (Fase 1)
-- ============================================================

-- Habilitar extensão UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- TABELA: users (principal — documento User completo)
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
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

CREATE INDEX IF NOT EXISTS idx_users_guild ON users (guild_id);
CREATE INDEX IF NOT EXISTS idx_users_level ON users (guild_id, level DESC);

-- ============================================================
-- TABELA: welcomes (config de boas-vindas por servidor)
-- ============================================================
CREATE TABLE IF NOT EXISTS welcomes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    guild_id TEXT NOT NULL UNIQUE,
    chat_id TEXT NOT NULL,
    message_content TEXT,
    message_embed JSONB,
    enabled BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- TABELA: byes (config de adeus por servidor)
-- ============================================================
CREATE TABLE IF NOT EXISTS byes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    guild_id TEXT NOT NULL UNIQUE,
    chat_id TEXT NOT NULL,
    message_content TEXT,
    message_embed JSONB,
    enabled BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- TRIGGER: updated_at automático
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

DROP TRIGGER IF EXISTS update_welcomes_updated_at ON welcomes;
CREATE TRIGGER update_welcomes_updated_at BEFORE UPDATE ON welcomes
    FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

DROP TRIGGER IF EXISTS update_byes_updated_at ON byes;
CREATE TRIGGER update_byes_updated_at BEFORE UPDATE ON byes
    FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- ============================================================
-- RPC: operações atômicas de economia (evita race conditions)
-- ============================================================

-- Incremento atômico (wallet ou bank)
CREATE OR REPLACE FUNCTION increment_field(
    p_user_id TEXT, p_guild_id TEXT, p_field TEXT, p_amount BIGINT
) RETURNS JSONB AS $$
DECLARE
    v_new_val BIGINT;
BEGIN
    IF p_field NOT IN ('wallet', 'bank') THEN
        RETURN jsonb_build_object('success', false, 'reason', 'campo invalido');
    END IF;

    -- Garante que o usuário existe (upsert)
    INSERT INTO users (user_id, guild_id) VALUES (p_user_id, p_guild_id)
    ON CONFLICT (user_id, guild_id) DO NOTHING;

    EXECUTE format('UPDATE users SET %I = %I + $1
                    WHERE user_id = $2 AND guild_id = $3
                    RETURNING %I', p_field, p_field, p_field)
    USING p_amount, p_user_id, p_guild_id
    INTO v_new_val;

    RETURN jsonb_build_object('success', true, 'new_balance', v_new_val);
END;
$$ LANGUAGE plpgsql;

-- Decremento atômico com verificação de saldo
CREATE OR REPLACE FUNCTION decrement_field_safe(
    p_user_id TEXT, p_guild_id TEXT, p_field TEXT, p_amount BIGINT
) RETURNS JSONB AS $$
DECLARE
    v_new_val BIGINT;
    v_updated INTEGER;
BEGIN
    IF p_field NOT IN ('wallet', 'bank') THEN
        RETURN jsonb_build_object('success', false, 'reason', 'campo invalido');
    END IF;

    INSERT INTO users (user_id, guild_id) VALUES (p_user_id, p_guild_id)
    ON CONFLICT (user_id, guild_id) DO NOTHING;

    EXECUTE format('UPDATE users SET %I = %I - $1
                    WHERE user_id = $2 AND guild_id = $3 AND %I >= $1
                    RETURNING %I', p_field, p_field, p_field, p_field)
    USING p_amount, p_user_id, p_guild_id
    INTO v_new_val;

    GET DIAGNOSTICS v_updated = ROW_COUNT;
    IF v_updated = 0 THEN
        RETURN jsonb_build_object('success', false, 'reason', 'saldo insuficiente');
    END IF;

    RETURN jsonb_build_object('success', true, 'new_balance', v_new_val);
END;
$$ LANGUAGE plpgsql;

-- XP + Level up atômico (fórmula: level * 500)
CREATE OR REPLACE FUNCTION add_xp_and_check_level(
    p_user_id TEXT, p_guild_id TEXT, p_xp_amount BIGINT
) RETURNS JSONB AS $$
DECLARE
    v_user users%ROWTYPE;
    v_next_xp BIGINT;
    v_leveled_up BOOLEAN := false;
    v_new_level INTEGER;
BEGIN
    -- Garante que o usuário existe (upsert)
    INSERT INTO users (user_id, guild_id) VALUES (p_user_id, p_guild_id)
    ON CONFLICT (user_id, guild_id) DO NOTHING;

    SELECT * INTO v_user FROM users WHERE user_id = p_user_id AND guild_id = p_guild_id;

    v_user.xp := v_user.xp + p_xp_amount;
    v_next_xp := v_user.level * 500;

    IF v_user.xp >= v_next_xp THEN
        v_user.level := v_user.level + 1;
        v_user.xp := v_user.xp - v_next_xp;
        v_leveled_up := true;
    END IF;
    v_new_level := v_user.level;

    UPDATE users SET xp = v_user.xp, level = v_user.level
    WHERE user_id = p_user_id AND guild_id = p_guild_id;

    RETURN jsonb_build_object('user', to_jsonb(v_user), 'leveled_up', v_leveled_up, 'new_level', v_new_level);
END;
$$ LANGUAGE plpgsql;

-- Transferência atômica entre wallet e bank (deposit/withdraw)
CREATE OR REPLACE FUNCTION transfer_between_wallet_bank(
    p_user_id TEXT, p_guild_id TEXT, p_amount BIGINT, p_type TEXT
) RETURNS JSONB AS $$
DECLARE
    v_wallet BIGINT;
    v_bank BIGINT;
    v_updated INTEGER;
BEGIN
    IF p_type NOT IN ('deposit', 'withdraw') THEN
        RETURN jsonb_build_object('success', false, 'reason', 'tipo invalido');
    END IF;

    INSERT INTO users (user_id, guild_id) VALUES (p_user_id, p_guild_id)
    ON CONFLICT (user_id, guild_id) DO NOTHING;

    IF p_type = 'deposit' THEN
        UPDATE users SET wallet = wallet - p_amount, bank = bank + p_amount
        WHERE user_id = p_user_id AND guild_id = p_guild_id AND wallet >= p_amount;
    ELSE
        UPDATE users SET bank = bank - p_amount, wallet = wallet + p_amount
        WHERE user_id = p_user_id AND guild_id = p_guild_id AND bank >= p_amount;
    END IF;

    GET DIAGNOSTICS v_updated = ROW_COUNT;
    IF v_updated = 0 THEN
        RETURN jsonb_build_object('success', false, 'reason', 'saldo insuficiente');
    END IF;

    SELECT wallet, bank INTO v_wallet, v_bank FROM users
    WHERE user_id = p_user_id AND guild_id = p_guild_id;

    RETURN jsonb_build_object('success', true, 'newWallet', v_wallet, 'newBank', v_bank);
END;
$$ LANGUAGE plpgsql;

-- Cooldown: verifica e seta atomicamente (JSONB)
CREATE OR REPLACE FUNCTION check_and_set_cooldown(
    p_user_id TEXT, p_guild_id TEXT, p_command TEXT, p_cooldown_ms BIGINT
) RETURNS JSONB AS $$
DECLARE
    v_user users%ROWTYPE;
    v_last_time BIGINT;
    v_now BIGINT := (EXTRACT(EPOCH FROM now()) * 1000)::BIGINT;
BEGIN
    INSERT INTO users (user_id, guild_id) VALUES (p_user_id, p_guild_id)
    ON CONFLICT (user_id, guild_id) DO NOTHING;

    SELECT * INTO v_user FROM users WHERE user_id = p_user_id AND guild_id = p_guild_id;

    v_last_time := COALESCE((v_user.cooldowns ->> p_command)::BIGINT, 0);

    IF v_now - v_last_time < p_cooldown_ms THEN
        RETURN jsonb_build_object('canUse', false, 'timeLeft', (v_last_time + p_cooldown_ms) - v_now);
    END IF;

    UPDATE users
    SET cooldowns = jsonb_set(cooldowns, ARRAY[p_command], to_jsonb(v_now))
    WHERE user_id = p_user_id AND guild_id = p_guild_id;

    RETURN jsonb_build_object('canUse', true);
END;
$$ LANGUAGE plpgsql;

-- Transferência atômica entre dois usuários (débito + crédito em uma transação)
-- Com trava de linha (FOR UPDATE) no remetente: impede perda de dinheiro em falha de conexão
CREATE OR REPLACE FUNCTION transfer_biscoins(
  p_from_user TEXT,
  p_to_user TEXT,
  p_guild_id TEXT,
  p_amount BIGINT,
  p_tax_rate NUMERIC DEFAULT 0.03
) RETURNS JSONB AS $$
DECLARE
  v_sender_wallet BIGINT;
  v_tax BIGINT;
  v_net BIGINT;
  v_new_sender BIGINT;
  v_new_receiver BIGINT;
BEGIN
  -- 1. Lock na linha do remetente e checagem de saldo
  SELECT wallet INTO v_sender_wallet
  FROM users
  WHERE user_id = p_from_user AND guild_id = p_guild_id
  FOR UPDATE;

  IF v_sender_wallet IS NULL OR v_sender_wallet < p_amount THEN
    RETURN jsonb_build_object('success', false, 'reason', 'INSUFFICIENT_FUNDS');
  END IF;

  -- 2. Cálculo da taxa (3% padrão) e valor líquido
  v_tax := ROUND(p_amount * p_tax_rate);
  v_net := p_amount - v_tax;

  -- 3. Débito no remetente
  UPDATE users
  SET wallet = wallet - p_amount
  WHERE user_id = p_from_user AND guild_id = p_guild_id
  RETURNING wallet INTO v_new_sender;

  -- 4. Crédito no destinatário (cria registro se não existir)
  INSERT INTO users (user_id, guild_id, wallet)
  VALUES (p_to_user, p_guild_id, v_net)
  ON CONFLICT (user_id, guild_id)
  DO UPDATE SET wallet = users.wallet + EXCLUDED.wallet
  RETURNING wallet INTO v_new_receiver;

  RETURN jsonb_build_object(
    'success', true,
    'tax', v_tax,
    'net', v_net,
    'newSenderWallet', v_new_sender,
    'newReceiverWallet', v_new_receiver
  );
END;
$$ LANGUAGE plpgsql;
