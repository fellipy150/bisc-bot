import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  guildId: { type: String, required: true },
  
  // --- ECONOMIA ---
  wallet: { type: Number, default: 0, min: 0 },
  bank: { type: Number, default: 0, min: 0 },
  
  // --- LEVELING ---
  xp: { type: Number, default: 0 },
  level: { type: Number, default: 1 },
  
  // --- ESTATÍSTICAS ---
  dailyStreak: { type: Number, default: 0 }, // Adicionado para suportar o daily
  
  // --- PERFIL SOCIAL ---
  profile: {
    bio: { type: String, default: "Olá! Sou novo por aqui." },
    background: { type: String, default: "default_bg.png" },
    badges: { type: [String], default: [] }
  },

  // --- SISTEMAS DE TEMPO (Cooldowns) ---
  cooldowns: {
    daily: { type: Date, default: null },
    work: { type: Date, default: null },
    crime: { type: Date, default: null },
    rob: { type: Date, default: null }
  },

  // --- INVENTÁRIO ---
  inventory: [{
    itemId: String,
    name: String,
    amount: Number,
    equipped: { type: Boolean, default: false }
  }],

  createdAt: { type: Date, default: Date.now }
});

userSchema.index({ userId: 1, guildId: 1 }, { unique: true });

export default mongoose.model('User', userSchema);