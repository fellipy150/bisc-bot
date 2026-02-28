import msg from '../../config/msg-handler.js';
import allData from '../../config/command_data.json' with { type: 'json' };

const d = allData["syncmsg"];

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
          msg("syncmsg.uso_incorreto", { uso: d.uso })
        );
      }

      // 🔹 Rascunho inicial
      // inserir a lógica do sync msg aqui. O comando sync agora só vai chamar esse arquivo

      // TODO: Implementar lógica principal
      await message.reply(
        msg("syncmsg.resposta_exemplo")
      );

    } catch (error) {
      console.error(`[Erro no comando syncmsg]:`, error);
      return message.reply(
        msg("syncmsg.erro_interno")
      );
    }
  }
};

/*
@register-messages
{
  "syncmsg": {
    "_nota": "O JSON abaixo pode conter QUALQUER estrutura válida. O utilitário de sincronização fará merge profundo automaticamente.",
    "uso_incorreto": "⚠️ Uso incorreto! Tente: {uso}",
    "resposta_exemplo": "Mensagem inicial do comando syncmsg.",
    "erro_interno": "❌ Ocorreu um erro ao processar este comando."
  }
}
@end
*/
