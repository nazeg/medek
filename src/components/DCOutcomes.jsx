import React, { useState, useEffect } from 'react';
import { pb } from '../pb';
import { Plus, Trash2, BookOpen } from 'lucide-react';

export default function DCOutcomes({ currentDersId, refreshAll, addLog, triggerPrompt, triggerConfirm }) {
  const [dcs, setDcs] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchDcs = async () => {
    if (!currentDersId) return;
    setLoading(true);
    try {
      const records = await pb.collection('course_outcomes').getFullList({
        filter: `course_id = "${currentDersId}"`,
        sort: 'code',
      });
      
      // Natural sorting (DÇ1, DÇ2, ..., DÇ10)
      const sorted = records.sort((a, b) => 
        (a.code || '').localeCompare((b.code || ''), undefined, { numeric: true, sensitivity: 'base' })
      );
      setDcs(sorted);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDcs();
  }, [currentDersId]);

  const handleUpdate = async (id, field, value) => {
    try {
      await pb.collection('course_outcomes').update(id, { [field]: value });
      addLog(`DÇ Güncellendi: ${value}`);
      setDcs(prev => prev.map(d => d.id === id ? { ...d, [field]: value } : d));
    } catch (e) {
      alert("Hata: " + e.message);
      fetchDcs();
    }
  };

  const handleDelete = (id) => {
    triggerConfirm(
      "Ders Çıktısını Sil",
      "Bu DÇ silinsin mi?",
      async () => {
        try {
          await pb.collection('course_outcomes').delete(id);
          addLog("DÇ Silindi.");
          fetchDcs();
          await refreshAll(null, null, currentDersId);
        } catch (e) {
          alert("Hata: " + e.message);
        }
      }
    );
  };

  const handleAddRow = () => {
    if (!currentDersId) return;
    const nextIndex = dcs.length + 1;
    const autoCode = `DÇ${nextIndex}`;
    
    triggerPrompt(
      "Yeni DÇ Ekle",
      `${autoCode} için Açıklama giriniz:`,
      "",
      "Açıklama",
      async (desc) => {
        if (!desc) return;
        try {
          await pb.collection('course_outcomes').create({
            course_id: currentDersId,
            code: autoCode,
            description: desc
          });
          addLog(`Yeni DÇ eklendi: ${autoCode}`);
          fetchDcs();
          await refreshAll(null, null, currentDersId);
        } catch (e) {
          alert("Hata: " + e.message);
        }
      }
    );
  };

  return (
    <div className="bg-white p-6 rounded-2xl border border-border shadow-sm hover:shadow-md transition-all duration-200">
      <div className="flex justify-between items-center mb-5">
        <h3 className="font-display m-0 text-base font-bold text-p flex items-center gap-2 tracking-tight">
          <BookOpen size={18} /> Ders Öğrenme Çıktıları (DÇ) Yönetimi
        </h3>
        <button className="px-3.5 py-2 bg-success hover:opacity-90 text-white rounded-lg text-xs font-semibold cursor-pointer transition-all flex items-center gap-1.5 shadow-md shadow-success/10 disabled:opacity-50 disabled:cursor-not-allowed" onClick={handleAddRow} disabled={!currentDersId}>
          <Plus size={14} /> Yeni DÇ Tanımla
        </button>
      </div>

      {!currentDersId ? (
        <div className="text-center p-8 text-text-muted border border-dashed border-border rounded-xl text-sm font-medium">
          Lütfen üst menüden bir Ders seçiniz.
        </div>
      ) : loading ? (
        <div className="text-center p-8 text-text-muted text-sm font-medium">Yükleniyor...</div>
      ) : dcs.length === 0 ? (
        <div className="text-center p-8 text-text-muted border border-dashed border-border rounded-xl text-sm font-medium">
          Henüz Ders Çıktısı tanımlanmamış. "Yeni DÇ Tanımla" butonu ile başlayın.
        </div>
      ) : (
        <div className="overflow-x-auto border border-border rounded-xl bg-white mt-4">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-border bg-slate-50/50">
                <th className="px-4 py-3 text-xs font-bold text-text-muted uppercase tracking-wider w-[120px] text-center">Kod</th>
                <th className="px-4 py-3 text-xs font-bold text-text-muted uppercase tracking-wider">Açıklama</th>
                <th className="px-4 py-3 text-xs font-bold text-text-muted uppercase tracking-wider w-[100px] text-center">İşlem</th>
              </tr>
            </thead>
            <tbody>
              {dcs.map((dc) => (
                <tr key={dc.id} className="border-b border-border last:border-0 hover:bg-slate-50/20">
                  <td className="px-4 py-2.5 text-center">
                    <input
                      defaultValue={dc.code}
                      onBlur={(e) => {
                        if (e.target.value !== dc.code) {
                          handleUpdate(dc.id, 'code', e.target.value);
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') e.target.blur();
                      }}
                      className="w-full px-2 py-1.5 border border-border rounded-lg text-sm bg-white focus:border-s focus:outline-none focus:ring-4 focus:ring-s/15 transition-all duration-200 text-center font-bold"
                    />
                  </td>
                  <td className="px-4 py-2.5">
                    <input
                      defaultValue={dc.description}
                      onBlur={(e) => {
                        if (e.target.value !== dc.description) {
                          handleUpdate(dc.id, 'description', e.target.value);
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') e.target.blur();
                      }}
                      className="w-full px-3 py-1.5 border border-border rounded-lg text-sm bg-white focus:border-s focus:outline-none focus:ring-4 focus:ring-s/15 transition-all duration-200"
                    />
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    <button className="px-2.5 py-1.5 bg-danger hover:opacity-90 text-white rounded-md text-[11px] font-semibold cursor-pointer transition-all flex items-center gap-1 shadow-sm shadow-danger/10 mx-auto" onClick={() => handleDelete(dc.id)}>
                      <Trash2 size={12} /> Sil
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
