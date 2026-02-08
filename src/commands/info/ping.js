import allData from '../../config/command_data.json' with { type: 'json' };
const d = allData["ping"];

export default {
  data: {
    name: d.nome,
    aliases: d.apelidos,
    description: d.descricao,
    usage: d.uso,
    category: d.categoria
  },
  async execute(message) {
    message.reply("Pong!");
  }
};