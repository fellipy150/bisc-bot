import msg from '../../config/msg-handler.js';
import allData from '../../config/command_data.json' with { type: 'json' };
const d = allData["addprefix"];
import { addPrefix, getPrefixes } from '../../config/config.js';

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
    if (!p) return message.reply(msg("addprefix.instrucao_uso", { "usage": this.data.usage }));
    if (addPrefix(p)) {
      message.reply(msg("addprefix.sucesso_adicao", { p, "join": getPrefixes().join(", ") }));
    } else {
      message.reply(msg("addprefix.prefixo_existente", { p }));
    }
  }
};

/*
@register-messages
{
  "addprefix": {
    "_observacao": "O JSON abaixo pode conter QUALQUER estrutura válida. Você pode adicionar objetos aninhados, múltiplas chaves, ou qualquer outro conteúdo necessário para o comando. O utilitário de sincronização fará merge profundo automaticamente.",
    "instrucao_uso": "Use: {usage}",
    "sucesso_adicao": "✅ Prefixo ‘{p}’ adicionado.\nAtuais: {join}",
    "prefixo_existente": "⚠️ Prefixo ‘{p}’ já existe."
  }
}
@end
*/
