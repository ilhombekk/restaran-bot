import React, { useState } from 'react';

export default function Login({ onLogin }) {
    const [password, setPassword] = useState('');
    
    function handleLogin() {
        if (password === '12345') {
            localStorage.setItem('admin_auth', 'true');
            onLogin();
        } else {
            alert('Parol noto‘g‘ri');
        }
    }
    
    return (
        <div
        style={{
            minHeight: '100vh',
            display: 'grid',
            placeItems: 'center',
            background: '#f1f5f9',
            fontFamily: 'Arial, sans-serif',
        }}
        >
        <div
        style={{
            width: '100%',
            maxWidth: 420,
            background: '#fff',
            borderRadius: 28,
            padding: 28,
            boxShadow: '0 20px 60px rgba(0,0,0,0.12)',
        }}
        >
        <div style={{ fontSize: 28, fontWeight: 800, color: '#0f172a' }}>
        Admin Login
        </div>
        <div style={{ color: '#64748b', marginTop: 8 }}>
        Admin panelga kirish uchun parolni kiriting
        </div>
        
        <input
        type="password"
        placeholder="Parol"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        onKeyDown={(e) => {
            if (e.key === 'Enter') handleLogin();
        }}
        style={{
            width: '100%',
            marginTop: 18,
            padding: '14px 16px',
            borderRadius: 16,
            border: '1px solid #cbd5e1',
            outline: 'none',
            fontSize: 15,
        }}
        />
        
        <button
        onClick={handleLogin}
        style={{
            width: '100%',
            marginTop: 14,
            border: 'none',
            borderRadius: 16,
            padding: '14px 16px',
            background: '#0f172a',
            color: '#fff',
            fontWeight: 700,
            cursor: 'pointer',
        }}
        >
        Kirish
        </button>
        </div>
        </div>
    );
}