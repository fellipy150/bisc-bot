import mongoose from 'mongoose';

// Definindo o schema para as configurações de boas-vindas
const welcomeSchema = new mongoose.Schema(
  {
    guildId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    chatId: {
      type: String,
      required: true,
    },
    message: {
      content: {
        type: String,
        default: null,
      },
      embed: {
        // --- Adicionado: Title e URL principal ---
        title: {
          type: String,
          default: null,
        },
        url: {
          type: String,
          default: null,
        },
        // ----------------------------------------

        description: {
          type: String,
          default: null,
        },
        color: {
          type: String,
          default: '#ffffff',
        },

        // --- Adicionado: Fields (Array de objetos) ---
        fields: [
          {
            name: { type: String, required: true },
            value: { type: String, required: true },
            inline: { type: Boolean, default: false },
            _id: false, // Evita criar ID para cada field
          },
        ],
        // -------------------------------------------

        image: {
          url: {
            type: String,
            default: null,
          },
        },
        thumbnail: {
          url: {
            type: String,
            default: null,
          },
        },
        footer: {
          text: {
            type: String,
            default: '',
          },
          // --- Adicionado: Icon URL do Footer ---
          icon_url: {
            type: String,
            default: null,
          },
        },
        author: {
          name: {
            type: String,
            default: null,
          },
          // --- Adicionado: Icon URL e Link do Author ---
          icon_url: {
            type: String,
            default: null,
          },
          url: {
            type: String,
            default: null,
          },
        },
        // --- Adicionado: Timestamp ---
        timestamp: {
          type: Boolean,
          default: false,
        },
      },
    },
    enabled: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

// Middleware para garantir que `updatedAt` seja atualizado
welcomeSchema.pre('save', function (next) {
  this.updatedAt = Date.now();
  next();
});

const WelcomeModel = mongoose.model('Welcome', welcomeSchema);

export default WelcomeModel;
