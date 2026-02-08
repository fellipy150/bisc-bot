import { fileURLToPath } from 'url';
import { dirname } from 'path';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

#!/usr/bin/env node

import { spawn } from 'child_process';
import { createInterface } from 'readline';
import { red, cyan, green, yellow, blue, gray, bold } from 'chalk'; // ← descomentei
import { existsSync } from 'fs';
import { join } from 'path';
import { config } from 'dotenv';

// Configurações iniciais
config({ path: join(__dirname, '../.env') });
const heartPath = join(__dirname, '../src/heart.js');
const pe = new (require('pretty-error'))().start();

// Função de verificação
const checkFile = (condition, message) => {
  if (!condition) {
    console.error(red(message));
    process.exit(1);
  }
};

// Verificações iniciais
checkFile(process.env.BOT_TOKEN, '❌ BOT_TOKEN não encontrado no .env.');
checkFile(existsSync(heartPath), '❌ Arquivo heart.js não encontrado.');

// Toast simplificado
const sendToast = (opts, msg) => spawn('termux-toast', [
  ...Object.entries(opts).flatMap(([k, v]) => v ? [`-${k[0]}`, v] : []),
  msg
]);

// Modos de execução
const modes = {
  '1': { exe: 'node', args: [heartPath] },
  '2': { exe: 'node', args: [join(__dirname, '../node_modules/nodemon/bin/nodemon.js'), heartPath] }
};

(async () => {
  console.clear();
  console.log(cyan.bold('🚀 Inicializador de Bot - Escolha o modo:'));
  [ green('1. Modo normal'), yellow('2. Modo dev (nodemon)') ].forEach(m => console.log(m));

  // Criando uma Promise para readline.question
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const mode = await new Promise(resolve => {
    rl.question(bold('\nDigite 1 ou 2: '), answer => {
      rl.close();
      resolve(answer.trim());
    });
  });

  checkFile(modes[mode], '❌ Opção inválida. Encerrando.');
  console.log(blue(`\nIniciando em modo ${mode === '1' ? 'normal' : 'desenvolvimento'}...\n`));

  // Inicia processo
  const { exe, args } = modes[mode];
  const bot = spawn(exe, args, { shell: true, env: process.env });

  // Handlers de eventos
  bot.stdout.on('data', d => {
    process.stdout.write(d);
    /restarting/i.test(d) && sendToast({ position: 'bottom', duration: 'short' }, 'nodemon reiniciou o bot');
  });

  bot.stderr.on('data', d => {
    console.error(pe.render(new Error(d)));
    sendToast(
      { position: 'bottom', duration: 'long', background: 'red', color: 'white' },
      '🔥 Código quebrou!'
    );
  });

  bot.on('exit', c => console.log(gray(`\nProcesso finalizado com código ${c}`)));
})();
