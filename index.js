// Importando as dependências necessárias
const { Client, GatewayIntentBits } = require('discord.js');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');

// Carregar variáveis de ambiente do arquivo .env
dotenv.config();

// Criar uma nova instância do cliente do Discord
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// Objeto para armazenar os comandos
client.commands = new Map();

// Carregar comandos da pasta 'comandos'
const commandsPath = path.join(__dirname, 'src', 'comandos');
const commandFolders = fs.readdirSync(commandsPath);

for (const folder of commandFolders) {
  const folderPath = path.join(commandsPath, folder);
  const commandFiles = fs.readdirSync(folderPath).filter(file => file.endsWith('.js'));
  
  for (const file of commandFiles) {
    const filePath = path.join(folderPath, file);
    const command = require(filePath);
    
    // Adicionar o comando à coleção com o nome como chave
    if ('data' in command && 'execute' in command) {
      client.commands.set(command.data.name, command);
    } else {
      console.log(`[AVISO] O comando em ${filePath} está faltando as propriedades "data" ou "execute".`);
    }
  }
}

// Evento: Quando o bot está pronto
client.once('ready', () => {
  console.log(`✅ ${client.user.tag} está online!`);
  console.log(`📂 Prefixo configurado: ${process.env.PREFIX}`);
});

// Evento: Quando uma mensagem é recebida
client.on('messageCreate', async message => {
  // Ignorar mensagens de outros bots ou que não começam com o prefixo
  if (!message.content.startsWith(process.env.PREFIX) || message.author.bot) return;

  // Separar os argumentos do comando
  const args = message.content.slice(process.env.PREFIX.length).trim().split(/ +/);
  const commandName = args.shift().toLowerCase();

  // Verificar se o comando existe
  const command = client.commands.get(commandName);

  if (!command) {
    return message.reply('Esse comando não existe! Digite `!ajuda` para ver os comandos disponíveis.');
  }

  try {
    // Executar o comando
    await command.execute(message, args);
  } catch (error) {
    console.error(error);
    message.reply('Ocorreu um erro ao executar esse comando!');
  }
});

// Iniciar o bot usando o token do .env
client.login(process.env.BOT_TOKEN);