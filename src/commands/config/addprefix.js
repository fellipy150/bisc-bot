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
    if (!p) return message.reply(`Use: ${this.data.usage}`);
    if (addPrefix(p)) {
      message.reply(`✅ Prefixo ‘${p}’ adicionado.\nAtuais: ${getPrefixes().join(", ")}`);
    } else {
      message.reply(`⚠️ Prefixo ‘${p}’ já existe.`);
    }
  }
};