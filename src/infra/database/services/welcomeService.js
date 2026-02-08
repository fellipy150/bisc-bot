// src/database/services/welcomeService.js
import WelcomeModel from '../models/welcomeModel.js';
 
class WelcomeService {
  /**
   * Obtém as configurações de boas-vindas de um servidor
   * @param {string} guildId - ID do servidor
   * @returns {Promise<Object|null>} - Configurações de boas-vindas ou null se não existir
   */
  static async getGuildWelcome(guildId) {
    try {
      const welcomeConfig = await WelcomeModel.findOne({ guildId });
      return welcomeConfig;
    } catch (error) {
      console.error('Erro ao buscar configuração de boas-vindas:', error);
      return null;
    }
  }

  /**
   * Cria ou atualiza as configurações de boas-vindas de um servidor
   * @param {string} guildId - ID do servidor
   * @param {string} chatId - ID do canal para mensagens de boas-vindas
   * @param {Object} welcomeContent - Conteúdo da mensagem de boas-vindas
   * @returns {Promise<boolean>} - true se sucesso, false se falha
   */
  static async setGuildWelcome(guildId, chatId, welcomeContent) {
    try {
      // Usar updateOne com upsert para criar ou atualizar
      await WelcomeModel.updateOne(
        { guildId },
        {
          $set: {
            chatId,
            message: welcomeContent,
            updatedAt: Date.now()
          }
        },
        { upsert: true }
      );
      
      return true;
    } catch (error) {
      console.error('Erro ao salvar configuração de boas-vindas:', error);
      return false;
    }
  }

  /**
   * Remove as configurações de boas-vindas de um servidor
   * @param {string} guildId - ID do servidor
   * @returns {Promise<Object|null>} - Configuração removida ou null se falha
   */
  static async removeGuildWelcome(guildId) {
    try {
      // Primeiro buscamos a configuração para retorná-la
      const config = await WelcomeModel.findOne({ guildId });
      
      if (!config) {
        return null;
      }
      
      // Então removemos
      await WelcomeModel.deleteOne({ guildId });
      
      return config;
    } catch (error) {
      console.error('Erro ao remover configuração de boas-vindas:', error);
      return null;
    }
  }

  /**
   * Verifica se um servidor tem configuração de boas-vindas
   * @param {string} guildId - ID do servidor
   * @returns {Promise<boolean>} - true se tem configuração, false se não
   */
  static async hasWelcomeConfig(guildId) {
    try {
      const count = await WelcomeModel.countDocuments({ guildId });
      return count > 0;
    } catch (error) {
      console.error('Erro ao verificar configuração de boas-vindas:', error);
      return false;
    }
  }
}

export default WelcomeService;
