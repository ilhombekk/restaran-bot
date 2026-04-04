import { getOrdersCollection } from './db.js';

let ordersCache = [];

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
        location: item.location || null,
        cart: item.cart || {},
        cartText: item.cartText || '',
        total: Number(item.total || 0),
        status: item.status || 'Yangi buyurtma',
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
        total: Number(order.total || 0),
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
    const totalRevenue = todayOrders.reduce((sum, o) => sum + Number(o.total || 0), 0);
    const deliveredRevenue = todayOrders
    .filter((o) => o.status === 'Yetkazildi')
    .reduce((sum, o) => sum + Number(o.total || 0), 0);
    
    return {
        date: today,
        totalOrders,
        newOrders,
        acceptedOrders,
        readyOrders,
        deliveredOrders,
        totalRevenue,
        deliveredRevenue,
    };
}