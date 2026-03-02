import msg from '../../config/msg-handler.js';
import allData from '../../config/command_data.json' with { type: 'json' };
const d = allData["listprefixes"];
import { getPrefixes } from '../../config/config.js';

export default {
  data: {
    name: d.nome,
    aliases: d.apelidos,
    description: d.descricao,
    usage: d.uso,
    category: d.categoria
  },
  async execute(message) {
    const ps = getPrefixes();
    message.reply(msg("listprefixes.lista_prefixos", { "join": ps.join(", ") }));
  }
};

/*
@register-messages
{
  "listprefixes": {
    "_observacao": "O JSON abaixo pode conter QUALQUER estrutura válida. Você pode adicionar objetos aninhados, múltiplas chaves, ou qualquer outro conteúdo necessário para o comando. O utilitário de sincronização fará merge profundo automaticamente.",
    "lista_prefixos": "📋 Prefixos atuais: {join}"
  }
}
@end
*/
