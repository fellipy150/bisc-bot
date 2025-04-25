/* 
=============
CONFIGURAÇÃO INICIAL
=============
*/

// Importando módulos necessários
const { Client, GatewayIntentBits } = require("discord.js"); // Biblioteca do Discord.js
const dotenv = require("dotenv"); // Para ler variáveis de ambiente do arquivo .env
const fs = require("fs"); // Módulo de sistema de arquivos do Node.js
const path = require("path"); // Para trabalhar com caminhos de arquivos/diretórios

// Carregar variáveis de ambiente do arquivo .env para process.env
dotenv.config();

/* 
=============
CRIAÇÃO DO CLIENTE DO DISCORD
=============
*/
// Intents são permissões que definem quais eventos o bot pode receber
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds, // Permite interagir com servidores
        GatewayIntentBits.GuildMessages, // Permite ver mensagens de servidores
        GatewayIntentBits.MessageContent // Permite ler conteúdo das mensagens
    ]
});

/* 
=============
SISTEMA DE COMANDOS
=============
*/

// Cria um mapa (dicionário) para armazenar todos os comandos
client.commands = new Map();

// Caminho para a pasta de comandos (usando path.join para compatibilidade entre sistemas)
const commandsPath = path.join(__dirname, "comandos");

// Lê todos as pastas dentro da pasta de comandos
const commandFolders = fs.readdirSync(commandsPath);

// Loop através de cada item dentro da pasta de comandos
for (const folder of commandFolders) {
    const folderPath = path.join(commandsPath, folder);

    // Verifique se é um diretório
    if (fs.statSync(folderPath).isDirectory()) {
        const commandFiles = fs
            .readdirSync(folderPath)
            .filter(file => file.endsWith(".js"));

        // Loop através de cada arquivo de comando
        for (const file of commandFiles) {
            const filePath = path.join(folderPath, file);
            const command = require(filePath); // Importa o comando

            // Verifica se o comando tem a estrutura correta
            if ("data" in command && "execute" in command) {
                // Adiciona o comando ao mapa usando o nome como chave
                client.commands.set(command.data.name, command);
            } else {
                console.log(
                    `[AVISO] O comando em ${filePath} está com formato incorreto.`
                );
            }
        }
    }
}

/* 
=============
EVENTOS DO BOT
=============
*/

// Evento disparado quando o bot fica online
client.once("ready", () => 
{
    console.log(` ${client.user.tag} está online!`);
    console.log(` Prefixo configurado: ${process.env.prefixo}`);
});

// Evento disparado sempre que uma mensagem é enviada
client.on("messageCreate", async message => {
    // Ignora mensagens de outros bots ou que não começam com o prefixo
    if (!message.content.startsWith(process.env.prefixo)) return;
    if (message.author.bot) return;

    // Separa o comando dos argumentos:
    // Exemplo: "!ping 123" vira ["ping", "123"]
    const args = message.content
        .slice(process.env.prefixo.length) // Remove o prefixo
        .trim() // Remove espaços extras
        .split(/ +/); // Divide por espaços
    
    const commandName = args.shift().toLowerCase(); // Pega o primeiro elemento (nome do comando)

    // Busca o comando no mapa de comandos
    const command = client.commands.get(commandName);

    // Se o comando não existir
    if (!command) {
        return message.reply(
            "Comando desconhecido! Use `!ajuda` para ver a lista."
        );
    }

    // Tenta executar o comando
    try {
        await command.execute(message, args);
    } catch (error) {
        console.error("Erro no comando:", error);
        message.reply("❌ Ops! Algo deu errado ao executar este comando.");
    }
});

/* 
=============
INICIALIZAÇÃO DO BOT
=============
*/
// Conecta o bot ao Discord usando o token do .env
client.login(process.env.BOT_TOKEN)
    .then(() => console.log("🤖 Iniciando conexão com o Discord..."))
    .catch(error => console.error("Falha na conexão:", error));