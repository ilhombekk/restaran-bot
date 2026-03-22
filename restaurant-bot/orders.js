import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ORDERS_FILE = path.join(__dirname, 'orders.json');

let ORDERS = [];

async function saveOrders() {
    await fs.writeFile(ORDERS_FILE, JSON.stringify(ORDERS, null, 2), 'utf-8');
}

export async function initOrders() {
    try {
        const raw = await fs.readFile(ORDERS_FILE, 'utf-8');
        const parsed = JSON.parse(raw);
        
        if (Array.isArray(parsed)) {
            ORDERS = parsed;
        } else {
            ORDERS = [];
            await saveOrders();
        }
    } catch {
        ORDERS = [];
        await saveOrders();
    }
}

export function getAllOrders() {
    return ORDERS;
}

export async function addOrder(order) {
    ORDERS.unshift(order);
    await saveOrders();
    return order;
}

export function getOrderById(orderId) {
    return ORDERS.find((order) => String(order.id) === String(orderId)) || null;
}

export async function updateOrderStatus(orderId, newStatus) {
    const order = getOrderById(orderId);
    
    if (!order) {
        throw new Error('Buyurtma topilmadi');
    }
    
    order.status = newStatus;
    order.updatedAt = new Date().toISOString();
    
    await saveOrders();
    return order;
}

export function getTodayStats(timeZone = 'Asia/Tashkent') {
    const today = new Intl.DateTimeFormat('en-CA', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    }).format(new Date());
    
    const todayOrders = ORDERS.filter((order) => {
        const orderDay = new Intl.DateTimeFormat('en-CA', {
            timeZone,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        }).format(new Date(order.createdAt));
        
        return orderDay === today;
    });
    
    const totalRevenue = todayOrders.reduce((sum, order) => sum + (order.total || 0), 0);
    const deliveredRevenue = todayOrders
    .filter((order) => order.status === 'Yetkazildi')
    .reduce((sum, order) => sum + (order.total || 0), 0);
    
    return {
        date: today,
        totalOrders: todayOrders.length,
        newOrders: todayOrders.filter((o) => o.status === 'Yangi buyurtma').length,
        acceptedOrders: todayOrders.filter((o) => o.status === 'Qabul qilindi').length,
        readyOrders: todayOrders.filter((o) => o.status === 'Tayyor').length,
        deliveredOrders: todayOrders.filter((o) => o.status === 'Yetkazildi').length,
        totalRevenue,
        deliveredRevenue
    };
}