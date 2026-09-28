/**
 * Caminho: src/infra/database/repositories/userRepository.js
 * Descrição: Acesso a dados de usuários via Supabase (substitui userService Mongoose).
 * Operações de economia/XP usam RPCs atômicas (evita race conditions).
 */
import { supabase } from '../../Supabase.js';

export const userRepo = {
  // --- BASE ---
  // Busca o usuário (sem criar). Retorna null se não existir.
  async getUser(userId, guildId) {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('user_id', userId)
      .eq('guild_id', guildId)
      .maybeSingle();
    if (error) throw error;
    return data;
  },

  // Busca ou cria o usuário (mesma semântica do userService antigo)
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

  // --- LEVELING (XP) ---
  // Adiciona XP e verifica subida de nível via RPC atômica
  // Retorna { user, leveledUp, newLevel } (camelCase, igual ao service antigo)
  async addXp(userId, guildId, amount) {
    const { data, error } = await supabase.rpc('add_xp_and_check_level', {
      p_user_id: userId,
      p_guild_id: guildId,
      p_xp_amount: amount,
    });
    if (error) throw error;
    return { user: data.user, leveledUp: data.leveled_up, newLevel: data.new_level };
  },

  // --- ECONOMIA (Biscoin) ---
  // Adiciona dinheiro (Carteira ou Banco) via RPC atômica
  async addBiscoins(userId, guildId, amount, destination = 'wallet') {
    const { data, error } = await supabase.rpc('increment_field', {
      p_user_id: userId,
      p_guild_id: guildId,
      p_field: destination === 'bank' ? 'bank' : 'wallet',
      p_amount: amount,
    });
    if (error) throw error;
    return data.success;
  },

  // Remove dinheiro de forma segura (verificação de saldo atômica no SQL)
  // Retorna true se sucesso, false se saldo insuficiente
  async removeBiscoins(userId, guildId, amount, source = 'wallet') {
    const { data, error } = await supabase.rpc('decrement_field_safe', {
      p_user_id: userId,
      p_guild_id: guildId,
      p_field: source === 'bank' ? 'bank' : 'wallet',
      p_amount: amount,
    });
    if (error) throw error;
    return data.success;
  },

  /**
   * Executa a transferência atômica de biscoins entre dois usuários.
   * Débito do remetente e crédito do destinatário em uma única transação (RPC).
   * Retorna { success, reason?, tax, net, newSenderWallet, newReceiverWallet }
   */
  async transferBiscoins(fromUserId, toUserId, guildId, amount, taxRate = 0.03) {
    const { data, error } = await supabase.rpc('transfer_biscoins', {
      p_from_user: fromUserId,
      p_to_user: toUserId,
      p_guild_id: guildId,
      p_amount: amount,
      p_tax_rate: taxRate,
    });

    if (error) throw error;
    return data;
  },

  // --- UTILITÁRIOS ---
  // Função genérica para atualizar dados (necessária para comandos antigos ou admin)
  async updateUser(userId, guildId, updateData) {
    const { data, error } = await supabase
      .from('users')
      .update(updateData)
      .eq('user_id', userId)
      .eq('guild_id', guildId)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  // --- SISTEMA DE BANCO ---
  // Transação atômica wallet <-> bank (deposit/withdraw) via RPC
  // Retorna { success, reason?, newWallet, newBank } igual ao service antigo
  async bankTransaction(userId, guildId, amount, type) {
    const { data, error } = await supabase.rpc('transfer_between_wallet_bank', {
      p_user_id: userId,
      p_guild_id: guildId,
      p_amount: amount,
      p_type: type,
    });
    if (error) throw error;
    if (!data.success) {
      return { success: false, reason: data.reason === 'saldo insuficiente'
        ? (type === 'deposit' ? 'Dinheiro insuficiente na carteira.' : 'Dinheiro insuficiente no banco.')
        : 'Tipo de transação inválido.' };
    }
    return { success: true, newWallet: data.newWallet, newBank: data.newBank };
  },

  // --- SISTEMA DE COOLDOWN ---
  // Verifica e seta o cooldown atomicamente via RPC (JSONB)
  // Retorna { canUse, timeLeft? }
  async checkCooldown(userId, guildId, commandName, cooldownTimeMs) {
    const { data, error } = await supabase.rpc('check_and_set_cooldown', {
      p_user_id: userId,
      p_guild_id: guildId,
      p_command: commandName,
      p_cooldown_ms: cooldownTimeMs,
    });
    if (error) throw error;
    return data.canUse ? { canUse: true } : { canUse: false, timeLeft: data.timeLeft };
  },

  // Seta o cooldown diretamente (mantido para compatibilidade de API)
  async setCooldown(userId, guildId, commandName) {
    const now = new Date().toISOString();
    const { error } = await supabase
      .from('users')
      .update({ cooldowns: { [commandName]: now } })
      .eq('user_id', userId)
      .eq('guild_id', guildId);
    if (error) throw error;
  },
};

// Named exports para compatibilidade com consumidores existentes
export async function getUser(userId, guildId) { return userRepo.getUser(userId, guildId); }
export async function ensureUser(userId, guildId) { return userRepo.ensureUser(userId, guildId); }
export async function addXp(userId, guildId, amount) { return userRepo.addXp(userId, guildId, amount); }
export async function addBiscoins(userId, guildId, amount, destination) { return userRepo.addBiscoins(userId, guildId, amount, destination); }
export async function removeBiscoins(userId, guildId, amount, source) { return userRepo.removeBiscoins(userId, guildId, amount, source); }
export async function transferBiscoins(fromUserId, toUserId, guildId, amount, taxRate) { return userRepo.transferBiscoins(fromUserId, toUserId, guildId, amount, taxRate); }
export async function updateUser(userId, guildId, updateData) { return userRepo.updateUser(userId, guildId, updateData); }
export async function bankTransaction(userId, guildId, amount, type) { return userRepo.bankTransaction(userId, guildId, amount, type); }
export async function checkCooldown(userId, guildId, commandName, cooldownTimeMs) { return userRepo.checkCooldown(userId, guildId, commandName, cooldownTimeMs); }
export async function setCooldown(userId, guildId, commandName) { return userRepo.setCooldown(userId, guildId, commandName); }
