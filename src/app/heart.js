/**
 * Caminho: src/app/heart.js
 * Descrição: main do bot.
 */
import { 
  Logger, 
  config, 
  gerarClienteDiscord, 
  validarAmbiente, 
  connectToMongoDB 
} from '../infra/index.js';

import BotState from './BotState.js';
import registrarComandos from '../loaders/CommandLoader.js';
import registrarEventos from '../loaders/EventLoader.js';

async function inicializarDependencias(client) {
  const conexao = await connectToMongoDB();
  if (!conexao) Logger.warn('⚠️  Sistema operando sem MongoDB.');

  await registrarComandos(client);
  await registrarEventos(client);
}

export async function startBot() {
  if (BotState.status === 'online') return;

  try {
    BotState.setStatus('starting');
    validarAmbiente();

    const client = gerarClienteDiscord();
    BotState.setClient(client);

    await inicializarDependencias(client);
    await client.login(config.bot.token);
    
    BotState.setStatus('online');
    return client;
  } catch (erro) {
    BotState.setStatus('error');
    Logger.error('Erro crítico no startBot:', erro);
    throw erro;
  }
}

export async function stopBot() {
  if (BotState.client) {
    BotState.setStatus('stopping');
    await BotState.client.destroy();
    BotState.setClient(null);
    BotState.setStatus('offline');
  }
}

