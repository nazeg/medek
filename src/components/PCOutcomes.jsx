import React, { useState, useEffect } from 'react';
import { pb } from '../pb';
import { Plus, Trash2, Award, Info } from 'lucide-react';

export default function PCOutcomes({ currentProgId, refreshAll, addLog }) {
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
      alert("Hata: " + e.message);
      fetchPcs(); // Revert on failure
    }
  };

  const handleDelete = async (id) => {
    if (confirm("Bu PÇ silinsin mi?")) {
      try {
        await pb.collection('program_outcomes').delete(id);
        addLog("PÇ Silindi.");
        fetchPcs();
        // Also refresh global lists if necessary
        await refreshAll(currentProgId, null, null);
      } catch (e) {
        alert("Hata: " + e.message);
      }
    }
  };

  const handleAddRow = async () => {
    if (!currentProgId) return;
    const nextIndex = pcs.length + 1;
    const autoCode = `PÇ${nextIndex}`;
    const desc = prompt(`${autoCode} için Açıklama:`);
    if (desc === null) return; // Cancelled
    
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
      alert("Hata: " + e.message);
    }
  };

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
        <h3 className="card-title" style={{ margin: 0 }}>
          <Award size={18} /> Program Çıktıları (PÇ) Yönetimi
        </h3>
        <button className="btn btn-success" onClick={handleAddRow} disabled={!currentProgId}>
          <Plus size={14} /> Yeni PÇ Tanımla
        </button>
      </div>

      {!currentProgId ? (
        <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>
          Lütfen üst menüden bir Program seçiniz.
        </div>
      ) : loading ? (
        <div style={{ textAlign: 'center', padding: '20px' }}>Yükleniyor...</div>
      ) : pcs.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>
          Henüz PÇ tanımlanmamış. "Yeni PÇ Tanımla" butonu ile başlayın.
        </div>
      ) : (
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th style={{ width: '100px', textAlign: 'center' }}>Kod</th>
                <th>Açıklama</th>
                <th style={{ width: '100px', textAlign: 'center' }}>İşlem</th>
              </tr>
            </thead>
            <tbody>
              {pcs.map((pc) => (
                <tr key={pc.id}>
                  <td style={{ textAlign: 'center' }}>
                    <input
                      style={{ textAlign: 'center', fontWeight: 'bold' }}
                      defaultValue={pc.code}
                      onBlur={(e) => {
                        if (e.target.value !== pc.code) {
                          handleUpdate(pc.id, 'code', e.target.value);
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') e.target.blur();
                      }}
                    />
                  </td>
                  <td>
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
                    />
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <button className="btn btn-danger btn-sm" onClick={() => handleDelete(pc.id)}>
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
