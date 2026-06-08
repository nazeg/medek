import React, { useState, useEffect } from 'react';
import { pb } from '../pb';
import { Bar, Radar } from 'react-chartjs-2';
import { Download, Library, Calendar, RefreshCw } from 'lucide-react';

export default function ProgramReport({ programs, terms, addLog, triggerAlert, addToast }) {
  const [selectedProgId, setSelectedProgId] = useState('');
  const [matrixSelections, setMatrixSelections] = useState({}); // termId_grade -> boolean
  const [loading, setLoading] = useState(false);
  const [reportResult, setReportResult] = useState(null);

  useEffect(() => {
    if (programs.length > 0) {
      setSelectedProgId(programs[0].id);
    }
  }, [programs]);

  const grades = ['1', '2', '3', '4', 'YL', 'DR'];
  const gradeLabels = { '1': '1. Sınıf', '2': '2. Sınıf', '3': '3. Sınıf', '4': '4. Sınıf', 'YL': 'Yüksek Lisans', 'DR': 'Doktora' };

  const handleCellToggle = (termId, grade) => {
    const key = `${termId}_${grade}`;
    setMatrixSelections(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const handleSelectAll = (check) => {
    const newSels = {};
    if (check) {
      terms.forEach(t => {
        grades.forEach(g => {
          newSels[`${t.id}_${g}`] = true;
        });
      });
    }
    setMatrixSelections(newSels);
  };

  const calculateScore = (s, g) => {
    if (!g) return 0;
    const qType = (s.question_type || '').toLowerCase();
    if (qType.includes('çoktan') || qType.includes('seçmeli')) {
      const map = { 1: 'A', 2: 'B', 3: 'C', 4: 'D', 5: 'E' };
      const studentAnswer = map[g.score] || '';
      return (studentAnswer === (s.answer_key || '').toUpperCase()) ? Number(s.max_score) : 0;
    } else if (qType.includes('doğru') || qType.includes('yanlış')) {
      const map = { 11: 'DOĞRU', 12: 'YANLIŞ' };
      const studentAnswer = map[g.score] || '';
      return (studentAnswer === (s.answer_key || '').toUpperCase()) ? Number(s.max_score) : 0;
    } else {
      return isNaN(parseFloat(g.score)) ? 0 : parseFloat(g.score);
    }
  };

  const handleGenerateReport = async () => {
    if (!selectedProgId) {
      triggerAlert("Uyarı", "Lütfen bir program seçiniz!");
      return;
    }

    // Filter active selections
    const selectedCells = Object.keys(matrixSelections).filter(k => matrixSelections[k]);
    if (selectedCells.length === 0) {
      triggerAlert("Uyarı", "Lütfen dönem-sınıf matrisinden en az bir hücre seçiniz!");
      return;
    }

    setLoading(true);
    try {
      const prog = programs.find(p => p.id === selectedProgId);
      
      // Get selected terms
      const selectedTermIds = [...new Set(selectedCells.map(c => c.split('_')[0]))];
      const selectedTerms = terms.filter(t => selectedTermIds.includes(t.id))
        .sort((a, b) => b.name.localeCompare(a.name));

      // 1. Fetch Program Outcomes (PÇ)
      const pcs = await pb.collection('program_outcomes').getFullList({
        filter: `program_id = "${selectedProgId}"`,
      });
      if (pcs.length === 0) {
        triggerAlert("Hata", "Seçili programa ait PÇ tanımlanmamış!");
        setLoading(false);
        return;
      }
      const sortedPcs = pcs.sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }));

      // 2. Multi-term aggregation state
      const pcAggregate = {};
      sortedPcs.forEach(pc => { pcAggregate[pc.code] = { weightedSum: 0, totalAkts: 0 }; });

      const coursePcRows = [];
      const termSummaryMap = {}; // termId -> { pcCode -> { wSum, wAkts } }

      // Loop through each term
      for (const term of selectedTerms) {
        // Fetch courses for this program and term
        let courses = await pb.collection('courses').getFullList({
          filter: `program_id = "${selectedProgId}" && term_id = "${term.id}"`,
        });

        // Filter by selected grades specifically for this term
        const termSelectedGrades = selectedCells
          .filter(c => c.startsWith(term.id))
          .map(c => c.split('_')[1]);

        if (termSelectedGrades.length > 0) {
          courses = courses.filter(c => termSelectedGrades.includes(String(c.grade_level)));
        } else {
          courses = [];
        }

        if (courses.length === 0) continue;

        termSummaryMap[term.id] = {};
        sortedPcs.forEach(pc => { termSummaryMap[term.id][pc.code] = { wSum: 0, wAkts: 0 }; });

        // Loop through each course in this term
        for (const course of courses) {
          // Fetch outcomes, questions, students, matrix, grades
          const dcs = await pb.collection('course_outcomes').getFullList({ filter: `course_id = "${course.id}"` });
          if (dcs.length === 0) continue;

          const qRecs = await pb.collection('questions').getFullList({ filter: `course_id = "${course.id}"` });
          if (qRecs.length === 0) continue;

          const sRecs = await pb.collection('students').getFullList({ filter: `course_id = "${course.id}"` });
          if (sRecs.length === 0) continue;

          const matrixRecs = await pb.collection('matrix').getFullList({ filter: `course_id = "${course.id}"` });

          // Fetch grades for course students
          const filterStr = sRecs.map(s => `student_id = "${s.id}"`).join(' || ');
          const gRecs = await pb.collection('student_grades').getFullList({ filter: `(${filterStr})` });

          // Determine exam types to use (Exclude Bütünleme if Final exists)
          const allTypes = [...new Set(qRecs.map(q => q.exam_type))];
          const hasFinal = allTypes.includes('Final');
          const useExams = allTypes.filter(et => !(et === 'Bütünleme' && hasFinal));

          const pctMap = {
            'Vize': course.pct_vize || 0,
            'Ödev': course.pct_odev || 0,
            'Uygulama': course.pct_uygulama || 0,
            'Final': course.pct_final || 0,
            'Bütünleme': course.pct_but || 0
          };
          const isMulti = useExams.length > 1;

          // DÇ success calculation
          const dcExamSonuc = {};
          dcs.forEach(d => {
            dcExamSonuc[d.code] = {};
            useExams.forEach(et => { dcExamSonuc[d.code][et] = { alinan: 0, max: 0 }; });
          });

          sRecs.forEach(o => {
            qRecs.forEach(s => {
              if (!useExams.includes(s.exam_type) || !s.dc_code) return;
              const sCodes = s.dc_code.split(', ').filter(c => c && dcExamSonuc[c]);
              if (!sCodes.length) return;
              const gr = gRecs.find(gr => gr.student_id === o.id && gr.question_id === s.id);
              const scoreVal = calculateScore(s, gr);
              sCodes.forEach(code => {
                dcExamSonuc[code][s.exam_type].alinan += Number(scoreVal);
                dcExamSonuc[code][s.exam_type].max += Number(s.max_score);
              });
            });
          });

          const dcData = {};
          const dcAssessed = {};
          dcs.forEach(dc => {
            if (!isMulti) {
              const et = useExams[0];
              const { alinan, max } = dcExamSonuc[dc.code][et] || { alinan: 0, max: 0 };
              dcData[dc.code] = max > 0 ? (alinan / max) * 100 : 0;
              dcAssessed[dc.code] = max > 0;
            } else {
              let wSum = 0, wTotal = 0;
              useExams.forEach(et => {
                const { alinan, max } = dcExamSonuc[dc.code][et] || { alinan: 0, max: 0 };
                if (max > 0) {
                  wSum += (alinan / max) * 100 * (pctMap[et] || 0);
                  wTotal += (pctMap[et] || 0);
                }
              });
              dcData[dc.code] = wTotal > 0 ? wSum / wTotal : 0;
              dcAssessed[dc.code] = wTotal > 0;
            }
          });

          // Course outcome (DÇ) -> Program outcomes (PÇ)
          const coursePc = {};
          let courseHasPc = false;
          sortedPcs.forEach(pc => {
            let katki = 0, iliski = 0;
            dcs.forEach(dc => {
              if (!dcAssessed[dc.code]) return;
              const rel = matrixRecs.find(m => m.dc_code === dc.code && m.pc_code === pc.code)?.value || 0;
              if (rel > 0) {
                katki += (dcData[dc.code] || 0) * rel;
                iliski += rel;
              }
            });
            coursePc[pc.code] = iliski > 0 ? katki / iliski : null;
            if (iliski > 0) courseHasPc = true;
          });

          if (courseHasPc) {
            const akts = course.akts || 1;
            coursePcRows.push({ course, term, pcScores: coursePc, akts });

            sortedPcs.forEach(pc => {
              if (coursePc[pc.code] !== null) {
                pcAggregate[pc.code].weightedSum += coursePc[pc.code] * akts;
                pcAggregate[pc.code].totalAkts += akts;
                termSummaryMap[term.id][pc.code].wSum += coursePc[pc.code] * akts;
                termSummaryMap[term.id][pc.code].wAkts += akts;
              }
            });
          }
        }
      }

      // Calculate final aggregated PÇ scores
      const finalPcLabels = sortedPcs.map(p => p.code);
      const finalPcData = sortedPcs.map(pc => {
        const agg = pcAggregate[pc.code];
        return agg.totalAkts > 0 ? (agg.weightedSum / agg.totalAkts) : 0;
      });

      const selectedClassIds = [...new Set(selectedCells.map(c => c.split('_')[1]))];

      setReportResult({
        program: prog,
        selectedTerms,
        selectedClassIds,
        sortedPcs,
        coursePcRows,
        termSummaryMap,
        finalPcLabels,
        finalPcData
      });

      addLog(`Program Raporu Hazırlandı: ${coursePcRows.length} adet ders analize katıldı.`);
    } catch (e) {
      triggerAlert("Hata", e.message);
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleExportPDF = () => {
    if (!reportResult) return;
    const element = document.getElementById('prog-report-export-area');
    if (!element) return;

    const filename = `${(reportResult.program?.name || 'Program').replace(/[^a-z0-9ğüşöçİI]/gi, '_')}_Program_PC_GeriBesleme_Raporu.pdf`;
    document.body.classList.add('pdf-mode');

    const opt = {
      margin: [0.4, 0.4, 0.4, 0.4],
      filename: filename,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: 'in', format: 'a4', orientation: 'landscape', compress: true },
      pagebreak: { mode: ['css', 'legacy'], avoid: ['.card', 'tr'] }
    };

    addLog('Program PÇ Raporu PDF oluşturuluyor...');
    
    if (window.html2pdf) {
      window.html2pdf().set(opt).from(element).save().then(() => {
        document.body.classList.remove('pdf-mode');
        addLog('PDF indirildi.');
      }).catch(err => {
        document.body.classList.remove('pdf-mode');
        console.error(err);
      });
    } else {
      addToast("PDF motoru yükleniyor. Lütfen tekrar deneyin.", "success");
      const script = document.createElement('script');
      script.src = "https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js";
      document.body.appendChild(script);
      document.body.classList.remove('pdf-mode');
    }
  };

  const getSinifLabel = (v) => {
    const map = { '1': '1. Sınıf', '2': '2. Sınıf', '3': '3. Sınıf', '4': '4. Sınıf', 'YL': 'Yüksek Lisans', 'DR': 'Doktora' };
    return map[v] || v;
  };

  const getSuccessColor = (val) => val >= 70 ? '#10b981' : val >= 50 ? '#f59e0b' : '#ef4444';
  const getSuccessBg = (val) => val >= 70 ? '#d1fae5' : val >= 50 ? '#fef3c7' : '#fee2e2';

  return (
    <div className="bg-white p-6 rounded-2xl border border-border shadow-sm hover:shadow-md transition-all duration-200">
      <div className="flex justify-between items-center mb-5">
        <h3 className="font-display m-0 text-base font-bold text-p flex items-center gap-2 tracking-tight">
          <Library size={18} /> Program PÇ Raporu (Çoklu Dönem)
        </h3>
        {reportResult && (
          <button className="px-3 py-1.5 bg-s hover:bg-p-hover text-white rounded-lg text-xs font-semibold cursor-pointer transition-all flex items-center gap-1.5 shadow-md shadow-s/10" onClick={handleExportPDF}>
            <Download size={12} /> Rapor PDF İndir
          </button>
        )}
      </div>

      <div className="flex flex-col gap-4 mb-6">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Raporlanacak Program</label>
          <select value={selectedProgId} onChange={(e) => setSelectedProgId(e.target.value)} className="w-full mt-1.5 p-2.5 border border-border rounded-xl text-sm bg-white focus:border-s focus:outline-none focus:ring-4 focus:ring-s/15 transition-all duration-200">
            <option value="">Seçiniz</option>
            {programs.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>

        {/* Term & Class Selection Matrix */}
        <div>
          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">Dönem & Sınıf Seçim Matrisi</label>
          
          <div className="flex gap-2 mb-3">
            <button className="px-2.5 py-1.5 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 cursor-pointer transition-all flex items-center gap-1" onClick={() => handleSelectAll(true)}>Hepsini Seç</button>
            <button className="px-2.5 py-1.5 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 cursor-pointer transition-all flex items-center gap-1" onClick={() => handleSelectAll(false)}>Seçimleri Temizle</button>
          </div>

          {terms.length === 0 ? (
            <span className="text-xs text-text-muted font-medium">Sistemde tanımlı dönem bulunamadı.</span>
          ) : (
            <div className="overflow-x-auto border border-border rounded-xl bg-white">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="border-b border-border bg-slate-50/50">
                    <th className="px-3 py-3 text-xs font-bold text-text-muted uppercase tracking-wider">Dönem</th>
                    {grades.map(g => (
                      <th key={g} className="px-3 py-3 text-xs font-bold text-text-muted uppercase tracking-wider text-center w-[120px]">{gradeLabels[g]}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {terms.map(t => (
                    <tr key={t.id} className="border-b border-border last:border-0 hover:bg-slate-50/20">
                      <td className="px-3 py-2.5 font-bold text-xs text-slate-800">{t.name}</td>
                      {grades.map(g => {
                        const key = `${t.id}_${g}`;
                        const isChecked = !!matrixSelections[key];
                        return (
                          <td key={g} className="px-3 py-2 text-center">
                            <button
                              className={`w-full px-2 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all text-center block border ${isChecked ? 'bg-amber-50 hover:bg-amber-100 border-amber-300 text-amber-800' : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-500'}`}
                              onClick={() => handleCellToggle(t.id, g)}
                            >
                              {isChecked ? 'Seçildi' : 'Seç'}
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <button className="px-4 py-2.5 mt-2 bg-s hover:bg-p-hover text-white rounded-lg text-sm font-semibold cursor-pointer transition-all flex items-center justify-center gap-1.5 shadow-md shadow-s/10 w-full disabled:opacity-50" onClick={handleGenerateReport} disabled={loading || !selectedProgId}>
          {loading ? (
            <>
              <RefreshCw className="animate-spin" size={14} /> Rapor Oluşturuluyor...
            </>
          ) : (
            <>Raporu Oluştur</>
          )}
        </button>
      </div>

      {/* Report Results */}
      {reportResult && (
        <div id="prog-report-export-area" className="flex flex-col gap-6 mt-6">
          
          <div className="text-center border-b border-border pb-4">
            <h2 className="margin-0 font-display text-xl font-extrabold text-slate-900 tracking-tight">{reportResult.program?.name}</h2>
            <h4 className="margin-0 mt-1 text-sm font-bold text-s uppercase tracking-wider">Program Çıktısı (PÇ) Geri Besleme Raporu</h4>
            <div className="flex gap-1.5 justify-center mt-2.5 flex-wrap">
              {reportResult.selectedClassIds.map(g => (
                <span key={g} className="bg-amber-50 text-amber-800 px-3 py-1 rounded-full text-[10px] font-bold border border-amber-100">
                  {getSinifLabel(g)}
                </span>
              ))}
              {reportResult.selectedTerms.map(t => (
                <span key={t.id} className="bg-blue-50 text-s px-3 py-1 rounded-full text-[10px] font-bold border border-blue-100">
                  {t.name}
                </span>
              ))}
            </div>
          </div>

          {/* Charts Row */}
          <div className="flex gap-5 flex-col lg:flex-row">
            <div className="flex-[1.5] min-w-[320px] bg-white p-6 rounded-2xl border border-border shadow-sm">
              <h4 className="font-display m-0 mb-4 text-sm font-bold text-p tracking-tight">📊 PÇ Başarı Grafiği</h4>
              <div className="h-[320px] relative">
                <Bar
                  data={{
                    labels: reportResult.finalPcLabels,
                    datasets: [{
                      label: '% Başarı',
                      data: reportResult.finalPcData,
                      backgroundColor: reportResult.finalPcData.map(v => getSuccessColor(v)),
                      borderRadius: 6
                    }]
                  }}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                      legend: { display: false },
                      datalabels: {
                        anchor: 'end',
                        align: 'top',
                        formatter: (val) => val.toFixed(1) + '%',
                        font: { weight: 'bold', size: 9 },
                        color: 'var(--p)'
                      }
                    },
                    scales: { y: { min: 0, max: 100 } }
                  }}
                />
              </div>
            </div>

            <div className="flex-1 min-w-[280px] bg-white p-6 rounded-2xl border border-border shadow-sm">
              <h4 className="font-display m-0 mb-4 text-sm font-bold text-p tracking-tight">🕸️ PÇ Radar Görünümü</h4>
              <div className="h-[320px] relative">
                <Radar
                  data={{
                    labels: reportResult.finalPcLabels,
                    datasets: [{
                      label: '% Başarı',
                      data: reportResult.finalPcData,
                      borderColor: '#2563eb',
                      backgroundColor: 'rgba(37, 99, 235, 0.1)',
                      pointBackgroundColor: reportResult.finalPcData.map(v => getSuccessColor(v)),
                      pointRadius: 5,
                      fill: true
                    }]
                  }}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { datalabels: { display: false } },
                    scales: { r: { min: 0, max: 100 } }
                  }}
                />
              </div>
            </div>
          </div>

          {/* Outcomes Descriptions Table */}
          <div className="bg-white p-6 rounded-2xl border border-border shadow-sm">
            <h4 className="font-display m-0 mb-3 text-sm font-bold text-p tracking-tight">🎯 Program Çıktısı Özet Detayı ({reportResult.sortedPcs.length} PÇ)</h4>
            <div className="overflow-x-auto border border-border rounded-xl bg-white">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="border-b border-border bg-slate-50/50">
                    <th className="px-3 py-3 text-xs font-bold text-text-muted uppercase tracking-wider w-[100px]">Kod</th>
                    <th className="px-3 py-3 text-xs font-bold text-text-muted uppercase tracking-wider">Açıklama</th>
                    <th className="px-3 py-3 text-xs font-bold text-text-muted uppercase tracking-wider w-[120px] text-center">Genel Başarı</th>
                  </tr>
                </thead>
                <tbody>
                  {reportResult.sortedPcs.map((pc, idx) => {
                    const score = reportResult.finalPcData[idx];
                    return (
                      <tr key={pc.id} className="border-b border-border last:border-0 hover:bg-slate-50/20">
                        <td className="px-3 py-2.5 font-bold text-xs text-slate-800">{pc.code}</td>
                        <td className="px-3 py-2.5 text-xs text-text-muted leading-relaxed">{pc.description || '-'}</td>
                        <td className="px-3 py-2.5 text-center font-bold text-xs" style={{ color: getSuccessColor(score), backgroundColor: getSuccessBg(score) }}>
                          {score.toFixed(1)}%
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Courses Contributions Matrix Table */}
          <div className="bg-white p-6 rounded-2xl border border-border shadow-sm">
            <h4 className="font-display m-0 mb-3 text-sm font-bold text-p tracking-tight">📚 Ders Bazlı PÇ Katkı Tablosu ({reportResult.coursePcRows.length} ders)</h4>
            <div className="overflow-x-auto border border-border rounded-xl bg-white">
              <table className="w-full border-collapse text-left min-w-[600px]">
                <thead>
                  <tr className="bg-p border-b border-border text-white text-xs font-bold uppercase tracking-wider">
                    <th className="px-3 py-3 text-white">Dönem / Ders</th>
                    <th className="px-3 py-3 text-white text-center w-[75px]">AKTS</th>
                    {reportResult.finalPcLabels.map(l => (
                      <th key={l} className="px-3 py-3 text-white text-center w-[85px]">{l}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {reportResult.selectedTerms.map(term => {
                    const termRows = reportResult.coursePcRows.filter(r => r.term.id === term.id);
                    if (termRows.length === 0) return null;

                    return (
                      <React.Fragment key={term.id}>
                        {/* Term Header Row */}
                        <tr className="bg-s-light font-bold text-xs border-b border-border">
                          <td colSpan={2 + reportResult.finalPcLabels.length} className="px-4 py-2.5 text-s">
                            📅 {term.name} — {termRows.length} ders
                          </td>
                        </tr>
                        {/* Course Rows */}
                        {termRows.map((row, idx) => (
                          <tr key={row.course.id} className="border-b border-border hover:bg-slate-50/20">
                            <td className="px-4 py-2.5 pl-6 font-semibold text-xs text-slate-800">
                              {row.course.code && (
                                <span className="bg-p text-white px-1.5 py-0.5 rounded text-[10px] font-bold mr-1.5 inline-block">
                                  {row.course.code}
                                </span>
                              )}
                              {row.course.name}
                            </td>
                            <td className="px-3 py-2.5 text-center text-xs text-text-muted font-medium">{row.akts}</td>
                            {reportResult.finalPcLabels.map(pc => {
                              const v = row.pcScores[pc];
                              if (v === null) return <td key={pc} className="px-3 py-2.5 text-center text-slate-300 text-xs">—</td>;
                              return (
                                <td key={pc} className="px-3 py-2.5 text-center font-bold text-xs" style={{ color: getSuccessColor(v) }}>
                                  {v.toFixed(1)}
                                </td>
                              );
                            })}
                          </tr>
                        ))}

                        {/* Term Average Row */}
                        {reportResult.selectedTerms.length > 1 && (
                          <tr className="bg-slate-50/50 border-b border-border italic text-xs font-semibold text-text-muted">
                            <td className="px-4 py-2.5 pl-4">↳ {term.name} Dönemi Ortalaması</td>
                            <td className="px-3 py-2.5 text-center">{termRows.reduce((sum, r) => sum + r.akts, 0)}</td>
                            {reportResult.finalPcLabels.map(pc => {
                              const ts = reportResult.termSummaryMap[term.id][pc];
                              const v = ts.wAkts > 0 ? ts.wSum / ts.wAkts : 0;
                              return (
                                <td key={pc} className="px-3 py-2.5 text-center font-bold text-xs" style={{ color: getSuccessColor(v) }}>
                                  {v.toFixed(1)}
                                </td>
                              );
                            })}
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}

                  {/* Grand Average row */}
                  <tr className="bg-slate-100 font-bold border-t-2 border-slate-300 text-slate-800 text-xs">
                    <td className="px-3 py-3.5">GENEL ORTALAMA (AKTS Ağırlıklı)</td>
                    <td className="px-3 py-3.5 text-center">{reportResult.coursePcRows.reduce((sum, r) => sum + r.akts, 0)}</td>
                    {reportResult.finalPcLabels.map((pc, idx) => {
                      const v = reportResult.finalPcData[idx];
                      return (
                        <td key={pc} className="px-3 py-3.5 text-center font-bold text-xs text-white" style={{ backgroundColor: getSuccessColor(v) }}>
                          {v.toFixed(1)}%
                        </td>
                      );
                    })}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}
    </div>
  );
}
