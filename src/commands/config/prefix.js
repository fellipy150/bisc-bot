import msg from '../../config/msg-handler.js';
import allData from '../../config/command_data.json' with { type: 'json' };
const d = allData["prefix"];
import { addPrefix, removePrefix, getPrefixes } from '../../config/config.js';

export default {
  data: {
    name: d.nome,
    aliases: d.apelidos,
    description: d.descricao,
    usage: d.uso,
    category: d.categoria
  },
  async execute(message, args) {
    const sub = args[0];
    if (!sub) return message.reply(`Uso: ${this.data.usage}`);

    switch (sub.toLowerCase()) {
      case "add": {
        const p = args[1];
        if (!p) return message.reply(`Use: ${this.data.usage}`);
        if (addPrefix(p))
          return message.reply(`✅ Prefixo ‘${p}’ adicionado.\nAtuais: ${getPrefixes().join(", ")}`);
        else
          return message.reply(`⚠️ Prefixo ‘${p}’ já existe.`);
      }

      case "remove": {
        const p = args[1];
        if (!p) return message.reply(`Use: ${this.data.usage}`);
        if (removePrefix(p))
          return message.reply(`✅ Prefixo ‘${p}’ removido.\nAtuais: ${getPrefixes().join(", ")}`);
        else
          return message.reply(`⚠️ Prefixo ‘${p}’ não encontrado.`);
      }

      case "list":
        return message.reply(`📋 Prefixos atuais: ${getPrefixes().join(", ")}`);

      default:
        return message.reply("Subcomando inválido. Use: add, remove ou list.");
    }
  }
};
/*
@register-messages
{
  "prefix": {
    "_nota": "O JSON abaixo pode conter QUALQUER estrutura válida. Você pode adicionar objetos aninhados, múltiplas chaves, ou qualquer outro conteúdo necessário para o comando. O utilitário de sincronização fará merge profundo automaticamente.",
    "uso_incorreto": "⚠️ Uso incorreto! Tente: {uso}",
    "erro_interno": "❌ Ocorreu um erro ao processar este comando.",
    "mensagem_1": "Uso: ${this.data.usage}",
    "mensagem_2": "Use: ${this.data.usage}",
    "mensagem_3": "✅ Prefixo ‘${p}’ adicionado.\\nAtuais: ${getPrefixes().join(\", \")}",
    "mensagem_4": "⚠️ Prefixo ‘${p}’ já existe.",
    "mensagem_5": "Use: ${this.data.usage}",
    "mensagem_6": "✅ Prefixo ‘${p}’ removido.\\nAtuais: ${getPrefixes().join(\", \")}",
    "mensagem_7": "⚠️ Prefixo ‘${p}’ não encontrado.",
    "mensagem_8": "📋 Prefixos atuais: ${getPrefixes().join(\", \")}",
    "mensagem_9": "Subcomando inválido. Use: add, remove ou list."
  }
}
@end
*/
