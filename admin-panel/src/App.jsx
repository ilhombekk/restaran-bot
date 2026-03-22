import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  LayoutDashboard,
  ShoppingBag,
  Package,
  BarChart3,
  Search,
  Phone,
  MapPin,
  CheckCircle2,
  ChefHat,
  Truck,
  Eye,
  Plus,
  Pencil,
  Power,
  PowerOff,
  Bell,
  UtensilsCrossed,
} from 'lucide-react';

const API = 'http://localhost:5000/api';

const statusMap = {
  'Yangi buyurtma': { label: 'Yangi', bg: '#dbeafe', color: '#1d4ed8' },
  'Qabul qilindi': { label: 'Qabul qilindi', bg: '#fef3c7', color: '#b45309' },
  'Tayyor': { label: 'Tayyor', bg: '#ede9fe', color: '#6d28d9' },
  'Yetkazildi': { label: 'Yetkazildi', bg: '#d1fae5', color: '#047857' },
};

function formatPrice(value) {
  return new Intl.NumberFormat('uz-UZ').format(value) + " so'm";
}

function Card({ children, style = {} }) {
  return (
    <div
    style={{
      background: '#fff',
      borderRadius: 24,
      padding: 20,
      boxShadow: '0 4px 20px rgba(15,23,42,0.06)',
      ...style,
    }}
    >
    {children}
    </div>
  );
}

function Button({ children, onClick, style = {}, disabled = false }) {
  return (
    <button
    onClick={onClick}
    disabled={disabled}
    style={{
      border: 'none',
      borderRadius: 16,
      padding: '12px 16px',
      background: disabled ? '#e2e8f0' : '#0f172a',
      color: disabled ? '#64748b' : '#fff',
      cursor: disabled ? 'not-allowed' : 'pointer',
      fontWeight: 600,
      ...style,
    }}
    >
    {children}
    </button>
  );
}

function Input({ value, onChange, placeholder, type = 'text', style = {} }) {
  return (
    <input
    type={type}
    value={value}
    onChange={onChange}
    placeholder={placeholder}
    style={{
      width: '100%',
      padding: '12px 14px',
      borderRadius: 16,
      border: '1px solid #e2e8f0',
      outline: 'none',
      fontSize: 14,
      ...style,
    }}
    />
  );
}

function SidebarItem({ active, icon: Icon, label, onClick }) {
  return (
    <button
    onClick={onClick}
    style={{
      width: '100%',
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      padding: '14px 16px',
      borderRadius: 18,
      border: 'none',
      cursor: 'pointer',
      background: active ? '#0f172a' : 'transparent',
      color: active ? '#fff' : '#475569',
      textAlign: 'left',
    }}
    >
    <Icon size={18} />
    <span style={{ fontWeight: 600 }}>{label}</span>
    </button>
  );
}

function StatCard({ title, value, icon: Icon, helper }) {
  return (
    <Card>
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16 }}>
    <div>
    <div style={{ fontSize: 14, color: '#64748b' }}>{title}</div>
    <div style={{ marginTop: 8, fontSize: 28, fontWeight: 800, color: '#0f172a' }}>{value}</div>
    <div style={{ marginTop: 6, fontSize: 12, color: '#94a3b8' }}>{helper}</div>
    </div>
    <div
    style={{
      width: 44,
      height: 44,
      borderRadius: 16,
      background: '#f1f5f9',
      display: 'grid',
      placeItems: 'center',
    }}
    >
    <Icon size={20} />
    </div>
    </div>
    </Card>
  );
}

function Badge({ status }) {
  const conf = statusMap[status] || { label: status, bg: '#e2e8f0', color: '#334155' };
  return (
    <span
    style={{
      display: 'inline-block',
      padding: '6px 10px',
      borderRadius: 999,
      background: conf.bg,
      color: conf.color,
      fontSize: 12,
      fontWeight: 700,
    }}
    >
    {conf.label}
    </span>
  );
}

function getLocationData(order) {
  const lat =
  order?.location?.lat ??
  order?.location?.latitude ??
  order?.lat ??
  order?.latitude ??
  null;
  
  const lon =
  order?.location?.lon ??
  order?.location?.lng ??
  order?.location?.longitude ??
  order?.lng ??
  order?.lon ??
  order?.longitude ??
  null;
  
  const hasCoords =
  lat !== null &&
  lat !== undefined &&
  lon !== null &&
  lon !== undefined &&
  !Number.isNaN(Number(lat)) &&
  !Number.isNaN(Number(lon));
  
  return {
    lat: hasCoords ? Number(lat) : null,
    lon: hasCoords ? Number(lon) : null,
    hasCoords,
    link: hasCoords ? `https://maps.google.com/?q=${Number(lat)},${Number(lon)}` : '',
  };
}

function OrderCard({ order, onStatusChange }) {
  const items = typeof order.cartText === 'string'
  ? order.cartText
  .split('\n')
  .filter((line) => line.trim() && line.trim() !== '🛒 Savat:')
  : [];
  
  const location = getLocationData(order);
  
  return (
    <motion.div layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
    <Card>
    <div style={{ display: 'grid', gap: 20, gridTemplateColumns: '1.3fr 280px' }}>
    <div>
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
    <div style={{ fontSize: 20, fontWeight: 700 }}>Buyurtma #{order.id}</div>
    <Badge status={order.status} />
    </div>
    
    <div style={{ marginTop: 16, display: 'grid', gap: 10, color: '#475569', fontSize: 14 }}>
    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
    <Eye size={16} /> {order.name}
    </div>
    
    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
    <Phone size={16} /> {order.phone}
    </div>
    
    <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
    <MapPin size={16} style={{ marginTop: 2, flexShrink: 0 }} />
    <div style={{ display: 'grid', gap: 6 }}>
    {location.hasCoords ? (
      <>
      <span>
      {location.lat}, {location.lon}
      </span>
      <a
      href={location.link}
      target="_blank"
      rel="noreferrer"
      style={{
        color: '#2563eb',
        textDecoration: 'none',
        fontWeight: 600,
      }}
      >
      Xaritada ochish
      </a>
      </>
    ) : (
      <span>Lokatsiya yo‘q</span>
    )}
    </div>
    </div>
    </div>
    
    <div
    style={{
      marginTop: 16,
      padding: 14,
      borderRadius: 18,
      background: '#f8fafc',
    }}
    >
    <div style={{ fontWeight: 700, marginBottom: 10 }}>Mahsulotlar</div>
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
    {(items.length ? items : ['Mahsulotlar mavjud']).map((item, idx) => (
      <span
      key={idx}
      style={{
        padding: '8px 12px',
        borderRadius: 999,
        background: '#fff',
        border: '1px solid #e2e8f0',
        fontSize: 13,
      }}
      >
      {item}
      </span>
    ))}
    </div>
    </div>
    </div>
    
    <div style={{ display: 'grid', gap: 12 }}>
    <div
    style={{
      borderRadius: 20,
      padding: 18,
      background: '#0f172a',
      color: '#fff',
    }}
    >
    <div style={{ fontSize: 12, color: '#cbd5e1' }}>Jami summa</div>
    <div style={{ marginTop: 6, fontSize: 28, fontWeight: 800 }}>
    {formatPrice(order.total || 0)}
    </div>
    </div>
    
    <Button
    onClick={() => onStatusChange(order.id, 'Qabul qilindi')}
    disabled={order.status !== 'Yangi buyurtma'}
    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
    >
    <CheckCircle2 size={16} /> Qabul qilindi
    </Button>
    
    <Button
    onClick={() => onStatusChange(order.id, 'Tayyor')}
    disabled={order.status !== 'Qabul qilindi'}
    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
    >
    <ChefHat size={16} /> Tayyor
    </Button>
    
    <Button
    onClick={() => onStatusChange(order.id, 'Yetkazildi')}
    disabled={order.status !== 'Tayyor'}
    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
    >
    <Truck size={16} /> Yetkazildi
    </Button>
    </div>
    </div>
    </Card>
    </motion.div>
  );
}

export default function App() {
  const [page, setPage] = useState('dashboard');
  const [orders, setOrders] = useState([]);
  const [products, setProducts] = useState([]);
  const [statsData, setStatsData] = useState(null);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({
    id: '',
    name: '',
    price: '',
    category: 'Fast Food',
    image: '',
  });
  
  async function loadData() {
    try {
      const [menuRes, ordersRes, statsRes] = await Promise.all([
        fetch(`${API}/menu`),
        fetch(`${API}/orders`),
        fetch(`${API}/stats`),
      ]);
      
      const menuData = await menuRes.json();
      const ordersData = await ordersRes.json();
      const stats = await statsRes.json();
      
      setProducts(Object.values(menuData || {}));
      setOrders(Array.isArray(ordersData) ? ordersData : []);
      setStatsData(stats || null);
    } catch (error) {
      console.error('Ma’lumotlarni yuklashda xato:', error);
    }
  }
  
  useEffect(() => {
    loadData();
    
    const interval = setInterval(() => {
      loadData();
    }, 3000);
    
    return () => clearInterval(interval);
  }, []);
  
  const filteredOrders = useMemo(() => {
    return orders.filter((order) =>
      String(order.name || '').toLowerCase().includes(search.toLowerCase()) ||
    String(order.id).includes(search) ||
    String(order.phone || '').includes(search)
  );
}, [orders, search]);

const categories = [...new Set(products.map((p) => p.category).filter(Boolean))];

async function handleStatusChange(id, status) {
  try {
    await fetch(`${API}/orders/${id}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    
    await loadData();
  } catch (error) {
    console.error('Statusni yangilashda xato:', error);
  }
}

function openAdd() {
  setEditingId(null);
  setForm({ id: '', name: '', price: '', category: 'Fast Food', image: '' });
  setShowForm(true);
}

function openEdit(product) {
  setEditingId(product.key);
  setForm({
    id: product.key,
    name: product.name,
    price: String(product.price),
    category: product.category,
    image: product.image || '',
  });
  setShowForm(true);
}

async function saveProduct() {
  const payload = {
    key: form.id,
    name: form.name,
    price: Number(form.price),
    category: form.category,
    image: form.image,
    active: true,
  };
  
  try {
    if (editingId) {
      await fetch(`${API}/menu/${editingId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    } else {
      await fetch(`${API}/menu`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    }
    
    setShowForm(false);
    await loadData();
  } catch (error) {
    console.error('Mahsulotni saqlashda xato:', error);
  }
}

async function toggleProduct(product) {
  try {
    await fetch(`${API}/menu/${product.key}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: !product.active }),
    });
    
    await loadData();
  } catch (error) {
    console.error('Mahsulot holatini o‘zgartirishda xato:', error);
  }
}

async function deleteProduct(product) {
  try {
    await fetch(`${API}/menu/${product.key}`, {
      method: 'DELETE',
    });
    
    await loadData();
  } catch (error) {
    console.error('Mahsulotni o‘chirishda xato:', error);
  }
}

return (
  <div
  style={{
    minHeight: '100vh',
    background: '#f1f5f9',
    padding: 24,
    fontFamily: 'Arial, sans-serif',
  }}
  >
  <div
  style={{
    maxWidth: 1400,
    margin: '0 auto',
    display: 'grid',
    gridTemplateColumns: '260px 1fr',
    gap: 24,
  }}
  >
  <Card style={{ height: 'fit-content', position: 'sticky', top: 24 }}>
  <div
  style={{
    marginBottom: 24,
    padding: 16,
    borderRadius: 20,
    background: '#0f172a',
    color: '#fff',
    display: 'flex',
    gap: 12,
    alignItems: 'center',
  }}
  >
  <div
  style={{
    width: 48,
    height: 48,
    display: 'grid',
    placeItems: 'center',
    borderRadius: 16,
    background: 'rgba(255,255,255,0.1)',
  }}
  >
  <UtensilsCrossed />
  </div>
  <div>
  <div style={{ fontSize: 13, color: '#cbd5e1' }}>Restaurant Admin</div>
  <div style={{ fontSize: 20, fontWeight: 800 }}>Shovot Lavka</div>
  </div>
  </div>
  
  <div style={{ display: 'grid', gap: 8 }}>
  <SidebarItem active={page === 'dashboard'} icon={LayoutDashboard} label="Dashboard" onClick={() => setPage('dashboard')} />
  <SidebarItem active={page === 'orders'} icon={ShoppingBag} label="Buyurtmalar" onClick={() => setPage('orders')} />
  <SidebarItem active={page === 'products'} icon={Package} label="Mahsulotlar" onClick={() => setPage('products')} />
  <SidebarItem active={page === 'stats'} icon={BarChart3} label="Statistika" onClick={() => setPage('stats')} />
  </div>
  </Card>
  
  <div style={{ display: 'grid', gap: 24 }}>
  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'center' }}>
  <div>
  <div style={{ fontSize: 34, fontWeight: 800, color: '#0f172a' }}>Admin Panel</div>
  <div style={{ color: '#64748b', marginTop: 6 }}>
  Buyurtmalar va mahsulotlar real fayllar bilan ishlayapti.
  </div>
  </div>
  
  <div style={{ position: 'relative', width: 320 }}>
  <Search size={16} style={{ position: 'absolute', left: 12, top: 14, color: '#94a3b8' }} />
  <Input
  value={search}
  onChange={(e) => setSearch(e.target.value)}
  placeholder="Qidirish..."
  style={{ paddingLeft: 36 }}
  />
  </div>
  </div>
  
  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
  <StatCard title="Jami buyurtmalar" value={statsData?.totalOrders ?? 0} icon={ShoppingBag} helper="Barcha buyurtmalar" />
  <StatCard title="Yangi" value={statsData?.newOrders ?? 0} icon={Bell} helper="Yangi tushganlar" />
  <StatCard title="Yetkazilgan" value={statsData?.deliveredOrders ?? 0} icon={Truck} helper="Yakunlanganlar" />
  <StatCard title="Tushum" value={formatPrice(statsData?.totalRevenue ?? 0)} icon={BarChart3} helper="Umumiy summa" />
  </div>
  
  {page === 'dashboard' && (
    <Card>
    <div style={{ fontSize: 22, fontWeight: 800, marginBottom: 16 }}>So‘nggi buyurtmalar</div>
    <div style={{ display: 'grid', gap: 16 }}>
    {filteredOrders.slice(0, 3).map((order) => (
      <OrderCard key={order.id} order={order} onStatusChange={handleStatusChange} />
    ))}
    </div>
    </Card>
  )}
  
  {page === 'orders' && (
    <Card>
    <div style={{ fontSize: 22, fontWeight: 800, marginBottom: 16 }}>Buyurtmalar</div>
    <div style={{ display: 'grid', gap: 16 }}>
    {filteredOrders.map((order) => (
      <OrderCard key={order.id} order={order} onStatusChange={handleStatusChange} />
    ))}
    </div>
    </Card>
  )}
  
  {page === 'products' && (
    <Card>
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', marginBottom: 20 }}>
    <div style={{ fontSize: 22, fontWeight: 800 }}>Mahsulotlar</div>
    <Button onClick={openAdd} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
    <Plus size={16} /> Mahsulot qo‘shish
    </Button>
    </div>
    
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
    {products.map((product) => (
      <Card key={product.key} style={{ padding: 0, overflow: 'hidden', border: '1px solid #e2e8f0', boxShadow: 'none' }}>
      <div style={{ aspectRatio: '16 / 10', background: '#e2e8f0' }}>
      {product.image ? (
        <img
        src={product.image}
        alt={product.name}
        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
      ) : null}
      </div>
      
      <div style={{ padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
      <div>
      <div style={{ fontWeight: 700, fontSize: 18 }}>{product.name}</div>
      <div style={{ color: '#64748b', fontSize: 13, marginTop: 4 }}>{product.category}</div>
      </div>
      
      <span
      style={{
        height: 'fit-content',
        padding: '6px 10px',
        borderRadius: 999,
        background: product.active ? '#d1fae5' : '#e2e8f0',
        color: product.active ? '#047857' : '#475569',
        fontWeight: 700,
        fontSize: 12,
      }}
      >
      {product.active ? 'Aktiv' : 'Yashirin'}
      </span>
      </div>
      
      <div style={{ marginTop: 12, fontSize: 24, fontWeight: 800 }}>
      {formatPrice(product.price)}
      </div>
      
      <div style={{ display: 'flex', gap: 10, marginTop: 16, flexWrap: 'wrap' }}>
      <Button
      onClick={() => openEdit(product)}
      style={{
        flex: 1,
        background: '#e2e8f0',
        color: '#0f172a',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
      }}
      >
      <Pencil size={16} /> Tahrirlash
      </Button>
      
      <Button
      onClick={() => toggleProduct(product)}
      style={{
        flex: 1,
        background: '#fff',
        color: '#0f172a',
        border: '1px solid #cbd5e1',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
      }}
      >
      {product.active ? <PowerOff size={16} /> : <Power size={16} />}
      {product.active ? 'Yashirish' : 'Ochish'}
      </Button>
      
      <Button
      onClick={() => deleteProduct(product)}
      style={{
        width: '100%',
        background: '#fee2e2',
        color: '#991b1b',
      }}
      >
      O‘chirish
      </Button>
      </div>
      </div>
      </Card>
    ))}
    </div>
    </Card>
  )}
  
  {page === 'stats' && (
    <Card>
    <div style={{ fontSize: 22, fontWeight: 800, marginBottom: 20 }}>Statistika</div>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
    <div style={{ padding: 18, borderRadius: 20, background: '#f8fafc' }}>
    <div style={{ fontSize: 14, color: '#64748b' }}>Qabul qilingan</div>
    <div style={{ marginTop: 10, fontSize: 28, fontWeight: 800 }}>
    {statsData?.acceptedOrders ?? 0}
    </div>
    </div>
    <div style={{ padding: 18, borderRadius: 20, background: '#f8fafc' }}>
    <div style={{ fontSize: 14, color: '#64748b' }}>Tayyor</div>
    <div style={{ marginTop: 10, fontSize: 28, fontWeight: 800 }}>
    {statsData?.readyOrders ?? 0}
    </div>
    </div>
    <div style={{ padding: 18, borderRadius: 20, background: '#f8fafc' }}>
    <div style={{ fontSize: 14, color: '#64748b' }}>Kategoriyalar</div>
    <div style={{ marginTop: 10, fontSize: 28, fontWeight: 800 }}>
    {categories.length}
    </div>
    </div>
    <div style={{ padding: 18, borderRadius: 20, background: '#f8fafc' }}>
    <div style={{ fontSize: 14, color: '#64748b' }}>Mahsulotlar</div>
    <div style={{ marginTop: 10, fontSize: 28, fontWeight: 800 }}>
    {products.length}
    </div>
    </div>
    </div>
    </Card>
  )}
  </div>
  </div>
  
  {showForm && (
    <div
    onClick={() => setShowForm(false)}
    style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(15,23,42,0.4)',
      display: 'grid',
      placeItems: 'center',
      padding: 20,
    }}
    >
    <div
    onClick={(e) => e.stopPropagation()}
    style={{
      width: '100%',
      maxWidth: 520,
      background: '#fff',
      borderRadius: 28,
      padding: 24,
      boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
    }}
    >
    <div style={{ fontSize: 24, fontWeight: 800, marginBottom: 18 }}>
    {editingId ? 'Mahsulotni tahrirlash' : 'Yangi mahsulot qo‘shish'}
    </div>
    
    <div style={{ display: 'grid', gap: 14 }}>
    <Input
    placeholder="ID / key"
    value={form.id}
    onChange={(e) => setForm((prev) => ({ ...prev, id: e.target.value }))}
    />
    <Input
    placeholder="Mahsulot nomi"
    value={form.name}
    onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
    />
    <Input
    placeholder="Narxi"
    type="number"
    value={form.price}
    onChange={(e) => setForm((prev) => ({ ...prev, price: e.target.value }))}
    />
    <Input
    placeholder="Kategoriya"
    value={form.category}
    onChange={(e) => setForm((prev) => ({ ...prev, category: e.target.value }))}
    />
    <Input
    placeholder="Rasm URL"
    value={form.image}
    onChange={(e) => setForm((prev) => ({ ...prev, image: e.target.value }))}
    />
    </div>
    
    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
    <Button
    onClick={() => setShowForm(false)}
    style={{ background: '#e2e8f0', color: '#0f172a' }}
    >
    Bekor qilish
    </Button>
    <Button onClick={saveProduct}>Saqlash</Button>
    </div>
    </div>
    </div>
  )}
  </div>
);
}