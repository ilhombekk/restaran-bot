import 'dotenv/config';
import { MongoClient, ServerApiVersion } from 'mongodb';

const uri = process.env.MONGODB_URI;

if (!uri) {
    throw new Error('MONGODB_URI topilmadi');
}

const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    },
});

let dbInstance = null;

export async function connectDb() {
    if (dbInstance) return dbInstance;
    
    await client.connect();
    dbInstance = client.db(process.env.MONGODB_DB_NAME || 'restaurant_bot');
    
    console.log('✅ MongoDB ulandi');
    return dbInstance;
}

export async function getDb() {
    if (dbInstance) return dbInstance;
    return await connectDb();
}

export async function getMenuCollection() {
    const db = await getDb();
    return db.collection('menu');
}

export async function getOrdersCollection() {
    const db = await getDb();
    return db.collection('orders');
}

export async function getCategoryOrderCollection() {
    const db = await getDb();
    return db.collection('category_orders');
}