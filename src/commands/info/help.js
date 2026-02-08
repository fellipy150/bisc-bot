import { fileURLToPath } from 'url';
import { dirname } from 'path';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

import fs from 'fs';
import path from 'path';
import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';

const dataPath = path.join(__dirname, "../../config/command_data.json");

export default {
  data: {
    name: "help",
    aliases: ["ajuda", "h"],
    description: "fornece descrição e outras informações úteis sobre outros comandos",
    usage: "..help [comando]",
    category: "misc"
  },

  async execute(message, args) {
    const raw = fs.readFileSync(dataPath, "utf8");
    const allData = JSON.parse(raw);
    const commands = Object.values(allData).sort((a, b) => a.nome.localeCompare(b.nome));

    if (args.length === 0) {
      const perPage = 10;
      const pages = [];
      for (let i = 0; i < commands.length; i += perPage) {
        const chunk = commands.slice(i, i + perPage);
        const embed = new EmbedBuilder()
          .setTitle("📖 Lista de Comandos")
          .setFooter({ text: `Página ${i / perPage + 1} de ${Math.ceil(commands.length / perPage)}` });
        chunk.forEach(cmd => {
          embed.addFields({ name: `\`${cmd.nome}\``, value: cmd.descricao, inline: false });
        });
        pages.push(embed);
      }

      let page = 0;
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("prev")
          .setLabel("◀️ Anterior")
          .setStyle(ButtonStyle.Primary)
          .setDisabled(true),
        new ButtonBuilder()
          .setCustomId("next")
          .setLabel("Próxima ▶️")
          .setStyle(ButtonStyle.Primary)
          .setDisabled(pages.length <= 1)
      );

      const sent = await message.channel.send({ embeds: [pages[page]], components: [row] });

      const filter = i => ["prev", "next"].includes(i.customId) && i.user.id === message.author.id;
      const collector = sent.createMessageComponentCollector({ filter, time: 120000 });

      collector.on("collect", async interaction => {
        if (interaction.customId === "prev") page--;
        if (interaction.customId === "next") page++;
        const prevBtn = row.components[0].setDisabled(page === 0);
        const nextBtn = row.components[1].setDisabled(page === pages.length - 1);
        await interaction.update({ embeds: [pages[page]], components: [row] });
      });

      collector.on("end", () => {
        row.components.forEach(b => b.setDisabled(true));
        sent.edit({ components: [row] });
      });

    } else {
      const key = args[0].toLowerCase();
      const cmd = allData[key] || Object.values(allData).find(c => (c.apelidos || []).includes(key));
      if (!cmd) return message.reply("❌ Comando não encontrado.");

      const embed = new EmbedBuilder()
        .setTitle(`ℹ️ Ajuda: ${cmd.nome}`)
        .addFields(
          { name: "Descrição", value: cmd.descricao, inline: false },
          { name: "Uso", value: `\`${cmd.uso}\``, inline: false },
          { name: "Apelidos", value: cmd.apelidos.length ? cmd.apelidos.join(", ") : "Nenhum", inline: false },
          { name: "Categoria", value: cmd.categoria, inline: false }
        );

      message.channel.send({ embeds: [embed] });
    }
  }
};
