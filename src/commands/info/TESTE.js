import allData from '../../config/command_data.json' with { type: 'json' };
const d = allData["TESTE"];

export default {
  data: {
    name: d.nome,
    aliases: d.apelidos,
    description: d.descricao,
    usage: d.uso,
    category: d.categoria
  },
  async execute(message, args, client) {
    // aqui deve ficar a lógica de TESTE.js:
    // NAO HA LOGICAAAAAA
    message.reply("Comando TESTE executado.");
  }
};