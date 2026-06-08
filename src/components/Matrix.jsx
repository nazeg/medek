import React, { useState, useEffect } from 'react';
import { pb } from '../pb';
import { Grid3X3, RefreshCw } from 'lucide-react';

export default function Matrix({ currentProgId, currentDersId, addLog }) {
  const [pcs, setPcs] = useState([]);
  const [dcs, setDcs] = useState([]);
  const [matrixData, setMatrixData] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchMatrix = async () => {
    if (!currentProgId || !currentDersId) return;
    setLoading(true);
    try {
      // 1. Fetch PÇ
      const pcRecords = await pb.collection('program_outcomes').getFullList({
        filter: `program_id = "${currentProgId}"`,
      });
      const sortedPcs = pcRecords.sort((a, b) => 
        (a.code || '').localeCompare((b.code || ''), undefined, { numeric: true, sensitivity: 'base' })
      );
      setPcs(sortedPcs);

      // 2. Fetch DÇ
      const dcRecords = await pb.collection('course_outcomes').getFullList({
        filter: `course_id = "${currentDersId}"`,
      });
      const sortedDcs = dcRecords.sort((a, b) => 
        (a.code || '').localeCompare((b.code || ''), undefined, { numeric: true, sensitivity: 'base' })
      );
      setDcs(sortedDcs);

      // 3. Fetch Matrix
      const matrixRecords = await pb.collection('matrix').getFullList({
        filter: `course_id = "${currentDersId}"`,
      });
      setMatrixData(matrixRecords);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMatrix();
  }, [currentProgId, currentDersId]);

  const handleValueChange = async (dcCode, pcCode, valueStr) => {
    const val = parseInt(valueStr) || 0;
    if (val < 0 || val > 5) {
      alert("Matris değeri 0 ile 5 arasında olmalıdır!");
      return;
    }

    try {
      // Check if entry already exists in local state
      const existing = matrixData.find(m => m.dc_code === dcCode && m.pc_code === pcCode);

      if (existing) {
        const record = await pb.collection('matrix').update(existing.id, { value: val });
        addLog(`Matris güncellendi: ${dcCode}-${pcCode} = ${val}`);
        setMatrixData(prev => prev.map(m => m.id === existing.id ? record : m));
      } else {
        const record = await pb.collection('matrix').create({
          course_id: currentDersId,
          dc_code: dcCode,
          pc_code: pcCode,
          value: val
        });
        addLog(`Matris eklendi: ${dcCode}-${pcCode} = ${val}`);
        setMatrixData(prev => [...prev, record]);
      }
    } catch (e) {
      alert("Hata: " + e.message);
      fetchMatrix(); // Reload on failure
    }
  };

  const getCellVal = (dcCode, pcCode) => {
    const found = matrixData.find(m => m.dc_code === dcCode && m.pc_code === pcCode);
    return found ? found.value : 0;
  };

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
        <h3 className="card-title" style={{ margin: 0 }}>
          <Grid3X3 size={18} /> PÇ - DÇ İlişki Matrisi
        </h3>
        {currentDersId && (
          <button className="btn btn-secondary btn-sm" onClick={fetchMatrix} disabled={loading}>
            <RefreshCw size={12} className={loading ? 'fa-spin' : ''} /> Yenile
          </button>
        )}
      </div>

      {!currentDersId ? (
        <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>
          Lütfen üst menüden bir Ders seçiniz.
        </div>
      ) : loading ? (
        <div style={{ textAlign: 'center', padding: '20px' }}>Yükleniyor...</div>
      ) : dcs.length === 0 || pcs.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>
          Matris tablosu oluşturulamadı. Lütfen hem Program Çıktılarını (PÇ) hem de Ders Çıktılarını (DÇ) tanımladığınızdan emin olun.
        </div>
      ) : (
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>DÇ / PÇ</th>
                {pcs.map(pc => (
                  <th key={pc.id} style={{ textAlign: 'center', minWidth: '70px' }}>{pc.code}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {dcs.map(dc => (
                <tr key={dc.id}>
                  <td>
                    <div style={{ fontWeight: 'bold' }}>{dc.code}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 'normal', maxWidth: '300px' }}>
                      {dc.description}
                    </div>
                  </td>
                  {pcs.map(pc => (
                    <td key={pc.id} style={{ textAlign: 'center' }}>
                      <input
                        type="number"
                        min="0"
                        max="5"
                        style={{ width: '60px', textAlign: 'center', padding: '6px' }}
                        value={getCellVal(dc.code, pc.code)}
                        onChange={(e) => handleValueChange(dc.code, pc.code, e.target.value)}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
