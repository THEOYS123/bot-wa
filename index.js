
console.log('[DEBUG] Skrip dimulai...');
require('dotenv').config();
console.log('[DEBUG] dotenv dimuat.');

const fs = require('fs');
const path = require('path');
const P = require('pino');
const qrcode = require('qrcode');
const qrcodeTerminal = require('qrcode-terminal');

const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    fetchLatestBaileysVersion,
    downloadMediaMessage
} = require('@whiskeysockets/baileys');
console.log('[DEBUG] @whiskeysockets/baileys dimuat.');

const { GoogleGenerativeAI } = require('@google/generative-ai');
console.log('[DEBUG] @google/generative-ai dimuat.');

console.log('[DEBUG] pino, qrcode libs dimuat.');

if (!process.env.GEMINI_API_KEYS) {
    console.error('❌ Error: GEMINI_API_KEYS tidak ditemukan di file .env');
    process.exit(1);
}
if (!process.env.OWNER_NUMBER) {
    console.error('❌ Error: OWNER_NUMBER tidak ditemukan di file .env. Silakan tambahkan nomor Anda.');
    process.exit(1);
}

const apiKeys = process.env.GEMINI_API_KEYS.split(',').map(k => k.trim()).filter(k => k.length > 0);
if (apiKeys.length === 0) {
    console.error('❌ Error: Tidak ada API Key yang valid di dalam GEMINI_API_KEYS di file .env');
    process.exit(1);
}

let currentApiKeyIndex = 0;
let currentModel = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
let botMode = 'private'; // 'private' | 'group' | 'all'
let isBotActive = true; // true = ON for all, false = only owner
const ownerFile = '.owner';
let owners = new Set();
const startTime = new Date();
const chatHistories = new Map();
let systemInstruction = process.env.SYSTEM_INSTRUCTION || 'Aku adalah asisten AI WhatsApp yang canggih, ramah, dan sangat membantu. Jawablah dengan format yang rapi menggunakan markdown WhatsApp.';

const cooldowns = new Map();
const COOLDOWN_MS = 3000; // 3 detik

const CT_DIR = path.join(__dirname, 'cybertools');
const cyberModules = {};
const cyberModuleNames = ['scanUrl','whois','dnslookup','portscan','ipinfo','headers','techdetect','subfinder','shorturl','expandurl','nmap'];

for (const name of cyberModuleNames) {
    try {
        const modPath = path.join(CT_DIR, `${name}.js`);
        if (fs.existsSync(modPath)) {
            cyberModules[name] = require(modPath);
            console.log(`✅ Module cybertools/${name}.js loaded.`);
        } else {
            cyberModules[name] = null;
            console.warn(`⚠️ Module cybertools/${name}.js not found.`);
        }
    } catch (e) {
        cyberModules[name] = null;
        console.error(`⚠️ Error load module ${name}:`, e.message);
    }
}

function formatUptime(ms) {
    const d = Math.floor(ms / (1000 * 60 * 60 * 24));
    const h = Math.floor((ms % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const m = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
    const s = Math.floor((ms % (1000 * 60)) / 1000);
    return `${d} hari, ${h} jam, ${m} menit, ${s} detik`;
}

function safeReadOwnerFile() {
    try {
        if (!fs.existsSync(ownerFile)) return [];
        const stat = fs.statSync(ownerFile);
        if (stat.isDirectory()) {
            console.warn(`⚠️ ${ownerFile} adalah directory! Mengabaikan isinya.`);
            return [];
        }
        const content = fs.readFileSync(ownerFile, 'utf-8');
        return content.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    } catch (err) {
        console.error('⚠️ Gagal baca .owner:', err.message);
        return [];
    }
}

function loadOwners() {
    owners.clear();
    const mainOwner = `${process.env.OWNER_NUMBER.replace(/[^0-9]/g, '')}@s.whatsapp.net`;
    owners.add(mainOwner);
    const extra = safeReadOwnerFile();
    extra.forEach(line => {
        let normalized = line.replace(/[@\s+-]/g, '');
        if (!normalized.endsWith('@s.whatsapp.net')) normalized = normalized + '@s.whatsapp.net';
        owners.add(normalized);
    });
    console.log(`👑 Owner yang terdaftar: ${[...owners].join(', ')}`);
}

function saveOwners() {
    try {
        const mainOwner = `${process.env.OWNER_NUMBER.replace(/[^0-9]/g, '')}@s.whatsapp.net`;
        const ownersToSave = [...owners].filter(j => j !== mainOwner).map(j => j.split('@')[0]);
        fs.writeFileSync(ownerFile, ownersToSave.join('\n'), 'utf-8');
        console.log('💾 Daftar owner tambahan disimpan.');
    } catch (err) {
        console.error('⚠️ Gagal menyimpan .owner:', err.message);
    }
}

function isOnCooldown(jid) {
    const last = cooldowns.get(jid) || 0;
    return (Date.now() - last) < COOLDOWN_MS;
}
function setCooldown(jid) {
    cooldowns.set(jid, Date.now());
}

async function askGemini(prompt, history = [], imageBuffer = null, model = currentModel) {
    const maxRetries = apiKeys.length;
    for (let i = 0; i < maxRetries; i++) {
        const currentKey = apiKeys[currentApiKeyIndex];
        try {
            console.log(`🧠 Menghubungi Gemini (Key #${currentApiKeyIndex + 1}) Model: ${model}`);
            const ai = new GoogleGenerativeAI(currentKey);
            const modelAI = ai.getGenerativeModel({
                model,
                systemInstruction: systemInstruction,
            });

            const contentParts = [{ text: prompt }];

            if (imageBuffer) {
                contentParts.push({
                    inlineData: {
                        mimeType: 'image/jpeg',
                        data: imageBuffer.toString('base64'),
                    },
                });
            }

            const contents = [...history, { role: "user", parts: contentParts }];
            const result = await modelAI.generateContent({ contents });
            const response = result.response;

            if (!response || !response.candidates || response.candidates.length === 0 || !response.candidates[0].content) {
                const blockReason = response?.promptFeedback?.blockReason || 'Tidak ada konten';
                console.warn(`⚠️ Respons diblokir atau kosong (Key #${currentApiKeyIndex + 1}): ${blockReason}`);
                if (blockReason === 'SAFETY') {
                    return { text: `⚠️ Maaf, respons saya diblokir karena alasan keamanan/safety. Coba gunakan prompt lain.`, history };
                }
                throw new Error(`Respons diblokir atau kosong: ${blockReason}`);
            }

            console.log(`✅ Respons valid dengan API Key #${currentApiKeyIndex + 1}.`);

            const candidate = response.candidates[0].content;
            const newHistory = [...contents, candidate];
            const textOut = (typeof response.text === 'function') ? response.text() : (response.outputText || candidate?.text || '');

            return { text: textOut, history: newHistory };

        } catch (err) {
            console.error(`❌ Gagal dengan API Key #${currentApiKeyIndex + 1}. Error: ${err.message}`);
            currentApiKeyIndex = (currentApiKeyIndex + 1) % apiKeys.length;
            console.log(`🔄 Beralih ke API Key #${currentApiKeyIndex + 1}...`);
        }
    }
    console.error('❌ Semua API Key yang tersedia gagal.');
    return { text: '⚠️ Maaf, semua koneksi ke AI sedang sibuk atau bermasalah. Coba lagi dalam beberapa saat.', history: [] };
}

async function start() {
    loadOwners();
    const { state, saveCreds } = await useMultiFileAuthState('./auth');
    const { version, isLatest } = await fetchLatestBaileysVersion();
    console.log(`🔌 Menggunakan Baileys versi ${version.join('.')}, latest: ${isLatest}`);
    console.log(`🔑 Ditemukan ${apiKeys.length} API Key.`);
    console.log(`✨ System Instruction: "${systemInstruction.substring(0, 50)}..."`);

    const sock = makeWASocket({
        version,
        auth: state,
        logger: P({ level: 'silent' }),
        shouldIgnoreJid: () => false,
        browser: ['GeminiBot (Canggih Cyber)', 'Chrome', '1.0.0']
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;
        if (qr) {
            console.log('📱 Scan QR Code berikut untuk login WhatsApp:');
            qrcodeTerminal.generate(qr, { small: true });
        }
        if (connection === 'close') {
            const reason = lastDisconnect?.error?.output?.statusCode;
            const reasonText = DisconnectReason[reason] || `Unknown (${reason})`;
            console.log(`❌ Koneksi ditutup, alasan: ${reasonText}`);
            if (reason !== DisconnectReason.loggedOut) {
                console.log('🔄 Mencoba menghubungkan kembali...');
                setTimeout(() => start().catch(console.error), 2000);
            } else {
                console.log('🚫 Logout berhasil. Hapus folder ./auth untuk login ulang.');
            }
        } else if (connection === 'open') {
            console.log('✅ Bot berhasil terhubung ke WhatsApp!');
        }
    });

    sock.ev.on('messages.upsert', async (m) => {
        for (const msg of m.messages) {
            try {
                if (!msg.message || msg.key.fromMe || msg.key.remoteJid === 'status@broadcast') {
                    continue;
                }

                const from = msg.key.remoteJid;
                const isGroup = from.endsWith('@g.us');
                const sender = isGroup ? (msg.key.participant || from) : from;
                const isOwner = owners.has(sender);

                if (!isBotActive && !isOwner) {
                    console.log(`[BOT OFF] Pesan dari ${msg.pushName || sender.split('@')[0]} diabaikan.`);
                    continue; // Hentikan pemrosesan jika bot OFF dan pengirim bukan owner
                }

                const isImage = !!msg.message.imageMessage;
                const isVideo = !!msg.message.videoMessage;
                const quotedMsg = msg.message.extendedTextMessage?.contextInfo?.quotedMessage;
                const isQuotedImage = !!quotedMsg?.imageMessage;
                const isQuotedVideo = !!quotedMsg?.videoMessage;

                const text = msg.message.conversation || msg.message.extendedTextMessage?.text || msg.message.imageMessage?.caption || msg.message.videoMessage?.caption || '';

                if (!text.trim() && !isImage && !isVideo && !quotedMsg) continue;

                console.log(`💬 ${isGroup ? '[GROUP]' : '[PRIVATE]'} dari ${msg.pushName || sender.split('@')[0]}: "${text.substring(0, 50)}${isImage || isQuotedImage ? ' [Gambar]' : ''}${isVideo || isQuotedVideo ? ' [Video]' : ''}"`);

                if (text.startsWith('/')) {
                    const [cmd, ...args] = text.trim().split(' ');
                    const command = cmd.toLowerCase();
                    const argText = args.join(' ');

                    if (['/model', '/mode', '/addowner', '/delowner', '/listowner', '/system', '/link', '/stats', '/on', '/off', '/cybermenu'].includes(command)) {
                        if (!isOwner) {
                            await sock.sendMessage(from, { text: '❌ Perintah ini hanya untuk Owner Bot.' }, { quoted: msg });
                            continue;
                        }

                        switch (command) {
                            case '/on': {
                                if (isBotActive) {
                                    await sock.sendMessage(from, { text: 'ℹ️ Bot sudah dalam keadaan ON.' }, { quoted: msg });
                                } else {
                                    isBotActive = true;
                                    await sock.sendMessage(from, { text: '✅ Bot berhasil diaktifkan. Sekarang semua orang dapat menggunakan bot.' }, { quoted: msg });
                                    console.log(`[STATUS] Bot diaktifkan oleh owner.`);
                                }
                                break;
                            }
                            case '/off': {
                                if (!isBotActive) {
                                    await sock.sendMessage(from, { text: 'ℹ️ Bot sudah dalam keadaan OFF.' }, { quoted: msg });
                                } else {
                                    isBotActive = false;
                                    await sock.sendMessage(from, { text: '🛑 Bot berhasil dinonaktifkan. Hanya owner yang dapat menggunakan bot.' }, { quoted: msg });
                                    console.log(`[STATUS] Bot dinonaktifkan oleh owner.`);
                                }
                                break;
                            }
                            case '/model': {
                                if (!argText) {
                                    await sock.sendMessage(from, { text: `Gunakan: \`/model <nama_model>\`\nModel sekarang: \`${currentModel}\`\nContoh: \`/model gemini-1.5-pro-latest\`` }, { quoted: msg });
                                } else {
                                    currentModel = argText;
                                    await sock.sendMessage(from, { text: `✅ Model AI berhasil diubah menjadi *${currentModel}*` }, { quoted: msg });
                                }
                                break;
                            }
                            case '/mode': {
                                const newMode = argText.toLowerCase();
                                if (!['private', 'group', 'all'].includes(newMode)) {
                                    await sock.sendMessage(from, { text: `Gunakan: \`/mode <private|group|all>\`\nMode sekarang: *${botMode}*` }, { quoted: msg });
                                } else {
                                    botMode = newMode;
                                    await sock.sendMessage(from, { text: `✅ Mode bot diubah ke *${botMode.toUpperCase()}*` }, { quoted: msg });
                                }
                                break;
                            }
                            case '/system': {
                                if (!argText) {
                                    await sock.sendMessage(from, { text: `Gunakan: \`/system <instruksi>\`\nInstruksi sekarang: \n\n_${systemInstruction}_` }, { quoted: msg });
                                } else {
                                    systemInstruction = argText;
                                    chatHistories.clear();
                                    await sock.sendMessage(from, { text: `✅ Instruksi sistem diubah. Semua riwayat percakapan telah direset.` }, { quoted: msg });
                                }
                                break;
                            }
                            case '/addowner': {
                                let newOwnerJid;
                                if (argText) {
                                    newOwnerJid = argText.replace(/[@\s+-]/g, '') + '@s.whatsapp.net';
                                } else if (msg.message.extendedTextMessage?.contextInfo?.mentionedJid?.length > 0) {
                                    newOwnerJid = msg.message.extendedTextMessage.contextInfo.mentionedJid[0];
                                } else {
                                    await sock.sendMessage(from, { text: 'Gunakan: `/addowner <nomor>` atau mention pengguna.' }, { quoted: msg });
                                    break;
                                }
                                if (owners.has(newOwnerJid)) {
                                    await sock.sendMessage(from, { text: 'Nomor ini sudah menjadi owner.' }, { quoted: msg });
                                    break;
                                }
                                owners.add(newOwnerJid);
                                saveOwners();
                                await sock.sendMessage(from, { text: `✅ Berhasil menambahkan ${newOwnerJid.split('@')[0]} sebagai owner baru.` }, { quoted: msg });
                                break;
                            }
                            case '/delowner': {
                                let ownerToDel;
                                if (argText) {
                                    ownerToDel = argText.replace(/[@\s+-]/g, '') + '@s.whatsapp.net';
                                } else if (msg.message.extendedTextMessage?.contextInfo?.mentionedJid?.length > 0) {
                                    ownerToDel = msg.message.extendedTextMessage.contextInfo.mentionedJid[0];
                                } else {
                                    await sock.sendMessage(from, { text: 'Gunakan: `/delowner <nomor>` atau mention pengguna.' }, { quoted: msg });
                                    break;
                                }
                                if (ownerToDel === `${process.env.OWNER_NUMBER}@s.whatsapp.net`) {
                                    await sock.sendMessage(from, { text: 'Tidak dapat menghapus owner utama dari .env.' }, { quoted: msg });
                                    break;
                                }
                                if (!owners.has(ownerToDel)) {
                                    await sock.sendMessage(from, { text: 'Nomor ini bukan owner.' }, { quoted: msg });
                                    break;
                                }
                                owners.delete(ownerToDel);
                                saveOwners();
                                await sock.sendMessage(from, { text: `✅ Berhasil menghapus ${ownerToDel.split('@')[0]} dari daftar owner.` }, { quoted: msg });
                                break;
                            }
                            case '/listowner': {
                                let ownerList = '👑 *Daftar Owner Bot*\n\n';
                                let i = 1;
                                for (const owner of owners) {
                                    ownerList += `${i}. ${owner.split('@')[0]} ${owner === `${process.env.OWNER_NUMBER.replace(/[^0-9]/g,'')}@s.whatsapp.net` ? '(Utama)' : ''}\n`;
                                    i++;
                                }
                                await sock.sendMessage(from, { text: ownerList }, { quoted: msg });
                                break;
                            }
                            case '/stats': {
                                const uptime = formatUptime(new Date() - startTime);
                                const statsText = `📊 *Statistik Bot*

▶️ Status Bot: *${isBotActive ? 'ON' : 'OFF'}*
🕒 Uptime: ${uptime}
🔑 Total API Keys: ${apiKeys.length}
🔮 Model AI: \`${currentModel}\`
⚙️ Mode Bot: \`${botMode.toUpperCase()}\`
👑 Jumlah Owner: ${owners.size}
🧠 Percakapan Diingat: ${chatHistories.size} chat`;
                                await sock.sendMessage(from, { text: statsText }, { quoted: msg });
                                break;
                            }
                            case '/link': {
                                await sock.sendMessage(from, { text: '⏳ Meminta kode QR baru, mohon tunggu...' }, { quoted: msg });
                                const tempAuth = `./temp_auth_${Date.now()}`;
                                const { state: tempState, saveCreds: tempSaveCreds } = await useMultiFileAuthState(tempAuth);

                                const tempSock = makeWASocket({
                                    version,
                                    auth: tempState,
                                    logger: P({ level: 'silent' }),
                                    browser: ['Tautkan Perangkat', 'Chrome', '1.0.0']
                                });

                                let qrSent = false;
                                let connectionTimeout;

                                const cleanup = async () => {
                                    clearTimeout(connectionTimeout);
                                    try { if (tempSock && tempSock.ws?.isOpen) await tempSock.end(new Error('Cleanup')); } catch (e) { }
                                    if (fs.existsSync(tempAuth)) {
                                        fs.rmSync(tempAuth, { recursive: true, force: true });
                                    }
                                };

                                connectionTimeout = setTimeout(() => {
                                    console.log('Batas waktu koneksi pairing tercapai.');
                                    cleanup();
                                }, 90000);

                                tempSock.ev.on('connection.update', async (update) => {
                                    const { connection, qr } = update;
                                    if (qr && !qrSent) {
                                        qrSent = true;
                                        try {
                                            const qrImage = await qrcode.toBuffer(qr);
                                            await sock.sendMessage(from, { image: qrImage, caption: 'Scan QR ini untuk menautkan perangkat baru. QR akan kedaluwarsa.' });
                                        } catch (imgErr) {
                                            console.error('Gagal mengirim QR sebagai gambar, beralih ke teks.', imgErr);
                                            qrcodeTerminal.generate(qr, { small: true }, async (qrText) => {
                                                await sock.sendMessage(from, { text: 'Gagal mengirim gambar QR. Silakan scan melalui teks di bawah ini:\n\n' + qrText });
                                            });
                                        }
                                    }
                                    if (connection === 'open') {
                                        await sock.sendMessage(from, { text: '✅ Perangkat baru berhasil ditautkan! Koneksi sementara ditutup.' });
                                        await cleanup();
                                    }
                                    if (connection === 'close') {
                                        await cleanup();
                                    }
                                });
                                break;
                            }
                            case '/cybermenu': {
                                const cyberMenu = `🕶️ *Cyber Tools Menu* 🕶️

Gunakan tools di bawah untuk eksplorasi & analisis website target 🧠
(⚠️ HANYA UNTUK OWNER — PASTIKAN LEGALITAS)

• /scanurl <url> — Basic website scan (status, headers, title)
• /whois <domain> — Info registrasi domain
• /dnslookup <domain> — DNS records (A/MX/NS/TXT/CNAME)
• /ipinfo <ip> — Info lokasi IP
• /subfinder <domain> — Cari subdomain sederhana
• /portscan <ip/domain> — Scan port umum (non-intrusive)
• /headers <url> — Tampilkan HTTP headers
• /ping <host> — Ping host (fallback to system ping)
• /shorturl <url> — Buat shortlink (tinyurl)
• /expandurl <shortlink> — Lihat URL asli
• /techdetect <url> — Deteksi teknologi (WordPress, nginx, cloudflare, dll.)
• /nmap <target> — Jalankan nmap (belum bisa di gunakan) 

Contoh: \`/scanurl https://example.com\``;
                                await sock.sendMessage(from, { text: cyberMenu }, { quoted: msg });
                                break;
                            }
                        }
                        continue;
                    }

                    switch (command) {
                        case '/menu':
                        case '/help': {
                            let menuText = `🤖 *Menu Gemini WhatsApp Bot* 🤖

Hai! Saya adalah asisten AI yang ditenagai oleh Google Gemini.

🧠 *Fitur AI & Kreatif:*
• \`/sticker\` atau \`/s\`
  _Balas (reply) gambar/video atau kirim dengan caption /s untuk menjadikannya stiker._
• \`/reveal\`
  _Balas (reply) pesan 1x lihat (view-once) untuk membukanya._
• *Tanya AI (Chat/Vision):*
  _Kirim saya pesan teks atau gambar (dengan/tanpa caption) untuk memulai percakapan AI._
• \`/reset\`
  _Menghapus riwayat percakapan AI kita._
  
  👾 *Cyber tools*
  • /scanurl <url> — Basic website scan (status, headers, title)
• /whois <domain> — Info registrasi domain
• /dnslookup <domain> — DNS records (A/MX/NS/TXT/CNAME)
• /ipinfo <ip> — Info lokasi IP
• /subfinder <domain> — Cari subdomain sederhana
• /portscan <ip/domain> — Scan port umum (non-intrusive)
• /headers <url> — Tampilkan HTTP headers
• /ping <host> — Ping host (fallback to system ping)
• /shorturl <url> — Buat shortlink (tinyurl)
• /expandurl <shortlink> — Lihat URL asli
• /techdetect <url> — Deteksi teknologi (WordPress, nginx, cloudflare, dll.)
• /nmap <target> — Jalankan nmap (belum bisa di gunakan) 

🛠️ *Fitur Utilitas Grup:*
• \`/tagall\` (Hanya Admin Grup)
  _Menyebut (mention) semua anggota grup._
• \`/groupinfo\`
  _Menampilkan info detail grup saat ini._
• \`/myjid\`
  _Menampilkan JID (ID WhatsApp) Anda._`;
                            if (isOwner) {
                                menuText += `\n\n👑 *Perintah Khusus Owner:*
• \`/on\`
• \`/off\`
• \`/stats\`
• \`/system <prompt>\`
• \`/model <nama_model>\`
• \`/mode <private|group|all>\`
• \`/listowner\`
• \`/addowner nomor/@mention\`
• \`/delowner nomor/@mention\`
• \`/link\`
• \`/cybermenu\``;
                            }
                            menuText += `\n\n- - - - - - - - - - - -
▶️ Status Bot: *${isBotActive ? 'ON (Untuk Semua)' : 'OFF (Hanya Owner)'}*
📘 Mode Bot: *${botMode.toUpperCase()}*
🔮 Model AI: \`${currentModel}\``;

                            await sock.sendMessage(from, { text: menuText }, { quoted: msg });
                            break;
                        }
                        case '/reset': {
                            chatHistories.delete(from);
                            await sock.sendMessage(from, { text: '✅ Riwayat percakapan telah direset.' }, { quoted: msg });
                            break;
                        }
                        case '/sticker':
                        case '/s': {
                            await sock.sendPresenceUpdate('composing', from);
                            if (isOnCooldown(sender)) {
                                await sock.sendMessage(from, { text: '⏱️ Tunggu sebentar sebelum membuat stiker lagi.' }, { quoted: msg });
                                await sock.sendPresenceUpdate('paused', from);
                                break;
                            }
                            setCooldown(sender);

                            let mediaMsg;
                            let isAnimated = false;

                            if (isImage) mediaMsg = msg;
                            else if (isVideo) { mediaMsg = msg; isAnimated = true; }
                            else if (isQuotedImage) {
                                mediaMsg = { key: msg.key, message: { extendedTextMessage: { contextInfo: { quotedMessage: quotedMsg, stanzaId: msg.message.extendedTextMessage.contextInfo.stanzaId } } } };
                            } else if (isQuotedVideo) {
                                mediaMsg = { key: msg.key, message: { extendedTextMessage: { contextInfo: { quotedMessage: quotedMsg, stanzaId: msg.message.extendedTextMessage.contextInfo.stanzaId } } } };
                                isAnimated = true;
                            } else {
                                await sock.sendMessage(from, { text: 'Gagal ❌\n\nKirim gambar/video dengan caption `/sticker` atau balas media yang ingin dijadikan stiker.' }, { quoted: msg });
                                await sock.sendPresenceUpdate('paused', from);
                                break;
                            }

                            const mediaData = isVideo || isQuotedVideo ? (quotedMsg?.videoMessage || msg.message.videoMessage) : (quotedMsg?.imageMessage || msg.message.imageMessage);
                            if (isAnimated && (mediaData?.seconds || 0) > 10) {
                                await sock.sendMessage(from, { text: 'Gagal ❌\n\nVideo/GIF terlalu panjang. Maksimal durasi 10 detik.' }, { quoted: msg });
                                await sock.sendPresenceUpdate('paused', from);
                                break;
                            }

                            const thinkingSticker = await sock.sendMessage(from, { text: '🤖 Membuat stiker...' }, { quoted: msg });
                            try {
                                const buffer = await downloadMediaMessage(mediaMsg, 'buffer', {});
                                await sock.sendMessage(from, { sticker: buffer, isAnimated: isAnimated }, { quoted: msg });
                                await sock.sendMessage(from, { text: '✅ Berhasil!' }, { quoted: thinkingSticker });
                            } catch (err) {
                                console.error('Gagal membuat stiker:', err);
                                await sock.sendMessage(from, { text: 'Gagal ❌\n\nTerjadi error saat memproses media.' }, { quoted: thinkingSticker });
                            } finally {
                                await sock.sendPresenceUpdate('paused', from);
                            }
                            break;
                        }
                        case '/tagall': {
                            if (!isGroup) {
                                await sock.sendMessage(from, { text: 'Perintah ini hanya bisa digunakan di dalam grup.' }, { quoted: msg });
                                break;
                            }

                            const metadata = await sock.groupMetadata(from);
                            const senderAdminInfo = metadata.participants.find(p => p.id === sender);
                            const senderIsAdmin = senderAdminInfo?.admin === 'admin' || senderAdminInfo?.admin === 'superadmin';

                            if (!senderIsAdmin) {
                                await sock.sendMessage(from, { text: '❌ Perintah ini hanya untuk Admin Grup.' }, { quoted: msg });
                                break;
                            }

                            const jids = metadata.participants.map(p => p.id);
                            const tagText = argText || '📢 Perhatian untuk semua anggota!';

                            await sock.sendMessage(from, { text: tagText, mentions: jids }, { quoted: msg });
                            break;
                        }

                        case '/reveal': {
                            const quotedMessage = msg.message.extendedTextMessage?.contextInfo?.quotedMessage;
                            if (!quotedMessage) {
                                await sock.sendMessage(from, { text: 'Gagal ❌\n\nAnda harus membalas (reply) pesan sekali lihat.' }, { quoted: msg });
                                break;
                            }

                            const viewOnceWrapper = quotedMessage.viewOnceMessage || quotedMessage.viewOnceMessageV2;
                            if (!viewOnceWrapper) {
                                await sock.sendMessage(from, { text: 'Gagal ❌\n\nPesan yang Anda balas bukan pesan 1x lihat.' }, { quoted: msg });
                                break;
                            }

                            const unwrappedMessage = viewOnceWrapper.message;
                            if (!unwrappedMessage || (!unwrappedMessage.imageMessage && !unwrappedMessage.videoMessage)) {
                                await sock.sendMessage(from, { text: 'Gagal ❌\n\nPesan yang Anda balas tidak berisi media (gambar/video).' }, { quoted: msg });
                                break;
                            }

                            await sock.sendPresenceUpdate('composing', from);
                            const thinkingReveal = await sock.sendMessage(from, { text: '🤫 Membuka segel...' }, { quoted: msg });

                            try {
                                const downloadMessage = {
                                    key: msg.key,
                                    message: {
                                        extendedTextMessage: {
                                            contextInfo: {
                                                quotedMessage: unwrappedMessage,
                                                stanzaId: msg.message.extendedTextMessage.contextInfo.stanzaId
                                            }
                                        }
                                    }
                                };

                                const buffer = await downloadMediaMessage(downloadMessage, 'buffer', {});

                                if (unwrappedMessage.imageMessage) {
                                    await sock.sendMessage(from, { image: buffer, caption: '👀 Foto 1x lihat berhasil diungkap!' }, { quoted: msg });
                                } else if (unwrappedMessage.videoMessage) {
                                    await sock.sendMessage(from, { video: buffer, caption: '👀 Video 1x lihat berhasil diungkap!' }, { quoted: msg });
                                }

                                await sock.sendMessage(from, { text: '✅ Terungkap!' }, { quoted: thinkingReveal });

                            } catch (err) {
                                console.error('Gagal reveal view-once:', err);
                                await sock.sendMessage(from, { text: 'Gagal ❌\n\nTerjadi error teknis saat mengunduh media 1x lihat.' }, { quoted: thinkingReveal });
                            } finally {
                                await sock.sendPresenceUpdate('paused', from);
                            }
                            break;
                        }

                        case '/groupinfo': {
                            if (!isGroup) {
                                await sock.sendMessage(from, { text: 'Perintah ini hanya bisa digunakan di dalam grup.' }, { quoted: msg });
                                break;
                            }

                            const metadata = await sock.groupMetadata(from);
                            const creationDate = new Date(metadata.creation * 1000).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' });
                            const infoText = `*Informasi Grup* 📈

Nama: ${metadata.subject}
ID Grup: \`${metadata.id}\`
Total Angota: ${metadata.participants.length}
Dibuat Pada: ${creationDate}

Deskripsi:
${metadata.desc || 'Tidak ada deskripsi'}`;

                            await sock.sendMessage(from, { text: infoText }, { quoted: msg });
                            break;
                        }
                        case '/myjid': {
                            await sock.sendMessage(from, { text: `🆔 JID Anda adalah:\n\`${sender}\`` }, { quoted: msg });
                            break;
                        }

                        case '/scanurl':
                        case '/whois':
                        case '/dnslookup':
                        case '/portscan':
                        case '/ipinfo':
                        case '/headers':
                        case '/techdetect':
                        case '/subfinder':
                        case '/shorturl':
                        case '/expandurl':
                        case '/nmap': {
                            if (!isOwner) {
                                await sock.sendMessage(from, { text: '❌ Perintah cyber hanya untuk Owner.' }, { quoted: msg });
                                break;
                            }
                            const mapping = {
                                '/scanurl': 'scanUrl',
                                '/whois': 'whois',
                                '/dnslookup': 'dnslookup',
                                '/portscan': 'portscan',
                                '/ipinfo': 'ipinfo',
                                '/headers': 'headers',
                                '/techdetect': 'techdetect',
                                '/subfinder': 'subfinder',
                                '/shorturl': 'shorturl',
                                '/expandurl': 'expandurl',
                                '/nmap': 'nmap'
                            };
                            const moduleName = mapping[command];
                            const mod = cyberModules[moduleName];
                            if (!mod) {
                                await sock.sendMessage(from, { text: `⚠️ Modul cybertools/${moduleName}.js tidak tersedia di server.` }, { quoted: msg });
                                break;
                            }

                            await sock.sendPresenceUpdate('composing', from);
                            const jobMsg = await sock.sendMessage(from, { text: `⏳ Menjalankan ${command} ... Mohon tunggu` }, { quoted: msg });
                            try {
                                const arg = argText || args[0] || '';
                                const res = await mod.run(arg);
                                const out = (typeof res === 'string') ? res : JSON.stringify(res, null, 2);
                                if (out.length > 1500) {
                                    const filename = `${moduleName}_${Date.now()}.txt`;
                                    fs.writeFileSync(filename, out);
                                    const docBuffer = fs.readFileSync(filename);
                                    await sock.sendMessage(from, { document: docBuffer, fileName: filename, mimetype: 'text/plain' }, { quoted: msg });
                                    fs.unlinkSync(filename);
                                } else {
                                    await sock.sendMessage(from, { text: `\`\`\`\n${out}\n\`\`\`` }, { quoted: msg });
                                }
                            } catch (err) {
                                console.error(`Gagal menjalankan cyber module ${moduleName}:`, err);
                                await sock.sendMessage(from, { text: `❌ Error saat menjalankan ${command}: ${err.message}` }, { quoted: msg });
                            } finally {
                                await sock.sendPresenceUpdate('paused', from);
                            }
                            break;
                        }

                        default:
                            await sock.sendMessage(from, { text: `❓ Perintah \`${command}\` tidak dikenal. Ketik \`/menu\` untuk bantuan.` }, { quoted: msg });
                    }
                    continue;
                }

                if (botMode === 'private' && isGroup) continue;
                if (botMode === 'group' && !isGroup) continue;

                const userHistory = chatHistories.get(from) || [];

                let imageBuffer = null;
                if (isImage) {
                    try {
                        console.log('📥 Mengunduh gambar untuk Vision...');
                        imageBuffer = await downloadMediaMessage(msg, 'buffer', {});
                    } catch (imgErr) {
                        console.error('Gagal mengunduh gambar:', imgErr);
                        await sock.sendMessage(from, { text: '⚠️ Maaf, saya gagal memproses gambar yang Anda kirim.' }, { quoted: msg });
                        continue;
                    }
                }

                await sock.sendPresenceUpdate('composing', from);
                const thinkingMsg = await sock.sendMessage(from, { text: '🤖 Sedang berpikir...' }, { quoted: msg });

                try {
                    const { text: answer, history: newHistory } = await askGemini(text, userHistory, imageBuffer, currentModel);
                    if (newHistory && newHistory.length) chatHistories.set(from, newHistory);
                    await sock.sendMessage(from, { text: answer }, { quoted: thinkingMsg });
                } catch (aiErr) {
                    console.error('Error saat askGemini:', aiErr);
                    await sock.sendMessage(from, { text: '⚠️ Terjadi error saat memproses permintaan AI.' }, { quoted: thinkingMsg });
                } finally {
                    await sock.sendPresenceUpdate('paused', from);
                }

            } catch (err) {
                console.error(`❌ Error saat menangani pesan: ${err.stack || err}`);
                try {
                    await sock.sendMessage(msg.key.remoteJid, { text: '⚠️ Terjadi error internal saat memproses permintaan Anda.' });
                } catch (sendErr) {
                    console.error(`❌ Gagal mengirim pesan error: ${sendErr.stack || sendErr}`);
                }
            }
        }
    });
}

start().catch(console.error);
