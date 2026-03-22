import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const app = express();
app.use(cors());
app.use(express.json());

const BOT_TOKEN = process.env.BOT_TOKEN;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MENU_FILE = path.join(__dirname, 'menu.json');
const ORDERS_FILE = path.join(__dirname, 'orders.json');

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
    if (!BOT_TOKEN || !chatId) return;
    
    try {
        const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                chat_id: chatId,
                text
            })
        });
        
        const data = await response.json();
        
        if (!data.ok) {
            console.log('Telegram API xato:', data.description);
        }
    } catch (error) {
        console.log('Telegramga xabar yuborishda xato:', error.message);
    }
}

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
    res.json(menu[key]);
});

app.put('/api/menu/:key', async (req, res) => {
    const menu = await readJson(MENU_FILE, {});
    const key = req.params.key;
    
    if (!menu[key]) {
        return res.status(404).json({ error: 'Mahsulot topilmadi' });
    }
    
    const oldItem = menu[key];
    const updated = {
        ...oldItem,
        ...req.body,
        key
    };
    
    if (updated.price !== undefined) {
        updated.price = Number(updated.price);
    }
    
    menu[key] = updated;
    await writeJson(MENU_FILE, menu);
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

const PORT = 5000;
app.listen(PORT, () => {
    console.log(`API server ishladi: http://localhost:${PORT}`);
});