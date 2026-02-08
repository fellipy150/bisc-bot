import User from '../models/userModel.js';
// --- BASE ---
// Busca ou cria utilizador
export const getUser = async (userId, guildId) => {
  let user = await User.findOne({ userId, guildId });
  if (!user) {
    user = await User.create({ userId, guildId });
  }
  return user;
};

// --- LEVELING (XP) ---
// Adiciona XP e verifica subida de nível
export const addXp = async (userId, guildId, amount) => {
  const user = await getUser(userId, guildId);
  user.xp += amount;
  
  // Fórmula: Nível * 500 XP para subir (ex: Nvl 1 precisa de 500, Nvl 2 precisa de 1000)
  const nextLevelXp = user.level * 500;
  let leveledUp = false;

  if (user.xp >= nextLevelXp) {
    user.level += 1;
    user.xp = user.xp - nextLevelXp; // Mantém o XP excedente
    leveledUp = true;
  }
  
  await user.save();
  return { user, leveledUp };
};

// --- ECONOMIA (Biscoin) ---
// Adiciona dinheiro (Carteira ou Banco)
export const addBiscoins = async (userId, guildId, amount, destination = 'wallet') => {
  const user = await getUser(userId, guildId);
  if (destination === 'bank') {
    user.bank += amount;
  } else {
    user.wallet += amount;
  }
  return await user.save();
};

// Remove dinheiro de forma segura (verifica saldo antes)
// Retorna true se sucesso, false se saldo insuficiente
export const removeBiscoins = async (userId, guildId, amount, source = 'wallet') => {
  const user = await getUser(userId, guildId);
  const balance = source === 'bank' ? user.bank : user.wallet;

  if (balance < amount) return false; // Saldo insuficiente

  if (source === 'bank') {
    user.bank -= amount;
  } else {
    user.wallet -= amount;
  }
  
  await user.save();
  return true;
};

// --- UTILITÁRIOS E LEGADO ---
// Função genérica para atualizar dados (necessária para comandos antigos ou admin)
export const updateUser = async (userId, guildId, updateData) => {
  const user = await getUser(userId, guildId);
  
  Object.keys(updateData).forEach(key => {
    user[key] = updateData[key];
  });

  return await user.save();
};

// --- SISTEMA DE BANCO ---
export const bankTransaction = async (userId, guildId, amount, type) => {
  const user = await getUser(userId, guildId);
  
  if (type === 'deposit') {
    if (user.wallet < amount) return { success: false, reason: "Dinheiro insuficiente na carteira." };
    user.wallet -= amount;
    user.bank += amount;
  } else if (type === 'withdraw') {
    if (user.bank < amount) return { success: false, reason: "Dinheiro insuficiente no banco." };
    user.bank -= amount;
    user.wallet += amount;
  }

  await user.save();
  return { success: true, newWallet: user.wallet, newBank: user.bank };
};

// --- SISTEMA DE COOLDOWN ---
export const checkCooldown = async (userId, guildId, commandName, cooldownTimeMs) => {
  const user = await getUser(userId, guildId);
  // Garante que o objeto cooldowns existe
  if (!user.cooldowns) user.cooldowns = {};
  
  const lastTime = user.cooldowns[commandName] ? new Date(user.cooldowns[commandName]).getTime() : 0;
  const now = Date.now();

  if (now - lastTime < cooldownTimeMs) {
    return { canUse: false, timeLeft: (lastTime + cooldownTimeMs) - now };
  }

  return { canUse: true };
};

export const setCooldown = async (userId, guildId, commandName) => {
  const user = await getUser(userId, guildId);
  if (!user.cooldowns) user.cooldowns = {};
  
  user.cooldowns[commandName] = new Date();
  await user.save();
};
