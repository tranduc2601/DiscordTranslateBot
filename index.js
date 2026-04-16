import 'dotenv/config';
import {
  Client,
  GatewayIntentBits,
  Partials,
  ContextMenuCommandBuilder,
  ApplicationCommandType,
  REST,
  Routes,
  MessageFlags,
  MessageType
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

const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbynmQBZAkl39sBoj6GzmMhSqjTYsnobBREIlaxIgrTAP0M2hXEM1vSwXu1WfGzPvYC8Qw/exec";

const app = express();
app.get('/', (_req, res) => res.send('Bot is running!'));
app.listen(process.env.PORT || 3000);

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.MessageContent
  ],
  partials: [Partials.Message, Partials.Channel, Partials.Reaction],
});

client.once('clientReady', async () => {
  console.log(`[Discord] Logged in as ${client.user.tag}`);
  const command = new ContextMenuCommandBuilder()
    .setName('Translate to VN')
    .setType(ApplicationCommandType.Message);

  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
  try {
    await rest.put(Routes.applicationCommands(client.user.id), {
      body: [command.toJSON()]
    });
  } catch (err) {}
});

// HỆ THỐNG XẾP HÀNG CHỐNG SPAM
let isTranslating = false;
const translateQueue = [];
const activeTranslations = new Set();

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
  } catch (e) {
    reject(e);
  }

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
  } catch (e) {
    return langCode.toUpperCase();
  }
}

// XÓA THÔNG BÁO HỆ THỐNG TẠO THREAD
client.on('messageCreate', async (message) => {
  if (message.type === MessageType.ThreadCreated && message.author.id === client.user.id) {
    try {
      await message.delete();
    } catch {}
  }
});

// LỆNH CHUỘT PHẢI
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isMessageContextMenuCommand() || interaction.commandName !== 'Translate to VN') return;

  const originalText = interaction.targetMessage.content?.trim();
  if (!originalText)
    return interaction.reply({
      content: 'Tin nhan rong.',
      flags: [MessageFlags.Ephemeral]
    });

  await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });

  try {
    const translated = await translateText(originalText, 'vi');
    await interaction.editReply(`Ban dich:\n${translated}`);
  } catch {
    await interaction.editReply('Loi dich thuat.');
  }
});

// LỆNH THẢ CỜ - DỊCH TỰ XÓA + LƯU KHO VÀO THREAD
client.on('messageReactionAdd', async (reaction, user) => {
  if (user.bot) return;
  if (reaction.partial) await reaction.fetch().catch(() => null);

  const message = reaction.message;
  if (message.partial) await message.fetch().catch(() => null);

  const emoji = reaction.emoji.name;
  const targetLang = FLAG_LANG_MAP[emoji];
  const originalText = message.content?.trim();

  if (!targetLang || !originalText) return;

  const lockKey = `${message.id}-${targetLang}`;
  const botReacted = message.reactions.cache.get(emoji)?.me;

  // CHỐNG DỊCH TRÙNG
  if (botReacted || activeTranslations.has(lockKey)) {
    const warnMsg = await message.reply({
      content: `<@${user.id}>, ngôn ngữ này đã được dịch. Mở **Chủ đề** dưới tin nhắn để xem.`,
      allowedMentions: { repliedUser: false }
    });
    setTimeout(() => warnMsg.delete().catch(() => null), 3000);
    return;
  }

  activeTranslations.add(lockKey);

  try {
    const translated = await translateText(originalText, targetLang);
    const langName = getNativeLangName(targetLang);

    // 1. GỬI BẢN DỊCH THẲNG RA KÊNH CHÍNH (Bọc Spoiler, đếm ngược 10s)
    const replyMsg = await message.reply({
      content: `Gửi <@${user.id}>, tự xóa sau 10s ⏳\nShow -> || **${translated}** ||`,
      allowedMentions: { repliedUser: false }
    });
    
    // Tự động bốc hơi khỏi kênh chat sau 10s
    setTimeout(() => replyMsg.delete().catch(() => null), 10000);

    // 2. TẠO HOẶC MỞ THREAD (Lưu kho vĩnh viễn)
    let thread = message.thread;
    if (!thread) {
      thread = await message.startThread({
        name: `Bản dịch / Translations`,
        autoArchiveDuration: 60,
        reason: 'Lưu trữ bản dịch'
      });
    } else if (thread.archived) {
      await thread.setArchived(false);
    }

    // 3. NHÉT BẢN SAO VÀO THREAD
    await thread.send(
      `**${langName}** - *Yêu cầu bởi ${user.username}:*\n\n${translated}`
    );

    // 4. ĐÓNG THREAD ẨN KHỎI CỘT TRÁI & THẢ CỜ ĐÁNH DẤU
    await thread.setArchived(true);
    await message.react(emoji);

  } catch (err) {
    console.error(err.message);
  } finally {
    activeTranslations.delete(lockKey);
  }
});

client.login(process.env.DISCORD_TOKEN);