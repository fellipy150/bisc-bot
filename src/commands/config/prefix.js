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
    if (!sub) return message.reply(msg("prefix.instrucao_uso_1", { "usage": this.data.usage }));

    switch (sub.toLowerCase()) {
      case "add": {
        const p = args[1];
        if (!p) return message.reply(msg("prefix.instrucao_uso_2", { "usage": this.data.usage }));
        if (addPrefix(p))
          return message.reply(msg("prefix.sucesso_adicao", { p, "join": getPrefixes().join(", ") }));
        else
          return message.reply(msg("prefix.prefixo_existente", { p }));
      }

      case "remove": {
        const p = args[1];
        if (!p) return message.reply(msg("prefix.mensagem_5", { "usage": this.data.usage }));
        if (removePrefix(p))
          return message.reply(msg("prefix.sucesso_remocao", { p, "join": getPrefixes().join(", ") }));
        else
          return message.reply(msg("prefix.prefixo_inexistente", { p }));
      }

      case "list":
        return message.reply(msg("prefix.lista_prefixos", { "join": getPrefixes().join(", ") }));

      default:
        return message.reply(msg("prefix.subcomando_invalido"));
    }
  }
};

/*
@register-messages
{
  "prefix": {
    "_observacao": "O JSON abaixo pode conter QUALQUER estrutura válida. Você pode adicionar objetos aninhados, múltiplas chaves, ou qualquer outro conteúdo necessário para o comando. O utilitário de sincronização fará merge profundo automaticamente.",
    "instrucao_uso_1": "Uso: {usage}",
    "instrucao_uso_2": "Use: {usage}",
    "sucesso_adicao": "✅ Prefixo ‘{p}’ adicionado.\nAtuais: {join}",
    "prefixo_existente": "⚠️ Prefixo ‘{p}’ já existe.",
    "instrucao_uso_3": "Use: {usage}",
    "sucesso_remocao": "✅ Prefixo ‘{p}’ removido.\nAtuais: {join}",
    "prefixo_inexistente": "⚠️ Prefixo ‘{p}’ não encontrado.",
    "lista_prefixos": "📋 Prefixos atuais: {join}",
    "subcomando_invalido": "Subcomando inválido. Use: add, remove ou list."
  }
}
@end
*/
