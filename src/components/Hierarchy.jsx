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
  refreshAll, addLog,
  triggerPrompt, triggerConfirm,
  triggerAlert, addToast
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
  const handleAddProgram = () => {
    triggerPrompt("Yeni Program", "Lütfen eklemek istediğiniz programın adını girin:", "", "Program Adı", async (name) => {
      if (!name) return;
      try {
        const record = await pb.collection('programs').create({ name });
        addLog(`Yeni program eklendi: ${name}`);
        await refreshAll(record.id, currentTermId, currentDersId);
      } catch (e) {
        triggerAlert("Hata", e.message);
      }
    });
  };

  const handleEditProgram = () => {
    if (!currentProgId) return;
    const prog = programs.find(p => p.id === currentProgId);
    if (!prog) return;
    triggerPrompt("Programı Düzenle", "Program adını güncelleyin:", prog.name, "Program Adı", async (name) => {
      if (!name) return;
      try {
        await pb.collection('programs').update(currentProgId, { name });
        addLog(`Program güncellendi: ${name}`);
        await refreshAll(currentProgId, currentTermId, currentDersId);
      } catch (e) {
        triggerAlert("Hata", e.message);
      }
    });
  };

  const handleDeleteProgram = () => {
    if (!currentProgId) return;
    triggerConfirm(
      "Programı Sil",
      "Bu programı ve buna bağlı tüm dersleri ve verileri silmek istediğinize emin misiniz?",
      async () => {
        try {
          await pb.collection('programs').delete(currentProgId);
          addLog(`Program silindi.`);
          await refreshAll(null, currentTermId, null);
        } catch (e) {
          triggerAlert("Hata", e.message);
        }
      }
    );
  };

  const handleAddTerm = () => {
    triggerPrompt("Dönem Ekle", "Yeni Eğitim Yılı / Dönem adını girin:", "", "Örn: 2024-2025 Güz", async (name) => {
      if (!name) return;
      try {
        const record = await pb.collection('terms').create({ name });
        addLog(`Yeni Dönem eklendi: ${name}`);
        await refreshAll(currentProgId, record.id, currentDersId);
      } catch (e) {
        triggerAlert("Hata", e.message);
      }
    });
  };

  const handleEditTerm = () => {
    if (!currentTermId) return;
    const term = terms.find(t => t.id === currentTermId);
    if (!term) return;
    triggerPrompt("Dönemi Düzenle", "Dönem adını güncelleyin:", term.name, "Dönem Adı", async (name) => {
      if (!name) return;
      try {
        await pb.collection('terms').update(currentTermId, { name });
        addLog(`Dönem güncellendi: ${name}`);
        await refreshAll(currentProgId, currentTermId, currentDersId);
      } catch (e) {
        triggerAlert("Hata", e.message);
      }
    });
  };

  const handleDeleteTerm = () => {
    if (!currentTermId) return;
    triggerConfirm(
      "Dönemi Sil",
      "Bu dönemi silerseniz bağlı tüm dersler ve veriler silinecektir! Emin misiniz?",
      async () => {
        try {
          await pb.collection('terms').delete(currentTermId);
          addLog("Dönem silindi.");
          await refreshAll(currentProgId, null, null);
        } catch (e) {
          triggerAlert("Hata", e.message);
        }
      }
    );
  };

  // Course Add / Edit trigger
  const handleOpenCourseModal = (editData = null) => {
    if (!currentProgId || !currentTermId) {
      triggerAlert("Uyarı", "Önce Program ve Dönem seçmelisiniz!");
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
      triggerAlert("Uyarı", "Ders Kodu zorunludur!");
      return;
    }
    if (!dersAdi.trim()) {
      triggerAlert("Uyarı", "Ders Adı zorunludur!");
      return;
    }
    if (totalPercentage !== 100) {
      triggerAlert("Uyarı", `Sınav ağırlık toplamı 100 olmalıdır! Şu an: ${totalPercentage}%`);
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
      triggerAlert("Hata", e.message);
    }
  };

  const handleDeleteCourse = () => {
    if (!currentDersId) return;
    triggerConfirm(
      "Dersi Sil",
      "Bu dersi silmek istediğinize emin misiniz?",
      async () => {
        try {
          await pb.collection('courses').delete(currentDersId);
          addLog("Ders silindi.");
          await refreshAll(currentProgId, currentTermId, null);
        } catch (e) {
          triggerAlert("Hata", e.message);
        }
      }
    );
  };

  return (
    <>
      {/* Dynamic Selector Bar */}
      <div className="flex flex-col gap-3 bg-s-light/60 border-l-4 border-s p-5 rounded-2xl shadow-sm">
        {/* Row 1: Program */}
        <div className="flex items-center gap-3">
          <University size={16} className="text-s shrink-0" />
          <div className="flex-1 min-w-0">
            <select
              value={currentProgId || ''}
              onChange={(e) => { setCurrentProgId(e.target.value); setCurrentDersId(null); }}
              disabled={progLocked}
              className="w-full p-2 border border-border rounded-lg text-sm bg-white focus:border-s focus:outline-none focus:ring-4 focus:ring-s/15 transition-all duration-200 disabled:bg-slate-100 disabled:cursor-not-allowed"
            >
              <option value="">Program Seçiniz</option>
              {programs.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <button className="p-1.5 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg text-slate-600 cursor-pointer transition-all disabled:opacity-30 disabled:cursor-not-allowed" onClick={handleEditProgram} disabled={!currentProgId} title="Düzenle"><Edit size={14} /></button>
          <button className="p-1.5 bg-white hover:bg-red-50 border border-slate-200 rounded-lg text-danger cursor-pointer transition-all disabled:opacity-30 disabled:cursor-not-allowed" onClick={handleDeleteProgram} disabled={!currentProgId} title="Sil"><Trash2 size={14} /></button>
          <label className="flex items-center gap-1 text-[10px] text-text-muted cursor-pointer select-none hover:text-slate-700 transition-colors whitespace-nowrap">
            <input type="checkbox" checked={progLocked} onChange={(e) => setProgLocked(e.target.checked)} className="w-3 h-3 cursor-pointer" />
            {progLocked ? <Lock size={11} /> : <Unlock size={11} />}
          </label>
        </div>

        {/* Row 2: Dönem */}
        <div className="flex items-center gap-3">
          <Calendar size={16} className="text-warning shrink-0" />
          <div className="flex-1 min-w-0">
            <select
              value={currentTermId || ''}
              onChange={(e) => { setCurrentTermId(e.target.value); setCurrentDersId(null); }}
              disabled={termLocked}
              className="w-full p-2 border border-border rounded-lg text-sm bg-white focus:border-s focus:outline-none focus:ring-4 focus:ring-s/15 transition-all duration-200 disabled:bg-slate-100 disabled:cursor-not-allowed"
            >
              <option value="">Dönem Seçiniz</option>
              {terms.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <button className="p-1.5 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg text-slate-600 cursor-pointer transition-all disabled:opacity-30 disabled:cursor-not-allowed" onClick={handleEditTerm} disabled={!currentTermId} title="Düzenle"><Edit size={14} /></button>
          <button className="p-1.5 bg-white hover:bg-red-50 border border-slate-200 rounded-lg text-danger cursor-pointer transition-all disabled:opacity-30 disabled:cursor-not-allowed" onClick={handleDeleteTerm} disabled={!currentTermId} title="Sil"><Trash2 size={14} /></button>
          <label className="flex items-center gap-1 text-[10px] text-text-muted cursor-pointer select-none hover:text-slate-700 transition-colors whitespace-nowrap">
            <input type="checkbox" checked={termLocked} onChange={(e) => setTermLocked(e.target.checked)} className="w-3 h-3 cursor-pointer" />
            {termLocked ? <Lock size={11} /> : <Unlock size={11} />}
          </label>
        </div>

        {/* Row 3: Ders */}
        <div className="flex items-center gap-3">
          <BookOpen size={16} className="text-success shrink-0" />
          <div className="flex-1 min-w-0">
            <select
              value={currentDersId || ''}
              onChange={(e) => setCurrentDersId(e.target.value)}
              disabled={dersLocked || !currentProgId || !currentTermId}
              className="w-full p-2 border border-border rounded-lg text-sm bg-white focus:border-s focus:outline-none focus:ring-4 focus:ring-s/15 transition-all duration-200 disabled:bg-slate-100 disabled:cursor-not-allowed"
            >
              <option value="">Ders Seçiniz</option>
              {courses
                .filter(c => c.program_id === currentProgId && c.term_id === currentTermId)
                .map(d => <option key={d.id} value={d.id}>{d.code ? `${d.code} - ` : ''}{d.name}</option>)}
            </select>
          </div>
          <button className="p-1.5 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg text-slate-600 cursor-pointer transition-all disabled:opacity-30 disabled:cursor-not-allowed" onClick={() => { const d = courses.find(c => c.id === currentDersId); handleOpenCourseModal(d); }} disabled={!currentDersId} title="Düzenle"><Edit size={14} /></button>
          <button className="p-1.5 bg-white hover:bg-red-50 border border-slate-200 rounded-lg text-danger cursor-pointer transition-all disabled:opacity-30 disabled:cursor-not-allowed" onClick={handleDeleteCourse} disabled={!currentDersId} title="Sil"><Trash2 size={14} /></button>
          <label className="flex items-center gap-1 text-[10px] text-text-muted cursor-pointer select-none hover:text-slate-700 transition-colors whitespace-nowrap">
            <input type="checkbox" checked={dersLocked} onChange={(e) => setDersLocked(e.target.checked)} className="w-3 h-3 cursor-pointer" />
            {dersLocked ? <Lock size={11} /> : <Unlock size={11} />}
          </label>
        </div>

        {/* Row 4: Action buttons */}
        <div className="flex gap-2 pt-2.5 border-t border-slate-200/60 mt-0.5">
          <button className="px-3 py-1.5 bg-s hover:bg-p-hover text-white rounded-lg text-[11px] font-semibold cursor-pointer transition-all flex items-center gap-1.5 shadow-sm" onClick={handleAddProgram}><Plus size={12} /> Program</button>
          <button className="px-3 py-1.5 bg-warning hover:opacity-90 text-white rounded-lg text-[11px] font-semibold cursor-pointer transition-all flex items-center gap-1.5 shadow-sm" onClick={handleAddTerm}><Plus size={12} /> Dönem</button>
          <button className="px-3 py-1.5 bg-success hover:opacity-90 text-white rounded-lg text-[11px] font-semibold cursor-pointer transition-all flex items-center gap-1.5 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed" onClick={() => handleOpenCourseModal(null)} disabled={!currentProgId || !currentTermId}><Plus size={12} /> Ders</button>
        </div>
      </div>

      {/* Hierarchy Area */}
      <div className="bg-white p-6 rounded-2xl border border-border shadow-sm hover:shadow-md transition-all duration-200">
        <h3 className="font-display m-0 mb-4 text-base font-bold text-p flex items-center gap-2 tracking-tight">
          <University size={18} /> Üniversite / Bölüm Hiyerarşisi
        </h3>

        {!currentTermId ? (
          <div className="text-center p-8 text-text-muted border border-dashed border-border rounded-xl text-sm font-medium">
            Lütfen bir dönem seçiniz.
          </div>
        ) : hierarchyData.length === 0 ? (
          <div className="text-center p-8 text-text-muted border border-dashed border-border rounded-xl text-sm font-medium">
            Bu dönem için henüz ders tanımlanmamış.
          </div>
        ) : (
          hierarchyData.map((prog, idx) => (
            <div key={idx} className="bg-white rounded-xl border border-border p-5 border-l-4 border-l-s mb-4 shadow-sm hover:shadow-md transition-all duration-200">
              <div className="flex items-center mb-3 pb-2 border-b border-border">
                <University size={16} className="text-p mr-2.5" />
                <h4 className="m-0 font-bold text-p text-sm uppercase tracking-wider">{prog.name}</h4>
                <span className="ml-auto text-xs text-text-muted font-medium">{prog.courses.length} ders</span>
              </div>

              <div className="flex flex-col gap-3">
                {prog.courses.map(c => (
                  <div
                    key={c.id}
                    className={`rounded-xl border p-3.5 cursor-pointer flex flex-col gap-1 transition-all duration-200 ${currentDersId === c.id ? 'border-s bg-s-light shadow-sm shadow-s/5' : 'border-slate-100 bg-slate-50/50 hover:bg-slate-50'}`}
                    onClick={() => setCurrentDersId(c.id)}
                  >
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <BookOpen size={14} className="text-s" />
                      {c.code && (
                        <span className="bg-p text-white px-2 py-0.5 rounded text-[10px] font-bold">
                          {c.code}
                        </span>
                      )}
                      <span className="font-bold text-slate-800 text-sm">{c.name}</span>
                    </div>

                    <div className="flex items-center gap-4.5 mt-1.5 flex-wrap">
                      {c.instructor && (
                        <span className="text-xs text-text-muted flex items-center gap-1 font-medium">
                          <User size={12} className="text-slate-400" /> {c.instructor}
                        </span>
                      )}
                      {c.akts && (
                        <span className="text-xs text-text-muted flex items-center gap-1 font-medium">
                          <Award size={12} className="text-slate-400" /> AKTS: <b>{c.akts}</b>
                        </span>
                      )}
                      {c.grade_level && (
                        <span className="text-xs text-text-muted flex items-center gap-1 font-medium">
                          <Layers size={12} className="text-slate-400" /> {getSinifLabel(c.grade_level)}
                        </span>
                      )}
                    </div>

                    <div className="flex gap-1.5 flex-wrap mt-2">
                      {c.pct_vize > 0 && <span className="bg-blue-100 text-blue-700 px-2.5 py-0.5 rounded-full text-[10px] font-bold">Vize %{c.pct_vize}</span>}
                      {c.pct_odev > 0 && <span className="bg-pink-100 text-pink-700 px-2.5 py-0.5 rounded-full text-[10px] font-bold">Ödev %{c.pct_odev}</span>}
                      {c.pct_uygulama > 0 && <span className="bg-orange-100 text-orange-700 px-2.5 py-0.5 rounded-full text-[10px] font-bold">Uygulama %{c.pct_uygulama}</span>}
                      {c.pct_final > 0 && <span className="bg-green-100 text-green-700 px-2.5 py-0.5 rounded-full text-[10px] font-bold">Final %{c.pct_final}</span>}
                      {c.pct_but > 0 && <span className="bg-purple-100 text-purple-700 px-2.5 py-0.5 rounded-full text-[10px] font-bold">Büt %{c.pct_but}</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Course Modal */}
      <div className={`fixed inset-0 bg-slate-950/75 backdrop-blur-md z-[9999] flex justify-center items-center transition-all duration-300 ${isDersModalOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}>
        <div className={`bg-white border border-white/50 rounded-3xl w-[560px] max-w-[95vw] shadow-2xl overflow-y-auto max-h-[90vh] transition-all duration-300 ${isDersModalOpen ? 'scale-100 translate-y-0 opacity-100' : 'scale-95 translate-y-2 opacity-0'}`}>
          <div className="flex items-center justify-between p-6 pb-4 border-b border-border">
            <h3 className="font-display m-0 text-[16px] font-bold text-slate-900">{selectedDers ? '✏️ Ders Düzenle' : '📚 Yeni Ders Ekle'}</h3>
            <button className="bg-transparent border-none text-slate-400 hover:text-slate-900 text-xl cursor-pointer transition-colors" onClick={() => setIsDersModalOpen(false)}>×</button>
          </div>
          <div className="p-6">
            <div className="flex gap-4 flex-col sm:flex-row mb-4">
              <div className="flex-1 flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Ders Kodu</label>
                <input type="text" value={dersKodu} onChange={(e) => setDersKodu(e.target.value)} placeholder="örn: BIL101" className="w-full px-3.5 py-2.5 border border-border rounded-lg text-sm bg-white focus:border-s focus:outline-none focus:ring-4 focus:ring-s/15 transition-all duration-200" />
              </div>
              <div className="flex-[2] flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Ders Adı</label>
                <input type="text" value={dersAdi} onChange={(e) => setDersAdi(e.target.value)} placeholder="örn: Algoritma ve Programlama" className="w-full px-3.5 py-2.5 border border-border rounded-lg text-sm bg-white focus:border-s focus:outline-none focus:ring-4 focus:ring-s/15 transition-all duration-200" />
              </div>
            </div>

            <div className="flex gap-4 flex-col sm:flex-row mb-4">
              <div className="flex-1 flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">AKTS Kredisi</label>
                <input type="number" min="1" max="30" value={dersAKTS} onChange={(e) => setDersAKTS(e.target.value)} className="w-full px-3.5 py-2.5 border border-border rounded-lg text-sm bg-white focus:border-s focus:outline-none focus:ring-4 focus:ring-s/15 transition-all duration-200" />
              </div>
              <div className="flex-1 flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Öğr. Elemanı</label>
                <input type="text" value={dersVeren} onChange={(e) => setDersVeren(e.target.value)} placeholder="Dr. Öğr. Üyesi Ahmet Yılmaz" className="w-full px-3.5 py-2.5 border border-border rounded-lg text-sm bg-white focus:border-s focus:outline-none focus:ring-4 focus:ring-s/15 transition-all duration-200" />
              </div>
              <div className="flex-1 flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Sınıf Seviyesi</label>
                <select value={dersSinif} onChange={(e) => setDersSinif(e.target.value)} className="w-full mt-0.5 p-2.5 border border-border rounded-xl text-sm bg-white focus:border-s focus:outline-none focus:ring-4 focus:ring-s/15 transition-all duration-200">
                  <option value="1">1. Sınıf</option>
                  <option value="2">2. Sınıf</option>
                  <option value="3">3. Sınıf</option>
                  <option value="4">4. Sınıf</option>
                  <option value="YL">Yüksek Lisans</option>
                  <option value="DR">Doktora</option>
                </select>
              </div>
            </div>

            <hr className="border-none border-t border-slate-900/10 my-6" />
            <h4 className="text-xs font-bold text-s mb-4 uppercase tracking-wider">⚖️ Değerlendirme Yüzdeleri Ağırlığı</h4>

            <div className="grid grid-cols-5 gap-3">
              <div className="flex flex-col gap-1.5 text-center">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Vize (%)</label>
                <input type="number" min="0" max="100" value={pctVize} onChange={(e) => setPctVize(parseInt(e.target.value) || 0)} className="w-full text-center px-2 py-2 border border-border rounded-lg text-sm bg-white focus:border-s focus:outline-none focus:ring-4 focus:ring-s/15 transition-all duration-200" />
              </div>
              <div className="flex flex-col gap-1.5 text-center">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Ödev (%)</label>
                <input type="number" min="0" max="100" value={pctOdev} onChange={(e) => setPctOdev(parseInt(e.target.value) || 0)} className="w-full text-center px-2 py-2 border border-border rounded-lg text-sm bg-white focus:border-s focus:outline-none focus:ring-4 focus:ring-s/15 transition-all duration-200" />
              </div>
              <div className="flex flex-col gap-1.5 text-center">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Uyg. (%)</label>
                <input type="number" min="0" max="100" value={pctUygulama} onChange={(e) => setPctUygulama(parseInt(e.target.value) || 0)} className="w-full text-center px-2 py-2 border border-border rounded-lg text-sm bg-white focus:border-s focus:outline-none focus:ring-4 focus:ring-s/15 transition-all duration-200" />
              </div>
              <div className="flex flex-col gap-1.5 text-center">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Final (%)</label>
                <input type="number" min="0" max="100" value={pctFinal} onChange={(e) => setPctFinal(parseInt(e.target.value) || 0)} className="w-full text-center px-2 py-2 border border-border rounded-lg text-sm bg-white focus:border-s focus:outline-none focus:ring-4 focus:ring-s/15 transition-all duration-200" />
              </div>
              <div className="flex flex-col gap-1.5 text-center">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Büt (%)</label>
                <input type="number" value={pctBut} disabled className="w-full text-center px-2 py-2 border border-border rounded-lg text-sm bg-slate-100 text-slate-400 cursor-not-allowed" />
              </div>
            </div>

            <div className="mt-5 flex items-center gap-3 text-xs font-semibold">
              <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{
                    width: `${Math.min(totalPercentage, 100)}%`,
                    backgroundColor: totalPercentage === 100 ? 'var(--success)' : totalPercentage > 100 ? 'var(--danger)' : 'var(--warning)'
                  }}
                />
              </div>
              <span className={totalPercentage === 100 ? 'text-success' : totalPercentage > 100 ? 'text-danger' : 'text-warning'}>
                Toplam: {totalPercentage}%
              </span>
            </div>
          </div>
          <div className="flex justify-end gap-3 px-6 py-4 bg-slate-50/50 border-t border-slate-900/5">
            <button className="px-4 py-2 rounded-xl font-semibold text-xs border border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300 text-slate-700 cursor-pointer transition-all duration-200" onClick={() => setIsDersModalOpen(false)}>İptal</button>
            <button className="px-4 py-2 rounded-xl font-semibold text-xs text-white bg-s hover:bg-blue-700 shadow-md shadow-s/20 cursor-pointer transition-all duration-200" onClick={handleSaveCourse}>{selectedDers ? 'Güncelle' : 'Kaydet'}</button>
          </div>
        </div>
      </div>
    </>
  );
}
