import msg from '../../config/msg-handler.js';
import allData from '../../config/command_data.json' with { type: 'json' };
const d = allData["ping"];
export default {
  data: {
    name: d.nome,
    aliases: d.apelidos,
    description: d.descricao,
    usage: d.uso,
    category: d.categoria
  },
  async execute(message) {
    const t1 = message.createdTimestamp;
    const t2 = Date.now();
    const pongMessage = await message.reply(msg("ping.calculando_latencias"));
    const t3 = Date.now();
    const processamentoParaResposta = t3 - t2;
    const tempoTotal = pongMessage.createdTimestamp - t1;
    const envioParaProcessamento = Math.max(0, tempoTotal - processamentoParaResposta);
    await pongMessage.edit(
        msg("ping.resultado_ping", { envioParaProcessamento, processamentoParaResposta, tempoTotal }));
  }
};

/*
@register-messages
{
  "ping": {
    "_observacao": "O JSON abaixo pode conter QUALQUER estrutura válida. Você pode adicionar objetos aninhados, múltiplas chaves, ou qualquer outro conteúdo necessário para o comando. O utilitário de sincronização fará merge profundo automaticamente.",
    "calculando_latencias": "🏓 Pong! Calculando latências...",
    "resultado_ping": "🏓 **Pong!**\n\n**Detalhes do Tempo de Resposta:**\n* **Envio até Processamento:** `{envioParaProcessamento}ms`\n* **Processamento até Resposta:** `{processamentoParaResposta}ms`\n* **Tempo Total (Envio até Resposta):** `{tempoTotal}ms`"
  }
}
@end
*/
