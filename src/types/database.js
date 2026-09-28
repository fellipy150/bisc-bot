/**
 * Definições centrais de tipos (JSDoc) — TYP-01.
 * Formaliza os contratos entre o banco Supabase (snake_case) e a aplicação (camelCase).
 *
 * Convenção:
 *  - *DatabaseRow — linha bruta retornada pelo Supabase (snake_case)
 *  - *Profile / *Config — entidade de domínio na aplicação (camelCase)
 */

/**
 * Linha bruta da tabela `users` (Supabase, snake_case).
 * @typedef {Object} UserDatabaseRow
 * @property {string} id - UUID da linha
 * @property {string} user_id - ID do usuário no Discord
 * @property {string} guild_id - ID do servidor
 * @property {number} wallet - Saldo na carteira
 * @property {number} bank - Saldo no banco
 * @property {number} xp - XP acumulado
 * @property {number} level - Nível atual
 * @property {number} daily_streak - Sequência de dailies
 * @property {Object} cooldowns - Mapa de cooldowns (JSONB): { [comando]: timestamp }
 * @property {Array} inventory - Inventário (JSONB)
 * @property {string} [profile_bio]
 * @property {string} [profile_background]
 * @property {string[]} [profile_badges]
 */

/**
 * Entidade de domínio do usuário (camelCase) consumida pelos comandos.
 * @typedef {Object} UserProfile
 * @property {string} userId
 * @property {string} guildId
 * @property {number} wallet
 * @property {number} bank
 * @property {number} xp
 * @property {number} level
 * @property {number} dailyStreak
 * @property {Object} cooldowns
 * @property {Array} inventory
 */

/**
 * Retorno da RPC `add_xp_and_check_level` (JSONB, snake_case do PG).
 * @typedef {Object} AddXpResult
 * @property {UserDatabaseRow} user
 * @property {boolean} leveled_up
 * @property {number} new_level
 */

/**
 * Retorno mapeado da RPC `add_xp_and_check_level` (camelCase).
 * @typedef {Object} AddXpMapped
 * @property {UserDatabaseRow} user
 * @property {boolean} leveledUp
 * @property {number} newLevel
 */

/**
 * Retorno das RPCs `increment_field` / `decrement_field_safe`.
 * @typedef {Object} BalanceOperationResult
 * @property {boolean} success
 * @property {string} [reason]
 * @property {number} [new_balance]
 */

/**
 * Retorno da RPC `transfer_biscoins`.
 * @typedef {Object} TransferResult
 * @property {boolean} success
 * @property {string} [reason] - 'INSUFFICIENT_FUNDS' quando falha
 * @property {number} [tax]
 * @property {number} [net]
 * @property {number} [newSenderWallet]
 * @property {number} [newReceiverWallet]
 */

/**
 * Retorno da RPC `transfer_between_wallet_bank` (deposit/withdraw).
 * @typedef {Object} BankTransactionResult
 * @property {boolean} success
 * @property {string} [reason]
 * @property {number} [newWallet]
 * @property {number} [newBank]
 */

/**
 * Retorno da RPC `check_and_set_cooldown`.
 * @typedef {Object} CooldownResult
 * @property {boolean} canUse
 * @property {number} [timeLeft] - ms restantes quando canUse=false
 */

/**
 * Linha bruta das tabelas `welcomes` / `byes` (Supabase, snake_case).
 * @typedef {Object} GuildConfigDatabaseRow
 * @property {string} id - UUID da linha
 * @property {string} guild_id - ID do servidor
 * @property {string} chat_id - ID do canal
 * @property {string} [message_content]
 * @property {Object} [message_embed]
 * @property {boolean} enabled
 */

/**
 * Config de boas-vindas/saída no formato legado (camelCase) retornado pelos repositórios.
 * @typedef {Object} GuildConfigLegacy
 * @property {string} guildId
 * @property {string} chatId
 * @property {{ content: string|null, embed: Object|null }} message
 * @property {boolean} enabled
 */

/**
 * Mapeia uma linha bruta do Supabase para a entidade de domínio.
 * @param {UserDatabaseRow|null} row
 * @returns {UserProfile|null}
 */
export function mapUserRowToProfile(row) {
  if (!row) return null;
  return {
    userId: row.user_id,
    guildId: row.guild_id,
    wallet: Number(row.wallet || 0),
    bank: Number(row.bank || 0),
    xp: Number(row.xp || 0),
    level: Number(row.level || 1),
    dailyStreak: Number(row.daily_streak || 0),
    cooldowns: row.cooldowns || {},
    inventory: row.inventory || [],
  };
}
