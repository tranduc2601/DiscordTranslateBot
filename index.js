import 'dotenv/config';
import {
  Client,
  GatewayIntentBits,
  Partials,
  ContextMenuCommandBuilder,
  ApplicationCommandType,
  REST,
  Routes,
  MessageFlags
} from 'discord.js';
import { GoogleGenerativeAI } from '@google/generative-ai';
import express from 'express';

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

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
let workingModelName = ""; // Sẽ tự động tìm model khi bot chạy

// --- Server Keep-alive ---
const app = express();
app.get('/', (_req, res) => res.send('Bot is running!'));
app.listen(process.env.PORT || 3000);

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.GuildMessageReactions, GatewayIntentBits.MessageContent],
  partials: [Partials.Message, Partials.Channel, Partials.Reaction],
});

// HÀM TỰ ĐỘNG TÌM MODEL "SỐNG"
async function findWorkingModel() {
    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${process.env.GEMINI_API_KEY}`);
        const data = await response.json();
        const models = data.models || [];
        // Ưu tiên tìm model có chữ 'flash', nếu không lấy cái đầu tiên hỗ trợ generateContent
        const bestModel = models.find(m => m.name.includes('flash') && m.supportedGenerationMethods.includes('generateContent')) 
                        || models.find(m => m.supportedGenerationMethods.includes('generateContent'));
        
        if (bestModel) {
            workingModelName = bestModel.name.replace('models/', '');
            console.log(`✅ Đã tìm thấy model hoạt động: ${workingModelName}`);
            return true;
        }
        return false;
    } catch (e) {
        console.error("❌ Không thể lấy danh sách model:", e.message);
        return false;
    }
}

client.once('clientReady', async () => {
  console.log(`[Discord] Logged in as ${client.user.tag}`);
  const hasModel = await findWorkingModel();
  if (!hasModel) console.error("⚠️ CẢNH BÁO: Không tìm thấy model nào khả dụng trong tài khoản này!");

  const command = new ContextMenuCommandBuilder().setName('Translate to VN').setType(ApplicationCommandType.Message);
  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
  try {
    await rest.put(Routes.applicationCommands(client.user.id), { body: [command.toJSON()] });
    console.log('[Discord] Registered command: Translate to VN');
  } catch (err) { console.error('[Error] Command reg failed:', err); }
});

async function translateText(text, targetLang) {
    if (!workingModelName) throw new Error("Chưa xác định được model hoạt động.");
    const model = genAI.getGenerativeModel({ model: workingModelName });
    const result = await model.generateContent(`Translate to ISO code '${targetLang}', output only translation: "${text}"`);
    return result.response.text().trim();
}

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isMessageContextMenuCommand() || interaction.commandName !== 'Translate to VN') return;
  const originalText = interaction.targetMessage.content?.trim();
  if (!originalText) return interaction.reply({ content: '⚠️ Tin nhắn rỗng.', flags: [MessageFlags.Ephemeral] });

  await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });
  try {
    const translated = await translateText(originalText, 'vi');
    await interaction.editReply(`🇻🇳 **Bản dịch:**\n${translated}`);
  } catch (err) {
    console.error('[LỖI]:', err.message);
    await interaction.editReply(`⚠️ Lỗi: ${err.message}`);
  }
});

client.on('messageReactionAdd', async (reaction, user) => {
  if (user.bot) return;
  if (reaction.partial) await reaction.fetch().catch(() => null);
  if (reaction.message.partial) await reaction.message.fetch().catch(() => null);

  const targetLang = FLAG_LANG_MAP[reaction.emoji.name];
  const originalText = reaction.message.content?.trim();
  if (!targetLang || !originalText) return;

  try {
    const translated = await translateText(originalText, targetLang);
    const replyMsg = await reaction.message.reply({
      content: `Gửi <@${user.id}>, bản dịch tự xóa sau 10s ⏳\n\n${reaction.emoji.name} **(${targetLang}):**\n${translated}`,
      allowedMentions: { repliedUser: false } 
    });
    setTimeout(() => replyMsg.delete().catch(() => null), 10000);
  } catch (err) { console.error('[LỖI THẢ CỜ]:', err.message); }
});

client.login(process.env.DISCORD_TOKEN);