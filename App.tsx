import React, { useState, useEffect, useRef, Component, ErrorInfo, ReactNode } from 'react';
import { AuctionLot, CalculationParams } from './types';
import { getCompleteVehicleData } from './services/geminiService';
import ProfitCalculator from './components/ProfitCalculator';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell,
  Legend
} from 'recharts';
import { 
  TrendingUp, 
  Car, 
  Gavel, 
  DollarSign, 
  BarChart3, 
  Lock,
  ArrowUpRight,
  Info
} from 'lucide-react';
import { 
  auth, 
  db 
} from './firebase';
import { 
  onAuthStateChanged, 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut,
  User
} from 'firebase/auth';
import { 
  collection, 
  addDoc, 
  onSnapshot, 
  query, 
  where, 
  deleteDoc, 
  doc, 
  serverTimestamp, 
  orderBy,
  getDocFromServer,
  getDoc,
  updateDoc,
  increment,
  setDoc,
  Timestamp
} from 'firebase/firestore';

// --- Error Handling ---
enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// --- Helpers ---
const formatSPTime = (date: Date | Timestamp | null) => {
  if (!date) return 'N/A';
  const d = date instanceof Timestamp ? date.toDate() : date;
  return new Intl.DateTimeFormat('pt-BR', { 
    timeZone: 'America/Sao_Paulo', 
    dateStyle: 'short', 
    timeStyle: 'short' 
  }).format(d);
};

const DEFAULT_PARAMS: CalculationParams = {
  targetProfitMargin: 20,
  resaleDiscountPercentage: 10,
  fixedCosts: 3500,
  auctionFeePercentage: 5
};

const Logo: React.FC<{ className?: string }> = ({ className }) => (
  <div className={`flex flex-col items-center ${className}`}>
    <div className="relative w-24 h-24 mb-2">
      <svg viewBox="0 0 200 200" className="w-full h-full">
        <circle cx="100" cy="100" r="92" fill="none" stroke="#C5A059" strokeWidth="2" />
        <path d="M25 100 A 75 75 0 0 1 175 100" fill="none" stroke="#1B254B" strokeWidth="1.5" strokeDasharray="2 2" />
        <g transform="translate(0, -10)">
          <path d="M100 50 V85" stroke="#1B254B" strokeWidth="5" strokeLinecap="round" />
          <path d="M75 65 L125 65" stroke="#1B254B" strokeWidth="4" strokeLinecap="round" />
          <path d="M75 65 L65 95 M75 65 L85 95" stroke="#C5A059" strokeWidth="2" />
          <path d="M60 95 L90 95 Q75 115 60 95" fill="#C5A059" />
          <text x="75" y="105" fontSize="14" textAnchor="middle" fill="#1B254B" fontWeight="900" fontFamily="Montserrat">%</text>
          <path d="M125 65 L115 95 M125 65 L135 95" stroke="#C5A059" strokeWidth="2" />
          <path d="M110 95 L140 95 Q125 115 110 95" fill="#C5A059" />
          <text x="125" y="105" fontSize="14" textAnchor="middle" fill="#1B254B" fontWeight="900" fontFamily="Montserrat">$</text>
        </g>
        <rect x="50" y="130" width="8" height="25" fill="#1B254B" rx="1" />
        <rect x="62" y="120" width="8" height="35" fill="#1B254B" rx="1" />
        <rect x="74" y="115" width="8" height="40" fill="#1B254B" rx="1" />
        <rect x="118" y="125" width="8" height="30" fill="#1B254B" rx="1" />
        <rect x="130" y="110" width="8" height="45" fill="#1B254B" rx="1" />
        <rect x="142" y="120" width="8" height="35" fill="#1B254B" rx="1" />
        <path d="M55 155 C 80 140, 110 130, 155 105" fill="none" stroke="#C5A059" strokeWidth="4" strokeLinecap="round" />
        <path d="M150 105 L160 100 L158 112 Z" fill="#C5A059" />
        <g transform="rotate(-35 100 135)">
          <rect x="94" y="145" width="12" height="60" rx="4" fill="#1B254B" />
          <rect x="75" y="110" width="50" height="35" rx="6" fill="#1B254B" />
          <rect x="75" y="122" width="50" height="4" fill="#C5A059" opacity="0.8" />
        </g>
      </svg>
    </div>
    <div className="text-center">
      <h1 className="font-black text-3xl tracking-tighter leading-none text-[#1B254B] mb-1">ACERTE O LANCE</h1>
      <div className="flex items-center justify-center gap-3">
        <div className="h-[2px] w-8 bg-[#C5A059]"></div>
        <p className="text-[11px] font-bold text-[#C5A059] uppercase tracking-[0.2em]">Leilões Inteligentes</p>
        <div className="h-[2px] w-8 bg-[#C5A059]"></div>
      </div>
      <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.4em] mt-2">DESDE 2026</p>
    </div>
  </div>
);

const AppContent: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'analysis' | 'patio' | 'plans' | 'reports'>('analysis');
  
  const [lots, setLots] = useState<AuctionLot[]>([]);
  const [patioVehicles, setPatioVehicles] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshingId, setRefreshingId] = useState<string | null>(null);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [inputUrl, setInputUrl] = useState('');
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  // --- Auth Setup ---
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        // Ensure profile exists
        const userRef = doc(db, 'users', u.uid);
        const userSnap = await getDoc(userRef);
        if (!userSnap.exists()) {
          try {
            await setDoc(userRef, {
              name: u.displayName || 'Usuário',
              email: u.email,
              role: 'client',
              subscription: {
                plan: 'free',
                limit: 2
              },
              usage: {
                analysisCount: 0,
                lastReset: serverTimestamp()
              },
              createdAt: serverTimestamp()
            });
          } catch (err) {
            console.error("Erro ao criar perfil:", err);
          }
        }
      }
      setIsAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

  // --- User Profile Listener ---
  useEffect(() => {
    if (user) {
      const unsubscribe = onSnapshot(doc(db, 'users', user.uid), (doc) => {
        if (doc.exists()) {
          setUserProfile(doc.data());
        }
      });
      return () => unsubscribe();
    } else {
      setUserProfile(null);
    }
  }, [user]);

  // --- Connection Test ---
  useEffect(() => {
    async function testConnection() {
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
      } catch (error) {
        if(error instanceof Error && error.message.includes('the client is offline')) {
          console.error("Please check your Firebase configuration.");
        }
      }
    }
    testConnection();
  }, []);

  // --- Firestore Listeners ---
  useEffect(() => {
    if (isAuthReady && user && (activeTab === 'patio' || activeTab === 'reports')) {
      const q = query(
        collection(db, 'vehicles'), 
        where('authorUid', '==', user.uid),
        orderBy('createdAt', 'desc')
      );

      const unsubscribe = onSnapshot(q, (snapshot) => {
        const vehicles = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setPatioVehicles(vehicles);
      }, (error) => {
        handleFirestoreError(error, OperationType.LIST, 'vehicles');
      });

      return () => unsubscribe();
    }
  }, [isAuthReady, user, activeTab]);

  const handleLogin = async () => {
    if (loginLoading) return;
    
    setLoginLoading(true);
    setGlobalError(null);
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (err: any) {
      console.error("Erro ao fazer login:", err);
      if (err.code === 'auth/cancelled-popup-request') {
        // Ignore this error as it just means a previous request was cancelled
        return;
      }
      if (err.code === 'auth/popup-closed-by-user') {
        setGlobalError("A janela de login foi fechada.");
      } else {
        setGlobalError("Falha ao entrar com Google. Tente novamente.");
      }
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLogout = () => {
    signOut(auth);
    setActiveTab('analysis');
  };

  const toggleExpand = (id: string) => {
    const newExpanded = new Set(expandedIds);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedIds(newExpanded);
  };

  const handleCheckout = async (priceId: string) => {
    if (!user) {
      handleLogin();
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          priceId,
          customerEmail: user.email,
        }),
      });

      const session = await response.json();
      if (session.url) {
        window.location.href = session.url;
      } else {
        throw new Error(session.error || 'Erro ao criar sessão de checkout');
      }
    } catch (error: any) {
      setGlobalError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const getCalculatedValues = (fipe: number, params: CalculationParams) => {
    const resaleValue = fipe * (1 - (params.resaleDiscountPercentage || 0) / 100);
    const marginMultiplier = (100 - params.targetProfitMargin) / 100;
    
    const maxBid = (resaleValue * marginMultiplier - params.fixedCosts) / (1 + params.auctionFeePercentage / 100);
    const recommendedBid = Math.max(0, maxBid);
    const totalInvestment = recommendedBid * (1 + params.auctionFeePercentage / 100) + params.fixedCosts;
    const projectedProfit = resaleValue - totalInvestment;
    
    return { recommendedBid, projectedProfit };
  };

  const handleSaveToPatio = async (lot: AuctionLot) => {
    if (!user) return;
    const { recommendedBid } = getCalculatedValues(lot.fipeValue, lot.params);
    
    try {
      await addDoc(collection(db, 'vehicles'), {
        brand: lot.brand,
        model: lot.model,
        year: lot.year,
        fipeValue: lot.fipeValue,
        auctionValue: recommendedBid,
        margin: lot.params.targetProfitMargin,
        authorUid: user.uid,
        createdAt: serverTimestamp(),
        details: {
          km: lot.km,
          auctionDate: lot.auctionDate,
          lotId: lot.lotId,
          auctionSummary: lot.auctionSummary,
          pointsOfAttention: lot.pointsOfAttention,
          url: lot.url,
          sourceSite: lot.sourceSite
        }
      });
      alert("Veículo salvo no seu pátio!");
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'vehicles');
    }
  };

  const handleRefreshLot = async (id: string) => {
    const lot = lots.find(l => l.id === id);
    if (!lot || !user || !userProfile) return;
    
    // Check limits
    if (userProfile.usage.analysisCount >= userProfile.subscription.limit) {
      setGlobalError(`Limite de análises atingido (${userProfile.subscription.limit}/${userProfile.subscription.limit}). Faça upgrade para continuar.`);
      setActiveTab('plans');
      return;
    }

    setRefreshingId(id);
    setGlobalError(null);

    try {
      const data = await getCompleteVehicleData(lot.url);
      
      // Increment usage
      await updateDoc(doc(db, 'users', user.uid), {
        'usage.analysisCount': increment(1)
      });

      setLots(prev => prev.map(l => l.id === id ? {
        ...l,
        fipeValue: data.fipeValue || l.fipeValue,
        auctionDate: data.auctionDate || l.auctionDate,
        patio: data.patio || l.patio,
        auctionSummary: data.auctionSummary || l.auctionSummary,
        pointsOfAttention: data.pointsOfAttention || l.pointsOfAttention,
        lastUpdated: formatSPTime(new Date())
      } : l));
    } catch (error: any) {
      if (error.message === "QUOTA_EXCEEDED") {
        setGlobalError("Limite de requisições excedido. Tente novamente em alguns minutos.");
      } else if (error.message === "API_KEY_MISSING") {
        setGlobalError("Chave de API não encontrada.");
      } else {
        console.error("Erro ao atualizar lote:", error);
      }
    } finally {
      setRefreshingId(null);
    }
  };

  const handleAddLot = async () => {
    if (!inputUrl || !user || !userProfile) return;

    // Check limits
    if (userProfile.usage.analysisCount >= userProfile.subscription.limit) {
      setGlobalError(`Limite de análises atingido (${userProfile.subscription.limit}/${userProfile.subscription.limit}). Faça upgrade para continuar.`);
      setActiveTab('plans');
      return;
    }

    setLoading(true);
    setGlobalError(null);

    try {
      const data = await getCompleteVehicleData(inputUrl);

      // Increment usage
      await updateDoc(doc(db, 'users', user.uid), {
        'usage.analysisCount': increment(1)
      });

      const newLot: AuctionLot = {
        id: crypto.randomUUID(),
        url: inputUrl,
        brand: data.brand || 'Marca',
        model: data.model || 'Modelo',
        year: data.year || 'N/A',
        km: data.km || 0,
        fipeValue: data.fipeValue || 0,
        patio: data.patio || 'Não identificado',
        description: data.description || '',
        auctionDate: data.auctionDate || 'A definir',
        lotId: data.lotId || 'N/A',
        auctionSummary: data.auctionSummary || '',
        pointsOfAttention: data.pointsOfAttention || [],
        status: 'watching',
        params: { ...DEFAULT_PARAMS },
        lastUpdated: formatSPTime(new Date()),
        sourceSite: data.sourceSite || 'Leilão',
        groundingSources: (data as any).searchSources
      };

      setLots(prev => [newLot, ...prev]);
      setExpandedIds(prev => new Set(prev).add(newLot.id));
      setInputUrl('');
    } catch (error: any) {
      if (error.message === "QUOTA_EXCEEDED") {
        setGlobalError("Muitas requisições. O Google limitou o acesso temporariamente. Aguarde 1 minuto e tente novamente.");
      } else if (error.message === "API_KEY_MISSING") {
        setGlobalError("Chave de API não encontrada. Por favor, selecione uma chave nas configurações (ícone de engrenagem) ou use o botão abaixo.");
      } else {
        setGlobalError(error.message || "Erro desconhecido ao analisar o lote.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleOpenKeySelection = async () => {
    if (window.aistudio?.openSelectKey) {
      await window.aistudio.openSelectKey();
      setGlobalError(null);
    }
  };

  const updateLotParams = (id: string, newParams: CalculationParams) => {
    setLots(prev => prev.map(l => l.id === id ? { ...l, params: newParams } : l));
  };

  const removeLot = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setLots(prev => prev.filter(l => l.id !== id));
  };

  const removePatioVehicle = async (id: string) => {
    if (!user) return;
    try {
      await deleteDoc(doc(db, 'vehicles', id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `vehicles/${id}`);
    }
  };

  if (!isAuthReady) {
    return (
      <div className="min-h-screen bg-[#fcfcfc] flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-brand-gold border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[#fcfcfc] flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-[2.5rem] p-10 shadow-2xl border border-slate-100">
          <Logo className="mb-8" />
          <h2 className="text-2xl font-black text-brand-navy text-center mb-2">Bem-vindo ao Acerte o Lance</h2>
          <p className="text-slate-400 text-center text-sm mb-8">Acesse sua plataforma de inteligência para leilões</p>
          
          <button 
            onClick={handleLogin}
            disabled={loginLoading}
            className={`w-full flex items-center justify-center gap-4 bg-white border-2 border-slate-100 text-brand-navy py-5 rounded-2xl font-black uppercase tracking-widest transition-all shadow-lg active:scale-95 ${loginLoading ? 'opacity-50 cursor-not-allowed' : 'hover:bg-slate-50'}`}
          >
            {loginLoading ? (
              <div className="w-6 h-6 border-2 border-brand-gold border-t-transparent rounded-full animate-spin"></div>
            ) : (
              <svg className="w-6 h-6" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
            )}
            {loginLoading ? 'Conectando...' : 'Entrar com Google'}
          </button>
          
          {globalError && <p className="mt-4 text-red-500 text-xs font-bold text-center">{globalError}</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#fcfcfc] text-brand-navy font-sans">
      <nav className="bg-white border-b border-slate-100 h-32 sticky top-0 z-50 px-6 flex items-center justify-between shadow-sm">
        <Logo className="scale-[0.6] sm:scale-75 origin-left" />
        
        <div className="hidden md:flex items-center gap-8">
          <button 
            onClick={() => setActiveTab('analysis')}
            className={`text-[10px] font-black uppercase tracking-[0.2em] transition-all ${activeTab === 'analysis' ? 'text-brand-navy border-b-2 border-brand-gold pb-1' : 'text-slate-400 hover:text-brand-navy'}`}
          >
            Análise de Lotes
          </button>
          <button 
            onClick={() => setActiveTab('patio')}
            className={`text-[10px] font-black uppercase tracking-[0.2em] transition-all ${activeTab === 'patio' ? 'text-brand-navy border-b-2 border-brand-gold pb-1' : 'text-slate-400 hover:text-brand-navy'}`}
          >
            Meu Pátio
          </button>
          <button 
            onClick={() => setActiveTab('reports')}
            className={`text-[10px] font-black uppercase tracking-[0.2em] transition-all ${activeTab === 'reports' ? 'text-brand-navy border-b-2 border-brand-gold pb-1' : 'text-slate-400 hover:text-brand-navy'}`}
          >
            Relatórios
          </button>
          <button 
            onClick={() => setActiveTab('plans')}
            className={`text-[10px] font-black uppercase tracking-[0.2em] transition-all ${activeTab === 'plans' ? 'text-brand-navy border-b-2 border-brand-gold pb-1' : 'text-slate-400 hover:text-brand-navy'}`}
          >
            Planos
          </button>
        </div>

        <div className="flex items-center gap-6">
          <div className="hidden sm:flex flex-col items-end gap-1">
            <p className="text-[10px] font-black text-brand-navy uppercase tracking-widest">{user.email}</p>
            <button onClick={handleLogout} className="text-[9px] font-bold text-red-400 uppercase hover:text-red-600">Sair</button>
          </div>
          <button 
            onClick={handleOpenKeySelection}
            className="text-[9px] font-bold text-brand-gold uppercase border border-brand-gold/30 px-3 py-1.5 rounded-full hover:bg-brand-gold hover:text-white transition-all"
          >
            API Key
          </button>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {activeTab === 'analysis' ? (
          <>
            {userProfile && (
              <div className="mb-6 flex items-center justify-between bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 bg-brand-gold rounded-full animate-pulse"></div>
                  <p className="text-[10px] font-black text-brand-navy uppercase tracking-widest">
                    Plano {userProfile.subscription.plan} • {userProfile.usage.analysisCount}/{userProfile.subscription.limit} análises usadas
                  </p>
                </div>
                <button 
                  onClick={() => setActiveTab('plans')}
                  className="text-[9px] font-bold text-brand-gold uppercase hover:underline"
                >
                  Fazer Upgrade
                </button>
              </div>
            )}
            {globalError && (
              <div className="mb-8 bg-red-50 border-l-4 border-red-500 p-6 rounded-2xl flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-red-500 rounded-full flex items-center justify-center text-white shrink-0">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
                  </div>
                  <p className="text-sm font-bold text-red-800">{globalError}</p>
                </div>
                <button onClick={() => setGlobalError(null)} className="text-red-300 hover:text-red-500">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12"/></svg>
                </button>
              </div>
            )}

            <section className="mb-12 text-center">
               <div className="inline-block p-1 px-4 bg-brand-navy rounded-full mb-6">
                  <p className="text-[10px] font-black text-brand-gold uppercase tracking-[0.3em]">Inteligência para Revendedores</p>
               </div>
               <h2 className="text-4xl md:text-5xl font-black text-brand-navy mb-4 tracking-tight leading-tight">Otimizando sua <span className="text-brand-gold">Margem de Lucro</span></h2>
               <p className="max-w-2xl mx-auto text-slate-400 font-medium text-lg leading-relaxed">
                 Extraia dados técnicos e valores de mercado automaticamente de sites como <span className="text-brand-navy font-bold">Milan, Freitas, Sodré e Copart</span>.
               </p>
            </section>

            <section className="bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-2xl shadow-brand-navy/[0.03] mb-12">
              <div className="flex flex-col md:flex-row gap-4">
                <input
                  type="text"
                  value={inputUrl}
                  onChange={(e) => setInputUrl(e.target.value)}
                  placeholder="Cole o link do lote (ex: Freitas)..."
                  className="flex-1 bg-slate-50 border border-slate-100 rounded-[1.5rem] px-8 py-5 text-sm outline-none focus:ring-2 focus:ring-brand-gold/50 transition-all"
                />
                <button
                  onClick={handleAddLot}
                  disabled={loading || !inputUrl}
                  className="bg-brand-navy hover:bg-slate-800 disabled:bg-slate-200 text-white px-12 py-5 rounded-[1.5rem] font-black uppercase tracking-[0.1em] transition-all shadow-xl active:scale-95 flex items-center justify-center min-w-[200px]"
                >
                  {loading ? "Capturando..." : "Analisar Lote"}
                </button>
              </div>
            </section>

            <div className="space-y-6">
              {lots.map((lot) => {
                const isExpanded = expandedIds.has(lot.id);
                const { recommendedBid } = getCalculatedValues(lot.fipeValue, lot.params);
                
                return (
                  <div key={lot.id} className="bg-white rounded-[2.5rem] border-2 border-slate-100 overflow-hidden transition-all duration-500 hover:shadow-lg relative">
                    <div 
                      className={`p-6 sm:p-8 flex flex-col xl:flex-row items-center gap-6 cursor-pointer ${isExpanded ? 'border-b border-slate-50' : ''}`}
                      onClick={() => toggleExpand(lot.id)}
                    >
                      <div className="flex-1 w-full">
                         <div className="flex items-center gap-3 mb-2">
                            <span className="text-[10px] font-black px-3 py-1 rounded-lg uppercase tracking-wider bg-slate-100 text-slate-400">
                               {lot.sourceSite || 'LOTE'}
                            </span>
                            <span className="text-[10px] font-black text-slate-200 uppercase tracking-widest">#{lot.lotId}</span>
                         </div>
                         <h3 className="text-2xl font-black text-brand-navy leading-tight">{lot.model} <span className="text-brand-gold">{lot.year}</span></h3>
                         <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-2">{lot.km.toLocaleString()} KM</p>
                      </div>

                      <div className="flex flex-wrap items-center justify-end gap-6 w-full xl:w-auto">
                         <div className="text-right">
                            <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest mb-1">Tabela FIPE</p>
                            <p className="text-xl font-black text-brand-navy">R$ {lot.fipeValue.toLocaleString('pt-BR')}</p>
                         </div>
                         <div className="text-right bg-brand-navy px-6 py-3 rounded-2xl">
                            <p className="text-[10px] font-bold text-brand-gold uppercase tracking-widest mb-1">Lance Máx. Sugerido</p>
                            <p className="text-lg font-black text-white">R$ {recommendedBid.toLocaleString('pt-BR')}</p>
                         </div>
                         
                         <div className="flex items-center gap-3 pl-4 border-l border-slate-100">
                            <button 
                              onClick={(e) => { e.stopPropagation(); handleRefreshLot(lot.id); }}
                              disabled={refreshingId === lot.id}
                              className={`p-3 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-400 ${refreshingId === lot.id ? 'animate-spin' : ''}`}
                            >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
                            </button>
                            <div className={`transition-transform duration-500 text-slate-200 ${isExpanded ? 'rotate-180 text-brand-gold' : ''}`}>
                              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M19 9l-7 7-7-7"/></svg>
                            </div>
                         </div>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="p-8 sm:p-12 bg-slate-50/30">
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                          <ProfitCalculator fipeValue={lot.fipeValue} params={lot.params} onChange={(p) => updateLotParams(lot.id, p)} />
                          <div className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm space-y-6">
                            <div className="flex items-center justify-between border-b pb-4">
                               <h4 className="font-black text-brand-navy text-[10px] uppercase tracking-[0.3em]">Análise do Lote</h4>
                               <div className="flex gap-4">
                                 <button onClick={() => handleSaveToPatio(lot)} className="text-[10px] font-black text-brand-gold hover:text-brand-navy uppercase tracking-widest">Salvar no Pátio</button>
                                 <button onClick={(e) => removeLot(lot.id, e)} className="text-[10px] font-black text-red-300 hover:text-red-500 uppercase tracking-widest">Remover</button>
                               </div>
                            </div>
                            
                            <div className="space-y-4">
                              {lot.patio && (
                                <div className="bg-brand-navy/5 p-6 rounded-3xl border border-brand-navy/10">
                                   <p className="text-[10px] font-black text-brand-navy/40 uppercase tracking-widest mb-3">Pátio / Localização</p>
                                   <p className="text-sm font-black text-brand-navy leading-relaxed">{lot.patio}</p>
                                </div>
                              )}

                              <div className="bg-slate-50/50 p-6 rounded-3xl">
                                 <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest mb-3">Resumo das Condições</p>
                                 <p className="text-xs text-slate-500 leading-relaxed">{lot.auctionSummary || 'Analizando condições...'}</p>
                              </div>

                              {lot.pointsOfAttention && lot.pointsOfAttention.length > 0 && (
                                <div className="bg-orange-50/50 p-6 rounded-3xl border border-orange-100">
                                   <p className="text-[10px] font-black text-orange-400 uppercase tracking-widest mb-3">Pontos de Atenção</p>
                                   <ul className="space-y-2">
                                     {lot.pointsOfAttention.map((point, idx) => (
                                       <li key={idx} className="text-xs text-orange-800 flex items-start gap-2">
                                         <span className="mt-1 w-1.5 h-1.5 bg-orange-400 rounded-full shrink-0"></span>
                                         {point}
                                       </li>
                                     ))}
                                   </ul>
                                </div>
                              )}
                            </div>
                            
                            <a href={lot.url} target="_blank" rel="noreferrer" className="block text-center bg-brand-navy text-white py-5 rounded-[1.5rem] font-black text-[10px] uppercase tracking-widest hover:opacity-90">Visualizar Lote Original</a>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        ) : activeTab === 'patio' ? (
          <div className="space-y-8">
            <div className="text-center mb-12">
               <h2 className="text-4xl font-black text-brand-navy mb-4">Meu Pátio de Veículos</h2>
               <p className="text-slate-400 font-medium">Histórico de veículos analisados e salvos para acompanhamento.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {patioVehicles.length === 0 ? (
                <div className="col-span-full py-20 text-center bg-white rounded-[2.5rem] border-2 border-dashed border-slate-200">
                  <p className="text-slate-300 font-black uppercase tracking-widest">Seu pátio está vazio</p>
                  <button onClick={() => setActiveTab('analysis')} className="mt-4 text-brand-gold font-bold hover:underline">Começar Análise</button>
                </div>
              ) : (
                patioVehicles.map((v) => {
                  const details = v.details || {};
                  return (
                    <div key={v.id} className="bg-white rounded-[2rem] p-8 border border-slate-100 shadow-sm hover:shadow-md transition-all group">
                      <div className="flex justify-between items-start mb-6">
                        <div>
                          <h3 className="text-xl font-black text-brand-navy">{v.model}</h3>
                          <p className="text-sm font-bold text-brand-gold">{v.brand} • {v.year}</p>
                        </div>
                        <button onClick={() => removePatioVehicle(v.id)} className="text-slate-200 hover:text-red-400 transition-colors">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                        </button>
                      </div>

                      <div className="space-y-4 mb-6">
                        <div className="flex justify-between text-xs">
                          <span className="text-slate-400 font-bold uppercase tracking-widest">FIPE</span>
                          <span className="text-brand-navy font-black">R$ {v.fipeValue.toLocaleString('pt-BR')}</span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-slate-400 font-bold uppercase tracking-widest">Lance Máx.</span>
                          <span className="text-brand-navy font-black">R$ {v.auctionValue.toLocaleString('pt-BR')}</span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-slate-400 font-bold uppercase tracking-widest">Margem Alvo</span>
                          <span className="text-brand-gold font-black">{v.margin}%</span>
                        </div>
                      </div>

                      <div className="pt-6 border-t border-slate-50">
                        <p className="text-[10px] text-slate-300 font-bold uppercase tracking-widest mb-2">Salvo em (SP)</p>
                        <p className="text-[11px] text-slate-500 font-bold mb-3">{formatSPTime(v.createdAt)}</p>
                        <p className="text-[10px] text-slate-300 font-bold uppercase tracking-widest mb-2">Resumo</p>
                        <p className="text-[11px] text-slate-500 line-clamp-3 leading-relaxed">{details.auctionSummary || 'Sem resumo disponível.'}</p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        ) : activeTab === 'reports' ? (
          <div className="space-y-12">
            <div className="text-center max-w-3xl mx-auto">
              <h2 className="text-4xl font-black text-brand-navy mb-4">Relatórios Inteligentes</h2>
              <p className="text-slate-400 font-medium text-lg">
                Visão detalhada do seu desempenho e tendências do mercado de leilões.
              </p>
            </div>

            {userProfile?.subscription.plan === 'free' ? (
              <div className="bg-white rounded-[2.5rem] p-16 border-2 border-slate-100 text-center shadow-2xl shadow-brand-navy/5">
                <div className="w-20 h-20 bg-brand-gold/10 rounded-full flex items-center justify-center mx-auto mb-8">
                  <Lock className="w-10 h-10 text-brand-gold" />
                </div>
                <h3 className="text-2xl font-black text-brand-navy mb-4 uppercase tracking-widest">Acesso Restrito</h3>
                <p className="text-slate-400 max-w-md mx-auto mb-10 font-medium">
                  Os relatórios inteligentes estão disponíveis apenas para assinantes dos planos <span className="text-brand-navy font-bold">Starter</span> e <span className="text-brand-navy font-bold">Pro</span>.
                </p>
                <button 
                  onClick={() => setActiveTab('plans')}
                  className="bg-brand-gold text-white px-12 py-5 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-brand-gold/90 transition-all shadow-lg shadow-brand-gold/20 active:scale-95"
                >
                  Fazer Upgrade Agora
                </button>
              </div>
            ) : (
              <div className="space-y-12">
                {/* Stats Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  {[
                    { label: 'Total Pesquisado', value: patioVehicles.length, icon: Car, color: 'text-blue-500', bg: 'bg-blue-50' },
                    { label: 'Média de Margem', value: `${(patioVehicles.reduce((acc, v) => acc + (v.margin || 0), 0) / (patioVehicles.length || 1)).toFixed(1)}%`, icon: TrendingUp, color: 'text-emerald-500', bg: 'bg-emerald-50' },
                    { label: 'Leilões Ativos', value: new Set(patioVehicles.map(v => v.details?.sourceSite)).size, icon: Gavel, color: 'text-brand-gold', bg: 'bg-brand-gold/10' },
                    { label: 'Investimento Médio', value: `R$ ${(patioVehicles.reduce((acc, v) => acc + (v.auctionValue || 0), 0) / (patioVehicles.length || 1)).toLocaleString('pt-BR', { maximumFractionDigits: 0 })}`, icon: DollarSign, color: 'text-brand-navy', bg: 'bg-slate-100' },
                  ].map((stat, i) => (
                    <div key={i} className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm">
                      <div className={`w-12 h-12 ${stat.bg} ${stat.color} rounded-2xl flex items-center justify-center mb-6`}>
                        <stat.icon className="w-6 h-6" />
                      </div>
                      <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.2em] mb-2">{stat.label}</p>
                      <p className="text-2xl font-black text-brand-navy">{stat.value}</p>
                    </div>
                  ))}
                </div>

                {/* Charts Section */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {/* Brand Distribution */}
                  <div className="bg-white p-10 rounded-[2.5rem] border border-slate-100 shadow-sm">
                    <div className="flex items-center justify-between mb-10">
                      <h4 className="text-xs font-black text-brand-navy uppercase tracking-widest">Volume por Marca</h4>
                      <BarChart3 className="w-5 h-5 text-slate-200" />
                    </div>
                    <div className="h-[300px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={
                          Object.entries(
                            patioVehicles.reduce((acc: any, v) => {
                              acc[v.brand] = (acc[v.brand] || 0) + 1;
                              return acc;
                            }, {})
                          ).map(([name, value]) => ({ name, value }))
                        }>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                          <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }} />
                          <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }} />
                          <Tooltip 
                            contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', padding: '12px' }}
                            itemStyle={{ fontSize: '12px', fontWeight: 800, color: '#1B254B' }}
                          />
                          <Bar dataKey="value" fill="#C5A059" radius={[6, 6, 0, 0]} barSize={40} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Auction Site Distribution */}
                  <div className="bg-white p-10 rounded-[2.5rem] border border-slate-100 shadow-sm">
                    <div className="flex items-center justify-between mb-10">
                      <h4 className="text-xs font-black text-brand-navy uppercase tracking-widest">Distribuição por Leilão</h4>
                      <Gavel className="w-5 h-5 text-slate-200" />
                    </div>
                    <div className="h-[300px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={
                              Object.entries(
                                patioVehicles.reduce((acc: any, v) => {
                                  const site = v.details?.sourceSite || 'Outros';
                                  acc[site] = (acc[site] || 0) + 1;
                                  return acc;
                                }, {})
                              ).map(([name, value]) => ({ name, value }))
                            }
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={100}
                            paddingAngle={5}
                            dataKey="value"
                          >
                            {['#1B254B', '#C5A059', '#64748b', '#94a3b8'].map((color, index) => (
                              <Cell key={`cell-${index}`} fill={color} />
                            ))}
                          </Pie>
                          <Tooltip 
                            contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', padding: '12px' }}
                          />
                          <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em' }} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>

                {/* Intelligent Insights */}
                <div className="bg-brand-navy rounded-[2.5rem] p-12 text-white relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-64 h-64 bg-brand-gold/10 rounded-full blur-3xl -mr-32 -mt-32"></div>
                  <div className="relative z-10">
                    <div className="flex items-center gap-4 mb-8">
                      <div className="w-12 h-12 bg-brand-gold rounded-2xl flex items-center justify-center">
                        <TrendingUp className="w-6 h-6 text-brand-navy" />
                      </div>
                      <div>
                        <h4 className="text-xl font-black uppercase tracking-widest">Insights Estratégicos</h4>
                        <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">Análise de Margem e Oportunidades</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                      <div>
                        <p className="text-[10px] font-black text-brand-gold uppercase tracking-[0.2em] mb-6">Melhores Margens por Marca</p>
                        <div className="space-y-6">
                          {Object.entries(
                            patioVehicles.reduce((acc: any, v) => {
                              if (!acc[v.brand]) acc[v.brand] = { sum: 0, count: 0 };
                              acc[v.brand].sum += (v.margin || 0);
                              acc[v.brand].count += 1;
                              return acc;
                            }, {})
                          )
                          .map(([name, data]: [string, any]) => ({ name, avg: data.sum / data.count }))
                          .sort((a, b) => b.avg - a.avg)
                          .slice(0, 3)
                          .map((item, i) => (
                            <div key={i} className="flex items-center justify-between group">
                              <div className="flex items-center gap-4">
                                <span className="text-2xl font-black text-slate-700 group-hover:text-brand-gold transition-colors">0{i+1}</span>
                                <span className="font-black uppercase tracking-widest text-sm">{item.name}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-lg font-black">{item.avg.toFixed(1)}%</span>
                                <ArrowUpRight className="w-4 h-4 text-emerald-400" />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="bg-white/5 rounded-3xl p-8 border border-white/10">
                        <div className="flex items-center gap-3 mb-6">
                          <Info className="w-5 h-5 text-brand-gold" />
                          <p className="text-[10px] font-black uppercase tracking-widest">Recomendação da IA</p>
                        </div>
                        <p className="text-sm text-slate-300 leading-relaxed font-medium">
                          {patioVehicles.length > 0 ? (
                            `Com base nas suas ${patioVehicles.length} análises, a marca ${
                              Object.entries(
                                patioVehicles.reduce((acc: any, v) => {
                                  if (!acc[v.brand]) acc[v.brand] = { sum: 0, count: 0 };
                                  acc[v.brand].sum += (v.margin || 0);
                                  acc[v.brand].count += 1;
                                  return acc;
                                }, {})
                              )
                              .map(([name, data]: [string, any]) => ({ name, avg: data.sum / data.count }))
                              .sort((a, b) => b.avg - a.avg)[0]?.name
                            } está apresentando as melhores oportunidades de lucro. Considere focar suas próximas buscas em leilões que possuam maior volume desta marca para maximizar seu ROI.`
                          ) : (
                            "Comece a salvar veículos no seu pátio para que nossa IA possa gerar recomendações estratégicas personalizadas para o seu perfil de revendedor."
                          )}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Detailed Table */}
                <div className="bg-white rounded-[2.5rem] border border-slate-100 overflow-hidden shadow-sm">
                  <div className="p-8 border-b border-slate-50 flex items-center justify-between">
                    <h4 className="text-xs font-black text-brand-navy uppercase tracking-widest">Detalhamento de Pesquisas</h4>
                    <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">{patioVehicles.length} Veículos</span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="bg-slate-50/50">
                          <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Veículo</th>
                          <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Leilão</th>
                          <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">FIPE</th>
                          <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Lance Máx.</th>
                          <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Margem</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {patioVehicles.map((v, i) => (
                          <tr key={i} className="hover:bg-slate-50/30 transition-colors group">
                            <td className="px-8 py-6">
                              <p className="text-sm font-black text-brand-navy group-hover:text-brand-gold transition-colors">{v.model}</p>
                              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{v.brand} • {v.year}</p>
                            </td>
                            <td className="px-8 py-6">
                              <span className="text-[10px] font-black px-3 py-1 bg-slate-100 rounded-lg text-slate-500 uppercase tracking-widest">
                                {v.details?.sourceSite || 'N/A'}
                              </span>
                            </td>
                            <td className="px-8 py-6 text-right">
                              <p className="text-sm font-black text-brand-navy">R$ {v.fipeValue.toLocaleString('pt-BR')}</p>
                            </td>
                            <td className="px-8 py-6 text-right">
                              <p className="text-sm font-black text-brand-navy">R$ {v.auctionValue.toLocaleString('pt-BR')}</p>
                            </td>
                            <td className="px-8 py-6 text-right">
                              <span className="text-sm font-black text-emerald-500">{v.margin}%</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-12">
            <div className="text-center max-w-3xl mx-auto">
              <h2 className="text-4xl font-black text-brand-navy mb-4">Escolha o Plano Ideal</h2>
              <p className="text-slate-400 font-medium text-lg">
                Potencialize suas análises com inteligência artificial e tome decisões mais lucrativas em seus leilões.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {/* Free Plan */}
              <div className="bg-white rounded-[2.5rem] p-10 border border-slate-100 shadow-sm flex flex-col">
                <h3 className="text-xl font-black text-brand-navy mb-2">Free</h3>
                <p className="text-slate-400 text-sm mb-6">Para quem está começando.</p>
                <div className="text-4xl font-black text-brand-navy mb-8">R$ 0<span className="text-sm font-medium text-slate-400">/mês</span></div>
                <ul className="space-y-4 mb-10 flex-1">
                  <li className="flex items-center gap-3 text-sm font-medium text-slate-600">
                    <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7"/></svg>
                    2 análises por mês
                  </li>
                  <li className="flex items-center gap-3 text-sm font-medium text-slate-600">
                    <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7"/></svg>
                    Acesso ao Pátio
                  </li>
                </ul>
                <button disabled className="w-full py-4 rounded-2xl font-black uppercase tracking-widest text-xs bg-slate-100 text-slate-400 cursor-not-allowed">Plano Atual</button>
              </div>

              {/* Starter Plan */}
              <div className="bg-white rounded-[2.5rem] p-10 border-2 border-brand-gold shadow-xl flex flex-col relative overflow-hidden">
                <div className="absolute top-0 right-0 bg-brand-gold text-white px-6 py-2 rounded-bl-2xl font-black text-[10px] uppercase tracking-widest">Popular</div>
                <h3 className="text-xl font-black text-brand-navy mb-2">Starter</h3>
                <p className="text-slate-400 text-sm mb-6">Para revendedores ativos.</p>
                <div className="text-4xl font-black text-brand-navy mb-8">R$ 97<span className="text-sm font-medium text-slate-400">/mês</span></div>
                <ul className="space-y-4 mb-10 flex-1">
                  <li className="flex items-center gap-3 text-sm font-medium text-slate-600">
                    <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7"/></svg>
                    50 análises por mês
                  </li>
                  <li className="flex items-center gap-3 text-sm font-medium text-slate-600">
                    <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7"/></svg>
                    Relatórios Básicos
                  </li>
                  <li className="flex items-center gap-3 text-sm font-medium text-slate-600">
                    <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7"/></svg>
                    Suporte Prioritário
                  </li>
                </ul>
                <button 
                  onClick={() => handleCheckout('price_starter_id')}
                  className="w-full py-4 rounded-2xl font-black uppercase tracking-widest text-xs bg-brand-gold text-white hover:bg-brand-gold/90 transition-all shadow-lg shadow-brand-gold/20 active:scale-95"
                >
                  Assinar Agora
                </button>
              </div>

              {/* Pro Plan */}
              <div className="bg-white rounded-[2.5rem] p-10 border border-slate-100 shadow-sm flex flex-col">
                <h3 className="text-xl font-black text-brand-navy mb-2">Pro</h3>
                <p className="text-slate-400 text-sm mb-6">Para grandes pátios.</p>
                <div className="text-4xl font-black text-brand-navy mb-8">R$ 197<span className="text-sm font-medium text-slate-400">/mês</span></div>
                <ul className="space-y-4 mb-10 flex-1">
                  <li className="flex items-center gap-3 text-sm font-medium text-slate-600">
                    <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7"/></svg>
                    Análises Ilimitadas
                  </li>
                  <li className="flex items-center gap-3 text-sm font-medium text-slate-600">
                    <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7"/></svg>
                    Relatórios Avançados
                  </li>
                  <li className="flex items-center gap-3 text-sm font-medium text-slate-600">
                    <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7"/></svg>
                    Exportação de Dados
                  </li>
                </ul>
                <button 
                  onClick={() => handleCheckout('price_pro_id')}
                  className="w-full py-4 rounded-2xl font-black uppercase tracking-widest text-xs bg-brand-navy text-white hover:bg-slate-800 transition-all shadow-lg active:scale-95"
                >
                  Assinar Agora
                </button>
              </div>
            </div>

            <div className="bg-slate-50 rounded-[2.5rem] p-12 border border-slate-100 mt-12">
              <h3 className="text-2xl font-black text-brand-navy mb-6 text-center">Nossa Stack Tecnológica</h3>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
                <div className="text-center">
                  <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-sm">
                    <svg className="w-6 h-6 text-slate-900" viewBox="0 0 24 24" fill="currentColor"><path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/></svg>
                  </div>
                  <h4 className="font-black text-brand-navy text-xs uppercase tracking-widest mb-2">GitHub</h4>
                  <p className="text-[10px] text-slate-400 leading-relaxed">Versionamento de código e integração contínua.</p>
                </div>
                <div className="text-center">
                  <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-sm">
                    <svg className="w-6 h-6 text-black" viewBox="0 0 24 24" fill="currentColor"><path d="M24 22.525H0l12-21.05 12 21.05z"/></svg>
                  </div>
                  <h4 className="font-black text-brand-navy text-xs uppercase tracking-widest mb-2">Vercel</h4>
                  <p className="text-[10px] text-slate-400 leading-relaxed">Hospedagem de alta performance e deploy automático.</p>
                </div>
                <div className="text-center">
                  <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-sm">
                    <svg className="w-6 h-6 text-orange-500" viewBox="0 0 24 24" fill="currentColor"><path d="M3.89 15.672L6.255.461A.545.545 0 017.3.332l2.365 15.34-4.887 2.822a1.09 1.09 0 01-.888 0l-4.887-2.822zm16.22 0l-2.365-15.211a.545.545 0 00-1.045-.129L14.335 15.672l4.887 2.822a1.09 1.09 0 00.888 0l4.887-2.822zM12 15.672l-2.365-15.34a.545.545 0 011.045-.129l2.365 15.469-4.887 2.822a1.09 1.09 0 01-.888 0l-4.887-2.822z"/></svg>
                  </div>
                  <h4 className="font-black text-brand-navy text-xs uppercase tracking-widest mb-2">Firebase</h4>
                  <p className="text-[10px] text-slate-400 leading-relaxed">Autenticação segura e banco de dados em tempo real.</p>
                </div>
                <div className="text-center">
                  <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-sm">
                    <svg className="w-6 h-6 text-blue-600" viewBox="0 0 24 24" fill="currentColor"><path d="M13.962 16.31l1.236-1.236c.33-.33.33-.865 0-1.195l-1.236-1.236a.845.845 0 00-1.195 0l-1.236 1.236a.845.845 0 000 1.195l1.236 1.236c.33.33.865.33 1.195 0zm-5.924-5.924l1.236-1.236c.33-.33.33-.865 0-1.195L8.038 6.719a.845.845 0 00-1.195 0L5.607 7.955a.845.845 0 000 1.195l1.236 1.236c.33.33.865.33 1.195 0zm11.848 0l1.236-1.236c.33-.33.33-.865 0-1.195l-1.236-1.236a.845.845 0 00-1.195 0l-1.236 1.236a.845.845 0 000 1.195l1.236 1.236c.33.33.865.33 1.195 0zM4.038 16.31l1.236-1.236c.33-.33.33-.865 0-1.195l-1.236-1.236a.845.845 0 00-1.195 0l-1.236 1.236a.845.845 0 000 1.195l1.236 1.236c.33.33.865.33 1.195 0z"/></svg>
                  </div>
                  <h4 className="font-black text-brand-navy text-xs uppercase tracking-widest mb-2">Stripe</h4>
                  <p className="text-[10px] text-slate-400 leading-relaxed">Gestão de pagamentos e assinaturas recorrentes.</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

const App: React.FC = () => (
  <AppContent />
);

export default App;
