import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const MENU_FILE = path.join(__dirname, 'menu.json');

const DEFAULT_MENU = {
    lavash: {
        key: 'lavash',
        name: 'Lavash',
        price: 28000,
        category: 'Fast Food',
        image: '',
        active: true
    },
    burger: {
        key: 'burger',
        name: 'Burger',
        price: 32000,
        category: 'Fast Food',
        image: '',
        active: true
    },
    pizza: {
        key: 'pizza',
        name: 'Pizza',
        price: 65000,
        category: 'Pizza',
        image: '',
        active: true
    },
    cola: {
        key: 'cola',
        name: 'Coca-Cola 1L',
        price: 12000,
        category: 'Ichimliklar',
        image: '',
        active: true
    }
};

let MENU = {};

async function saveMenu() {
    await fs.writeFile(MENU_FILE, JSON.stringify(MENU, null, 2), 'utf-8');
}

export async function initMenu() {
    try {
        const raw = await fs.readFile(MENU_FILE, 'utf-8');
        MENU = JSON.parse(raw);
        
        if (!MENU || typeof MENU !== 'object' || Array.isArray(MENU)) {
            MENU = { ...DEFAULT_MENU };
            await saveMenu();
        }
    } catch {
        MENU = { ...DEFAULT_MENU };
        await saveMenu();
    }
}

export function getMenu() {
    return MENU;
}

export function getMenuArray({ activeOnly = false } = {}) {
    let items = Object.values(MENU);
    
    if (activeOnly) {
        items = items.filter((item) => item.active);
    }
    
    return items;
}

export function getMenuItem(key) {
    return MENU[key] || null;
}

export function hasMenuItem(key) {
    return Boolean(MENU[key]);
}

export function getCategories({ activeOnly = true } = {}) {
    const items = getMenuArray({ activeOnly });
    return [...new Set(items.map((item) => item.category).filter(Boolean))];
}

export function getItemsByCategory(category, { activeOnly = true } = {}) {
    const items = getMenuArray({ activeOnly });
    return items.filter((item) => item.category === category);
}

export async function addMenuItem(key, name, price, category, image = '') {
    if (MENU[key]) {
        throw new Error('Bu key bilan mahsulot allaqachon mavjud.');
    }
    
    MENU[key] = {
        key,
        name,
        price: Number(price),
        category,
        image,
        active: true
    };
    
    await saveMenu();
    return MENU[key];
}

export async function editMenuItem(key, name, price, category, image = '') {
    if (!MENU[key]) {
        throw new Error('Bunday key bilan mahsulot topilmadi.');
    }
    
    MENU[key] = {
        ...MENU[key],
        key,
        name,
        price: Number(price),
        category,
        image
    };
    
    await saveMenu();
    return MENU[key];
}

export async function deleteMenuItem(key) {
    if (!MENU[key]) {
        throw new Error('Bunday key bilan mahsulot topilmadi.');
    }
    
    const deleted = MENU[key];
    delete MENU[key];
    await saveMenu();
    return deleted;
}

export async function setMenuItemActive(key, active) {
    if (!MENU[key]) {
        throw new Error('Bunday key bilan mahsulot topilmadi.');
    }
    
    MENU[key].active = Boolean(active);
    await saveMenu();
    return MENU[key];
}

export function normalizeKey(value) {
    return String(value)
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '');
}

export function formatMenuList() {
    const items = Object.values(MENU);
    
    if (!items.length) {
        return '📭 Menyu bo‘sh.';
    }
    
    const lines = ['📋 Hozirgi menyu:', ''];
    
    for (const item of items) {
        lines.push(
            `• ${item.name} — ${new Intl.NumberFormat('uz-UZ').format(item.price)} so'm`,
            `  key: ${item.key}`,
            `  category: ${item.category}`,
            `  holat: ${item.active ? 'aktiv' : 'yashirilgan'}`,
            `  image: ${item.image || 'yo‘q'}`,
            ''
        );
    }
    
    return lines.join('\n');
}