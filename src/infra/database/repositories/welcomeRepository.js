/**
 * Caminho: src/infra/database/repositories/welcomeRepository.js
 * Descrição: CRUD de boas-vindas via Supabase (substitui welcomeService Mongoose).
 */
import { supabase } from '../../Supabase.js';

export const welcomeRepo = {
  /**
   * Obtém a configuração de mensagens de entrada do servidor.
   */
  async getGuildWelcome(guildId) {
    const { data, error } = await supabase
      .from('welcomes')
      .select('*')
      .eq('guild_id', guildId)
      .maybeSingle();

    if (error) throw error;
    return data;
  },

  /**
   * Define ou atualiza as configurações de entrada usando upsert.
   */
  async setGuildWelcome(guildId, chatId, messageEmbed, messageContent = null) {
    const { data, error } = await supabase
      .from('welcomes')
      .upsert({
        guild_id: guildId,
        chat_id: chatId,
        message_embed: messageEmbed,
        message_content: messageContent,
        updated_at: new Date().toISOString()
      }, { onConflict: 'guild_id' })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Remove as configurações de boas-vindas de um servidor
   */
  async removeGuildWelcome(guildId) {
    const config = await this.getGuildWelcome(guildId);
    if (!config) return null;

    const { error } = await supabase
      .from('welcomes')
      .delete()
      .eq('guild_id', guildId);
    if (error) throw error;

    // Reformato legado: { guildId, chatId, message: { content, embed }, enabled }
    return {
      guildId: config.guild_id,
      chatId: config.chat_id,
      message: { content: config.message_content, embed: config.message_embed },
      enabled: config.enabled,
    };
  },

  /**
   * Verifica se um servidor tem configuração de boas-vindas
   */
  async hasWelcomeConfig(guildId) {
    const { count, error } = await supabase
      .from('welcomes')
      .select('*', { count: 'exact', head: true })
      .eq('guild_id', guildId);
    if (error) throw error;
    return count > 0;
  },
};

// Named exports para compatibilidade
export async function getGuildWelcome(guildId) { return welcomeRepo.getGuildWelcome(guildId); }
export async function setGuildWelcome(guildId, chatId, message) { 
  return welcomeRepo.setGuildWelcome(guildId, chatId, message?.embed ?? null, message?.content ?? null); 
}
export async function removeGuildWelcome(guildId) { return welcomeRepo.removeGuildWelcome(guildId); }
export async function hasWelcomeConfig(guildId) { return welcomeRepo.hasWelcomeConfig(guildId); }

// Default export: objeto estático com a mesma API do WelcomeService antigo (consumers usam `import X from`)
export default {
  getGuildWelcome,
  setGuildWelcome,
  removeGuildWelcome,
  hasWelcomeConfig,
};
