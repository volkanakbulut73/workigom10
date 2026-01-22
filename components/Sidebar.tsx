
import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { ReferralService } from '../types';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

export const Sidebar: React.FC = () => {
  const navigate = useNavigate();
  const user = ReferralService.getUserProfile();

  const handleLogout = async () => {
    ReferralService.logout();
    navigate('/login');
    if (isSupabaseConfigured()) {
      try {
          await supabase.auth.signOut();
      } catch (e) {
          console.warn("Supabase signout background error:", e);
      }
    }
  };

  const NavItem = ({ to, icon, label }: { to: string, icon: string, label: string }) => (
    <NavLink 
      to={to} 
      className={({ isActive }) => 
        `flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200
        ${isActive 
          ? 'bg-primary/10 text-primary border border-primary/20' 
          : 'text-slate-400 hover:bg-slate-800/50 hover:text-white'}`
      }
    >
      <span className={`material-symbols-outlined ${icon === 'grid_view' ? 'fill-1' : ''}`}>{icon}</span>
      <span className="text-sm font-semibold">{label}</span>
    </NavLink>
  );

  return (
    <aside className="hidden md:flex flex-col w-72 bg-[#020617] border-r border-slate-800 justify-between p-6 shrink-0 h-screen sticky top-0">
      <div className="flex flex-col gap-8">
        {/* Logo */}
        <div className="flex items-center gap-3 px-2 cursor-pointer" onClick={() => navigate('/app')}>
          <div className="bg-primary rounded-xl p-2 flex items-center justify-center">
            <span className="material-symbols-outlined text-[#020617] font-bold">account_balance_wallet</span>
          </div>
          <div className="flex flex-col">
            <h1 className="text-white text-xl font-bold leading-tight tracking-tight">Workigom</h1>
            <p className="text-slate-400 text-xs font-medium">P2P Meal Card Sharing</p>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex flex-col gap-2">
          <NavItem to="/app" icon="grid_view" label="Ana Sayfa" />
          <NavItem to="/supporters" icon="handshake" label="Talepler" />
          <NavItem to="/swap" icon="storefront" label="Market" />
          <NavItem to="/profile" icon="person" label="Profil" />
        </nav>
      </div>

      <div className="flex flex-col gap-4">
        {/* User Profile */}
        <div className="flex items-center gap-3 px-2 py-3 border-t border-slate-800 mt-2 cursor-pointer hover:bg-slate-900/50 rounded-xl transition-colors" onClick={() => navigate('/profile')}>
          <div className="w-10 h-10 rounded-full bg-slate-800 border border-slate-700 overflow-hidden">
             <img src={user.avatar} alt={user.name} className="w-full h-full object-cover" />
          </div>
          <div className="flex flex-col overflow-hidden flex-1">
            <p className="text-white text-sm font-bold truncate">{user.name}</p>
            <p className="text-slate-500 text-xs truncate">Premium Üye</p>
          </div>
          <button onClick={(e) => { e.stopPropagation(); handleLogout(); }} className="text-slate-500 hover:text-red-500">
             <span className="material-symbols-outlined text-sm">logout</span>
          </button>
        </div>
      </div>
    </aside>
  );
};