import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { Telegraf, Markup, session } from 'telegraf';

import { connectDb } from './db.js';
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
    updateOrderPayment,
    updateOrderAdminMessages,
    deleteOrder,
    getTodayStats,
    getAllOrders
} from './orders.js';

const BOT_TOKEN = process.env.BOT_TOKEN;
const CLICK_PROVIDER_TOKEN = process.env.CLICK_PROVIDER_TOKEN || '';
const ADMIN_CHAT_ID = String(process.env.ADMIN_CHAT_ID || '');
const TIME_ZONE = 'Asia/Tashkent';
const WORK_START = process.env.WORK_START || '09:00';
const WORK_END = process.env.WORK_END || '23:00';
const PORT = Number(process.env.PORT || 10000);
const CLICK_PAYMENT_TIMEOUT_MS = 10 * 60 * 1000; // 10 minut

if (!BOT_TOKEN) {
    throw new Error('BOT_TOKEN topilmadi');
}

const bot = new Telegraf(BOT_TOKEN);
const app = express();

app.use(cors());
app.use(express.json({ limit: '20mb' }));

const sseClients = new Set();
const paymentTimers = new Map();

function sendSseEvent(type, payload = {}) {
    const data = `data: ${JSON.stringify({
        type,
        payload,
        time: new Date().toISOString()
    })}\n\n`;
    
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
    
    if (startMinutes === endMinutes) return true;
    
    if (endMinutes > startMinutes) {
        return nowMinutes >= startMinutes && nowMinutes < endMinutes;
    }
    
    return nowMinutes >= startMinutes || nowMinutes < endMinutes;
}

function getWorkHoursText() {
    return `${WORK_START} - ${WORK_END}`;
}

function getClosedText() {
    return [
        '🔴 *Hozir buyurtma qabul qilinmaydi!*',
        '',
        `🕒 Ish vaqti: *${getWorkHoursText()}*`,
        `⏰ Hozirgi vaqt: ${getCurrentTimeText()}`,
        '',
        "Ish vaqtida qaytib keling! 🙏"
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
    if (!items.length) return "🛒 Savatingiz bo'sh.\n\nMenyu bo'limidan mahsulot qo'shing!";
    
    let text = '🛒 Savatingiz:\n\n';
    for (const item of items) {
        text += `▪️ ${item.name} × ${item.qty} = ${formatPrice(item.total)}\n`;
    }
    return text;
}

function getCartButtons(cart) {
    const total = getCartTotal(cart);
    if (total === 0) return undefined;
    
    const rows = [
        [Markup.button.callback(`✅ Buyurtma berish — ${formatPrice(total)}`, 'checkout')],
        [Markup.button.callback('🗑 Savatni tozalash', 'clear_cart')]
    ];
    
    if (getCategories({ activeOnly: true }).length) {
        rows.push([Markup.button.callback('⬅️ Menyuga qaytish', 'back_to_categories')]);
    }
    
    return Markup.inlineKeyboard(rows);
}

function generateOrderId() {
    return Date.now().toString().slice(-6);
}

function getDeliveryTypeText(deliveryType) {
    return deliveryType === 'pickup' ? "O'zi olib ketadi" : 'Yetkazib berish';
}

function getPaymentMethodText(paymentMethod) {
    return paymentMethod === 'click' ? 'Click' : 'Naqd';
}

function getPaymentStatusText(paymentStatus) {
    if (paymentStatus === 'paid') return "To'langan";
    if (paymentStatus === 'failed') return "To'lov amalga oshmadi";
    return "To'lov kutilmoqda";
}

function clearPaymentTimer(orderId) {
    const existing = paymentTimers.get(String(orderId));
    if (existing) {
        clearTimeout(existing);
        paymentTimers.delete(String(orderId));
    }
}

// =============================================
// ADMIN GURUHDA TO'LOV TUGMALARI
// Click pending bo'lsa — "To'landi" va "Bekor qilish" tugmalari
// =============================================
// Faqat status tugmalari — to'lov tugmalari yo'q
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
    const locationLine = order.location?.text
    ? `Manzil: ${order.location.text}`
    : (order.location?.lat && order.location?.lon
        ? `Lokatsiya: https://maps.google.com/?q=${order.location.lat},${order.location.lon}`
        : "Manzil: yo'q");
        
        const header = order.status === 'Bekor qilindi'
        ? 'Buyurtma bekor qilindi!'
        : 'Yangi buyurtma!';
        
        return [
            header,
            '',
            `Buyurtma ID: ${order.id}`,
            `Status: ${order.status}`,
            `Yetkazish turi: ${getDeliveryTypeText(order.deliveryType)}`,
            `To'lov turi: ${getPaymentMethodText(order.paymentMethod)}`,
            `To'lov holati: ${getPaymentStatusText(order.paymentStatus)}`,
            `Ism: ${order.name}`,
            `Telefon: ${order.phone}`,
            `Telegram: ${order.telegramName}`,
            `Username: ${order.username ? '@' + order.username : "yo'q"}`,
            `User ID: ${order.userId}`,
            `Chat ID: ${order.chatId}`,
            locationLine,
            '',
            order.cartText,
            `Jami: ${formatPrice(order.total)}`,
            ...(order.clickTransactionId ? [`Click transaction: ${order.clickTransactionId}`] : []),
            ...(order.paidAt ? [`To'langan vaqt: ${new Date(order.paidAt).toLocaleString('uz-UZ', { timeZone: TIME_ZONE })}`] : []),
            '',
            `Buyurtma vaqti: ${new Date(order.createdAt).toLocaleString('uz-UZ', { timeZone: TIME_ZONE })}`
        ].join('\n');
    }
    
    async function syncAdminOrderMessage(order) {
        if (!ADMIN_CHAT_ID || !order?.adminMessageId) return;
        
        try {
            const nextButtons = getButtonsByStatus(order);
            
            if (nextButtons) {
                await bot.telegram.editMessageText(
                    ADMIN_CHAT_ID,
                    order.adminMessageId,
                    undefined,
                    buildAdminText(order),
                    { reply_markup: nextButtons.reply_markup }
                );
            } else {
                await bot.telegram.editMessageText(
                    ADMIN_CHAT_ID,
                    order.adminMessageId,
                    undefined,
                    buildAdminText(order)
                );
            }
        } catch (error) {
            console.log('Admin kanal xabarini yangilashda xato:', error.message);
        }
    }
    
    function clearUnavailableCartItems(cart) {
        const menu = getMenu();
        for (const key of Object.keys(cart)) {
            if (!menu[key] || !menu[key].active) {
                delete cart[key];
            }
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
            Markup.button.callback(`🍽 ${category}`, `cat_${encodeURIComponent(category)}`)
        ]);
        
        rows.push([Markup.button.callback("🛒 Savatni ko'rish", 'open_cart')]);
        return Markup.inlineKeyboard(rows);
    }
    
    function getCategoryText() {
        const categories = getCategories({ activeOnly: true });
        if (!categories.length) return "😔 Hozircha aktiv mahsulot yo'q.";
        
        return [
            '🍽 Menyumiz',
            '',
            '👇 Kategoriyani tanlang:',
            '',
            ...categories.map((category, index) => `${index + 1}. ${category}`),
            '',
            `🕒 Ish vaqti: ${getWorkHoursText()}`
        ].join('\n');
    }
    
    function getCategoryProductsText(category, cart) {
        const items = getItemsByCategory(category, { activeOnly: true });
        const total = getCartTotal(cart);
        
        if (!items.length) return `😔 ${category} kategoriyasida hozircha mahsulot yo'q.`;
        
        const totalText = total > 0
        ? `\n🛒 Savatingiz: ${formatPrice(total)}`
        : '';
        
        return [
            `📂 ${category}`,
            '',
            ...items.map((item) => {
                const qty = getQty(cart, item.key);
                const qtyText = qty > 0 ? ` (${qty} ta)` : '';
                return `🍔 ${item.name}${qtyText}\n   💰 ${formatPrice(item.price)}`;
            }),
            totalText,
            '',
            '➕ ➖ tugmalar orqali miqdorni o\'zgartiring'
        ].join('\n');
    }
    
    function getCategoryProductsKeyboard(category, cart) {
        const items = getItemsByCategory(category, { activeOnly: true });
        const rows = [];
        
        for (const item of items) {
            rows.push([
                Markup.button.callback(`🍔 ${item.name} — ${formatPrice(item.price)}`, `view_${item.key}`)
            ]);
            
            const qty = getQty(cart, item.key);
            const qtyLabel = qty > 0 ? `${qty} ta` : '0';
            rows.push([
                Markup.button.callback('➖', `minus_${item.key}`),
                Markup.button.callback(`🛒 ${qtyLabel}`, 'ignore'),
                Markup.button.callback('➕', `add_${item.key}`)
            ]);
        }
        
        rows.push([Markup.button.callback('⬅️ Kategoriyalarga qaytish', 'back_to_categories')]);
        rows.push([Markup.button.callback("🛒 Savatni ko'rish", 'open_cart')]);
        
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
    
    async function sendClickInvoice(ctx, order) {
        if (!CLICK_PROVIDER_TOKEN) {
            throw new Error('CLICK_PROVIDER_TOKEN topilmadi');
        }
        
        await ctx.replyWithInvoice({
            title: `Buyurtma #${order.id}`,
            description: [
                `Buyurtma ID: ${order.id}`,
                `Yetkazish turi: ${getDeliveryTypeText(order.deliveryType)}`,
                "To'lov turi: Click"
            ].join('\n'),
            payload: `order_${order.id}`,
            provider_token: CLICK_PROVIDER_TOKEN,
            currency: 'UZS',
            prices: [
                {
                    label: `Buyurtma #${order.id}`,
                    amount: Math.round(Number(order.total || 0) * 100)
                }
            ],
            start_parameter: `click-order-${order.id}`,
            need_name: false,
            need_phone_number: false,
            need_email: false,
            need_shipping_address: false,
            is_flexible: false
        });
    }
    
    // =============================================
    // 10 DAQIQA TO'LOV AMALGA OSHMASA — BEKOR QILISH
    // =============================================
    async function cancelExpiredClickOrder(orderId) {
        try {
            const order = getOrderById(orderId);
            
            if (!order) { clearPaymentTimer(orderId); return; }
            if (order.paymentMethod !== 'click') { clearPaymentTimer(orderId); return; }
            if (order.paymentStatus === 'paid') { clearPaymentTimer(orderId); return; }
            if (order.status === 'Bekor qilindi' || order.status === 'Yetkazildi') {
                clearPaymentTimer(orderId);
                return;
            }
            
            // Avval statusni bekor qilish
            await updateOrderStatus(orderId, 'Bekor qilindi');
            
            // Keyin to'lov holatini ham failed ga o'zgartirish
            const updatedOrder = await updateOrderPayment(orderId, {
                paymentStatus: 'failed',
                paidAt: null
            });
            
            sendSseEvent('order_updated', updatedOrder);
            await syncAdminOrderMessage(updatedOrder);
            
            // Mijozga xabar yuborish
            try {
                await bot.telegram.sendMessage(
                    updatedOrder.chatId,
                    [
                        '❌ *Buyurtmangiz bekor qilindi!*',
                        '',
                        '━━━━━━━━━━━━━━━━━━',
                        `🆔 Buyurtma: *#${updatedOrder.id}*`,
                        "⏰ Sabab: 10 daqiqa ichida Click to'lovi amalga oshirilmadi.",
                        '━━━━━━━━━━━━━━━━━━',
                        '',
                        "🔄 Qaytadan buyurtma berish uchun /start ni bosing."
                    ].join('\n'),
                    { ...mainKeyboard, parse_mode: 'Markdown' }
                );
            } catch (error) {
                console.log('Mijozga cancel xabari yuborishda xato:', error.message);
            }
            
            clearPaymentTimer(orderId);
        } catch (error) {
            console.log('Click timeout cancel xato:', error.message);
        }
    }
    
    function scheduleClickPaymentTimeout(orderId) {
        clearPaymentTimer(orderId);
        
        const timer = setTimeout(async () => {
            await cancelExpiredClickOrder(orderId);
        }, CLICK_PAYMENT_TIMEOUT_MS);
        
        paymentTimers.set(String(orderId), timer);
    }
    
    // User uchun chiroyli status xabari
    function buildUserStatusText(order) {
        const isPickup = order.deliveryType === 'pickup';
        
        const statusEmoji = {
            'Yangi buyurtma': '🆕',
            'Qabul qilindi': '✅',
            'Tayyor': isPickup ? '🏪' : '👨‍🍳',
            'Yetkazildi': isPickup ? '✅' : '🚚',
            'Bekor qilindi': '❌'
        };
        
        const statusMsg = {
            'Yangi buyurtma': "Buyurtmangiz qabul qilindi va ko'rib chiqilmoqda.",
            'Qabul qilindi': "Buyurtmangiz qabul qilindi! Tayyorlanishi boshlandi.",
            'Tayyor': isPickup
            ? "Buyurtmangiz tayyor! Kelib olib ketishingiz mumkin. 🏪"
            : "Buyurtmangiz tayyor! Yetkazuvchi yo'lda. 🚚",
            'Yetkazildi': isPickup
            ? "Buyurtmangiz berildi! Ishtahaingiz chog' bo'lsin! 😊"
            : "Buyurtmangiz yetkazildi! Ishtahaingiz chog' bo'lsin! 😊",
            'Bekor qilindi': "Buyurtmangiz bekor qilindi."
        };
        
        const emoji = statusEmoji[order.status] || '📦';
        const msg = statusMsg[order.status] || `Holat: ${order.status}`;
        
        return [
            `${emoji} *Buyurtma holati yangilandi!*`,
            '',
            '━━━━━━━━━━━━━━━━━━',
            `🆔 Buyurtma: *#${order.id}*`,
            `📌 Yangi holat: *${order.status}*`,
            '━━━━━━━━━━━━━━━━━━',
            '',
            msg
        ].join('\n');
    }
    
    async function finalizeOrder(ctx, locationData, locationNoticeText) {
        clearUnavailableCartItems(ctx.session.cart);
        
        const total = getCartTotal(ctx.session.cart);
        if (total === 0) {
            ctx.session.step = null;
            ctx.session.orderData = {};
            ctx.session.currentCategory = null;
            return ctx.reply("🛒 Savatingiz bo'sh bo'lib qoldi.\n\nMenyu bo'limidan mahsulot tanlang!", { ...mainKeyboard, parse_mode: 'Markdown' });
        }
        
        const cartText = getCartText(ctx.session.cart);
        const orderId = generateOrderId();
        const selectedPaymentMethod = ctx.session.orderData.paymentMethod || 'cash';
        
        const order = {
            id: orderId,
            name: ctx.session.orderData.name,
            phone: ctx.session.orderData.phone,
            username: ctx.session.orderData.username,
            deliveryType: ctx.session.orderData.deliveryType || 'delivery',
            paymentMethod: selectedPaymentMethod,
            paymentStatus: 'pending',
            paidAt: null,
            clickTransactionId: null,
            telegramName: [ctx.from.first_name, ctx.from.last_name].filter(Boolean).join(' ').trim() || "Noma'lum",
            userId: ctx.from.id,
            chatId: ctx.chat.id,
            location: locationData,
            cart: { ...ctx.session.cart },
            cartText,
            total,
            status: 'Yangi buyurtma',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            adminMessageId: null,
            adminLocationMessageId: null
        };
        
        await addOrder(order);
        sendSseEvent('order_created', order);
        
        const userText = [
            '✅ *Buyurtmangiz qabul qilindi!*',
            '',
            '━━━━━━━━━━━━━━━━━━',
            `🆔 Buyurtma raqami: *#${order.id}*`,
            `📦 Yetkazish: ${getDeliveryTypeText(order.deliveryType)}`,
            `💳 To'lov: ${getPaymentMethodText(order.paymentMethod)}`,
            `👤 Ism: ${order.name}`,
            `📞 Telefon: ${order.phone}`,
            `📍 ${locationNoticeText}`,
            '━━━━━━━━━━━━━━━━━━',
            '',
            order.cartText,
            '',
            `💰 *Jami: ${formatPrice(order.total)}*`,
            '',
            '━━━━━━━━━━━━━━━━━━',
            `📌 Holat: ${order.status}`,
            ...(order.paymentMethod === 'click'
                ? ['', '⏳ *Click orqali to\'lov:*', "To'lov uchun 10 daqiqa vaqtingiz bor.", "⚠️ Vaqtida to'lov qilinmasa buyurtma bekor bo'ladi!"]
                : ['', '💵 Yetkazib berishda naqd to\'laysiz.'])
            ].join('\n');
            
            // Faqat "Yetkazib berish" buyurtmalari admin guruhga yuboriladi
            // "O'zi olib ketadi" faqat admin panelda ko'rinadi
            if (ADMIN_CHAT_ID && order.deliveryType !== 'pickup') {
                try {
                    const adminMessage = await bot.telegram.sendMessage(
                        ADMIN_CHAT_ID,
                        buildAdminText(order),
                        getButtonsByStatus(order)
                    );
                    
                    let adminLocationMessageId = null;
                    
                    if (locationData?.lat && locationData?.lon) {
                        const locationMessage = await bot.telegram.sendLocation(
                            ADMIN_CHAT_ID,
                            locationData.lat,
                            locationData.lon
                        );
                        adminLocationMessageId = locationMessage?.message_id ?? null;
                    }
                    
                    await updateOrderAdminMessages(order.id, {
                        adminMessageId: adminMessage?.message_id ?? null,
                        adminLocationMessageId
                    });
                    
                    const freshOrder = getOrderById(order.id);
                    if (freshOrder) {
                        sendSseEvent('order_updated', freshOrder);
                    }
                } catch (error) {
                    console.log('Admin ga yuborishda xato:', error.message);
                }
            } else {
                // O'zi olib ketadi — faqat SSE orqali admin panelga tushadi
                sendSseEvent('order_updated', order);
            }
            
            ctx.session.cart = {};
            ctx.session.step = null;
            ctx.session.orderData = {};
            ctx.session.currentCategory = null;
            
            await ctx.reply(userText, { ...mainKeyboard, parse_mode: 'Markdown' });
            
            if (order.paymentMethod === 'click') {
                try {
                    await sendClickInvoice(ctx, order);
                    scheduleClickPaymentTimeout(order.id);
                } catch (error) {
                    console.log('Click invoice yuborishda xato:', error.message);
                    await ctx.reply("Click invoice yuborilmadi. Tokenni yoki BotFather ulanishini tekshiring.");
                }
            }
            
            return;
        }
        
        // =============================================
        // BOT EVENTS
        // =============================================
        
        bot.on('pre_checkout_query', async (ctx) => {
            try {
                await ctx.answerPreCheckoutQuery(true);
            } catch (error) {
                console.log('Pre-checkout xato:', error.message);
            }
        });
        
        bot.on('successful_payment', async (ctx) => {
            try {
                const payload = ctx.message.successful_payment?.invoice_payload || '';
                const telegramChargeId = ctx.message.successful_payment?.telegram_payment_charge_id || null;
                const providerChargeId = ctx.message.successful_payment?.provider_payment_charge_id || null;
                
                if (!payload.startsWith('order_')) {
                    return ctx.reply("To'lov qabul qilindi.");
                }
                
                const orderId = payload.replace('order_', '');
                const order = getOrderById(orderId);
                
                if (!order) {
                    return ctx.reply("To'lov qabul qilindi, lekin buyurtma topilmadi.");
                }
                
                clearPaymentTimer(orderId);
                
                const updated = await updateOrderPayment(orderId, {
                    paymentMethod: 'click',
                    paymentStatus: 'paid',
                    paidAt: new Date().toISOString(),
                    clickTransactionId: providerChargeId || telegramChargeId || null
                });
                
                sendSseEvent('order_updated', updated);
                await syncAdminOrderMessage(updated);
                
                await ctx.reply(
                    [
                        "✅ *Click to'lovi muvaffaqiyatli qabul qilindi!*",
                        '',
                        '━━━━━━━━━━━━━━━━━━',
                        `🆔 Buyurtma: *#${updated.id}*`,
                        `💳 To'lov: ${getPaymentMethodText(updated.paymentMethod)}`,
                        `✅ Holat: ${getPaymentStatusText(updated.paymentStatus)}`,
                        '━━━━━━━━━━━━━━━━━━',
                        '',
                        "🚀 Buyurtmangiz tayyorlanmoqda!"
                    ].join('\n'),
                    { ...mainKeyboard, parse_mode: 'Markdown' }
                );
            } catch (error) {
                console.log('Successful payment xato:', error.message);
            }
        });
        
        // =============================================
        // ADMIN: "To'landi (Click)" tugmasi bosilganda
        // =============================================
        // pay_confirm va pay_cancel olib tashlandi
        // Admin guruhda faqat status tugmalari qoldi
        
        async function sendTelegramMessage(chatId, text) {
            if (!BOT_TOKEN || !chatId) return;
            
            try {
                const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
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
        
        // =============================================
        // BOT COMMANDS
        // =============================================
        
        bot.start((ctx) => {
            clearUnavailableCartItems(ctx.session.cart);
            ctx.session.step = null;
            ctx.session.orderData = {};
            ctx.session.currentCategory = null;
            
            return ctx.reply(
                [
                    '🍔 *Ajabo Burger*ga xush kelibsiz!',
                    '',
                    '🌟 Mazali burgerlar va tez yetkazib berish!',
                    '',
                    '👇 Quyidagi tugmalardan birini tanlang:'
                ].join('\n'),
                { ...mainKeyboard, parse_mode: 'Markdown' }
            );
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
                    "Format: /add key|Nomi|Narx|Kategoriya|ImageURL\n\nMasalan:\n/add hotdog|Hot Dog|18000|Fast Food|https://site.com/img.jpg\n\nRasm bo'lmasa: -"
                );
            }
            
            try {
                await addMenuItem(parsed.key, parsed.name, parsed.price, parsed.category, parsed.image);
                sendSseEvent('menu_updated');
                return ctx.reply(`Qo'shildi: ${parsed.name} - ${formatPrice(parsed.price)}\nKategoriya: ${parsed.category}\nKey: ${parsed.key}`);
            } catch (error) {
                return ctx.reply(`Xato: ${error.message}`);
            }
        });
        
        bot.command('edit', async (ctx) => {
            if (!isAdminChat(ctx)) return;
            
            const parsed = parseAddOrEditCommand(ctx.message.text, '/edit');
            if (!parsed) {
                return ctx.reply(
                    "Format: /edit key|Yangi Nomi|Yangi Narx|Kategoriya|ImageURL"
                );
            }
            
            try {
                await editMenuItem(parsed.key, parsed.name, parsed.price, parsed.category, parsed.image);
                sendSseEvent('menu_updated');
                return ctx.reply(`Yangilandi: ${parsed.name} - ${formatPrice(parsed.price)}\nKey: ${parsed.key}`);
            } catch (error) {
                return ctx.reply(`Xato: ${error.message}`);
            }
        });
        
        bot.command('delete', async (ctx) => {
            if (!isAdminChat(ctx)) return;
            
            const rawKey = ctx.message.text.replace('/delete', '').trim();
            const key = normalizeKey(rawKey);
            
            if (!key) return ctx.reply('Format: /delete key');
            
            try {
                const deleted = await deleteMenuItem(key);
                sendSseEvent('menu_updated');
                return ctx.reply(`O'chirildi: ${deleted.name} (${deleted.key})`);
            } catch (error) {
                return ctx.reply(`Xato: ${error.message}`);
            }
        });
        
        bot.command('hide', async (ctx) => {
            if (!isAdminChat(ctx)) return;
            
            const rawKey = ctx.message.text.replace('/hide', '').trim();
            const key = normalizeKey(rawKey);
            
            if (!key) return ctx.reply('Format: /hide key');
            
            try {
                const item = await setMenuItemActive(key, false);
                sendSseEvent('menu_updated');
                return ctx.reply(`Yashirildi: ${item.name} (${item.key})`);
            } catch (error) {
                return ctx.reply(`Xato: ${error.message}`);
            }
        });
        
        bot.command('show', async (ctx) => {
            if (!isAdminChat(ctx)) return;
            
            const rawKey = ctx.message.text.replace('/show', '').trim();
            const key = normalizeKey(rawKey);
            
            if (!key) return ctx.reply('Format: /show key');
            
            try {
                const item = await setMenuItemActive(key, true);
                sendSseEvent('menu_updated');
                return ctx.reply(`Ochildi: ${item.name} (${item.key})`);
            } catch (error) {
                return ctx.reply(`Xato: ${error.message}`);
            }
        });
        
        bot.command('stats', async (ctx) => {
            if (!isAdminChat(ctx)) return;
            
            const stats = getTodayStats(TIME_ZONE);
            const allOrders = getAllOrders();
            
            return ctx.reply([
                'Bugungi statistika:',
                '',
                `Sana: ${stats.date}`,
                `Bugungi buyurtmalar: ${stats.totalOrders}`,
                `Yangi: ${stats.newOrders}`,
                `Qabul qilingan: ${stats.acceptedOrders}`,
                `Tayyor: ${stats.readyOrders}`,
                `Yetkazilgan: ${stats.deliveredOrders}`,
                `Bekor qilingan: ${stats.cancelledOrders || 0}`,
                `Bugungi jami summa: ${formatPrice(stats.totalRevenue)}`,
                `Naqd tushum: ${formatPrice(stats.cashRevenue)}`,
                `Click tushum: ${formatPrice(stats.clickRevenue)}`,
                `To'langan buyurtmalar: ${stats.paidOrders}`,
                `To'lov kutilayotganlar: ${stats.pendingPaymentOrders}`,
                '',
                `Umumiy buyurtmalar: ${allOrders.length}`,
                '',
                `Ish vaqti: ${getWorkHoursText()}`,
                `Hozirgi vaqt: ${getCurrentTimeText()}`
            ].join('\n'));
        });
        
        // =============================================
        // BOT ACTIONS
        // =============================================
        
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
                item.name,
                `Kategoriya: ${item.category}`,
                `Narx: ${formatPrice(item.price)}`
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
            await ctx.answerCbQuery(`${item.name} qo'shildi`);
            
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
            
            const cartButtons = getCartButtons(ctx.session.cart);
            return ctx.reply(
                `${text}\n💰 Jami: ${formatPrice(total)}`,
                cartButtons
            );
        });
        
        bot.action('open_cart', async (ctx) => {
            clearUnavailableCartItems(ctx.session.cart);
            await ctx.answerCbQuery();
            
            const total = getCartTotal(ctx.session.cart);
            const text = getCartText(ctx.session.cart);
            
            if (total === 0) return ctx.reply(text);
            
            const cartButtons = getCartButtons(ctx.session.cart);
            return ctx.reply(
                `${text}\n💰 Jami: ${formatPrice(total)}`,
                cartButtons
            );
        });
        
        bot.action('clear_cart', async (ctx) => {
            ctx.session.cart = {};
            await ctx.answerCbQuery('Savat tozalandi');
            return ctx.reply('🗑 Savat tozalandi.\n\nYangi buyurtma berish uchun menyuni oching!', mainKeyboard);
        });
        
        bot.action('checkout', async (ctx) => {
            clearUnavailableCartItems(ctx.session.cart);
            
            const total = getCartTotal(ctx.session.cart);
            
            if (total === 0) {
                await ctx.answerCbQuery("Savat bo'sh");
                return;
            }
            
            if (!isRestaurantOpen()) {
                await ctx.answerCbQuery('Hozir yopiqmiz');
                return ctx.reply(getClosedText(), { ...mainKeyboard, parse_mode: 'Markdown' });
            }
            
            const fullName = [ctx.from.first_name, ctx.from.last_name].filter(Boolean).join(' ').trim();
            
            ctx.session.orderData = {
                name: fullName || "Noma'lum",
                username: ctx.from.username || '',
                deliveryType: null,
                paymentMethod: null
            };
            
            ctx.session.step = 'delivery_type';
            
            await ctx.answerCbQuery();
            
            return ctx.reply(
                [
                    '🚀 *Buyurtmani rasmiylashtirish*',
                    '',
                    "📦 Buyurtmani qanday olishni tanlang:"
                ].join('\n'),
                {
                    ...Markup.keyboard([
                        ['🚚 Yetkazib berish'],
                        ["📦 O'zim olib ketaman"]
                    ]).resize().oneTime(),
                    parse_mode: 'Markdown'
                }
            );
        });
        
        bot.hears('🚚 Yetkazib berish', (ctx) => {
            if (ctx.session.step !== 'delivery_type') return;
            
            ctx.session.orderData.deliveryType = 'delivery';
            ctx.session.step = 'payment_method';
            
            return ctx.reply(
                [
                    "💳 *To'lov usulini tanlang:*",
                    '',
                    "💵 *Naqd* — Yetkazib berishda to'laysiz",
                    "💳 *Click* — Hoziroq onlayn to'lang"
                ].join('\n'),
                {
                    ...Markup.keyboard([
                        ['💵 Naqd'],
                        ['💳 Click']
                    ]).resize().oneTime(),
                    parse_mode: 'Markdown'
                }
            );
        });
        
        bot.hears("📦 O'zim olib ketaman", (ctx) => {
            if (ctx.session.step !== 'delivery_type') return;
            
            ctx.session.orderData.deliveryType = 'pickup';
            ctx.session.step = 'payment_method';
            
            return ctx.reply(
                [
                    "💳 *To'lov usulini tanlang:*",
                    '',
                    "💵 *Naqd* — Olib ketishda to'laysiz",
                    "💳 *Click* — Hoziroq onlayn to'lang"
                ].join('\n'),
                {
                    ...Markup.keyboard([
                        ['💵 Naqd'],
                        ['💳 Click']
                    ]).resize().oneTime(),
                    parse_mode: 'Markdown'
                }
            );
        });
        
        bot.hears('💵 Naqd', (ctx) => {
            if (ctx.session.step !== 'payment_method') return;
            
            ctx.session.orderData.paymentMethod = 'cash';
            ctx.session.step = 'phone';
            
            return ctx.reply(
                [
                    '📱 *Telefon raqamingizni yuboring*',
                    '',
                    "Quyidagi tugmani bosing yoki raqamni qo'lda kiriting:"
                ].join('\n'),
                {
                    ...Markup.keyboard([
                        [Markup.button.contactRequest('📱 Telefon raqamni yuborish')]
                    ]).resize().oneTime(),
                    parse_mode: 'Markdown'
                }
            );
        });
        
        bot.hears('💳 Click', (ctx) => {
            if (ctx.session.step !== 'payment_method') return;
            
            if (!CLICK_PROVIDER_TOKEN) {
                return ctx.reply("Click token topilmadi. Admin bilan bog'laning.");
            }
            
            ctx.session.orderData.paymentMethod = 'click';
            ctx.session.step = 'phone';
            
            return ctx.reply(
                [
                    '📱 *Telefon raqamingizni yuboring*',
                    '',
                    "Quyidagi tugmani bosing yoki raqamni qo'lda kiriting:"
                ].join('\n'),
                {
                    ...Markup.keyboard([
                        [Markup.button.contactRequest('📱 Telefon raqamni yuborish')]
                    ]).resize().oneTime(),
                    parse_mode: 'Markdown'
                }
            );
        });
        
        bot.on('contact', (ctx) => {
            if (ctx.session.step !== 'phone') return;
            
            ctx.session.orderData.phone = ctx.message.contact.phone_number;
            
            if (ctx.session.orderData.deliveryType === 'pickup') {
                return finalizeOrder(
                    ctx,
                    { text: "O'zi olib ketadi" },
                    "O'zi olib ketadi"
                );
            }
            
            ctx.session.step = 'address';
            
            return ctx.reply(
                [
                    '📍 *Yetkazib berish manzili*',
                    '',
                    "Quyidagi usullardan birini tanlang:",
                    '',
                    "📍 *Lokatsiya* — Aniq joylashuvingizni yuboring",
                    "✏️ *Manzilni yozish* — Qo'lda kiriting"
                ].join('\n'),
                {
                    ...Markup.keyboard([
                        [Markup.button.locationRequest('📍 Lokatsiya yuborish')],
                        ["✏️ Manzilni yozaman"]
                    ]).resize(),
                    parse_mode: 'Markdown'
                }
            );
        });
        
        bot.hears("✏️ Manzilni yozaman", (ctx) => {
            if (ctx.session.step !== 'address') return;
            return ctx.reply(
                [
                    '✏️ *Manzilingizni yozing:*',
                    '',
                    "Masalan: Toshkent sh., Chilonzor tumani, Bunyodkor ko'chasi 12-uy"
                ].join('\n'),
                { parse_mode: 'Markdown' }
            );
        });
        
        bot.on('location', async (ctx) => {
            if (ctx.session.step !== 'address') return;
            
            const { latitude, longitude } = ctx.message.location;
            
            return finalizeOrder(
                ctx,
                {
                    lat: latitude,
                    lon: longitude,
                    text: `${latitude}, ${longitude}`
                },
                'Lokatsiya yuborildi'
            );
        });
        
        bot.on('text', async (ctx, next) => {
            const text = (ctx.message.text || '').trim();
            
            if (ctx.session.step === 'address') {
                if (!text || text.length < 5 || text === "✏️ Manzilni yozaman") {
                    return ctx.reply("⚠️ Iltimos, manzilni to'liqroq yozing.\n\nMasalan: Toshkent, Chilonzor, 12-uy");
                }
                
                return finalizeOrder(
                    ctx,
                    { text },
                    `Manzil: ${text}`
                );
            }
            
            return next();
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
            
            await syncAdminOrderMessage(updatedOrder);
            
            try {
                await bot.telegram.sendMessage(
                    updatedOrder.chatId,
                    buildUserStatusText(updatedOrder),
                    { ...mainKeyboard, parse_mode: 'Markdown' }
                );
            } catch (error) {
                console.log('Mijozga status yuborishda xato:', error.message);
            }
        });
        
        bot.hears('☎️ Aloqa', (ctx) => {
            return ctx.reply(
                [
                    '☎️ *Biz bilan bog\'laning*',
                    '',
                    '📞 Telefon: +998 90 123 45 67',
                    '',
                    `🕒 Ish vaqti: ${getWorkHoursText()}`,
                    `⏰ Hozirgi vaqt: ${getCurrentTimeText()}`,
                    '',
                    isRestaurantOpen()
                    ? '🟢 Hozir ochiq — Buyurtma berishingiz mumkin!'
                    : '🔴 Hozir yopiq — Ish vaqtida keling!'
                ].join('\n'),
                { ...mainKeyboard, parse_mode: 'Markdown' }
            );
        });
        
        // =============================================
        // EXPRESS API
        // =============================================
        
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
            return res.json(getMenu());
        });
        
        app.post('/api/menu', async (req, res) => {
            const { key, name, price, category, image } = req.body;
            
            if (!key || !name || !price || !category) {
                return res.status(400).json({ error: 'key, name, price, category kerak' });
            }
            
            try {
                await addMenuItem(key, name, Number(price), category, image || '');
                const item = getMenuItem(normalizeKey(key));
                sendSseEvent('menu_updated');
                return res.json(item);
            } catch (error) {
                return res.status(400).json({ error: error.message });
            }
        });
        
        app.put('/api/menu/:key', async (req, res) => {
            const key = normalizeKey(req.params.key);
            const oldItem = getMenuItem(key);
            
            if (!oldItem) {
                return res.status(404).json({ error: 'Mahsulot topilmadi' });
            }
            
            try {
                if (req.body.active !== undefined && Object.keys(req.body).length === 1) {
                    const item = await setMenuItemActive(key, Boolean(req.body.active));
                    sendSseEvent('menu_updated');
                    return res.json(item);
                }
                
                const name = req.body.name ?? oldItem.name;
                const price = req.body.price !== undefined ? Number(req.body.price) : oldItem.price;
                const category = req.body.category ?? oldItem.category;
                const image = req.body.image !== undefined ? req.body.image : oldItem.image;
                
                await editMenuItem(key, name, price, category, image);
                
                if (req.body.active !== undefined) {
                    await setMenuItemActive(key, Boolean(req.body.active));
                }
                
                sendSseEvent('menu_updated');
                return res.json(getMenuItem(key));
            } catch (error) {
                return res.status(400).json({ error: error.message });
            }
        });
        
        app.delete('/api/menu/:key', async (req, res) => {
            const key = normalizeKey(req.params.key);
            
            try {
                const deleted = await deleteMenuItem(key);
                sendSseEvent('menu_updated');
                return res.json(deleted);
            } catch (error) {
                return res.status(404).json({ error: error.message });
            }
        });
        
        app.get('/api/orders', async (req, res) => {
            return res.json(getAllOrders());
        });
        
        app.put('/api/orders/:id/status', async (req, res) => {
            const { status } = req.body;
            const id = req.params.id;
            
            try {
                const updated = await updateOrderStatus(id, status);
                sendSseEvent('order_updated', updated);
                
                if (updated.paymentStatus === 'paid') {
                    clearPaymentTimer(id);
                }
                
                await syncAdminOrderMessage(updated);
                
                try {
                    await bot.telegram.sendMessage(
                        updated.chatId,
                        buildUserStatusText(updated),
                        { parse_mode: 'Markdown' }
                    );
                } catch (e) {
                    console.log('Status xabar yuborishda xato:', e.message);
                }
                
                return res.json(updated);
            } catch (error) {
                return res.status(404).json({ error: error.message });
            }
        });
        
        app.put('/api/orders/:id/payment', async (req, res) => {
            const id = req.params.id;
            const { paymentMethod, paymentStatus, paidAt, clickTransactionId } = req.body;
            
            try {
                const updated = await updateOrderPayment(id, {
                    paymentMethod,
                    paymentStatus,
                    paidAt,
                    clickTransactionId
                });
                
                if (updated.paymentStatus === 'paid') {
                    clearPaymentTimer(id);
                }
                
                sendSseEvent('order_updated', updated);
                await syncAdminOrderMessage(updated);
                
                return res.json(updated);
            } catch (error) {
                return res.status(404).json({ error: error.message });
            }
        });
        
        app.delete('/api/orders/:id', async (req, res) => {
            const id = req.params.id;
            
            try {
                const order = getOrderById(id);
                
                if (!order) {
                    return res.status(404).json({ error: 'Buyurtma topilmadi' });
                }
                
                clearPaymentTimer(id);
                await deleteOrder(id);
                sendSseEvent('order_deleted', { id });
                
                return res.json({ success: true });
            } catch (error) {
                return res.status(500).json({ error: error.message });
            }
        });
        
        app.get('/api/stats', async (req, res) => {
            const orders = getAllOrders();
            
            const totalOrders = orders.length;
            const newOrders = orders.filter((o) => o.status === 'Yangi buyurtma').length;
            const acceptedOrders = orders.filter((o) => o.status === 'Qabul qilindi').length;
            const readyOrders = orders.filter((o) => o.status === 'Tayyor').length;
            const deliveredOrders = orders.filter((o) => o.status === 'Yetkazildi').length;
            const cancelledOrders = orders.filter((o) => o.status === 'Bekor qilindi').length;
            const totalRevenue = orders.reduce((sum, o) => sum + Number(o.total || 0), 0);
            const cashRevenue = orders
            .filter((o) => (o.paymentMethod || 'cash') === 'cash')
            .reduce((sum, o) => sum + Number(o.total || 0), 0);
            const clickRevenue = orders
            .filter((o) => o.paymentMethod === 'click')
            .reduce((sum, o) => sum + Number(o.total || 0), 0);
            const paidOrders = orders.filter((o) =>
                o.status !== 'Bekor qilindi' && (
                o.paymentStatus === 'paid' ||
                (o.paymentMethod || 'cash') === 'cash'
            )
        ).length;
        const pendingPaymentOrders = orders.filter((o) => o.paymentMethod === 'click' && (o.paymentStatus || 'pending') === 'pending').length;
        
        return res.json({
            totalOrders,
            newOrders,
            acceptedOrders,
            readyOrders,
            deliveredOrders,
            cancelledOrders,
            totalRevenue,
            cashRevenue,
            clickRevenue,
            paidOrders,
            pendingPaymentOrders
        });
    });
    
    bot.catch((err) => {
        console.error('BOT ERROR:', err);
    });
    
    // =============================================
    // START
    // =============================================
    
    async function startApp() {
        await connectDb();
        await initMenu();
        await initOrders();
        
        app.listen(PORT, () => {
            console.log(`Server ishladi: ${PORT}`);
        });
        
        try {
            await bot.telegram.deleteWebhook();
        } catch (error) {
            console.log("Webhook o'chirishda xato:", error.message);
        }
        
        try {
            await bot.launch();
            console.log('Bot ishga tushdi');
            console.log('ADMIN_CHAT_ID:', ADMIN_CHAT_ID || "yo'q");
            console.log('CLICK_PROVIDER_TOKEN:', CLICK_PROVIDER_TOKEN ? 'mavjud' : "yo'q");
            console.log('WORK HOURS:', `${WORK_START} - ${WORK_END}`);
            console.log('CURRENT TIME:', getCurrentTimeText());
            console.log('IS OPEN:', isRestaurantOpen());
        } catch (error) {
            console.error('BOT LAUNCH ERROR:', error);
        }
    }
    
    startApp();
    
    process.once('SIGINT', async () => {
        try {
            for (const timer of paymentTimers.values()) {
                clearTimeout(timer);
            }
            paymentTimers.clear();
            await bot.stop('SIGINT');
        } finally {
            process.exit(0);
        }
    });
    
    process.once('SIGTERM', async () => {
        try {
            for (const timer of paymentTimers.values()) {
                clearTimeout(timer);
            }
            paymentTimers.clear();
            await bot.stop('SIGTERM');
        } finally {
            process.exit(0);
        }
    });