import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { pb } from '../pb';
import ExcelJS from 'exceljs';
import * as XLSX from 'xlsx';
import { Plus, Trash2, Download, Upload, ChevronDown } from 'lucide-react';

export default function QuestionBank({ currentProgId, currentDersId, addLog, triggerPrompt, triggerConfirm, triggerAlert, addToast }) {
  const [questions, setQuestions] = useState([]);
  const [dcs, setDcs] = useState([]);
  const [pcs, setPcs] = useState([]);
  const [matrix, setMatrix] = useState([]);
  const [activeFilter, setActiveFilter] = useState('Tümü');
  const [loading, setLoading] = useState(false);
  const [activeDropdownId, setActiveDropdownId] = useState(null);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0, width: 0 });

  const triggerRefs = useRef({});
  const dropdownRef = useRef(null);

  const storeTriggerRef = useCallback((id, el) => {
    if (el) triggerRefs.current[id] = el;
  }, []);

  const openDropdown = (id) => {
    const el = triggerRefs.current[id];
    if (el) {
      const rect = el.getBoundingClientRect();
      setDropdownPos({ top: rect.bottom + 6, left: rect.left, width: rect.width });
    }
    setActiveDropdownId(prev => prev === id ? null : id);
  };

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
  }, [activeDropdownId]);

  const handleUpdate = async (id, field, val) => {
    // 1. If updating max_score, validate that total score for this exam doesn't exceed 100
    if (field === 'max_score') {
      const newVal = parseFloat(val) || 0;
      const targetQ = questions.find(q => q.id === id);
      if (targetQ) {
        const otherQsOfExam = questions.filter(q => q.exam_type === targetQ.exam_type && q.id !== id);
        const totalOthers = otherQsOfExam.reduce((sum, q) => sum + (parseFloat(q.max_score) || 0), 0);
        
        if (totalOthers + newVal > 100) {
          triggerAlert("Uyarı", `${targetQ.exam_type} sınavı için toplam puan 100'ü geçemez!\n\nDiğer soruların toplamı: ${totalOthers}\nSizin girdiğiniz: ${newVal}\nToplam: ${totalOthers + newVal}\n\nİşlem iptal edildi.`);
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
      triggerAlert("Hata", e.message);
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
      triggerAlert("Hata", e.message);
    }
  };

  const handleDelete = (id) => {
    triggerConfirm(
      "Soruyu Sil",
      "Soru silinsin mi?",
      async () => {
        try {
          await pb.collection('questions').delete(id);
          addLog("Soru silindi.");
          fetchQuestionsAndOutcomes();
        } catch (e) {
          triggerAlert("Hata", e.message);
        }
      }
    );
  };

  const handleAddSoru = () => {
    if (!currentDersId) return;
    
    triggerPrompt(
      "Yeni Soru Tanımla",
      "Soru Kodu giriniz (örn: S1):",
      "",
      "Soru Kodu",
      async (code) => {
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
          triggerAlert("Hata", e.message);
        }
      }
    );
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
      triggerAlert("Uyarı", "Önce bir ders seçmelisiniz!");
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
          triggerAlert("Hata", "Yüklenen dosyada şu zorunlu sütunlar bulunamadı:\n" + missingKeys.map(k => `- ${k}`).join('\n'));
          return;
        }

        const rows = XLSX.utils.sheet_to_json(firstSheet);
        if (rows.length === 0) {
          triggerAlert("Uyarı", "Yüklenecek veri bulunamadı.");
          return;
        }

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
        triggerAlert("Hata", "Dosya okuma hatası: " + err.message);
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
    <div className="bg-white p-6 rounded-2xl border border-border shadow-sm hover:shadow-md transition-all duration-200">
      <h3 className="font-display m-0 mb-4 text-base font-bold text-p flex items-center gap-2 tracking-tight">Sınav ve Soru Bankası</h3>

      <div className="flex items-center gap-4 bg-slate-50/50 border border-dashed border-border p-4 rounded-xl mb-5">
        <button className="px-2.5 py-1.5 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 cursor-pointer transition-all flex items-center gap-1.5" onClick={downloadTemplate}>
          <Download size={14} /> Soru Şablonu İndir
        </button>
        <div className="flex items-center gap-2">
          <Upload size={14} className="text-text-muted" />
          <input type="file" accept=".xlsx, .xls" onChange={handleImportExcel} className="border-none p-0 bg-transparent text-xs text-text-muted font-medium w-auto cursor-pointer" />
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap mb-4 w-full">
        {['Vize', 'Final', 'Bütünleme', 'Ödev', 'Uygulama', 'Tümü'].map((filter) => (
          <button
            key={filter}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all ${activeFilter === filter ? 'bg-s text-white shadow-md shadow-s/10' : 'bg-white hover:bg-slate-50 border border-slate-200 text-slate-700'}`}
            onClick={() => {
              setActiveFilter(filter);
              addLog(`Soru bankası ${filter} için filtrelendi.`);
            }}
          >
            {filter}
          </button>
        ))}
        
        <button className="px-3 py-1.5 bg-success hover:opacity-90 text-white rounded-lg text-xs font-semibold cursor-pointer transition-all flex items-center gap-1.5 shadow-md shadow-success/10 ml-auto disabled:opacity-50 disabled:cursor-not-allowed" onClick={handleAddSoru} disabled={!currentDersId}>
          <Plus size={12} /> Soru Ekle
        </button>
      </div>

      {!currentDersId ? (
        <div className="text-center p-8 text-text-muted border border-dashed border-border rounded-xl text-sm font-medium">
          Lütfen üst menüden bir Ders seçiniz.
        </div>
      ) : loading ? (
        <div className="text-center p-8 text-text-muted text-sm font-medium">Yükleniyor...</div>
      ) : filteredQuestions.length === 0 ? (
        <div className="text-center p-8 text-text-muted border border-dashed border-border rounded-xl text-sm font-medium">
          Bu kategoride soru bulunamadı. "Soru Ekle" veya "Soru Şablonu" ile Excel'den içe aktarabilirsiniz.
        </div>
      ) : (
        <div className="overflow-x-auto border border-border rounded-xl bg-white mt-4">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-border bg-slate-50/50">
                <th className="px-3 py-3 text-xs font-bold text-text-muted uppercase tracking-wider w-[80px] text-center">Kod</th>
                <th className="px-3 py-3 text-xs font-bold text-text-muted uppercase tracking-wider">Soru Metni</th>
                <th className="px-3 py-3 text-xs font-bold text-text-muted uppercase tracking-wider w-[100px]">Sınav</th>
                <th className="px-3 py-3 text-xs font-bold text-text-muted uppercase tracking-wider w-[130px]">Tür</th>
                <th className="px-3 py-3 text-xs font-bold text-text-muted uppercase tracking-wider w-[140px]">Kazanım (DÇ)</th>
                <th className="px-3 py-3 text-xs font-bold text-text-muted uppercase tracking-wider w-[100px] text-center">İlişkili PÇ</th>
                <th className="px-3 py-3 text-xs font-bold text-text-muted uppercase tracking-wider w-[80px] text-center">Puan</th>
                <th className="px-3 py-3 text-xs font-bold text-text-muted uppercase tracking-wider w-[110px] text-center">Anahtar</th>
                <th className="px-3 py-3 text-xs font-bold text-text-muted uppercase tracking-wider w-[80px] text-center">İşlem</th>
              </tr>
            </thead>
            <tbody>
              {filteredQuestions.map((s) => {
                const selectedDCs = (s.dc_code || '').split(', ').filter(Boolean);
                return (
                  <tr key={s.id} className="border-b border-border last:border-0 hover:bg-slate-50/20">
                    <td className="px-3 py-2 text-center">
                      <input
                        defaultValue={s.code}
                        onBlur={(e) => {
                          if (e.target.value !== s.code) {
                            handleUpdate(s.id, 'code', e.target.value);
                          }
                        }}
                        className="w-full px-2 py-1.5 border border-border rounded-lg text-xs bg-white focus:border-s focus:outline-none focus:ring-4 focus:ring-s/15 transition-all duration-200 text-center font-bold"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <textarea
                        defaultValue={s.description || ''}
                        onBlur={(e) => {
                          if (e.target.value !== s.description) {
                            handleUpdate(s.id, 'description', e.target.value);
                          }
                        }}
                        className="w-full px-2.5 py-1.5 border border-border rounded-lg text-xs bg-white focus:border-s focus:outline-none focus:ring-4 focus:ring-s/15 transition-all duration-200 min-h-[36px] resize-y"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                        {s.exam_type}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <select
                        value={s.question_type || 'Klasik'}
                        onChange={(e) => handleUpdate(s.id, 'question_type', e.target.value)}
                        className="w-full p-1.5 border border-border rounded-lg text-xs bg-white focus:border-s focus:outline-none focus:ring-4 focus:ring-s/15 transition-all duration-200"
                      >
                        <option value="Klasik">Klasik</option>
                        <option value="Çoktan Seçmeli">Çoktan Seçmeli</option>
                        <option value="Doğru Yanlış">Doğru Yanlış</option>
                        <option value="Boşluk Doldurma">Boşluk Doldurma</option>
                      </select>
                    </td>
                    <td className="px-3 py-2">
                      {/* Custom React Multiselect Dropdown */}
                      <div className="relative w-[130px]">
                        <div 
                          ref={(el) => storeTriggerRef(s.id, el)}
                          className="bg-white border border-border px-2.5 py-1.5 rounded-lg cursor-pointer text-xs flex justify-between items-center min-h-[34px] hover:border-slate-300 transition-colors"
                          onClick={() => openDropdown(s.id)}
                        >
                          <span className="flex gap-1 flex-wrap overflow-hidden">
                            {selectedDCs.length > 0 ? (
                              selectedDCs.map(c => <span key={c} className="bg-s text-white px-1.5 py-0.5 rounded text-[9px] font-bold tracking-wide">{c}</span>)
                            ) : (
                              <span className="text-text-muted">Seçiniz</span>
                            )}
                          </span>
                          <ChevronDown size={10} className="text-slate-400" />
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-center text-xs text-s font-bold">
                      {getRelatedPCs(s.dc_code)}
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        min="1"
                        max="100"
                        defaultValue={s.max_score}
                        onBlur={(e) => {
                          const val = parseFloat(e.target.value);
                          if (val !== s.max_score) {
                            handleUpdate(s.id, 'max_score', val);
                          }
                        }}
                        className="w-14 text-center px-1.5 py-1 border border-border rounded-lg text-xs bg-white focus:border-s focus:outline-none focus:ring-4 focus:ring-s/15 transition-all duration-200 font-bold mx-auto block"
                      />
                    </td>
                    <td className="px-3 py-2">
                      {s.question_type === 'Çoktan Seçmeli' ? (
                        <select
                          value={s.answer_key || ''}
                          onChange={(e) => handleUpdate(s.id, 'answer_key', e.target.value)}
                          className="w-full p-1.5 border border-border rounded-lg text-xs bg-white focus:border-s focus:outline-none focus:ring-4 focus:ring-s/15 transition-all duration-200"
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
                          className="w-full p-1.5 border border-border rounded-lg text-xs bg-white focus:border-s focus:outline-none focus:ring-4 focus:ring-s/15 transition-all duration-200"
                        >
                          <option value="">Seç</option>
                          <option value="Doğru">Doğru</option>
                          <option value="Yanlış">Yanlış</option>
                        </select>
                      ) : (
                        <input
                          placeholder="Cevap"
                          defaultValue={s.answer_key || ''}
                          onBlur={(e) => {
                            if (e.target.value !== s.answer_key) {
                              handleUpdate(s.id, 'answer_key', e.target.value);
                            }
                          }}
                          className="w-full px-2 py-1.5 border border-border rounded-lg text-xs bg-white focus:border-s focus:outline-none focus:ring-4 focus:ring-s/15 transition-all duration-200 text-center"
                        />
                      )}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <button className="px-2 py-1.5 bg-danger hover:opacity-90 text-white rounded-md text-[11px] font-semibold cursor-pointer transition-all flex items-center gap-1 shadow-sm shadow-danger/10 mx-auto" onClick={() => handleDelete(s.id)}>
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

      {/* Dropdown Portal - rendered at body level to avoid overflow clipping */}
      {activeDropdownId && createPortal(
        <div ref={dropdownRef}>
          <div 
            className="fixed z-[1000] bg-white min-w-[150px] shadow-xl p-2 rounded-xl max-h-[200px] overflow-y-auto border border-border"
            style={{ top: dropdownPos.top, left: dropdownPos.left, width: Math.max(dropdownPos.width, 150) }}
          >
            {dcs.map(dc => {
              const question = questions.find(q => q.id === activeDropdownId);
              const selectedDCs = (question?.dc_code || '').split(', ').filter(Boolean);
              return (
                <label key={dc.id} className="flex items-center gap-2 px-2 py-1.5 cursor-pointer text-xs rounded-md hover:bg-slate-50 transition-colors">
                  <input 
                    type="checkbox" 
                    checked={selectedDCs.includes(dc.code)} 
                    onChange={(e) => handleUpdateMultiDC(activeDropdownId, dc.code, e.target.checked)}
                    className="w-auto h-auto cursor-pointer"
                  />
                  {dc.code}
                </label>
              );
            })}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
