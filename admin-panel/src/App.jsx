import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import Login from './Login';
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
  ChevronLeft,
  ChevronRight,
  Clock3,
  AtSign,
  Upload,
  Link as LinkIcon,
  LogOut,
  Trash2,
  CreditCard,
  Banknote,
  Filter,
  Check,
  Menu,
  X,
  Wallet,
  PackageCheck,
} from 'lucide-react';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
const ORDERS_PER_PAGE = 10;

const statusMap = {
  'Yangi buyurtma': { label: 'Yangi', bg: '#dbeafe', color: '#1d4ed8' },
  'Qabul qilindi': { label: 'Qabul qilindi', bg: '#fef3c7', color: '#b45309' },
  'Tayyor': { label: 'Tayyor', bg: '#ede9fe', color: '#6d28d9' },
  'Yetkazildi': { label: 'Yetkazildi', bg: '#d1fae5', color: '#047857' },
  'Bekor qilindi': { label: 'Bekor qilindi', bg: '#fee2e2', color: '#b91c1c' },
};

function formatPrice(value) {
  return new Intl.NumberFormat('uz-UZ').format(Number(value || 0)) + " so'm";
}

function formatDateTime(value) {
  if (!value) return "Vaqt yo'q";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Vaqt yo'q";
  return new Intl.DateTimeFormat('uz-UZ', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function formatDateOnly(value) {
  if (!value) return "Sana yo'q";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Sana yo'q";
  return new Intl.DateTimeFormat('uz-UZ', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function getDateKey(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'unknown';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function playNotificationSound() {
  try {
    const audio = new Audio('https://actions.google.com/sounds/v1/alarms/beep_short.ogg');
    audio.play().catch(() => {});
  } catch {}
}

function getPaymentMethodText(paymentMethod) {
  return paymentMethod === 'click' ? 'Click' : 'Naqd';
}

function getPaymentStatusText(paymentStatus) {
  if (paymentStatus === 'paid') return "To'langan";
  if (paymentStatus === 'failed') return 'Muvaffaqiyatsiz';
  return 'Kutilmoqda';
}

function getDeliveryTypeText(order) {
  if (order?.deliveryType === 'pickup') return "O'zi olib ketadi";
  return "Yetkazib berish";
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
  const text = order?.location?.text || '';
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
    text,
    hasCoords,
    link: hasCoords ? `https://maps.google.com/?q=${Number(lat)},${Number(lon)}` : '',
  };
}

function useResponsive() {
  const [screenWidth, setScreenWidth] = useState(
    typeof window !== 'undefined' ? window.innerWidth : 1400
  );
  useEffect(() => {
    const onResize = () => setScreenWidth(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  const isMobile = screenWidth <= 768;
  const isTablet = screenWidth > 768 && screenWidth <= 1100;
  const isSmallMobile = screenWidth <= 480;
  return { screenWidth, isMobile, isTablet, isSmallMobile };
}

function Card({ children, style = {} }) {
  return (
    <div
    style={{
      background: '#ffffff',
      borderRadius: 24,
      padding: 20,
      border: '1px solid #e5e7eb',
      boxShadow: '0 10px 30px rgba(15, 23, 42, 0.05)',
      ...style,
    }}
    >
    {children}
    </div>
  );
}

function Button({ children, onClick, style = {}, disabled = false, type = 'button' }) {
  return (
    <button
    type={type}
    onClick={onClick}
    disabled={disabled}
    style={{
      border: 'none',
      borderRadius: 14,
      padding: '11px 14px',
      background: disabled ? '#e2e8f0' : '#0f172a',
      color: disabled ? '#64748b' : '#ffffff',
      cursor: disabled ? 'not-allowed' : 'pointer',
      fontWeight: 700,
      fontSize: 13,
      transition: '0.2s ease',
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
      borderRadius: 14,
      border: '1px solid #dbe2ea',
      outline: 'none',
      fontSize: 14,
      background: '#ffffff',
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
      color: active ? '#ffffff' : '#475569',
      textAlign: 'left',
      fontWeight: 700,
    }}
    >
    <Icon size={18} />
    <span>{label}</span>
    </button>
  );
}

function StatCard({ title, value, helper, icon: Icon, dark = false }) {
  return (
    <Card
    style={{
      background: dark ? '#0f172a' : '#ffffff',
      color: dark ? '#ffffff' : '#0f172a',
      padding: '14px 16px',
    }}
    >
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start' }}>
    <div style={{ minWidth: 0 }}>
    <div style={{ fontSize: 12, color: dark ? '#cbd5e1' : '#64748b', fontWeight: 600 }}>{title}</div>
    <div style={{ marginTop: 6, fontSize: 22, fontWeight: 800, lineHeight: 1.2 }}>{value}</div>
    <div style={{ marginTop: 4, fontSize: 11, color: dark ? '#94a3b8' : '#94a3b8' }}>{helper}</div>
    </div>
    <div
    style={{
      width: 38,
      height: 38,
      borderRadius: 12,
      background: dark ? 'rgba(255,255,255,0.08)' : '#f1f5f9',
      display: 'grid',
      placeItems: 'center',
      flexShrink: 0,
    }}
    >
    <Icon size={17} />
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
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      padding: '6px 10px',
      borderRadius: 999,
      background: conf.bg,
      color: conf.color,
      fontSize: 12,
      fontWeight: 800,
    }}
    >
    {conf.label}
    </span>
  );
}

function PaymentBadge({ paymentStatus, paymentMethod }) {
  // Naqd + pending bo'lsa badge ko'rsatilmaydi
  const isCash = !paymentMethod || paymentMethod === 'cash';
  const isPending = !paymentStatus || paymentStatus === 'pending';
  if (isCash && isPending) return null;
  
  let bg = '#fef3c7';
  let color = '#b45309';
  let label = 'Kutilmoqda';
  if (paymentStatus === 'paid') { bg = '#d1fae5'; color = '#047857'; label = "To'langan"; }
  if (paymentStatus === 'failed') { bg = '#fee2e2'; color = '#b91c1c'; label = 'Muvaffaqiyatsiz'; }
  return (
    <span
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      padding: '6px 10px',
      borderRadius: 999,
      background: bg,
      color,
      fontSize: 12,
      fontWeight: 800,
    }}
    >
    {label}
    </span>
  );
}

function MethodBadge({ paymentMethod }) {
  const isClick = paymentMethod === 'click';
  return (
    <span
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      padding: '6px 10px',
      borderRadius: 999,
      background: isClick ? '#dbeafe' : '#f3f4f6',
      color: isClick ? '#1d4ed8' : '#334155',
      fontSize: 12,
      fontWeight: 800,
    }}
    >
    {isClick ? 'Click' : 'Naqd'}
    </span>
  );
}

function SectionTitle({ title, subtitle, right, isMobile = false }) {
  return (
    <div
    style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: isMobile ? 'flex-start' : 'center',
      gap: 16,
      flexWrap: 'wrap',
      flexDirection: isMobile ? 'column' : 'row',
    }}
    >
    <div>
    <div style={{ fontSize: isMobile ? 20 : 24, fontWeight: 800, color: '#0f172a' }}>{title}</div>
    {subtitle ? <div style={{ marginTop: 4, color: '#64748b', fontSize: 14 }}>{subtitle}</div> : null}
    </div>
    {right}
    </div>
  );
}

function FilterChip({ active, onClick, children, small = false }) {
  return (
    <button
    onClick={onClick}
    style={{
      padding: small ? '7px 12px' : '10px 14px',
      borderRadius: 999,
      border: active ? 'none' : '1px solid #dbe2ea',
      background: active ? '#0f172a' : '#ffffff',
      color: active ? '#ffffff' : '#334155',
      cursor: 'pointer',
      fontWeight: 700,
      fontSize: small ? 12 : 13,
      whiteSpace: 'nowrap',
    }}
    >
    {children}
    </button>
  );
}

function InfoLine({ icon: Icon, text, link }) {
  return (
    <div style={{ display: 'flex', gap: 9, alignItems: 'flex-start', color: '#475569', fontSize: 14 }}>
    <Icon size={16} style={{ marginTop: 2, flexShrink: 0 }} />
    {link ? (
      <a href={link} target="_blank" rel="noreferrer" style={{ color: '#2563eb', textDecoration: 'none', fontWeight: 600 }}>
      {text}
      </a>
    ) : (
      <span>{text}</span>
    )}
    </div>
  );
}

// To'lov ma'lumotlari ko'rsatish komponenti
function PaymentInfoBox({ order }) {
  const isClick = order.paymentMethod === 'click';
  const isPaid = order.paymentStatus === 'paid';
  const isFailed = order.paymentStatus === 'failed';
  const isCancelled = order.status === 'Bekor qilindi';
  // pending: status yo'q, yoki 'pending', lekin bekor qilinmagan
  const isPending = !isCancelled && !isPaid && !isFailed;
  
  return (
    <div
    style={{
      padding: 16,
      borderRadius: 18,
      background: '#f8fafc',
      border: '1px solid #eef2f7',
    }}
    >
    <div style={{ fontSize: 15, fontWeight: 800, color: '#0f172a', marginBottom: 12 }}>
    To'lov ma'lumotlari
    </div>
    
    <div style={{ display: 'grid', gap: 10 }}>
    {/* To'lov usuli */}
    <div
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      padding: '12px 14px',
      borderRadius: 14,
      background: isClick ? '#eff6ff' : '#f0fdf4',
      border: `1px solid ${isClick ? '#bfdbfe' : '#bbf7d0'}`,
    }}
    >
    {isClick ? (
      <CreditCard size={16} color="#1d4ed8" />
    ) : (
      <Wallet size={16} color="#047857" />
    )}
    <div>
    <div style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>To'lov usuli</div>
    <div style={{ fontSize: 14, fontWeight: 800, color: isClick ? '#1d4ed8' : '#047857' }}>
    {isClick ? "Click orqali to'lov" : "Naqd pul to'lov"}
    </div>
    </div>
    </div>
    
    {/* To'lov holati — faqat Click uchun */}
    {isClick && (
      <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '12px 14px',
        borderRadius: 14,
        background: isPaid ? '#ecfdf5' : (isCancelled || isFailed) ? '#fef2f2' : '#fffbeb',
        border: `1px solid ${isPaid ? '#a7f3d0' : (isCancelled || isFailed) ? '#fecaca' : '#fde68a'}`,
      }}
      >
      {isPaid ? (
        <CheckCircle2 size={16} color="#047857" />
      ) : (isCancelled || isFailed) ? (
        <X size={16} color="#b91c1c" />
      ) : (
        <Clock3 size={16} color="#b45309" />
      )}
      <div>
      <div style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>To'lov holati</div>
      <div
      style={{
        fontSize: 14,
        fontWeight: 800,
        color: isPaid ? '#047857' : (isCancelled || isFailed) ? '#b91c1c' : '#b45309',
      }}
      >
      {isPaid
        ? "Click orqali to'langan ✓"
        : isCancelled
        ? "Buyurtma bekor — to'lov amalga oshmadi ✗"
        : isFailed
        ? "To'lov amalga oshmadi ✗"
        : "To'lov kutilmoqda..."}
        </div>
        </div>
        </div>
      )}
      
      {/* To'langan vaqt */}
      {order.paidAt && isPaid && (
        <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '10px 14px',
          borderRadius: 14,
          background: '#f8fafc',
          border: '1px solid #e2e8f0',
        }}
        >
        <Clock3 size={15} color="#64748b" />
        <div>
        <div style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>To'langan vaqt</div>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#334155' }}>
        {formatDateTime(order.paidAt)}
        </div>
        </div>
        </div>
      )}
      </div>
      </div>
    );
  }
  
  function OrderCard({
    order,
    onStatusChange,
    onDeleteOrder,
    hideActions = false,
    isMobile = false,
    isTablet = false,
  }) {
    const items = typeof order.cartText === 'string'
    ? order.cartText
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && line !== '🛒 Savat:')
    : [];
    
    const location = getLocationData(order);
    const username = order?.username
    ? `@${String(order.username).replace(/^@/, '')}`
    : "Username yo'q";
    
    const canAccept = order.status === 'Yangi buyurtma';
    const canReady = order.status === 'Qabul qilindi';
    const canDeliver = order.status === 'Tayyor';
    
    const contentColumns = isMobile ? '1fr' : isTablet ? '1fr' : '1.15fr 1fr 300px';
    
    return (
      <motion.div layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
      <Card style={{ padding: 0, overflow: 'hidden' }}>
      
      {/* ===== HEADER ===== */}
      <div style={{ padding: isMobile ? 14 : 20, borderBottom: '1px solid #eef2f7' }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 10,
        flexWrap: 'wrap',
      }}>
      {/* Chap: ID + badge-lar */}
      <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontSize: isMobile ? 17 : 22, fontWeight: 800, color: '#0f172a' }}>
      Buyurtma #{order.id}
      </div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
      <Badge status={order.status} />
      <MethodBadge paymentMethod={order.paymentMethod} />
      <PaymentBadge paymentStatus={order.paymentStatus} paymentMethod={order.paymentMethod} />
      </div>
      </div>
      
      {/* O'ng: Summa */}
      <div style={{
        padding: isMobile ? '10px 14px' : 18,
        borderRadius: 16,
        background: '#0f172a',
        color: '#ffffff',
        flexShrink: 0,
      }}>
      <div style={{ fontSize: 11, color: '#cbd5e1' }}>Jami summa</div>
      <div style={{ marginTop: 4, fontSize: isMobile ? 20 : 28, fontWeight: 800, whiteSpace: 'nowrap' }}>
      {formatPrice(order.total || 0)}
      </div>
      </div>
      </div>
      </div>
      
      {/* ===== BODY ===== */}
      {isMobile ? (
        /* ---- MOBIL LAYOUT ---- */
        <div style={{ padding: 14, display: 'grid', gap: 12 }}>
        
        {/* Mijoz ma'lumotlari - compact */}
        <div style={{
          padding: 14,
          borderRadius: 16,
          background: '#f8fafc',
          border: '1px solid #eef2f7',
        }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: '#0f172a', marginBottom: 10 }}>
        Mijoz ma'lumotlari
        </div>
        <div style={{ display: 'grid', gap: 8 }}>
        <InfoLine icon={Eye} text={order.name || "Noma'lum"} />
        <InfoLine icon={Phone} text={order.phone || "Telefon yo'q"} />
        <InfoLine icon={AtSign} text={username} />
        <InfoLine icon={Clock3} text={formatDateTime(order.createdAt)} />
        <InfoLine icon={Truck} text={getDeliveryTypeText(order)} />
        </div>
        </div>
        
        {/* Mahsulotlar */}
        <div style={{
          padding: 14,
          borderRadius: 16,
          background: '#f8fafc',
          border: '1px solid #eef2f7',
        }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: '#0f172a', marginBottom: 10 }}>
        Mahsulotlar
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {(items.length ? items : ['Mahsulot topilmadi']).map((item, idx) => (
          <span key={idx} style={{
            padding: '6px 10px',
            borderRadius: 999,
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            fontSize: 12,
            color: '#334155',
          }}>
          {item}
          </span>
        ))}
        </div>
        </div>
        
        {/* Manzil */}
        <div style={{
          padding: 14,
          borderRadius: 16,
          background: '#f8fafc',
          border: '1px solid #eef2f7',
        }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: '#0f172a', marginBottom: 10 }}>
        Manzil
        </div>
        {location.text
          ? <InfoLine icon={MapPin} text={location.text} />
          : <InfoLine icon={MapPin} text="Manzil yo'q" />
        }
        {location.hasCoords && (
          <div style={{ marginTop: 8 }}>
          <InfoLine icon={MapPin} text="Xaritada ochish" link={location.link} />
          </div>
        )}
        </div>
        
        {/* To'lov ma'lumotlari */}
        <PaymentInfoBox order={order} />
        
        {/* Buyurtma boshqaruvi tugmalari */}
        {!hideActions ? (
          <div style={{
            padding: 14,
            borderRadius: 16,
            background: '#f8fafc',
            border: '1px solid #eef2f7',
          }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: '#0f172a', marginBottom: 10 }}>
          Buyurtma boshqaruvi
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
          <Button
          onClick={() => onStatusChange(order.id, 'Qabul qilindi')}
          disabled={!canAccept}
          style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4, padding: '10px 6px', fontSize: 11, width: '100%' }}
          >
          <CheckCircle2 size={16} />
          <span>Qabul</span>
          </Button>
          <Button
          onClick={() => onStatusChange(order.id, 'Tayyor')}
          disabled={!canReady}
          style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4, padding: '10px 6px', fontSize: 11, width: '100%' }}
          >
          <ChefHat size={16} />
          <span>Tayyor</span>
          </Button>
          <Button
          onClick={() => onStatusChange(order.id, 'Yetkazildi')}
          disabled={!canDeliver}
          style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4, padding: '10px 6px', fontSize: 11, width: '100%' }}
          >
          <PackageCheck size={16} />
          <span>Yetkazildi</span>
          </Button>
          </div>
          </div>
        ) : (
          <Button
          onClick={() => onDeleteOrder(order.id)}
          style={{ width: '100%', background: '#fee2e2', color: '#991b1b', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
          >
          <Trash2 size={15} /> O'chirish
          </Button>
        )}
        </div>
      ) : (
        /* ---- DESKTOP / TABLET LAYOUT ---- */
        <div style={{
          padding: 20,
          display: 'grid',
          gridTemplateColumns: contentColumns,
          gap: 20,
        }}>
        {/* 1-ustun: Mijoz ma'lumotlari */}
        <div style={{ display: 'grid', gap: 12 }}>
        <div style={{ fontSize: 15, fontWeight: 800, color: '#0f172a' }}>Mijoz ma'lumotlari</div>
        <InfoLine icon={Eye} text={order.name || "Noma'lum"} />
        <InfoLine icon={Phone} text={order.phone || "Telefon yo'q"} />
        <InfoLine icon={AtSign} text={username} />
        <InfoLine icon={Clock3} text={formatDateTime(order.createdAt)} />
        <InfoLine icon={Truck} text={getDeliveryTypeText(order)} />
        </div>
        
        {/* 2-ustun: Mahsulotlar + Manzil */}
        <div style={{ display: 'grid', gap: 14 }}>
        <div style={{ padding: 16, borderRadius: 18, background: '#f8fafc', border: '1px solid #eef2f7' }}>
        <div style={{ fontSize: 15, fontWeight: 800, color: '#0f172a', marginBottom: 10 }}>Mahsulotlar</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {(items.length ? items : ['Mahsulot topilmadi']).map((item, idx) => (
          <span key={idx} style={{
            padding: '8px 12px',
            borderRadius: 999,
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            fontSize: 13,
            color: '#334155',
          }}>
          {item}
          </span>
        ))}
        </div>
        </div>
        
        <div style={{ padding: 16, borderRadius: 18, background: '#f8fafc', border: '1px solid #eef2f7' }}>
        <div style={{ fontSize: 15, fontWeight: 800, color: '#0f172a', marginBottom: 10 }}>Manzil</div>
        {location.text
          ? <InfoLine icon={MapPin} text={location.text} />
          : <InfoLine icon={MapPin} text="Manzil yo'q" />
        }
        {location.hasCoords && (
          <div style={{ marginTop: 8 }}>
          <InfoLine icon={MapPin} text="Xaritada ochish" link={location.link} />
          </div>
        )}
        </div>
        </div>
        
        {/* 3-ustun: To'lov + Buyurtma boshqaruvi */}
        <div style={{ display: 'grid', gap: 14 }}>
        <PaymentInfoBox order={order} />
        
        {!hideActions ? (
          <div style={{ padding: 16, borderRadius: 18, background: '#f8fafc', border: '1px solid #eef2f7' }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: '#0f172a', marginBottom: 10 }}>
          Buyurtma boshqaruvi
          </div>
          <div style={{ display: 'grid', gap: 10 }}>
          <Button
          onClick={() => onStatusChange(order.id, 'Qabul qilindi')}
          disabled={!canAccept}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%' }}
          >
          <CheckCircle2 size={15} /> Qabul qilindi
          </Button>
          <Button
          onClick={() => onStatusChange(order.id, 'Tayyor')}
          disabled={!canReady}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%' }}
          >
          <ChefHat size={15} /> Tayyor
          </Button>
          <Button
          onClick={() => onStatusChange(order.id, 'Yetkazildi')}
          disabled={!canDeliver}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%' }}
          >
          <PackageCheck size={15} /> Yetkazildi
          </Button>
          </div>
          </div>
        ) : (
          <div style={{ padding: 16, borderRadius: 18, background: '#f8fafc', border: '1px solid #eef2f7' }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: '#0f172a', marginBottom: 10 }}>
          History boshqaruvi
          </div>
          <Button
          onClick={() => onDeleteOrder(order.id)}
          style={{ width: '100%', background: '#fee2e2', color: '#991b1b', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
          >
          <Trash2 size={15} /> O'chirish
          </Button>
          </div>
        )}
        </div>
        </div>
      )}
      </Card>
      </motion.div>
    );
  }
  
  function buildStatsFromOrders(orders) {
    // Faqat bugungi buyurtmalar
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayOrders = orders.filter((o) => o.createdAt && new Date(o.createdAt) >= todayStart);
    
    const totalOrders = todayOrders.length;
    const newOrders = todayOrders.filter((o) => o.status === 'Yangi buyurtma').length;
    const acceptedOrders = todayOrders.filter((o) => o.status === 'Qabul qilindi').length;
    const readyOrders = todayOrders.filter((o) => o.status === 'Tayyor').length;
    const deliveredOrders = todayOrders.filter((o) => o.status === 'Yetkazildi').length;
    const cancelledOrders = todayOrders.filter((o) => o.status === 'Bekor qilindi').length;
    const totalRevenue = todayOrders.reduce((sum, o) => sum + Number(o.total || 0), 0);
    const cashRevenue = todayOrders
    .filter((o) => (o.paymentMethod || 'cash') === 'cash')
    .reduce((sum, o) => sum + Number(o.total || 0), 0);
    const clickRevenue = todayOrders
    .filter((o) => o.paymentMethod === 'click')
    .reduce((sum, o) => sum + Number(o.total || 0), 0);
    // Naqd + bekor qilinmagan = to'langan; Click + paid = to'langan
    const paidOrders = todayOrders.filter((o) =>
      o.status !== 'Bekor qilindi' && (
      o.paymentStatus === 'paid' ||
      (o.paymentMethod || 'cash') === 'cash'
    )
  ).length;
  const pendingPaymentOrders = todayOrders.filter((o) => o.paymentMethod === 'click' && (o.paymentStatus || 'pending') === 'pending').length;
  return {
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
    pendingPaymentOrders,
  };
}

function buildDailyStats(orders) {
  const map = new Map();
  for (const order of orders) {
    const key = getDateKey(order.createdAt);
    if (key === 'unknown') continue;
    if (!map.has(key)) {
      map.set(key, {
        dateKey: key,
        dateLabel: formatDateOnly(order.createdAt),
        totalOrders: 0,
        revenue: 0,
        deliveredRevenue: 0,
        cashRevenue: 0,
        clickRevenue: 0,
        paidOrders: 0,
        pendingPaymentOrders: 0,
        cancelledOrders: 0,
        newOrders: 0,
        acceptedOrders: 0,
        readyOrders: 0,
        deliveredOrders: 0,
      });
    }
    const item = map.get(key);
    item.totalOrders += 1;
    item.revenue += Number(order.total || 0);
    if ((order.paymentMethod || 'cash') === 'cash') item.cashRevenue += Number(order.total || 0);
    if (order.paymentMethod === 'click') item.clickRevenue += Number(order.total || 0);
    if (order.status !== 'Bekor qilindi' && (
      order.paymentStatus === 'paid' ||
      (order.paymentMethod || 'cash') === 'cash'
    )) item.paidOrders += 1;
    if (order.paymentMethod === 'click' && (order.paymentStatus || 'pending') === 'pending') item.pendingPaymentOrders += 1;
    if (order.status === 'Yangi buyurtma') item.newOrders += 1;
    if (order.status === 'Qabul qilindi') item.acceptedOrders += 1;
    if (order.status === 'Tayyor') item.readyOrders += 1;
    if (order.status === 'Yetkazildi') {
      item.deliveredOrders += 1;
      item.deliveredRevenue += Number(order.total || 0);
    }
  }
  return Array.from(map.values()).sort((a, b) => b.dateKey.localeCompare(a.dateKey));
}

function Pagination({ currentPage, totalPages, onPageChange, isMobile = false }) {
  if (totalPages <= 1) return null;
  const pages = [];
  const start = Math.max(1, currentPage - (isMobile ? 1 : 2));
  const end = Math.min(totalPages, currentPage + (isMobile ? 1 : 2));
  for (let i = start; i <= end; i += 1) pages.push(i);
  return (
    <div
    style={{
      display: 'flex',
      gap: 10,
      justifyContent: 'center',
      alignItems: 'center',
      marginTop: 24,
      flexWrap: 'wrap',
    }}
    >
    <Button
    onClick={() => onPageChange(currentPage - 1)}
    disabled={currentPage === 1}
    style={{ display: 'flex', alignItems: 'center', gap: 6 }}
    >
    <ChevronLeft size={16} />
    {!isMobile ? 'Oldingi' : ''}
    </Button>
    {pages.map((page) => (
      <button
      key={page}
      onClick={() => onPageChange(page)}
      style={{
        minWidth: 44,
        height: 44,
        borderRadius: 14,
        border: page === currentPage ? 'none' : '1px solid #cbd5e1',
        background: page === currentPage ? '#0f172a' : '#ffffff',
        color: page === currentPage ? '#ffffff' : '#0f172a',
        cursor: 'pointer',
        fontWeight: 800,
      }}
      >
      {page}
      </button>
    ))}
    <Button
    onClick={() => onPageChange(currentPage + 1)}
    disabled={currentPage === totalPages}
    style={{ display: 'flex', alignItems: 'center', gap: 6 }}
    >
    {!isMobile ? 'Keyingi' : ''}
    <ChevronRight size={16} />
    </Button>
    </div>
  );
}

export default function App() {
  const { isMobile, isTablet, isSmallMobile } = useResponsive();
  
  const [page, setPage] = useState('dashboard');
  const [orders, setOrders] = useState([]);
  const [products, setProducts] = useState([]);
  const [statsData, setStatsData] = useState({
    totalOrders: 0,
    newOrders: 0,
    acceptedOrders: 0,
    readyOrders: 0,
    deliveredOrders: 0,
    totalRevenue: 0,
    cashRevenue: 0,
    clickRevenue: 0,
    paidOrders: 0,
    pendingPaymentOrders: 0,
  });
  
  
  const [allStatsData, setAllStatsData] = useState({
    totalOrders: 0,
    newOrders: 0,
    acceptedOrders: 0,
    readyOrders: 0,
    deliveredOrders: 0,
    cancelledOrders: 0,
    totalRevenue: 0,
    cashRevenue: 0,
    clickRevenue: 0,
    paidOrders: 0,
    pendingPaymentOrders: 0,
  });
  
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [streamStatus, setStreamStatus] = useState('Ulanmoqda...');
  const [orderPage, setOrderPage] = useState(1);
  const [imageMode, setImageMode] = useState('url');
  const [orderTab, setOrderTab] = useState('active');
  const [paymentFilter, setPaymentFilter] = useState('all');
  const [paymentStatusFilter, setPaymentStatusFilter] = useState('all');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  
  const [isAuth, setIsAuth] = useState(
    localStorage.getItem('admin_auth') === 'true'
  );
  
  const notifiedOrderIdsRef = useRef(new Set());
  
  const [form, setForm] = useState({
    id: '',
    name: '',
    price: '',
    category: 'Fast Food',
    image: '',
  });
  
  async function loadData({ playSoundForNew = false } = {}) {
    try {
      const [menuRes, ordersRes, statsRes, allStatsRes] = await Promise.all([
        fetch(`${API}/menu`),
        fetch(`${API}/orders`),
        fetch(`${API}/stats`),
        fetch(`${API}/stats?all=true`),
      ]);
      const menuData = await menuRes.json();
      const ordersData = await ordersRes.json();
      const safeOrders = Array.isArray(ordersData) ? ordersData : [];
      
      if (playSoundForNew) {
        const incomingIds = safeOrders.map((order) => String(order.id));
        const knownIds = notifiedOrderIdsRef.current;
        const hasNewOrder = incomingIds.some((id) => !knownIds.has(id));
        if (hasNewOrder && knownIds.size > 0) playNotificationSound();
        notifiedOrderIdsRef.current = new Set(incomingIds);
      } else if (notifiedOrderIdsRef.current.size === 0) {
        notifiedOrderIdsRef.current = new Set(safeOrders.map((order) => String(order.id)));
      }
      
      setProducts(Object.values(menuData || {}));
      setOrders(safeOrders);
      
      try {
        const stats = await statsRes.json();
        setStatsData(stats || buildStatsFromOrders(safeOrders));
      } catch {
        setStatsData(buildStatsFromOrders(safeOrders));
      }
      
      try {
        const allStats = await allStatsRes.json();
        setAllStatsData(allStats || buildAllStatsFromOrders(safeOrders));
      } catch {
        setAllStatsData(buildAllStatsFromOrders(safeOrders));
      }
    } catch (error) {
      console.error("Ma'lumotlarni yuklashda xato:", error);
    }
  }
  
  useEffect(() => {
    loadData();
    const streamUrl = `${API.replace(/\/api$/, '')}/api/stream`;
    const eventSource = new EventSource(streamUrl);
    eventSource.onopen = () => setStreamStatus('Real-time ulangan');
    eventSource.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data);
        if (parsed?.type === 'order_created') { loadData({ playSoundForNew: true }); return; }
      } catch {}
      loadData();
    };
    eventSource.onerror = () => setStreamStatus('Aloqa uzildi, qayta ulanmoqda...');
    return () => eventSource.close();
  }, []);
  
  useEffect(() => {
    if (!isMobile) setSidebarOpen(false);
  }, [isMobile]);
  
  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      const matchesSearch =
      String(order.name || '').toLowerCase().includes(search.toLowerCase()) ||
      String(order.id || '').includes(search) ||
      String(order.phone || '').includes(search) ||
      String(order.username || '').toLowerCase().includes(search.toLowerCase()) ||
      String(order.location?.text || '').toLowerCase().includes(search.toLowerCase()) ||
      String(order.paymentMethod || '').toLowerCase().includes(search.toLowerCase()) ||
      String(order.paymentStatus || '').toLowerCase().includes(search.toLowerCase());
      
      const matchesPayment =
      paymentFilter === 'all' ||
      (paymentFilter === 'cash' && (order.paymentMethod || 'cash') === 'cash') ||
      (paymentFilter === 'click' && order.paymentMethod === 'click');
      
      const matchesPaymentStatus =
      paymentStatusFilter === 'all' ||
      (paymentStatusFilter === 'paid' && order.paymentStatus === 'paid') ||
      // Kutilmoqda — faqat Click + pending (naqd kutilmoqda emas)
      (paymentStatusFilter === 'pending' && order.paymentMethod === 'click' && (order.paymentStatus || 'pending') === 'pending');
      
      return matchesSearch && matchesPayment && matchesPaymentStatus;
    });
  }, [orders, search, paymentFilter, paymentStatusFilter]);
  
  const activeOrders = useMemo(
    () => filteredOrders.filter((o) => o.status !== 'Yetkazildi' && o.status !== 'Bekor qilindi'),
    [filteredOrders]
  );
  const historyOrders = useMemo(
    () => filteredOrders.filter((o) => o.status === 'Yetkazildi' || o.status === 'Bekor qilindi'),
    [filteredOrders]
  );
  const currentOrders = useMemo(
    () => (orderTab === 'active' ? activeOrders : historyOrders),
    [orderTab, activeOrders, historyOrders]
  );
  
  useEffect(() => { setOrderPage(1); }, [search, orderTab, paymentFilter, paymentStatusFilter]);
  
  const totalOrderPages = Math.max(1, Math.ceil(currentOrders.length / ORDERS_PER_PAGE));
  
  useEffect(() => {
    if (orderPage > totalOrderPages) setOrderPage(totalOrderPages);
  }, [orderPage, totalOrderPages]);
  
  const paginatedOrders = useMemo(() => {
    const startIndex = (orderPage - 1) * ORDERS_PER_PAGE;
    return currentOrders.slice(startIndex, startIndex + ORDERS_PER_PAGE);
  }, [currentOrders, orderPage]);
  
  const dailyStats = useMemo(() => buildDailyStats(orders), [orders]);
  
  const topStatsGrid = isMobile ? 'repeat(2, 1fr)' : isTablet ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)';
  const dashboardQuickGrid = isMobile ? 'repeat(2, 1fr)' : isTablet ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)';
  const productGrid = isMobile ? '1fr' : isTablet ? 'repeat(2, 1fr)' : 'repeat(3, 1fr)';
  const statsGrid4 = isMobile ? '1fr' : isTablet ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)';
  const statsGrid3 = isMobile ? '1fr' : isTablet ? 'repeat(2, 1fr)' : 'repeat(3, 1fr)';
  const mainGridColumns = isMobile ? '1fr' : '280px 1fr';
  
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
  
  async function handleDeleteOrder(id) {
    const ok = window.confirm("Rostdan ham bu buyurtmani o'chirmoqchimisiz?");
    if (!ok) return;
    try {
      await fetch(`${API}/orders/${id}`, { method: 'DELETE' });
      await loadData();
    } catch (error) {
      console.error("Buyurtmani o'chirishda xato:", error);
    }
  }
  
  function openAdd() {
    setEditingId(null);
    setImageMode('url');
    setForm({ id: '', name: '', price: '', category: 'Fast Food', image: '' });
    setShowForm(true);
  }
  
  function openEdit(product) {
    setEditingId(product.key);
    setImageMode(product.image?.startsWith('data:image') ? 'upload' : 'url');
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
      console.error("Mahsulot holatini o'zgartirishda xato:", error);
    }
  }
  
  async function deleteProduct(product) {
    try {
      await fetch(`${API}/menu/${product.key}`, { method: 'DELETE' });
      await loadData();
    } catch (error) {
      console.error("Mahsulotni o'chirishda xato:", error);
    }
  }
  
  function handleImageFileChange(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setForm((prev) => ({ ...prev, image: String(reader.result || '') }));
    reader.readAsDataURL(file);
  }
  
  function handleLogout() {
    localStorage.removeItem('admin_auth');
    setIsAuth(false);
  }
  
  function handleMenuClick(nextPage) {
    setPage(nextPage);
    if (isMobile) setSidebarOpen(false);
  }
  
  if (!isAuth) return <Login onLogin={() => setIsAuth(true)} />;
  
  return (
    <div
    style={{
      minHeight: '100vh',
      background: '#f3f6fb',
      padding: isMobile ? 10 : 22,
      fontFamily: 'Arial, sans-serif',
    }}
    >
    {isMobile && (
      <div style={{ position: 'sticky', top: 0, zIndex: 50, marginBottom: 12 }}>
      <div style={{
        background: '#ffffff',
        borderBottom: '1px solid #e5e7eb',
        padding: '12px 14px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 10,
        boxShadow: '0 2px 12px rgba(15,23,42,0.06)',
      }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <div style={{
        width: 36, height: 36, borderRadius: 12,
        background: '#0f172a', display: 'grid', placeItems: 'center',
      }}>
      <UtensilsCrossed size={18} color="#ffffff" />
      </div>
      <div>
      <div style={{ fontSize: 16, fontWeight: 800, color: '#0f172a', lineHeight: 1.2 }}>Ajabo Burger</div>
      <div style={{ fontSize: 11, color: '#16a34a', fontWeight: 600 }}>{streamStatus}</div>
      </div>
      </div>
      <button
      onClick={() => setSidebarOpen((prev) => !prev)}
      style={{
        width: 40, height: 40, borderRadius: 12, border: 'none',
        background: '#0f172a', color: '#ffffff',
        display: 'grid', placeItems: 'center', cursor: 'pointer',
        flexShrink: 0,
      }}
      >
      {sidebarOpen ? <X size={18} /> : <Menu size={18} />}
      </button>
      </div>
      </div>
    )}
    
    <div
    style={{
      maxWidth: 1500,
      margin: '0 auto',
      display: 'grid',
      gridTemplateColumns: mainGridColumns,
      gap: isMobile ? 10 : 22,
    }}
    >
    {(!isMobile || sidebarOpen) && (
      <>
      {isMobile && (
        <div
        onClick={() => setSidebarOpen(false)}
        style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.35)', zIndex: 90 }}
        />
      )}
      <div
      style={{
        position: isMobile ? 'fixed' : 'sticky',
        top: isMobile ? 0 : 22,
        left: isMobile ? 0 : 'auto',
        bottom: isMobile ? 0 : 'auto',
        width: isMobile ? '82%' : 'auto',
        maxWidth: isMobile ? 320 : 'none',
        zIndex: isMobile ? 100 : 'auto',
        height: isMobile ? '100vh' : 'fit-content',
        overflowY: 'auto',
      }}
      >
      <Card style={{ height: 'fit-content', minHeight: isMobile ? '100vh' : 'auto', borderRadius: isMobile ? 0 : 24 }}>
      <div
      style={{
        marginBottom: 24, padding: 18, borderRadius: 22,
        background: '#0f172a', color: '#ffffff',
        display: 'flex', gap: 12, alignItems: 'center',
      }}
      >
      <div
      style={{
        width: 52, height: 52, display: 'grid', placeItems: 'center',
        borderRadius: 16, background: 'rgba(255,255,255,0.08)',
      }}
      >
      <UtensilsCrossed />
      </div>
      <div>
      <div style={{ fontSize: 13, color: '#cbd5e1' }}>Restaurant Admin</div>
      <div style={{ fontSize: 24, fontWeight: 800 }}>Ajabo Burger</div>
      </div>
      </div>
      <div style={{ display: 'grid', gap: 8 }}>
      <SidebarItem active={page === 'dashboard'} icon={LayoutDashboard} label="Dashboard" onClick={() => handleMenuClick('dashboard')} />
      <SidebarItem active={page === 'orders'} icon={ShoppingBag} label="Buyurtmalar" onClick={() => handleMenuClick('orders')} />
      <SidebarItem active={page === 'products'} icon={Package} label="Mahsulotlar" onClick={() => handleMenuClick('products')} />
      <SidebarItem active={page === 'stats'} icon={BarChart3} label="Statistika" onClick={() => handleMenuClick('stats')} />
      <SidebarItem active={false} icon={LogOut} label="Logout" onClick={handleLogout} />
      </div>
      </Card>
      </div>
      </>
    )}
    
    <div style={{ display: 'grid', gap: isMobile ? 12 : 22 }}>
    {!isMobile && (
      <Card>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'center', flexWrap: 'wrap', overflow: 'hidden' }}>
      <div>
      <div style={{ fontSize: 38, fontWeight: 800, color: '#0f172a' }}>Admin Panel</div>
      <div style={{ color: '#64748b', marginTop: 6 }}>
      Buyurtmalar, mahsulotlar va to'lovlar real ma'lumotlar bilan ishlayapti.
      </div>
      <div style={{ color: '#16a34a', marginTop: 6, fontSize: 13, fontWeight: 700 }}>
      {streamStatus}
      </div>
      </div>
      <div style={{ position: 'relative', width: 280, flexShrink: 0 }}>
      <Search size={16} style={{ position: 'absolute', left: 12, top: 14, color: '#94a3b8' }} />
      <Input
      value={search}
      onChange={(e) => setSearch(e.target.value)}
      placeholder="Qidirish..."
      style={{ paddingLeft: 36 }}
      />
      </div>
      </div>
      </Card>
    )}
    
    {isMobile && (
      <Card>
      <div style={{ position: 'relative', width: '100%' }}>
      <Search size={16} style={{ position: 'absolute', left: 12, top: 14, color: '#94a3b8' }} />
      <Input
      value={search}
      onChange={(e) => setSearch(e.target.value)}
      placeholder="Qidirish..."
      style={{ paddingLeft: 36 }}
      />
      </div>
      </Card>
    )}
    
    <div style={{ display: 'grid', gridTemplateColumns: topStatsGrid, gap: 16 }}>
    <StatCard title="Bugungi buyurtmalar" value={statsData?.totalOrders ?? 0} icon={ShoppingBag} helper="Bugun tushgan" />
    <StatCard title="Yangi" value={statsData?.newOrders ?? 0} icon={Bell} helper="Bugungi yangilar" />
    <StatCard title="Bugungi naqd" value={formatPrice(statsData?.cashRevenue ?? 0)} icon={Banknote} helper="Bugun naqd" />
    <StatCard title="Bugungi Click" value={formatPrice(statsData?.clickRevenue ?? 0)} icon={CreditCard} helper="Bugun Click" dark />
    </div>
    
    {/* Bugungi qo'shimcha ko'rsatkichlar */}
    <div style={{ display: 'grid', gridTemplateColumns: topStatsGrid, gap: 16 }}>
    <StatCard title="Yetkazilgan" value={statsData?.deliveredOrders ?? 0} icon={PackageCheck} helper="Bugun yetkazilgan" />
    <StatCard title="To'langan" value={statsData?.paidOrders ?? 0} icon={Wallet} helper="Bugun to'langan" />
    <StatCard title="To'lov kutilmoqda" value={statsData?.pendingPaymentOrders ?? 0} icon={Clock3} helper="Click pending" />
    <StatCard title="Bekor qilingan" value={statsData?.cancelledOrders ?? 0} icon={X} helper="Bugun bekor" />
    </div>
    
    {/* Bugungi umumiy tushum */}
    <Card style={{ background: '#0f172a', color: '#ffffff' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
    <div>
    <div style={{ fontSize: 14, color: '#94a3b8', fontWeight: 600 }}>Bugungi umumiy tushum</div>
    <div style={{ fontSize: isMobile ? 28 : 36, fontWeight: 800, marginTop: 6 }}>
    {formatPrice((statsData?.cashRevenue ?? 0) + (statsData?.clickRevenue ?? 0))}
    </div>
    </div>
    <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
    <div style={{ textAlign: 'right' }}>
    <div style={{ fontSize: 12, color: '#64748b' }}>Naqd</div>
    <div style={{ fontSize: 18, fontWeight: 800, color: '#34d399' }}>{formatPrice(statsData?.cashRevenue ?? 0)}</div>
    </div>
    <div style={{ textAlign: 'right' }}>
    <div style={{ fontSize: 12, color: '#64748b' }}>Click</div>
    <div style={{ fontSize: 18, fontWeight: 800, color: '#60a5fa' }}>{formatPrice(statsData?.clickRevenue ?? 0)}</div>
    </div>
    </div>
    </div>
    </Card>
    
    {page === 'dashboard' && (
      <>
      <Card>
      <SectionTitle title="So'nggi buyurtmalar" subtitle="Oxirgi 3 ta buyurtma" isMobile={isMobile} />
      <div style={{ display: 'grid', gap: 16, marginTop: 18 }}>
      {filteredOrders.slice(0, 3).map((order) => (
        <OrderCard
        key={order.id}
        order={order}
        onStatusChange={handleStatusChange}
        onDeleteOrder={handleDeleteOrder}
        isMobile={isMobile}
        isTablet={isTablet}
        />
      ))}
      </div>
      </Card>
      </>
    )}
    
    {page === 'orders' && (
      <Card>
      <SectionTitle title="Buyurtmalar" subtitle={`Har sahifada ${ORDERS_PER_PAGE} ta buyurtma`} isMobile={isMobile} />
      <div style={{ marginTop: 18, display: 'grid', gap: 14 }}>
      <div style={{ display: 'grid', gap: 10, padding: 12, borderRadius: 18, background: '#f8fafc', border: '1px solid #eef2f7' }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', overflowX: 'auto', paddingBottom: 2 }}>
      <Filter size={14} style={{ flexShrink: 0 }} />
      <FilterChip small active={orderTab === 'active'} onClick={() => setOrderTab('active')}>Active</FilterChip>
      <FilterChip small active={orderTab === 'history'} onClick={() => setOrderTab('history')}>History</FilterChip>
      </div>
      <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 2 }}>
      <FilterChip small active={paymentFilter === 'all'} onClick={() => setPaymentFilter('all')}>Barchasi</FilterChip>
      <FilterChip small active={paymentFilter === 'cash'} onClick={() => setPaymentFilter('cash')}>Naqd</FilterChip>
      <FilterChip small active={paymentFilter === 'click'} onClick={() => setPaymentFilter('click')}>Click</FilterChip>
      </div>
      <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 2 }}>
      <FilterChip small active={paymentStatusFilter === 'all'} onClick={() => setPaymentStatusFilter('all')}>Hammasi</FilterChip>
      <FilterChip small active={paymentStatusFilter === 'paid'} onClick={() => setPaymentStatusFilter('paid')}>To'langan</FilterChip>
      <FilterChip small active={paymentStatusFilter === 'pending'} onClick={() => setPaymentStatusFilter('pending')}>Kutilmoqda</FilterChip>
      </div>
      </div>
      
      <div style={{ display: 'grid', gap: 16 }}>
      {paginatedOrders.map((order) => (
        <OrderCard
        key={order.id}
        order={order}
        onStatusChange={handleStatusChange}
        onDeleteOrder={handleDeleteOrder}
        hideActions={orderTab === 'history'}
        isMobile={isMobile}
        isTablet={isTablet}
        />
      ))}
      </div>
      
      {currentOrders.length === 0 && (
        <div style={{ textAlign: 'center', padding: '40px 0', color: '#64748b', fontWeight: 700 }}>
        Buyurtma topilmadi
        </div>
      )}
      
      <Pagination currentPage={orderPage} totalPages={totalOrderPages} onPageChange={setOrderPage} isMobile={isMobile} />
      </div>
      </Card>
    )}
    
    {page === 'products' && (
      <Card>
      <SectionTitle
      title="Mahsulotlar"
      subtitle={`${products.length} ta mahsulot`}
      isMobile={isMobile}
      right={
        <Button onClick={openAdd} style={{ display: 'flex', alignItems: 'center', gap: 8, width: isMobile ? '100%' : 'auto', justifyContent: 'center' }}>
        <Plus size={16} /> Mahsulot qo'shish
        </Button>
      }
      />
      <div style={{ marginTop: 18, display: 'grid', gridTemplateColumns: productGrid, gap: 16 }}>
      {products.map((product) => (
        <Card key={product.key} style={{ padding: 0, overflow: 'hidden', border: '1px solid #e5e7eb', boxShadow: 'none' }}>
        <div style={{ aspectRatio: '16 / 10', background: '#e2e8f0' }}>
        {product.image ? (
          <img src={product.image} alt={product.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : null}
        </div>
        <div style={{ padding: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
        <div>
        <div style={{ fontWeight: 800, fontSize: 18, color: '#0f172a' }}>{product.name}</div>
        <div style={{ color: '#64748b', fontSize: 13, marginTop: 4 }}>{product.category}</div>
        </div>
        <span
        style={{
          height: 'fit-content', padding: '6px 10px', borderRadius: 999,
          background: product.active ? '#d1fae5' : '#e2e8f0',
          color: product.active ? '#047857' : '#475569',
          fontWeight: 800, fontSize: 12,
        }}
        >
        {product.active ? 'Aktiv' : 'Yashirin'}
        </span>
        </div>
        <div style={{ marginTop: 14, fontSize: 26, fontWeight: 800, color: '#0f172a' }}>
        {formatPrice(product.price)}
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 16, flexWrap: 'wrap' }}>
        <Button
        onClick={() => openEdit(product)}
        style={{ flex: 1, background: '#e2e8f0', color: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, minWidth: isSmallMobile ? '100%' : 'auto' }}
        >
        <Pencil size={16} /> Tahrirlash
        </Button>
        <Button
        onClick={() => toggleProduct(product)}
        style={{ flex: 1, background: '#ffffff', color: '#0f172a', border: '1px solid #cbd5e1', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, minWidth: isSmallMobile ? '100%' : 'auto' }}
        >
        {product.active ? <PowerOff size={16} /> : <Power size={16} />}
        {product.active ? 'Yashirish' : 'Ochish'}
        </Button>
        <Button
        onClick={() => deleteProduct(product)}
        style={{ width: '100%', background: '#fee2e2', color: '#991b1b', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
        >
        <Trash2 size={16} /> O'chirish
        </Button>
        </div>
        </div>
        </Card>
      ))}
      </div>
      </Card>
    )}
    
    {page === 'stats' && (
      <div style={{ display: 'grid', gap: 22 }}>
      <Card>
      <SectionTitle title="Umumiy statistika" subtitle="Barcha vaqtdagi ma'lumotlar" isMobile={isMobile} />
      <div style={{ marginTop: 18, display: 'grid', gridTemplateColumns: statsGrid4, gap: 16 }}>
      <div style={{ padding: 18, borderRadius: 20, background: '#f8fafc' }}>
      <div style={{ fontSize: 14, color: '#64748b' }}>Jami buyurtmalar</div>
      <div style={{ marginTop: 10, fontSize: 30, fontWeight: 800 }}>{allStatsData?.totalOrders ?? 0}</div>
      </div>
      <div style={{ padding: 18, borderRadius: 20, background: '#d1fae5' }}>
      <div style={{ fontSize: 14, color: '#047857' }}>Yetkazilgan</div>
      <div style={{ marginTop: 10, fontSize: 30, fontWeight: 800 }}>{allStatsData?.deliveredOrders ?? 0}</div>
      </div>
      <div style={{ padding: 18, borderRadius: 20, background: '#f8fafc' }}>
      <div style={{ fontSize: 14, color: '#64748b' }}>To'langan</div>
      <div style={{ marginTop: 10, fontSize: 30, fontWeight: 800 }}>{allStatsData?.paidOrders ?? 0}</div>
      </div>
      <div style={{ padding: 18, borderRadius: 20, background: '#fee2e2' }}>
      <div style={{ fontSize: 14, color: '#b91c1c' }}>Bekor qilingan</div>
      <div style={{ marginTop: 10, fontSize: 30, fontWeight: 800 }}>{allStatsData?.cancelledOrders ?? 0}</div>
      </div>
      <div style={{ padding: 18, borderRadius: 20, background: '#eff6ff' }}>
      <div style={{ fontSize: 14, color: '#1d4ed8' }}>Naqd tushum (jami)</div>
      <div style={{ marginTop: 10, fontSize: 22, fontWeight: 800 }}>{formatPrice(allStatsData?.cashRevenue ?? 0)}</div>
      </div>
      <div style={{ padding: 18, borderRadius: 20, background: '#0f172a' }}>
      <div style={{ fontSize: 14, color: '#94a3b8' }}>Click tushum (jami)</div>
      <div style={{ marginTop: 10, fontSize: 22, fontWeight: 800, color: '#ffffff' }}>{formatPrice(allStatsData?.clickRevenue ?? 0)}</div>
      </div>
      <div style={{ padding: 18, borderRadius: 20, background: '#f0fdf4' }}>
      <div style={{ fontSize: 14, color: '#047857' }}>Umumiy tushum</div>
      <div style={{ marginTop: 10, fontSize: 22, fontWeight: 800 }}>{formatPrice(allStatsData?.totalRevenue ?? 0)}</div>
      </div>
      <div style={{ padding: 18, borderRadius: 20, background: '#fefce8' }}>
      <div style={{ fontSize: 14, color: '#a16207' }}>To'lov kutilmoqda</div>
      <div style={{ marginTop: 10, fontSize: 30, fontWeight: 800 }}>{allStatsData?.pendingPaymentOrders ?? 0}</div>
      </div>
      </div>
      </Card>
      
      <Card>
      <SectionTitle title="Har kunlik statistika" subtitle="Kunlar bo'yicha tushum va zakazlar" isMobile={isMobile} />
      {dailyStats.length === 0 ? (
        <div style={{ marginTop: 18, color: '#64748b' }}>Hozircha kunlik statistika yo'q</div>
      ) : (
        <div style={{ display: 'grid', gap: 16, marginTop: 18 }}>
        {dailyStats.map((day) => (
          <div key={day.dateKey} style={{ border: '1px solid #e5e7eb', borderRadius: 22, padding: isMobile ? 14 : 18, background: '#ffffff' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: isMobile ? 'flex-start' : 'center', marginBottom: 16, flexWrap: 'wrap', flexDirection: isMobile ? 'column' : 'row' }}>
          <div style={{ fontSize: isMobile ? 18 : 22, fontWeight: 800, color: '#0f172a' }}>{day.dateLabel}</div>
          <div style={{ padding: '8px 12px', borderRadius: 999, background: '#eff6ff', color: '#1d4ed8', fontWeight: 800, fontSize: 13 }}>
          {day.totalOrders} ta zakaz
          </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: statsGrid4, gap: 14 }}>
          <div style={{ padding: 16, borderRadius: 18, background: '#f8fafc' }}>
          <div style={{ fontSize: 13, color: '#64748b' }}>Kunlik jami zakaz</div>
          <div style={{ marginTop: 8, fontSize: 26, fontWeight: 800 }}>{day.totalOrders}</div>
          </div>
          <div style={{ padding: 16, borderRadius: 18, background: '#f8fafc' }}>
          <div style={{ fontSize: 13, color: '#64748b' }}>Kunlik daromad</div>
          <div style={{ marginTop: 8, fontSize: 26, fontWeight: 800 }}>{formatPrice(day.revenue)}</div>
          </div>
          <div style={{ padding: 16, borderRadius: 18, background: '#f8fafc' }}>
          <div style={{ fontSize: 13, color: '#64748b' }}>Naqd tushum</div>
          <div style={{ marginTop: 8, fontSize: 26, fontWeight: 800 }}>{formatPrice(day.cashRevenue)}</div>
          </div>
          <div style={{ padding: 16, borderRadius: 18, background: '#f8fafc' }}>
          <div style={{ fontSize: 13, color: '#64748b' }}>Click tushum</div>
          <div style={{ marginTop: 8, fontSize: 26, fontWeight: 800 }}>{formatPrice(day.clickRevenue)}</div>
          </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: statsGrid4, gap: 12, marginTop: 14 }}>
          <div style={{ padding: 14, borderRadius: 16, background: '#eff6ff', color: '#1d4ed8', fontWeight: 800 }}>Yangi: {day.newOrders}</div>
          <div style={{ padding: 14, borderRadius: 16, background: '#fef3c7', color: '#b45309', fontWeight: 800 }}>Qabul qilindi: {day.acceptedOrders}</div>
          <div style={{ padding: 14, borderRadius: 16, background: '#ede9fe', color: '#6d28d9', fontWeight: 800 }}>Tayyor: {day.readyOrders}</div>
          <div style={{ padding: 14, borderRadius: 16, background: '#d1fae5', color: '#047857', fontWeight: 800 }}>Yetkazildi: {day.deliveredOrders}</div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: statsGrid3, gap: 12, marginTop: 12 }}>
          <div style={{ padding: 14, borderRadius: 16, background: '#ecfdf5', color: '#047857', fontWeight: 800 }}>To'langan: {day.paidOrders}</div>
          <div style={{ padding: 14, borderRadius: 16, background: '#fffbeb', color: '#b45309', fontWeight: 800 }}>Kutilmoqda: {day.pendingPaymentOrders}</div>
          <div style={{ padding: 14, borderRadius: 16, background: '#f8fafc', color: '#0f172a', fontWeight: 800 }}>Yetkazilgan daromad: {formatPrice(day.deliveredRevenue)}</div>
          </div>
          </div>
        ))}
        </div>
      )}
      </Card>
      </div>
    )}
    </div>
    </div>
    
    {showForm && (
      <div
      onClick={() => setShowForm(false)}
      style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.4)', display: 'grid', placeItems: 'center', padding: isMobile ? 12 : 20, zIndex: 999 }}
      >
      <div
      onClick={(e) => e.stopPropagation()}
      style={{
        width: '100%',
        maxWidth: 520,
        maxHeight: '92vh',
        display: 'flex',
        flexDirection: 'column',
        background: '#ffffff',
        borderRadius: 28,
        boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
        overflow: 'hidden',
      }}
      >
      {/* Header - scroll bo'lmaydi */}
      <div style={{ padding: isMobile ? '16px 18px 12px' : '22px 24px 14px', borderBottom: '1px solid #f1f5f9', flexShrink: 0 }}>
      <div style={{ fontSize: isMobile ? 20 : 24, fontWeight: 800, color: '#0f172a' }}>
      {editingId ? 'Mahsulotni tahrirlash' : "Yangi mahsulot qo'shish"}
      </div>
      </div>
      
      {/* Kontent - scroll bo'ladi */}
      <div style={{ flex: 1, overflowY: 'auto', padding: isMobile ? '14px 18px' : '16px 24px' }}>
      <div style={{ display: 'grid', gap: 12 }}>
      <Input placeholder="ID / key" value={form.id} onChange={(e) => setForm((prev) => ({ ...prev, id: e.target.value }))} />
      <Input placeholder="Mahsulot nomi" value={form.name} onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))} />
      <Input placeholder="Narxi" type="number" value={form.price} onChange={(e) => setForm((prev) => ({ ...prev, price: e.target.value }))} />
      <Input placeholder="Kategoriya" value={form.category} onChange={(e) => setForm((prev) => ({ ...prev, category: e.target.value }))} />
      <div style={{ display: 'flex', gap: 10, flexDirection: isSmallMobile ? 'column' : 'row' }}>
      <Button
      onClick={() => setImageMode('url')}
      style={{ flex: 1, background: imageMode === 'url' ? '#0f172a' : '#e2e8f0', color: imageMode === 'url' ? '#ffffff' : '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
      >
      <LinkIcon size={16} /> URL bilan
      </Button>
      <Button
      onClick={() => setImageMode('upload')}
      style={{ flex: 1, background: imageMode === 'upload' ? '#0f172a' : '#e2e8f0', color: imageMode === 'upload' ? '#ffffff' : '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
      >
      <Upload size={16} /> Upload
      </Button>
      </div>
      {imageMode === 'url' ? (
        <Input placeholder="Rasm URL" value={form.image} onChange={(e) => setForm((prev) => ({ ...prev, image: e.target.value }))} />
      ) : (
        <input
        type="file"
        accept="image/*"
        onChange={(e) => handleImageFileChange(e.target.files?.[0])}
        style={{ width: '100%', padding: '12px 14px', borderRadius: 14, border: '1px solid #dbe2ea', outline: 'none', fontSize: 14, background: '#ffffff' }}
        />
      )}
      {form.image ? (
        <div style={{ border: '1px solid #e2e8f0', borderRadius: 14, padding: 10, background: '#f8fafc' }}>
        <div style={{ fontSize: 12, color: '#64748b', marginBottom: 8 }}>Rasm preview</div>
        <img src={form.image} alt="preview" style={{ width: '100%', maxHeight: 160, objectFit: 'contain', borderRadius: 10, background: '#ffffff' }} />
        </div>
      ) : null}
      </div>
      </div>
      
      {/* Footer tugmalar - scroll bo'lmaydi */}
      <div style={{ padding: isMobile ? '12px 18px 16px' : '14px 24px 20px', borderTop: '1px solid #f1f5f9', flexShrink: 0, display: 'flex', justifyContent: 'flex-end', gap: 10, flexDirection: isSmallMobile ? 'column' : 'row' }}>
      <Button onClick={() => setShowForm(false)} style={{ background: '#e2e8f0', color: '#0f172a', width: isSmallMobile ? '100%' : 'auto' }}>
      Bekor qilish
      </Button>
      <Button onClick={saveProduct} style={{ width: isSmallMobile ? '100%' : 'auto' }}>
      <Check size={16} style={{ verticalAlign: 'middle', marginRight: 6 }} />
      Saqlash
      </Button>
      </div>
      </div>
      </div>
    )}
    </div>
  );
}