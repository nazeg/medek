import React, { useState, useEffect } from 'react';
import { pb } from '../pb';
import { Bar, Radar } from 'react-chartjs-2';
import { Download, Library, Calendar, CheckSquare, Square, RefreshCw } from 'lucide-react';

export default function ProgramReport({ programs, terms, addLog }) {
  const [selectedProgId, setSelectedProgId] = useState('');
  const [matrixSelections, setMatrixSelections] = useState({}); // termId_grade -> boolean
  const [loading, setLoading] = useState(false);
  const [reportResult, setReportResult] = useState(null);

  const [reportChartBar, setReportChartBar] = useState(null);
  const [reportChartRadar, setReportChartRadar] = useState(null);

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
      alert("Lütfen bir program seçiniz!");
      return;
    }

    // Filter active selections
    const selectedCells = Object.keys(matrixSelections).filter(k => matrixSelections[k]);
    if (selectedCells.length === 0) {
      alert("Lütfen dönem-sınıf matrisinden en az bir hücre seçiniz!");
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
        alert("Seçili programa ait PÇ tanımlanmamış!");
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
      alert("Hata: " + e.message);
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
      alert("PDF motoru yükleniyor. Lütfen tekrar deneyin.");
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
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
        <h3 className="card-title" style={{ margin: 0 }}>
          <Library size={18} /> Program PÇ Raporu (Çoklu Dönem)
        </h3>
        {reportResult && (
          <button className="btn btn-primary btn-sm" onClick={handleExportPDF}>
            <Download size={12} /> Rapor PDF İndir
          </button>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginBottom: '20px' }}>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label>Raporlanacak Program</label>
          <select value={selectedProgId} onChange={(e) => setSelectedProgId(e.target.value)}>
            <option value="">Seçiniz</option>
            {programs.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>

        {/* Term & Class Selection Matrix */}
        <div>
          <label className="form-group" style={{ display: 'block', margin: '10px 0 6px 0' }}>Dönem & Sınıf Seçim Matrisi</label>
          
          <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
            <button className="btn btn-secondary btn-sm" onClick={() => handleSelectAll(true)}>Hepsini Seç</button>
            <button className="btn btn-secondary btn-sm" onClick={() => handleSelectAll(false)}>Seçimleri Temizle</button>
          </div>

          {terms.length === 0 ? (
            <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Sistemde tanımlı dönem bulunamadı.</span>
          ) : (
            <div className="table-container">
              <table>
                <thead>
                  <tr style={{ background: '#f8fafc' }}>
                    <th>Dönem</th>
                    {grades.map(g => (
                      <th key={g} style={{ textAlign: 'center', width: '120px' }}>{gradeLabels[g]}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {terms.map(t => (
                    <tr key={t.id}>
                      <td style={{ fontWeight: 'bold' }}>{t.name}</td>
                      {grades.map(g => {
                        const key = `${t.id}_${g}`;
                        const isChecked = !!matrixSelections[key];
                        return (
                          <td key={g} style={{ textAlign: 'center' }}>
                            <button
                              className="btn btn-sm"
                              style={{
                                background: isChecked ? '#fef3c7' : 'white',
                                borderColor: isChecked ? '#f59e0b' : '#cbd5e1',
                                color: isChecked ? '#b45309' : '#64748b',
                                width: '100%',
                                justifyContent: 'center'
                              }}
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

        <button className="btn btn-primary" onClick={handleGenerateReport} disabled={loading || !selectedProgId} style={{ marginTop: '10px' }}>
          {loading ? (
            <>
              <RefreshCw className="fa-spin" size={14} /> Rapor Oluşturuluyor...
            </>
          ) : (
            <>Raporu Oluştur</>
          )}
        </button>
      </div>

      {/* Report Results */}
      {reportResult && (
        <div id="prog-report-export-area" style={{ display: 'flex', flexDirection: 'column', gap: '24px', marginTop: '20px' }}>
          
          <div style={{ textAlign: 'center', borderBottom: '2px solid var(--border)', paddingBottom: '16px' }}>
            <h2 style={{ margin: 0, fontFamily: 'Outfit, sans-serif', color: 'var(--p)' }}>{reportResult.program?.name}</h2>
            <h4 style={{ margin: '6px 0 0', color: 'var(--s)' }}>Program Çıktısı (PÇ) Geri Besleme Raporu</h4>
            <div style={{ display: 'flex', gap: '6px', justifyContent: 'center', marginTop: '8px', flexWrap: 'wrap' }}>
              {reportResult.selectedClassIds.map(g => (
                <span key={g} style={{ background: '#fef3c7', color: '#b45309', padding: '2px 10px', borderRadius: '20px', fontSize: '0.7rem', fontWeight: 'bold' }}>
                  {getSinifLabel(g)}
                </span>
              ))}
              {reportResult.selectedTerms.map(t => (
                <span key={t.id} style={{ background: '#eff6ff', color: 'var(--s)', padding: '2px 10px', borderRadius: '20px', fontSize: '0.7rem', fontWeight: 'bold' }}>
                  {t.name}
                </span>
              ))}
            </div>
          </div>

          {/* Charts Row */}
          <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
            <div style={{ flex: 1.5, minWidth: '350px' }} className="card">
              <h4 style={{ margin: '0 0 12px 0', fontSize: '0.9rem', fontWeight: 'bold' }}>📊 PÇ Başarı Grafiği</h4>
              <div style={{ height: '320px', position: 'relative' }}>
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
                        font: { weight: 'bold', size: 10 },
                        color: 'var(--p)'
                      }
                    },
                    scales: { y: { min: 0, max: 100 } }
                  }}
                />
              </div>
            </div>

            <div style={{ flex: 1, minWidth: '280px' }} className="card">
              <h4 style={{ margin: '0 0 12px 0', fontSize: '0.9rem', fontWeight: 'bold' }}>🕸️ PÇ Radar Görünümü</h4>
              <div style={{ height: '320px', position: 'relative' }}>
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
          <div className="card">
            <h4 className="card-title">🎯 Program Çıktısı Özet Detayı ({reportResult.sortedPcs.length} PÇ)</h4>
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th style={{ width: '80px' }}>Kod</th>
                    <th>Açıklama</th>
                    <th style={{ width: '100px', textAlign: 'center' }}>Genel Başarı</th>
                  </tr>
                </thead>
                <tbody>
                  {reportResult.sortedPcs.map((pc, idx) => {
                    const score = reportResult.finalPcData[idx];
                    return (
                      <tr key={pc.id}>
                        <td><b>{pc.code}</b></td>
                        <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{pc.description || '-'}</td>
                        <td style={{
                          textAlign: 'center',
                          fontWeight: 'bold',
                          color: getSuccessColor(score),
                          backgroundColor: getSuccessBg(score)
                        }}>
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
          <div className="card">
            <h4 className="card-title">📚 Ders Bazlı PÇ Katkı Tablosu ({reportResult.coursePcRows.length} ders)</h4>
            <div className="table-container">
              <table style={{ minWidth: '600px' }}>
                <thead>
                  <tr style={{ background: 'var(--p)', color: 'white' }}>
                    <th style={{ color: 'white' }}>Dönem / Ders</th>
                    <th style={{ textAlign: 'center', width: '55px', color: 'white' }}>AKTS</th>
                    {reportResult.finalPcLabels.map(l => (
                      <th key={l} style={{ textAlign: 'center', width: '65px', color: 'white' }}>{l}</th>
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
                        <tr style={{ background: '#eff6ff', fontWeight: 'bold' }}>
                          <td colSpan={2 + reportResult.finalPcLabels.length} style={{ color: 'var(--s)', padding: '8px 12px' }}>
                            📅 {term.name} — {termRows.length} ders
                          </td>
                        </tr>
                        {/* Course Rows */}
                        {termRows.map((row, idx) => (
                          <tr key={row.course.id} style={{ background: idx % 2 === 0 ? 'white' : '#f8fafc' }}>
                            <td style={{ paddingLeft: '24px', fontWeight: '500' }}>
                              {row.course.code && (
                                <span style={{
                                  background: 'var(--p)',
                                  color: 'white',
                                  padding: '1px 5px',
                                  borderRadius: '3px',
                                  fontSize: '0.75rem',
                                  marginRight: '6px'
                                }}>
                                  {row.course.code}
                                </span>
                              )}
                              {row.course.name}
                            </td>
                            <td style={{ textAlign: 'center', color: 'var(--text-muted)' }}>{row.akts}</td>
                            {reportResult.finalPcLabels.map(pc => {
                              const v = row.pcScores[pc];
                              if (v === null) return <td key={pc} style={{ textAlign: 'center', color: '#cbd5e1' }}>—</td>;
                              return (
                                <td key={pc} style={{ textAlign: 'center', fontWeight: 'bold', color: getSuccessColor(v) }}>
                                  {v.toFixed(1)}
                                </td>
                              );
                            })}
                          </tr>
                        ))}

                        {/* Term Average Row */}
                        {reportResult.selectedTerms.length > 1 && (
                          <tr style={{ background: '#f8fafc', borderTop: '1px solid #cbd5e1', fontStyle: 'italic' }}>
                            <td style={{ paddingLeft: '16px', color: 'var(--text-muted)' }}>↳ {term.name} Dönemi Ortalaması</td>
                            <td style={{ textAlign: 'center' }}>
                              {termRows.reduce((sum, r) => sum + r.akts, 0)}
                            </td>
                            {reportResult.finalPcLabels.map(pc => {
                              const ts = reportResult.termSummaryMap[term.id][pc];
                              const v = ts.wAkts > 0 ? ts.wSum / ts.wAkts : 0;
                              return (
                                <td key={pc} style={{ textAlign: 'center', fontWeight: 'bold', color: getSuccessColor(v) }}>
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
                  <tr style={{ background: '#e2e8f0', borderTop: '2px solid #94a3b8', fontWeight: 'bold' }}>
                    <td>GENEL ORTALAMA (AKTS Ağırlıklı)</td>
                    <td style={{ textAlign: 'center' }}>
                      {reportResult.coursePcRows.reduce((sum, r) => sum + r.akts, 0)}
                    </td>
                    {reportResult.finalPcLabels.map((pc, idx) => {
                      const v = reportResult.finalPcData[idx];
                      return (
                        <td key={pc} style={{
                          textAlign: 'center',
                          color: 'white',
                          backgroundColor: getSuccessColor(v),
                          fontSize: '0.9rem'
                        }}>
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
