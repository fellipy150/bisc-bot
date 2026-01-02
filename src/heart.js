import dotenv from 'dotenv';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { gerarClienteDiscord, validarAmbiente } from './util/connection.js';
import { connectToMongoDB as conectarBancoDados } from './database/connection.js';

import registrarComandos from './commands.js';
import registrarEventos from './events.js';

const diretorioAtual = dirname(fileURLToPath(import.meta.url));
const caminhoArquivoEnv = join(diretorioAtual, '../.config/.env');

dotenv.config({ path: caminhoArquivoEnv });

async function inicializarDependencias(clienteDiscord) {
  // 1. Conexão com Banco de Dados
  const conexao = await conectarBancoDados();
  
  if (!conexao) {
    console.warn('⚠️ Aviso: Banco de dados offline. Funcionalidades limitadas.');
  }

  // 2. Carregamento de Módulos do Bot
  // ADICIONADO AWAIT: Essencial para ESM pois o carregamento de arquivos agora é async
  await registrarComandos(clienteDiscord);
  await registrarEventos(clienteDiscord);
}

async function conectarAoDiscord(clienteDiscord) {
  const tokenBot = process.env.BOT_TOKEN;

  if (!tokenBot) {
    throw new Error('BOT_TOKEN ausente nas variáveis de ambiente.');
  }

  const prefixoSeguro = tokenBot.substring(0, 5);
  console.log(`📡 Conectando via token (prefixo: ${prefixoSeguro})...`);
  
  await clienteDiscord.login(tokenBot);
  // O tag só fica disponível após o login
  console.log(`🚀 Status: Online | Usuário: ${clienteDiscord.user.tag}`);
}

async function sistema() {
  try {
    validarAmbiente();

    const clienteDiscord = gerarClienteDiscord();

    // Aguarda carregar tudo (comandos, eventos, banco) antes de logar
    await inicializarDependencias(clienteDiscord);
    await conectarAoDiscord(clienteDiscord);

  } catch (erro) {
    console.error('❌ Falha crítica na inicialização:', erro.message);
    process.exit(1);
  }
}

sistema();
