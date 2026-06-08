import React, { useState, useEffect } from 'react';
import { pb } from '../pb';
import { Plus, Trash2, Award } from 'lucide-react';

export default function PCOutcomes({ currentProgId, refreshAll, addLog, triggerPrompt, triggerConfirm, triggerAlert, addToast }) {
  const [pcs, setPcs] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchPcs = async () => {
    if (!currentProgId) return;
    setLoading(true);
    try {
      const records = await pb.collection('program_outcomes').getFullList({
        filter: `program_id = "${currentProgId}"`,
        sort: 'code',
      });
      
      // Natural sorting by code (PÇ1, PÇ2, ..., PÇ10)
      const sorted = records.sort((a, b) => 
        (a.code || '').localeCompare((b.code || ''), undefined, { numeric: true, sensitivity: 'base' })
      );
      setPcs(sorted);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPcs();
  }, [currentProgId]);

  const handleUpdate = async (id, field, value) => {
    try {
      await pb.collection('program_outcomes').update(id, { [field]: value });
      addLog(`PÇ Güncellendi: ${value}`);
      // Fast updates in state
      setPcs(prev => prev.map(p => p.id === id ? { ...p, [field]: value } : p));
    } catch (e) {
      triggerAlert("Hata", "Hata: " + e.message);
      fetchPcs(); // Revert on failure
    }
  };

  const handleDelete = (id) => {
    triggerConfirm(
      "Program Çıktısını Sil",
      "Bu PÇ silinsin mi?",
      async () => {
        try {
          await pb.collection('program_outcomes').delete(id);
          addLog("PÇ Silindi.");
          fetchPcs();
          // Also refresh global lists if necessary
          await refreshAll(currentProgId, null, null);
        } catch (e) {
          triggerAlert("Hata", "Hata: " + e.message);
        }
      }
    );
  };

  const handleAddRow = () => {
    if (!currentProgId) return;
    const nextIndex = pcs.length + 1;
    const autoCode = `PÇ${nextIndex}`;
    
    triggerPrompt(
      "Yeni PÇ Ekle",
      `${autoCode} için Açıklama giriniz:`,
      "",
      "Açıklama",
      async (desc) => {
        if (!desc) return;
        try {
          await pb.collection('program_outcomes').create({
            program_id: currentProgId,
            code: autoCode,
            description: desc
          });
          addLog(`Yeni PÇ eklendi: ${autoCode}`);
          fetchPcs();
          await refreshAll(currentProgId, null, null);
        } catch (e) {
          triggerAlert("Hata", "Hata: " + e.message);
        }
      }
    );
  };

  return (
    <div className="bg-white p-6 rounded-2xl border border-border shadow-sm hover:shadow-md transition-all duration-200">
      <div className="flex justify-between items-center mb-5">
        <h3 className="font-display m-0 text-base font-bold text-p flex items-center gap-2 tracking-tight">
          <Award size={18} /> Program Çıktıları (PÇ) Yönetimi
        </h3>
        <button className="px-3.5 py-2 bg-success hover:opacity-90 text-white rounded-lg text-xs font-semibold cursor-pointer transition-all flex items-center gap-1.5 shadow-md shadow-success/10 disabled:opacity-50 disabled:cursor-not-allowed" onClick={handleAddRow} disabled={!currentProgId}>
          <Plus size={14} /> Yeni PÇ Tanımla
        </button>
      </div>

      {!currentProgId ? (
        <div className="text-center p-8 text-text-muted border border-dashed border-border rounded-xl text-sm font-medium">
          Lütfen üst menüden bir Program seçiniz.
        </div>
      ) : loading ? (
        <div className="text-center p-8 text-text-muted text-sm font-medium">Yükleniyor...</div>
      ) : pcs.length === 0 ? (
        <div className="text-center p-8 text-text-muted border border-dashed border-border rounded-xl text-sm font-medium">
          Henüz PÇ tanımlanmamış. "Yeni PÇ Tanımla" butonu ile başlayın.
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
              {pcs.map((pc) => (
                <tr key={pc.id} className="border-b border-border last:border-0 hover:bg-slate-50/20">
                  <td className="px-4 py-2.5 text-center">
                    <input
                      defaultValue={pc.code}
                      onBlur={(e) => {
                        if (e.target.value !== pc.code) {
                          handleUpdate(pc.id, 'code', e.target.value);
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
                      defaultValue={pc.description}
                      onBlur={(e) => {
                        if (e.target.value !== pc.description) {
                          handleUpdate(pc.id, 'description', e.target.value);
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') e.target.blur();
                      }}
                      className="w-full px-3 py-1.5 border border-border rounded-lg text-sm bg-white focus:border-s focus:outline-none focus:ring-4 focus:ring-s/15 transition-all duration-200"
                    />
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    <button className="px-2.5 py-1.5 bg-danger hover:opacity-90 text-white rounded-md text-[11px] font-semibold cursor-pointer transition-all flex items-center gap-1 shadow-sm shadow-danger/10 mx-auto" onClick={() => handleDelete(pc.id)}>
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
