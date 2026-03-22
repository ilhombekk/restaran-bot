import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { Telegraf, Markup, session } from 'telegraf';
import {
    initMenu,
    getMenu,
    getMenuItem,
    getCategories,
    getItemsByCategory,
    addMenuItem,
    editMenuItem,
    deleteMenuItem,
    setMenuItemActive,
    normalizeKey,
    formatMenuList
} from './menu.js';
import {
    initOrders,
    addOrder,
    getOrderById,
    updateOrderStatus,
    getTodayStats,
    getAllOrders
} from './orders.js';

const bot = new Telegraf(process.env.BOT_TOKEN);
const ADMIN_CHAT_ID = String(process.env.ADMIN_CHAT_ID || '');
const TIME_ZONE = 'Asia/Tashkent';
const WORK_START = process.env.WORK_START || '09:00';
const WORK_END = process.env.WORK_END || '23:00';
const PORT = Number(process.env.PORT || 10000);

const app = express();
app.use(cors());
app.use(express.json());

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const MENU_FILE = path.join(__dirname, 'menu.json');
const ORDERS_FILE = path.join(__dirname, 'orders.json');

const sseClients = new Set();

function sendSseEvent(type, payload = {}) {
    const data = `data: ${JSON.stringify({ type, payload, time: new Date().toISOString() })}\n\n`;
    
    for (const client of sseClients) {
        try {
            client.write(data);
        } catch (error) {
            console.log('SSE client xato:', error.message);
        }
    }
}

bot.use(
    session({
        defaultSession: () => ({
            cart: {},
            step: null,
            orderData: {},
            currentCategory: null
        })
    })
);

const mainKeyboard = Markup.keyboard([
    ['🍽 Menyu', '🛒 Savat'],
    ['☎️ Aloqa']
]).resize();

function isAdminChat(ctx) {
    return String(ctx.chat.id) === ADMIN_CHAT_ID;
}

function formatPrice(price) {
    return new Intl.NumberFormat('uz-UZ').format(Number(price || 0)) + " so'm";
}

function getNowParts() {
    const parts = new Intl.DateTimeFormat('en-GB', {
        timeZone: TIME_ZONE,
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
    })
    .formatToParts(new Date())
    .reduce((acc, part) => {
        if (part.type !== 'literal') acc[part.type] = part.value;
        return acc;
    }, {});
    
    return {
        hour: Number(parts.hour),
        minute: Number(parts.minute)
    };
}

function timeToMinutes(value) {
    const [h, m] = String(value).split(':').map(Number);
    return (Number.isFinite(h) ? h : 0) * 60 + (Number.isFinite(m) ? m : 0);
}

function getCurrentTimeText() {
    const now = getNowParts();
    return `${String(now.hour).padStart(2, '0')}:${String(now.minute).padStart(2, '0')}`;
}

function isRestaurantOpen() {
    const now = getNowParts();
    const nowMinutes = now.hour * 60 + now.minute;
    const startMinutes = timeToMinutes(WORK_START);
    const endMinutes = timeToMinutes(WORK_END);
    
    if (startMinutes === endMinutes) {
        return true;
    }
    
    if (endMinutes > startMinutes) {
        return nowMinutes >= startMinutes && nowMinutes < endMinutes;
    }
    
    return nowMinutes >= startMinutes || nowMinutes < endMinutes;
}

function getWorkHoursText() {
    return `🕒 Ish vaqti: ${WORK_START} - ${WORK_END}`;
}

function getClosedText() {
    return [
        '⛔ Hozir buyurtma qabul qilinmaydi.',
        getWorkHoursText(),
        `🕐 Hozirgi vaqt: ${getCurrentTimeText()}`
    ].join('\n');
}

function getQty(cart, key) {
    return cart[key] || 0;
}

function getCartItems(cart) {
    const menu = getMenu();
    const items = [];
    
    for (const key in cart) {
        const item = menu[key];
        const qty = cart[key];
        
        if (!item || !item.active || qty <= 0) continue;
        
        items.push({
            key,
            name: item.name,
            price: item.price,
            qty,
            total: item.price * qty
        });
    }
    
    return items;
}

function getCartTotal(cart) {
    return getCartItems(cart).reduce((sum, item) => sum + item.total, 0);
}

function getCartText(cart) {
    const items = getCartItems(cart);
    
    if (!items.length) return '🛒 Savat bo‘sh.';
    
    let text = '🛒 Savat:\n\n';
    for (const item of items) {
        text += `${item.name} x ${item.qty} = ${formatPrice(item.total)}\n`;
    }
    return text;
}

function getCartButtons(cart) {
    const total = getCartTotal(cart);
    if (total === 0) return undefined;
    
    const rows = [
        [Markup.button.callback('✅ Buyurtma berish', 'checkout')],
        [Markup.button.callback('🗑 Savatni tozalash', 'clear_cart')]
    ];
    
    if (getCategories({ activeOnly: true }).length) {
        rows.push([Markup.button.callback('⬅️ Kategoriyalarga qaytish', 'back_to_categories')]);
    }
    
    return Markup.inlineKeyboard(rows);
}

function generateOrderId() {
    return Date.now().toString().slice(-6);
}

function getButtonsByStatus(order) {
    if (order.status === 'Yangi buyurtma') {
        return Markup.inlineKeyboard([
            [Markup.button.callback('✅ Qabul qilindi', `status_${order.id}_Qabul qilindi`)]
        ]);
    }
    
    if (order.status === 'Qabul qilindi') {
        return Markup.inlineKeyboard([
            [Markup.button.callback('👨‍🍳 Tayyor', `status_${order.id}_Tayyor`)]
        ]);
    }
    
    if (order.status === 'Tayyor') {
        return Markup.inlineKeyboard([
            [Markup.button.callback('🚚 Yetkazildi', `status_${order.id}_Yetkazildi`)]
        ]);
    }
    
    return undefined;
}

function buildAdminText(order) {
    return [
        '🆕 Yangi buyurtma!',
        '',
        `🆔 Buyurtma ID: ${order.id}`,
        `📌 Status: ${order.status}`,
        `👤 Ism: ${order.name}`,
        `📞 Telefon: ${order.phone}`,
        `👤 Telegram: ${order.telegramName}`,
        `🔗 Username: ${order.username ? '@' + order.username : 'yo‘q'}`,
        `🆔 User ID: ${order.userId}`,
        `💬 Chat ID: ${order.chatId}`,
        `📍 Lokatsiya: https://maps.google.com/?q=${order.location.lat},${order.location.lon}`,
        '',
        order.cartText,
        `💰 Jami: ${formatPrice(order.total)}`,
        '',
        `🕒 Buyurtma vaqti: ${new Date(order.createdAt).toLocaleString('uz-UZ', { timeZone: TIME_ZONE })}`
    ].join('\n');
}

function clearUnavailableCartItems(cart) {
    const menu = getMenu();
    for (const key of Object.keys(cart)) {
        if (!menu[key] || !menu[key].active) delete cart[key];
    }
}

function parseAddOrEditCommand(text, command) {
    const rest = text.replace(command, '').trim();
    const parts = rest.split('|').map((part) => part.trim());
    
    if (parts.length !== 5) return null;
    
    const [rawKey, name, rawPrice, category, image] = parts;
    const key = normalizeKey(rawKey);
    const price = Number(rawPrice);
    
    if (!key || !name || !category || !Number.isFinite(price) || price <= 0) {
        return null;
    }
    
    return {
        key,
        name,
        price,
        category,
        image: image === '-' ? '' : image
    };
}

function getCategoryKeyboard() {
    const categories = getCategories({ activeOnly: true });
    if (!categories.length) return undefined;
    
    const rows = categories.map((category) => [
        Markup.button.callback(category, `cat_${encodeURIComponent(category)}`)
    ]);
    
    rows.push([Markup.button.callback('🛒 Savatni ko‘rish', 'open_cart')]);
    return Markup.inlineKeyboard(rows);
}

function getCategoryText() {
    const categories = getCategories({ activeOnly: true });
    if (!categories.length) return '📭 Hozircha aktiv mahsulot yo‘q.';
    
    return [
        '📂 Kategoriyani tanlang:',
        '',
        ...categories.map((category, index) => `${index + 1}. ${category}`),
        '',
        getWorkHoursText()
    ].join('\n');
}

function getCategoryProductsText(category, cart) {
    const items = getItemsByCategory(category, { activeOnly: true });
    const total = getCartTotal(cart);
    
    if (!items.length) return `📭 ${category} kategoriyasida mahsulot yo‘q.`;
    
    return [
        `📂 Kategoriya: ${category}`,
        '',
        ...items.map((item) => `${item.name} — ${formatPrice(item.price)}`),
        '',
        `🛒 Savatdagi jami: ${formatPrice(total)}`
    ].join('\n');
}

function getCategoryProductsKeyboard(category, cart) {
    const items = getItemsByCategory(category, { activeOnly: true });
    const rows = [];
    
    for (const item of items) {
        rows.push([
            Markup.button.callback(`🖼 ${item.name} — ${formatPrice(item.price)}`, `view_${item.key}`)
        ]);
        
        rows.push([
            Markup.button.callback('➖', `minus_${item.key}`),
            Markup.button.callback(`${item.name} (${getQty(cart, item.key)})`, 'ignore'),
            Markup.button.callback('➕', `add_${item.key}`)
        ]);
    }
    
    rows.push([Markup.button.callback('⬅️ Kategoriyalarga qaytish', 'back_to_categories')]);
    rows.push([Markup.button.callback('🛒 Savatni ko‘rish', 'open_cart')]);
    
    return Markup.inlineKeyboard(rows);
}

async function renderCategories(ctx, edit = false) {
    const text = getCategoryText();
    const keyboard = getCategoryKeyboard();
    
    if (edit) return ctx.editMessageText(text, keyboard);
    return ctx.reply(text, keyboard);
}

async function renderCategoryProducts(ctx, category, edit = false) {
    ctx.session.currentCategory = category;
    const text = getCategoryProductsText(category, ctx.session.cart);
    const keyboard = getCategoryProductsKeyboard(category, ctx.session.cart);
    
    if (edit) return ctx.editMessageText(text, keyboard);
    return ctx.reply(text, keyboard);
}

async function readJson(filePath, fallback) {
    try {
        const raw = await fs.readFile(filePath, 'utf-8');
        return JSON.parse(raw);
    } catch {
        await fs.writeFile(filePath, JSON.stringify(fallback, null, 2), 'utf-8');
        return fallback;
    }
}

async function writeJson(filePath, data) {
    await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

async function sendTelegramMessage(chatId, text) {
    if (!process.env.BOT_TOKEN || !chatId) return;
    
    try {
        const response = await fetch(`https://api.telegram.org/bot${process.env.BOT_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: chatId, text })
        });
        
        const data = await response.json();
        if (!data.ok) {
            console.log('Telegram API xato:', data.description);
        }
    } catch (error) {
        console.log('Telegramga xabar yuborishda xato:', error.message);
    }
}

bot.on('message', async (ctx, next) => {
    console.log('CHAT ID:', ctx.chat.id);
    console.log('USER ID:', ctx.from.id);
    console.log('CHAT TYPE:', ctx.chat.type);
    return next();
});

bot.start((ctx) => {
    clearUnavailableCartItems(ctx.session.cart);
    ctx.session.step = null;
    ctx.session.orderData = {};
    ctx.session.currentCategory = null;
    
    return ctx.reply('Assalomu alaykum! Restoran botga xush kelibsiz.', mainKeyboard);
});

bot.command('list', async (ctx) => {
    if (!isAdminChat(ctx)) return;
    return ctx.reply(formatMenuList());
});

bot.command('add', async (ctx) => {
    if (!isAdminChat(ctx)) return;
    
    const parsed = parseAddOrEditCommand(ctx.message.text, '/add');
    if (!parsed) {
        return ctx.reply(
            'Format noto‘g‘ri.\n\n/add key|Nomi|Narx|Kategoriya|ImageURL\n\nMasalan:\n/add hotdog|Hot Dog|18000|Fast Food|https://site.com/hotdog.jpg\n\nAgar rasm bo‘lmasa oxiriga - yoz:\n/add hotdog|Hot Dog|18000|Fast Food|-'
        );
    }
    
    try {
        await addMenuItem(parsed.key, parsed.name, parsed.price, parsed.category, parsed.image);
        sendSseEvent('menu_updated');
        return ctx.reply(`✅ Qo‘shildi:\n${parsed.name} — ${formatPrice(parsed.price)}\ncategory: ${parsed.category}\nkey: ${parsed.key}`);
    } catch (error) {
        return ctx.reply(`❌ ${error.message}`);
    }
});

bot.command('edit', async (ctx) => {
    if (!isAdminChat(ctx)) return;
    
    const parsed = parseAddOrEditCommand(ctx.message.text, '/edit');
    if (!parsed) {
        return ctx.reply(
            'Format noto‘g‘ri.\n\n/edit key|Yangi Nomi|Yangi Narx|Kategoriya|ImageURL\n\nMasalan:\n/edit hotdog|Hot Dog Big|22000|Fast Food|https://site.com/hotdog2.jpg'
        );
    }
    
    try {
        await editMenuItem(parsed.key, parsed.name, parsed.price, parsed.category, parsed.image);
        sendSseEvent('menu_updated');
        return ctx.reply(`✅ Yangilandi:\n${parsed.name} — ${formatPrice(parsed.price)}\ncategory: ${parsed.category}\nkey: ${parsed.key}`);
    } catch (error) {
        return ctx.reply(`❌ ${error.message}`);
    }
});

bot.command('delete', async (ctx) => {
    if (!isAdminChat(ctx)) return;
    
    const rawKey = ctx.message.text.replace('/delete', '').trim();
    const key = normalizeKey(rawKey);
    
    if (!key) return ctx.reply('Format: /delete key\n\nMasalan:\n/delete hotdog');
    
    try {
        const deleted = await deleteMenuItem(key);
        sendSseEvent('menu_updated');
        return ctx.reply(`🗑 O‘chirildi:\n${deleted.name}\nkey: ${deleted.key}`);
    } catch (error) {
        return ctx.reply(`❌ ${error.message}`);
    }
});

bot.command('hide', async (ctx) => {
    if (!isAdminChat(ctx)) return;
    
    const rawKey = ctx.message.text.replace('/hide', '').trim();
    const key = normalizeKey(rawKey);
    
    if (!key) return ctx.reply('Format: /hide key\n\nMasalan:\n/hide cola');
    
    try {
        const item = await setMenuItemActive(key, false);
        sendSseEvent('menu_updated');
        return ctx.reply(`🙈 Yashirildi:\n${item.name}\nkey: ${item.key}`);
    } catch (error) {
        return ctx.reply(`❌ ${error.message}`);
    }
});

bot.command('show', async (ctx) => {
    if (!isAdminChat(ctx)) return;
    
    const rawKey = ctx.message.text.replace('/show', '').trim();
    const key = normalizeKey(rawKey);
    
    if (!key) return ctx.reply('Format: /show key\n\nMasalan:\n/show cola');
    
    try {
        const item = await setMenuItemActive(key, true);
        sendSseEvent('menu_updated');
        return ctx.reply(`👀 Qayta ochildi:\n${item.name}\nkey: ${item.key}`);
    } catch (error) {
        return ctx.reply(`❌ ${error.message}`);
    }
});

bot.command('stats', async (ctx) => {
    if (!isAdminChat(ctx)) return;
    
    const stats = getTodayStats(TIME_ZONE);
    const allOrders = getAllOrders();
    
    return ctx.reply([
        '📊 Bugungi statistika:',
        '',
        `📅 Sana: ${stats.date}`,
        `🧾 Bugungi buyurtmalar: ${stats.totalOrders}`,
        `🆕 Yangi: ${stats.newOrders}`,
        `✅ Qabul qilingan: ${stats.acceptedOrders}`,
        `👨‍🍳 Tayyor: ${stats.readyOrders}`,
        `🚚 Yetkazilgan: ${stats.deliveredOrders}`,
        `💰 Bugungi jami summa: ${formatPrice(stats.totalRevenue)}`,
        `💵 Yetkazilganlar summasi: ${formatPrice(stats.deliveredRevenue)}`,
        '',
        `📦 Umumiy buyurtmalar soni: ${allOrders.length}`,
        '',
        getWorkHoursText(),
        `🕐 Hozirgi vaqt: ${getCurrentTimeText()}`
    ].join('\n'));
});

bot.hears('🍽 Menyu', async (ctx) => {
    clearUnavailableCartItems(ctx.session.cart);
    ctx.session.currentCategory = null;
    return renderCategories(ctx);
});

bot.action('back_to_categories', async (ctx) => {
    await ctx.answerCbQuery();
    ctx.session.currentCategory = null;
    return renderCategories(ctx, true);
});

bot.action(/^cat_(.+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const category = decodeURIComponent(ctx.match[1]);
    return renderCategoryProducts(ctx, category, true);
});

bot.action('ignore', async (ctx) => {
    await ctx.answerCbQuery();
});

bot.action(/^view_(.+)$/, async (ctx) => {
    const key = ctx.match[1];
    const item = getMenuItem(key);
    
    if (!item || !item.active) {
        await ctx.answerCbQuery('Mahsulot topilmadi');
        return;
    }
    
    await ctx.answerCbQuery();
    
    const caption = [
        `🍽 ${item.name}`,
        `📂 Kategoriya: ${item.category}`,
        `💰 Narx: ${formatPrice(item.price)}`
    ].join('\n');
    
    if (item.image) {
        try {
            return await ctx.replyWithPhoto(item.image, { caption });
        } catch {
            return await ctx.reply(caption);
        }
    }
    
    return ctx.reply(caption);
});

bot.action(/^add_(.+)$/, async (ctx) => {
    const key = ctx.match[1];
    const item = getMenuItem(key);
    
    if (!item || !item.active) {
        await ctx.answerCbQuery('Mahsulot topilmadi');
        return;
    }
    
    ctx.session.cart[key] = (ctx.session.cart[key] || 0) + 1;
    await ctx.answerCbQuery(`${item.name} qo‘shildi`);
    
    if (ctx.session.currentCategory) {
        return renderCategoryProducts(ctx, ctx.session.currentCategory, true);
    }
    
    return renderCategories(ctx, true);
});

bot.action(/^minus_(.+)$/, async (ctx) => {
    const key = ctx.match[1];
    const item = getMenuItem(key);
    
    if (!item || !item.active) {
        await ctx.answerCbQuery('Mahsulot topilmadi');
        return;
    }
    
    if ((ctx.session.cart[key] || 0) > 0) {
        ctx.session.cart[key] -= 1;
    }
    
    await ctx.answerCbQuery(`${item.name} kamaytirildi`);
    
    if (ctx.session.currentCategory) {
        return renderCategoryProducts(ctx, ctx.session.currentCategory, true);
    }
    
    return renderCategories(ctx, true);
});

bot.hears('🛒 Savat', (ctx) => {
    clearUnavailableCartItems(ctx.session.cart);
    
    const total = getCartTotal(ctx.session.cart);
    const text = getCartText(ctx.session.cart);
    
    if (total === 0) return ctx.reply(text);
    return ctx.reply(`${text}\n💰 Jami: ${formatPrice(total)}`, getCartButtons(ctx.session.cart));
});

bot.action('open_cart', async (ctx) => {
    clearUnavailableCartItems(ctx.session.cart);
    await ctx.answerCbQuery();
    
    const total = getCartTotal(ctx.session.cart);
    const text = getCartText(ctx.session.cart);
    
    if (total === 0) return ctx.reply(text);
    return ctx.reply(`${text}\n💰 Jami: ${formatPrice(total)}`, getCartButtons(ctx.session.cart));
});

bot.action('clear_cart', async (ctx) => {
    ctx.session.cart = {};
    await ctx.answerCbQuery('Savat tozalandi');
    return ctx.reply('🗑 Savat tozalandi.', mainKeyboard);
});

bot.action('checkout', async (ctx) => {
    clearUnavailableCartItems(ctx.session.cart);
    
    const total = getCartTotal(ctx.session.cart);
    
    if (total === 0) {
        await ctx.answerCbQuery('Savat bo‘sh');
        return;
    }
    
    if (!isRestaurantOpen()) {
        await ctx.answerCbQuery('Hozir yopiqmiz');
        return ctx.reply(getClosedText(), mainKeyboard);
    }
    
    const fullName = [ctx.from.first_name, ctx.from.last_name].filter(Boolean).join(' ').trim();
    
    ctx.session.orderData = {
        name: fullName || 'Noma’lum',
        username: ctx.from.username || ''
    };
    
    ctx.session.step = 'phone';
    
    await ctx.answerCbQuery();
    return ctx.reply(
        '📱 Telefon raqamingizni yuboring:\n\nTelegram sizdan tasdiq so‘raydi.',
        Markup.keyboard([[Markup.button.contactRequest('📱 Telefon yuborish')]]).resize().oneTime()
    );
});

bot.on('contact', (ctx) => {
    if (ctx.session.step !== 'phone') return;
    
    ctx.session.orderData.phone = ctx.message.contact.phone_number;
    ctx.session.step = 'location';
    
    return ctx.reply(
        '📍 Lokatsiyangizni yuboring:',
        Markup.keyboard([[Markup.button.locationRequest('📍 Lokatsiya yuborish')]]).resize().oneTime()
    );
});

bot.on('location', async (ctx) => {
    if (ctx.session.step !== 'location') return;
    
    clearUnavailableCartItems(ctx.session.cart);
    
    const { latitude, longitude } = ctx.message.location;
    const total = getCartTotal(ctx.session.cart);
    const cartText = getCartText(ctx.session.cart);
    const orderId = generateOrderId();
    
    const order = {
        id: orderId,
        name: ctx.session.orderData.name,
        phone: ctx.session.orderData.phone,
        username: ctx.session.orderData.username,
        telegramName: [ctx.from.first_name, ctx.from.last_name].filter(Boolean).join(' ').trim() || 'Noma’lum',
        userId: ctx.from.id,
        chatId: ctx.chat.id,
        location: {
            lat: latitude,
            lon: longitude
        },
        cart: { ...ctx.session.cart },
        cartText,
        total,
        status: 'Yangi buyurtma',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };
    
    await addOrder(order);
    sendSseEvent('order_created', order);
    
    const userText = [
        '✅ Buyurtma qabul qilindi!',
        '',
        `🆔 Buyurtma ID: ${order.id}`,
        `👤 Ism: ${order.name}`,
        `📞 Telefon: ${order.phone}`,
        '📍 Lokatsiya yuborildi',
        '',
        order.cartText,
        `💰 Jami: ${formatPrice(order.total)}`,
        '',
        `📌 Holat: ${order.status}`
    ].join('\n');
    
    if (ADMIN_CHAT_ID) {
        try {
            await bot.telegram.sendMessage(
                ADMIN_CHAT_ID,
                buildAdminText(order),
                getButtonsByStatus(order)
            );
            await bot.telegram.sendLocation(ADMIN_CHAT_ID, latitude, longitude);
            console.log('Admin ga yuborildi:', ADMIN_CHAT_ID);
        } catch (error) {
            console.log('Admin ga yuborishda xato:', error.message);
        }
    }
    
    ctx.session.cart = {};
    ctx.session.step = null;
    ctx.session.orderData = {};
    ctx.session.currentCategory = null;
    
    return ctx.reply(userText, mainKeyboard);
});

bot.action(/^status_(\d+)_(.+)$/, async (ctx) => {
    const orderId = ctx.match[1];
    const newStatus = ctx.match[2];
    
    const order = getOrderById(orderId);
    if (!order) {
        await ctx.answerCbQuery('Buyurtma topilmadi');
        return;
    }
    
    const updatedOrder = await updateOrderStatus(orderId, newStatus);
    sendSseEvent('order_updated', updatedOrder);
    
    await ctx.answerCbQuery(`Status: ${newStatus}`);
    
    try {
        const nextButtons = getButtonsByStatus(updatedOrder);
        if (nextButtons) {
            await ctx.editMessageText(buildAdminText(updatedOrder), nextButtons);
        } else {
            await ctx.editMessageText(buildAdminText(updatedOrder));
        }
    } catch (error) {
        console.log('Admin xabarini yangilashda xato:', error.message);
    }
    
    try {
        await bot.telegram.sendMessage(
            updatedOrder.chatId,
            [
                '📦 Buyurtma holati yangilandi!',
                '',
                `🆔 Buyurtma ID: ${updatedOrder.id}`,
                `📌 Yangi status: ${updatedOrder.status}`
            ].join('\n'),
            mainKeyboard
        );
    } catch (error) {
        console.log('Mijozga status yuborishda xato:', error.message);
    }
});

/* API ROUTES */
app.get('/', (req, res) => {
    res.send('Bot + API ishlayapti');
});

app.get('/health', (req, res) => {
    res.status(200).json({
        ok: true,
        service: 'telegram-bot-api',
        time: new Date().toISOString(),
        workStart: WORK_START,
        workEnd: WORK_END,
        currentTime: getCurrentTimeText(),
        isOpen: isRestaurantOpen()
    });
});

app.get('/api/stream', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();
    
    res.write(`data: ${JSON.stringify({ type: 'connected', time: new Date().toISOString() })}\n\n`);
    
    sseClients.add(res);
    
    const heartbeat = setInterval(() => {
        try {
            res.write(`: ping\n\n`);
        } catch {
            clearInterval(heartbeat);
        }
    }, 25000);
    
    req.on('close', () => {
        clearInterval(heartbeat);
        sseClients.delete(res);
    });
});

app.get('/api/menu', async (req, res) => {
    const menu = await readJson(MENU_FILE, {});
    res.json(menu);
});

app.post('/api/menu', async (req, res) => {
    const menu = await readJson(MENU_FILE, {});
    const { key, name, price, category, image, active } = req.body;
    
    if (!key || !name || !price || !category) {
        return res.status(400).json({ error: 'key, name, price, category kerak' });
    }
    
    menu[key] = {
        key,
        name,
        price: Number(price),
        category,
        image: image || '',
        active: active ?? true
    };
    
    await writeJson(MENU_FILE, menu);
    sendSseEvent('menu_updated');
    res.json(menu[key]);
});

app.put('/api/menu/:key', async (req, res) => {
    const menu = await readJson(MENU_FILE, {});
    const key = req.params.key;
    
    if (!menu[key]) {
        return res.status(404).json({ error: 'Mahsulot topilmadi' });
    }
    
    const updated = {
        ...menu[key],
        ...req.body,
        key
    };
    
    if (updated.price !== undefined) {
        updated.price = Number(updated.price);
    }
    
    menu[key] = updated;
    await writeJson(MENU_FILE, menu);
    sendSseEvent('menu_updated');
    res.json(updated);
});

app.delete('/api/menu/:key', async (req, res) => {
    const menu = await readJson(MENU_FILE, {});
    const key = req.params.key;
    
    if (!menu[key]) {
        return res.status(404).json({ error: 'Mahsulot topilmadi' });
    }
    
    const deleted = menu[key];
    delete menu[key];
    await writeJson(MENU_FILE, menu);
    sendSseEvent('menu_updated');
    res.json(deleted);
});

app.get('/api/orders', async (req, res) => {
    const orders = await readJson(ORDERS_FILE, []);
    res.json(orders);
});

app.put('/api/orders/:id/status', async (req, res) => {
    const orders = await readJson(ORDERS_FILE, []);
    const { status } = req.body;
    const id = req.params.id;
    
    const order = orders.find((item) => String(item.id) === String(id));
    
    if (!order) {
        return res.status(404).json({ error: 'Buyurtma topilmadi' });
    }
    
    order.status = status;
    order.updatedAt = new Date().toISOString();
    
    await writeJson(ORDERS_FILE, orders);
    sendSseEvent('order_updated', order);
    
    await sendTelegramMessage(
        order.chatId,
        [
            '📦 Buyurtma holati yangilandi!',
            '',
            `🆔 Buyurtma ID: ${order.id}`,
            `📌 Yangi status: ${order.status}`
        ].join('\n')
    );
    
    res.json(order);
});

app.get('/api/stats', async (req, res) => {
    const orders = await readJson(ORDERS_FILE, []);
    
    const totalOrders = orders.length;
    const newOrders = orders.filter((o) => o.status === 'Yangi buyurtma').length;
    const acceptedOrders = orders.filter((o) => o.status === 'Qabul qilindi').length;
    const readyOrders = orders.filter((o) => o.status === 'Tayyor').length;
    const deliveredOrders = orders.filter((o) => o.status === 'Yetkazildi').length;
    const totalRevenue = orders.reduce((sum, o) => sum + (o.total || 0), 0);
    
    res.json({
        totalOrders,
        newOrders,
        acceptedOrders,
        readyOrders,
        deliveredOrders,
        totalRevenue
    });
});

bot.hears('☎️ Aloqa', (ctx) => {
    return ctx.reply(`☎️ Aloqa uchun: +998 90 123 45 67\n${getWorkHoursText()}`, mainKeyboard);
});

bot.catch((err) => {
    console.error('BOT ERROR:', err);
});

async function startApp() {
    await initMenu();
    await initOrders();
    
    app.listen(PORT, () => {
        console.log(`🌐 Server ishladi: ${PORT}`);
    });
    
    try {
        await bot.launch();
        console.log('✅ Bot ishga tushdi');
        console.log('ADMIN_CHAT_ID:', ADMIN_CHAT_ID || 'yo‘q');
        console.log('WORK HOURS:', `${WORK_START} - ${WORK_END}`);
        console.log('CURRENT TIME:', getCurrentTimeText());
        console.log('IS OPEN:', isRestaurantOpen());
    } catch (error) {
        console.error('BOT LAUNCH ERROR:', error);
    }
}

startApp();

process.once('SIGINT', () => {
    bot.stop('SIGINT');
    process.exit(0);
});

process.once('SIGTERM', () => {
    bot.stop('SIGTERM');
    process.exit(0);
});