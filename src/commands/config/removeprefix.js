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
    if (!p) return message.reply(msg("removeprefix.instrucao_uso", { "usage": this.data.usage }));
    if (removePrefix(p)) {
      message.reply(msg("removeprefix.sucesso_remocao", { p, "join": getPrefixes().join(", ") }));
    } else {
      message.reply(msg("removeprefix.prefixo_inexistente", { p }));
    }
  }
};

/*
@register-messages
{
  "removeprefix": {
    "_observacao": "O JSON abaixo pode conter QUALQUER estrutura válida. Você pode adicionar objetos aninhados, múltiplas chaves, ou qualquer outro conteúdo necessário para o comando. O utilitário de sincronização fará merge profundo automaticamente.",
    "instrucao_uso": "Use: {usage}",
    "sucesso_remocao": "✅ Prefixo ‘{p}’ removido.\nAtuais: {join}",
    "prefixo_inexistente": "⚠️ Prefixo ‘{p}’ não encontrado."
  }
}
@end
*/
