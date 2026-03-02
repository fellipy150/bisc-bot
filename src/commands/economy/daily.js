import msg from '../../config/msg-handler.js';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

import allData from '../../config/command_data.json' with { type: 'json' };
// Vamos usar apenas getUser. Vamos salvar as alterações diretamente no objeto.
import { getUser } from '../../infra/database/services/userService.js';

const COMMAND_DATA = allData["daily"];
const DAILY_COOLDOWN_HOURS = 24;
const COOLDOWN_MS = DAILY_COOLDOWN_HOURS * 60 * 60 * 1000;
const RESET_STREAK_MS = 48 * 60 * 60 * 1000;

// Configurações de Recompensa
const BASE_CASH_REWARD = 500;
const BASE_XP_REWARD = 100;
const STREAK_BONUS_PERCENT = 5;
const MAX_STREAK_DAYS = 7;
const XP_PER_STREAK_DAY = 10;
const PROGRESS_BAR_LENGTH = 10;

function formatCooldownTime(remainingMilliseconds) {
    const hours = Math.floor(remainingMilliseconds / (1000 * 60 * 60));
    const minutes = Math.floor((remainingMilliseconds % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((remainingMilliseconds % (1000 * 60)) / 1000);

    const timeParts = [];
    if (hours > 0) timeParts.push(`${hours}h`);
    if (minutes > 0) timeParts.push(`${minutes}m`);
    if (seconds > 0) timeParts.push(`${seconds}s`);

    return timeParts.join(' ');
}

function createProgressBar(percentage) {
    const filledBlocks = Math.floor(percentage / 100 * PROGRESS_BAR_LENGTH);
    const emptyBlocks = PROGRESS_BAR_LENGTH - filledBlocks;
    return `[${'█'.repeat(filledBlocks)}${'░'.repeat(emptyBlocks)}] ${percentage.toFixed(1)}%`;
}

function calculateRewards(streakDays) {
    const effectiveStreak = Math.min(streakDays, MAX_STREAK_DAYS);
    const streakMultiplier = 1 + (effectiveStreak * STREAK_BONUS_PERCENT / 100);
    
    const cashReward = Math.floor(BASE_CASH_REWARD * streakMultiplier);
    const xpReward = BASE_XP_REWARD + (streakDays * XP_PER_STREAK_DAY);
    
    return { cashReward, xpReward, bonusPercent: (streakMultiplier - 1) * 100 };
}

function createSuccessEmbed(user, rewards, updatedData, avatarUrl) {
    const totalWallet = user.wallet; // O wallet já foi atualizado no objeto user antes de chamar essa função
    const streakMessage = updatedData.dailyStreak > 1 ? 
        `🔥 Você está em uma sequência de **${updatedData.dailyStreak} dias**!` : 
        'Esta é sua primeira recompensa diária (ou você perdeu a sequência). Volte amanhã!';

    return {
        color: 0x00FF00,
        title: '📅 Recompensa Diária Resgatada',
        description: `Olá ${user.username}, aqui está seu pagamento diário! ${streakMessage}`,
        thumbnail: { url: avatarUrl },
        fields: [
            {
                name: '💎 Seus ganhos de hoje',
                value: `💰 Dinheiro: **R$ ${rewards.cashReward.toLocaleString()}** ${rewards.bonusPercent > 0 ? `(+${Math.round(rewards.bonusPercent)}% bônus)` : ''}\n✨ XP: **${rewards.xpReward.toLocaleString()}**`
            },
            {
                name: '🏦 Saldo atualizado',
                value: `Carteira: **R$ ${totalWallet.toLocaleString()}**`
            }
        ],
        footer: {
            text: `Volte em 24h para mais! | ID: ${user.id}`,
            icon_url: user.guildIcon
        },
        timestamp: new Date()
    };
}

function createCooldownMessage(remainingTime, cooldownPercentage) {
    const formattedTime = formatCooldownTime(remainingTime);
    const progressBar = createProgressBar(cooldownPercentage);
    
    return `⏳ **Calma lá!** Você já pegou seu diário hoje.\n\nEspere mais **${formattedTime}** para resgatar novamente.\n${progressBar}`;
}

export default {
    data: {
        name: COMMAND_DATA.nome,
        aliases: COMMAND_DATA.apelidos,
        description: COMMAND_DATA.descricao,
        usage: COMMAND_DATA.uso,
        category: COMMAND_DATA.categoria
    },
    
    async execute(message, args, client) {
        try {
            const userId = message.author.id;
            const guildId = message.guild.id;
            
            // Pega o documento do usuário (Mongoose Document)
            const user = await getUser(userId, guildId);
            
            const now = Date.now();
            
            // Garante que o objeto cooldowns existe
            if (!user.cooldowns) {
                user.cooldowns = {};
            }

            // Pega o timestamp corretamente acessando o objeto
            const lastDailyTime = user.cooldowns.daily ? new Date(user.cooldowns.daily).getTime() : 0;
            const timeSinceLastDaily = now - lastDailyTime;

            // 1. Verificação de Cooldown
            if (timeSinceLastDaily < COOLDOWN_MS) {
                const remainingTime = COOLDOWN_MS - timeSinceLastDaily;
                const cooldownPercentage = (timeSinceLastDaily / COOLDOWN_MS) * 100;
                
                const cooldownMessage = createCooldownMessage(remainingTime, cooldownPercentage);
                return message.reply(cooldownMessage);
            }

            // 2. Cálculo de Streak
            let currentStreak = user.dailyStreak || 0;
            
            // Reset se passou mais de 48h
            if (timeSinceLastDaily > RESET_STREAK_MS && lastDailyTime !== 0) {
                currentStreak = 0;
            }

            const newStreak = currentStreak + 1;
            const rewards = calculateRewards(newStreak);
            
            // 3. Modificação Direta no Objeto (A CORREÇÃO PRINCIPAL)
            // Ao invés de usar updateUser, modificamos as propriedades diretamente.
            // O Mongoose detecta mudanças em propriedades aninhadas assim.
            
            user.cooldowns.daily = now; // Atualiza o cooldown
            user.dailyStreak = newStreak; // Atualiza o streak
            user.xp += rewards.xpReward; // Adiciona XP
            user.wallet += rewards.cashReward; // Adiciona dinheiro direto na carteira
            
            // Verifica Level Up
            const nextLevelXp = user.level * 500;
            if (user.xp >= nextLevelXp) {
                user.level += 1;
                user.xp = user.xp - nextLevelXp;
                await message.channel.send(msg("daily.erro_daily", { "author": message.author, "level": user.level }));
            }

            // Salva TODAS as alterações de uma vez só no banco de dados
            await user.save();
            
            // 4. Resposta Visual
            const embed = createSuccessEmbed(
                { 
                    username: message.author.username, 
                    wallet: user.wallet, 
                    id: userId,
                    guildIcon: message.guild.iconURL()
                },
                rewards,
                { dailyStreak: newStreak },
                message.author.displayAvatarURL({ dynamic: true })
            );

            const replyMessage = await message.reply({ embeds: [embed] });
            
            try {
                await replyMessage.react('✅');
            } catch {}

        } catch (error) {
            console.error('Erro ao executar comando daily:', error);
            await message.reply(msg("daily.mensagem_2"));
        }
    }
};

/*
@register-messages
{
  "daily": {
    "mensagem_2": "❌ Ocorreu um erro ao processar seu daily. Tente novamente.",
    "_observacao": "O JSON abaixo pode conter QUALQUER estrutura válida. Você pode adicionar objetos aninhados, múltiplas chaves, ou qualquer outro conteúdo necessário para o comando. O utilitário de sincronização fará merge profundo automaticamente.",
    "erro_daily": "🎉 Parabéns {author}! Você subiu para o **Nível {level}**!"
  }
}
@end
*/
