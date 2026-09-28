import { PermissionsBitField } from 'discord.js';
import msg from '../../config/msg-handler.js';
import allData from '../../config/command_data.json' with { type: 'json' };
import setbye from './setbye.js';
const d = allData['bye'];

export default {
  data: {
    name: d.nome,
    aliases: d.apelidos,
    description: d.descricao,
    usage: d.uso,
    category: d.categoria,
  },

  async execute(message, args, client) {
    // Verificação de permissão
    if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
      return message.reply(
        msg("bye.permissao_administrador"));
    }

    const subcomando = args[0]?.toLowerCase();

    switch (subcomando) {
      case 'add':
      case 'set':
        // Delega para o arquivo de configuração (setbye.js)
        await setbye.execute(message, args.slice(1), client);
        break;

      default:
        message.reply(msg("bye.instrucao_uso", { "nome": d.nome }));
    }
  },
};
