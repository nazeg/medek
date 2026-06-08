import React, { useState, useEffect } from 'react';
import { pb } from '../pb';
import { Plus, Trash2, BookOpen } from 'lucide-react';

export default function DCOutcomes({ currentDersId, refreshAll, addLog }) {
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

  const handleDelete = async (id) => {
    if (confirm("Bu DÇ silinsin mi?")) {
      try {
        await pb.collection('course_outcomes').delete(id);
        addLog("DÇ Silindi.");
        fetchDcs();
        await refreshAll(null, null, currentDersId);
      } catch (e) {
        alert("Hata: " + e.message);
      }
    }
  };

  const handleAddRow = async () => {
    if (!currentDersId) return;
    const nextIndex = dcs.length + 1;
    const autoCode = `DÇ${nextIndex}`;
    const desc = prompt(`${autoCode} için Açıklama:`);
    if (desc === null) return;
    
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
  };

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
        <h3 className="card-title" style={{ margin: 0 }}>
          <BookOpen size={18} /> Ders Öğrenme Çıktıları (DÇ) Yönetimi
        </h3>
        <button className="btn btn-success" onClick={handleAddRow} disabled={!currentDersId}>
          <Plus size={14} /> Yeni DÇ Tanımla
        </button>
      </div>

      {!currentDersId ? (
        <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>
          Lütfen üst menüden bir Ders seçiniz.
        </div>
      ) : loading ? (
        <div style={{ textAlign: 'center', padding: '20px' }}>Yükleniyor...</div>
      ) : dcs.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>
          Henüz Ders Çıktısı tanımlanmamış. "Yeni DÇ Tanımla" butonu ile başlayın.
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
              {dcs.map((dc) => (
                <tr key={dc.id}>
                  <td style={{ textAlign: 'center' }}>
                    <input
                      style={{ textAlign: 'center', fontWeight: 'bold' }}
                      defaultValue={dc.code}
                      onBlur={(e) => {
                        if (e.target.value !== dc.code) {
                          handleUpdate(dc.id, 'code', e.target.value);
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') e.target.blur();
                      }}
                    />
                  </td>
                  <td>
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
                    />
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <button className="btn btn-danger btn-sm" onClick={() => handleDelete(dc.id)}>
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
