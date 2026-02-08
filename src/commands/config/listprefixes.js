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
    message.reply(`📋 Prefixos atuais: ${ps.join(", ")}`);
  }
};