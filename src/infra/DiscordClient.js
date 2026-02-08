/**
 * infra/DiscordClient.js
 * Fábrica do cliente Discord.js com intents e parciais configuradas.

 */
import { Client, GatewayIntentBits, Partials } from "discord.js";

const INTENCOES_ESSENCIAIS = [
  GatewayIntentBits.Guilds,
  GatewayIntentBits.GuildMessages,
  GatewayIntentBits.MessageContent,
  GatewayIntentBits.GuildMembers,
];

const INTENCOES_DE_ESTADO = [
  GatewayIntentBits.GuildPresences,
  GatewayIntentBits.GuildVoiceStates,
  GatewayIntentBits.GuildMessageReactions,
  GatewayIntentBits.GuildScheduledEvents,
];

const INTENCOES_DE_COMUNICACAO = [
  GatewayIntentBits.DirectMessages,
  GatewayIntentBits.DirectMessageReactions,
  GatewayIntentBits.GuildInvites,
];

const INTENCOES_ADICIONAIS = [
  GatewayIntentBits.GuildEmojisAndStickers,
  GatewayIntentBits.GuildIntegrations,
  GatewayIntentBits.GuildWebhooks,
];


const INTENCOES_TODAS = [
  ...INTENCOES_ESSENCIAIS,
  ...INTENCOES_DE_ESTADO,
  ...INTENCOES_DE_COMUNICACAO,
  ...INTENCOES_ADICIONAIS,
];

/**
 * As parciais (Partials) necessárias
 */
const PARCIAIS = [
  Partials.Message,
  Partials.Channel,
  Partials.GuildMember,
  Partials.User,
  Partials.Reaction,
  Partials.ThreadMember,
  Partials.GuildScheduledEvent,
];

/**
 * Verifica se as configurações mínimas de ambiente estão presentes.
 * Suporta tanto process.env quanto um objeto config importado.
 * @param {Object} [configObj] - Objeto de configuração opcional (padrão: process.env)
 * @param {string} [tokenPath='BOT_TOKEN'] - Caminho para o token no objeto
 */
export function validarAmbiente(configObj = null, tokenPath = 'BOT_TOKEN') {
  let token;
  
  if (configObj && typeof configObj === 'object') {
    
    if (configObj.bot && configObj.bot.token) {
      token = configObj.bot.token;
    } else if (configObj[tokenPath]) {
      token = configObj[tokenPath];
    }
  } else {
    
    token = process.env[tokenPath] || process.env.BOT_TOKEN;
  }

  if (!token) {
    throw new Error(`Token do bot não encontrado. Verifique a variável '${tokenPath}' no ambiente ou objeto config.`);
  }

  if (token.length < 20) {
    throw new Error("O token fornecido parece ser inválido ou curto demais.");
  }

  return token;
}

/**
 * Instancia o cliente do Discord com todas as permissões configuradas.
 * @param {Object} [options] - Opções adicionais para o cliente
 * @param {boolean} [options.usarIntencoesAgrupadas=true] - Usar intenções agrupadas ou planas
 * @returns {Client} Instância do cliente Discord.js
 */
export function gerarClienteDiscord(options = {}) {
  const {
    usarIntencoesAgrupadas = true,
    intencoesPersonalizadas = null,
    parciaisPersonalizadas = null,
  } = options;

  return new Client({
    intents: intencoesPersonalizadas || 
             (usarIntencoesAgrupadas ? [
               ...INTENCOES_ESSENCIAIS,
               ...INTENCOES_DE_ESTADO,
               ...INTENCOES_DE_COMUNICACAO,
               ...INTENCOES_ADICIONAIS,
             ] : INTENCOES_TODAS),
    partials: parciaisPersonalizadas || PARCIAIS,
  });
}

/**
 * Versão simplificada usando as intenções planas (compatível com código 2)
 */
export function criarClienteDiscord() {
  return gerarClienteDiscord({ usarIntencoesAgrupadas: false });
}

/**
 * Exportações para compatibilidade
 */
export const LISTA_DE_PARCIAIS = PARCIAIS;
export const INTENCOES = INTENCOES_TODAS;