import React, { useState, useEffect } from 'react';
import { pb } from '../pb';
import { Grid3X3, RefreshCw } from 'lucide-react';

export default function Matrix({ currentProgId, currentDersId, addLog, triggerAlert, addToast }) {
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
      triggerAlert("Uyarı", "Matris değeri 0 ile 5 arasında olmalıdır!");
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
      triggerAlert("Hata", e.message);
      fetchMatrix(); // Reload on failure
    }
  };

  const getCellVal = (dcCode, pcCode) => {
    const found = matrixData.find(m => m.dc_code === dcCode && m.pc_code === pcCode);
    return found ? found.value : 0;
  };

  return (
    <div className="bg-white p-6 rounded-2xl border border-border shadow-sm hover:shadow-md transition-all duration-200">
      <div className="flex justify-between items-center mb-5">
        <h3 className="font-display m-0 text-base font-bold text-p flex items-center gap-2 tracking-tight">
          <Grid3X3 size={18} /> PÇ - DÇ İlişki Matrisi
        </h3>
        {currentDersId && (
          <button className="px-2.5 py-1.5 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 cursor-pointer transition-all flex items-center gap-1" onClick={fetchMatrix} disabled={loading}>
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} /> Yenile
          </button>
        )}
      </div>

      {!currentDersId ? (
        <div className="text-center p-8 text-text-muted border border-dashed border-border rounded-xl text-sm font-medium">
          Lütfen üst menüden bir Ders seçiniz.
        </div>
      ) : loading ? (
        <div className="text-center p-8 text-text-muted text-sm font-medium">Yükleniyor...</div>
      ) : dcs.length === 0 || pcs.length === 0 ? (
        <div className="text-center p-8 text-text-muted border border-dashed border-border rounded-xl text-sm font-medium">
          Matris tablosu oluşturulamadı. Lütfen hem Program Çıktılarını (PÇ) hem de Ders Çıktılarını (DÇ) tanımladığınızdan emin olun.
        </div>
      ) : (
        <div className="overflow-x-auto border border-border rounded-xl bg-white mt-4">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-border bg-slate-50/50">
                <th className="px-4 py-3 text-xs font-bold text-text-muted uppercase tracking-wider min-w-[200px] sm:min-w-[300px]">DÇ / PÇ</th>
                {pcs.map(pc => (
                  <th key={pc.id} className="px-4 py-3 text-xs font-bold text-text-muted uppercase tracking-wider min-w-[70px] text-center">{pc.code}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {dcs.map(dc => (
                <tr key={dc.id} className="border-b border-border last:border-0 hover:bg-slate-50/20">
                  <td className="px-4 py-3">
                    <div className="font-bold text-slate-800 text-sm">{dc.code}</div>
                    <div className="text-xs text-text-muted font-normal mt-0.5 max-w-[400px]">
                      {dc.description}
                    </div>
                  </td>
                  {pcs.map(pc => (
                    <td key={pc.id} className="px-4 py-3 text-center">
                      <input
                        type="number"
                        min="0"
                        max="5"
                        value={getCellVal(dc.code, pc.code)}
                        onChange={(e) => handleValueChange(dc.code, pc.code, e.target.value)}
                        className="w-14 text-center px-1.5 py-1 border border-border rounded-lg text-sm bg-white focus:border-s focus:outline-none focus:ring-4 focus:ring-s/15 transition-all duration-200 font-bold mx-auto block"
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
