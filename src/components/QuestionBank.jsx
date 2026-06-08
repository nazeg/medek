import React, { useState, useEffect, useRef } from 'react';
import { pb } from '../pb';
import ExcelJS from 'exceljs';
import * as XLSX from 'xlsx';
import { Plus, Trash2, Download, Upload, Filter, CheckCircle, ChevronDown, RefreshCw } from 'lucide-react';

export default function QuestionBank({ currentProgId, currentDersId, addLog }) {
  const [questions, setQuestions] = useState([]);
  const [dcs, setDcs] = useState([]);
  const [pcs, setPcs] = useState([]);
  const [matrix, setMatrix] = useState([]);
  const [activeFilter, setActiveFilter] = useState('Tümü');
  const [loading, setLoading] = useState(false);
  const [activeDropdownId, setActiveDropdownId] = useState(null);

  const dropdownRef = useRef(null);

  const fetchQuestionsAndOutcomes = async () => {
    if (!currentDersId) return;
    setLoading(true);
    try {
      // 1. Fetch questions
      const qRecords = await pb.collection('questions').getFullList({
        filter: `course_id = "${currentDersId}"`,
      });
      setQuestions(qRecords);

      // 2. Fetch DÇ
      const dcRecords = await pb.collection('course_outcomes').getFullList({
        filter: `course_id = "${currentDersId}"`,
      });
      setDcs(dcRecords);

      // 3. Fetch PÇ (Needed to calculate related PÇs for each question)
      const pcRecords = await pb.collection('program_outcomes').getFullList({
        filter: `program_id = "${currentProgId}"`,
      });
      setPcs(pcRecords);

      // 4. Fetch Matrix
      const matrixRecords = await pb.collection('matrix').getFullList({
        filter: `course_id = "${currentDersId}"`,
      });
      setMatrix(matrixRecords);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQuestionsAndOutcomes();
  }, [currentDersId]);

  // Click outside listener to close custom dropdown
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setActiveDropdownId(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleUpdate = async (id, field, val) => {
    // 1. If updating max_score, validate that total score for this exam doesn't exceed 100
    if (field === 'max_score') {
      const newVal = parseFloat(val) || 0;
      const targetQ = questions.find(q => q.id === id);
      if (targetQ) {
        const otherQsOfExam = questions.filter(q => q.exam_type === targetQ.exam_type && q.id !== id);
        const totalOthers = otherQsOfExam.reduce((sum, q) => sum + (parseFloat(q.max_score) || 0), 0);
        
        if (totalOthers + newVal > 100) {
          alert(`UYARI: ${targetQ.exam_type} sınavı için toplam puan 100'ü geçemez!\n\nDiğer soruların toplamı: ${totalOthers}\nSizin girdiğiniz: ${newVal}\nToplam: ${totalOthers + newVal}\n\nİşlem iptal edildi.`);
          fetchQuestionsAndOutcomes(); // Reset state
          return;
        }
      }
    }

    try {
      let updatePayload = { [field]: val };
      // If updating question type, reset the answer key for compatibility
      if (field === 'question_type') {
        updatePayload.answer_key = '';
      }

      const record = await pb.collection('questions').update(id, updatePayload);
      addLog(`Soru güncellendi: ${record.code} - ${field} = ${val}`);
      
      // Update local state
      setQuestions(prev => prev.map(q => q.id === id ? { ...q, ...updatePayload } : q));
    } catch (e) {
      alert("Hata: " + e.message);
      fetchQuestionsAndOutcomes();
    }
  };

  const handleUpdateMultiDC = async (id, dcCode, isChecked) => {
    const targetQ = questions.find(q => q.id === id);
    if (!targetQ) return;

    let selectedDCs = (targetQ.dc_code || '').split(', ').filter(Boolean);
    if (isChecked) {
      if (!selectedDCs.includes(dcCode)) {
        selectedDCs.push(dcCode);
      }
    } else {
      selectedDCs = selectedDCs.filter(code => code !== dcCode);
    }
    // Sort naturally to display nicely
    selectedDCs.sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
    const joined = selectedDCs.join(', ');

    try {
      await pb.collection('questions').update(id, { dc_code: joined });
      setQuestions(prev => prev.map(q => q.id === id ? { ...q, dc_code: joined } : q));
      addLog(`Soru DÇ ilişkisi güncellendi: ${targetQ.code} -> ${joined}`);
    } catch (e) {
      alert("Hata: " + e.message);
    }
  };

  const handleDelete = async (id) => {
    if (confirm("Soru silinsin mi?")) {
      try {
        await pb.collection('questions').delete(id);
        addLog("Soru silindi.");
        fetchQuestionsAndOutcomes();
      } catch (e) {
        alert("Hata: " + e.message);
      }
    }
  };

  const handleAddSoru = async () => {
    if (!currentDersId) return;
    const code = prompt("Soru Kodu (örn: S1):");
    if (!code) return;

    const examType = activeFilter === 'Tümü' ? 'Vize' : activeFilter;
    const defaultDc = dcs.length > 0 ? dcs[0].code : 'DÇ1';

    try {
      const record = await pb.collection('questions').create({
        course_id: currentDersId,
        code: code,
        exam_type: examType,
        dc_code: defaultDc,
        max_score: 10,
        question_type: 'Klasik',
        answer_key: ''
      });
      addLog(`Yeni soru tanımlandı: ${code} (${examType})`);
      fetchQuestionsAndOutcomes();
    } catch (e) {
      alert("Hata: " + e.message);
    }
  };

  // Excel Templates Download
  const downloadTemplate = async () => {
    const headers = ["Kod", "Açıklama", "Sınav", "Tür", "DÇ", "Puan", "Cevap"];
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Sorular');

    worksheet.views = [{ showGridLines: true }];
    worksheet.columns = headers.map(h => ({
      header: h,
      key: h,
      width: h === "Açıklama" ? 35 : h === "Tür" ? 20 : 12
    }));

    worksheet.addRow(["S1", "Örnek Soru Metni 1", "Vize", "Klasik", "DÇ1", 10, ""]);
    worksheet.addRow(["S2", "Örnek Soru Metni 2", "Vize", "Çoktan Seçmeli", "DÇ1", 5, "A"]);
    worksheet.addRow(["S3", "Örnek Soru Metni 3", "Vize", "Doğru Yanlış", "DÇ1", 5, "Doğru"]);
    worksheet.addRow(["S4", "Örnek Soru Metni 4", "Vize", "Boşluk Doldurma", "DÇ1", 10, ""]);

    // Style Header Row
    const headerRow = worksheet.getRow(1);
    headerRow.height = 30;
    for (let c = 1; c <= headers.length; c++) {
      const cell = headerRow.getCell(c);
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF111E2E' } // Deep Navy Primary
      };
      cell.font = { name: 'Segoe UI', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FF333333' } },
        bottom: { style: 'medium', color: { argb: 'FF111111' } },
        left: { style: 'thin', color: { argb: 'FF333333' } },
        right: { style: 'thin', color: { argb: 'FF333333' } }
      };
      cell.protection = { locked: true };
    }

    // Unlocked data rows
    for (let r = 2; r <= 200; r++) {
      const row = worksheet.getRow(r);
      row.height = 20;
      const isZebra = (r % 2 === 0);
      const bgArgb = isZebra ? 'FFF8F9FA' : 'FFFFFFFF';

      for (let c = 1; c <= headers.length; c++) {
        const cell = row.getCell(c);
        cell.protection = { locked: false };
        cell.font = { name: 'Segoe UI', size: 10 };
        cell.alignment = { vertical: 'middle', horizontal: c === 2 ? 'left' : 'center' };
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
        };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgArgb } };
      }
    }

    // Enable Protection
    await worksheet.protect('', {
      selectLockedCells: true,
      selectUnlockedCells: true,
      formatCells: true,
      formatColumns: true,
      formatRows: true,
      insertRows: true,
      deleteRows: true,
      sort: true,
      autoFilter: true
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = "Soru_Sablonu.xlsx";
    link.click();
    addLog("Soru bankası şablonu indirildi.");
  };

  // Import questions from Excel file
  const handleImportExcel = async (e) => {
    if (!currentDersId) {
      alert("Önce bir ders seçmelisiniz!");
      return;
    }
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const data = new Uint8Array(evt.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];

        // Fetch headers
        const headers = [];
        if (firstSheet['!ref']) {
          const range = XLSX.utils.decode_range(firstSheet['!ref']);
          const R = range.s.r;
          for (let C = range.s.c; C <= range.e.c; ++C) {
            const cell = firstSheet[XLSX.utils.encode_cell({ c: C, r: R })];
            if (cell && cell.v !== undefined) {
              headers.push(cell.v.toString().trim());
            }
          }
        }

        const requiredKeys = ["Kod", "Açıklama", "Sınav", "Tür", "DÇ", "Puan", "Cevap"];
        const missingKeys = [];
        for (const req of requiredKeys) {
          let found = false;
          if (req === "Kod" && (headers.includes("Kod") || headers.includes("code"))) found = true;
          else if (req === "Açıklama" && (headers.includes("Açıklama") || headers.includes("description"))) found = true;
          else if (req === "Sınav" && (headers.includes("Sınav") || headers.includes("exam_type"))) found = true;
          else if (req === "Tür" && (headers.includes("Tür") || headers.includes("type"))) found = true;
          else if (req === "DÇ" && (headers.includes("DÇ") || headers.includes("dc_code"))) found = true;
          else if (req === "Puan" && (headers.includes("Puan") || headers.includes("score"))) found = true;
          else if (req === "Cevap" && (headers.includes("Cevap") || headers.includes("key"))) found = true;
          if (!found) missingKeys.push(req);
        }

        if (missingKeys.length > 0) {
          alert("Hata: Yüklenen dosyada şu zorunlu sütunlar bulunamadı:\n" + missingKeys.map(k => `- ${k}`).join('\n'));
          return;
        }

        const rows = XLSX.utils.sheet_to_json(firstSheet);
        if (rows.length === 0) {
          alert("Yüklenecek veri bulunamadı.");
          return;
        }

        // Insert individually or in parallel batch. PocketBase JS SDK supports batch or sequential creations.
        // Sequential creation for database simplicity:
        let importCount = 0;
        for (const r of rows) {
          await pb.collection('questions').create({
            course_id: currentDersId,
            code: (r.Kod || r.code || "S?").toString(),
            description: (r.Açıklama || r.description || "").toString(),
            exam_type: (r.Sınav || r.exam_type || "Vize").toString(),
            question_type: (r.Tür || r.type || "Klasik").toString(),
            dc_code: (r.DÇ || r.dc_code || "DÇ1").toString(),
            max_score: parseFloat(r.Puan || r.score) || 0,
            answer_key: (r.Cevap || r.key || "").toString()
          });
          importCount++;
        }

        addLog(`${importCount} adet soru Excel'den içeri aktarıldı.`);
        fetchQuestionsAndOutcomes();
        setActiveFilter('Tümü');
      } catch (err) {
        alert("Dosya okuma hatası: " + err.message);
      } finally {
        e.target.value = ''; // Reset file input
      }
    };
    reader.readAsArrayBuffer(file);
  };

  // Helper to calculate related PCs based on selected DÇ codes
  const getRelatedPCs = (dcCodesStr) => {
    if (!dcCodesStr) return '-';
    const codes = dcCodesStr.split(', ').filter(Boolean);
    const related = pcs.filter(pc => 
      matrix.some(mx => codes.includes(mx.dc_code) && mx.pc_code === pc.code && mx.value > 0)
    ).map(pc => pc.code);

    return related.length > 0 ? related.join(', ') : '-';
  };

  // Sorting and Filtering questions
  const filteredQuestions = (activeFilter === 'Tümü' 
    ? questions 
    : questions.filter(q => q.exam_type === activeFilter)
  ).sort((a, b) => {
    if (a.exam_type !== b.exam_type) return a.exam_type.localeCompare(b.exam_type);
    return a.code.localeCompare(b.code, undefined, { numeric: true, sensitivity: 'base' });
  });

  return (
    <div className="card">
      <h3 className="card-title">Sınav ve Soru Bankası</h3>

      <div className="excel-box">
        <button className="btn btn-secondary btn-sm" onClick={downloadTemplate}>
          <Download size={14} /> Soru Şablonu İndir
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Upload size={14} style={{ color: 'var(--text-muted)' }} />
          <input type="file" accept=".xlsx, .xls" onChange={handleImportExcel} />
        </div>
      </div>

      <div className="btn-group" style={{ marginBottom: '15px', display: 'flex', alignItems: 'center', width: '100%' }}>
        {['Vize', 'Final', 'Bütünleme', 'Ödev', 'Uygulama', 'Tümü'].map((filter) => (
          <button
            key={filter}
            className={`btn btn-sm ${activeFilter === filter ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => {
              setActiveFilter(filter);
              addLog(`Soru bankası ${filter} için filtrelendi.`);
            }}
          >
            {filter}
          </button>
        ))}
        
        <button className="btn btn-success btn-sm" style={{ marginLeft: 'auto' }} onClick={handleAddSoru} disabled={!currentDersId}>
          <Plus size={12} /> Soru Ekle
        </button>
      </div>

      {!currentDersId ? (
        <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>
          Lütfen üst menüden bir Ders seçiniz.
        </div>
      ) : loading ? (
        <div style={{ textAlign: 'center', padding: '20px' }}>Yükleniyor...</div>
      ) : filteredQuestions.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)', border: '1px dashed var(--border)', borderRadius: '8px' }}>
          Bu kategoride soru bulunamadı. "Soru Ekle" veya "Soru Şablonu" ile Excel'den içe aktarabilirsiniz.
        </div>
      ) : (
        <div className="table-container" ref={dropdownRef}>
          <table>
            <thead>
              <tr>
                <th style={{ width: '60px' }}>Kod</th>
                <th>Soru Metni</th>
                <th style={{ width: '90px' }}>Sınav</th>
                <th style={{ width: '130px' }}>Tür</th>
                <th style={{ width: '120px' }}>Kazanım (DÇ)</th>
                <th style={{ width: '100px', textAlign: 'center' }}>İlişkili PÇ</th>
                <th style={{ width: '70px', textAlign: 'center' }}>Puan</th>
                <th style={{ width: '100px', textAlign: 'center' }}>Anahtar</th>
                <th style={{ width: '70px', textAlign: 'center' }}>İşlem</th>
              </tr>
            </thead>
            <tbody>
              {filteredQuestions.map((s) => {
                const selectedDCs = (s.dc_code || '').split(', ').filter(Boolean);
                return (
                  <tr key={s.id}>
                    <td>
                      <input
                        style={{ padding: '4px 6px', textAlign: 'center', fontWeight: 'bold' }}
                        defaultValue={s.code}
                        onBlur={(e) => {
                          if (e.target.value !== s.code) {
                            handleUpdate(s.id, 'code', e.target.value);
                          }
                        }}
                      />
                    </td>
                    <td>
                      <textarea
                        style={{ width: '100%', minHeight: '34px', fontSize: '0.8rem', padding: '6px', resize: 'vertical' }}
                        defaultValue={s.description || ''}
                        onBlur={(e) => {
                          if (e.target.value !== s.description) {
                            handleUpdate(s.id, 'description', e.target.value);
                          }
                        }}
                      />
                    </td>
                    <td>
                      <span className="btn btn-secondary btn-sm" style={{ padding: '2px 6px', fontSize: '0.7rem', background: '#f1f5f9' }}>
                        {s.exam_type}
                      </span>
                    </td>
                    <td>
                      <select
                        value={s.question_type || 'Klasik'}
                        onChange={(e) => handleUpdate(s.id, 'question_type', e.target.value)}
                        style={{ padding: '4px' }}
                      >
                        <option value="Klasik">Klasik</option>
                        <option value="Çoktan Seçmeli">Çoktan Seçmeli</option>
                        <option value="Doğru Yanlış">Doğru Yanlış</option>
                        <option value="Boşluk Doldurma">Boşluk Doldurma</option>
                      </select>
                    </td>
                    <td>
                      {/* Custom React Multiselect Dropdown */}
                      <div className={`dc-dropdown ${activeDropdownId === s.id ? 'active' : ''}`}>
                        <div 
                          className="dc-dropdown-btn" 
                          onClick={() => setActiveDropdownId(activeDropdownId === s.id ? null : s.id)}
                        >
                          <span style={{ display: 'flex', gap: '2px', flexWrap: 'wrap', overflow: 'hidden' }}>
                            {selectedDCs.length > 0 ? (
                              selectedDCs.map(c => <span key={c} className="dc-tag">{c}</span>)
                            ) : (
                              <span style={{ color: 'var(--text-muted)' }}>Seçiniz</span>
                            )}
                          </span>
                          <ChevronDown size={10} />
                        </div>
                        <div className="dc-dropdown-content">
                          {dcs.map(dc => (
                            <label key={dc.id} className="dc-option">
                              <input 
                                type="checkbox" 
                                checked={selectedDCs.includes(dc.code)} 
                                onChange={(e) => handleUpdateMultiDC(s.id, dc.code, e.target.checked)}
                              />
                              {dc.code}
                            </label>
                          ))}
                        </div>
                      </div>
                    </td>
                    <td style={{ textAlign: 'center', fontSize: '0.75rem', color: 'var(--s)', fontWeight: 'bold' }}>
                      {getRelatedPCs(s.dc_code)}
                    </td>
                    <td>
                      <input
                        type="number"
                        min="1"
                        max="100"
                        style={{ textAlign: 'center', padding: '4px' }}
                        defaultValue={s.max_score}
                        onBlur={(e) => {
                          const val = parseFloat(e.target.value);
                          if (val !== s.max_score) {
                            handleUpdate(s.id, 'max_score', val);
                          }
                        }}
                      />
                    </td>
                    <td>
                      {s.question_type === 'Çoktan Seçmeli' ? (
                        <select
                          value={s.answer_key || ''}
                          onChange={(e) => handleUpdate(s.id, 'answer_key', e.target.value)}
                          style={{ padding: '4px' }}
                        >
                          <option value="">Seçiniz</option>
                          <option value="A">A</option>
                          <option value="B">B</option>
                          <option value="C">C</option>
                          <option value="D">D</option>
                          <option value="E">E</option>
                        </select>
                      ) : s.question_type === 'Doğru Yanlış' ? (
                        <select
                          value={s.answer_key || ''}
                          onChange={(e) => handleUpdate(s.id, 'answer_key', e.target.value)}
                          style={{ padding: '4px' }}
                        >
                          <option value="">Seç</option>
                          <option value="Doğru">Doğru</option>
                          <option value="Yanlış">Yanlış</option>
                        </select>
                      ) : (
                        <input
                          style={{ padding: '4px', textAlign: 'center' }}
                          placeholder="Cevap Anahtarı"
                          defaultValue={s.answer_key || ''}
                          onBlur={(e) => {
                            if (e.target.value !== s.answer_key) {
                              handleUpdate(s.id, 'answer_key', e.target.value);
                            }
                          }}
                        />
                      )}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <button className="btn btn-danger btn-sm" onClick={() => handleDelete(s.id)}>
                        <Trash2 size={12} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
