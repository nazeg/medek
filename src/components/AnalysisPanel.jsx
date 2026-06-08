import React, { useState, useEffect } from 'react';
import { pb } from '../pb';
import { Bar, Radar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend
} from 'chart.js';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import { FileText, Download, BarChart2, AlertCircle, RefreshCw } from 'lucide-react';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend,
  ChartDataLabels
);

export default function AnalysisPanel({ currentProgId, currentDersId, addLog }) {
  const [activeMod, setActiveMod] = useState('Vize');
  const [loading, setLoading] = useState(false);
  const [analysisResult, setAnalysisResult] = useState(null);

  // Db states
  const [pcs, setPcs] = useState([]);
  const [dcs, setDcs] = useState([]);
  const [matrix, setMatrix] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [students, setStudents] = useState([]);
  const [grades, setGrades] = useState([]);
  const [course, setCourse] = useState(null);
  const [term, setTerm] = useState(null);
  const [program, setProgram] = useState(null);

  const examModes = {
    'Vize': ['Vize'],
    'Final': ['Final'],
    'Ödev': ['Ödev'],
    'Uygulama': ['Uygulama'],
    'Bütünleme': ['Bütünleme'],
    'VizeFinal': ['Vize', 'Final'],
    'ÖdevFinal': ['Ödev', 'Final'],
    'UygulamaFinal': ['Uygulama', 'Final'],
    'VizeÖdevFinal': ['Vize', 'Ödev', 'Final'],
    'VizeUygulamaFinal': ['Vize', 'Uygulama', 'Final'],
    'VizeÖdevUygulamaFinal': ['Vize', 'Ödev', 'Uygulama', 'Final'],
    'VizeBüt': ['Vize', 'Bütünleme'],
    'ÖdevBüt': ['Ödev', 'Bütünleme'],
    'UygulamaBüt': ['Uygulama', 'Bütünleme'],
    'VizeÖdevBüt': ['Vize', 'Ödev', 'Bütünleme'],
    'VizeUygulamaBüt': ['Vize', 'Uygulama', 'Bütünleme'],
    'VizeÖdevUygulamaBüt': ['Vize', 'Ödev', 'Uygulama', 'Bütünleme']
  };

  const getRequiredExamsByMod = (mod) => examModes[mod] || [mod];

  const fetchDbData = async () => {
    if (!currentDersId) return;
    setLoading(true);
    try {
      const courseRec = await pb.collection('courses').getOne(currentDersId, { expand: 'program_id,term_id' });
      setCourse(courseRec);
      setTerm(courseRec.expand?.term_id || null);
      setProgram(courseRec.expand?.program_id || null);

      const pcRecs = await pb.collection('program_outcomes').getFullList({ filter: `program_id = "${currentProgId}"` });
      setPcs(pcRecs);

      const dcRecs = await pb.collection('course_outcomes').getFullList({ filter: `course_id = "${currentDersId}"` });
      setDcs(dcRecs);

      const matrixRecs = await pb.collection('matrix').getFullList({ filter: `course_id = "${currentDersId}"` });
      setMatrix(matrixRecs);

      const qRecs = await pb.collection('questions').getFullList({ filter: `course_id = "${currentDersId}"` });
      setQuestions(qRecs);

      const sRecs = await pb.collection('students').getFullList({ filter: `course_id = "${currentDersId}"` });
      setStudents(sRecs);

      if (sRecs.length > 0) {
        const filterStr = sRecs.map(s => `student_id = "${s.id}"`).join(' || ');
        const gRecs = await pb.collection('student_grades').getFullList({ filter: `(${filterStr})` });
        setGrades(gRecs);
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
    fetchDbData();
  }, [currentDersId, currentProgId]);

  useEffect(() => {
    if (questions.length > 0 && students.length > 0) {
      runCalculation(activeMod);
    } else {
      setAnalysisResult(null);
    }
  }, [activeMod, questions, students, grades, dcs, pcs, matrix]);

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

  const runCalculation = (mod) => {
    const reqExams = getRequiredExamsByMod(mod);
    const missingExams = reqExams.filter(exam => !questions.some(q => q.exam_type === exam));

    if (missingExams.length > 0) {
      setAnalysisResult({
        error: `Kombinasyon hesaplanamadı! "${mod}" hesaplaması için şu sınavlara ait soru tanımları eksik: ${missingExams.join(', ')}. Lütfen önce bu sınavlara ait soruları / notları tanımlayın.`
      });
      return;
    }

    const pctMap = {
      'Vize': course?.pct_vize || 0,
      'Ödev': course?.pct_odev || 0,
      'Uygulama': course?.pct_uygulama || 0,
      'Final': course?.pct_final || 0,
      'Bütünleme': course?.pct_but || 0
    };

    const isCombo = reqExams.length > 1;

    // Her DÇ için sınav bazlı toplam alınan/max puanları hesapla
    let dcExamSonuc = {}; // dcExamSonuc[dcCode][examType] = { alınan, max }
    dcs.forEach(d => {
      dcExamSonuc[d.code] = {};
      reqExams.forEach(et => { dcExamSonuc[d.code][et] = { alinan: 0, max: 0 }; });
    });

    students.forEach(o => {
      questions.forEach(s => {
        if (!reqExams.includes(s.exam_type) || !s.dc_code) return;
        const s_codes = s.dc_code.split(', ').filter(c => c && dcExamSonuc[c]);
        if (s_codes.length === 0) return;
        
        const grade = grades.find(g => g.student_id === o.id && g.question_id === s.id);
        const p = calculateScore(s, grade);
        s_codes.forEach(code => {
          dcExamSonuc[code][s.exam_type].alinan += Number(p);
          dcExamSonuc[code][s.exam_type].max += Number(s.max_score);
        });
      });
    });

    // DÇ başarı yüzdelerini hesapla
    const dcAssessed = {};
    const dcSuccessMap = {};

    dcs.forEach(d => {
      if (!isCombo) {
        const et = reqExams[0];
        const { alinan, max } = dcExamSonuc[d.code][et] || { alinan: 0, max: 0 };
        dcAssessed[d.code] = max > 0;
        dcSuccessMap[d.code] = max > 0 ? (alinan / max) * 100 : 0;
      } else {
        let weightedSum = 0, usedWeightSum = 0;
        reqExams.forEach(et => {
          const { alinan, max } = dcExamSonuc[d.code][et] || { alinan: 0, max: 0 };
          if (max > 0) {
            const examBasari = (alinan / max) * 100;
            weightedSum += examBasari * (pctMap[et] || 0);
            usedWeightSum += (pctMap[et] || 0);
          }
        });
        dcAssessed[d.code] = usedWeightSum > 0;
        dcSuccessMap[d.code] = usedWeightSum > 0 ? weightedSum / usedWeightSum : 0;
      }
    });

    // PÇ sağlanma oranları
    const pcSuccessMap = {};
    pcs.forEach(pc => {
      let toplamKatki = 0, toplamIliski = 0;
      dcs.forEach(dc => {
        if (!dcAssessed[dc.code]) return;
        const iliski = matrix.find(m => m.dc_code === dc.code && m.pc_code === pc.code)?.value || 0;
        if (iliski > 0) {
          toplamKatki += dcSuccessMap[dc.code] * iliski;
          toplamIliski += iliski;
        }
      });
      pcSuccessMap[pc.code] = toplamIliski > 0 ? (toplamKatki / toplamIliski) : 0;
    });

    // Öğrenci bazlı kazanımlar
    const studentDCOutcomes = {};
    const studentPCOutcomes = {};

    students.forEach(o => {
      studentDCOutcomes[o.id] = {};
      dcs.forEach(dc => {
        if (!isCombo) {
          let alinan = 0, max = 0;
          questions.forEach(s => {
            const s_codes = (s.dc_code || '').split(', ');
            if (s.exam_type === reqExams[0] && s_codes.includes(dc.code)) {
              const g = grades.find(gr => gr.student_id === o.id && gr.question_id === s.id);
              alinan += calculateScore(s, g);
              max += s.max_score;
            }
          });
          studentDCOutcomes[o.id][dc.code] = max > 0 ? (alinan / max) * 100 : 0;
        } else {
          let weightedSum = 0, usedWeightSum = 0;
          reqExams.forEach(et => {
            let alinan = 0, max = 0;
            questions.forEach(s => {
              const s_codes = (s.dc_code || '').split(', ');
              if (s.exam_type === et && s_codes.includes(dc.code)) {
                const g = grades.find(gr => gr.student_id === o.id && gr.question_id === s.id);
                alinan += calculateScore(s, g);
                max += s.max_score;
              }
            });
            if (max > 0) {
              const examBasari = (alinan / max) * 100;
              weightedSum += examBasari * (pctMap[et] || 0);
              usedWeightSum += (pctMap[et] || 0);
            }
          });
          studentDCOutcomes[o.id][dc.code] = usedWeightSum > 0 ? weightedSum / usedWeightSum : 0;
        }
      });

      // Öğrencinin PÇ'lerini hesapla
      studentPCOutcomes[o.id] = {};
      pcs.forEach(pc => {
        let toplamKatki = 0, toplamIliski = 0;
        dcs.forEach(dc => {
          if (!dcAssessed[dc.code]) return;
          const iliski = matrix.find(m => m.dc_code === dc.code && m.pc_code === pc.code)?.value || 0;
          if (iliski > 0) {
            toplamKatki += studentDCOutcomes[o.id][dc.code] * iliski;
            toplamIliski += iliski;
          }
        });
        studentPCOutcomes[o.id][pc.code] = toplamIliski > 0 ? toplamKatki / toplamIliski : 0;
      });
    });

    // Soru bazlı istatistikler ve Bloom
    let soruStats = [];
    const filteredSorular = questions.filter(s => reqExams.includes(s.exam_type));
    const modMaxScore = filteredSorular.reduce((sum, s) => sum + (Number(s.max_score) || 0), 0);

    filteredSorular.forEach(s => {
      let toplamPuan = 0;
      let count = 0;
      students.forEach(o => {
        const g = grades.find(gr => gr.student_id === o.id && gr.question_id === s.id);
        if (g) {
          count++;
          toplamPuan += calculateScore(s, g);
        }
      });
      const yuzde = count > 0 && s.max_score > 0 ? (toplamPuan / (count * s.max_score)) * 100 : 0;
      soruStats.push({ id: s.id, code: s.code, desc: s.description, yuzde, exam_type: s.exam_type, max_score: s.max_score });
    });

    // Extremes
    const sortedSoruStats = [...soruStats].sort((a, b) => a.yuzde - b.yuzde);
    const enZorSorular = sortedSoruStats.slice(0, 3);
    const enKolaySorular = [...sortedSoruStats].reverse().slice(0, 3);

    // Student performance rankings (weighted or raw)
    let studentScores = [];
    if (!isCombo) {
      students.forEach(o => {
        let total = 0;
        filteredSorular.forEach(s => {
          const g = grades.find(gr => gr.student_id === o.id && gr.question_id === s.id);
          total += calculateScore(s, g);
        });
        studentScores.push({
          id: o.id,
          no: o.student_no,
          isim: o.full_name,
          puan: total,
          etiket: total.toFixed(1) + ' puan'
        });
      });
    } else {
      // Combination weighted score
      const examMaxScores = {};
      reqExams.forEach(et => {
        examMaxScores[et] = filteredSorular.filter(s => s.exam_type === et).reduce((sum, s) => sum + (Number(s.max_score) || 0), 0);
      });

      students.forEach(o => {
        let weightedScore = 0;
        reqExams.forEach(et => {
          const examSorular = filteredSorular.filter(s => s.exam_type === et);
          let alinan = 0;
          examSorular.forEach(s => {
            const g = grades.find(gr => gr.student_id === o.id && gr.question_id === s.id);
            alinan += calculateScore(s, g);
          });
          const maxPuan = examMaxScores[et];
          const yuzUz = maxPuan > 0 ? (alinan / maxPuan) * 100 : 0;
          weightedScore += (yuzUz * (pctMap[et] || 0)) / 100;
        });

        studentScores.push({
          id: o.id,
          no: o.student_no,
          isim: o.full_name,
          puan: weightedScore,
          etiket: weightedScore.toFixed(1) + '%'
        });
      });
    }

    studentScores.sort((a, b) => a.puan - b.puan);
    const enDusukOgrenciler = studentScores.slice(0, 3);
    const enYuksekOgrenciler = [...studentScores].reverse().slice(0, 3);
    const midIdx = Math.floor(studentScores.length / 2);
    const startMid = Math.max(0, studentScores.length >= 3 ? midIdx - 1 : 0);
    const medyanOgrenciler = studentScores.slice(startMid, startMid + 3);

    // Bloom difficulty breakdown
    let kolay = [], orta = [], zor = [];
    soruStats.forEach(s => {
      if (s.yuzde >= 80) kolay.push(s);
      else if (s.yuzde >= 20) orta.push(s);
      else zor.push(s);
    });

    const totalSoru = soruStats.length;
    const kolayPct = totalSoru > 0 ? (kolay.length / totalSoru) * 100 : 0;
    const ortaPct = totalSoru > 0 ? (orta.length / totalSoru) * 100 : 0;
    const zorPct = totalSoru > 0 ? (zor.length / totalSoru) * 100 : 0;

    const getBloomSymbol = (pct, target) => {
      const diff = Math.abs(pct - target);
      if (diff <= 5) return '✅';
      if (diff <= 15) return '⚠️';
      return '❌';
    };

    setAnalysisResult({
      error: null,
      isCombo,
      reqExams,
      pctMap,
      dcLabels: dcs.map(d => d.code),
      dcData: dcs.map(d => dcSuccessMap[d.code].toFixed(1)),
      pcLabels: pcs.map(p => p.code),
      pcData: pcs.map(p => pcSuccessMap[p.code].toFixed(1)),
      studentDCOutcomes,
      studentPCOutcomes,
      soruStats,
      enZorSorular,
      enKolaySorular,
      enDusukOgrenciler,
      enYuksekOgrenciler,
      medyanOgrenciler,
      kolay, orta, zor,
      kolayPct, ortaPct, zorPct,
      getBloomSymbol,
      modMaxScore,
      filteredSorular,
      studentScores
    });
  };

  const handleExportPDF = () => {
    if (!analysisResult) return;
    const element = document.getElementById('pdf-export-area');
    if (!element) return;

    const sanitizedProg = (program?.name || '').replace(/[^a-z0-9ğüşöçİI]/gi, '_');
    const sanitizedDers = (course?.name || '').replace(/[^a-z0-9ğüşöçİI]/gi, '_');
    const filename = `${sanitizedProg}_${sanitizedDers}_${activeMod}_Analiz_Raporu.pdf`;

    document.body.classList.add('pdf-mode');
    
    const opt = {
      margin: [0.4, 0.4, 0.4, 0.4],
      filename: filename,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true, letterRendering: true },
      jsPDF: { unit: 'in', format: 'a4', orientation: 'landscape', compress: true },
      pagebreak: { mode: ['css', 'legacy'] }
    };

    addLog("PDF raporu hazırlanıyor, lütfen bekleyin...");
    
    // Inject local scripts via standard html2pdf or run directly
    if (window.html2pdf) {
      window.html2pdf().set(opt).from(element).save().then(() => {
        document.body.classList.remove('pdf-mode');
        addLog("PDF başarıyla indirildi.");
      }).catch(err => {
        document.body.classList.remove('pdf-mode');
        console.error(err);
      });
    } else {
      // Fallback
      alert("PDF motoru yükleniyor. Lütfen tekrar deneyin.");
      const script = document.createElement('script');
      script.src = "https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js";
      document.body.appendChild(script);
      document.body.classList.remove('pdf-mode');
    }
  };

  // Helper colors
  const getSuccessColor = (val) => val >= 70 ? '#10b981' : val >= 50 ? '#f59e0b' : '#ef4444';
  const getSuccessBg = (val) => val >= 70 ? '#d1fae5' : val >= 50 ? '#fef3c7' : '#fee2e2';

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
        <h3 className="card-title" style={{ margin: 0 }}>
          <BarChart2 size={18} /> MEDEK Analiz Raporları
        </h3>
        {analysisResult && !analysisResult.error && (
          <button className="btn btn-primary btn-sm" onClick={handleExportPDF}>
            <Download size={12} /> PDF İndir
          </button>
        )}
      </div>

      {!currentDersId ? (
        <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>
          Lütfen üst menüden bir Ders seçiniz.
        </div>
      ) : loading ? (
        <div style={{ textAlign: 'center', padding: '20px' }}>
          <RefreshCw className="fa-spin" size={18} /> Veriler hesaplanıyor...
        </div>
      ) : (
        <>
          {/* Filters Grid */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginBottom: '20px' }}>
            <div>
              <h5 style={{ color: 'var(--s)', margin: '0 0 8px 0', fontSize: '0.8rem', fontWeight: 'bold', textTransform: 'uppercase' }}>📊 Tekil Sınav Analizleri</h5>
              <div className="analiz-grid">
                {['Vize', 'Final', 'Ödev', 'Uygulama', 'Bütünleme'].map(mod => (
                  <button
                    key={mod}
                    className={`btn btn-sm ${activeMod === mod ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setActiveMod(mod)}
                  >
                    {mod}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <h5 style={{ color: 'var(--success)', margin: '0 0 8px 0', fontSize: '0.8rem', fontWeight: 'bold', textTransform: 'uppercase' }}>🔄 Sınav Kombinasyonları</h5>
              <div className="analiz-grid">
                {[
                  { id: 'VizeFinal', label: 'Vize + Final' },
                  { id: 'ÖdevFinal', label: 'Ödev + Final' },
                  { id: 'UygulamaFinal', label: 'Uygulama + Final' },
                  { id: 'VizeÖdevFinal', label: 'Vize + Ödev + Final' },
                  { id: 'VizeUygulamaFinal', label: 'Vize + Uyg. + Final' },
                  { id: 'VizeÖdevUygulamaFinal', label: 'Hepsi (V+Ö+U+F)' }
                ].map(item => (
                  <button
                    key={item.id}
                    className={`btn btn-sm ${activeMod === item.id ? 'btn-success' : 'btn-secondary'}`}
                    style={{ background: activeMod === item.id ? 'var(--success)' : '' }}
                    onClick={() => setActiveMod(item.id)}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <h5 style={{ color: 'var(--warning)', margin: '0 0 8px 0', fontSize: '0.8rem', fontWeight: 'bold', textTransform: 'uppercase' }}>🕒 Bütünleme Kombinasyonları</h5>
              <div className="analiz-grid">
                {[
                  { id: 'VizeBüt', label: 'Vize + Büt' },
                  { id: 'ÖdevBüt', label: 'Ödev + Büt' },
                  { id: 'UygulamaBüt', label: 'Uygulama + Büt' },
                  { id: 'VizeÖdevBüt', label: 'Vize + Ödev + Büt' },
                  { id: 'VizeUygulamaBüt', label: 'Vize + Uyg. + Büt' },
                  { id: 'VizeÖdevUygulamaBüt', label: 'Tüm (V+Ö+U+B)' }
                ].map(item => (
                  <button
                    key={item.id}
                    className={`btn btn-sm ${activeMod === item.id ? 'btn-warning' : 'btn-secondary'}`}
                    style={{ background: activeMod === item.id ? 'var(--warning)' : '', color: activeMod === item.id ? 'white' : '' }}
                    onClick={() => setActiveMod(item.id)}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Results Area */}
          {analysisResult && (
            analysisResult.error ? (
              <div style={{
                background: 'rgba(239, 68, 68, 0.1)',
                color: '#ef4444',
                padding: '16px',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '12px',
                border: '1px solid rgba(239, 68, 68, 0.2)',
                fontSize: '0.85rem'
              }}>
                <AlertCircle size={20} style={{ flexShrink: 0 }} />
                <div>{analysisResult.error}</div>
              </div>
            ) : (
              <div id="pdf-export-area" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                
                {/* PDF Header (Only visible in PDF mode) */}
                <div id="pdf-header" style={{ borderBottom: '2px solid var(--border)', paddingBottom: '12px', display: 'none' }}>
                  <h2 style={{ margin: 0, fontFamily: 'Outfit, sans-serif', fontSize: '1.4rem' }}>{program?.name}</h2>
                  <h3 style={{ margin: '4px 0 0 0', color: 'var(--text-muted)', fontSize: '1.1rem' }}>
                    {course?.code} - {course?.name} ({term?.name})
                  </h3>
                  <h4 style={{ margin: '4px 0 0 0', color: 'var(--s)', fontSize: '0.9rem' }}>Değerlendirme Sınav Modu: {activeMod}</h4>
                </div>

                {/* Graphs Row */}
                <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
                  <div style={{ flex: '1.5', minWidth: '350px' }} className="card">
                    <h4 className="card-title">📊 Ders Öğrenme Çıktıları (DÇ) Başarı Oranları</h4>
                    <div style={{ height: '300px', position: 'relative' }}>
                      <Bar
                        data={{
                          labels: analysisResult.dcLabels,
                          datasets: [{
                            label: '% Başarı',
                            data: analysisResult.dcData,
                            backgroundColor: '#2563eb',
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
                              formatter: (val) => val + '%',
                              font: { weight: 'bold', size: 10 },
                              color: 'var(--p)'
                            }
                          },
                          scales: { y: { min: 0, max: 100 } }
                        }}
                      />
                    </div>
                  </div>

                  <div style={{ flex: '1', minWidth: '280px' }} className="card">
                    <h4 className="card-title">🕸️ Program Çıktıları (PÇ) Sağlanma Oranları</h4>
                    <div style={{ height: '300px', position: 'relative' }}>
                      <Radar
                        data={{
                          labels: analysisResult.pcLabels,
                          datasets: [{
                            label: '% Sağlanma',
                            data: analysisResult.pcData,
                            borderColor: '#10b981',
                            backgroundColor: 'rgba(16, 185, 129, 0.2)',
                            pointBackgroundColor: '#10b981',
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

                {/* Outcomes Grid Table */}
                <div className="card">
                  <h4 className="card-title">🎓 Öğrenci Kazanım Özeti ({activeMod})</h4>
                  <div className="table-container">
                    <table>
                      <thead>
                        <tr>
                          <th>Öğrenci</th>
                          {dcs.map(d => <th key={d.id} style={{ textAlign: 'center' }}>{d.code} (%)</th>)}
                          {pcs.map(p => <th key={p.id} style={{ textAlign: 'center', background: '#f8fafc' }}>{p.code} (%)</th>)}
                        </tr>
                      </thead>
                      <tbody>
                        {students.map(o => (
                          <tr key={o.id}>
                            <td>
                              <div style={{ fontWeight: 'bold' }}>{o.student_no}</div>
                              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{o.full_name}</div>
                            </td>
                            {dcs.map(d => {
                              const val = analysisResult.studentDCOutcomes[o.id]?.[d.code] || 0;
                              return (
                                <td key={d.id} style={{
                                  textAlign: 'center',
                                  fontWeight: 'bold',
                                  color: 'white',
                                  backgroundColor: getSuccessColor(val)
                                }}>
                                  {val.toFixed(1)}%
                                </td>
                              );
                            })}
                            {pcs.map(p => {
                              const val = analysisResult.studentPCOutcomes[o.id]?.[p.code] || 0;
                              return (
                                <td key={p.id} style={{
                                  textAlign: 'center',
                                  fontWeight: 'bold',
                                  backgroundColor: '#f1f5f9'
                                }}>
                                  {val.toFixed(1)}%
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Performance Summary (Combo vs Questions details) */}
                <div className="card">
                  <h4 className="card-title">🧑‍🎓 Öğrenci Bazlı Başarı Özeti ({activeMod})</h4>
                  
                  {analysisResult.isCombo ? (
                    /* Combo view: weights summary */
                    <div>
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '12px' }}>
                        {analysisResult.reqExams.map(et => (
                          <span key={et} style={{
                            background: '#eff6ff',
                            color: 'var(--s)',
                            padding: '4px 12px',
                            borderRadius: '20px',
                            fontSize: '0.75rem',
                            fontWeight: 'bold'
                          }}>
                            {et}: %{analysisResult.pctMap[et]} etki
                          </span>
                        ))}
                      </div>

                      <div className="table-container">
                        <table>
                          <thead>
                            <tr>
                              <th>No</th>
                              <th>Ad Soyad</th>
                              {analysisResult.reqExams.map(et => (
                                <React.Fragment key={et}>
                                  <th style={{ textAlign: 'center' }}>{et} (100)</th>
                                  <th style={{ textAlign: 'center', background: '#f8fafc' }}>{et} (%{analysisResult.pctMap[et]})</th>
                                </React.Fragment>
                              ))}
                              <th style={{ textAlign: 'center', background: '#e0f2fe', fontWeight: 'bold' }}>Ağırlıklı Not</th>
                            </tr>
                          </thead>
                          <tbody>
                            {students.map(o => {
                              let weightedTotal = 0;
                              return (
                                <tr key={o.id}>
                                  <td><b>{o.student_no}</b></td>
                                  <td>{o.full_name}</td>
                                  {analysisResult.reqExams.map(et => {
                                    const examQs = analysisResult.filteredSorular.filter(q => q.exam_type === et);
                                    const examMax = examQs.reduce((sum, q) => sum + (parseFloat(q.max_score) || 0), 0);
                                    
                                    let obtained = 0;
                                    examQs.forEach(q => {
                                      const g = grades.find(gr => gr.student_id === o.id && gr.question_id === q.id);
                                      obtained += calculateScore(q, g);
                                    });

                                    const percentVal = examMax > 0 ? (obtained / examMax) * 100 : 0;
                                    const weightContrib = (percentVal * (analysisResult.pctMap[et] || 0)) / 100;
                                    weightedTotal += weightContrib;

                                    return (
                                      <React.Fragment key={et}>
                                        <td style={{ textAlign: 'center', color: getSuccessColor(percentVal), fontWeight: 'bold' }}>
                                          {percentVal.toFixed(1)}
                                        </td>
                                        <td style={{ textAlign: 'center', color: 'var(--text-muted)', background: '#f8fafc' }}>
                                          {weightContrib.toFixed(1)}
                                        </td>
                                      </React.Fragment>
                                    );
                                  })}
                                  <td style={{
                                    textAlign: 'center',
                                    fontWeight: 'bold',
                                    color: 'white',
                                    backgroundColor: getSuccessColor(weightedTotal)
                                  }}>
                                    {weightedTotal.toFixed(1)}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ) : (
                    /* Single exam view: question scores matrix */
                    <div className="table-container">
                      <table>
                        <thead>
                          <tr>
                            <th>No</th>
                            <th>Ad Soyad</th>
                            {analysisResult.filteredSorular.map(q => (
                              <th key={q.id} style={{ textAlign: 'center' }}>
                                {q.code}<br />
                                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 'normal' }}>
                                  ({q.max_score}p)
                                </span>
                              </th>
                            ))}
                            <th style={{ textAlign: 'center', background: '#f8fafc' }}>Toplam</th>
                            <th style={{ textAlign: 'center', background: '#e0f2fe' }}>Başarı (%)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {students.map(o => {
                            let totalObtained = 0;
                            return (
                              <tr key={o.id}>
                                <td><b>{o.student_no}</b></td>
                                <td>{o.full_name}</td>
                                {analysisResult.filteredSorular.map(q => {
                                  const g = grades.find(gr => gr.student_id === o.id && gr.question_id === q.id);
                                  const score = calculateScore(q, g);
                                  totalObtained += score;
                                  
                                  const isFull = score === q.max_score;
                                  const cellBg = score > 0 ? (isFull ? '#d1fae5' : '#fef3c7') : '#fee2e2';
                                  const cellColor = score > 0 ? (isFull ? '#065f46' : '#92400e') : '#991b1b';

                                  let answerLabel = "-";
                                  if (g) {
                                    if (q.question_type === 'Çoktan Seçmeli') {
                                      answerLabel = ({ 1: 'A', 2: 'B', 3: 'C', 4: 'D', 5: 'E' })[g.score] || '-';
                                    } else if (q.question_type === 'Doğru Yanlış') {
                                      answerLabel = ({ 11: 'D', 12: 'Y' })[g.score] || '-';
                                    } else {
                                      answerLabel = `${score}p`;
                                    }
                                  }

                                  return (
                                    <td key={q.id} style={{
                                      textAlign: 'center',
                                      fontWeight: 'bold',
                                      backgroundColor: cellBg,
                                      color: cellColor
                                    }}>
                                      {answerLabel}
                                    </td>
                                  );
                                })}
                                <td style={{ textAlign: 'center', fontWeight: 'bold', background: '#f8fafc' }}>
                                  {totalObtained.toFixed(1)} / {analysisResult.modMaxScore}
                                </td>
                                <td style={{
                                  textAlign: 'center',
                                  fontWeight: 'bold',
                                  color: 'white',
                                  backgroundColor: getSuccessColor(analysisResult.modMaxScore > 0 ? (totalObtained / analysisResult.modMaxScore) * 100 : 0)
                                }}>
                                  {(analysisResult.modMaxScore > 0 ? (totalObtained / analysisResult.modMaxScore) * 100 : 0).toFixed(1)}%
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* Extremes (Easiest / Hardest Questions & Students) */}
                <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
                  
                  {/* Students stats */}
                  <div style={{ flex: 1, minWidth: '280px' }} className="card">
                    <h4 className="card-title">📉/🏆 Öğrenci Başarı Sıralaması</h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      
                      <div style={{ borderLeft: '4px solid #ef4444', paddingLeft: '10px' }}>
                        <h5 style={{ margin: '0 0 4px 0', fontSize: '0.8rem', color: '#ef4444' }}>En Düşük Skorlar</h5>
                        <table style={{ fontSize: '0.75rem' }}>
                          <tbody>
                            {analysisResult.enDusukOgrenciler.map((o, idx) => (
                              <tr key={idx}>
                                <td><b>{o.no}</b></td>
                                <td>{o.isim}</td>
                                <td style={{ color: '#ef4444', fontWeight: 'bold' }}>{o.etiket}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      <div style={{ borderLeft: '4px solid #f59e0b', paddingLeft: '10px' }}>
                        <h5 style={{ margin: '0 0 4px 0', fontSize: '0.8rem', color: '#f59e0b' }}>Orta Seviye (Medyan)</h5>
                        <table style={{ fontSize: '0.75rem' }}>
                          <tbody>
                            {analysisResult.medyanOgrenciler.map((o, idx) => (
                              <tr key={idx}>
                                <td><b>{o.no}</b></td>
                                <td>{o.isim}</td>
                                <td style={{ color: '#f59e0b', fontWeight: 'bold' }}>{o.etiket}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      <div style={{ borderLeft: '4px solid #10b981', paddingLeft: '10px' }}>
                        <h5 style={{ margin: '0 0 4px 0', fontSize: '0.8rem', color: '#10b981' }}>En Yüksek Skorlar</h5>
                        <table style={{ fontSize: '0.75rem' }}>
                          <tbody>
                            {analysisResult.enYuksekOgrenciler.map((o, idx) => (
                              <tr key={idx}>
                                <td><b>{o.no}</b></td>
                                <td>{o.isim}</td>
                                <td style={{ color: '#10b981', fontWeight: 'bold' }}>{o.etiket}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                    </div>
                  </div>

                  {/* Questions stats (only for single exam mode) */}
                  {!analysisResult.isCombo && (
                    <div style={{ flex: 1, minWidth: '280px' }} className="card">
                      <h4 className="card-title">🎯 Soru Başarı Sıralaması</h4>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        
                        <div style={{ borderLeft: '4px solid #ef4444', paddingLeft: '10px' }}>
                          <h5 style={{ margin: '0 0 4px 0', fontSize: '0.8rem', color: '#ef4444' }}>En Çok Hatalı / Boş Bırakılan Sorular</h5>
                          <table style={{ fontSize: '0.75rem' }}>
                            <tbody>
                              {analysisResult.enZorSorular.map((s, idx) => (
                                <tr key={idx}>
                                  <td><b>{s.code}</b></td>
                                  <td style={{ color: '#64748b' }}>{s.desc ? s.desc.substring(0, 40) + '...' : '-'}</td>
                                  <td style={{ color: '#ef4444', fontWeight: 'bold' }}>{s.yuzde.toFixed(1)}%</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>

                        <div style={{ borderLeft: '4px solid #10b981', paddingLeft: '10px' }}>
                          <h5 style={{ margin: '0 0 4px 0', fontSize: '0.8rem', color: '#10b981' }}>En Çok Doğru Yanıtlanan Sorular</h5>
                          <table style={{ fontSize: '0.75rem' }}>
                            <tbody>
                              {analysisResult.enKolaySorular.map((s, idx) => (
                                <tr key={idx}>
                                  <td><b>{s.code}</b></td>
                                  <td style={{ color: '#64748b' }}>{s.desc ? s.desc.substring(0, 40) + '...' : '-'}</td>
                                  <td style={{ color: '#10b981', fontWeight: 'bold' }}>{s.yuzde.toFixed(1)}%</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>

                      </div>
                    </div>
                  )}
                </div>

                {/* Bloom Difficulty Analysis (Only for single exam mode) */}
                {!analysisResult.isCombo && (
                  <div className="card">
                    <h4 className="card-title">🎯 Soru Zorluk Analizi — Bloom Taksonomisi</h4>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '12px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      <span>Zorluk Dağılım Hedefleri:</span>
                      <span style={{ background: '#d1fae5', color: '#065f46', padding: '2px 10px', borderRadius: '20px', fontWeight: 'bold' }}>Kolay %20</span>
                      <span style={{ background: '#fef3c7', color: '#92400e', padding: '2px 10px', borderRadius: '20px', fontWeight: 'bold' }}>Orta %60</span>
                      <span style={{ background: '#fee2e2', color: '#991b1b', padding: '2px 10px', borderRadius: '20px', fontWeight: 'bold' }}>Zor %20</span>
                    </div>

                    <div className="table-container">
                      <table>
                        <thead>
                          <tr>
                            <th style={{ background: '#fee2e2', color: '#991b1b', textAlign: 'center' }}>Zor (0% - 20%) — Hedef %20</th>
                            <th style={{ background: '#fef3c7', color: '#92400e', textAlign: 'center' }}>Orta (20% - 80%) — Hedef %60</th>
                            <th style={{ background: '#d1fae5', color: '#065f46', textAlign: 'center' }}>Kolay (80% - 100%) — Hedef %20</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr>
                            <td style={{ textAlign: 'center', verticalAlign: 'top', padding: '12px' }}>
                              {analysisResult.zor.length > 0 ? (
                                analysisResult.zor.map(s => (
                                  <span key={s.id} style={{
                                    background: '#ef4444',
                                    color: 'white',
                                    padding: '4px 8px',
                                    borderRadius: '4px',
                                    margin: '2px',
                                    display: 'inline-block',
                                    fontSize: '0.75rem',
                                    fontWeight: 'bold'
                                  }} title={`Başarı: ${s.yuzde.toFixed(1)}%`}>
                                    {s.code}
                                  </span>
                                ))
                              ) : '-'}
                            </td>
                            <td style={{ textAlign: 'center', verticalAlign: 'top', padding: '12px' }}>
                              {analysisResult.orta.length > 0 ? (
                                analysisResult.orta.map(s => (
                                  <span key={s.id} style={{
                                    background: '#f59e0b',
                                    color: 'white',
                                    padding: '4px 8px',
                                    borderRadius: '4px',
                                    margin: '2px',
                                    display: 'inline-block',
                                    fontSize: '0.75rem',
                                    fontWeight: 'bold'
                                  }} title={`Başarı: ${s.yuzde.toFixed(1)}%`}>
                                    {s.code}
                                  </span>
                                ))
                              ) : '-'}
                            </td>
                            <td style={{ textAlign: 'center', verticalAlign: 'top', padding: '12px' }}>
                              {analysisResult.kolay.length > 0 ? (
                                analysisResult.kolay.map(s => (
                                  <span key={s.id} style={{
                                    background: '#10b981',
                                    color: 'white',
                                    padding: '4px 8px',
                                    borderRadius: '4px',
                                    margin: '2px',
                                    display: 'inline-block',
                                    fontSize: '0.75rem',
                                    fontWeight: 'bold'
                                  }} title={`Başarı: ${s.yuzde.toFixed(1)}%`}>
                                    {s.code}
                                  </span>
                                ))
                              ) : '-'}
                            </td>
                          </tr>
                          <tr style={{ background: '#f8fafc', fontWeight: 'bold' }}>
                            <td style={{ textAlign: 'center', color: '#991b1b', fontSize: '0.9rem' }}>
                              {analysisResult.getBloomSymbol(analysisResult.zorPct, 20)} {analysisResult.zorPct.toFixed(0)}%
                              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 'normal', marginLeft: '4px' }}>
                                ({analysisResult.zor.length} / {totalSoru})
                              </span>
                            </td>
                            <td style={{ textAlign: 'center', color: '#92400e', fontSize: '0.9rem' }}>
                              {analysisResult.getBloomSymbol(analysisResult.ortaPct, 60)} {analysisResult.ortaPct.toFixed(0)}%
                              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 'normal', marginLeft: '4px' }}>
                                ({analysisResult.orta.length} / {totalSoru})
                              </span>
                            </td>
                            <td style={{ textAlign: 'center', color: '#065f46', fontSize: '0.9rem' }}>
                              {analysisResult.getBloomSymbol(analysisResult.kolayPct, 20)} {analysisResult.kolayPct.toFixed(0)}%
                              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 'normal', marginLeft: '4px' }}>
                                ({analysisResult.kolay.length} / {totalSoru})
                              </span>
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

              </div>
            )
          )}
        </>
      )}
    </div>
  );
}
