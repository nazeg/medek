import React, { useState, useEffect } from 'react';
import { pb } from '../pb';
import { 
  Plus, Edit, Trash2, Lock, Unlock, BookOpen, 
  User, Award, Layers, University, Calendar 
} from 'lucide-react';

export default function Hierarchy({ 
  programs, terms, courses,
  currentProgId, setCurrentProgId,
  currentTermId, setCurrentTermId,
  currentDersId, setCurrentDersId,
  refreshAll, addLog 
}) {
  const [progLocked, setProgLocked] = useState(false);
  const [termLocked, setTermLocked] = useState(false);
  const [dersLocked, setDersLocked] = useState(false);

  // Modal State for Courses
  const [isDersModalOpen, setIsDersModalOpen] = useState(false);
  const [selectedDers, setSelectedDers] = useState(null);
  
  // Course Form Fields
  const [dersKodu, setDersKodu] = useState('');
  const [dersAdi, setDersAdi] = useState('');
  const [dersAKTS, setDersAKTS] = useState(5);
  const [dersVeren, setDersVeren] = useState('');
  const [dersSinif, setDersSinif] = useState('1');
  const [pctVize, setPctVize] = useState(40);
  const [pctOdev, setPctOdev] = useState(0);
  const [pctUygulama, setPctUygulama] = useState(0);
  const [pctFinal, setPctFinal] = useState(60);

  // Sync Bütünleme with Final
  const pctBut = pctFinal;

  const totalPercentage = parseInt(pctVize || 0) + parseInt(pctOdev || 0) + parseInt(pctUygulama || 0) + parseInt(pctFinal || 0);

  // Hierarchy calculations
  const filteredCoursesInTerm = courses.filter(c => c.term_id === currentTermId);
  const uniqueProgramIdsInTerm = [...new Set(filteredCoursesInTerm.map(c => c.program_id))];

  const hierarchyData = uniqueProgramIdsInTerm.map(pid => {
    const p = programs.find(x => x.id === pid);
    return {
      name: p?.name || 'Bilinmeyen Program',
      courses: filteredCoursesInTerm.filter(c => c.program_id === pid)
    };
  });

  const getSinifLabel = (v) => {
    const map = { '1': '1. Sınıf', '2': '2. Sınıf', '3': '3. Sınıf', '4': '4. Sınıf', 'YL': 'Yüksek Lisans', 'DR': 'Doktora' };
    return map[v] || v || '-';
  };

  // Add prompts
  const handleAddProgram = async () => {
    const name = prompt("Program Adı:");
    if (!name) return;
    try {
      const record = await pb.collection('programs').create({ name });
      addLog(`Yeni program eklendi: ${name}`);
      await refreshAll(record.id, currentTermId, currentDersId);
    } catch (e) {
      alert("Hata: " + e.message);
    }
  };

  const handleEditProgram = async () => {
    if (!currentProgId) return;
    const prog = programs.find(p => p.id === currentProgId);
    if (!prog) return;
    const name = prompt("Program Adı Güncelle:", prog.name);
    if (!name) return;
    try {
      await pb.collection('programs').update(currentProgId, { name });
      addLog(`Program güncellendi: ${name}`);
      await refreshAll(currentProgId, currentTermId, currentDersId);
    } catch (e) {
      alert("Hata: " + e.message);
    }
  };

  const handleDeleteProgram = async () => {
    if (!currentProgId) return;
    if (confirm("Bu programı ve buna bağlı tüm dersleri ve verileri silmek istediğinize emin misiniz?")) {
      try {
        await pb.collection('programs').delete(currentProgId);
        addLog(`Program silindi.`);
        await refreshAll(null, currentTermId, null);
      } catch (e) {
        alert("Hata: " + e.message);
      }
    }
  };

  const handleAddTerm = async () => {
    const name = prompt("Yeni Eğitim Yılı / Dönem (Örn: 2024-2025 Güz):");
    if (!name) return;
    try {
      const record = await pb.collection('terms').create({ name });
      addLog(`Yeni Dönem eklendi: ${name}`);
      await refreshAll(currentProgId, record.id, currentDersId);
    } catch (e) {
      alert("Hata: " + e.message);
    }
  };

  const handleEditTerm = async () => {
    if (!currentTermId) return;
    const term = terms.find(t => t.id === currentTermId);
    if (!term) return;
    const name = prompt("Dönem Adı Güncelle:", term.name);
    if (!name) return;
    try {
      await pb.collection('terms').update(currentTermId, { name });
      addLog(`Dönem güncellendi: ${name}`);
      await refreshAll(currentProgId, currentTermId, currentDersId);
    } catch (e) {
      alert("Hata: " + e.message);
    }
  };

  const handleDeleteTerm = async () => {
    if (!currentTermId) return;
    if (confirm("Bu dönemi silerseniz bağlı tüm dersler ve veriler silinecektir! Emin misiniz?")) {
      try {
        await pb.collection('terms').delete(currentTermId);
        addLog("Dönem silindi.");
        await refreshAll(currentProgId, null, null);
      } catch (e) {
        alert("Hata: " + e.message);
      }
    }
  };

  // Course Add / Edit trigger
  const handleOpenCourseModal = (editData = null) => {
    if (!currentProgId || !currentTermId) {
      alert("Önce Program ve Dönem seçmelisiniz!");
      return;
    }
    setSelectedDers(editData);
    if (editData) {
      setDersKodu(editData.code || '');
      setDersAdi(editData.name || '');
      setDersAKTS(editData.akts || 5);
      setDersVeren(editData.instructor || '');
      setDersSinif(editData.grade_level || '1');
      setPctVize(editData.pct_vize ?? 40);
      setPctOdev(editData.pct_odev ?? 0);
      setPctUygulama(editData.pct_uygulama ?? 0);
      setPctFinal(editData.pct_final ?? 60);
    } else {
      setDersKodu('');
      setDersAdi('');
      setDersAKTS(5);
      setDersVeren('');
      setDersSinif('1');
      setPctVize(40);
      setPctOdev(0);
      setPctUygulama(0);
      setPctFinal(60);
    }
    setIsDersModalOpen(true);
  };

  const handleSaveCourse = async () => {
    if (!dersKodu.trim()) {
      alert("Ders Kodu zorunludur!");
      return;
    }
    if (!dersAdi.trim()) {
      alert("Ders Adı zorunludur!");
      return;
    }
    if (totalPercentage !== 100) {
      alert(`Sınav ağırlık toplamı 100 olmalıdır! Şu an: ${totalPercentage}%`);
      return;
    }

    const courseData = {
      program_id: currentProgId,
      term_id: currentTermId,
      code: dersKodu.trim(),
      name: dersAdi.trim(),
      akts: parseInt(dersAKTS) || 0,
      instructor: dersVeren.trim(),
      grade_level: dersSinif,
      pct_vize: parseInt(pctVize) || 0,
      pct_odev: parseInt(pctOdev) || 0,
      pct_uygulama: parseInt(pctUygulama) || 0,
      pct_final: parseInt(pctFinal) || 0,
      pct_but: parseInt(pctFinal) || 0
    };

    try {
      if (selectedDers) {
        await pb.collection('courses').update(selectedDers.id, courseData);
        addLog(`Ders güncellendi: ${dersKodu} - ${dersAdi}`);
        setIsDersModalOpen(false);
        await refreshAll(currentProgId, currentTermId, selectedDers.id);
      } else {
        const record = await pb.collection('courses').create(courseData);
        addLog(`Yeni ders eklendi: ${dersKodu} - ${dersAdi}`);
        setIsDersModalOpen(false);
        await refreshAll(currentProgId, currentTermId, record.id);
      }
    } catch (e) {
      alert("Hata: " + e.message);
    }
  };

  const handleDeleteCourse = async () => {
    if (!currentDersId) return;
    if (confirm("Bu ders silinsin mi?")) {
      try {
        await pb.collection('courses').delete(currentDersId);
        addLog("Ders silindi.");
        await refreshAll(currentProgId, currentTermId, null);
      } catch (e) {
        alert("Hata: " + e.message);
      }
    }
  };

  return (
    <>
      {/* Dynamic Selector Bar */}
      <div className="header-config">
        <div>
          <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--text-muted)' }}>
            <University size={14} /> AKTİF PROGRAM
          </label>
          <select 
            value={currentProgId || ''} 
            onChange={(e) => {
              setCurrentProgId(e.target.value);
              // Reset course selection when program changes
              setCurrentDersId(null);
            }} 
            disabled={progLocked}
            style={{ marginTop: '4px' }}
          >
            <option value="">Seçiniz</option>
            {programs.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <div className="action-bar" style={{ display: 'flex', gap: '6px', marginTop: '6px', alignItems: 'center' }}>
            <button className="btn btn-secondary btn-sm" onClick={handleEditProgram} disabled={!currentProgId}><Edit size={10} /> Düzenle</button>
            <button className="btn btn-danger btn-sm" onClick={handleDeleteProgram} disabled={!currentProgId}><Trash2 size={10} /> Sil</button>
            <label style={{ fontSize: '10px', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', userSelect: 'none' }}>
              <input type="checkbox" checked={progLocked} onChange={(e) => setProgLocked(e.target.checked)} style={{ width: 'auto' }} /> 
              {progLocked ? <Lock size={10} /> : <Unlock size={10} />} Kilitle
            </label>
          </div>
        </div>

        <div>
          <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--text-muted)' }}>
            <Calendar size={14} /> EĞİTİM YILI / DÖNEM
          </label>
          <select 
            value={currentTermId || ''} 
            onChange={(e) => {
              setCurrentTermId(e.target.value);
              setCurrentDersId(null);
            }} 
            disabled={termLocked}
            style={{ marginTop: '4px' }}
          >
            <option value="">Seçiniz</option>
            {terms.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          <div className="action-bar" style={{ display: 'flex', gap: '6px', marginTop: '6px', alignItems: 'center' }}>
            <button className="btn btn-secondary btn-sm" onClick={handleEditTerm} disabled={!currentTermId}><Edit size={10} /> Düzenle</button>
            <button className="btn btn-danger btn-sm" onClick={handleDeleteTerm} disabled={!currentTermId}><Trash2 size={10} /> Sil</button>
            <label style={{ fontSize: '10px', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', userSelect: 'none' }}>
              <input type="checkbox" checked={termLocked} onChange={(e) => setTermLocked(e.target.checked)} style={{ width: 'auto' }} /> 
              {termLocked ? <Lock size={10} /> : <Unlock size={10} />} Kilitle
            </label>
          </div>
        </div>

        <div>
          <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--text-muted)' }}>
            <BookOpen size={14} /> AKTİF DERS
          </label>
          <select 
            value={currentDersId || ''} 
            onChange={(e) => setCurrentDersId(e.target.value)} 
            disabled={dersLocked || !currentProgId || !currentTermId}
            style={{ marginTop: '4px' }}
          >
            <option value="">Seçiniz</option>
            {courses
              .filter(c => c.program_id === currentProgId && c.term_id === currentTermId)
              .map(d => <option key={d.id} value={d.id}>{d.code ? `${d.code} - ` : ''}{d.name}</option>)}
          </select>
          <div className="action-bar" style={{ display: 'flex', gap: '6px', marginTop: '6px', alignItems: 'center' }}>
            <button className="btn btn-secondary btn-sm" onClick={() => {
              const activeD = courses.find(c => c.id === currentDersId);
              handleOpenCourseModal(activeD);
            }} disabled={!currentDersId}><Edit size={10} /> Düzenle</button>
            <button className="btn btn-danger btn-sm" onClick={handleDeleteCourse} disabled={!currentDersId}><Trash2 size={10} /> Sil</button>
            <label style={{ fontSize: '10px', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', userSelect: 'none' }}>
              <input type="checkbox" checked={dersLocked} onChange={(e) => setDersLocked(e.target.checked)} style={{ width: 'auto' }} /> 
              {dersLocked ? <Lock size={10} /> : <Unlock size={10} />} Kilitle
            </label>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', alignSelf: 'center', flex: 'none' }}>
          <button className="btn btn-primary btn-sm" onClick={handleAddProgram}><Plus size={12} /> Program Ekle</button>
          <button className="btn btn-warning btn-sm" onClick={handleAddTerm}><Plus size={12} /> Dönem Ekle</button>
          <button className="btn btn-success btn-sm" onClick={() => handleOpenCourseModal(null)} disabled={!currentProgId || !currentTermId}><Plus size={12} /> Ders Ekle</button>
        </div>
      </div>

      {/* Hierarchy Area */}
      <div className="card">
        <h3 className="card-title">
          <University size={18} /> Üniversite / Bölüm Hiyerarşisi
        </h3>
        
        {!currentTermId ? (
          <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)', border: '1px dashed var(--border)', borderRadius: '8px' }}>
            Lütfen bir dönem seçiniz.
          </div>
        ) : hierarchyData.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)', border: '1px dashed var(--border)', borderRadius: '8px' }}>
            Bu dönem için henüz ders tanımlanmamış.
          </div>
        ) : (
          hierarchyData.map((prog, idx) => (
            <div key={idx} className="hierarchy-card">
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: '12px', borderBottom: '1px solid var(--border)', paddingBottom: '8px' }}>
                <University size={16} style={{ color: 'var(--p)', marginRight: '10px' }} />
                <h4 style={{ margin: 0, fontWeight: 700, color: 'var(--p)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{prog.name}</h4>
                <span style={{ marginLeft: 'auto', fontSize: '11px', color: 'var(--text-muted)' }}>{prog.courses.length} ders</span>
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {prog.courses.map(c => (
                  <div 
                    key={c.id} 
                    style={{ 
                      background: '#fafbfc', 
                      border: '1px solid #eef0f2', 
                      borderRadius: '10px', 
                      padding: '12px 14px', 
                      cursor: 'pointer',
                      borderLeft: currentDersId === c.id ? '4px solid var(--s)' : '1px solid #eef0f2',
                      background: currentDersId === c.id ? 'var(--s-light)' : '#fafbfc'
                    }}
                    onClick={() => setCurrentDersId(c.id)}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                      <BookOpen size={14} style={{ color: 'var(--s)' }} />
                      {c.code && (
                        <span style={{ background: 'var(--p)', color: '#fff', padding: '2px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: 700 }}>
                          {c.code}
                        </span>
                      )}
                      <span style={{ fontWeight: 600, color: 'var(--text)', fontSize: '0.85rem' }}>{c.name}</span>
                    </div>
                    
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginTop: '6px', flexWrap: 'wrap' }}>
                      {c.instructor && (
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          <User size={12} /> {c.instructor}
                        </span>
                      )}
                      {c.akts && (
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          <Award size={12} /> AKTS: <b>{c.akts}</b>
                        </span>
                      )}
                      {c.grade_level && (
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          <Layers size={12} /> {getSinifLabel(c.grade_level)}
                        </span>
                      )}
                    </div>
                    
                    <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginTop: '6px' }}>
                      {c.pct_vize > 0 && <span style={{ background: '#e3f2fd', color: '#1565c0', padding: '2px 8px', borderRadius: '20px', fontSize: '9px', fontWeight: 600 }}>Vize %{c.pct_vize}</span>}
                      {c.pct_odev > 0 && <span style={{ background: '#fce4ec', color: '#c62828', padding: '2px 8px', borderRadius: '20px', fontSize: '9px', fontWeight: 600 }}>Ödev %{c.pct_odev}</span>}
                      {c.pct_uygulama > 0 && <span style={{ background: '#fff3e0', color: '#e65100', padding: '2px 8px', borderRadius: '20px', fontSize: '9px', fontWeight: 600 }}>Uygulama %{c.pct_uygulama}</span>}
                      {c.pct_final > 0 && <span style={{ background: '#e8f5e9', color: '#2e7d32', padding: '2px 8px', borderRadius: '20px', fontSize: '9px', fontWeight: 600 }}>Final %{c.pct_final}</span>}
                      {c.pct_but > 0 && <span style={{ background: '#f3e5f5', color: '#6a1b9a', padding: '2px 8px', borderRadius: '20px', fontSize: '9px', fontWeight: 600 }}>Büt %{c.pct_but}</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Course Modal */}
      <div className={`modal-overlay ${isDersModalOpen ? 'active' : ''}`}>
        <div className="modal-box">
          <div className="modal-header">
            <h3>{selectedDers ? '✏️ Ders Düzenle' : '📚 Yeni Ders Ekle'}</h3>
            <button className="modal-close" onClick={() => setIsDersModalOpen(false)}>×</button>
          </div>
          <div className="modal-body">
            <div className="form-row">
              <div className="form-group">
                <label>Ders Kodu</label>
                <input type="text" value={dersKodu} onChange={(e) => setDersKodu(e.target.value)} placeholder="örn: BIL101" />
              </div>
              <div className="form-group" style={{ flex: 2 }}>
                <label>Ders Adı</label>
                <input type="text" value={dersAdi} onChange={(e) => setDersAdi(e.target.value)} placeholder="örn: Algoritma ve Programlama" />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>AKTS Kredisi</label>
                <input type="number" min="1" max="30" value={dersAKTS} onChange={(e) => setDersAKTS(e.target.value)} />
              </div>
              <div className="form-group">
                <label>Dersi Veren Öğr. Elemanı</label>
                <input type="text" value={dersVeren} onChange={(e) => setDersVeren(e.target.value)} placeholder="Dr. Öğr. Üyesi Ahmet Yılmaz" />
              </div>
              <div className="form-group">
                <label>Sınıf Seviyesi</label>
                <select value={dersSinif} onChange={(e) => setDersSinif(e.target.value)}>
                  <option value="1">1. Sınıf</option>
                  <option value="2">2. Sınıf</option>
                  <option value="3">3. Sınıf</option>
                  <option value="4">4. Sınıf</option>
                  <option value="YL">Yüksek Lisans</option>
                  <option value="DR">Doktora</option>
                </select>
              </div>
            </div>

            <hr className="modal-divider" />
            <h4 className="modal-section-title">⚖️ Değerlendirme Yüzdeleri Ağırlığı</h4>
            
            <div className="modal-pct-grid">
              <div className="form-group">
                <label>Vize (%)</label>
                <input type="number" min="0" max="100" value={pctVize} onChange={(e) => setPctVize(parseInt(e.target.value) || 0)} />
              </div>
              <div className="form-group">
                <label>Ödev (%)</label>
                <input type="number" min="0" max="100" value={pctOdev} onChange={(e) => setPctOdev(parseInt(e.target.value) || 0)} />
              </div>
              <div className="form-group">
                <label>Uyg. (%)</label>
                <input type="number" min="0" max="100" value={pctUygulama} onChange={(e) => setPctUygulama(parseInt(e.target.value) || 0)} />
              </div>
              <div className="form-group">
                <label>Final (%)</label>
                <input type="number" min="0" max="100" value={pctFinal} onChange={(e) => setPctFinal(parseInt(e.target.value) || 0)} />
              </div>
              <div className="form-group">
                <label>Büt (%)</label>
                <input type="number" value={pctBut} disabled style={{ background: '#f1f5f9' }} />
              </div>
            </div>

            <div className="pct-total-bar">
              <div className="pct-bar">
                <div 
                  className="pct-bar-fill" 
                  style={{ 
                    width: `${Math.min(totalPercentage, 100)}%`,
                    backgroundColor: totalPercentage === 100 ? 'var(--success)' : totalPercentage > 100 ? 'var(--danger)' : 'var(--warning)'
                  }} 
                />
              </div>
              <span style={{ color: totalPercentage === 100 ? 'var(--success)' : totalPercentage > 100 ? 'var(--danger)' : 'var(--warning)' }}>
                Toplam: {totalPercentage}%
              </span>
            </div>
          </div>
          <div className="modal-footer">
            <button className="btn btn-secondary" onClick={() => setIsDersModalOpen(false)}>İptal</button>
            <button className="btn btn-primary" onClick={handleSaveCourse}>{selectedDers ? 'Güncelle' : 'Kaydet'}</button>
          </div>
        </div>
      </div>
    </>
  );
}
