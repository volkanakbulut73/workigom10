
import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  User as UserIcon, Mail, MapPin, Award, TrendingUp, Star, Camera, 
  ShieldCheck, Heart, Zap, ChevronLeft, LogOut, Edit2, Check, X, 
  Loader2, Settings, CreditCard, Phone, Calendar, Plus
} from 'lucide-react';
import { ReferralService, DBService } from '../types';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

export const Profile: React.FC = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState(ReferralService.getUserProfile());
  const isConnected = isSupabaseConfigured();

  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(user.name);
  const [editLocation, setEditLocation] = useState(user.location);
  const [editIban, setEditIban] = useState(user.iban || '');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewAvatar, setPreviewAvatar] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const loadUser = () => setUser(ReferralService.getUserProfile());
    window.addEventListener('storage', loadUser);
    return () => window.removeEventListener('storage', loadUser);
  }, []);

  const handleLogout = async () => {
    ReferralService.logout();
    navigate('/login');
    if (isConnected) {
        try {
            await supabase.auth.signOut();
        } catch (e) {
            console.warn("Sign out error:", e);
        }
    }
  };

  const handleEditToggle = () => {
    if (isEditing) {
        setIsEditing(false);
        setEditName(user.name);
        setEditLocation(user.location);
        setEditIban(user.iban || '');
        setPreviewAvatar(null);
        setSelectedFile(null);
    } else {
        setEditName(user.name);
        setEditLocation(user.location);
        setEditIban(user.iban || '');
        setIsEditing(true);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
        if (file.size > 5 * 1024 * 1024) {
            alert("Dosya boyutu 5MB'dan küçük olmalıdır.");
            return;
        }
        setSelectedFile(file);
        const objectUrl = URL.createObjectURL(file);
        setPreviewAvatar(objectUrl);
    }
  };

  const handleSave = async () => {
    if (!editName.trim()) return;
    setSaving(true);

    try {
        let avatarUrl = user.avatar;
        if (selectedFile) {
            avatarUrl = await DBService.uploadAvatar(selectedFile);
        }

        await DBService.updateUserProfile(user.id, {
            name: editName,
            location: editLocation,
            iban: editIban,
            avatar: avatarUrl
        });

        setUser(ReferralService.getUserProfile());
        setIsEditing(false);
        setPreviewAvatar(null);
        setSelectedFile(null);

    } catch (error: any) {
        alert("Profil güncellenirken bir hata oluştu: " + (error.message || "Bilinmeyen hata"));
    } finally {
        setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#020617] text-white p-4 md:p-8 pb-24 md:pb-8">
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div className="flex items-center gap-4">
            <button onClick={() => navigate(-1)} className="md:hidden w-8 h-8 flex items-center justify-center bg-slate-800 rounded-lg hover:bg-slate-700 transition-colors">
                <ChevronLeft size={18} />
            </button>
            <h1 className="text-2xl font-bold">Profilim</h1>
            <span className="hidden md:inline-block bg-slate-800 text-slate-400 text-xs px-3 py-1 rounded-full font-medium border border-slate-700">Hesap Detayları</span>
        </div>
        <div className="flex gap-3">
             {isEditing ? (
                 <>
                    <button onClick={handleEditToggle} disabled={saving} className="w-10 h-10 rounded-xl bg-slate-800 hover:bg-red-500/20 hover:text-red-500 flex items-center justify-center transition-colors border border-slate-700">
                        <X size={18} />
                    </button>
                    <button onClick={handleSave} disabled={saving} className="w-10 h-10 rounded-xl bg-primary hover:bg-emerald-400 text-[#020617] flex items-center justify-center transition-colors shadow-lg shadow-emerald-500/20">
                        {saving ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />}
                    </button>
                 </>
             ) : (
                 <button onClick={handleEditToggle} className="w-10 h-10 rounded-xl bg-slate-800 hover:bg-slate-700 flex items-center justify-center transition-colors border border-slate-700">
                    <Edit2 size={18} />
                 </button>
             )}
             <button onClick={handleLogout} className="w-10 h-10 rounded-xl bg-slate-800 hover:bg-slate-700 flex items-center justify-center transition-colors border border-slate-700">
                <LogOut size={18} />
             </button>
             <button className="hidden md:flex w-10 h-10 rounded-xl bg-slate-800 hover:bg-slate-700 items-center justify-center transition-colors border border-slate-700">
                <Settings size={18} />
             </button>
        </div>
      </div>

      {/* Main Profile Card */}
      <div className="bg-[#0f172a] rounded-[2rem] p-6 md:p-8 mb-6 border border-slate-800 relative overflow-hidden shadow-xl">
         <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>
         
         <div className="flex flex-col md:flex-row items-center md:items-start gap-6 relative z-10">
            {/* Avatar */}
            <div className="relative group">
                <input 
                    type="file" 
                    ref={fileInputRef} 
                    onChange={handleFileChange} 
                    accept="image/*" 
                    className="hidden" 
                />
                <div 
                    onClick={() => isEditing && fileInputRef.current?.click()}
                    className={`w-24 h-24 md:w-32 md:h-32 rounded-full p-1 border-2 border-slate-700 overflow-hidden relative ${isEditing ? 'cursor-pointer' : ''}`}
                >
                    <img 
                        src={previewAvatar || user.avatar} 
                        alt={user.name} 
                        className={`w-full h-full rounded-full object-cover ${isEditing ? 'group-hover:opacity-50' : ''}`}
                    />
                    {isEditing && (
                        <div className="absolute inset-0 flex items-center justify-center">
                            <Camera size={24} className="text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                    )}
                </div>
                {!isEditing && (
                    <div className="absolute bottom-2 right-2 bg-primary text-[#020617] p-1.5 rounded-full border-4 border-[#0f172a]">
                        <Settings size={14} />
                    </div>
                )}
            </div>

            {/* Info */}
            <div className="flex-1 text-center md:text-left space-y-2">
                <div className="flex flex-col md:flex-row items-center gap-3">
                    {isEditing ? (
                        <input 
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-1 text-2xl font-bold text-white focus:border-primary outline-none"
                        />
                    ) : (
                        <h2 className="text-3xl font-bold text-white">{user.name}</h2>
                    )}
                    <span className="bg-primary/10 text-primary text-[10px] font-bold px-2 py-1 rounded border border-primary/20 tracking-wider">PREMIUM ÜYE</span>
                </div>
                
                <div className="flex items-center justify-center md:justify-start gap-2 text-slate-400 text-sm">
                    <MapPin size={14} className="text-primary" />
                    {isEditing ? (
                         <input 
                            value={editLocation}
                            onChange={(e) => setEditLocation(e.target.value)}
                            className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-0.5 text-sm text-white focus:border-primary outline-none w-32"
                        />
                    ) : (
                        <span>{user.location}, Türkiye</span>
                    )}
                    <span className="w-1 h-1 bg-slate-600 rounded-full mx-1"></span>
                    <Calendar size={14} className="text-slate-500" />
                    <span>Ekim 2023'ten beri üye</span>
                </div>
            </div>

            {/* Action Button */}
            <div className="mt-4 md:mt-0">
                <button 
                    onClick={() => navigate('/swap/create')}
                    className="bg-primary hover:bg-emerald-400 text-[#020617] px-6 py-3 rounded-xl font-bold transition-all shadow-lg shadow-emerald-500/20 hover:scale-105 active:scale-95 flex items-center gap-2"
                >
                    <Plus size={18} strokeWidth={3} />
                    Kart Paylaş
                </button>
            </div>
         </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          {/* Card 1 */}
          <div className="bg-[#0f172a] rounded-[2rem] p-6 border border-slate-800 relative group hover:border-slate-700 transition-colors">
              <div className="flex justify-between items-start mb-4">
                  <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                      <Heart size={24} fill="currentColor" className="opacity-80" />
                  </div>
                  <span className="bg-primary/10 text-primary text-[10px] font-bold px-2 py-1 rounded-full">+12% Ay</span>
              </div>
              <p className="text-slate-400 text-sm font-medium mb-1">İşlem Sayısı</p>
              <h3 className="text-3xl font-bold text-white">124</h3>
              <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-primary/50 to-transparent opacity-50"></div>
          </div>

          {/* Card 2 */}
          <div className="bg-[#0f172a] rounded-[2rem] p-6 border border-slate-800 relative group hover:border-slate-700 transition-colors">
              <div className="flex justify-between items-start mb-4">
                  <div className="w-12 h-12 rounded-2xl bg-accent-purple/10 flex items-center justify-center text-accent-purple group-hover:scale-110 transition-transform">
                      <TrendingUp size={24} />
                  </div>
                  <span className="bg-accent-purple/10 text-accent-purple text-[10px] font-bold px-2 py-1 rounded-full">₺ Toplam</span>
              </div>
              <p className="text-slate-400 text-sm font-medium mb-1">Toplam Kazanç</p>
              <h3 className="text-3xl font-bold text-white">₺{user.wallet.totalEarnings.toFixed(0)}</h3>
              <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-accent-purple/50 to-transparent opacity-50"></div>
          </div>

          {/* Card 3 */}
          <div className="bg-[#0f172a] rounded-[2rem] p-6 border border-slate-800 relative group hover:border-slate-700 transition-colors">
              <div className="flex justify-between items-start mb-4">
                  <div className="w-12 h-12 rounded-2xl bg-yellow-500/10 flex items-center justify-center text-yellow-500 group-hover:scale-110 transition-transform">
                      <Star size={24} fill="currentColor" />
                  </div>
                  <div className="flex gap-0.5">
                      {[1,2,3,4,5].map(i => (
                          <Star key={i} size={10} className="text-yellow-500" fill="currentColor" />
                      ))}
                  </div>
              </div>
              <p className="text-slate-400 text-sm font-medium mb-1">Güven Puanı</p>
              <h3 className="text-3xl font-bold text-white">{user.rating} <span className="text-sm text-slate-500 font-normal">/ 5.0</span></h3>
              <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-yellow-500/50 to-transparent opacity-50"></div>
          </div>
      </div>

      {/* Bottom Section: Badges & Personal Info */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Rozetlerim */}
          <div className="lg:col-span-1 bg-[#0f172a] rounded-[2rem] p-6 border border-slate-800">
             <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                <Award size={20} className="text-primary" /> Rozetlerim
             </h3>
             
             <div className="space-y-4">
                 <div className="bg-slate-900/50 border border-slate-800 p-4 rounded-2xl flex items-center gap-4">
                     <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                         <ShieldCheck size={20} />
                     </div>
                     <div>
                         <h4 className="font-bold text-white text-sm">Güvenilir</h4>
                         <p className="text-xs text-slate-500">100+ Başarılı İşlem</p>
                     </div>
                 </div>

                 <div className="bg-slate-900/50 border border-slate-800 p-4 rounded-2xl flex items-center gap-4">
                     <div className="w-10 h-10 rounded-xl bg-accent-purple/10 flex items-center justify-center text-accent-purple">
                         <Heart size={20} />
                     </div>
                     <div>
                         <h4 className="font-bold text-white text-sm">Yardımcı</h4>
                         <p className="text-xs text-slate-500">Aktif Topluluk Desteği</p>
                     </div>
                 </div>

                 <div className="bg-slate-900/50 border border-slate-800 p-4 rounded-2xl flex items-center gap-4">
                     <div className="w-10 h-10 rounded-xl bg-yellow-500/10 flex items-center justify-center text-yellow-500">
                         <Zap size={20} fill="currentColor" />
                     </div>
                     <div>
                         <h4 className="font-bold text-white text-sm">Hızlı</h4>
                         <p className="text-xs text-slate-500">Ortalama 2dk Yanıt</p>
                     </div>
                 </div>
             </div>
          </div>

          {/* Right: Kişisel Bilgiler */}
          <div className="lg:col-span-2 bg-[#0f172a] rounded-[2rem] p-6 border border-slate-800">
             <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                <UserIcon size={20} className="text-primary" /> Kişisel Bilgiler
             </h3>
             
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 {/* Name */}
                 <div className="space-y-2">
                     <label className="text-xs font-bold text-slate-500 uppercase ml-1">Ad Soyad</label>
                     <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex items-center gap-3">
                         <UserIcon size={18} className="text-slate-500" />
                         <span className="text-white font-medium">{user.name}</span>
                     </div>
                 </div>

                 {/* Phone (Mock) */}
                 <div className="space-y-2">
                     <label className="text-xs font-bold text-slate-500 uppercase ml-1">Telefon Numarası</label>
                     <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex items-center gap-3">
                         <Phone size={18} className="text-slate-500" />
                         <span className="text-white font-medium">+90 (555) •••• 89</span>
                     </div>
                 </div>

                 {/* Email */}
                 <div className="space-y-2">
                     <label className="text-xs font-bold text-slate-500 uppercase ml-1">E-Posta Adresi</label>
                     <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex items-center gap-3 overflow-hidden">
                         <Mail size={18} className="text-slate-500 shrink-0" />
                         <span className="text-white font-medium truncate">m.aslan@workigom.com</span>
                     </div>
                 </div>

                 {/* IBAN Field - Added */}
                 <div className="space-y-2">
                     <label className="text-xs font-bold text-slate-500 uppercase ml-1">IBAN Bilgisi</label>
                     <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex items-center gap-3 overflow-hidden">
                         <CreditCard size={18} className="text-slate-500 shrink-0" />
                         {isEditing ? (
                             <input 
                                value={editIban}
                                onChange={(e) => setEditIban(e.target.value)}
                                placeholder="TR..."
                                className="bg-transparent text-white font-medium outline-none w-full placeholder:text-slate-600"
                             />
                         ) : (
                             <span className="text-white font-medium truncate">{user.iban || 'IBAN Eklenmemiş'}</span>
                         )}
                     </div>
                 </div>
             </div>
          </div>
      </div>
    </div>
  );
};