import React, { useState, useEffect } from 'react';
import { pb, isUserLoggedIn, logoutUser, getCurrentUser } from './pb';
import Login from './components/Login';
import Hierarchy from './components/Hierarchy';
import PCOutcomes from './components/PCOutcomes';
import DCOutcomes from './components/DCOutcomes';
import Matrix from './components/Matrix';
import QuestionBank from './components/QuestionBank';
import GradeEntry from './components/GradeEntry';
import AnalysisPanel from './components/AnalysisPanel';
import ProgramReport from './components/ProgramReport';
import { 
  Home, Award, BookOpen, Grid3X3, FileText, 
  GraduationCap, BarChart2, Library, LogOut, Terminal, User, AlertCircle, Info, HelpCircle, CheckCircle2, X, AlertTriangle
} from 'lucide-react';

export default function App() {
  const [loggedIn, setLoggedIn] = useState(isUserLoggedIn());
  const [currentUser, setCurrentUser] = useState(getCurrentUser());
  const [activeModule, setActiveModule] = useState('m_home');
  const [logs, setLogs] = useState([]);

  // Database States
  const [programs, setPrograms] = useState([]);
  const [terms, setTerms] = useState([]);
  const [courses, setCourses] = useState([]);

  // Selections
  const [currentProgId, setCurrentProgId] = useState(null);
  const [currentTermId, setCurrentTermId] = useState(null);
  const [currentDersId, setCurrentDersId] = useState(null);

  // --- Global Custom Dialog Overlay State ---
  const [dialog, setDialog] = useState({
    isOpen: false,
    type: 'prompt', // 'prompt', 'confirm', 'fields', 'alert'
    title: '',
    message: '',
    inputValue: '',
    fields: [], // [{ label, key, placeholder, value }]
    onConfirm: () => {},
    onCancel: () => {}
  });

  // --- Toast Notifications ---
  const [toasts, setToasts] = useState([]);

  const addToast = (message, type = 'error', duration = 4000) => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, duration);
  };

  const addLog = (m) => {
    const time = new Date().toLocaleTimeString();
    setLogs(prev => [`[${time}] > ${m}`, ...prev]);
  };

  const handleLoginSuccess = () => {
    setLoggedIn(true);
    setCurrentUser(getCurrentUser());
    addLog("Kullanıcı başarıyla giriş yaptı.");
  };

  const handleLogout = () => {
    logoutUser();
    setLoggedIn(false);
    setCurrentUser(null);
    addLog("Oturum kapatıldı.");
  };

  // --- Dialog Triggers ---
  const triggerAlert = (title, message) => {
    setDialog({
      isOpen: true,
      type: 'alert',
      title,
      message,
      inputValue: '',
      fields: [],
      onConfirm: closeDialog,
      onCancel: closeDialog
    });
  };

  const triggerPrompt = (title, message, defaultValue, placeholder, onConfirm) => {
    setDialog({
      isOpen: true,
      type: 'prompt',
      title,
      message,
      inputValue: defaultValue || '',
      placeholder: placeholder || '',
      fields: [],
      onConfirm: (val) => {
        onConfirm(val);
        closeDialog();
      },
      onCancel: closeDialog
    });
  };

  const triggerConfirm = (title, message, onConfirm) => {
    setDialog({
      isOpen: true,
      type: 'confirm',
      title,
      message,
      inputValue: '',
      fields: [],
      onConfirm: () => {
        onConfirm();
        closeDialog();
      },
      onCancel: closeDialog
    });
  };

  const triggerFields = (title, fieldConfigs, onConfirm) => {
    setDialog({
      isOpen: true,
      type: 'fields',
      title,
      message: '',
      inputValue: '',
      fields: fieldConfigs,
      onConfirm: (fieldValues) => {
        onConfirm(fieldValues);
        closeDialog();
      },
      onCancel: closeDialog
    });
  };

  const closeDialog = () => {
    setDialog(prev => ({ ...prev, isOpen: false }));
  };

  const handleDialogSubmit = (e) => {
    e.preventDefault();
    if (dialog.type === 'prompt') {
      dialog.onConfirm(dialog.inputValue);
    } else if (dialog.type === 'fields') {
      const values = {};
      dialog.fields.forEach(f => {
        values[f.key] = f.value;
      });
      dialog.onConfirm(values);
    } else {
      dialog.onConfirm();
    }
  };

  const toastIcon = (type) => {
    switch (type) {
      case 'success': return <CheckCircle2 size={18} />;
      case 'warning': return <AlertTriangle size={18} />;
      default: return <AlertCircle size={18} />;
    }
  };

  const toastBg = (type) => {
    switch (type) {
      case 'success': return 'bg-emerald-50 border-emerald-200 text-emerald-800';
      case 'warning': return 'bg-amber-50 border-amber-200 text-amber-800';
      default: return 'bg-red-50 border-red-200 text-red-800';
    }
  };

  const toastIconColor = (type) => {
    switch (type) {
      case 'success': return 'text-emerald-500';
      case 'warning': return 'text-amber-500';
      default: return 'text-red-500';
    }
  };

  // Global Fetch Data
  const refreshAll = async (progId = currentProgId, termId = currentTermId, dersId = currentDersId) => {
    if (!loggedIn) return;
    try {
      // 1. Fetch programs
      const progs = await pb.collection('programs').getFullList({ sort: 'name' });
      setPrograms(progs);
      
      // Auto select first program if none selected
      let finalProgId = progId;
      if (progs.length > 0 && !finalProgId) {
        finalProgId = progs[0].id;
      }
      setCurrentProgId(finalProgId);

      // 2. Fetch terms
      const trms = await pb.collection('terms').getFullList({ sort: '-name' });
      setTerms(trms);

      let finalTermId = termId;
      if (trms.length > 0 && !finalTermId) {
        finalTermId = trms[0].id;
      }
      setCurrentTermId(finalTermId);

      // 3. Fetch all courses
      const crs = await pb.collection('courses').getFullList({ sort: 'name' });
      setCourses(crs);

      // Verify active course selection
      let finalDersId = dersId;
      if (finalProgId && finalTermId) {
        const filtered = crs.filter(c => c.program_id === finalProgId && c.term_id === finalTermId);
        if (filtered.length > 0) {
          if (!finalDersId || !filtered.some(d => d.id === finalDersId)) {
            finalDersId = filtered[0].id;
          }
        } else {
          finalDersId = null;
        }
      } else {
        finalDersId = null;
      }
      setCurrentDersId(finalDersId);

      addLog("Veritabanı bağlantısı güncellendi.");
    } catch (e) {
      console.error(e);
      addLog(`Veri tabanı hatası: ${e.message}`);
      addToast(`Veri tabanı hatası: ${e.message}`, "error");
    }
  };

  useEffect(() => {
    if (loggedIn) {
      refreshAll();
    }
  }, [loggedIn]);

  if (!loggedIn) {
    return <Login onLoginSuccess={handleLoginSuccess} />;
  }

  // Sidebar Menu Items
  const menuItems = [
    { id: 'm_home', label: '🏠 Genel Yapı & Yönetim', icon: <Home size={16} /> },
    { id: 'm_pc', label: '🎯 Program Çıktıları (PÇ)', icon: <Award size={16} /> },
    { id: 'm_dc', label: '📖 Ders Çıktıları (DÇ)', icon: <BookOpen size={16} /> },
    { id: 'm_matris', label: '🔳 PÇ-DÇ Matrisi', icon: <Grid3X3 size={16} /> },
    { id: 'm_soru', label: '📝 Sınav & Soru Tanımlama', icon: <FileText size={16} /> },
    { id: 'm_not', label: '🎓 Öğrenci Not Girişi', icon: <GraduationCap size={16} /> },
    { id: 'm_analiz', label: '📊 Detaylı Analiz Paneli', icon: <BarChart2 size={16} /> },
    { id: 'm_prog_rapor', label: '🏛️ Program PÇ Raporu', icon: <Library size={16} /> },
  ];

  return (
    <div className="flex w-full h-screen">
      {/* Sidebar */}
      <div className="w-[280px] bg-p text-white flex flex-col h-screen fixed left-0 top-0 border-r border-white/5 shadow-2xl z-50">
        <div className="p-6 text-center border-b border-white/10 bg-black/25">
          <h3 className="font-display m-0 text-xl font-extrabold tracking-wider bg-gradient-to-r from-white to-blue-200 bg-clip-text text-transparent">MEDEK PRO</h3>
          <small className="block mt-1 text-[10px] text-blue-300 font-bold uppercase tracking-wider">Bulut Veritabanı Sürümü</small>
        </div>
        <div className="flex-1 p-4 overflow-y-auto flex flex-col gap-1">
          {menuItems.map((item) => (
            <div
              key={item.id}
              className={`p-3 cursor-pointer rounded-lg text-xs font-semibold text-slate-400 hover:bg-white/5 hover:text-white transition-all duration-200 flex items-center gap-3 ${activeModule === item.id ? 'bg-s text-white font-bold shadow-md shadow-s/30' : ''}`}
              onClick={() => setActiveModule(item.id)}
            >
              {item.icon}
              <span>{item.label.split(' ').slice(1).join(' ')}</span>
            </div>
          ))}
        </div>

        {/* Logs Terminal */}
        <div className="bg-[#050b11] h-[130px] border-t border-white/10 p-3.5 font-mono text-[9px] text-green-400 overflow-y-auto flex flex-col gap-0.5 select-none">
          <div className="flex items-center gap-1.5 border-b border-white/5 pb-1 mb-1 font-bold text-slate-400">
            <Terminal size={12} /> <span>Konsol Çıktısı</span>
          </div>
          {logs.map((log, idx) => (
            <div key={idx} className="line-clamp-1 break-all opacity-85">{log}</div>
          ))}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-white/10 bg-black/15">
          <div className="flex items-center justify-between text-[11px] text-slate-300">
            <span className="flex items-center gap-1.5 font-medium truncate max-w-[170px]">
              <User size={13} className="shrink-0 text-slate-400" /> {currentUser?.email || 'Kullanıcı'}
            </span>
            <button 
              className="bg-transparent border-none text-red-400 hover:bg-red-500/10 p-1.5 rounded-lg cursor-pointer transition-all duration-200" 
              onClick={handleLogout} 
              title="Çıkış Yap"
            >
              <LogOut size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="ml-[280px] p-8 w-[calc(100%-280px)] overflow-y-auto h-screen box-border flex flex-col gap-6">
        {activeModule === 'm_home' && (
          <Hierarchy
            programs={programs}
            terms={terms}
            courses={courses}
            currentProgId={currentProgId}
            setCurrentProgId={setCurrentProgId}
            currentTermId={currentTermId}
            setCurrentTermId={setCurrentTermId}
            currentDersId={currentDersId}
            setCurrentDersId={setCurrentDersId}
            refreshAll={refreshAll}
            addLog={addLog}
            addToast={addToast}
            triggerAlert={triggerAlert}
            triggerPrompt={triggerPrompt}
            triggerConfirm={triggerConfirm}
          />
        )}

        {activeModule === 'm_pc' && (
          <PCOutcomes
            currentProgId={currentProgId}
            refreshAll={refreshAll}
            addLog={addLog}
            addToast={addToast}
            triggerAlert={triggerAlert}
            triggerPrompt={triggerPrompt}
            triggerConfirm={triggerConfirm}
          />
        )}

        {activeModule === 'm_dc' && (
          <DCOutcomes
            currentDersId={currentDersId}
            refreshAll={refreshAll}
            addLog={addLog}
            addToast={addToast}
            triggerAlert={triggerAlert}
            triggerPrompt={triggerPrompt}
            triggerConfirm={triggerConfirm}
          />
        )}

        {activeModule === 'm_matris' && (
          <Matrix
            currentProgId={currentProgId}
            currentDersId={currentDersId}
            addLog={addLog}
            addToast={addToast}
            triggerAlert={triggerAlert}
          />
        )}

        {activeModule === 'm_soru' && (
          <QuestionBank
            currentProgId={currentProgId}
            currentDersId={currentDersId}
            addLog={addLog}
            addToast={addToast}
            triggerAlert={triggerAlert}
            triggerPrompt={triggerPrompt}
            triggerConfirm={triggerConfirm}
          />
        )}

        {activeModule === 'm_not' && (
          <GradeEntry
            currentDersId={currentDersId}
            addLog={addLog}
            addToast={addToast}
            triggerAlert={triggerAlert}
            triggerPrompt={triggerPrompt}
            triggerConfirm={triggerConfirm}
            triggerFields={triggerFields}
          />
        )}

        {activeModule === 'm_analiz' && (
          <AnalysisPanel
            currentProgId={currentProgId}
            currentDersId={currentDersId}
            addLog={addLog}
            addToast={addToast}
            triggerAlert={triggerAlert}
          />
        )}

        {activeModule === 'm_prog_rapor' && (
          <ProgramReport
            programs={programs}
            terms={terms}
            addLog={addLog}
            addToast={addToast}
            triggerAlert={triggerAlert}
          />
        )}
      </div>

      {/* --- Global Custom Dialog Overlay Modal --- */}
      <div 
        className={`fixed inset-0 bg-slate-950/75 backdrop-blur-md z-[9999] flex justify-center items-center transition-all duration-300 ${dialog.isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`} 
        onClick={closeDialog}
      >
        <div 
          className={`bg-white/95 backdrop-blur-xl border border-white/50 rounded-3xl w-[440px] max-w-[90vw] shadow-2xl overflow-hidden transition-all duration-300 ${dialog.isOpen ? 'scale-100 translate-y-0 opacity-100' : 'scale-95 translate-y-2 opacity-0'}`} 
          onClick={(e) => e.stopPropagation()}
        >
          <form onSubmit={handleDialogSubmit}>
            <div className="flex items-center p-6 pb-4 relative">
              <div className={`flex items-center justify-center w-10 h-10 rounded-xl mr-4 shrink-0 border ${dialog.type === 'confirm' || dialog.type === 'alert' ? 'bg-danger/10 text-danger border-danger/20' : dialog.type === 'prompt' ? 'bg-s/10 text-s border-s/20' : 'bg-success/10 text-success border-success/20'}`}>
                {dialog.type === 'confirm' || dialog.type === 'alert' ? <AlertCircle size={20} /> : dialog.type === 'prompt' ? <HelpCircle size={20} /> : <Info size={20} />}
              </div>
              <div>
                <h3 className="font-display m-0 text-[16px] font-bold text-slate-900 tracking-tight">{dialog.title}</h3>
              </div>
              <button type="button" className="absolute top-6 right-6 bg-transparent border-none text-slate-400 hover:text-slate-900 text-xl cursor-pointer transition-all hover:scale-110" onClick={closeDialog}>×</button>
            </div>
            
            <div className="px-6 pb-6">
              {dialog.message && (
                <p className="margin-0 mb-4 text-xs text-slate-500 font-medium leading-relaxed">
                  {dialog.message}
                </p>
              )}

              {dialog.type === 'prompt' && (
                <div>
                  <input
                    type="text"
                    required
                    autoFocus
                    placeholder={dialog.placeholder}
                    value={dialog.inputValue}
                    onChange={(e) => setDialog(prev => ({ ...prev, inputValue: e.target.value }))}
                    className="w-full px-3.5 py-2.5 border border-border rounded-xl bg-white/80 font-sans text-sm text-slate-900 outline-none transition-all duration-200 focus:border-s focus:bg-white focus:ring-4 focus:ring-s/12 box-border"
                  />
                </div>
              )}

              {dialog.type === 'fields' && (
                <div className="flex flex-col gap-4">
                  {dialog.fields.map((field, idx) => (
                    <div className="flex flex-col gap-1.5" key={field.key}>
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">{field.label}</label>
                      <input
                        type="text"
                        required
                        autoFocus={idx === 0}
                        placeholder={field.placeholder}
                        value={field.value}
                        onChange={(e) => {
                          const val = e.target.value;
                          setDialog(prev => {
                            const updatedFields = [...prev.fields];
                            updatedFields[idx] = { ...updatedFields[idx], value: val };
                            return { ...prev, fields: updatedFields };
                          });
                        }}
                        className="w-full px-3.5 py-2.5 border border-border rounded-xl bg-white/80 font-sans text-sm text-slate-900 outline-none transition-all duration-200 focus:border-s focus:bg-white focus:ring-4 focus:ring-s/12 box-border"
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 px-6 py-4 bg-slate-50/50 border-t border-slate-900/5">
              {dialog.type !== 'alert' && (
                <button 
                  type="button" 
                  className="px-4 py-2 rounded-xl font-semibold text-xs border border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300 text-slate-700 cursor-pointer transition-all duration-200" 
                  onClick={closeDialog}
                >
                  İptal
                </button>
              )}
              <button 
                type="submit" 
                className={`px-4 py-2 rounded-xl font-semibold text-xs text-white shadow-md cursor-pointer transition-all duration-200 ${dialog.type === 'confirm' || dialog.type === 'alert' ? 'bg-gradient-to-r from-danger to-red-600 hover:from-red-600 hover:to-red-700 shadow-danger/25' : 'bg-gradient-to-r from-s to-blue-600 hover:from-blue-600 hover:to-blue-700 shadow-s/25'}`}
              >
                {dialog.type === 'alert' ? 'Tamam' : dialog.type === 'confirm' ? 'Evet, Onayla' : 'Tamam'}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* --- Toast Container --- */}
      <div className="fixed top-5 right-5 z-[99999] flex flex-col gap-2.5 pointer-events-none w-[380px] max-w-[90vw]">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto flex items-start gap-3 px-4 py-3.5 rounded-2xl border shadow-lg backdrop-blur-xl animate-slide-in ${toastBg(toast.type)}`}
          >
            <span className={`shrink-0 mt-0.5 ${toastIconColor(toast.type)}`}>
              {toastIcon(toast.type)}
            </span>
            <span className="text-xs font-semibold leading-relaxed flex-1">{toast.message}</span>
            <button
              className="shrink-0 bg-transparent border-none p-0.5 cursor-pointer opacity-50 hover:opacity-100 transition-opacity"
              onClick={() => setToasts(prev => prev.filter(t => t.id !== toast.id))}
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>

    </div>
  );
}
