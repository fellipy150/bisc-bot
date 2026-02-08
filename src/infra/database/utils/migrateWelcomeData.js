import { fileURLToPath } from 'url';
import { dirname } from 'path';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

import fs from 'fs';.promises;
import path from 'path';
import ../models/userModel.js from 'mongoose';
import readline from 'readline';
import 'dotenv';.config({ path: path.resolve(__dirname, '../../../.env') });

import WelcomeModel from '../models/welcomeModel.js';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

async function migrateWelcomeData() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);

    console.log('Conectado ao MongoDB com sucesso!');

    const jsonFilePath = path.resolve(__dirname, '../../config/welcome_data.json');
    const welcomeDataRaw = await fs.readFile(jsonFilePath, 'utf-8');
    const welcomeData = JSON.parse(welcomeDataRaw);

    console.log(`\n--- PRÉVIA DOS DADOS ---`);
    for (const [serverId, serverData] of Object.entries(welcomeData)) {
      console.log(`Servidor: ${serverId}`);
      console.log(JSON.stringify({
        serverId,
        channel: serverData.chatid,
        message: serverData.welcome,
        enabled: true
      }, null, 2));
      console.log('------------------------------');
    }

    const confirm = await new Promise((resolve) => {
      rl.question('\nDeseja migrar esses dados para o banco de dados?\n1 - Sim\n2 - Não\n> ', (answer) => {
        resolve(answer.trim());
      });
    });

    if (confirm !== '1') {
      console.log('Migração cancelada pelo usuário.');
      rl.close();
      await mongoose.connection.close();
      return;
    }

    rl.close();

    let migratedCount = 0;
    let errorCount = 0;

    for (const [serverId, serverData] of Object.entries(welcomeData)) {
      try {
        const existing = await WelcomeModel.findOne({ serverId });

        const newData = {
          guildId: serverId,
          chatId: serverData.chatid,
          message: serverData.welcome,
          enabled: true
        };

        if (existing) {
          await WelcomeModel.updateOne({ serverId }, newData);
          console.log(`Servidor ${serverId} atualizado.`);
        } else {
          const welcomeDoc = new WelcomeModel(newData);
          await welcomeDoc.save();
          console.log(`Servidor ${serverId} inserido.`);
        }

        migratedCount++;
      } catch (serverError) {
        errorCount++;
        console.error(`Erro no servidor ${serverId}:`, serverError);
      }
    }

    console.log('\n==== MIGRAÇÃO FINALIZADA ====');
    console.log(`Total: ${Object.keys(welcomeData).length}`);
    console.log(`Migrados: ${migratedCount}`);
    console.log(`Com erro: ${errorCount}`);

    const backupPath = path.resolve(__dirname, '../../config/welcome_data.json.bak');
    await fs.copyFile(jsonFilePath, backupPath);
    console.log(`Backup criado em: ${backupPath}`);

    await mongoose.connection.close();
    console.log('Conexão com MongoDB encerrada.');
  } catch (err) {
    console.error('Erro na migração:', err);

    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.close();
    }

    process.exit(1);
  }
}

migrateWelcomeData()
  .then(() => {
    console.log('Script finalizado.');
    process.exit(0);
  })
  .catch((err) => {
    console.error('Erro fatal:', err);
    process.exit(1);
  });
