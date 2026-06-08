import React, { useState, useEffect } from 'react';
import { pb } from '../pb';
import ExcelJS from 'exceljs';
import * as XLSX from 'xlsx';
import { Plus, Trash2, Download, Upload, Filter, Save, RefreshCw } from 'lucide-react';

export default function GradeEntry({ currentDersId, addLog }) {
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
      alert("Hata: " + e.message);
    }
  };

  const handleUpdateGrade = async (sid, qid, val, maxScore) => {
    const scoreVal = parseFloat(val) || 0;

    // Classic questions score validation
    if (maxScore !== null && scoreVal > maxScore) {
      alert(`UYARI: Bu soru için tanımlanan maksimum puan ${maxScore}'dır. \nGirilen ${scoreVal} puanı sınırı aşmaktadır!`);
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

  const handleDeleteStudent = async (id) => {
    if (confirm("Öğrenci silinsin mi?")) {
      try {
        await pb.collection('students').delete(id);
        addLog("Öğrenci silindi.");
        fetchGradesData();
      } catch (e) {
        alert("Hata: " + e.message);
      }
    }
  };

  const handleAddStudent = async () => {
    if (!currentDersId) return;
    const no = prompt("Öğrenci No:");
    const ad = prompt("Ad Soyad:");
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
        alert("Hata: " + e.message);
      }
    }
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
      alert("Önce bir ders seçmelisiniz!");
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
          alert("Hata: Yüklenen dosyada 'No' veya 'Ad Soyad' sütunları bulunamadı! Şablon başlıklarını değiştirmeyin.");
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
        alert("Hata: " + err.message);
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
    <div className="card">
      <h3 className="card-title">Öğrenci Not Girişi</h3>

      <div className="excel-box">
        <button className="btn btn-secondary btn-sm" onClick={downloadTemplate}>
          <Download size={14} /> Öğrenci Şablonu İndir
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Upload size={14} style={{ color: 'var(--text-muted)' }} />
          <input type="file" accept=".xlsx, .xls" onChange={handleImportExcel} />
        </div>
      </div>

      <div className="btn-group" style={{ marginBottom: '15px', display: 'flex', width: '100%', alignItems: 'center' }}>
        {['Vize', 'Final', 'Bütünleme', 'Ödev', 'Uygulama', 'Tümü'].map((filter) => (
          <button
            key={filter}
            className={`btn btn-sm ${activeFilter === filter ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveFilter(filter)}
          >
            {filter}
          </button>
        ))}

        <button className="btn btn-success btn-sm" style={{ marginLeft: 'auto' }} onClick={handleAddStudent} disabled={!currentDersId}>
          <Plus size={12} /> Manuel Öğrenci Ekle
        </button>
      </div>

      {!currentDersId ? (
        <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>
          Lütfen üst menüden bir Ders seçiniz.
        </div>
      ) : loading ? (
        <div style={{ textAlign: 'center', padding: '20px' }}>Yükleniyor...</div>
      ) : students.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)', border: '1px dashed var(--border)', borderRadius: '8px' }}>
          Öğrenci listesi boş. "Manuel Öğrenci Ekle" veya Excel'den toplu içe aktarabilirsiniz.
        </div>
      ) : (
        <div className="table-container" style={{ overflowX: 'auto' }}>
          <table style={{ tableLayout: 'fixed', minWidth: '850px' }}>
            <thead>
              <tr>
                <th style={{ width: '110px' }}>No</th>
                <th style={{ width: '180px' }}>Ad Soyad</th>
                {activeQuestions.map(s => (
                  <th key={s.id} style={{ width: '75px', textAlign: 'center', wordBreak: 'break-word', lineHeight: 1.1 }}>
                    {s.code}<br />({s.max_score}p)<br />
                    <small style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 'normal' }}>
                      {s.exam_type.substring(0, 3)}
                    </small>
                  </th>
                ))}
                <th style={{ width: '60px', textAlign: 'center' }}>İşlem</th>
              </tr>
            </thead>
            <tbody>
              {students.map((o) => (
                <tr key={o.id}>
                  <td>
                    <input
                      style={{ padding: '4px', textAlign: 'center', fontSize: '0.8rem' }}
                      defaultValue={o.student_no}
                      onBlur={(e) => {
                        if (e.target.value !== o.student_no) {
                          handleUpdateStudent(o.id, 'student_no', e.target.value);
                        }
                      }}
                    />
                  </td>
                  <td>
                    <input
                      style={{ padding: '4px 8px', fontSize: '0.8rem' }}
                      defaultValue={o.full_name}
                      onBlur={(e) => {
                        if (e.target.value !== o.full_name) {
                          handleUpdateStudent(o.id, 'full_name', e.target.value);
                        }
                      }}
                    />
                  </td>
                  {activeQuestions.map(s => {
                    const gradeVal = getStudentGradeVal(o.id, s.id);
                    if (s.question_type === 'Çoktan Seçmeli') {
                      return (
                        <td key={s.id} style={{ padding: '2px' }}>
                          <select
                            style={{ padding: '4px', fontSize: '0.8rem', textAlign: 'center' }}
                            value={gradeVal}
                            onChange={(e) => handleUpdateGrade(o.id, s.id, e.target.value, null)}
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
                        <td key={s.id} style={{ padding: '2px' }}>
                          <select
                            style={{ padding: '4px', fontSize: '0.8rem', textAlign: 'center' }}
                            value={gradeVal}
                            onChange={(e) => handleUpdateGrade(o.id, s.id, e.target.value, null)}
                          >
                            <option value="">-</option>
                            <option value="11">D</option>
                            <option value="12">Y</option>
                          </select>
                        </td>
                      );
                    } else {
                      return (
                        <td key={s.id} style={{ padding: '2px' }}>
                          <input
                            type="number"
                            min="0"
                            max={s.max_score}
                            style={{ padding: '4px', textAlign: 'center', fontSize: '0.8rem' }}
                            value={gradeVal}
                            onChange={(e) => handleUpdateGrade(o.id, s.id, e.target.value, s.max_score)}
                          />
                        </td>
                      );
                    }
                  })}
                  <td style={{ textAlign: 'center' }}>
                    <button className="btn btn-danger btn-sm" style={{ padding: '4px 8px' }} onClick={() => handleDeleteStudent(o.id)}>
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
