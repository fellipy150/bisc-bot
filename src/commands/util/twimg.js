import msg from '../../config/msg-handler.js';
import allData from '../../config/command_data.json' with { type: 'json' };
const d = allData["twimg"];

function limparLink(link) {
  try {
    const url = new URL(link);
    const [, user, status, id] = url.pathname.split("/");
    
    if (!id) return null;
    
    return `https://twitter.com/${user}/status/${id}`;
  } catch {
    return null;
  }
}

async function buscarVideoEmTwdown(tweetUrl) {
  try {
    const searchParams = new URLSearchParams();
    searchParams.append("URL", tweetUrl);

    const response = await fetch("https://twdown.net/download.php", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Safari/537.36",
        "Referer": "https://twdown.net/"
      },
      body: searchParams.toString(),
      signal: AbortSignal.timeout(15000) 
    });

    if (!response.ok) return null;

    const html = await response.text();
    const match = html.match(/https:\/\/[^"']+\.mp4[^"']*/);
    
    return match ? match[0] : null;
  } catch {
    return null;
  }
}

export default {
  data: {
    name: d.nome,
    aliases: d.apelidos,
    description: d.descricao,
    usage: d.uso,
    category: d.categoria
  },
  async execute(message, args, client) {
    const input = args[0];
    if (!input) {
      return message.reply("Você precisa enviar o link do tweet. Ex: `..twimg https://x.com/...`");
    }

    const urlFinal = limparLink(input);
    if (!urlFinal) {
      return message.reply("URL inválida ou link incompleto.");
    }

    try {
      await message.channel.sendTyping();
      
      const mp4 = await buscarVideoEmTwdown(urlFinal);
      
      if (mp4) {
        return message.reply(mp4);
      } else {
        return message.reply("Não consegui encontrar um vídeo nesse link. O tweet pode ser privado ou o serviço está instável.");
      }
    } catch {
      return message.reply("Ocorreu um erro ao tentar processar o vídeo.");
    }
  }
};

/*
@register-messages
{
  "twimg": {
    "_nota": "O JSON abaixo pode conter QUALQUER estrutura válida. Você pode adicionar objetos aninhados, múltiplas chaves, ou qualquer outro conteúdo necessário para o comando. O utilitário de sincronização fará merge profundo automaticamente.",
    "uso_incorreto": "⚠️ Uso incorreto! Tente: {uso}",
    "erro_interno": "❌ Ocorreu um erro ao processar este comando.",
    "mensagem_1": "Você precisa enviar o link do tweet. Ex: `..twimg https://x.com/...`",
    "mensagem_2": "URL inválida ou link incompleto.",
    "mensagem_3": "Não consegui encontrar um vídeo nesse link. O tweet pode ser privado ou o serviço está instável.",
    "mensagem_4": "Ocorreu um erro ao tentar processar o vídeo."
  }
}
@end
*/
