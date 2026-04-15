import 'dotenv/config';
import {
  Client,
  GatewayIntentBits,
  Partials,
  ContextMenuCommandBuilder,
  ApplicationCommandType,
  REST,
  Routes,
} from 'discord.js';
import { GoogleGenerativeAI } from '@google/generative-ai';
import express from 'express';

// ---------------------------------------------------------------------------
// Flag emoji  →  ISO 639-1 language code
// ---------------------------------------------------------------------------
const FLAG_LANG_MAP = {
  '🇦🇫': 'ps', '🇦🇱': 'sq', '🇦🇲': 'hy', '🇦🇷': 'es', '🇦🇺': 'en',
  '🇦🇿': 'az', '🇧🇩': 'bn', '🇧🇪': 'nl', '🇧🇬': 'bg', '🇧🇷': 'pt',
  '🇧🇾': 'be', '🇨🇦': 'en', '🇨🇳': 'zh-CN', '🇨🇿': 'cs', '🇩🇪': 'de',
  '🇩🇰': 'da', '🇪🇬': 'ar', '🇪🇸': 'es', '🇪🇹': 'am', '🇫🇮': 'fi',
  '🇫🇷': 'fr', '🇬🇧': 'en', '🇬🇪': 'ka', '🇬🇷': 'el', '🇭🇷': 'hr',
  '🇭🇺': 'hu', '🇮🇩': 'id', '🇮🇱': 'he', '🇮🇳': 'hi', '🇮🇶': 'ar',
  '🇮🇷': 'fa', '🇮🇸': 'is', '🇮🇹': 'it', '🇯🇵': 'ja', '🇰🇪': 'sw',
  '🇰🇭': 'km', '🇰🇷': 'ko', '🇰🇿': 'kk', '🇱🇦': 'lo', '🇱🇹': 'lt',
  '🇱🇻': 'lv', '🇲🇲': 'my', '🇲🇳': 'mn', '🇲🇾': 'ms', '🇳🇱': 'nl',
  '🇳🇴': 'no', '🇳🇵': 'ne', '🇳🇿': 'en', '🇵🇭': 'tl', '🇵🇰': 'ur',
  '🇵🇱': 'pl', '🇵🇹': 'pt', '🇷🇴': 'ro', '🇷🇸': 'sr', '🇷🇺': 'ru',
  '🇸🇦': 'ar', '🇸🇪': 'sv', '🇸🇬': 'en', '🇸🇮': 'sl', '🇸🇰': 'sk',
  '🇹🇭': 'th', '🇹🇷': 'tr', '🇹🇼': 'zh-TW', '🇺🇦': 'uk', '🇺🇸': 'en',
  '🇺🇿': 'uz', '🇻🇳': 'vi', '🇿🇦': 'af',
};

// ---------------------------------------------------------------------------
// Khởi tạo Gemini AI
// ---------------------------------------------------------------------------
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// ---------------------------------------------------------------------------
// Keep-alive Express server (Bắt buộc cho Render Web Service)
// ---------------------------------------------------------------------------
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (_req, res) => res.send('Bot is running!'));
app.listen(PORT, () => console.log(`[Server] Keep-alive listening on port ${PORT}`));

// ---------------------------------------------------------------------------
// Discord client
// ---------------------------------------------------------------------------
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Message, Partials.Channel, Partials.Reaction],
});

client.once('ready', async () => {
  console.log(`[Discord] Logged in as ${client.user.tag}`);

  const command = new ContextMenuCommandBuilder()
    .setName('Translate to VN')
    .setType(ApplicationCommandType.Message);

  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
  try {
    await rest.put(
      Routes.applicationCommands(client.user.id),
      { body: [command.toJSON()] },
    );
    console.log('[Discord] Registered context menu command: Translate to VN');
  } catch (err) {
    console.error('[Error] Failed to register command:', err);
  }
});

// ---------------------------------------------------------------------------
// Context Menu: Dịch tàng hình (Không làm rác kênh chat)
// ---------------------------------------------------------------------------
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isMessageContextMenuCommand()) return;
  if (interaction.commandName !== 'Translate to VN') return;

  const originalText = interaction.targetMessage.content?.trim();

  if (!originalText) {
    return interaction.reply({
      content: '⚠️ Tin nhắn này không có văn bản để dịch.',
      ephemeral: true,
    });
  }

  await interaction.deferReply({ ephemeral: true });

  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const prompt = `Dịch đoạn văn bản sau sang tiếng Việt một cách tự nhiên nhất. Chỉ trả về kết quả dịch, không giải thích gì thêm: "${originalText}"`;
    const result = await model.generateContent(prompt);
    
    await interaction.editReply(`🇻🇳 **Bản dịch:**\n${result.response.text().trim()}`);
  } catch (err) {
    console.error('[Error] Context Menu Translate failed:', err);
    await interaction.editReply('Lỗi dịch thuật. Vui lòng thử lại sau.');
  }
});

// ---------------------------------------------------------------------------
// Reaction Event: Dịch bằng AI & Tự hủy sau 10 giây
// ---------------------------------------------------------------------------
client.on('messageReactionAdd', async (reaction, user) => {
  if (user.bot) return;

  if (reaction.partial) {
    try { await reaction.fetch(); } catch (err) { return; }
  }

  if (reaction.message.partial) {
    try { await reaction.message.fetch(); } catch (err) { return; }
  }

  const emoji = reaction.emoji.name;
  const targetLang = FLAG_LANG_MAP[emoji];

  if (!targetLang) return;

  const originalText = reaction.message.content?.trim();
  if (!originalText) return;

  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const prompt = `Translate the following text to the language with ISO code '${targetLang}'. Provide ONLY the translation, keep the tone natural, keep any emojis, and do not add any explanations: "${originalText}"`;
    
    const result = await model.generateContent(prompt);
    const translatedText = result.response.text().trim();
    
    // Gửi tin nhắn trả lời thẳng vào kênh chat kèm thông báo đếm ngược 10s
    const replyMsg = await reaction.message.reply({
      content: `Gửi <@${user.id}>, this message will **be deleted in 10s** ⏳\n\n${emoji} **(${targetLang}):**\n${translatedText}`,
      allowedMentions: { repliedUser: false } 
    });

    // Xóa tin nhắn sau 10 giây (10000 mili-giây)
    setTimeout(async () => {
      try {
        if (replyMsg && replyMsg.deletable) {
          await replyMsg.delete();
        }
      } catch (deleteErr) {
        console.error('[Error] Failed to delete self-destructing message:', deleteErr);
      }
    }, 10000);

  } catch (err) {
    console.error('[Error] Reaction Translation failed:', err);
  }
});

client.login(process.env.DISCORD_TOKEN);