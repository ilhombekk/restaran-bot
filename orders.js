import { getOrdersCollection } from './db.js';

let ordersCache = [];

function normalizePaymentMethod(value) {
    if (value === 'click') return 'click';
    return 'cash';
}

function normalizePaymentStatus(value) {
    if (value === 'paid') return 'paid';
    if (value === 'failed') return 'failed';
    return 'pending';
}

export async function initOrders() {
    const collection = await getOrdersCollection();
    const items = await collection.find({}).sort({ createdAt: -1 }).toArray();
    
    ordersCache = items.map((item) => ({
        id: item.id,
        name: item.name,
        phone: item.phone,
        username: item.username || '',
        telegramName: item.telegramName || '',
        userId: item.userId,
        chatId: item.chatId,
        deliveryType: item.deliveryType || 'delivery',
        location: item.location || null,
        cart: item.cart || {},
        cartText: item.cartText || '',
        subtotal: Number(item.subtotal || item.total || 0),
        deliveryFee: Number(item.deliveryFee || 0),
        total: Number(item.total || 0),
        status: item.status || 'Yangi buyurtma',
        paymentMethod: normalizePaymentMethod(item.paymentMethod),
        paymentStatus: normalizePaymentStatus(item.paymentStatus),
        paidAt: item.paidAt || null,
        clickTransactionId: item.clickTransactionId || null,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt || item.createdAt,
        adminMessageId: item.adminMessageId || null,
        adminLocationMessageId: item.adminLocationMessageId || null,
    }));
    
    return ordersCache;
}

export function getAllOrders() {
    return ordersCache;
}

export function getOrderById(id) {
    return ordersCache.find((item) => String(item.id) === String(id)) || null;
}

export async function addOrder(order) {
    const newOrder = {
        ...order,
        deliveryType: order.deliveryType || 'delivery',
        subtotal: Number(order.subtotal || order.total || 0),
        deliveryFee: Number(order.deliveryFee || 0),
        total: Number(order.total || 0),
        paymentMethod: normalizePaymentMethod(order.paymentMethod),
        paymentStatus: normalizePaymentStatus(order.paymentStatus),
        paidAt: order.paidAt || null,
        clickTransactionId: order.clickTransactionId || null,
        createdAt: order.createdAt || new Date().toISOString(),
        updatedAt: order.updatedAt || new Date().toISOString(),
        adminMessageId: order.adminMessageId || null,
        adminLocationMessageId: order.adminLocationMessageId || null,
    };
    
    const collection = await getOrdersCollection();
    await collection.insertOne(newOrder);
    
    ordersCache.unshift(newOrder);
    return newOrder;
}

export async function updateOrderStatus(id, status) {
    const order = getOrderById(id);
    
    if (!order) {
        throw new Error('Buyurtma topilmadi');
    }
    
    order.status = status;
    order.updatedAt = new Date().toISOString();
    
    const collection = await getOrdersCollection();
    await collection.updateOne(
        { id: String(id) },
        {
            $set: {
                status: order.status,
                updatedAt: order.updatedAt,
            }
        }
    );
    
    return order;
}

export async function updateOrderPayment(id, data = {}) {
    const order = getOrderById(id);
    
    if (!order) {
        throw new Error('Buyurtma topilmadi');
    }
    
    if (data.paymentMethod !== undefined) {
        order.paymentMethod = normalizePaymentMethod(data.paymentMethod);
    }
    
    if (data.paymentStatus !== undefined) {
        order.paymentStatus = normalizePaymentStatus(data.paymentStatus);
    }
    
    if (data.paidAt !== undefined) {
        order.paidAt = data.paidAt || null;
    }
    
    if (data.clickTransactionId !== undefined) {
        order.clickTransactionId = data.clickTransactionId || null;
    }
    
    // Yo'l haqi va jami summani yangilash
    if (data.deliveryFee !== undefined) {
        order.deliveryFee = Number(data.deliveryFee);
    }
    
    if (data.total !== undefined) {
        order.total = Number(data.total);
    }
    
    order.updatedAt = new Date().toISOString();
    
    const collection = await getOrdersCollection();
    await collection.updateOne(
        { id: String(id) },
        {
            $set: {
                paymentMethod: order.paymentMethod,
                paymentStatus: order.paymentStatus,
                paidAt: order.paidAt,
                clickTransactionId: order.clickTransactionId,
                deliveryFee: order.deliveryFee,
                total: order.total,
                updatedAt: order.updatedAt,
            }
        }
    );
    
    return order;
}

export async function updateOrderAdminMessages(id, data = {}) {
    const order = getOrderById(id);
    
    if (!order) {
        throw new Error('Buyurtma topilmadi');
    }
    
    if (data.adminMessageId !== undefined) {
        order.adminMessageId = data.adminMessageId;
    }
    
    if (data.adminLocationMessageId !== undefined) {
        order.adminLocationMessageId = data.adminLocationMessageId;
    }
    
    order.updatedAt = new Date().toISOString();
    
    const collection = await getOrdersCollection();
    await collection.updateOne(
        { id: String(id) },
        {
            $set: {
                adminMessageId: order.adminMessageId ?? null,
                adminLocationMessageId: order.adminLocationMessageId ?? null,
                updatedAt: order.updatedAt,
            }
        }
    );
    
    return order;
}

export async function deleteOrder(id) {
    const order = getOrderById(id);
    
    if (!order) {
        throw new Error('Buyurtma topilmadi');
    }
    
    const collection = await getOrdersCollection();
    await collection.deleteOne({ id: String(id) });
    
    ordersCache = ordersCache.filter((item) => String(item.id) !== String(id));
    
    return order;
}

export function getTodayStats(timeZone = 'Asia/Tashkent') {
    const now = new Date();
    
    const formatter = new Intl.DateTimeFormat('en-CA', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    });
    
    const today = formatter.format(now);
    
    const todayOrders = ordersCache.filter((order) => {
        if (!order.createdAt) return false;
        const orderDate = formatter.format(new Date(order.createdAt));
        return orderDate === today;
    });
    
    const totalOrders = todayOrders.length;
    const newOrders = todayOrders.filter((o) => o.status === 'Yangi buyurtma').length;
    const acceptedOrders = todayOrders.filter((o) => o.status === 'Qabul qilindi').length;
    const readyOrders = todayOrders.filter((o) => o.status === 'Tayyor').length;
    const deliveredOrders = todayOrders.filter((o) => o.status === 'Yetkazildi').length;
    
    const activeOrders = todayOrders.filter((o) => o.status !== 'Bekor qilindi');
    const totalRevenue = activeOrders
    .filter((o) => o.paymentStatus === 'paid' || (o.paymentMethod || 'cash') === 'cash')
    .reduce((sum, o) => sum + Number(o.total || 0), 0);
    
    const cashRevenue = activeOrders
    .filter((o) => (o.paymentMethod || 'cash') === 'cash')
    .reduce((sum, o) => sum + Number(o.total || 0), 0);
    
    const clickRevenue = activeOrders
    .filter((o) => o.paymentMethod === 'click' && o.paymentStatus === 'paid')
    .reduce((sum, o) => sum + Number(o.total || 0), 0);
    
    const paidOrders = activeOrders.filter((o) =>
        o.paymentStatus === 'paid' || (o.paymentMethod || 'cash') === 'cash'
).length;
const pendingPaymentOrders = todayOrders.filter((o) =>
    o.paymentMethod === 'click' && (o.paymentStatus || 'pending') === 'pending'
).length;

return {
    date: today,
    totalOrders,
    newOrders,
    acceptedOrders,
    readyOrders,
    deliveredOrders,
    totalRevenue,
    cashRevenue,
    clickRevenue,
    paidOrders,
    pendingPaymentOrders,
};
}