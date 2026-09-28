import { PermissionsBitField } from 'discord.js';
import msg from '../../config/msg-handler.js';
import allData from '../../config/command_data.json' with { type: 'json' };
import setwelcome from './setwelcome.js';
import removewelcome from './removewelcome.js';
import viewwelcome from './viewwelcome.js';
const d = allData['welcome'];

export default {
  data: {
    name: d.nome,
    aliases: d.apelidos,
    description: d.descricao,
    usage: d.uso,
    category: d.categoria,
  },

  async execute(message, args, client) {
    if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
      return message.reply(msg("welcome.permissao_negada"));
    }

    const subcomando = args[0]?.toLowerCase();

    switch (subcomando) {
      case 'add':
        message.reply(msg("welcome.inicio_adicao"));
        await setwelcome.execute(message, args.slice(1), client);
        break;
      case 'edit':
        message.reply(msg("welcome.inicio_edicao"));
        await setwelcome.execute(message, args.slice(1), client);
        break;
      case 'remove':
        message.reply(msg("welcome.inicio_remocao"));
        await removewelcome.execute(message, args.slice(1), client);
        break;
      case 'view':
        message.reply(msg("welcome.inicio_visualizacao"));
        await viewwelcome.execute(message, args.slice(1), client);
        break;
      default:
        message.reply(msg("welcome.ajuda_comando"));
    }
  },
};
