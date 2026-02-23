import msg from '../config/msg-handler.js';
import allData from '../config/command_data.json' with { type: 'json' };

const d = allData["comando"];

export default {
  data: {
    name: d.nome,
    aliases: d.apelidos,
    description: d.descricao,
    usage: d.uso,
    category: d.categoria,
    ownerOnly: false
  },

  async execute(message, args, client) {
    try {

      // Validação básica de uso
      if (this.data.usage && args.length === 0 && this.data.usage.includes('<')) {
        return message.reply(
          msg("comando.uso_incorreto", { uso: d.uso })
        );
      }

      // 🔹 Rascunho inicial
      // todo: inserir ideia do comando aqui

      // TODO: Implementar lógica principal

      await message.reply(
        msg("comando.resposta_exemplo")
      );

    } catch (error) {
      console.error(`[Erro no comando comando]:`, error);

      return message.reply(
        msg("comando.erro_interno")
      );
    }
  }
};

/*
@register-messages
{
  "comando": {
    "_nota": "O JSON abaixo pode conter QUALQUER estrutura válida. Você pode adicionar objetos aninhados, múltiplas chaves, ou qualquer outro conteúdo necessário para o comando. O utilitário de sincronização fará merge profundo automaticamente.",
    "uso_incorreto": "⚠️ Uso incorreto! Tente: {uso}",
    "resposta_exemplo": "Mensagem inicial do comando comando.",
    "erro_interno": "❌ Ocorreu um erro ao processar este comando.",
    "inserirnomedamsg": "Pode colocar qualquer valor "
  }
}
@end
*/

