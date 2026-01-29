
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Wallet, Clock, Star, Loader2, Info, XCircle, Home, AlertTriangle } from 'lucide-react';
import { Button } from '../components/Button';
import { Tracker } from '../components/Tracker';
import { Transaction, TrackerStep, TransactionService, ReferralService, DBService, calculateTransaction, formatName } from '../types';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

export const FindShare: React.FC = () => {
  const navigate = useNavigate();
  const [amount, setAmount] = useState<string>(''); // Default empty for manual input
  const [description, setDescription] = useState('');
  const [activeTransaction, setActiveTransaction] = useState<Transaction | null>(null);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);

  // 1. Initial Load: Only runs once to fetch active state
  useEffect(() => {
    const init = async () => {
        let userId = 'current-user';
        if (isSupabaseConfigured()) {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) userId = user.id;
        }

        const initialTx = await DBService.getActiveTransaction(userId);
        if (initialTx) setActiveTransaction(initialTx);
    };
    init();
  }, []);

  // 2. Realtime Subscription: Only runs when we have an active transaction ID
  useEffect(() => {
    if (!activeTransaction?.id || !isSupabaseConfigured()) return;

    // Check transaction status periodically as a fallback
    const pollingInterval = setInterval(async () => {
        let userId = 'current-user';
        const { data: { user } } = await supabase.auth.getUser();
        if (user) userId = user.id;

        const freshTx = await DBService.getActiveTransaction(userId);
        if (freshTx && (freshTx.status !== activeTransaction.status || freshTx.supporterId !== activeTransaction.supporterId)) {
            setActiveTransaction(freshTx);
        }
    }, 4000);

    // Supabase Realtime Subscription
    const channel = supabase.channel(`tx_${activeTransaction.id}`)
        .on('postgres_changes', { 
            event: 'UPDATE', 
            schema: 'public', 
            table: 'transactions',
            filter: `id=eq.${activeTransaction.id}`
        }, (payload) => {
            const newData = payload.new;
            
            // Construct updated transaction safely
            const updatedTx: Transaction = {
                id: newData.id,
                seekerId: newData.seeker_id,
                supporterId: newData.supporter_id,
                amount: newData.amount,
                listingTitle: newData.listing_title,
                status: newData.status,
                supportPercentage: newData.support_percentage,
                qrUrl: newData.qr_url,
                qrUploadedAt: newData.qr_uploaded_at,
                completedAt: newData.completed_at,
                // Preserve existing names unless we refetch, update calculations
                seekerName: activeTransaction.seekerName, 
                supporterName: activeTransaction.supporterName,
                createdAt: newData.created_at,
                amounts: calculateTransaction(newData.amount, newData.support_percentage)
            };
            
            // If supporter joined, we might want to fetch their name
            if (newData.supporter_id && !activeTransaction.supporterId) {
                    DBService.getUserProfile(newData.supporter_id).then(profile => {
                        if(profile) updatedTx.supporterName = formatName(profile.name);
                        setActiveTransaction(updatedTx);
                    });
            } else {
                setActiveTransaction(updatedTx);
            }
        })
        .subscribe();

    return () => { 
        clearInterval(pollingInterval);
        supabase.removeChannel(channel); 
    };
  }, [activeTransaction?.id]);


  // Timer logic for QR validity
  useEffect(() => {
      if (activeTransaction?.status === TrackerStep.QR_UPLOADED && activeTransaction.qrUploadedAt) {
          const startTime = new Date(activeTransaction.qrUploadedAt).getTime();
          const interval = setInterval(() => {
              const elapsed = Math.floor((Date.now() - startTime) / 1000);
              const remaining = 300 - elapsed;
              setTimeLeft(remaining > 0 ? remaining : 0);
          }, 1000);
          return () => clearInterval(interval);
      }
  }, [activeTransaction?.status, activeTransaction?.qrUploadedAt]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleCreateRequest = async () => {
    if (creating) return;
    setCreating(true);
    
    try {
      let userId = 'current-user';
      let userName = 'Ben';

      if (isSupabaseConfigured()) {
          // Add timeout to getUser to prevent hanging
          const getUserPromise = supabase.auth.getUser();
          const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Auth check timeout')), 5000));
          
          try {
              const result: any = await Promise.race([getUserPromise, timeoutPromise]);
              const user = result?.data?.user;

              if (!user) {
                 alert("Lütfen önce giriş yapın.");
                 navigate('/login');
                 return;
              }
              userId = user.id;
              // Try to get profile name for better UX
              const profile = ReferralService.getUserProfile();
              if (profile && profile.id === userId) userName = formatName(profile.name);
          } catch (e) {
              console.warn("Auth check failed or timed out", e);
              // Fallback to local profile check if auth API hangs but we have local session
              const localProfile = ReferralService.getUserProfile();
              if (localProfile.id !== 'current-user') {
                  userId = localProfile.id;
                  userName = formatName(localProfile.name);
              } else {
                  alert("Bağlantı sorunu var, lütfen tekrar giriş yapın.");
                  navigate('/login');
                  return;
              }
          }
      } else {
          // Fallback demo user
          const profile = ReferralService.getUserProfile();
          userId = profile.id;
          userName = formatName(profile.name);
      }

      const val = parseFloat(amount);
      if (isNaN(val) || val < 50 || val > 5000) {
         alert("Tutar 50 - 5000 TL arasında olmalıdır.");
         setCreating(false);
         return;
      }

      const newTxData = await DBService.createTransactionRequest(userId, val, description);

      // Immediately set local state with correct mapping so UI updates instantly
      const localTx: Transaction = {
          id: newTxData.id,
          seekerId: newTxData.seeker_id || userId,
          amount: newTxData.amount || val,
          listingTitle: newTxData.listing_title || description,
          status: newTxData.status || TrackerStep.WAITING_SUPPORTER,
          supportPercentage: newTxData.support_percentage || 20,
          amounts: calculateTransaction(val, 20),
          createdAt: new Date().toISOString(),
          seekerName: userName
      };

      TransactionService.save(localTx); // Local backup
      setActiveTransaction(localTx);
      setDescription('');
      
    } catch (error: any) {
      console.error(error);
      alert("Talep oluşturulurken bir hata oluştu: " + (error.message || "Bilinmeyen hata. İnternet bağlantınızı kontrol edin."));
    } finally {
      setCreating(false);
    }
  };

  const handleCashPaid = async () => {
    if (!activeTransaction) return;
    
    // 1. Optimistic Update: Update UI immediately
    const previousState = { ...activeTransaction };
    const updated = { ...activeTransaction, status: TrackerStep.CASH_PAID };
    
    setActiveTransaction(updated);
    TransactionService.save(updated); // Save locally so refresh works

    // 2. Perform DB update in background
    if (isSupabaseConfigured()) {
        try {
            await DBService.markCashPaid(activeTransaction.id);
        } catch (e) {
            console.error("Cash Paid Update Error:", e);
        }
    }
  };

  const handlePaymentSuccess = async () => {
    if (!activeTransaction) return;
    
    // Optimistic
    const updated = { ...activeTransaction, status: TrackerStep.COMPLETED, completedAt: new Date().toISOString() };
    setActiveTransaction(updated);
    ReferralService.processReward(updated);

    if (isSupabaseConfigured()) {
        try {
            await DBService.completeTransaction(activeTransaction.id);
        } catch (e) {
            console.error("Complete transaction error:", e);
            // Fail silently or show toast, but keep success state for user
        }
    }
  };

  const handlePaymentFailed = async () => {
      if (!activeTransaction) return;
      if (!window.confirm("Ödeme başarısız oldu mu? İşlem sonlandırılacak.")) return;
      
      const updated = { ...activeTransaction, status: TrackerStep.FAILED };
      setActiveTransaction(updated);

      if (isSupabaseConfigured()) {
          try {
            await DBService.failTransaction(activeTransaction.id);
          } catch(e) { console.error(e); }
      }
  };

  const handleCancelTransaction = async () => {
    if (!activeTransaction) return;
    if (!window.confirm("İşlemi iptal etmek istediğinize emin misiniz?")) return;

    setLoading(true);
    try {
        if (isSupabaseConfigured()) {
            await DBService.cancelTransaction(activeTransaction.id);
        }
        setActiveTransaction(null);
        TransactionService.clearActive();
        navigate('/app'); 
    } catch (e: any) {
        console.error("Cancel failed", e);
        alert("İşlem iptal edilirken bir hata oluştu: " + (e.message || "Bilinmeyen Hata"));
    } finally {
        setLoading(false);
    }
  };

  const handleClearActive = async () => {
    if (activeTransaction && isSupabaseConfigured()) {
        try {
            await DBService.dismissTransaction(activeTransaction.id);
        } catch (e) {
            console.error("Dismiss failed", e);
        }
    }
     TransactionService.clearActive();
     setActiveTransaction(null);
     navigate('/app'); 
  };

  if (activeTransaction) {
    return (
      <div className="pb-32 min-h-screen bg-gray-50 font-sans">
        <div className="bg-slate-900 text-white pt-4 pb-14 px-6 rounded-b-[3rem] relative shadow-xl">
          <div className="flex justify-between items-center mb-2">
             <button onClick={() => navigate(-1)} className="flex items-center text-white/80 hover:text-white transition-colors">
               <ChevronLeft /> <span className="text-sm font-medium ml-1">Geri</span>
             </button>
             <h1 className="text-lg font-bold">
                 {activeTransaction.status === TrackerStep.WAITING_SUPPORTER 
                    ? 'Paylaşım Bekleniyor' 
                    : 'İşlem Detayı'}
             </h1>
             <div className="w-6"></div> 
          </div>
        </div>

        <div className="px-6 -mt-8 relative z-10 space-y-6">
            
            {activeTransaction.status === TrackerStep.CANCELLED ? (
                <div className="bg-white p-8 rounded-[2rem] shadow-xl text-center animate-fade-in border border-red-50">
                    <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
                        <XCircle size={40} className="text-red-500" />
                    </div>
                    <h2 className="text-xl font-bold text-gray-800 mb-2">İşlem İptal Edildi</h2>
                    <Button fullWidth onClick={handleClearActive} className="bg-gray-800 hover:bg-gray-900">
                        <Home size={16} className="mr-2" /> Ana Sayfaya Dön
                    </Button>
                </div>
            ) : activeTransaction.status === TrackerStep.FAILED ? (
                <div className="bg-white p-8 rounded-[2rem] shadow-xl text-center animate-fade-in border border-red-50">
                    <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
                        <AlertTriangle size={40} className="text-red-500" />
                    </div>
                    <h2 className="text-xl font-bold text-gray-800 mb-2">Ödeme Başarısız</h2>
                    <Button fullWidth onClick={handleClearActive} className="bg-gray-800 hover:bg-gray-900">
                        <Home size={16} className="mr-2" /> Ana Sayfaya Dön
                    </Button>
                </div>
            ) : (
                <>
                    <div className="bg-white p-6 rounded-[2rem] shadow-sm">
                        
                        {activeTransaction.status === TrackerStep.WAITING_SUPPORTER ? (
                            <div className="text-center mb-6">
                                <h2 className="font-bold text-lg text-gray-800 flex items-center gap-2 mb-4">
                                    <span className="w-1 h-6 bg-slate-900 rounded-full"></span>
                                    İşlem Takibi
                                </h2>
                                
                                <Tracker 
                                    currentStep={activeTransaction.status}
                                    steps={[
                                    { id: TrackerStep.WAITING_SUPPORTER, label: 'Eşleşme' },
                                    { id: TrackerStep.WAITING_CASH_PAYMENT, label: 'Ödemeniz' },
                                    { id: TrackerStep.CASH_PAID, label: 'QR Hazırlama' },
                                    { id: TrackerStep.QR_UPLOADED, label: 'QR Yüklendi' },
                                    { id: TrackerStep.COMPLETED, label: 'Tamamlandı' }
                                    ]}
                                />
                                
                                <div className="mt-8 pt-6 border-t border-gray-100 flex flex-col items-center">
                                    <div className="w-20 h-20 bg-amber-400 rounded-full flex items-center justify-center mb-4 shadow-lg shadow-amber-200">
                                        <Clock size={40} className="text-white" />
                                    </div>
                                    <h3 className="font-bold text-gray-800 text-sm mb-1">Paylaşım Talebiniz Yayınlandı</h3>
                                    <p className="text-xs text-blue-900 font-bold">Destekçiler talepinizi görüyor.</p>
                                    <p className="text-[10px] text-gray-400 mt-2">Bu ekranı kapatabilirsiniz, bildirim gelecektir.</p>
                                </div>
                            </div>
                        ) : (
                            <>
                                <div className="flex justify-between items-start mb-4 pb-4 border-b border-gray-50">
                                    <div>
                                        <div className="flex items-center gap-1.5 mb-1">
                                            <span className={`w-2 h-2 rounded-full ${activeTransaction.status === TrackerStep.COMPLETED ? 'bg-green-500' : 'bg-primary animate-pulse'}`}></span>
                                            <h2 className="font-bold text-lg text-gray-800">İşlem Durumu</h2>
                                        </div>
                                        <p className="text-xs text-gray-500">Destekçi: {formatName(activeTransaction.supporterName || 'Destekçi')}</p>
                                    </div>
                                    <div className="text-right">
                                        <span className="block font-bold text-slate-900 text-xl">{activeTransaction.amounts.seekerSavings} TL</span>
                                        <span className="text-[10px] text-gray-400 uppercase font-bold tracking-wide">Tasarruf</span>
                                    </div>
                                </div>

                                <Tracker 
                                    currentStep={activeTransaction.status}
                                    steps={[
                                    { 
                                        id: TrackerStep.WAITING_SUPPORTER,
                                        label: 'Eşleşme', 
                                    },
                                    { 
                                        id: TrackerStep.WAITING_CASH_PAYMENT, 
                                        label: 'Ödemeniz', 
                                    },
                                    { 
                                        id: TrackerStep.CASH_PAID, 
                                        label: 'QR Hazırlama', 
                                    },
                                    { 
                                        id: TrackerStep.QR_UPLOADED, 
                                        label: 'QR Yüklendi', 
                                    },
                                    {
                                        id: TrackerStep.COMPLETED,
                                        label: 'Tamamlandı',
                                    }
                                    ]}
                                />
                            </>
                        )}
                    </div>

                    {activeTransaction.status === TrackerStep.WAITING_CASH_PAYMENT && (
                    <div className="bg-cyan-50 p-6 rounded-[2rem] border border-cyan-100 space-y-4 animate-fade-in">
                        {activeTransaction.supportPercentage === 20 ? (
                            <>
                            <div className="flex items-center gap-3">
                                <div className="bg-white p-3 rounded-full shadow-sm text-primary"><Wallet size={24}/></div>
                                <div>
                                    <h3 className="font-bold text-gray-800">Ödeme Yapman Gerekiyor</h3>
                                    <p className="text-xs text-gray-600">
                                    Destekçiye <strong className="text-gray-900">{activeTransaction.amounts.seekerPayment} TL</strong> ödeme yap (IBAN/Nakit).
                                    </p>
                                </div>
                            </div>
                            
                            <Button fullWidth onClick={handleCashPaid} className="py-4 shadow-lg shadow-primary/20">
                                ✅ Ödemeyi Yaptım
                            </Button>
                            </>
                        ) : (
                            <div className="text-center py-4">
                            <h3 className="font-bold text-gray-800 text-lg mb-2">Ödeme Yapmana Gerek Yok! 🎉</h3>
                            <p className="text-xs text-gray-600 mb-4">%100 Destek aldın. Sadece QR bekle.</p>
                            <Button fullWidth onClick={handleCashPaid} className="bg-emerald-500 hover:bg-emerald-600 shadow-emerald-200">
                                Devam Et (QR Bekle)
                            </Button>
                            </div>
                        )}
                    </div>
                    )}

                    {activeTransaction.status === TrackerStep.CASH_PAID && (
                    <div className="bg-white p-8 rounded-[2rem] text-center text-gray-500 shadow-sm animate-pulse">
                        <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Loader2 className="animate-spin text-slate-900" size={32}/>
                        </div>
                        <p className="text-sm font-bold text-gray-700">{formatName(activeTransaction.supporterName || 'Destekçi')} QR Kodunu Yüklüyor...</p>
                        <p className="text-xs mt-1 text-gray-400">Lütfen bekleyin, bildirim alacaksınız.</p>
                    </div>
                    )}

                    {activeTransaction.status === TrackerStep.QR_UPLOADED && activeTransaction.qrUrl && (
                    <div className="bg-white p-6 rounded-[2rem] shadow-xl border-2 border-slate-900/10 text-center space-y-5 animate-fade-in">
                        <div className="flex justify-between items-center bg-gray-50 p-3 rounded-2xl">
                            <h3 className="font-bold text-gray-800 text-sm">QR Hazır!</h3>
                            <div className={`flex items-center gap-1 font-mono font-bold px-3 py-1.5 rounded-xl ${timeLeft && timeLeft < 60 ? 'bg-red-50 text-red-600 animate-pulse' : 'bg-white text-gray-700 shadow-sm'}`}>
                            <Clock size={16} /> <span className="text-lg">{formatTime(timeLeft || 0)}</span>
                            </div>
                        </div>
                        
                        <div className="relative group">
                            <div className="bg-white p-4 rounded-3xl inline-block border-2 border-dashed border-gray-200 shadow-inner">
                                <img src={activeTransaction.qrUrl} alt="QR" className="w-56 h-56 mix-blend-multiply" />
                            </div>
                            <p className="text-xs text-gray-400 mt-2 font-medium">Bu kodu kasadaki POS cihazına okutun</p>
                        </div>

                        <div className="text-left bg-amber-50 p-4 rounded-2xl text-xs text-amber-800 leading-relaxed border border-amber-100 flex gap-3">
                            <Info size={24} className="shrink-0 text-amber-600" />
                            <div>
                                <strong className="block mb-1 text-amber-900">⚠️ Önemli:</strong>
                                Lütfen QR kodun başarıyla <strong>{activeTransaction.amounts.supportAmount} TL</strong> çektiğinden emin olun.
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3 pt-2">
                            <Button variant="danger" className="text-xs rounded-xl py-3" onClick={handlePaymentFailed}>
                                ❌ Ödeme Başarısız
                            </Button>
                            <Button variant="success" className="text-xs rounded-xl py-3 shadow-lg shadow-green-200" onClick={handlePaymentSuccess}>
                                ✅ Ödeme Başarılı
                            </Button>
                        </div>
                    </div>
                    )}

                    {activeTransaction.status === TrackerStep.COMPLETED && (
                    <div className="text-center py-8 animate-fade-in">
                        <div className="w-24 h-24 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg shadow-emerald-100">
                            <Star size={48} className="text-emerald-500 fill-emerald-500 animate-bounce" />
                        </div>
                        <h2 className="text-2xl font-bold text-gray-800 mb-2">Harikasın! 🎉</h2>
                        <p className="text-gray-600">İşlem başarıyla tamamlandı.</p>
                        
                        <div className="my-6 p-6 bg-white rounded-[2rem] shadow-sm inline-block w-full border border-gray-100 relative overflow-hidden">
                            <p className="text-xs text-gray-500 uppercase tracking-wide font-bold relative z-10">Toplam Tasarruf</p>
                            <p className="text-4xl font-black text-slate-900 mt-2 relative z-10">{activeTransaction.amounts.seekerSavings} TL</p>
                        </div>
                        
                        <div className="space-y-3">
                            <Button fullWidth onClick={handleClearActive} className="rounded-xl py-3.5">Ana Sayfaya Dön</Button>
                        </div>
                    </div>
                    )}

                    {activeTransaction.status !== TrackerStep.COMPLETED && (
                        <div className="mt-8 text-center">
                            <button 
                                onClick={handleCancelTransaction}
                                disabled={loading}
                                className={`text-red-400 text-xs font-bold py-2 px-4 rounded-full hover:bg-red-50 hover:text-red-500 transition-colors ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
                            >
                                {loading ? 'İptal Ediliyor...' : 'İşlemi İptal Et'}
                            </button>
                        </div>
                    )}
                </>
            )}
        </div>
      </div>
    );
  }

  return (
    <div className="pb-24 min-h-screen bg-gray-50 font-sans">
      <div className="bg-slate-900 text-white pt-10 pb-10 px-5 rounded-b-[1.5rem] shadow-sm relative z-20">
         <div className="relative z-30 flex items-center gap-3">
            <button onClick={() => navigate(-1)} className="w-8 h-8 flex items-center justify-center bg-white/10 rounded-full hover:bg-white/20 transition-colors">
                <ChevronLeft size={16} className="text-white" />
            </button>
            <h1 className="text-sm font-bold tracking-wide">Paylaşım Talebi Oluştur</h1>
         </div>
      </div>

      <div className="px-6 -mt-6 relative z-30 space-y-6">
        <div className="bg-white p-6 rounded-[2rem] shadow-sm">
           <div className="space-y-4">
              <div>
                  <label className="text-xs font-bold text-gray-400 ml-1 uppercase">Menü Tutarı (TL)</label>
                  <div className="relative mt-1">
                      <input 
                         type="number" 
                         value={amount}
                         onChange={(e) => setAmount(e.target.value)}
                         className="w-full text-3xl font-black text-slate-800 bg-gray-50 rounded-xl p-4 outline-none focus:ring-2 focus:ring-slate-900/20 transition-all"
                         placeholder="0"
                      />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 font-bold text-gray-400">₺</span>
                  </div>
                  <div className="flex gap-2 mt-2 overflow-x-auto no-scrollbar">
                      {[100, 200, 500, 1000].map(val => (
                          <button 
                            key={val}
                            onClick={() => setAmount(val.toString())}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${amount === val.toString() ? 'bg-slate-800 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                          >
                            {val}₺
                          </button>
                      ))}
                  </div>
              </div>

              <div>
                  <label className="text-xs font-bold text-gray-400 ml-1 uppercase">Açıklama</label>
                  <textarea 
                     value={description}
                     onChange={(e) => setDescription(e.target.value)}
                     className="w-full mt-1 bg-gray-50 rounded-xl p-4 outline-none focus:ring-2 focus:ring-slate-900/20 transition-all text-sm font-medium h-24 resize-none"
                     placeholder="Örn: Burger King menü, Kadıköy şubesi..."
                  />
              </div>

              <div className="bg-blue-50 p-4 rounded-xl flex gap-3 items-start">
                  <Info size={20} className="text-blue-600 shrink-0 mt-0.5" />
                  <p className="text-xs text-blue-800 leading-relaxed">
                     Talep oluşturduğunuzda destekçiler sizi görecektir. Eşleşme sağlandığında bildirim alırsınız.
                  </p>
              </div>

              <Button fullWidth onClick={handleCreateRequest} disabled={creating} className="py-4">
                  {creating ? <Loader2 className="animate-spin" /> : 'Paylaşım Talebi Oluştur'}
              </Button>
           </div>
        </div>
      </div>
    </div>
  );
};
