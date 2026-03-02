import msg from '../../config/msg-handler.js';
import allData from '../../config/command_data.json' with { type: 'json' };

// Importação dos subcomandos isolados
import synccat from './synccat.js';
import syncmsg from './syncmsg.js';

const d = allData["sync"];

export default {
  data: {
    name: d.nome,
    aliases: d.apelidos,
    description: d.descricao,
    usage: d.uso,
    category: d.categoria,
    ownerOnly: true
  },

  async execute(message, args, client) {
    const subcomando = args[0]?.toLowerCase();

    switch (subcomando) {
      case 'cat':
      case 'categoria':
      case 'categorias':
        // Chama a lógica isolada de sincronização de pastas/categorias
        return await synccat.execute(message, args.slice(1), client);

      case 'msg':
      case 'mensagem':
      case 'mensagens':
        // Chama a lógica isolada de sincronização de mensagens/json
        return await syncmsg.execute(message, args.slice(1), client);

      default:
        // Caso não passe argumentos ou passe um inválido, exibe o uso correto
        return message.reply(
          msg("sync.sintaxe_incorreta", { uso: d.uso })
        );
    }
  }
};

/*
@register-messages
{
  "sync": {
    "_nota": "O JSON abaixo pode conter QUALQUER estrutura válida. Você pode adicionar objetos aninhados, múltiplas chaves, ou qualquer outro conteúdo necessário para o comando. O utilitário de sincronização fará merge profundo automaticamente.",
    "sintaxe_incorreta": "⚠️ Uso incorreto! Tente: `..sync cat` ou `..sync msg`"
  }
}
@end
*/
