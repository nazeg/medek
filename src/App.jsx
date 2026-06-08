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
  GraduationCap, BarChart2, Library, LogOut, Terminal, User 
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
    <div style={{ display: 'flex', width: '100%', height: '100vh' }}>
      {/* Sidebar */}
      <div className="sidebar">
        <div className="sidebar-header">
          <h3>MEDEK PRO</h3>
          <small>Bulut Veritabanı Sürümü</small>
        </div>
        <div className="nav-menu">
          {menuItems.map((item) => (
            <div
              key={item.id}
              className={`nav-item ${activeModule === item.id ? 'active' : ''}`}
              onClick={() => setActiveModule(item.id)}
            >
              {item.icon}
              <span>{item.label.split(' ').slice(1).join(' ')}</span>
            </div>
          ))}
        </div>

        {/* Logs Terminal */}
        <div className="sidebar-log">
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '4px', marginBottom: '4px' }}>
            <Terminal size={10} /> <span>Konsol Çıktısı</span>
          </div>
          {logs.map((log, idx) => (
            <div key={idx} style={{ lineHeight: '1.2' }}>{log}</div>
          ))}
        </div>

        {/* Footer */}
        <div className="sidebar-footer">
          <div className="user-info">
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <User size={14} /> {currentUser?.email || 'Kullanıcı'}
            </span>
            <button className="logout-btn" onClick={handleLogout} title="Çıkış Yap">
              <LogOut size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="main">
        {/* Dynamic component routing based on activeModule */}
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
          />
        )}

        {activeModule === 'm_pc' && (
          <PCOutcomes
            currentProgId={currentProgId}
            refreshAll={refreshAll}
            addLog={addLog}
          />
        )}

        {activeModule === 'm_dc' && (
          <DCOutcomes
            currentDersId={currentDersId}
            refreshAll={refreshAll}
            addLog={addLog}
          />
        )}

        {activeModule === 'm_matris' && (
          <Matrix
            currentProgId={currentProgId}
            currentDersId={currentDersId}
            addLog={addLog}
          />
        )}

        {activeModule === 'm_soru' && (
          <QuestionBank
            currentProgId={currentProgId}
            currentDersId={currentDersId}
            addLog={addLog}
          />
        )}

        {activeModule === 'm_not' && (
          <GradeEntry
            currentDersId={currentDersId}
            addLog={addLog}
          />
        )}

        {activeModule === 'm_analiz' && (
          <AnalysisPanel
            currentProgId={currentProgId}
            currentDersId={currentDersId}
            addLog={addLog}
          />
        )}

        {activeModule === 'm_prog_rapor' && (
          <ProgramReport
            programs={programs}
            terms={terms}
            addLog={addLog}
          />
        )}
      </div>
    </div>
  );
}
