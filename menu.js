import { getMenuCollection, getCategoryOrderCollection } from './db.js';

let menuCache = {};
let categoryOrderCache = {}; // { 'BURGER': 1, 'LAVASH': 2, ... }

export async function initMenu() {
    const collection = await getMenuCollection();
    const items = await collection.find({}).toArray();
    
    menuCache = {};
    
    for (const item of items) {
        menuCache[item.key] = {
            key: item.key,
            name: item.name,
            price: Number(item.price || 0),
            category: item.category || 'Boshqa',
            image: item.image || '',
            active: item.active !== false,
            order: Number(item.order ?? 9999), // tartib raqami
        };
    }
    
    if (Object.keys(menuCache).length === 0) {
        const seedItems = [
            { key: 'lavash', name: 'Lavash', price: 28000, category: 'Fast Food', image: '', active: true, order: 1 },
            { key: 'burger', name: 'Burger', price: 32000, category: 'Fast Food', image: '', active: true, order: 2 },
            { key: 'pizza', name: 'Pizza', price: 65000, category: 'Pizza', image: '', active: true, order: 3 },
            { key: 'cola_1l', name: 'Coca-Cola 1L', price: 12000, category: 'Ichimliklar', image: '', active: true, order: 4 },
        ];
        
        await collection.insertMany(seedItems);
        
        for (const item of seedItems) {
            menuCache[item.key] = item;
        }
    }
    
    // Kategoriya tartibini DB dan yuklash
    try {
        const catCollection = await getCategoryOrderCollection();
        const catOrders = await catCollection.find({}).toArray();
        categoryOrderCache = {};
        for (const item of catOrders) {
            categoryOrderCache[item.category] = Number(item.order ?? 9999);
        }
    } catch {
        categoryOrderCache = {};
    }
    
    return menuCache;
}

export function normalizeKey(value) {
    return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_');
}

export function getMenu() {
    return menuCache;
}

export function getMenuArray({ activeOnly = false } = {}) {
    const items = Object.values(menuCache);
    const filtered = activeOnly ? items.filter((item) => item.active) : items;
    // order maydoni bo'yicha tartiblash
    return filtered.sort((a, b) => (a.order ?? 9999) - (b.order ?? 9999));
}

export function getMenuItem(key) {
    return menuCache[normalizeKey(key)] || null;
}

// Kategoriyalar: avval categoryOrderCache, keyin mahsulot order bo'yicha
export function getCategories({ activeOnly = false } = {}) {
    const items = getMenuArray({ activeOnly });
    
    const uniqueCategories = [...new Set(items.map((i) => i.category).filter(Boolean))];
    
    return uniqueCategories.sort((a, b) => {
        const oa = categoryOrderCache[a] ?? 9999;
        const ob = categoryOrderCache[b] ?? 9999;
        return oa - ob;
    });
}

// Kategoriya tartibini o'zgartirish
export async function setCategoryOrder(category, order) {
    const cat = String(category).trim();
    const ord = Number(order);
    
    const collection = await getCategoryOrderCollection();
    await collection.updateOne(
        { category: cat },
        { $set: { category: cat, order: ord } },
        { upsert: true }
    );
    
    categoryOrderCache[cat] = ord;
    return { category: cat, order: ord };
}

// Barcha kategoriya tartiblarini ko'rish
export function getCategoryOrders() {
    const items = getMenuArray();
    const uniqueCategories = [...new Set(items.map((i) => i.category).filter(Boolean))];
    
    return uniqueCategories.map((cat) => ({
        category: cat,
        order: categoryOrderCache[cat] ?? 9999,
    })).sort((a, b) => a.order - b.order);
}

export function getItemsByCategory(category, { activeOnly = false } = {}) {
    return getMenuArray({ activeOnly }).filter((item) => item.category === category);
}

export async function addMenuItem(key, name, price, category, image = '', order = null) {
    const normalizedKey = normalizeKey(key);
    
    if (menuCache[normalizedKey]) {
        throw new Error('Bunday key bilan mahsulot mavjud');
    }
    
    // Agar order berilmasa, mavjud eng katta order + 1
    const maxOrder = Object.values(menuCache).reduce((max, item) => Math.max(max, item.order ?? 0), 0);
    const itemOrder = order !== null ? Number(order) : maxOrder + 1;
    
    const item = {
        key: normalizedKey,
        name: String(name).trim(),
        price: Number(price),
        category: String(category).trim(),
        image: String(image || '').trim(),
        active: true,
        order: itemOrder,
    };
    
    const collection = await getMenuCollection();
    await collection.insertOne(item);
    
    menuCache[normalizedKey] = item;
    return item;
}

export async function editMenuItem(key, name, price, category, image = '', order = null) {
    const normalizedKey = normalizeKey(key);
    
    if (!menuCache[normalizedKey]) {
        throw new Error('Mahsulot topilmadi');
    }
    
    const updated = {
        ...menuCache[normalizedKey],
        name: String(name).trim(),
        price: Number(price),
        category: String(category).trim(),
        image: String(image || '').trim(),
    };
    
    // Agar order berilgan bo'lsa yangilash
    if (order !== null) {
        updated.order = Number(order);
    }
    
    const collection = await getMenuCollection();
    await collection.updateOne(
        { key: normalizedKey },
        {
            $set: {
                name: updated.name,
                price: updated.price,
                category: updated.category,
                image: updated.image,
                order: updated.order,
            }
        }
    );
    
    menuCache[normalizedKey] = updated;
    return updated;
}

export async function setMenuItemOrder(key, order) {
    const normalizedKey = normalizeKey(key);
    
    if (!menuCache[normalizedKey]) {
        throw new Error('Mahsulot topilmadi');
    }
    
    const collection = await getMenuCollection();
    await collection.updateOne(
        { key: normalizedKey },
        { $set: { order: Number(order) } }
    );
    
    menuCache[normalizedKey].order = Number(order);
    return menuCache[normalizedKey];
}

export async function deleteMenuItem(key) {
    const normalizedKey = normalizeKey(key);
    
    if (!menuCache[normalizedKey]) {
        throw new Error('Mahsulot topilmadi');
    }
    
    const deleted = menuCache[normalizedKey];
    
    const collection = await getMenuCollection();
    await collection.deleteOne({ key: normalizedKey });
    
    delete menuCache[normalizedKey];
    return deleted;
}

export async function setMenuItemActive(key, active) {
    const normalizedKey = normalizeKey(key);
    
    if (!menuCache[normalizedKey]) {
        throw new Error('Mahsulot topilmadi');
    }
    
    const value = Boolean(active);
    
    const collection = await getMenuCollection();
    await collection.updateOne(
        { key: normalizedKey },
        { $set: { active: value } }
    );
    
    menuCache[normalizedKey].active = value;
    return menuCache[normalizedKey];
}

export function formatMenuList() {
    const items = getMenuArray();
    
    if (!items.length) {
        return "Mahsulotlar yo'q";
    }
    
    return items
    .map((item, index) => {
        const status = item.active ? 'aktiv' : 'yashirin';
        return `${index + 1}. [${item.order}] ${item.name} — ${item.price} so'm | ${item.category} | key: ${item.key} | ${status}`;
    })
    .join('\n');
}