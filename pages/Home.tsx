
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ReferralService, User, DBService, calculateTransaction, formatName } from '../types';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

export const Home: React.FC = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<User>(ReferralService.getUserProfile());
  const [stats, setStats] = useState({ contribution: 0, savings: 0, count: 0 });
  const [activeRequests, setActiveRequests] = useState<any[]>([]);
  const [loadingRequests, setLoadingRequests] = useState(true);

  useEffect(() => {
    const fetchRealData = async () => {
      // 1. Get Current User & Stats
      if (isSupabaseConfigured()) {
        try {
          const { data: { user: authUser } } = await supabase.auth.getUser();
          if (authUser) {
             const profile = await DBService.getUserProfile(authUser.id);
             if (profile) {
                setUser(profile);
                ReferralService.saveUserProfile(profile);
             }
             const userStats = await DBService.getUserStats(authUser.id);
             setStats(userStats);
          }
        } catch (e) {
          console.log("Offline or demo mode stats", e);
        }
      }

      // 2. Get Pending Transactions (Active Requests)
      try {
        const pending = await DBService.getPendingTransactions();
        
        // Filter out my own requests
        const myId = user.id;
        const othersRequests = pending.filter((tx: any) => tx.seeker_id !== myId);
        
        if (othersRequests.length > 0) {
            setActiveRequests(othersRequests);
        } else {
            // Fallback Mock Data if DB is empty or offline, matching the DB structure for UI consistency
            const mocks = [
                { 
                    id: 'mock1', 
                    amount: 450, 
                    support_percentage: 20, 
                    profiles: { full_name: 'Fatih Demir', avatar_url: 'https://images.unsplash.com/photo-1599566150163-29194dcaad36?w=100&h=100&fit=crop', rating: 5.0 } 
                },
                { 
                    id: 'mock2', 
                    amount: 1200, 
                    support_percentage: 20, 
                    profiles: { full_name: 'Merve Aslan', avatar_url: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop', rating: 4.9 } 
                }
            ];
            setActiveRequests(mocks);
        }
      } catch (e) {
        console.error("Error fetching requests:", e);
      } finally {
        setLoadingRequests(false);
      }
    };

    fetchRealData();

    const loadData = () => {
      setUser(ReferralService.getUserProfile());
    };
    window.addEventListener('storage', loadData);
    return () => window.removeEventListener('storage', loadData);
  }, []);

  return (
    <div className="bg-background-dark min-h-screen text-white">
      {/* Header */}
      <header className="flex items-center justify-between px-8 py-4 border-b border-slate-800 sticky top-0 bg-background-dark/80 backdrop-blur-md z-10">
        <div className="w-full max-w-xl">
          <div className="relative group">
            <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-primary transition-colors">search</span>
            <input 
              className="w-full bg-slate-900/50 border border-slate-800 focus:border-primary focus:ring-0 rounded-xl pl-12 pr-4 py-2.5 text-sm text-white placeholder:text-slate-500 transition-all outline-none" 
              placeholder="İşlem, kullanıcı veya market ilanı ara..." 
              type="text"
            />
          </div>
        </div>
        <div className="flex items-center gap-4">
          <button className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:border-slate-700 transition-all relative">
            <span className="material-symbols-outlined">notifications</span>
            <span className="absolute top-2.5 right-2.5 w-2 h-2 bg-red-500 rounded-full border-2 border-slate-900"></span>
          </button>
          <div className="h-8 w-px bg-slate-800 mx-2"></div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-primary bg-primary/10 px-2 py-1 rounded">PRO</span>
          </div>
        </div>
      </header>

      <div className="p-4 md:p-8 flex flex-col gap-8 max-w-[1400px] mx-auto w-full">
        {/* Hero Section */}
        <div className="grid grid-cols-12 gap-6">
          <div className="col-span-12">
            <div className="relative h-auto md:h-[240px] rounded-3xl overflow-hidden hero-gradient p-10 flex flex-col justify-center group shadow-2xl shadow-accent-purple/20">
              <div className="absolute top-0 right-0 p-8 opacity-20 group-hover:scale-110 transition-transform duration-700 hidden md:block">
                <span className="material-symbols-outlined !text-[160px] text-white rotate-12">rocket_launch</span>
              </div>
              <div className="relative z-10 max-w-lg">
                <h2 className="text-white text-3xl md:text-4xl font-black leading-tight mb-3 tracking-tighter">Birlikte Paylaş, <br/>Daha Fazla Kazan!</h2>
                <p className="text-white/80 text-base mb-6 font-medium">Davet ettiğin her arkadaşın için <span className="text-white font-bold underline decoration-primary underline-offset-4">50 TL</span> nakit ödül kazan.</p>
                <button 
                  onClick={() => navigate('/invite')}
                  className="bg-white text-accent-blue px-6 py-3 rounded-2xl font-bold text-sm hover:shadow-xl hover:-translate-y-1 transition-all flex items-center gap-3 w-fit"
                >
                  Hemen Paylaş
                  <span className="material-symbols-outlined">send</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="glass p-6 rounded-3xl border border-slate-800 flex flex-col justify-between h-40">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-slate-400 text-sm font-medium mb-1">Toplam Tasarruf</p>
                <h3 className="text-3xl font-bold text-white tracking-tight">₺{stats.savings.toLocaleString()}</h3>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                <span className="material-symbols-outlined">savings</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-primary text-xs font-bold bg-primary/10 px-2 py-0.5 rounded-lg">Net İndirim Tutarı</span>
            </div>
          </div>

          <div className="glass p-6 rounded-3xl border border-slate-800 flex flex-col justify-between h-40">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-slate-400 text-sm font-medium mb-1">Paylaşılan Harcamalar</p>
                <h3 className="text-3xl font-bold text-white tracking-tight">{stats.count} Paylaşım</h3>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-blue-500/10 flex items-center justify-center text-blue-500">
                <span className="material-symbols-outlined">restaurant</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-blue-500 text-xs font-bold bg-blue-500/10 px-2 py-0.5 rounded-lg">Başarılı İşlem</span>
            </div>
          </div>

          <div className="glass p-6 rounded-3xl border border-slate-800 flex flex-col justify-between h-40">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-slate-400 text-sm font-medium mb-1">Kazanılan Katkı Payı</p>
                <h3 className="text-3xl font-bold text-white tracking-tight">₺{stats.contribution.toLocaleString()}</h3>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-400">
                <span className="material-symbols-outlined">move_to_inbox</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-emerald-400 text-xs font-bold bg-emerald-500/10 px-2 py-0.5 rounded-lg">Nakit İade Tutarı</span>
            </div>
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-12 gap-8">
          {/* Left Column (8/12) */}
          <div className="col-span-12 xl:col-span-8 flex flex-col gap-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">local_fire_department</span>
                Aktif Menü Paylaşım Talepleri
              </h2>
              <button onClick={() => navigate('/supporters')} className="text-primary text-sm font-bold hover:underline">Tümünü Gör</button>
            </div>

            {/* Active Requests Grid - Redesigned Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {activeRequests.map((item) => {
                 const calc = calculateTransaction(item.amount, item.support_percentage);
                 // "Kazanılan Katkı Payı" visually usually refers to what the Supporter GETS back (Refund).
                 // Use refundToSupporter (net)
                 
                 return (
                  <div key={item.id} onClick={() => navigate('/supporters')} className="bg-[#0b1221] p-5 rounded-[2rem] border border-slate-800 hover:border-slate-600 relative overflow-hidden group transition-all cursor-pointer">
                    
                    {/* Badge */}
                    <div className="absolute top-0 right-0 bg-primary px-5 py-1.5 rounded-bl-2xl z-10">
                      <span className="text-[10px] font-black text-[#020617] tracking-tighter uppercase">%{item.support_percentage} İNDİRİMLİ</span>
                    </div>

                    {/* Profile Header */}
                    <div className="flex items-center gap-3 mb-8 mt-2">
                      <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-slate-700">
                        <img 
                          src={item.profiles?.avatar_url || 'https://picsum.photos/200'} 
                          alt={item.profiles?.full_name} 
                          className="w-full h-full object-cover" 
                        />
                      </div>
                      <div>
                        <h4 className="text-white font-bold text-lg leading-none">
                            {formatName(item.profiles?.full_name || 'Kullanıcı')}
                        </h4>
                        <p className="text-slate-500 text-xs font-medium mt-1">Premium Üye</p>
                      </div>
                    </div>

                    {/* Amounts */}
                    <div className="flex items-end justify-between mb-8">
                      <div>
                        <p className="text-white text-xs font-bold mb-1">Menü Tutarı</p>
                        <p className="text-3xl font-black text-white tracking-tight">₺{item.amount.toLocaleString()}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-red-500 text-xs font-bold mb-1">Kazanılan Katkı Payı</p>
                        <p className="text-3xl font-black text-primary tracking-tight">₺{calc.refundToSupporter.toLocaleString()}</p>
                      </div>
                    </div>

                    {/* Button */}
                    <button className="w-full py-3.5 bg-[#1e293b] hover:bg-primary hover:text-[#020617] text-white rounded-2xl font-bold text-sm transition-all duration-300 shadow-lg shadow-black/20">
                      Teklif Ver
                    </button>
                  </div>
                 );
              })}
              
              {activeRequests.length === 0 && !loadingRequests && (
                  <div className="col-span-full bg-slate-900/50 p-8 rounded-3xl text-center border border-slate-800 border-dashed">
                      <p className="text-slate-400">Şu an aktif talep bulunmuyor.</p>
                  </div>
              )}
            </div>

            {/* Live Feed */}
            <div className="mt-4 flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary">bolt</span>
                  Son Tasarruflar
                </h2>
                <span className="flex items-center gap-1.5 text-xs font-bold text-slate-400">
                  <span className="w-2 h-2 rounded-full bg-primary animate-pulse"></span>
                  CANLI AKIŞ
                </span>
              </div>
              
              <div className="glass rounded-3xl border border-slate-800 p-2">
                <div className="flex flex-col">
                  {[
                    { name: 'Hasan T.', type: 'Yemek Kartı Paylaşımı', amount: '₺500', time: '2 dakika önce', icon: 'restaurant' },
                    { name: 'Ahmet Y.', type: 'Market Harcaması', amount: '₺300', time: '14 dakika önce', icon: 'shopping_bag' },
                    { name: 'Merve K.', type: 'Yemek Kartı Paylaşımı', amount: '₺150', time: '22 dakika önce', icon: 'restaurant' }
                  ].map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between p-4 hover:bg-white/5 rounded-2xl transition-all border-b border-slate-800/50 last:border-0">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                          <span className="material-symbols-outlined text-xl">{item.icon}</span>
                        </div>
                        <div>
                          <p className="text-white font-bold text-sm">{item.name}</p>
                          <p className="text-slate-400 text-xs">{item.type}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-primary font-bold">{item.amount} tasarruf etti</p>
                        <p className="text-slate-500 text-[10px]">{item.time}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Right Column (4/12) */}
          <div className="col-span-12 xl:col-span-4 flex flex-col gap-6">
            
            {/* Recent Transactions Widget */}
            <div className="glass rounded-3xl border border-slate-800 p-6 flex flex-col gap-6">
              <h3 className="text-xl font-bold text-white flex items-center justify-between">
                Son İşlemler
                <span className="material-symbols-outlined text-slate-500 text-sm">history</span>
              </h3>
              <div className="flex flex-col gap-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                      <span className="material-symbols-outlined">payments</span>
                    </div>
                    <div>
                      <p className="text-white text-sm font-bold">Sodexo Alımı</p>
                      <p className="text-slate-500 text-xs">Bugün, 14:20</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-primary text-sm font-bold">+₺410.00</p>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center text-orange-500">
                      <span className="material-symbols-outlined">swap_horiz</span>
                    </div>
                    <div>
                      <p className="text-white text-sm font-bold">Ticket Transferi</p>
                      <p className="text-slate-500 text-xs">Dün, 18:45</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-white text-sm font-bold">-₺200.00</p>
                  </div>
                </div>
              </div>
              <button className="w-full py-3 border border-slate-700 rounded-2xl text-slate-400 text-sm font-bold hover:bg-slate-800 hover:text-white transition-all">
                Tüm Geçmişi İncele
              </button>
            </div>

            {/* Leaderboard Widget */}
            <div className="glass rounded-3xl border border-slate-800 p-6 flex flex-col gap-6">
              <h3 className="text-xl font-bold text-white flex items-center justify-between">
                Liderlik Tablosu
                <span className="material-symbols-outlined text-yellow-500">emoji_events</span>
              </h3>
              <div className="flex flex-col gap-4">
                <div className="flex items-center gap-3 p-2 rounded-2xl bg-primary/5 border border-primary/10">
                  <span className="text-primary font-bold text-sm w-4">1</span>
                  <div className="w-8 h-8 rounded-full bg-slate-700 overflow-hidden">
                     <img src="https://picsum.photos/100/100?random=1" alt="Ahmet Yılmaz" className="w-full h-full object-cover"/>
                  </div>
                  <div className="flex-1">
                    <p className="text-white text-xs font-bold">Ahmet Yılmaz</p>
                    <p className="text-slate-500 text-[10px]">142 İşlem</p>
                  </div>
                  <span className="text-primary text-xs font-bold">₺12.4k</span>
                </div>
                <div className="flex items-center gap-3 p-2">
                  <span className="text-slate-500 font-bold text-sm w-4">2</span>
                  <div className="w-8 h-8 rounded-full bg-slate-700 overflow-hidden">
                     <img src="https://picsum.photos/100/100?random=2" alt="Selin Demir" className="w-full h-full object-cover"/>
                  </div>
                  <div className="flex-1">
                    <p className="text-white text-xs font-bold">Selin Demir</p>
                    <p className="text-slate-500 text-[10px]">98 İşlem</p>
                  </div>
                  <span className="text-slate-400 text-xs font-bold">₺8.2k</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <footer className="mt-auto p-8 border-t border-slate-800 text-slate-500 flex justify-between items-center text-xs">
          <p>© 2024 Workigom P2P. Tüm hakları saklıdır.</p>
          <div className="flex gap-6">
            <a className="hover:text-primary transition-colors" href="#">Güvenlik Politikası</a>
            <a className="hover:text-primary transition-colors" href="#">Kullanım Koşulları</a>
            <a className="hover:text-primary transition-colors" href="#">Destek Merkezi</a>
          </div>
        </footer>
      </div>
    </div>
  );
};
