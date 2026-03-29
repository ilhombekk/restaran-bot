import { getMenuCollection } from './db.js';

let menuCache = {};

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
        };
    }
    
    if (Object.keys(menuCache).length === 0) {
        const seedItems = [
            {
                key: 'lavash',
                name: 'Lavash',
                price: 28000,
                category: 'Fast Food',
                image: '',
                active: true,
            },
            {
                key: 'burger',
                name: 'Burger',
                price: 32000,
                category: 'Fast Food',
                image: '',
                active: true,
            },
            {
                key: 'pizza',
                name: 'Pizza',
                price: 65000,
                category: 'Pizza',
                image: '',
                active: true,
            },
            {
                key: 'cola_1l',
                name: 'Coca-Cola 1L',
                price: 12000,
                category: 'Ichimliklar',
                image: '',
                active: true,
            }
        ];
        
        await collection.insertMany(seedItems);
        
        for (const item of seedItems) {
            menuCache[item.key] = item;
        }
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
    return activeOnly ? items.filter((item) => item.active) : items;
}

export function getMenuItem(key) {
    return menuCache[normalizeKey(key)] || null;
}

export function getCategories({ activeOnly = false } = {}) {
    const items = getMenuArray({ activeOnly });
    return [...new Set(items.map((item) => item.category).filter(Boolean))];
}

export function getItemsByCategory(category, { activeOnly = false } = {}) {
    return getMenuArray({ activeOnly }).filter((item) => item.category === category);
}

export async function addMenuItem(key, name, price, category, image = '') {
    const normalizedKey = normalizeKey(key);
    
    if (menuCache[normalizedKey]) {
        throw new Error('Bunday key bilan mahsulot mavjud');
    }
    
    const item = {
        key: normalizedKey,
        name: String(name).trim(),
        price: Number(price),
        category: String(category).trim(),
        image: String(image || '').trim(),
        active: true,
    };
    
    const collection = await getMenuCollection();
    await collection.insertOne(item);
    
    menuCache[normalizedKey] = item;
    return item;
}

export async function editMenuItem(key, name, price, category, image = '') {
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
    
    const collection = await getMenuCollection();
    await collection.updateOne(
        { key: normalizedKey },
        {
            $set: {
                name: updated.name,
                price: updated.price,
                category: updated.category,
                image: updated.image,
            }
        }
    );
    
    menuCache[normalizedKey] = updated;
    return updated;
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
        return 'Mahsulotlar yo‘q';
    }
    
    return items
    .map((item, index) => {
        const status = item.active ? 'aktiv' : 'yashirin';
        return `${index + 1}. ${item.name} — ${item.price} so'm | ${item.category} | key: ${item.key} | ${status}`;
    })
    .join('\n');
}