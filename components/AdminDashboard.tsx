import React, { useState, useEffect } from 'react';
import { 
  Users, 
  CreditCard, 
  Layers, 
  Settings, 
  Activity, 
  Sparkles, 
  Plus, 
  RefreshCw, 
  AlertCircle, 
  Check,
  ChevronRight, 
  Database, 
  ShieldAlert,
  ArrowRight,
  TrendingUp,
  Cpu
} from 'lucide-react';
import { 
  db 
} from '../firebase';
import { 
  collection, 
  onSnapshot, 
  doc, 
  updateDoc, 
  addDoc, 
  deleteDoc, 
  serverTimestamp 
} from 'firebase/firestore';

interface AdminDashboardProps {
  user: any;
  userProfile: any;
  setActiveTab: (tab: any) => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ user, userProfile, setActiveTab }) => {
  const [usersList, setUsersList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [promoting, setPromoting] = useState(false);

  // Simulation Webhook parameters
  const [selectedUserForHook, setSelectedUserForHook] = useState<string>('');
  const [selectedPlanForHook, setSelectedPlanForHook] = useState<'free' | 'starter' | 'pro'>('starter');
  const [simulatedLogs, setSimulatedLogs] = useState<string[]>([]);
  const [simulatingWebhook, setSimulatingWebhook] = useState(false);

  // Manual Editing fields for Selected User
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [manualPlan, setManualPlan] = useState<string>('starter');
  const [manualLimit, setManualLimit] = useState<number>(50);
  const [manualUsage, setManualUsage] = useState<number>(0);

  // Load Firestore Users
  useEffect(() => {
    if (!userProfile || userProfile.role !== 'admin') {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    const unsubscribe = onSnapshot(
      collection(db, 'users'),
      (snapshot) => {
        const list = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setUsersList(list);
        
        // Auto-select first user for simulation if none selected
        if (list.length > 0 && !selectedUserForHook) {
          setSelectedUserForHook(list[0].id);
        }
        setLoading(false);
      },
      (err) => {
        console.error("Erro ao listar usuários do Firestore:", err);
        setError("Permissão negada ao listar usuários. Certifique-se de que as Regras do Firestore foram implantadas e sua conta tem role: admin.");
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [userProfile, selectedUserForHook]);

  // Self promotion to Admin for evaluation
  const handlePromoteToAdmin = async () => {
    if (!user) return;
    setPromoting(true);
    setError(null);
    try {
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        role: 'admin',
        'subscription.plan': 'pro',
        'subscription.limit': 80
      });
      setSuccessMessage("Parabéns! Sua conta foi marcada como Administrador com plano PRO no Firestore. Regras de segurança desbloqueadas!");
      setTimeout(() => setSuccessMessage(null), 5000);
    } catch (err: any) {
      console.error(err);
      setError("Falha ao promover. Se você já implantou o novo firestore.rules que restringe autopromoções, redefina seu documento diretamente usando o Firebase Console, ou crie uma conta admin inicial.");
    } finally {
      setPromoting(false);
    }
  };

  // Simulate Stripe Webhook Call back to client
  const runSimulatedStripeWebhook = async () => {
    const targetId = selectedUserForHook || user?.uid;
    if (!targetId) {
      setError("Nenhum usuário selecionado no simulador de pagamento.");
      return;
    }

    setSimulatingWebhook(true);
    setSimulatedLogs([]);

    const log = (msg: string) => {
      setSimulatedLogs(prev => [...prev, `[${new Date().toLocaleTimeString('pt-BR')}] ${msg}`]);
    };

    // Simulated timelines
    log("Recebido evento POST /api/webhook do gateway Stripe...");
    await new Promise(resolve => setTimeout(resolve, 800));
    
    log("Verificando assinatura criptográfica Stripe-Signature...");
    await new Promise(resolve => setTimeout(resolve, 600));
    
    log(`Assinatura verificada com sucesso! Evento: "checkout.session.completed"`);
    await new Promise(resolve => setTimeout(resolve, 700));

    // Determine values
    const limit = selectedPlanForHook === 'pro' ? 80 : selectedPlanForHook === 'starter' ? 50 : 2;
    log(`Metadados decodificados: email_usuario=${user?.email}, plano=${selectedPlanForHook}, limite=${limit}`);
    await new Promise(resolve => setTimeout(resolve, 800));

    log("Localizando usuário no Firestore...");
    try {
      const userRef = doc(db, 'users', targetId);
      log("Documento do usuário encontrado! Gravando alterações no Firestore de forma transacional...");
      
      await updateDoc(userRef, {
        'subscription.plan': selectedPlanForHook,
        'subscription.limit': limit,
        'usage.analysisCount': 0, // Reset counts as a bonus on subscription renewal!
        updatedAt: serverTimestamp()
      });

      await new Promise(resolve => setTimeout(resolve, 900));
      log("Sucesso! Banco de Dados Firestore atualizado de forma síncrona.");
      log(`Plano: "${selectedPlanForHook.toUpperCase()}" liberado com cota de ${limit} análises.`);
      
      setSuccessMessage(`Webhook Processado! Usuário atualizado no Firestore com plano ${selectedPlanForHook.toUpperCase()}.`);
      setTimeout(() => setSuccessMessage(null), 6000);
    } catch (err: any) {
      console.error(err);
      log(`[ERRO] Falha ao atualizar dados: ${err.message}`);
      setError(`Erro ao executar simulação no Firestore: ${err.message}`);
    } finally {
      setSimulatingWebhook(false);
    }
  };

  // Quick Action: Add 10 requests limit
  const adjustUserRequests = async (targetUserId: string, currentLimit: number, adjustment: number) => {
    try {
      const userRef = doc(db, 'users', targetUserId);
      const newLimit = Math.max(0, currentLimit + adjustment);
      await updateDoc(userRef, {
        'subscription.limit': newLimit
      });
      setSuccessMessage(`Limite de análises atualizado para ${newLimit}`);
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: any) {
      setError(`Falha ao alterar limite: ${err.message}`);
      setTimeout(() => setError(null), 4000);
    }
  };

  // Manual Update Submission
  const saveManualEdit = async (targetUserId: string) => {
    try {
      const userRef = doc(db, 'users', targetUserId);
      await updateDoc(userRef, {
        'subscription.plan': manualPlan,
        'subscription.limit': Number(manualLimit),
        'usage.analysisCount': Number(manualUsage)
      });
      setEditingUserId(null);
      setSuccessMessage("Alterações salvas com sucesso direto no Firestore!");
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: any) {
      setError(`Erro ao salvar: ${err.message}`);
    }
  };

  const startEditingUser = (u: any) => {
    setEditingUserId(u.id);
    setManualPlan(u.subscription?.plan || 'free');
    setManualLimit(u.subscription?.limit || 2);
    setManualUsage(u.usage?.analysisCount || 0);
  };

  // Create additional test users to populate dashboard nicely
  const createMockTestUser = async () => {
    try {
      const randomId = Math.floor(Math.random() * 10000);
      await addDoc(collection(db, 'users'), {
        name: `Revendedor de Teste #${randomId}`,
        email: `revenda${randomId}@gmail.com`,
        role: 'client',
        subscription: {
          plan: 'free',
          limit: 2
        },
        usage: {
          analysisCount: 0,
          lastReset: new Date()
        },
        createdAt: serverTimestamp()
      });
      setSuccessMessage("Usuário de testes criado com sucesso no Firestore!");
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: any) {
      setError(`Erro ao criar usuário de teste: ${err.message}`);
    }
  };

  const handleDeleteMockUser = async (mockId: string) => {
    if (mockId === user?.uid) {
      setError("Você não pode excluir sua própria conta logada.");
      return;
    }
    try {
      await deleteDoc(doc(db, 'users', mockId));
      setSuccessMessage("Usuário removido da base de demonstração!");
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: any) {
      setError(`Erro ao excluir: ${err.message}`);
    }
  };

  return (
    <div className="space-y-12">
      {/* Visual Header */}
      <div className="text-center max-w-3xl mx-auto">
        <div className="inline-flex items-center gap-2 p-1 px-4 bg-brand-gold/10 text-brand-gold rounded-full mb-4">
          <Settings className="w-4 h-4 animate-spin-slow" />
          <p className="text-[10px] font-black uppercase tracking-[0.2em]">Painel de Controle de Cobrança</p>
        </div>
        <h2 className="text-4xl font-black text-brand-navy mb-4 tracking-tight">Regulação de Planos & Limites</h2>
        <p className="text-slate-400 font-medium">
          Diga adeus a conciliações manuais. Controle os créditos de consulta, atualize quotas sob demanda e simule o fluxo automático de pagamento via webhook Stripe em tempo real.
        </p>
      </div>

      {/* Global Alerts */}
      {error && (
        <div className="bg-red-50 border-l-4 border-red-500 p-6 rounded-2xl flex items-center justify-between">
          <div className="flex items-center gap-4">
            <ShieldAlert className="w-8 h-8 text-red-500 shrink-0" />
            <div>
              <p className="text-sm font-bold text-red-800">Erro Operacional</p>
              <p className="text-xs text-red-700 mt-1">{error}</p>
            </div>
          </div>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600">
            <Check className="w-5 h-5 rotate-45" />
          </button>
        </div>
      )}

      {successMessage && (
        <div className="bg-emerald-50 border-l-4 border-emerald-500 p-6 rounded-2xl flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Check className="w-6 h-6 text-emerald-600 shrink-0 bg-emerald-100 rounded-full p-1" />
            <p className="text-sm font-bold text-emerald-800">{successMessage}</p>
          </div>
          <button onClick={() => setSuccessMessage(null)} className="text-emerald-400 hover:text-emerald-600">
            Fechar
          </button>
        </div>
      )}

      {/* Demonstration / Evaluation Mode Warning */}
      {(!userProfile || userProfile.role !== 'admin') && (
        <div className="bg-gradient-to-br from-slate-900 to-indigo-950 text-white rounded-3xl p-10 md:p-12 shadow-xl border border-white/10 relative overflow-hidden">
          <div className="absolute top-0 right-0 bg-brand-gold text-brand-navy px-6 py-2 rounded-bl-2xl font-black text-[10px] uppercase tracking-widest animate-pulse">Ambiente de Demonstração</div>
          <div className="max-w-2xl">
            <h3 className="text-2xl font-black mb-4">🔐 Desbloqueie o Painel Administrador</h3>
            <p className="text-slate-300 text-sm leading-relaxed mb-8">
              Atualmente, seu perfil de usuário está configurado como <strong>Cliente (role: client)</strong> no Firestore. 
              Para testar o acesso administrative total e simular a alteração dinâmica de planos de forma síncrona diretamente no Firebase, promova seu perfil para <strong>Administrador (role: admin)</strong>.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <button 
                onClick={handlePromoteToAdmin}
                disabled={promoting}
                className="bg-brand-gold hover:bg-brand-gold/90 text-brand-navy inline-flex items-center justify-center gap-3 px-8 py-4 rounded-xl font-black text-xs uppercase tracking-widest transition-all shadow-lg active:scale-95 disabled:opacity-50"
              >
                {promoting ? "Promovendo no Firestore..." : "Quero ser Administrador (Promoção Live)"}
                <ArrowRight className="w-4 h-4" />
              </button>
              <button 
                onClick={() => setActiveTab('plans')}
                className="bg-white/5 border border-white/20 hover:bg-white/10 text-white px-8 py-4 rounded-xl font-black text-xs uppercase tracking-widest transition-all"
              >
                Ir para Planos Normais
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ADMIN LEVEL RENDER */}
      {userProfile && userProfile.role === 'admin' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* USER MANAGEMENT SHEET (8 cols) */}
          <div className="lg:col-span-8 space-y-6">
            <div className="bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-sm space-y-6">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-b pb-6 border-slate-50">
                <div>
                  <h3 className="text-xl font-black text-brand-navy flex items-center gap-3">
                    <Users className="w-5 h-5 text-brand-gold" />
                    Subscritores & Consumo
                  </h3>
                  <p className="text-xs text-slate-400 mt-1">Sincronização em tempo real direto com o Firestore.</p>
                </div>
                <div className="flex items-center gap-3 self-stretch sm:self-auto justify-end">
                  <button 
                    onClick={createMockTestUser}
                    className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-4 py-3 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-xl font-bold text-xs uppercase tracking-wider transition-all"
                  >
                    <Plus className="w-4 h-4" />
                    Gerar Revendedor Teste
                  </button>
                </div>
              </div>

              {loading ? (
                <div className="py-20 text-center">
                  <RefreshCw className="w-8 h-8 animate-spin text-brand-gold mx-auto" />
                  <p className="text-slate-400 text-xs font-bold mt-4 uppercase">Buscando do Banco de Dados...</p>
                </div>
              ) : usersList.length === 0 ? (
                <div className="py-16 text-center text-slate-400 bg-slate-50 rounded-2xl">
                  <Database className="w-12 h-12 text-slate-200 mx-auto mb-3" />
                  <p className="font-bold text-sm">Nenhum usuário cadastrado no Firestore.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-slate-50/50">
                        <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-widest rounded-l-xl">Identificação</th>
                        <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Nível / Plano</th>
                        <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Consumo (Análises)</th>
                        <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right rounded-r-xl">Ações Rápidas</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {usersList.map((u) => {
                        const isSelf = u.id === user?.uid;
                        const isUnderEditing = editingUserId === u.id;
                        
                        return (
                          <tr key={u.id} className={`hover:bg-slate-50/30 transition-colors ${isSelf ? 'bg-amber-50/15' : ''}`}>
                            <td className="p-4">
                              <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-brand-navy font-black text-sm uppercase">
                                  {u.name?.charAt(0) || 'U'}
                                </div>
                                <div className="max-w-[180px] truncate">
                                  <p className="text-sm font-black text-brand-navy flex items-center gap-1.5 truncate">
                                    {u.name}
                                    {isSelf && <span className="bg-brand-gold/10 text-brand-gold px-2 py-0.5 rounded-full text-[8px] font-extrabold uppercase shrink-0">Você</span>}
                                  </p>
                                  <p className="text-[10px] text-slate-400 font-bold tracking-tight truncate">{u.email}</p>
                                </div>
                              </div>
                            </td>
                            
                            <td className="p-4">
                              {isUnderEditing ? (
                                <select 
                                  value={manualPlan}
                                  onChange={(e) => setManualPlan(e.target.value)}
                                  className="text-xs bg-white border border-slate-200 rounded p-1 outline-none font-bold"
                                >
                                  <option value="free">FREE</option>
                                  <option value="starter">STARTER</option>
                                  <option value="pro">PRO</option>
                                </select>
                              ) : (
                                <span className={`text-[9px] font-black px-3 py-1 rounded-full uppercase tracking-widest border ${
                                  u.subscription?.plan === 'pro' 
                                    ? 'bg-amber-500/10 text-amber-600 border-amber-500/20' 
                                    : u.subscription?.plan === 'starter' 
                                      ? 'bg-brand-navy/10 text-brand-navy border-brand-navy/20' 
                                      : 'bg-slate-100 text-slate-400 border-slate-200'
                                }`}>
                                  {u.subscription?.plan || 'free'}
                                </span>
                              )}
                              <p className="text-[9px] font-bold text-slate-300 uppercase tracking-widest mt-2">{u.role || 'client'}</p>
                            </td>

                            <td className="p-4 text-center">
                              {isUnderEditing ? (
                                <div className="flex items-center gap-1 justify-center max-w-[120px] mx-auto text-xs">
                                  <input 
                                    type="number" 
                                    value={manualUsage} 
                                    onChange={(e) => setManualUsage(Number(e.target.value))}
                                    className="w-10 border rounded text-center font-bold py-0.5"
                                    title="Consultas Utilizadas"
                                  />
                                  <span className="text-slate-300">/</span>
                                  <input 
                                    type="number" 
                                    value={manualLimit} 
                                    onChange={(e) => setManualLimit(Number(e.target.value))}
                                    className="w-12 border rounded text-center font-bold py-0.5"
                                    title="Limite Total"
                                  />
                                </div>
                              ) : (
                                <div>
                                  <p className="text-sm font-black text-brand-navy">
                                    {u.usage?.analysisCount || 0} 
                                    <span className="text-xs font-semibold text-slate-300"> / {u.subscription?.limit || 2}</span>
                                  </p>
                                  <div className="w-16 h-1 bg-slate-100 rounded-full mx-auto mt-1.5 overflow-hidden">
                                    <div 
                                      className="h-full bg-brand-gold rounded-full" 
                                      style={{ width: `${Math.min(100, (((u.usage?.analysisCount || 0) / (u.subscription?.limit || 2)) * 100))}%` }}
                                    ></div>
                                  </div>
                                </div>
                              )}
                            </td>

                            <td className="p-4 text-right">
                              {isUnderEditing ? (
                                <div className="inline-flex gap-1.5">
                                  <button 
                                    onClick={() => saveManualEdit(u.id)}
                                    className="p-1 px-3 bg-brand-navy text-white text-[9px] font-black uppercase tracking-wider rounded hover:opacity-90 py-1.5"
                                  >
                                    Salvar
                                  </button>
                                  <button 
                                    onClick={() => setEditingUserId(null)}
                                    className="p-1 px-3 bg-slate-100 text-slate-500 text-[9px] font-black uppercase tracking-wider rounded hover:bg-slate-200 py-1.5"
                                  >
                                    Cancelar
                                  </button>
                                </div>
                              ) : (
                                <div className="inline-flex items-center gap-1">
                                  <button 
                                    onClick={() => startEditingUser(u)}
                                    title="Edição Manual"
                                    className="p-2 text-slate-400 hover:text-brand-navy hover:bg-slate-50 rounded"
                                  >
                                    <Settings className="w-4 h-4" />
                                  </button>
                                  
                                  <button 
                                    onClick={() => adjustUserRequests(u.id, u.subscription?.limit || 2, 10)}
                                    title="Dar +10 Créditos de Consulta"
                                    className="p-2 text-slate-400 hover:text-emerald-500 hover:bg-slate-50 rounded"
                                  >
                                    <Plus className="w-4 h-4" />
                                  </button>

                                  <button 
                                    onClick={() => adjustUserRequests(u.id, u.subscription?.limit || 2, -10)}
                                    title="Remover 10 Créditos"
                                    className="p-2 text-slate-400 hover:text-red-500 hover:bg-slate-50 rounded text-lg font-black leading-none"
                                    disabled={(u.subscription?.limit || 2) < 10}
                                  >
                                    -
                                  </button>

                                  {!isSelf && (
                                    <button 
                                      onClick={() => handleDeleteMockUser(u.id)}
                                      title="Excluir Usuário Demo"
                                      className="p-2 text-slate-400 hover:text-red-400 hover:bg-slate-50 rounded"
                                    >
                                      deletar
                                    </button>
                                  )}
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* DYNAMIC WEBHOOK SIMULATOR & EDUCATION (4 cols) */}
          <div className="lg:col-span-4 space-y-6">
            
            {/* Payment simulation panel */}
            <div className="bg-gradient-to-tr from-slate-900 to-slate-950 text-white rounded-[2rem] p-8 border border-white/5 shadow-xl space-y-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-orange-500/10 border border-orange-500/30 flex items-center justify-center text-orange-500 shrink-0">
                  <CreditCard className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-black uppercase tracking-wider">Simulador de Webhook</h4>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Mock Stripe API confirm</p>
                </div>
              </div>

              <p className="text-xs text-slate-300 leading-relaxed">
                Escolha um usuário e simule o disparo automático enviando o evento de confirmação Stripe direct para atualizar seus créditos.
              </p>

              <div className="space-y-4 pt-2">
                {/* User selection list */}
                <div>
                  <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 block mb-2">Destinatário da Assinatura</label>
                  <select 
                    value={selectedUserForHook}
                    onChange={(e) => setSelectedUserForHook(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-xs outline-none focus:ring-1 focus:ring-amber-500 text-white font-bold"
                  >
                    {usersList.map((usr) => (
                      <option key={usr.id} value={usr.id}>
                        {usr.name} ({usr.email})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Plan selection list */}
                <div>
                  <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 block mb-2">Plano Confirmado pela Stripe</label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { type: 'starter', label: 'Starter (50 análises)', price: 'R$ 97' },
                      { type: 'pro', label: 'Pro (80 análises)', price: 'R$ 149,90' }
                    ].map((item) => (
                      <button
                        key={item.type}
                        type="button"
                        onClick={() => setSelectedPlanForHook(item.type as any)}
                        className={`p-3 rounded-xl border text-left transition-all relative ${
                          selectedPlanForHook === item.type 
                            ? 'bg-amber-500/10 border-brand-gold text-amber-400' 
                            : 'bg-slate-800/50 border-slate-700/50 hover:bg-slate-800 text-slate-400'
                        }`}
                      >
                        {selectedPlanForHook === item.type && (
                          <span className="absolute top-2 right-2 w-2 h-2 bg-brand-gold rounded-full"></span>
                        )}
                        <p className="font-black text-xs uppercase leading-none">{item.type}</p>
                        <p className="text-[9px] font-bold mt-1.5 opacity-80">{item.price}/mês</p>
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={runSimulatedStripeWebhook}
                  disabled={simulatingWebhook}
                  className="w-full py-4 bg-brand-gold hover:bg-brand-gold/90 text-brand-navy rounded-xl font-black text-xs uppercase tracking-widest transition-all shadow-lg active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <Cpu className={`w-4 h-4 ${simulatingWebhook ? 'animate-spin' : ''}`} />
                  {simulatingWebhook ? "Processando Evento..." : "Disparar Webhook Simulado"}
                </button>
              </div>

              {/* Log Window */}
              {simulatedLogs.length > 0 && (
                <div className="mt-4 pt-4 border-t border-white/5 space-y-2">
                  <span className="text-[8px] font-black uppercase tracking-wider text-slate-400 block mb-1">Logs de Telemetria (Live)</span>
                  <div className="bg-black/40 border border-white/5 rounded-xl p-4 font-mono text-[9px] text-slate-300 h-40 overflow-y-auto space-y-1.5 scrollbar-thin">
                    {simulatedLogs.map((logStr, i) => (
                      <p key={i} className="leading-relaxed">
                        {logStr.includes('[ERRO]') ? (
                          <span className="text-red-400">{logStr}</span>
                        ) : logStr.includes('Sucesso!') || logStr.includes('assinatura verificada') ? (
                          <span className="text-emerald-400 font-semibold">{logStr}</span>
                        ) : (
                          logStr
                        )}
                      </p>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Educational breakdown Card */}
            <div className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm space-y-6">
              <h4 className="text-xs font-black text-brand-navy uppercase tracking-widest border-b pb-4 flex items-center gap-2">
                <Layers className="w-4 h-4 text-brand-gold" />
                Como o Pagamento é Gerado?
              </h4>
              
              <div className="space-y-4">
                {[
                  { step: '1', title: 'Iniciar Checkout', desc: 'O cliente clica em "Assinar". O frontend chama nossa API (/api/create-checkout-session) que gera uma sessão criptografada na Stripe.' },
                  { step: '2', title: 'Pagamento Seguro', desc: 'O usuário é redirecionado para a página oficial da Stripe. Eles preenchem o cartão de crédito de forma 100% segura.' },
                  { step: '3', title: 'Notificação Direta (Webhook)', desc: 'Após a confirmação da transação, o servidor da Stripe dispara um evento HTTPS POST secreto (/api/webhook) para o nosso backend.' },
                  { step: '4', title: 'Atualização no Firestore', desc: 'Nosso servidor valida a assinatura da Stripe, decodifica o e-mail, promove o plano desse usuário no Firebase e renova sua cota instantaneamente.' }
                ].map((s, idx) => (
                  <div key={idx} className="flex gap-4 items-start pb-2 border-b border-slate-50 last:border-0 last:pb-0">
                    <div className="w-5 h-5 rounded-full bg-slate-100 text-slate-500 font-black text-[10px] flex items-center justify-center shrink-0 border border-slate-200">
                      {s.step}
                    </div>
                    <div>
                      <p className="text-xs font-black text-brand-navy">{s.title}</p>
                      <p className="text-[10px] text-slate-400 font-medium leading-relaxed mt-1">{s.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            
          </div>
        </div>
      )}
    </div>
  );
};
