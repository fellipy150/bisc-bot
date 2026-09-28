/**
 * Caminho: src/infra/database/repositories/byeRepository.js
 * Descrição: CRUD de mensagens de saída via Supabase (substitui byeService Mongoose).
 */
import { supabase } from '../../Supabase.js';

export const byeRepo = {
  /**
   * Obtém a configuração de mensagens de saída do servidor.
   */
  async getGuildBye(guildId) {
    const { data, error } = await supabase
      .from('byes')
      .select('*')
      .eq('guild_id', guildId)
      .maybeSingle();

    if (error) throw error;
    return data;
  },

  /**
   * Define ou atualiza as configurações de saída usando upsert.
   */
  async setGuildBye(guildId, chatId, messageEmbed, messageContent = null) {
    const { data, error } = await supabase
      .from('byes')
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
   * Remove as configurações de saída de um servidor
   */
  async removeGuildBye(guildId) {
    const config = await this.getGuildBye(guildId);
    if (!config) return null;

    const { error } = await supabase
      .from('byes')
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
};

// Named exports para compatibilidade
export async function getGuildBye(guildId) { return byeRepo.getGuildBye(guildId); }
export async function setGuildBye(guildId, chatId, message) { 
  return byeRepo.setGuildBye(guildId, chatId, message?.embed ?? null, message?.content ?? null); 
}
export async function removeGuildBye(guildId) { return byeRepo.removeGuildBye(guildId); }

// Default export: objeto estático com a mesma API do ByeService antigo (consumers usam `import X from`)
export default {
  getGuildBye,
  setGuildBye,
  removeGuildBye,
};
