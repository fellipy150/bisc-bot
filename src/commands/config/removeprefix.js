import msg from '../../config/msg-handler.js';
import allData from '../../config/command_data.json' with { type: 'json' };
const d = allData["removeprefix"];
import { removePrefix, getPrefixes } from '../../config/config.js';

export default {
  data: {
    name: d.nome,
    aliases: d.apelidos,
    description: d.descricao,
    usage: d.uso,
    category: d.categoria
  },
  async execute(message, args) {
    const p = args[0];
    if (!p) return message.reply(`Use: ${this.data.usage}`);
    if (removePrefix(p)) {
      message.reply(`✅ Prefixo ‘${p}’ removido.\nAtuais: ${getPrefixes().join(", ")}`);
    } else {
      message.reply(`⚠️ Prefixo ‘${p}’ não encontrado.`);
    }
  }
};
/*
@register-messages
{
  "removeprefix": {
    "_nota": "O JSON abaixo pode conter QUALQUER estrutura válida. Você pode adicionar objetos aninhados, múltiplas chaves, ou qualquer outro conteúdo necessário para o comando. O utilitário de sincronização fará merge profundo automaticamente.",
    "uso_incorreto": "⚠️ Uso incorreto! Tente: {uso}",
    "erro_interno": "❌ Ocorreu um erro ao processar este comando.",
    "mensagem_1": "Use: ${this.data.usage}",
    "mensagem_2": "✅ Prefixo ‘${p}’ removido.\\nAtuais: ${getPrefixes().join(\", \")}",
    "mensagem_3": "⚠️ Prefixo ‘${p}’ não encontrado."
  }
}
@end
*/
