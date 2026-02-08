import ByeModel from '../models/byeModel.js';

class ByeService {
  static async getGuildBye(guildId) {
    try {
      return await ByeModel.findOne({ guildId });
    } catch (error) {
      console.error('Erro ao buscar configuração de saída:', error);
      return null;
    }
  }

  static async setGuildBye(guildId, chatId, byeContent) {
    try {
      await ByeModel.updateOne(
        { guildId },
        {
          $set: {
            chatId,
            message: byeContent,
            updatedAt: Date.now()
          }
        },
        { upsert: true }
      );
      return true;
    } catch (error) {
      console.error('Erro ao salvar configuração de saída:', error);
      return false;
    }
  }

  static async removeGuildBye(guildId) {
    try {
      const config = await ByeModel.findOne({ guildId });
      if (!config) return null;
      await ByeModel.deleteOne({ guildId });
      return config;
    } catch (error) {
      console.error('Erro ao remover configuração de saída:', error);
      return null;
    }
  }
}

export default ByeService;

