import React, { useState, useMemo, useEffect } from 'react';
import { 
  Home, PlusCircle, List as ListIcon, Wallet, Trash2, Pencil,
  Calendar, AlignLeft, DollarSign, PieChart, Settings, 
  Plus, X, Lock, Download, Sun, Moon, Eye, EyeOff, 
  ChevronDown, ChevronRight, ArrowLeft, ChevronLeft, Save
} from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
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
const appId = 'so-thu-chi-app';

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
  const num = value.replace(/\D/g, ''); 
  if (!num) return '';
  return new Intl.NumberFormat('vi-VN').format(num);
};

const parseInputNumber = (value) => {
  if (!value) return 0;
  return parseInt(value.replace(/\./g, ''), 10);
};

// Utils
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
  // --- TOP-LEVEL HOOKS ---
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState(false);
  const [activeUser, setActiveUser] = useState(''); // Hạnh hoặc Linh

  const [isDarkMode, setIsDarkMode] = useState(false);
  const [showBalance, setShowBalance] = useState(true);

  const [user, setUser] = useState(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard');
  
  const [transactions, setTransactions] = useState([]);
  const [categories, setCategories] = useState({ expense: [], income: [] });
  const [initialBalance, setInitialBalance] = useState(0);
  
  // Form Thêm giao dịch
  const [formType, setFormType] = useState('expense');
  const [formAmount, setFormAmount] = useState(''); 
  const [formCategory, setFormCategory] = useState(null);
  const [formDate, setFormDate] = useState(new Date().toISOString().split('T')[0]);
  const [formNote, setFormNote] = useState('');

  // Form Sửa giao dịch (Edit Modal)
  const [editTxId, setEditTxId] = useState(null);
  const [editFormType, setEditFormType] = useState('expense');
  const [editFormAmount, setEditFormAmount] = useState(''); 
  const [editFormCategory, setEditFormCategory] = useState(null);
  const [editFormDate, setEditFormDate] = useState('');
  const [editFormNote, setEditFormNote] = useState('');

  // Cài đặt danh mục
  const [newCatName, setNewCatName] = useState('');
  const [newCatIcon, setNewCatIcon] = useState('📦');
  const [manageType, setManageType] = useState('expense');
  const [showPicker, setShowPicker] = useState(false);

  // Báo cáo
  const [statsTab, setStatsTab] = useState('current'); 
  const [statsYear, setStatsYear] = useState(new Date().getFullYear());
  const [selectedReport, setSelectedReport] = useState(null); 
  const [reportDetailType, setReportDetailType] = useState('expense'); 

  // Lịch sử
  const [historyMonth, setHistoryMonth] = useState(new Date().getMonth() + 1);
  const [historyYear, setHistoryYear] = useState(new Date().getFullYear());

  // Modal & Toast
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, message: '', onConfirm: null });
  const [toastMsg, setToastMsg] = useState('');

  // Cài đặt số dư
  const [editBalance, setEditBalance] = useState(false);
  const [tempBalanceStr, setTempBalanceStr] = useState('');

  // --- LOGIC ---

  const handleUnlock = (e) => {
    e.preventDefault();
    if (pin === '2708') { setIsUnlocked(true); setPinError(false); setActiveUser('Hạnh'); } 
    else if (pin === '1201') { setIsUnlocked(true); setPinError(false); setActiveUser('Linh'); } 
    else { setPinError(true); setPin(''); }
  };

  const showToast = (msg) => { setToastMsg(msg); setTimeout(() => setToastMsg(''), 3000); };

  useEffect(() => {
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else { await signInAnonymously(auth); }
      } catch (error) { console.error("Auth error:", error); }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => { setUser(currentUser); setIsAuthReady(true); });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user || !isUnlocked) return;
    const txRef = collection(db, 'artifacts', appId, 'public', 'data', 'transactions');
    const catRef = collection(db, 'artifacts', appId, 'public', 'data', 'categories');
    const accRef = doc(db, 'artifacts', appId, 'public', 'data', 'account', 'balance');

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
      const txRef = collection(db, 'artifacts', appId, 'public', 'data', 'transactions');
      await addDoc(txRef, {
        type: formType, amount: amount, category: formCategory.name,
        categoryIcon: formCategory.icon, date: formDate, note: formNote, 
        createdBy: activeUser, // Lưu người nhập
        createdAt: new Date().toISOString()
      });
      setFormAmount(''); setFormNote(''); 
      showToast('Đã lưu giao dịch!'); 
    } catch (error) { console.error("Lỗi khi lưu:", error); }
  };

  const openEditModal = (tx) => {
    setEditTxId(tx.id);
    setEditFormType(tx.type);
    setEditFormAmount(formatInputNumber(tx.amount.toString()));
    setEditFormDate(tx.date);
    setEditFormNote(tx.note || '');
    
    // Tìm danh mục tương ứng
    const catList = categories[tx.type];
    const cat = catList.find(c => c.name === tx.category) || { name: tx.category, icon: tx.categoryIcon };
    setEditFormCategory(cat);
  };

  const handleUpdateTransaction = async (e) => {
    e.preventDefault();
    const amount = parseInputNumber(editFormAmount);
    if (!user || amount <= 0 || !editFormCategory) return;
    try {
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'transactions', editTxId), {
        type: editFormType, amount: amount, category: editFormCategory.name,
        categoryIcon: editFormCategory.icon, date: editFormDate, note: editFormNote, 
        updatedAt: new Date().toISOString()
      });
      setEditTxId(null);
      showToast('Đã cập nhật giao dịch!');
    } catch (error) { console.error("Lỗi cập nhật:", error); }
  };

  const confirmDeleteTx = (id) => {
    setConfirmModal({
      isOpen: true, message: 'Bạn có chắc chắn muốn xóa giao dịch này?',
      onConfirm: async () => {
        await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'transactions', id));
        showToast('Đã xóa giao dịch');
      }
    });
  };

  const changeHistoryMonth = (step) => {
    let m = historyMonth + step;
    let y = historyYear;
    if (m > 12) { m = 1; y += 1; }
    else if (m < 1) { m = 12; y -= 1; }
    setHistoryMonth(m); setHistoryYear(y);
  };

  // ---- RENDER COMPONENTS ----

  if (!isUnlocked) {
    return (
      <div className={isDarkMode ? 'dark' : ''}>
        <div className="flex justify-center bg-gray-100 dark:bg-gray-900 h-[100dvh] w-full">
          <div className="w-full max-w-md bg-white dark:bg-gray-900 h-full relative flex flex-col justify-center items-center px-6 transition-colors duration-300">
            <button onClick={() => setIsDarkMode(!isDarkMode)} className="absolute top-6 right-6 p-2 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300">
              {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
            </button>
            <div className="w-20 h-20 bg-teal-50 dark:bg-teal-900/30 rounded-full flex items-center justify-center mb-6">
              <Lock className="text-teal-500 w-10 h-10" />
            </div>
            <h1 className="text-2xl font-bold text-gray-800 dark:text-white mb-2">Sổ Thu Chi</h1>
            <p className="text-gray-500 dark:text-gray-400 text-sm mb-8 text-center">Vui lòng nhập mã PIN để truy cập.</p>
            <form onSubmit={handleUnlock} className="w-full max-w-xs space-y-4">
              <input type="password" inputMode="numeric" maxLength={4} value={pin} onChange={(e) => setPin(e.target.value)} placeholder="••••"
                className={`w-full text-center text-3xl tracking-[1em] p-4 border-2 rounded-2xl focus:outline-none transition-colors dark:text-white ${pinError ? 'border-red-400 bg-red-50 dark:bg-red-900/20' : 'border-gray-200 dark:border-gray-700 focus:border-teal-500 bg-gray-50 dark:bg-gray-800'}`} />
              {pinError && <p className="text-red-500 text-sm text-center font-medium">Mã PIN không đúng!</p>}
              <button type="submit" className="w-full py-4 bg-teal-600 text-white font-bold rounded-xl shadow-lg active:scale-95 transition-transform">Mở Khóa</button>
            </form>
          </div>
        </div>
      </div>
    );
  }

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

  const renderEditModal = () => {
    if (!editTxId) return null;
    return (
      <div className="absolute inset-0 z-[50] bg-gray-50 dark:bg-gray-950 flex flex-col animate-in slide-in-from-bottom duration-200">
        <div className="bg-white dark:bg-gray-900 px-4 py-4 flex items-center shadow-sm border-b border-gray-100 dark:border-gray-800 shrink-0">
          <button type="button" onClick={() => setEditTxId(null)} className="mr-4 p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full">
            <X size={24} className="text-gray-700 dark:text-gray-200" />
          </button>
          <h2 className="text-xl font-bold text-gray-800 dark:text-white">Sửa giao dịch</h2>
        </div>

        <div className="flex-1 overflow-y-auto p-4 pb-24">
          <div className="flex bg-gray-200 dark:bg-gray-800 p-1 rounded-xl mb-6">
            <button type="button" className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${editFormType === 'expense' ? 'bg-white dark:bg-gray-700 shadow-sm text-red-600 dark:text-red-400' : 'text-gray-600 dark:text-gray-400'}`}
              onClick={() => { setEditFormType('expense'); setEditFormCategory(categories.expense[0] || null); }}>Khoản Chi</button>
            <button type="button" className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${editFormType === 'income' ? 'bg-white dark:bg-gray-700 shadow-sm text-emerald-600 dark:text-emerald-400' : 'text-gray-600 dark:text-gray-400'}`}
              onClick={() => { setEditFormType('income'); setEditFormCategory(categories.income[0] || null); }}>Khoản Thu</button>
          </div>
          
          <form onSubmit={handleUpdateTransaction} className="space-y-4 flex-1 pb-4">
            <div>
              <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Số tiền (VNĐ)</label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input type="text" inputMode="numeric" value={editFormAmount} onChange={(e) => setEditFormAmount(formatInputNumber(e.target.value))}
                  className="w-full pl-10 pr-3 py-3 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-teal-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-lg font-bold outline-none" required />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Danh mục</label>
              {(!categories[editFormType] || categories[editFormType].length === 0) ? (
                <div className="text-sm text-red-500 italic p-3 bg-red-50 dark:bg-red-900/20 rounded-xl">Chưa có danh mục.</div>
              ) : (
                <div className="grid grid-cols-4 gap-2">
                  {categories[editFormType]?.map((cat) => (
                    <button key={cat.id || cat.name} type="button" onClick={() => setEditFormCategory(cat)}
                      className={`flex flex-col items-center justify-center p-2 rounded-xl border transition-colors ${editFormCategory?.name === cat.name ? `border-${editFormType==='expense'?'red':'emerald'}-500 bg-${editFormType==='expense'?'red':'emerald'}-50 dark:bg-${editFormType==='expense'?'red':'emerald'}-900/20` : 'border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 opacity-70 hover:opacity-100'}`}>
                      <span className="text-xl mb-1">{cat.icon}</span>
                      <span className="text-[10px] font-medium text-gray-600 dark:text-gray-300 truncate w-full text-center">{cat.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="grid grid-cols-1 gap-4 bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm">
              <div>
                <label className="flex items-center text-xs font-medium text-gray-700 dark:text-gray-300 mb-1"><Calendar className="w-3 h-3 mr-1" /> Ngày</label>
                <input type="date" value={editFormDate} onChange={(e) => setEditFormDate(e.target.value)} className="w-full p-2 border-b border-gray-200 dark:border-gray-700 bg-transparent text-gray-900 dark:text-white text-sm focus:outline-none focus:border-teal-500" required />
              </div>
              <div>
                <label className="flex items-center text-xs font-medium text-gray-700 dark:text-gray-300 mb-1"><AlignLeft className="w-3 h-3 mr-1" /> Ghi chú</label>
                <input type="text" value={editFormNote} onChange={(e) => setEditFormNote(e.target.value)} className="w-full p-2 border-b border-gray-200 dark:border-gray-700 bg-transparent text-gray-900 dark:text-white text-sm focus:outline-none focus:border-teal-500" placeholder="Không bắt buộc..." />
              </div>
            </div>
            <button type="submit" disabled={!editFormCategory} className={`w-full py-4 rounded-xl text-white font-bold text-lg mt-4 shadow-lg ${editFormType === 'expense' ? 'bg-red-500 shadow-red-500/30 hover:bg-red-600' : 'bg-emerald-500 shadow-emerald-500/30 hover:bg-emerald-600'} ${!editFormCategory ? 'opacity-50' : 'active:scale-95'}`}>
              Cập nhật
            </button>
          </form>
        </div>
      </div>
    );
  };

  const renderDashboard = () => {
    const today = new Date();
    const currentMonthTx = transactions.filter(t => isSameMonth(new Date(t.date), today));
    
    let monthInc = 0; let monthExp = 0;
    const expByCategory = {};
    
    currentMonthTx.forEach(t => {
      if (t.type === 'income') monthInc += t.amount;
      else {
        monthExp += t.amount;
        expByCategory[t.category] = (expByCategory[t.category] || 0) + t.amount;
      }
    });

    const monthDiff = monthInc - monthExp;
    const maxBar = Math.max(monthInc, monthExp) || 1;
    const incHeight = (monthInc / maxBar) * 100;
    const expHeight = (monthExp / maxBar) * 100;

    let currentPct = 0;
    const donutData = Object.entries(expByCategory)
      .sort(([, a], [, b]) => b - a)
      .map(([name, amount], index) => {
        const percent = monthExp > 0 ? (amount / monthExp) * 100 : 0;
        const color = CHART_COLORS[index % CHART_COLORS.length];
        const start = currentPct;
        const end = start + percent;
        currentPct = end;
        return { name, amount, percent, color, start, end };
      });

    const conicStops = donutData.length > 0 
      ? donutData.map(d => `${d.color} ${d.start}% ${d.end}%`).join(', ')
      : '#e5e7eb 0% 100%';

    return (
      <div className="p-4 space-y-4 animate-in fade-in duration-300">
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-gray-700 transition-colors">
          <div className="flex items-center space-x-2 mb-2">
            <p className="text-gray-500 dark:text-gray-400 text-sm font-medium">Tổng số dư</p>
            <button onClick={() => setShowBalance(!showBalance)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
              {showBalance ? <Eye size={16} /> : <EyeOff size={16} />}
            </button>
          </div>
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white">
            {showBalance ? formatCurrency(balance) : '****** đ'}
          </h2>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-gray-700 transition-colors">
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-bold text-gray-800 dark:text-gray-100">Tình hình thu chi</h3>
            <div className="bg-gray-100 dark:bg-gray-700 px-3 py-1.5 rounded-lg text-xs font-medium flex items-center space-x-1 cursor-pointer">
              <Settings size={14} className="text-gray-500" />
              <span className="text-gray-700 dark:text-gray-200">Tháng này</span>
            </div>
          </div>
          
          <div className="flex items-end space-x-6 h-32 mb-2">
            <div className="flex items-end justify-center space-x-2 h-full w-24 shrink-0 border-b-2 border-gray-100 dark:border-gray-700 pb-1 relative">
              <div className="w-1/2 flex items-end justify-center h-full">
                <div className="w-full bg-emerald-500 rounded-t-sm" style={{ height: `${incHeight}%` }}></div>
              </div>
              <div className="w-1/2 flex items-end justify-center h-full">
                <div className="w-full bg-red-500 rounded-t-sm" style={{ height: `${expHeight}%` }}></div>
              </div>
            </div>
            
            <div className="flex-1 space-y-3 pb-2 text-sm">
              <div className="flex justify-between items-center">
                <span className="text-gray-500 dark:text-gray-400">Thu</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400">{showBalance ? formatCurrency(monthInc) : '******'}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-500 dark:text-gray-400">Chi</span>
                <span className="font-bold text-red-600 dark:text-red-400">{showBalance ? formatCurrency(monthExp) : '******'}</span>
              </div>
              <div className="w-full h-px bg-gray-100 dark:bg-gray-700"></div>
              <div className="flex justify-between items-center">
                <span className="text-gray-700 dark:text-gray-300 font-medium">Chênh lệch</span>
                <span className="font-bold text-gray-900 dark:text-white">{showBalance ? formatCurrency(monthDiff) : '******'}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-gray-700 transition-colors">
          <div className="flex items-center space-x-6">
            <div className="relative w-32 h-32 rounded-full shrink-0 flex items-center justify-center" style={{ background: `conic-gradient(${conicStops})` }}>
              <div className="w-20 h-20 bg-white dark:bg-gray-800 rounded-full"></div>
            </div>
            <div className="flex-1 space-y-2">
              {donutData.length === 0 ? (
                <p className="text-xs text-gray-400 italic">Chưa có khoản chi nào.</p>
              ) : (
                donutData.slice(0, 5).map((d) => (
                  <div key={d.name} className="flex justify-between items-center text-xs">
                    <div className="flex items-center space-x-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: d.color }}></div>
                      <span className="text-gray-600 dark:text-gray-300 truncate max-w-[80px]">{d.name}</span>
                    </div>
                    <span className="font-bold text-gray-800 dark:text-gray-100">{d.percent.toFixed(2)}%</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div>
          <div className="flex justify-between items-center mb-4 mt-2">
            <h3 className="font-bold text-gray-800 dark:text-gray-100">Ghi chép gần đây</h3>
            <button onClick={() => setActiveTab('history')} className="text-xs text-gray-500 hover:text-teal-600 flex items-center">
              Xem thêm <ChevronRight size={14} />
            </button>
          </div>
          {transactions.length === 0 ? (
            <div className="text-center py-8 text-gray-400 bg-white dark:bg-gray-800 rounded-2xl border border-dashed border-gray-200 dark:border-gray-700">
              <p className="text-sm">Chưa có dữ liệu.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {transactions.slice(0, 4).map(t => (
                <div key={t.id} className="bg-white dark:bg-gray-800 p-3 rounded-xl shadow-sm border border-gray-50 dark:border-gray-700 flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg ${t.type === 'expense' ? 'bg-red-50 dark:bg-red-900/30' : 'bg-emerald-50 dark:bg-emerald-900/30'}`}>
                      {t.categoryIcon}
                    </div>
                    <div>
                      <p className="font-semibold text-gray-800 dark:text-gray-100 text-sm">{t.category}</p>
                      <p className="text-[10px] text-gray-500 dark:text-gray-400 line-clamp-1 flex items-center mt-0.5">
                        {t.note || new Date(t.date).toLocaleDateString('vi-VN')}
                        {t.createdBy && (
                          <span className={`ml-2 px-1.5 py-0.5 rounded-[4px] text-[8px] font-bold ${t.createdBy === 'Linh' ? 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400' : 'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400'}`}>
                            {t.createdBy}
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                  <div className={`font-bold text-sm ${t.type === 'expense' ? 'text-red-500' : 'text-emerald-500'}`}>
                    {t.type === 'expense' ? '-' : '+'}{formatCurrency(t.amount)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderAdd = () => (
    <div className="p-4 h-full flex flex-col animate-in fade-in duration-300">
      <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-4 text-center">Ghi chép</h2>
      <div className="flex bg-gray-200 dark:bg-gray-800 p-1 rounded-xl mb-6">
        <button type="button" className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${formType === 'expense' ? 'bg-white dark:bg-gray-700 shadow-sm text-red-600 dark:text-red-400' : 'text-gray-600 dark:text-gray-400'}`}
          onClick={() => { setFormType('expense'); setFormCategory(categories.expense[0] || null); }}>Khoản Chi</button>
        <button type="button" className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${formType === 'income' ? 'bg-white dark:bg-gray-700 shadow-sm text-emerald-600 dark:text-emerald-400' : 'text-gray-600 dark:text-gray-400'}`}
          onClick={() => { setFormType('income'); setFormCategory(categories.income[0] || null); }}>Khoản Thu</button>
      </div>
      <form onSubmit={handleAddTransaction} className="space-y-4 flex-1 pb-4">
        <div>
          <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Số tiền (VNĐ)</label>
          <div className="relative">
            <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input 
              type="text" inputMode="numeric" 
              value={formAmount} onChange={(e) => setFormAmount(formatInputNumber(e.target.value))}
              className="w-full pl-10 pr-3 py-3 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-teal-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-lg font-bold transition-colors outline-none" placeholder="0" required />
          </div>
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Danh mục</label>
          {(!categories[formType] || categories[formType].length === 0) ? (
            <div className="text-sm text-red-500 italic p-3 bg-red-50 dark:bg-red-900/20 rounded-xl">Chưa có danh mục.</div>
          ) : (
            <div className="grid grid-cols-4 gap-2">
              {categories[formType]?.map((cat) => (
                <button key={cat.id || cat.name} type="button" onClick={() => setFormCategory(cat)}
                  className={`flex flex-col items-center justify-center p-2 rounded-xl border transition-colors ${formCategory?.name === cat.name ? `border-${formType==='expense'?'red':'emerald'}-500 bg-${formType==='expense'?'red':'emerald'}-50 dark:bg-${formType==='expense'?'red':'emerald'}-900/20` : 'border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 opacity-70 hover:opacity-100'}`}>
                  <span className="text-xl mb-1">{cat.icon}</span>
                  <span className="text-[10px] font-medium text-gray-600 dark:text-gray-300 truncate w-full text-center">{cat.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="grid grid-cols-1 gap-4 bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm transition-colors">
          <div>
            <label className="flex items-center text-xs font-medium text-gray-700 dark:text-gray-300 mb-1"><Calendar className="w-3 h-3 mr-1" /> Ngày</label>
            <input type="date" value={formDate} onChange={(e) => setFormDate(e.target.value)} className="w-full p-2 border-b border-gray-200 dark:border-gray-700 bg-transparent text-gray-900 dark:text-white text-sm focus:outline-none focus:border-teal-500" required />
          </div>
          <div>
            <label className="flex items-center text-xs font-medium text-gray-700 dark:text-gray-300 mb-1"><AlignLeft className="w-3 h-3 mr-1" /> Ghi chú</label>
            <input type="text" value={formNote} onChange={(e) => setFormNote(e.target.value)} className="w-full p-2 border-b border-gray-200 dark:border-gray-700 bg-transparent text-gray-900 dark:text-white text-sm focus:outline-none focus:border-teal-500 placeholder-gray-400" placeholder="Không bắt buộc..." />
          </div>
        </div>
        <button type="submit" disabled={!formCategory} className={`w-full py-4 rounded-xl text-white font-bold text-lg mt-4 shadow-lg ${formType === 'expense' ? 'bg-red-500 shadow-red-500/30 hover:bg-red-600' : 'bg-emerald-500 shadow-emerald-500/30 hover:bg-emerald-600'} ${!formCategory ? 'opacity-50' : 'active:scale-95'}`}>Lưu Giao Dịch</button>
      </form>
    </div>
  );

  const renderHistory = () => {
    const filteredHistory = transactions.filter(t => {
      const d = new Date(t.date);
      return (d.getMonth() + 1) === historyMonth && d.getFullYear() === historyYear;
    });

    let historyInc = 0; let historyExp = 0;
    filteredHistory.forEach(t => { if(t.type === 'income') historyInc+=t.amount; else historyExp+=t.amount; });

    const grouped = filteredHistory.reduce((acc, t) => {
      if (!acc[t.date]) acc[t.date] = [];
      acc[t.date].push(t); return acc;
    }, {});
    const sortedDates = Object.keys(grouped).sort((a, b) => new Date(b) - new Date(a));

    const isCurrentMonth = historyMonth === new Date().getMonth() + 1 && historyYear === new Date().getFullYear();
    const monthLabel = isCurrentMonth ? 'Tháng này' : `Tháng ${historyMonth}/${historyYear}`;

    return (
      <div className="p-4 animate-in fade-in duration-300">
        <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-4 text-center">Lịch sử ghi chép</h2>
        
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-700 mb-6">
          <div className="flex justify-between items-center mb-4">
            <button onClick={() => changeHistoryMonth(-1)} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full text-gray-500">
              <ChevronLeft size={20} />
            </button>
            <div className="font-bold text-teal-600 dark:text-teal-400 flex items-center">
              {monthLabel}
            </div>
            <button onClick={() => changeHistoryMonth(1)} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full text-gray-500">
              <ChevronRight size={20} />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-4 text-center">
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Tổng thu</p>
              <p className="font-bold text-emerald-500 text-sm">{formatCurrency(historyInc)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Tổng chi</p>
              <p className="font-bold text-red-500 text-sm">{formatCurrency(historyExp)}</p>
            </div>
          </div>
        </div>

        {filteredHistory.length === 0 ? (
          <div className="text-center py-10 text-gray-400"><p>Chưa có giao dịch.</p></div>
        ) : (
          <div className="space-y-6">
            {sortedDates.map(date => {
              const dayTotal = grouped[date].reduce((sum, t) => t.type === 'income' ? sum + t.amount : sum - t.amount, 0);
              const dateObj = new Date(date);
              const dateLabel = isSameDay(dateObj, new Date()) ? 'Hôm nay' 
                              : isSameDay(dateObj, new Date(Date.now() - 86400000)) ? 'Hôm qua' 
                              : dateObj.toLocaleDateString('vi-VN', {weekday: 'long'});
              return (
                <div key={date}>
                  <div className="flex justify-between items-end mb-2 px-1">
                    <div>
                      <h3 className="font-bold text-gray-800 dark:text-gray-200 text-sm">{new Date(date).toLocaleDateString('vi-VN', {day: '2-digit', month: '2-digit', year: 'numeric'})}</h3>
                      <p className="text-xs text-gray-500">{dateLabel}</p>
                    </div>
                    <span className={`text-sm font-bold ${dayTotal >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>{dayTotal >= 0 ? '+' : ''}{formatCurrency(dayTotal)}</span>
                  </div>
                  <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
                    {grouped[date].map((t, idx) => (
                      <div key={t.id} className={`p-3 flex items-center justify-between ${idx !== grouped[date].length - 1 ? 'border-b border-gray-50 dark:border-gray-700' : ''}`}>
                        <div className="flex items-center space-x-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm ${t.type === 'expense' ? 'bg-red-50 dark:bg-red-900/30' : 'bg-emerald-50 dark:bg-emerald-900/30'} shrink-0`}>{t.categoryIcon}</div>
                          <div>
                            <p className="font-semibold text-gray-800 dark:text-gray-100 text-sm">{t.category}</p>
                            <p className="text-[10px] text-gray-500 dark:text-gray-400 line-clamp-1 flex items-center mt-0.5">
                              {t.note || new Date(t.date).toLocaleDateString('vi-VN')}
                              {t.createdBy && (
                                <span className={`ml-2 px-1.5 py-0.5 rounded-[4px] text-[8px] font-bold shrink-0 ${t.createdBy === 'Linh' ? 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400' : 'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400'}`}>
                                  {t.createdBy}
                                </span>
                              )}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-1 shrink-0">
                          <span className={`font-bold text-sm mr-2 ${t.type === 'expense' ? 'text-red-500' : 'text-emerald-500'}`}>{t.type === 'expense' ? '-' : '+'}{formatCurrency(t.amount)}</span>
                          <button onClick={() => openEditModal(t)} className="p-1.5 text-gray-300 dark:text-gray-500 hover:text-teal-600 dark:hover:text-teal-400 rounded-full"><Pencil size={14} /></button>
                          <button onClick={() => confirmDeleteTx(t.id)} className="p-1.5 text-gray-300 dark:text-gray-500 hover:text-red-500 dark:hover:text-red-400 rounded-full"><Trash2 size={14} /></button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  const renderReportDetail = () => {
    const filteredTx = transactions.filter(t => selectedReport.filterFn(new Date(t.date)));
    const typeTx = filteredTx.filter(t => t.type === reportDetailType);
    const totalAmount = typeTx.reduce((sum, t) => sum + t.amount, 0);

    const groupedData = typeTx.reduce((acc, t) => {
      acc[t.category] = (acc[t.category] || 0) + t.amount;
      return acc;
    }, {});

    let currentPct = 0;
    const chartData = Object.entries(groupedData)
      .sort(([, a], [, b]) => b - a)
      .map(([name, amount], index) => {
        const percent = totalAmount > 0 ? (amount / totalAmount) * 100 : 0;
        const color = CHART_COLORS[index % CHART_COLORS.length];
        const icon = categories[reportDetailType]?.find(c => c.name === name)?.icon || '📦';
        const start = currentPct;
        const end = start + percent;
        currentPct = end;
        return { name, amount, percent, color, icon, start, end };
      });

    const conicStops = chartData.length > 0 ? chartData.map(d => `${d.color} ${d.start}% ${d.end}%`).join(', ') : '#e5e7eb 0% 100%';

    return (
      <div className="h-full flex flex-col bg-gray-50 dark:bg-gray-950 absolute inset-0 z-[40] animate-in slide-in-from-right duration-200">
        <div className="bg-white dark:bg-gray-900 px-4 py-4 flex items-center shadow-sm border-b border-gray-100 dark:border-gray-800 shrink-0">
          <button onClick={() => setSelectedReport(null)} className="mr-4 p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full">
            <ArrowLeft size={24} className="text-gray-700 dark:text-gray-200" />
          </button>
          <h2 className="text-xl font-bold text-gray-800 dark:text-white">{selectedReport.title}</h2>
        </div>
        <div className="flex border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shrink-0">
          <button onClick={() => setReportDetailType('expense')} className={`flex-1 py-3 text-sm font-bold text-center border-b-2 transition-colors ${reportDetailType === 'expense' ? 'border-teal-500 text-teal-600 dark:text-teal-400' : 'border-transparent text-gray-500 dark:text-gray-400'}`}>Chi tiền</button>
          <button onClick={() => setReportDetailType('income')} className={`flex-1 py-3 text-sm font-bold text-center border-b-2 transition-colors ${reportDetailType === 'income' ? 'border-teal-500 text-teal-600 dark:text-teal-400' : 'border-transparent text-gray-500 dark:text-gray-400'}`}>Thu tiền</button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-gray-700">
            <div className="flex justify-between items-center mb-6">
              <span className="text-gray-500 dark:text-gray-400 font-medium">Tổng {reportDetailType === 'expense' ? 'chi' : 'thu'}</span>
              <span className={`text-xl font-bold ${reportDetailType === 'expense' ? 'text-red-500' : 'text-emerald-500'}`}>{formatCurrency(totalAmount)}</span>
            </div>
            <div className="flex items-center space-x-6">
              <div className="relative w-32 h-32 rounded-full shrink-0 flex items-center justify-center" style={{ background: `conic-gradient(${conicStops})` }}>
                <div className="w-20 h-20 bg-white dark:bg-gray-800 rounded-full"></div>
              </div>
              <div className="flex-1 space-y-2">
                {chartData.length === 0 ? <p className="text-xs text-gray-400">Không có dữ liệu.</p> :
                  chartData.slice(0, 5).map((d) => (
                    <div key={d.name} className="flex justify-between items-center text-xs">
                      <div className="flex items-center space-x-2"><div className="w-3 h-3 rounded-full" style={{ backgroundColor: d.color }}></div><span className="text-gray-600 dark:text-gray-300 truncate max-w-[80px]">{d.name}</span></div>
                      <span className="font-bold text-gray-800 dark:text-gray-100">{d.percent.toFixed(2)}%</span>
                    </div>
                  ))
                }
              </div>
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
            {chartData.length === 0 ? <div className="text-center py-8 text-gray-400 text-sm">Chưa có giao dịch.</div> : (
              chartData.map((d, index) => (
                <div key={d.name} className={`flex justify-between items-center p-4 ${index !== chartData.length - 1 ? 'border-b border-gray-50 dark:border-gray-700' : ''}`}>
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center text-lg bg-gray-50 dark:bg-gray-700 border border-gray-100 dark:border-gray-600">{d.icon}</div>
                    <span className="font-semibold text-gray-800 dark:text-gray-100 text-sm">{d.name}</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="text-xs text-gray-400">({d.percent.toFixed(2)}%)</span>
                    <span className="font-bold text-gray-900 dark:text-white text-sm">{formatCurrency(d.amount)}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderStats = () => {
    if (selectedReport) return renderReportDetail();

    const calculateSummaryRow = (label, isIncludedFn, onClickItem = null) => {
      let inc = 0; let exp = 0;
      transactions.filter(t => isIncludedFn(new Date(t.date))).forEach(t => {
        if(t.type === 'income') inc += t.amount; else exp += t.amount;
      });
      return { label, inc, exp, diff: inc - exp, onClickItem };
    };

    const renderSummaryItem = ({ label, inc, exp, diff, onClickItem }) => (
      <div key={label} onClick={onClickItem} className={`flex flex-col py-3 border-b border-gray-100 dark:border-gray-800 last:border-0 ${onClickItem ? 'cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 -mx-4 px-4 transition-colors' : ''}`}>
        <div className="flex justify-between items-center mb-1">
          <div className="flex items-center space-x-1">
            <span className="font-bold text-gray-800 dark:text-gray-100 text-sm">{label}</span>
            {onClickItem && <ChevronRight size={14} className="text-gray-400" />}
          </div>
          <span className="text-emerald-500 text-sm font-medium">{formatCurrency(inc)}</span>
        </div>
        <div className="flex justify-between items-center mb-1">
          <span></span><span className="text-red-500 text-sm font-medium">-{formatCurrency(exp)}</span>
        </div>
        <div className="flex justify-between items-center">
          <span></span>
          <span className={`text-sm font-bold ${diff >= 0 ? 'text-gray-900 dark:text-white' : 'text-red-500'}`}>
            {diff < 0 ? '-' : ''}{formatCurrency(Math.abs(diff))}
          </span>
        </div>
      </div>
    );

    const renderChart = (data, labels) => {
      const maxVal = Math.max(...data.map(d => Math.max(d.inc, d.exp)), 1); 
      return (
        <div className="mt-6 mb-8">
          <p className="text-[10px] text-gray-400 mb-2">Đơn vị: đ</p>
          <div className="h-40 flex space-x-1 border-b border-gray-200 dark:border-gray-700 relative">
            <div className="absolute w-full h-px bg-gray-300 dark:bg-gray-600 top-1/2"></div>
            {data.map((col, i) => {
              const hInc = (col.inc / maxVal) * 100; 
              const hExp = (col.exp / maxVal) * 100;
              return (
                <div key={i} className="flex-1 flex flex-col h-full z-10 group">
                  <div className="w-full flex-1 flex flex-col justify-end items-center pb-[1px]">
                    <div className="w-2/3 max-w-[14px] bg-emerald-500 rounded-t-sm transition-all duration-500" style={{ height: `${hInc}%` }}></div>
                  </div>
                  <div className="w-full flex-1 flex flex-col justify-start items-center pt-[1px]">
                    <div className="w-2/3 max-w-[14px] bg-red-500 rounded-b-sm transition-all duration-500" style={{ height: `${hExp}%` }}></div>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="flex space-x-1 mt-2">
            {labels.map((l, i) => <div key={i} className="flex-1 text-center text-[10px] text-gray-500">{l}</div>)}
          </div>
          <div className="flex justify-center items-center space-x-4 mt-6">
            <div className="flex items-center space-x-1"><div className="w-2 h-2 bg-emerald-500 rounded-sm"></div><span className="text-xs text-gray-500">Thu</span></div>
            <div className="flex items-center space-x-1"><div className="w-2 h-2 bg-red-500 rounded-sm"></div><span className="text-xs text-gray-500">Chi</span></div>
          </div>
        </div>
      );
    };

    return (
      <div className="flex flex-col h-full animate-in fade-in duration-300">
        <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-4 text-center mt-4">Báo cáo</h2>
        <div className="flex border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 sticky top-0 z-10 px-2 shrink-0">
          {['current','month','quarter','year'].map(tab => {
            const labels = { current: 'Hiện tại', month: 'Tháng', quarter: 'Quý', year: 'Năm' };
            return (
              <button key={tab} onClick={() => setStatsTab(tab)} className={`flex-1 py-3 text-sm font-medium text-center border-b-2 transition-colors ${statsTab === tab ? 'border-teal-500 text-teal-600 dark:text-teal-400' : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}>
                {labels[tab]}
              </button>
            )
          })}
        </div>

        <div className="p-4 flex-1">
          {statsTab !== 'current' && (
            <div className="flex items-center justify-between bg-white dark:bg-gray-800 p-3 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 mb-4">
              <div className="flex items-center text-gray-600 dark:text-gray-300"><Calendar size={16} className="mr-2"/> <span className="text-sm">Năm {statsYear}</span></div>
              <select value={statsYear} onChange={e=>setStatsYear(Number(e.target.value))} className="bg-transparent text-sm font-bold outline-none text-gray-800 dark:text-white">
                {[2023, 2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
          )}

          <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-700 min-h-[300px]">
            {statsTab === 'current' && (
              <div className="space-y-2">
                {(() => {
                  const today = new Date();
                  return [
                    calculateSummaryRow('Hôm nay', d => isSameDay(d, today), () => setSelectedReport({ title: 'Hôm nay', filterFn: d => isSameDay(d, today) })),
                    calculateSummaryRow('Tuần này', d => isSameWeek(d, today), () => setSelectedReport({ title: 'Tuần này', filterFn: d => isSameWeek(d, today) })),
                    calculateSummaryRow('Tháng này', d => isSameMonth(d, today), () => setSelectedReport({ title: 'Tháng này', filterFn: d => isSameMonth(d, today) })),
                    calculateSummaryRow('Quý này', d => isSameQuarter(d, today), () => setSelectedReport({ title: 'Quý này', filterFn: d => isSameQuarter(d, today) })),
                    calculateSummaryRow('Năm này', d => isSameYear(d, today), () => setSelectedReport({ title: 'Năm này', filterFn: d => isSameYear(d, today) }))
                  ].map(renderSummaryItem);
                })()}
              </div>
            )}

            {statsTab === 'month' && (() => {
              const data = Array(12).fill(0).map(() => ({ inc: 0, exp: 0 }));
              transactions.forEach(t => {
                const d = new Date(t.date);
                if(d.getFullYear() === statsYear) {
                  const m = d.getMonth();
                  if(t.type === 'income') data[m].inc += t.amount; else data[m].exp += t.amount;
                }
              });
              const labels = ['1','2','3','4','5','6','7','8','9','10','11','12'];
              const listData = data.map((d, i) => ({ 
                label: `Tháng ${i+1}`, inc: d.inc, exp: d.exp, diff: d.inc - d.exp,
                onClickItem: () => setSelectedReport({ title: `${i+1}/${statsYear}`, filterFn: (date) => date.getFullYear() === statsYear && date.getMonth() === i })
              })).filter(d => d.inc > 0 || d.exp > 0).reverse();

              return (
                <div>
                  {renderChart(data, labels)}
                  <div className="mt-8 border-t border-gray-100 dark:border-gray-800">
                    {listData.length === 0 ? <p className="text-center py-4 text-sm text-gray-400">Chưa có số liệu.</p> : listData.map(renderSummaryItem)}
                  </div>
                </div>
              );
            })()}

            {statsTab === 'quarter' && (() => {
              const data = Array(4).fill(0).map(() => ({ inc: 0, exp: 0 }));
              transactions.forEach(t => {
                const d = new Date(t.date);
                if(d.getFullYear() === statsYear) {
                  const q = getQuarter(d) - 1;
                  if(t.type === 'income') data[q].inc += t.amount; else data[q].exp += t.amount;
                }
              });
              const labels = ['Quý I', 'Quý II', 'Quý III', 'Quý IV'];
              const listData = data.map((d, i) => ({ 
                label: labels[i], inc: d.inc, exp: d.exp, diff: d.inc - d.exp,
                onClickItem: () => setSelectedReport({ title: `${labels[i]} - ${statsYear}`, filterFn: (date) => date.getFullYear() === statsYear && getQuarter(date) === i + 1 })
              })).filter(d => d.inc > 0 || d.exp > 0).reverse();

              return (
                <div>
                  {renderChart(data, labels)}
                  <div className="mt-8 border-t border-gray-100 dark:border-gray-800">
                    {listData.length === 0 ? <p className="text-center py-4 text-sm text-gray-400">Chưa có số liệu.</p> : listData.map(renderSummaryItem)}
                  </div>
                </div>
              );
            })()}

            {statsTab === 'year' && (() => {
              const data = [{ inc: 0, exp: 0 }];
              transactions.forEach(t => {
                if(new Date(t.date).getFullYear() === statsYear) {
                  if(t.type === 'income') data[0].inc += t.amount; else data[0].exp += t.amount;
                }
              });
              const listData = [{ 
                label: `${statsYear}`, inc: data[0].inc, exp: data[0].exp, diff: data[0].inc - data[0].exp,
                onClickItem: () => setSelectedReport({ title: `Năm ${statsYear}`, filterFn: (date) => date.getFullYear() === statsYear })
              }].filter(d => d.inc > 0 || d.exp > 0);

              return (
                <div>
                  <div className="mt-6 mb-8 px-10">
                    <div className="h-40 flex items-end justify-center space-x-2 border-b border-gray-200 dark:border-gray-700 pb-0 relative">
                       <div className="absolute w-full h-px bg-gray-300 dark:bg-gray-600 top-1/2"></div>
                       <div className="w-16 h-full flex flex-col justify-end items-center pb-[1px] z-10"><div className="w-full max-w-[32px] bg-emerald-500 rounded-t-sm" style={{height: data[0].inc > 0 ? '50%' : '0%'}}></div></div>
                       <div className="w-16 h-full flex flex-col justify-start items-center pt-[1px] z-10"><div className="w-full max-w-[32px] bg-red-500 rounded-b-sm" style={{height: data[0].exp > 0 ? `${(data[0].exp/Math.max(data[0].inc, 1))*50}%` : '0%'}}></div></div>
                    </div>
                    <div className="text-center text-xs mt-2 text-gray-500">{statsYear}</div>
                  </div>
                  <div className="mt-8 border-t border-gray-100 dark:border-gray-800">
                    {listData.length === 0 ? <p className="text-center py-4 text-sm text-gray-400">Chưa có số liệu.</p> : listData.map(renderSummaryItem)}
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      </div>
    );
  };

  const renderSettings = () => {
    const handleUpdateBalance = async () => {
      const num = parseInputNumber(tempBalanceStr);
      try {
        await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'account', 'balance'), { amount: num });
        setEditBalance(false); showToast('Đã cập nhật số dư!');
      } catch (e) { console.error(e); }
    };

    const handleAddCategory = async (e) => {
      e.preventDefault();
      if (!user || !newCatName) return;
      try {
        await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'categories'), { name: newCatName, icon: newCatIcon, type: manageType });
        setNewCatName(''); setShowPicker(false); showToast('Đã thêm danh mục mới');
      } catch (error) { console.error("Lỗi thêm danh mục", error); }
    };

    const confirmDeleteCategory = (id) => {
      setConfirmModal({
        isOpen: true, message: 'Xóa danh mục này? (Các giao dịch cũ vẫn giữ nguyên tên)',
        onConfirm: async () => {
          await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'categories', id));
          showToast('Đã xóa danh mục');
        }
      });
    };

    const handleExportCSV = () => {
      const headers = ['Ngay', 'Loai', 'Danh muc', 'So tien', 'Ghi chu', 'Nguoi nhap'];
      const csvData = transactions.map(t => [t.date, t.type === 'income' ? 'Thu' : 'Chi', t.category, t.amount, t.note || '', t.createdBy || '']);
      const link = document.createElement("a");
      link.href = encodeURI("data:text/csv;charset=utf-8," + headers.join(",") + "\n" + csvData.map(e => e.join(",")).join("\n"));
      link.download = `SoThuChi_Export.csv`;
      document.body.appendChild(link); link.click(); document.body.removeChild(link);
      showToast('Đã tải file Excel');
    };

    const handleGenerateMockData = async () => {
      const txRef = collection(db, 'artifacts', appId, 'public', 'data', 'transactions');
      for(let i=0; i<30; i++) {
        const type = Math.random() > 0.7 ? 'income' : 'expense';
        const catList = categories[type];
        if(!catList || catList.length === 0) continue;
        const cat = catList[Math.floor(Math.random() * catList.length)];
        const date = new Date(); date.setDate(date.getDate() - Math.floor(Math.random() * 90));
        await addDoc(txRef, { type, amount: Math.floor(Math.random() * 50) * 50000 + 50000, category: cat.name, categoryIcon: cat.icon, date: date.toISOString().split('T')[0], note: 'Dữ liệu mẫu', createdBy: Math.random() > 0.5 ? 'Linh' : 'Hạnh', createdAt: new Date().toISOString() });
      }
      showToast('Đã tạo 30 giao dịch mẫu!');
    };

    return (
      <div className="p-4 animate-in fade-in duration-300">
        <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-6 text-center mt-4">Cài Đặt</h2>
        
        <h3 className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase mb-3">Tài khoản</h3>
        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 mb-8">
          <div className="flex justify-between items-center mb-2">
            <span className="text-gray-700 dark:text-gray-300 font-medium text-sm">Số dư ban đầu</span>
            {!editBalance && (
               <button onClick={() => { setTempBalanceStr(formatInputNumber(initialBalance.toString())); setEditBalance(true); }} className="text-teal-600 text-xs font-bold hover:underline">Điều chỉnh</button>
            )}
          </div>
          {editBalance ? (
            <div className="flex items-center space-x-2">
              <input type="text" inputMode="numeric" value={tempBalanceStr} onChange={(e) => setTempBalanceStr(formatInputNumber(e.target.value))} className="flex-1 w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-gray-900 dark:text-white font-bold outline-none focus:border-teal-500" />
              <button onClick={handleUpdateBalance} className="bg-teal-500 text-white p-2 rounded-lg flex items-center shrink-0"><Save size={18} /></button>
              <button onClick={() => setEditBalance(false)} className="bg-gray-100 text-gray-600 p-2 rounded-lg shrink-0"><X size={18} /></button>
            </div>
          ) : (
            <p className="text-xl font-bold text-gray-900 dark:text-white">{formatCurrency(initialBalance)}</p>
          )}
        </div>

        <h3 className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase mb-3">Công cụ</h3>
        <div className="grid grid-cols-2 gap-3 mb-8">
          <button onClick={handleExportCSV} className="flex flex-col items-center justify-center p-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
            <Download size={24} className="text-teal-600 mb-2" />
            <span className="text-xs font-medium text-gray-700 dark:text-gray-300">Xuất file CSV</span>
          </button>
          <button onClick={handleGenerateMockData} className="flex flex-col items-center justify-center p-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
            <ListIcon size={24} className="text-purple-600 mb-2" />
            <span className="text-xs font-medium text-gray-700 dark:text-gray-300">Tạo Data Mẫu</span>
          </button>
        </div>

        <h3 className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase mb-3">Quản lý danh mục</h3>
        <div className="flex bg-gray-200 dark:bg-gray-800 p-1 rounded-xl mb-4">
          <button type="button" className={`flex-1 py-1.5 rounded-lg text-sm font-medium ${manageType === 'expense' ? 'bg-white dark:bg-gray-700 shadow-sm text-gray-800 dark:text-white' : 'text-gray-500'}`} onClick={() => setManageType('expense')}>Khoản Chi</button>
          <button type="button" className={`flex-1 py-1.5 rounded-lg text-sm font-medium ${manageType === 'income' ? 'bg-white dark:bg-gray-700 shadow-sm text-gray-800 dark:text-white' : 'text-gray-500'}`} onClick={() => setManageType('income')}>Khoản Thu</button>
        </div>

        <form onSubmit={handleAddCategory} className="mb-6 relative z-30">
          <div className="flex space-x-2 bg-white dark:bg-gray-800 p-3 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
            <button type="button" onClick={() => setShowPicker(!showPicker)} className="w-12 h-10 flex items-center justify-center text-xl bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
              {newCatIcon}
            </button>
            <input type="text" value={newCatName} onChange={e => setNewCatName(e.target.value)} placeholder="Tên mục mới..." className="flex-1 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white rounded-lg px-3 border-0 outline-none text-sm w-[100px]" required />
            <button type="submit" className="bg-teal-500 text-white px-3 rounded-lg shrink-0"><Plus size={20} /></button>
          </div>
          {showPicker && (
            <div className="absolute top-16 left-0 z-50 w-full bg-white dark:bg-gray-800 p-3 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 grid grid-cols-7 gap-2">
              {EMOJI_LIST.map(emoji => (
                <button key={emoji} type="button" onClick={() => { setNewCatIcon(emoji); setShowPicker(false); }} className="text-2xl p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">{emoji}</button>
              ))}
            </div>
          )}
        </form>

        <div className="space-y-2">
          {categories[manageType]?.map(cat => (
            <div key={cat.id || cat.name} className="flex justify-between items-center bg-white dark:bg-gray-800 p-3 rounded-xl border border-gray-100 dark:border-gray-700">
              <div className="flex items-center space-x-3"><span className="text-2xl">{cat.icon}</span><span className="font-medium text-sm text-gray-700 dark:text-gray-200">{cat.name}</span></div>
              {cat.id && <button onClick={() => confirmDeleteCategory(cat.id)} className="text-gray-400 hover:text-red-500 p-1"><X size={16} /></button>}
            </div>
          ))}
        </div>
        <div className="mt-10 text-center pb-8">
          <button onClick={() => setIsUnlocked(false)} className="text-sm text-red-500 font-medium px-4 py-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg">Khóa ứng dụng</button>
        </div>
      </div>
    );
  };

  if (!isAuthReady) return <div className="flex justify-center items-center h-[100dvh] bg-gray-50 dark:bg-gray-900"><p className="text-teal-600 font-medium animate-pulse">Đang kết nối đám mây...</p></div>;

  return (
    <div className={isDarkMode ? 'dark' : ''}>
      <div className="flex justify-center bg-gray-100 dark:bg-gray-900 h-[100dvh] w-full text-gray-800 dark:text-gray-100 overflow-hidden transition-colors duration-300">
        <div className="w-full max-w-md bg-gray-50 dark:bg-gray-950 h-full relative flex flex-col shadow-2xl">
          
          <div className="bg-white dark:bg-gray-900 px-4 py-3 flex justify-between items-center z-10 shadow-sm border-b border-gray-100 dark:border-gray-800 shrink-0 transition-colors">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-teal-500 rounded-lg flex items-center justify-center"><Wallet className="text-white w-5 h-5" /></div>
              <h1 className="text-lg font-bold">Sổ Thu Chi</h1>
            </div>
            <div className="flex items-center space-x-3">
              <div className="text-xs font-bold text-teal-600 bg-teal-50 dark:bg-teal-900/30 px-2 py-1 rounded-lg">👋 {activeUser}</div>
              <button onClick={() => setIsDarkMode(!isDarkMode)} className="p-1.5 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors">
                {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
              </button>
            </div>
          </div>

          {toastMsg && (
            <div className="absolute top-16 left-1/2 transform -translate-x-1/2 z-50 bg-gray-800 dark:bg-gray-200 text-white dark:text-gray-800 px-4 py-2 rounded-full shadow-lg text-sm font-medium animate-in slide-in-from-top-4 fade-in">
              {toastMsg}
            </div>
          )}

          <div className="flex-1 overflow-y-auto w-full relative">
            {activeTab === 'dashboard' && renderDashboard()}
            {activeTab === 'add' && renderAdd()}
            {activeTab === 'history' && renderHistory()}
            {activeTab === 'stats' && renderStats()}
            {activeTab === 'settings' && renderSettings()}
          </div>

          <div className="bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 px-2 flex justify-between items-center pb-safe shrink-0 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] z-30 transition-colors">
            <button onClick={() => {setActiveTab('dashboard'); setSelectedReport(null)}} className={`flex-1 flex flex-col items-center p-3 transition-colors ${activeTab === 'dashboard' ? 'text-teal-600 dark:text-teal-400' : 'text-gray-400 dark:text-gray-500'}`}>
              <Home size={22} strokeWidth={activeTab === 'dashboard' ? 2.5 : 2} />
              <span className="text-[9px] font-medium mt-1">Tổng quan</span>
            </button>
            <button onClick={() => {setActiveTab('history'); setSelectedReport(null)}} className={`flex-1 flex flex-col items-center p-3 transition-colors ${activeTab === 'history' ? 'text-teal-600 dark:text-teal-400' : 'text-gray-400 dark:text-gray-500'}`}>
              <ListIcon size={22} strokeWidth={activeTab === 'history' ? 2.5 : 2} />
              <span className="text-[9px] font-medium mt-1">Lịch sử</span>
            </button>
            <button onClick={() => {setActiveTab('add'); setSelectedReport(null)}} className="flex-1 flex flex-col items-center transform -translate-y-5">
              <div className={`w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-transform ${activeTab === 'add' ? 'bg-teal-600 scale-105 shadow-teal-500/30' : 'bg-teal-500 hover:bg-teal-600'}`}>
                <PlusCircle size={30} className="text-white" />
              </div>
            </button>
            <button onClick={() => {setActiveTab('stats'); setSelectedReport(null)}} className={`flex-1 flex flex-col items-center p-3 transition-colors ${activeTab === 'stats' ? 'text-teal-600 dark:text-teal-400' : 'text-gray-400 dark:text-gray-500'}`}>
              <PieChart size={22} strokeWidth={activeTab === 'stats' ? 2.5 : 2} />
              <span className="text-[9px] font-medium mt-1">Báo cáo</span>
            </button>
            <button onClick={() => {setActiveTab('settings'); setSelectedReport(null)}} className={`flex-1 flex flex-col items-center p-3 transition-colors ${activeTab === 'settings' ? 'text-teal-600 dark:text-teal-400' : 'text-gray-400 dark:text-gray-500'}`}>
              <Settings size={22} strokeWidth={activeTab === 'settings' ? 2.5 : 2} />
              <span className="text-[9px] font-medium mt-1">Cài đặt</span>
            </button>
          </div>

          {renderConfirmModal()}
          {renderEditModal()}
        </div>
      </div>
    </div>
  );
}
