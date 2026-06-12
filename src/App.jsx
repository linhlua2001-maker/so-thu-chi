import React, { useState, useMemo, useEffect } from 'react';
import { 
  Home, PlusCircle, List as ListIcon, Wallet, Trash2, Pencil,
  Calendar, AlignLeft, DollarSign, PieChart, Settings, 
  Plus, X, Lock, Download, Sun, Moon, Eye, EyeOff, 
  ChevronDown, ChevronRight, ArrowLeft, ChevronLeft, Save
} from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, onSnapshot, addDoc, deleteDoc, doc, query, setDoc, updateDoc } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyB5sCEMHolcbH17xIADNI9ksChOd-uyKNU",
  authDomain: "so-thu-chi-e550e.firebaseapp.com",
  projectId: "so-thu-chi-e550e",
  storageBucket: "so-thu-chi-e550e.firebasestorage.app",
  messagingSenderId: "695760550259",
  appId: "1:695760550259:web:5df7e56a19f98b65d32d06"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = "so-thu-chi-linh-hanh";

const DEFAULT_CATEGORIES = {
  expense: [
    { name: 'Ăn uống', icon: '🍔', type: 'expense' },
    { name: 'Di chuyển', icon: '🚗', type: 'expense' },
    { name: 'Mua sắm', icon: '🛍️', type: 'expense' },
    { name: 'Nhà cửa', icon: '🏠', type: 'expense' },
    { name: 'Sức khỏe', icon: '💊', type: 'expense' },
  ],
  income: [
    { name: 'Lương', icon: '💰', type: 'income' },
    { name: 'Thưởng', icon: '🎁', type: 'income' },
  ]
};

const EMOJI_LIST = ['🍔','🚗','🛍️','🧾','💰','🎁','🏠','💡','🎮','💊','📚','✈️','☕','🏥','🐶','👗','📱','💸','📦','🛠️'];
const CHART_COLORS = ['#3b82f6', '#f59e0b', '#10b981', '#8b5cf6', '#ec4899', '#06b6d4', '#f43f5e', '#84cc16'];

const formatCurrency = (amount) => {
  if (isNaN(amount) || amount === undefined || amount === null) amount = 0;
  return new Intl.NumberFormat('vi-VN').format(Math.abs(amount)) + ' đ';
};

const formatInputNumber = (value) => {
  if (!value) return '';
  const num = value.toString().replace(/\D/g, ''); 
  if (!num) return '';
  return new Intl.NumberFormat('vi-VN').format(num);
};

const parseInputNumber = (value) => {
  if (!value) return 0;
  return parseInt(value.toString().replace(/\./g, ''), 10);
};

const isSameDay = (d1, d2) => d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth() && d1.getDate() === d2.getDate();
const isSameMonth = (d1, d2) => d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth();
const getQuarter = (d) => Math.floor(d.getMonth() / 3) + 1;
const isSameQuarter = (d1, d2) => d1.getFullYear() === d2.getFullYear() && getQuarter(d1) === getQuarter(d2);
const isSameYear = (d1, d2) => d1.getFullYear() === d2.getFullYear();
const getStartOfWeek = (d) => {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1); 
  return new Date(date.setDate(diff)).setHours(0,0,0,0);
};
const isSameWeek = (d1, d2) => getStartOfWeek(d1) === getStartOfWeek(d2);

export default function ExpenseTrackerApp() {
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState(false);
  const [activeUser, setActiveUser] = useState('');
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [showBalance, setShowBalance] = useState(true);
  const [user, setUser] = useState(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [transactions, setTransactions] = useState([]);
  const [categories, setCategories] = useState({ expense: [], income: [] });
  const [initialBalance, setInitialBalance] = useState(0);
  const [formType, setFormType] = useState('expense');
  const [formAmount, setFormAmount] = useState(''); 
  const [formCategory, setFormCategory] = useState(null);
  const [formDate, setFormDate] = useState(new Date().toISOString().split('T')[0]);
  const [formNote, setFormNote] = useState('');
  const [editTxId, setEditTxId] = useState(null);
  const [editFormType, setEditFormType] = useState('expense');
  const [editFormAmount, setEditFormAmount] = useState(''); 
  const [editFormCategory, setEditFormCategory] = useState(null);
  const [editFormDate, setEditFormDate] = useState('');
  const [editFormNote, setEditFormNote] = useState('');
  const [newCatName, setNewCatName] = useState('');
  const [newCatIcon, setNewCatIcon] = useState('📦');
  const [manageType, setManageType] = useState('expense');
  const [showPicker, setShowPicker] = useState(false);
  const [statsTab, setStatsTab] = useState('current'); 
  const [statsYear, setStatsYear] = useState(new Date().getFullYear());
  const [selectedReport, setSelectedReport] = useState(null); 
  const [reportDetailType, setReportDetailType] = useState('expense'); 
  const [historyMonth, setHistoryMonth] = useState(new Date().getMonth() + 1);
  const [historyYear, setHistoryYear] = useState(new Date().getFullYear());
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, message: '', onConfirm: null });
  const [toastMsg, setToastMsg] = useState('');
  const [editBalance, setEditBalance] = useState(false);
  const [tempBalanceStr, setTempBalanceStr] = useState('');

  const handleUnlock = (e) => {
    e.preventDefault();
    if (pin === '2708') { setIsUnlocked(true); setPinError(false); setActiveUser('Hạnh'); } 
    else if (pin === '1201') { setIsUnlocked(true); setPinError(false); setActiveUser('Linh'); } 
    else { setPinError(true); setPin(''); }
  };

  const showToast = (msg) => { setToastMsg(msg); setTimeout(() => setToastMsg(''), 3000); };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (!currentUser) { signInAnonymously(auth).catch(e => console.error(e)); }
      setUser(currentUser); setIsAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user || !isUnlocked) return;
    const txRef = collection(db, 'transactions');
    const catRef = collection(db, 'categories');
    const accRef = doc(db, 'account', 'balance');
    const unsubTx = onSnapshot(query(txRef), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      data.sort((a, b) => new Date(b.date) - new Date(a.date));
      setTransactions(data);
    });
    const unsubCat = onSnapshot(query(catRef), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      if (data.length === 0) {
        DEFAULT_CATEGORIES.expense.forEach(c => addDoc(catRef, c));
        DEFAULT_CATEGORIES.income.forEach(c => addDoc(catRef, c));
      } else {
        const exp = data.filter(c => c.type === 'expense');
        const inc = data.filter(c => c.type === 'income');
        setCategories({ expense: exp, income: inc });
      }
    });
    const unsubAcc = onSnapshot(accRef, (docSnap) => {
      if (docSnap.exists()) { setInitialBalance(docSnap.data().amount || 0); }
    });
    return () => { unsubTx(); unsubCat(); unsubAcc(); };
  }, [user, isUnlocked]);

  useEffect(() => {
    if (!formCategory && categories[formType] && categories[formType].length > 0) {
      setFormCategory(categories[formType][0]);
    }
  }, [formType, categories, formCategory]);

  const { balance } = useMemo(() => {
    let inc = 0; let exp = 0;
    transactions.forEach(t => {
      if (t.type === 'income') inc += parseFloat(t.amount);
      if (t.type === 'expense') exp += parseFloat(t.amount);
    });
    return { balance: initialBalance + inc - exp };
  }, [transactions, initialBalance]);

  const handleAddTransaction = async (e) => {
    e.preventDefault();
    const amount = parseInputNumber(formAmount);
    if (!user || amount <= 0 || !formCategory) return;
    try {
      const txRef = collection(db, 'transactions');
      await addDoc(txRef, {
        type: formType, amount: amount, category: formCategory.name,
        categoryIcon: formCategory.icon, date: formDate, note: formNote, 
        createdBy: activeUser, createdAt: new Date().toISOString()
      });
      setFormAmount(''); setFormNote(''); showToast('Đã lưu!'); 
    } catch (error) { console.error(error); }
  };

  const openEditModal = (tx) => {
    setEditTxId(tx.id); setEditFormType(tx.type);
    setEditFormAmount(formatInputNumber(tx.amount.toString()));
    setEditFormDate(tx.date); setEditFormNote(tx.note || '');
    const catList = categories[tx.type];
    const cat = catList.find(c => c.name === tx.category) || { name: tx.category, icon: tx.categoryIcon };
    setEditFormCategory(cat);
  };

  const handleUpdateTransaction = async (e) => {
    e.preventDefault();
    const amount = parseInputNumber(editFormAmount);
    if (!user || amount <= 0 || !editFormCategory) return;
    try {
      await updateDoc(doc(db, 'transactions', editTxId), {
        type: editFormType, amount: amount, category: editFormCategory.name,
        categoryIcon: editFormCategory.icon, date: editFormDate, note: editFormNote, 
        updatedAt: new Date().toISOString()
      });
      setEditTxId(null); showToast('Đã cập nhật!');
    } catch (error) { console.error(error); }
  };

  const confirmDeleteTx = (id) => {
    setConfirmModal({
      isOpen: true, message: 'Xóa giao dịch này?',
      onConfirm: async () => {
        await deleteDoc(doc(db, 'transactions', id));
        showToast('Đã xóa');
      }
    });
  };

  const changeHistoryMonth = (step) => {
    let m = historyMonth + step; let y = historyYear;
    if (m > 12) { m = 1; y += 1; } else if (m < 1) { m = 12; y -= 1; }
    setHistoryMonth(m); setHistoryYear(y);
  };

  if (!isAuthReady) return <div className="flex justify-center items-center h-[100dvh] bg-gray-50 dark:bg-gray-900"><p className="text-teal-600 font-medium animate-pulse">Đang kết nối...</p></div>;

  if (!isUnlocked) {
    return (
      <div className={isDarkMode ? 'dark' : ''}>
        <div className="flex justify-center bg-gray-100 dark:bg-gray-900 h-[100dvh] w-full">
          <div className="w-full max-w-md bg-white dark:bg-gray-900 h-full relative flex flex-col justify-center items-center px-6 transition-colors duration-300">
            <button onClick={() => setIsDarkMode(!isDarkMode)} className="absolute top-6 right-6 p-2 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300">
              {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
            </button>
            <div className="w-20 h-20 bg-teal-50 dark:bg-teal-900/30 rounded-full flex items-center justify-center mb-6"><Lock className="text-teal-500 w-10 h-10" /></div>
            <h1 className="text-2xl font-bold text-gray-800 dark:text-white mb-2">Sổ Thu Chi</h1>
            <p className="text-gray-500 dark:text-gray-400 text-sm mb-8">Vui lòng nhập mã PIN.</p>
            <form onSubmit={handleUnlock} className="w-full max-w-xs space-y-4">
              <input type="password" inputMode="numeric" maxLength={4} value={pin} onChange={(e) => setPin(e.target.value)} placeholder="••••"
                className={`w-full text-center text-3xl tracking-[1em] p-4 border-2 rounded-2xl focus:outline-none transition-colors dark:text-white ${pinError ? 'border-red-400 bg-red-50 dark:bg-red-900/20' : 'border-gray-200 dark:border-gray-700 focus:border-teal-500 bg-gray-50 dark:bg-gray-800'}`} />
              <button type="submit" className="w-full py-4 bg-teal-600 text-white font-bold rounded-xl shadow-lg active:scale-95 transition-transform">Mở Khóa</button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  const renderDashboard = () => {
    const today = new Date();
    const currentMonthTx = transactions.filter(t => isSameMonth(new Date(t.date), today));
    let mInc = 0; let mExp = 0; const expByCat = {};
    currentMonthTx.forEach(t => {
      if (t.type === 'income') mInc += t.amount;
      else { mExp += t.amount; expByCat[t.category] = (expByCat[t.category] || 0) + t.amount; }
    });
    const maxBar = Math.max(mInc, mExp) || 1;
    const donutData = Object.entries(expByCat).sort(([, a], [, b]) => b - a).map(([name, amount], i) => ({
      name, amount, percent: mExp > 0 ? (amount / mExp) * 100 : 0, color: CHART_COLORS[i % CHART_COLORS.length]
    }));
    let curP = 0; const conicS = donutData.length > 0 ? donutData.map(d => { const s = curP; curP += d.percent; return `${d.color} ${s}% ${curP}%`; }).join(', ') : '#e5e7eb 0% 100%';

    return (
      <div className="p-4 space-y-4 animate-in fade-in">
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-gray-700">
          <div className="flex items-center space-x-2 mb-2">
            <p className="text-gray-500 dark:text-gray-400 text-sm font-medium">Tổng số dư</p>
            <button onClick={() => setShowBalance(!showBalance)}>{showBalance ? <Eye size={16} /> : <EyeOff size={16} />}</button>
          </div>
          <h2 className="text-3xl font-bold">{showBalance ? formatCurrency(balance) : '****** đ'}</h2>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-gray-700">
          <h3 className="font-bold mb-4">Tình hình thu chi</h3>
          <div className="flex items-end space-x-6 h-32">
            <div className="flex items-end space-x-2 h-full w-24 shrink-0 border-b-2 border-gray-100 dark:border-gray-700 pb-1">
              <div className="w-1/2 bg-emerald-500 rounded-t-sm transition-all duration-500" style={{ height: `${(mInc / maxBar) * 100}%` }}></div>
              <div className="w-1/2 bg-red-500 rounded-t-sm transition-all duration-500" style={{ height: `${(mExp / maxBar) * 100}%` }}></div>
            </div>
            <div className="flex-1 space-y-3 text-sm">
              <div className="flex justify-between"><span>Thu</span><span className="font-bold text-emerald-600">{showBalance ? formatCurrency(mInc) : '******'}</span></div>
              <div className="flex justify-between"><span>Chi</span><span className="font-bold text-red-600">{showBalance ? formatCurrency(mExp) : '******'}</span></div>
              <div className="w-full h-px bg-gray-100 dark:bg-gray-700"></div>
              <div className="flex justify-between font-bold"><span>Chênh lệch</span><span>{showBalance ? formatCurrency(mInc - mExp) : '******'}</span></div>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 flex items-center space-x-6 shadow-sm border border-gray-100 dark:border-gray-700">
            <div className="relative w-32 h-32 rounded-full shrink-0 flex items-center justify-center" style={{ background: `conic-gradient(${conicS})` }}><div className="w-20 h-20 bg-white dark:bg-gray-800 rounded-full"></div></div>
            <div className="flex-1 space-y-2">
              {donutData.slice(0, 4).map(d => (
                <div key={d.name} className="flex justify-between text-xs">
                  <div className="flex items-center space-x-1"><div className="w-2 h-2 rounded-full" style={{backgroundColor: d.color}}></div><span className="truncate max-w-[70px]">{d.name}</span></div>
                  <span className="font-bold">{d.percent.toFixed(1)}%</span>
                </div>
              ))}
            </div>
        </div>
        <div className="flex justify-between items-center mb-2 mt-4"><h3 className="font-bold">Gần đây</h3><button onClick={() => setActiveTab('history')} className="text-xs text-teal-600">Xem thêm</button></div>
        <div className="space-y-3">
          {transactions.slice(0, 3).map(t => (
            <div key={t.id} className="bg-white dark:bg-gray-800 p-3 rounded-xl shadow-sm border border-gray-50 dark:border-gray-700 flex justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-full bg-gray-50 dark:bg-gray-700 flex items-center justify-center text-lg">{t.categoryIcon}</div>
                <div><p className="font-semibold text-sm">{t.category}</p><p className="text-[10px] text-gray-400">{t.createdBy} • {new Date(t.date).toLocaleDateString('vi-VN')}</p></div>
              </div>
              <div className={`font-bold text-sm ${t.type === 'expense' ? 'text-red-500' : 'text-emerald-500'}`}>{t.type === 'expense' ? '-' : '+'}{formatCurrency(t.amount)}</div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderHistory = () => {
    const filtered = transactions.filter(t => { const d = new Date(t.date); return (d.getMonth() + 1) === historyMonth && d.getFullYear() === historyYear; });
    let hInc = 0; let hExp = 0; filtered.forEach(t => { if(t.type === 'income') hInc+=t.amount; else hExp+=t.amount; });
    const grouped = filtered.reduce((acc, t) => { if (!acc[t.date]) acc[t.date] = []; acc[t.date].push(t); return acc; }, {});
    const sortedD = Object.keys(grouped).sort((a, b) => new Date(b) - new Date(a));
    return (
      <div className="p-4 animate-in fade-in">
        <h2 className="text-xl font-bold mb-4 text-center">Lịch sử ghi chép</h2>
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-700 mb-6">
          <div className="flex justify-between items-center mb-4"><button onClick={() => changeHistoryMonth(-1)}><ChevronLeft /></button><div className="font-bold text-teal-600">Tháng {historyMonth}/{historyYear}</div><button onClick={() => changeHistoryMonth(1)}><ChevronRight /></button></div>
          <div className="grid grid-cols-2 gap-4 text-center">
            <div><p className="text-xs text-gray-500">Tổng thu</p><p className="font-bold text-emerald-500">{formatCurrency(hInc)}</p></div>
            <div><p className="text-xs text-gray-500">Tổng chi</p><p className="font-bold text-red-500">{formatCurrency(hExp)}</p></div>
          </div>
        </div>
        <div className="space-y-6">
          {sortedD.map(date => (
            <div key={date}>
              <h3 className="font-bold text-xs text-gray-500 mb-2">{new Date(date).toLocaleDateString('vi-VN', {day: '2-digit', month: '2-digit', year: 'numeric'})}</h3>
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
                {grouped[date].map((t, idx) => (
                  <div key={t.id} className={`p-3 flex justify-between items-center ${idx !== grouped[date].length - 1 ? 'border-b border-gray-50 dark:border-gray-700' : ''}`}>
                    <div className="flex items-center space-x-3"><div className="text-xl">{t.categoryIcon}</div>
                      <div><p className="font-semibold text-sm">{t.category}</p><p className="text-[10px] text-gray-400">{t.createdBy} {t.note && `• ${t.note}`}</p></div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className={`font-bold text-sm ${t.type === 'expense' ? 'text-red-500' : 'text-emerald-500'}`}>{formatCurrency(t.amount)}</span>
                      <button onClick={() => openEditModal(t)} className="p-1 text-gray-300 hover:text-teal-500"><Pencil size={14} /></button>
                      <button onClick={() => confirmDeleteTx(t.id)} className="p-1 text-gray-300 hover:text-red-500"><Trash2 size={14} /></button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderStats = () => {
    if (selectedReport) {
      const filteredTx = transactions.filter(t => selectedReport.filterFn(new Date(t.date)));
      const typeTx = filteredTx.filter(t => t.type === reportDetailType);
      const total = typeTx.reduce((sum, t) => sum + t.amount, 0);
      const groupedData = typeTx.reduce((acc, t) => { acc[t.category] = (acc[t.category] || 0) + t.amount; return acc; }, {});
      const chartData = Object.entries(groupedData).sort(([, a], [, b]) => b - a).map(([name, amount], i) => ({
        name, amount, percent: total > 0 ? (amount / total) * 100 : 0, color: CHART_COLORS[i % CHART_COLORS.length], icon: categories[reportDetailType]?.find(c => c.name === name)?.icon || '📦'
      }));
      let curP = 0; const conicStops = chartData.length > 0 ? chartData.map(d => { const s = curP; curP += d.percent; return `${d.color} ${s}% ${curP}%`; }).join(', ') : '#e5e7eb 0% 100%';
      return (
        <div className="h-full flex flex-col bg-gray-50 dark:bg-gray-950 absolute inset-0 z-[40] animate-in slide-in-from-right">
          <div className="bg-white dark:bg-gray-900 px-4 py-4 flex items-center shadow-sm border-b border-gray-100 dark:border-gray-800"><button onClick={() => setSelectedReport(null)} className="mr-4"><ArrowLeft /></button><h2 className="text-xl font-bold">{selectedReport.title}</h2></div>
          <div className="flex border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900"><button onClick={() => setReportDetailType('expense')} className={`flex-1 py-3 text-sm font-bold border-b-2 ${reportDetailType === 'expense' ? 'border-teal-500 text-teal-600' : 'border-transparent text-gray-500'}`}>Chi tiền</button><button onClick={() => setReportDetailType('income')} className={`flex-1 py-3 text-sm font-bold border-b-2 ${reportDetailType === 'income' ? 'border-teal-500 text-teal-600' : 'border-transparent text-gray-500'}`}>Thu tiền</button></div>
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-gray-700"><div className="flex justify-between mb-6"><span className="text-gray-500 font-medium">Tổng {reportDetailType==='expense'?'chi':'thu'}</span><span className={`text-xl font-bold ${reportDetailType==='expense'?'text-red-500':'text-emerald-500'}`}>{formatCurrency(total)}</span></div><div className="flex items-center space-x-6"><div className="relative w-32 h-32 rounded-full shrink-0 flex items-center justify-center" style={{ background: `conic-gradient(${conicStops})` }}><div className="w-20 h-20 bg-white dark:bg-gray-800 rounded-full"></div></div><div className="flex-1 space-y-2">{chartData.slice(0, 5).map(d => (<div key={d.name} className="flex justify-between text-xs"><span className="truncate max-w-[80px]">{d.name}</span><span className="font-bold">{d.percent.toFixed(1)}%</span></div>))}</div></div></div>
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">{chartData.map(d => (<div key={d.name} className="flex justify-between items-center p-4 border-b border-gray-50 dark:border-gray-700 last:border-0"><div className="flex items-center space-x-3"><div className="text-xl">{d.icon}</div><span className="font-semibold text-sm">{d.name}</span></div><div className="flex items-center space-x-2"><span className="text-xs text-gray-400">({d.percent.toFixed(1)}%)</span><span className="font-bold text-sm">{formatCurrency(d.amount)}</span></div></div>))}</div>
          </div>
        </div>
      );
    }
    const calcRow = (label, isIncFn, onCl = null) => {
      let i = 0; let e = 0; transactions.filter(t => isIncFn(new Date(t.date))).forEach(t => { if(t.type === 'income') i += t.amount; else e += t.amount; });
      return { label, inc: i, exp: e, diff: i - e, onCl };
    };
    const renderRow = (r) => (<div key={r.label} onClick={r.onCl} className="flex flex-col py-3 border-b border-gray-50 dark:border-gray-800 last:border-0 cursor-pointer transition-colors hover:bg-gray-50 dark:hover:bg-gray-700/50"><div className="flex justify-between mb-1"><div className="flex items-center"><span className="font-bold text-sm">{r.label}</span><ChevronRight size={14}/></div><span className="text-emerald-500 text-sm font-medium">{formatCurrency(r.inc)}</span></div><div className="flex justify-between mb-1"><span></span><span className="text-red-500 text-sm font-medium">-{formatCurrency(r.exp)}</span></div><div className="flex justify-between font-bold text-sm"><span></span><span>{formatCurrency(r.diff)}</span></div></div>);
    const today = new Date();
    return (
      <div className="flex flex-col h-full animate-in fade-in">
        <h2 className="text-xl font-bold mt-4 mb-4 text-center">Báo cáo</h2>
        <div className="flex border-b border-gray-100 dark:border-gray-800 shrink-0"><button onClick={() => setStatsTab('current')} className={`flex-1 py-3 text-sm font-medium border-b-2 ${statsTab === 'current' ? 'border-teal-500 text-teal-600' : 'border-transparent text-gray-400'}`}>Hiện tại</button><button onClick={() => setStatsTab('month')} className={`flex-1 py-3 text-sm font-medium border-b-2 ${statsTab === 'month' ? 'border-teal-500 text-teal-600' : 'border-transparent text-gray-400'}`}>Tháng</button><button onClick={() => setStatsTab('quarter')} className={`flex-1 py-3 text-sm font-medium border-b-2 ${statsTab === 'quarter' ? 'border-teal-500 text-teal-600' : 'border-transparent text-gray-400'}`}>Quý</button><button onClick={() => setStatsTab('year')} className={`flex-1 py-3 text-sm font-medium border-b-2 ${statsTab === 'year' ? 'border-teal-500 text-teal-600' : 'border-transparent text-gray-400'}`}>Năm</button></div>
        <div className="p-4 flex-1 overflow-y-auto">
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-700">
              {statsTab === 'current' && [calcRow('Hôm nay', d => isSameDay(d, today), () => setSelectedReport({ title: 'Hôm nay', filterFn: d => isSameDay(d, today) })), calcRow('Tuần này', d => isSameWeek(d, today), () => setSelectedReport({ title: 'Tuần này', filterFn: d => isSameWeek(d, today) })), calcRow('Tháng này', d => isSameMonth(d, today), () => setSelectedReport({ title: 'Tháng này', filterFn: d => isSameMonth(d, today) })), calcRow('Quý này', d => isSameQuarter(d, today), () => setSelectedReport({ title: 'Quý này', filterFn: d => isSameQuarter(d, today) })), calcRow('Năm này', d => isSameYear(d, today), () => setSelectedReport({ title: 'Năm này', filterFn: d => isSameYear(d, today) }))].map(renderRow)}
              {statsTab !== 'current' && <p className="text-center text-sm text-gray-400 py-10">Vui lòng chọn tab Hiện tại để xem chi tiết.</p>}
          </div>
        </div>
      </div>
    );
  };

  const renderSettings = () => {
    const hUpdateBal = async () => { try { await setDoc(doc(db, 'account', 'balance'), { amount: parseInputNumber(tempBalanceStr) }); setEditBalance(false); showToast('Đã cập nhật!'); } catch (e) { console.error(e); } };
    const hAddCat = async (e) => { e.preventDefault(); if (!user || !newCatName) return; try { await addDoc(collection(db, 'categories'), { name: newCatName, icon: newCatIcon, type: manageType }); setNewCatName(''); setShowPicker(false); showToast('Đã thêm!'); } catch (error) { console.error(error); } };
    return (
      <div className="p-4 animate-in fade-in pb-24">
        <h2 className="text-xl font-bold mb-6 text-center mt-4">Cài Đặt</h2>
        <h3 className="text-sm font-bold text-gray-400 uppercase mb-3">Tài khoản</h3>
        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 mb-8">
          <div className="flex justify-between items-center mb-2"><span className="text-sm font-medium">Số dư ban đầu</span>{!editBalance && <button onClick={() => { setTempBalanceStr(formatInputNumber(initialBalance.toString())); setEditBalance(true); }} className="text-teal-600 text-xs font-bold hover:underline">Điều chỉnh</button>}</div>
          {editBalance ? (
            <div className="flex items-center space-x-2"><input type="text" inputMode="numeric" value={tempBalanceStr} onChange={(e) => setTempBalanceStr(formatInputNumber(e.target.value))} className="flex-1 bg-gray-50 dark:bg-gray-900 border border-gray-200 p-2 rounded-lg font-bold outline-none" /><button onClick={hUpdateBal} className="bg-teal-500 text-white p-2 rounded-lg"><Save size={18} /></button><button onClick={() => setEditBalance(false)} className="bg-gray-100 p-2 rounded-lg text-gray-500"><X size={18} /></button></div>
          ) : (<p className="text-xl font-bold">{formatCurrency(initialBalance)}</p>)}
        </div>
        <h3 className="text-sm font-bold text-gray-400 uppercase mb-3">Danh mục</h3>
        <div className="flex bg-gray-100 dark:bg-gray-800 p-1 rounded-xl mb-4"><button onClick={() => setManageType('expense')} className={`flex-1 py-1.5 rounded-lg text-sm transition-all ${manageType==='expense'?'bg-white dark:bg-gray-700 shadow-sm font-bold':'text-gray-400'}`}>Chi</button><button onClick={() => setManageType('income')} className={`flex-1 py-1.5 rounded-lg text-sm transition-all ${manageType==='income'?'bg-white dark:bg-gray-700 shadow-sm font-bold':'text-gray-400'}`}>Thu</button></div>
        <form onSubmit={hAddCat} className="mb-6 relative"><div className="flex space-x-2 bg-white dark:bg-gray-800 p-3 rounded-xl border border-gray-100 dark:border-gray-700"><button type="button" onClick={() => setShowPicker(!showPicker)} className="w-10 h-10 bg-gray-50 dark:bg-gray-900 rounded-lg text-xl flex items-center justify-center border border-gray-100 dark:border-gray-700">{newCatIcon}</button><input type="text" value={newCatName} onChange={e => setNewCatName(e.target.value)} placeholder="Tên mục mới..." className="flex-1 bg-transparent outline-none text-sm w-[100px]" required /><button type="submit" className="bg-teal-500 text-white px-3 rounded-lg"><Plus size={20} /></button></div>{showPicker && <div className="absolute top-16 left-0 z-50 w-full bg-white dark:bg-gray-800 p-3 rounded-xl shadow-xl border border-gray-200 grid grid-cols-7 gap-2">{EMOJI_LIST.map(e => (<button key={e} type="button" onClick={() => { setNewCatIcon(e); setShowPicker(false); }} className="text-2xl p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">{e}</button>))}</div>}</form>
        <div className="space-y-2">{categories[manageType]?.map(cat => (<div key={cat.id} className="flex justify-between items-center bg-white dark:bg-gray-800 p-3 rounded-xl border border-gray-50 dark:border-gray-700 transition-all hover:border-teal-100"><div className="flex items-center space-x-3"><span>{cat.icon}</span><span className="text-sm font-medium">{cat.name}</span></div><button onClick={() => { setConfirmModal({ isOpen: false, message: 'Xóa danh mục này?', onConfirm: async () => { await deleteDoc(doc(db, 'categories', cat.id)); showToast('Đã xóa!'); } }); }} className="text-gray-300 hover:text-red-500"><X size={16} /></button></div>))}</div>
        <div className="mt-10 text-center"><button onClick={() => setIsUnlocked(false)} className="text-sm text-red-500 font-medium px-4 py-2 bg-red-50 dark:bg-red-900/20 rounded-lg transition-colors hover:bg-red-100">Khóa ứng dụng</button></div>
      </div>
    );
  };

  const renderConfirmModal = () => (
    confirmModal.isOpen ? (
      <div className="absolute inset-0 bg-black/60 z-[60] flex items-center justify-center p-4 animate-in fade-in duration-200">
        <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl max-w-sm w-full shadow-2xl scale-100 animate-in zoom-in-95 duration-200">
          <p className="text-gray-800 dark:text-gray-100 font-medium mb-6 text-center text-lg">{confirmModal.message}</p>
          <div className="flex space-x-3">
            <button onClick={() => setConfirmModal({ isOpen: false, message: '', onConfirm: null })} className="flex-1 py-3 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-xl font-medium">Hủy</button>
            <button onClick={() => { confirmModal.onConfirm(); setConfirmModal({ isOpen: false, message: '', onConfirm: null }); }} className="flex-1 py-3 bg-red-500 hover:bg-red-600 text-white rounded-xl font-medium shadow-lg shadow-red-500/30">Đồng ý</button>
          </div>
        </div>
      </div>
    ) : null
  );

  return (
    <div className={isDarkMode ? 'dark' : ''}>
      <div className="flex justify-center bg-gray-100 dark:bg-gray-900 h-[100dvh] w-full text-gray-800 dark:text-gray-100 overflow-hidden transition-colors duration-300">
        <div className="w-full max-w-md bg-gray-50 dark:bg-gray-950 h-full relative flex flex-col shadow-2xl">
          <div className="bg-white dark:bg-gray-900 px-4 py-3 flex justify-between items-center z-10 shadow-sm border-b border-gray-100 dark:border-gray-800 shrink-0">
            <div className="flex items-center space-x-2"><div className="w-8 h-8 bg-teal-500 rounded-lg flex items-center justify-center shadow-lg shadow-teal-500/20"><Wallet className="text-white w-5 h-5" /></div><h1 className="text-lg font-bold">Sổ Thu Chi</h1></div>
            <div className="flex items-center space-x-3"><div className="text-xs font-bold text-teal-600 bg-teal-50 dark:bg-teal-900/30 px-2 py-1 rounded-lg">👋 {activeUser}</div><button onClick={() => setIsDarkMode(!isDarkMode)} className="p-1.5 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors">{isDarkMode ? <Sun size={18} /> : <Moon size={18} />}</button></div>
          </div>
          {toastMsg && <div className="absolute top-16 left-1/2 -translate-x-1/2 z-[100] bg-gray-800/90 backdrop-blur text-white px-4 py-2 rounded-full text-sm font-medium shadow-xl animate-in slide-in-from-top-4 duration-300">{toastMsg}</div>}
          <div className="flex-1 overflow-y-auto w-full relative">
            {activeTab === 'dashboard' && renderDashboard()}
            {activeTab === 'add' && renderAdd()}
            {activeTab === 'history' && renderHistory()}
            {activeTab === 'stats' && renderStats()}
            {activeTab === 'settings' && renderSettings()}
          </div>
          <div className="bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 px-2 flex justify-between items-center pb-safe shrink-0 shadow-lg z-30">
            <button onClick={() => {setActiveTab('dashboard'); setSelectedReport(null); setEditTxId(null)}} className={`flex-1 flex flex-col items-center p-3 transition-all ${activeTab==='dashboard'?'text-teal-600 scale-110':'text-gray-400 opacity-70'}`}><Home size={22} strokeWidth={activeTab==='dashboard'?2.5:2}/><span className="text-[9px] mt-1 font-bold">Tổng quan</span></button>
            <button onClick={() => {setActiveTab('history'); setSelectedReport(null); setEditTxId(null)}} className={`flex-1 flex flex-col items-center p-3 transition-all ${activeTab==='history'?'text-teal-600 scale-110':'text-gray-400 opacity-70'}`}><ListIcon size={22} strokeWidth={activeTab==='history'?2.5:2}/><span className="text-[9px] mt-1 font-bold">Lịch sử</span></button>
            <button onClick={() => {setActiveTab('add'); setSelectedReport(null); setEditTxId(null)}} className="flex-1 flex flex-col items-center -translate-y-5 transition-transform hover:scale-105 active:scale-95"><div className="w-14 h-14 bg-teal-500 rounded-full flex items-center justify-center shadow-xl shadow-teal-500/30"><PlusCircle size={32} className="text-white" /></div></button>
            <button onClick={() => {setActiveTab('stats'); setSelectedReport(null); setEditTxId(null)}} className={`flex-1 flex flex-col items-center p-3 transition-all ${activeTab==='stats'?'text-teal-600 scale-110':'text-gray-400 opacity-70'}`}><PieChart size={22} strokeWidth={activeTab==='stats'?2.5:2}/><span className="text-[9px] mt-1 font-bold">Báo cáo</span></button>
            <button onClick={() => {setActiveTab('settings'); setSelectedReport(null); setEditTxId(null)}} className={`flex-1 flex flex-col items-center p-3 transition-all ${activeTab==='settings'?'text-teal-600 scale-110':'text-gray-400 opacity-70'}`}><Settings size={22} strokeWidth={activeTab==='settings'?2.5:2}/><span className="text-[9px] mt-1 font-bold">Cài đặt</span></button>
          </div>
          {renderConfirmModal()}
        </div>
      </div>
    </div>
  );
}
