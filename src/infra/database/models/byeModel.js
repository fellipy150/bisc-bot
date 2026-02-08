import mongoose from 'mongoose';

const byeSchema = new mongoose.Schema(
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
      content: { type: String, default: null },
      embed: {
        title: { type: String, default: null },
        url: { type: String, default: null },
        description: { type: String, default: null },
        color: { type: String, default: '#ffffff' },
        fields: [
          {
            name: { type: String, required: true },
            value: { type: String, required: true },
            inline: { type: Boolean, default: false },
            _id: false,
          },
        ],
        image: { url: { type: String, default: null } },
        thumbnail: { url: { type: String, default: null } },
        footer: {
          text: { type: String, default: '' },
          icon_url: { type: String, default: null },
        },
        author: {
          name: { type: String, default: null },
          icon_url: { type: String, default: null },
          url: { type: String, default: null },
        },
        timestamp: { type: Boolean, default: false },
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

byeSchema.pre('save', function (next) {
  this.updatedAt = Date.now();
  next();
});

const ByeModel = mongoose.model('Bye', byeSchema);

export default ByeModel;
