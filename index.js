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

// API GOOGLE BẤT TỬ CỦA BẠN (Giữ nguyên)
const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbynmQBZAkl39sBoj6GzmMhSqjTYsnobBREIlaxIgrTAP0M2hXEM1vSwXu1WfGzPvYC8Qw/exec";

const app = express();
app.get('/', (_req, res) => res.send('Bot is running!'));
app.listen(process.env.PORT || 3000);

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.GuildMessageReactions, GatewayIntentBits.MessageContent],
  partials: [Partials.Message, Partials.Channel, Partials.Reaction],
});

client.once('clientReady', async () => {
  console.log(`[Discord] Logged in as ${client.user.tag}`);
  const command = new ContextMenuCommandBuilder().setName('Translate to VN').setType(ApplicationCommandType.Message);
  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
  try { await rest.put(Routes.applicationCommands(client.user.id), { body: [command.toJSON()] }); } catch (err) {}
});

// HỆ THỐNG XẾP HÀNG CHỐNG CRASH
let isTranslating = false;
const translateQueue = [];
const activeTranslations = new Set(); // Bộ nhớ chống ấn trùng

async function processQueue() {
    if (isTranslating || translateQueue.length === 0) return;
    isTranslating = true;
    const { text, targetLang, resolve, reject } = translateQueue.shift();

    try {
        const response = await fetch(GOOGLE_SCRIPT_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: text, target: targetLang })
        });
        const translatedText = await response.text();
        resolve(translatedText);
    } catch (e) { reject(e); }

    setTimeout(() => {
        isTranslating = false;
        processQueue();
    }, 1000);
}

function translateText(text, targetLang) {
    return new Promise((resolve, reject) => {
        translateQueue.push({ text, targetLang, resolve, reject });
        processQueue();
    });
}

function getNativeLangName(langCode) {
    try {
        let code = langCode;
        if (code === 'zh-CN') code = 'zh-Hans';
        if (code === 'zh-TW') code = 'zh-Hant';
        const name = new Intl.DisplayNames([code], { type: 'language' }).of(code);
        return name.charAt(0).toUpperCase() + name.slice(1);
    } catch (e) { return langCode.toUpperCase(); }
}

// LỆNH CHUỘT PHẢI
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isMessageContextMenuCommand() || interaction.commandName !== 'Translate to VN') return;
  const originalText = interaction.targetMessage.content?.trim();
  if (!originalText) return interaction.reply({ content: '⚠️ Tin nhắn rỗng.', flags: [MessageFlags.Ephemeral] });

  await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });
  try {
    const translated = await translateText(originalText, 'vi');
    await interaction.editReply(`🇻🇳 **Bản dịch:**\n${translated}`);
  } catch (err) { await interaction.editReply('⚠️ Lỗi dịch thuật.'); }
});

// =========================================================
// LỆNH THẢ CỜ - TẠO CHỦ ĐỀ ẨN & TRẢ LẠI KÊNH CHAT SẠCH SẼ
// =========================================================
client.on('messageReactionAdd', async (reaction, user) => {
  if (user.bot) return;
  if (reaction.partial) await reaction.fetch().catch(() => null);
  
  const message = reaction.message;
  if (message.partial) await message.fetch().catch(() => null);

  const emoji = reaction.emoji.name;
  const targetLang = FLAG_LANG_MAP[emoji];
  const originalText = message.content?.trim();
  
  if (!targetLang || !originalText) return;

  // 1. KIỂM TRA CHỐNG DỊCH TRÙNG (Chuyển họ sang Chủ đề đã có)
  const lockKey = `${message.id}-${targetLang}`;
  const botReacted = message.reactions.cache.get(emoji)?.me;
  
  if (botReacted || activeTranslations.has(lockKey)) {
      const warnMsg = await message.reply({
          content: `⚠️ <@${user.id}>, ngôn ngữ ${emoji} đã được dịch rồi! Hãy nhấn vào biểu tượng **Chủ đề (Thread)** dưới tin nhắn gốc để xem lại nhé.`,
          allowedMentions: { repliedUser: false }
      });
      // Trả lại kênh chat sạch sẽ sau 10s
      setTimeout(() => warnMsg.delete().catch(() => null), 10000);
      return; // CẮT LUỒNG, KHÔNG DỊCH LẠI ĐỂ CHỐNG CRASH
  }

  activeTranslations.add(lockKey);

  try {
    const translated = await translateText(originalText, targetLang);
    const langName = getNativeLangName(targetLang); 
    
    // 2. TẠO HOẶC LẤY CHỦ ĐỀ (THREAD)
    let thread = message.thread;
    if (!thread) {
        thread = await message.startThread({
            name: `🌐 Bản dịch / Translations`,
            autoArchiveDuration: 60,
            reason: 'Lưu trữ bản dịch tự động'
        });
    } else if (thread.archived) {
        await thread.setArchived(false); // Mở lại tạm thời nếu Thread đã bị đóng
    }

    // 3. GỬI BẢN DỊCH VÀO CHỦ ĐỀ (Dùng Username, KHÔNG PING để tránh vướng cột trái)
    await thread.send(`${emoji} **${langName}:**\n*Người yêu cầu: ${user.username}*\n\n${translated}`);

    // 4. ĐÓNG (ARCHIVE) CHỦ ĐỀ NGAY LẬP TỨC ĐỂ ẨN NÓ KHỎI CỘT BÊN TRÁI CỦA MỌI NGƯỜI
    await thread.setArchived(true);

    // 5. BOT THẢ CỜ ĐỂ ĐÁNH DẤU
    await message.react(emoji);

    // 6. THÔNG BÁO CHO NGƯỜI DÙNG & TỰ XÓA SAU 10S (TRẢ KÊNH CHAT SẠCH BONG)
    const replyMsg = await message.reply({
        content: `✅ <@${user.id}>, đã dịch sang ${emoji}. Bản dịch đã được lưu gọn gàng trong **Chủ đề** bên dưới. Tin nhắn này sẽ tự xóa sau 10s ⏳`,
        allowedMentions: { repliedUser: false }
    });
    setTimeout(() => replyMsg.delete().catch(() => null), 10000);

  } catch (err) { 
    console.error('[LỖI THẢ CỜ]:', err.message);
  } finally {
    activeTranslations.delete(lockKey);
  }
});

client.login(process.env.DISCORD_TOKEN);