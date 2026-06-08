import React, { useState, useEffect } from 'react';
import { pb } from '../pb';
import ExcelJS from 'exceljs';
import * as XLSX from 'xlsx';
import { Plus, Trash2, Download, Upload } from 'lucide-react';

export default function GradeEntry({ currentDersId, addLog, triggerPrompt, triggerConfirm, triggerFields, triggerAlert, addToast }) {
  const [students, setStudents] = useState([]);
  const [grades, setGrades] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [activeFilter, setActiveFilter] = useState('Vize');
  const [loading, setLoading] = useState(false);

  const fetchGradesData = async () => {
    if (!currentDersId) return;
    setLoading(true);
    try {
      // 1. Fetch questions for the course
      const qRecords = await pb.collection('questions').getFullList({
        filter: `course_id = "${currentDersId}"`,
      });
      setQuestions(qRecords);

      // 2. Fetch students
      const sRecords = await pb.collection('students').getFullList({
        filter: `course_id = "${currentDersId}"`,
        sort: 'student_no',
      });
      setStudents(sRecords);

      // 3. Fetch grades for these students
      if (sRecords.length > 0) {
        // Collect student IDs to filter
        const studentIds = sRecords.map(s => `student_id = "${s.id}"`).join(' || ');
        const gRecords = await pb.collection('student_grades').getFullList({
          filter: `(${studentIds})`,
        });
        setGrades(gRecords);
      } else {
        setGrades([]);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGradesData();
  }, [currentDersId]);

  const handleUpdateStudent = async (id, field, val) => {
    try {
      await pb.collection('students').update(id, { [field]: val });
      setStudents(prev => prev.map(s => s.id === id ? { ...s, [field]: val } : s));
    } catch (e) {
      triggerAlert("Hata", e.message);
    }
  };

  const handleUpdateGrade = async (sid, qid, val, maxScore) => {
    const scoreVal = parseFloat(val) || 0;

    // Classic questions score validation
    if (maxScore !== null && scoreVal > maxScore) {
      triggerAlert("Uyarı", `Bu soru için tanımlanan maksimum puan ${maxScore}'dır. Girilen ${scoreVal} puanı sınırı aşmaktadır!`);
      return;
    }

    try {
      // Check if grade already exists
      const existing = grades.find(g => g.student_id === sid && g.question_id === qid);

      if (existing) {
        const record = await pb.collection('student_grades').update(existing.id, { score: scoreVal });
        setGrades(prev => prev.map(g => g.id === existing.id ? record : g));
      } else {
        const record = await pb.collection('student_grades').create({
          student_id: sid,
          question_id: qid,
          score: scoreVal
        });
        setGrades(prev => [...prev, record]);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteStudent = (id) => {
    triggerConfirm(
      "Öğrenciyi Sil",
      "Öğrenci silinsin mi?",
      async () => {
        try {
          await pb.collection('students').delete(id);
          addLog("Öğrenci silindi.");
          fetchGradesData();
        } catch (e) {
          triggerAlert("Hata", e.message);
        }
      }
    );
  };

  const handleAddStudent = () => {
    if (!currentDersId) return;
    triggerFields(
      "Manuel Öğrenci Ekle",
      [
        { label: "Öğrenci No", key: "student_no", placeholder: "örn: 2024001", value: "" },
        { label: "Adı Soyadı", key: "full_name", placeholder: "örn: Ahmet Yılmaz", value: "" }
      ],
      async (fieldValues) => {
        const no = fieldValues.student_no?.trim();
        const ad = fieldValues.full_name?.trim();
        if (no && ad) {
          try {
            await pb.collection('students').create({
              course_id: currentDersId,
              student_no: no,
              full_name: ad
            });
            addLog(`Öğrenci eklendi: ${no} - ${ad}`);
            fetchGradesData();
          } catch (e) {
            triggerAlert("Hata", e.message);
          }
        }
      }
    );
  };

  // Filter questions according to selected exam type
  const activeQuestions = (activeFilter === 'Tümü'
    ? questions
    : questions.filter(q => q.exam_type === activeFilter)
  ).sort((a, b) => {
    if (a.exam_type !== b.exam_type) return a.exam_type.localeCompare(b.exam_type);
    return a.code.localeCompare(b.code, undefined, { numeric: true, sensitivity: 'base' });
  });

  // Excel Templates Download
  const downloadTemplate = async () => {
    if (!currentDersId) {
      triggerAlert("Uyarı", "Önce bir ders seçmelisiniz!");
      return;
    }

    const headers = ["No", "Ad Soyad"];
    activeQuestions.forEach(s => {
      headers.push(`${s.code} (${s.exam_type})`);
    });

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Öğrenci Not Listesi');
    worksheet.views = [{ showGridLines: true }];

    worksheet.columns = headers.map(h => ({
      header: h,
      key: h,
      width: h === "Ad Soyad" ? 25 : h === "No" ? 18 : 15
    }));

    worksheet.addRow(["2024001", "Ahmet Yılmaz"]);
    worksheet.addRow(["2024002", "Ayşe Demir"]);

    // Header Styling
    const headerRow = worksheet.getRow(1);
    headerRow.height = 30;
    for (let c = 1; c <= headers.length; c++) {
      const cell = headerRow.getCell(c);
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF111E2E' }
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

    // Data rows style
    for (let r = 2; r <= 500; r++) {
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

    // Worksheet protection
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
    const fileName = activeFilter === 'Tümü' ? "Ogrenci_Not_Sablonu_Tumu.xlsx" : `Ogrenci_Not_Sablonu_${activeFilter}.xlsx`;
    link.href = URL.createObjectURL(blob);
    link.download = fileName;
    link.click();
    addLog(`${activeFilter} için dinamik öğrenci şablonu indirildi.`);
  };

  // Import student grades from Excel file
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

        if (!headers.includes("No") || !headers.includes("Ad Soyad")) {
          triggerAlert("Hata", "Yüklenen dosyada 'No' veya 'Ad Soyad' sütunları bulunamadı! Şablon başlıklarını değiştirmeyin.");
          return;
        }

        // Detect soru headers
        const excelSoruHeaders = headers.filter(h => h !== "No" && h !== "Ad Soyad" && h !== "");
        const rows = XLSX.utils.sheet_to_json(firstSheet);
        
        let studentCount = 0;
        let gradeCount = 0;

        for (const row of rows) {
          const studentNo = row.No?.toString();
          const fullName = row["Ad Soyad"];
          if (!studentNo) continue;

          // 1. Get or create student
          let studentId;
          const existingStudents = await pb.collection('students').getFullList({
            filter: `course_id = "${currentDersId}" && student_no = "${studentNo}"`,
          });

          if (existingStudents.length > 0) {
            studentId = existingStudents[0].id;
          } else {
            const newStudent = await pb.collection('students').create({
              course_id: currentDersId,
              student_no: studentNo,
              full_name: fullName
            });
            studentId = newStudent.id;
            studentCount++;
          }

          // 2. Process grades
          for (const s of questions) {
            const colName = `${s.code} (${s.exam_type})`;
            if (row[colName] !== undefined) {
              let score = 0;
              
              if (s.question_type === 'Çoktan Seçmeli') {
                const valStr = row[colName]?.toString().trim().toUpperCase();
                const map = { 'A': 1, 'B': 2, 'C': 3, 'D': 4, 'E': 5 };
                score = map[valStr] || (parseFloat(row[colName]) || 0);
              } else if (s.question_type === 'Doğru Yanlış') {
                const valStr = row[colName]?.toString().trim().toUpperCase();
                const map = { 'DOĞRU': 11, 'D': 11, 'YANLIŞ': 12, 'Y': 12 };
                score = map[valStr] || (parseFloat(row[colName]) || 0);
              } else {
                score = parseFloat(row[colName]) || 0;
              }

              // Update or Insert Grade
              const existingGrades = await pb.collection('student_grades').getFullList({
                filter: `student_id = "${studentId}" && question_id = "${s.id}"`,
              });

              if (existingGrades.length > 0) {
                await pb.collection('student_grades').update(existingGrades[0].id, { score });
              } else {
                await pb.collection('student_grades').create({
                  student_id: studentId,
                  question_id: s.id,
                  score
                });
              }
              gradeCount++;
            }
          }
        }

        addLog(`${studentCount} yeni öğrenci ve toplam ${gradeCount} not işlendi.`);
        fetchGradesData();
      } catch (err) {
        triggerAlert("Hata", err.message);
      } finally {
        e.target.value = '';
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const getStudentGradeVal = (sid, qid) => {
    const found = grades.find(g => g.student_id === sid && g.question_id === qid);
    return found ? found.score : '';
  };

  return (
    <div className="bg-white p-6 rounded-2xl border border-border shadow-sm hover:shadow-md transition-all duration-200">
      <h3 className="font-display m-0 mb-4 text-base font-bold text-p flex items-center gap-2 tracking-tight">Öğrenci Not Girişi</h3>

      <div className="flex items-center gap-4 bg-slate-50/50 border border-dashed border-border p-4 rounded-xl mb-5">
        <button className="px-2.5 py-1.5 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 cursor-pointer transition-all flex items-center gap-1.5" onClick={downloadTemplate}>
          <Download size={14} /> Öğrenci Şablonu İndir
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
            onClick={() => setActiveFilter(filter)}
          >
            {filter}
          </button>
        ))}

        <button className="px-3 py-1.5 bg-success hover:opacity-90 text-white rounded-lg text-xs font-semibold cursor-pointer transition-all flex items-center gap-1.5 shadow-md shadow-success/10 ml-auto disabled:opacity-50 disabled:cursor-not-allowed" onClick={handleAddStudent} disabled={!currentDersId}>
          <Plus size={12} /> Manuel Öğrenci Ekle
        </button>
      </div>

      {!currentDersId ? (
        <div className="text-center p-8 text-text-muted border border-dashed border-border rounded-xl text-sm font-medium">
          Lütfen üst menüden bir Ders seçiniz.
        </div>
      ) : loading ? (
        <div className="text-center p-8 text-text-muted text-sm font-medium">Yükleniyor...</div>
      ) : students.length === 0 ? (
        <div className="text-center p-8 text-text-muted border border-dashed border-border rounded-xl text-sm font-medium">
          Öğrenci listesi boş. "Manuel Öğrenci Ekle" veya Excel'den toplu içe aktarabilirsiniz.
        </div>
      ) : (
        <div className="overflow-x-auto border border-border rounded-xl bg-white mt-4">
          <table className="w-full border-collapse text-left min-w-[850px]">
            <thead>
              <tr className="border-b border-border bg-slate-50/50">
                <th className="px-3 py-3 text-xs font-bold text-text-muted uppercase tracking-wider w-[125px]">No</th>
                <th className="px-3 py-3 text-xs font-bold text-text-muted uppercase tracking-wider w-[200px]">Ad Soyad</th>
                {activeQuestions.map(s => (
                  <th key={s.id} className="px-3 py-3 text-xs font-bold text-text-muted uppercase tracking-wider w-[85px] text-center word-break-normal leading-normal">
                    {s.code}<br />({s.max_score}p)<br />
                    <small className="text-[10px] text-text-muted font-normal">
                      {s.exam_type.substring(0, 3)}
                    </small>
                  </th>
                ))}
                <th className="px-3 py-3 text-xs font-bold text-text-muted uppercase tracking-wider w-[75px] text-center">İşlem</th>
              </tr>
            </thead>
            <tbody>
              {students.map((o) => (
                <tr key={o.id} className="border-b border-border last:border-0 hover:bg-slate-50/20">
                  <td className="px-3 py-2">
                    <input
                      defaultValue={o.student_no}
                      onBlur={(e) => {
                        if (e.target.value !== o.student_no) {
                          handleUpdateStudent(o.id, 'student_no', e.target.value);
                        }
                      }}
                      className="w-full px-2 py-1.5 border border-border rounded-lg text-xs bg-white focus:border-s focus:outline-none focus:ring-4 focus:ring-s/15 transition-all duration-200 text-center"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      defaultValue={o.full_name}
                      onBlur={(e) => {
                        if (e.target.value !== o.full_name) {
                          handleUpdateStudent(o.id, 'full_name', e.target.value);
                        }
                      }}
                      className="w-full px-3 py-1.5 border border-border rounded-lg text-xs bg-white focus:border-s focus:outline-none focus:ring-4 focus:ring-s/15 transition-all duration-200"
                    />
                  </td>
                  {activeQuestions.map(s => {
                    const gradeVal = getStudentGradeVal(o.id, s.id);
                    if (s.question_type === 'Çoktan Seçmeli') {
                      return (
                        <td key={s.id} className="px-3 py-2">
                          <select
                            value={gradeVal}
                            onChange={(e) => handleUpdateGrade(o.id, s.id, e.target.value, null)}
                            className="w-full p-1.5 border border-border rounded-lg text-xs bg-white focus:border-s focus:outline-none focus:ring-4 focus:ring-s/15 transition-all duration-200 text-center"
                          >
                            <option value="">-</option>
                            <option value="1">A</option>
                            <option value="2">B</option>
                            <option value="3">C</option>
                            <option value="4">D</option>
                            <option value="5">E</option>
                          </select>
                        </td>
                      );
                    } else if (s.question_type === 'Doğru Yanlış') {
                      return (
                        <td key={s.id} className="px-3 py-2">
                          <select
                            value={gradeVal}
                            onChange={(e) => handleUpdateGrade(o.id, s.id, e.target.value, null)}
                            className="w-full p-1.5 border border-border rounded-lg text-xs bg-white focus:border-s focus:outline-none focus:ring-4 focus:ring-s/15 transition-all duration-200 text-center"
                          >
                            <option value="">-</option>
                            <option value="11">D</option>
                            <option value="12">Y</option>
                          </select>
                        </td>
                      );
                    } else {
                      return (
                        <td key={s.id} className="px-3 py-2">
                          <input
                            type="number"
                            min="0"
                            max={s.max_score}
                            value={gradeVal}
                            onChange={(e) => handleUpdateGrade(o.id, s.id, e.target.value, s.max_score)}
                            className="w-full px-1.5 py-1.5 border border-border rounded-lg text-xs bg-white focus:border-s focus:outline-none focus:ring-4 focus:ring-s/15 transition-all duration-200 text-center font-bold"
                          />
                        </td>
                      );
                    }
                  })}
                  <td className="px-3 py-2 text-center">
                    <button className="px-2 py-1.5 bg-danger hover:opacity-90 text-white rounded-md text-[11px] font-semibold cursor-pointer transition-all flex items-center gap-1 shadow-sm shadow-danger/10 mx-auto" onClick={() => handleDeleteStudent(o.id)}>
                      <Trash2 size={12} />
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
