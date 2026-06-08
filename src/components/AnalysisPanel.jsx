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
import { Download, BarChart2, AlertCircle, RefreshCw } from 'lucide-react';

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
    
    if (window.html2pdf) {
      window.html2pdf().set(opt).from(element).save().then(() => {
        document.body.classList.remove('pdf-mode');
        addLog("PDF başarıyla indirildi.");
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

  // Helper colors
  const getSuccessColor = (val) => val >= 70 ? '#10b981' : val >= 50 ? '#f59e0b' : '#ef4444';
  const getSuccessBg = (val) => val >= 70 ? '#d1fae5' : val >= 50 ? '#fef3c7' : '#fee2e2';

  return (
    <div className="bg-white p-6 rounded-2xl border border-border shadow-sm hover:shadow-md transition-all duration-200">
      <div className="flex justify-between items-center mb-5">
        <h3 className="font-display m-0 text-base font-bold text-p flex items-center gap-2 tracking-tight">
          <BarChart2 size={18} /> MEDEK Analiz Raporları
        </h3>
        {analysisResult && !analysisResult.error && (
          <button className="px-3.5 py-2 bg-s hover:bg-p-hover text-white rounded-lg text-xs font-semibold cursor-pointer transition-all flex items-center gap-1.5 shadow-md shadow-s/10" onClick={handleExportPDF}>
            <Download size={12} /> PDF Rapor İndir
          </button>
        )}
      </div>

      {!currentDersId ? (
        <div className="text-center p-8 text-text-muted border border-dashed border-border rounded-xl text-sm font-medium">
          Lütfen üst menüden bir Ders seçiniz.
        </div>
      ) : loading ? (
        <div className="text-center p-8 text-text-muted text-sm font-medium flex items-center justify-center gap-2">
          <RefreshCw className="animate-spin" size={18} /> Veriler hesaplanıyor...
        </div>
      ) : (
        <>
          {/* Filters Grid */}
          <div className="flex flex-col gap-4 mb-6">
            <div>
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2.5 block">📊 Tekil Sınav Analizleri</span>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2.5">
                {['Vize', 'Final', 'Ödev', 'Uygulama', 'Bütünleme'].map(mod => (
                  <button
                    key={mod}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all ${activeMod === mod ? 'bg-s text-white shadow-md shadow-s/10' : 'bg-white hover:bg-slate-50 border border-slate-200 text-slate-700'}`}
                    onClick={() => setActiveMod(mod)}
                  >
                    {mod}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <span className="text-xs font-bold text-success uppercase tracking-wider mb-2.5 block">🔄 Sınav Kombinasyonları</span>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2.5">
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
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all ${activeMod === item.id ? 'bg-success text-white shadow-md shadow-success/10' : 'bg-white hover:bg-slate-50 border border-slate-200 text-slate-700'}`}
                    onClick={() => setActiveMod(item.id)}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <span className="text-xs font-bold text-warning uppercase tracking-wider mb-2.5 block">🕒 Bütünleme Kombinasyonları</span>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2.5">
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
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all ${activeMod === item.id ? 'bg-warning text-white shadow-md shadow-warning/10' : 'bg-white hover:bg-slate-50 border border-slate-200 text-slate-700'}`}
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
              <div className="bg-danger/10 text-danger p-4 rounded-xl text-sm mb-5 flex items-start gap-3 border border-danger/20 font-medium">
                <AlertCircle size={20} className="shrink-0" />
                <div>{analysisResult.error}</div>
              </div>
            ) : (
              <div id="pdf-export-area" className="flex flex-col gap-6">
                
                {/* PDF Header (Only visible in PDF mode) */}
                <div id="pdf-header" className="border-b-2 border-border pb-3 mb-4 hidden print:block">
                  <h2 className="margin-0 font-display text-xl font-extrabold text-slate-900 tracking-tight">{program?.name}</h2>
                  <h3 className="margin-0 mt-1 text-sm font-bold text-text-muted">
                    {course?.code} - {course?.name} ({term?.name})
                  </h3>
                  <h4 className="margin-0 mt-1 text-xs text-s font-semibold">Değerlendirme Sınav Modu: {activeMod}</h4>
                </div>

                {/* Graphs Row */}
                <div className="flex gap-5 flex-col lg:flex-row">
                  <div className="flex-[1.5] min-w-[320px] bg-white p-6 rounded-2xl border border-border shadow-sm">
                    <h4 className="font-display m-0 mb-4 text-sm font-bold text-p tracking-tight">📊 Ders Öğrenme Çıktıları (DÇ) Başarı Oranları</h4>
                    <div className="h-[280px] relative">
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
                    <h4 className="font-display m-0 mb-4 text-sm font-bold text-p tracking-tight">🕸️ Program Çıktıları (PÇ) Sağlanma Oranları</h4>
                    <div className="h-[280px] relative">
                      <Radar
                        data={{
                          labels: analysisResult.pcLabels,
                          datasets: [{
                            label: '% Sağlanma',
                            data: analysisResult.pcData,
                            borderColor: '#10b981',
                            backgroundColor: 'rgba(16, 185, 129, 0.15)',
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
                <div className="bg-white p-6 rounded-2xl border border-border shadow-sm">
                  <h4 className="font-display m-0 mb-3 text-sm font-bold text-p tracking-tight">🎓 Öğrenci Kazanım Özeti ({activeMod})</h4>
                  <div className="overflow-x-auto border border-border rounded-xl bg-white">
                    <table className="w-full border-collapse text-left">
                      <thead>
                        <tr className="border-b border-border bg-slate-50/50">
                          <th className="px-3 py-3 text-xs font-bold text-text-muted uppercase tracking-wider min-w-[150px]">Öğrenci</th>
                          {dcs.map(d => <th key={d.id} className="px-3 py-3 text-xs font-bold text-text-muted uppercase tracking-wider text-center w-[85px]">{d.code} (%)</th>)}
                          {pcs.map(p => <th key={p.id} className="px-3 py-3 text-xs font-bold text-text-muted uppercase tracking-wider text-center w-[85px] bg-slate-100/30">{p.code} (%)</th>)}
                        </tr>
                      </thead>
                      <tbody>
                        {students.map(o => (
                          <tr key={o.id} className="border-b border-border last:border-0 hover:bg-slate-50/20">
                            <td className="px-3 py-2.5">
                              <div className="font-bold text-slate-800 text-xs">{o.student_no}</div>
                              <div className="text-[10px] text-text-muted font-medium mt-0.5">{o.full_name}</div>
                            </td>
                            {dcs.map(d => {
                              const val = analysisResult.studentDCOutcomes[o.id]?.[d.code] || 0;
                              return (
                                <td key={d.id} className="px-3 py-2.5 text-center font-bold text-xs text-white" style={{ backgroundColor: getSuccessColor(val) }}>
                                  {val.toFixed(1)}%
                                </td>
                              );
                            })}
                            {pcs.map(p => {
                              const val = analysisResult.studentPCOutcomes[o.id]?.[p.code] || 0;
                              return (
                                <td key={p.id} className="px-3 py-2.5 text-center font-bold text-xs bg-slate-50 text-slate-700">
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
                <div className="bg-white p-6 rounded-2xl border border-border shadow-sm">
                  <h4 className="font-display m-0 mb-3 text-sm font-bold text-p tracking-tight">🧑‍🎓 Öğrenci Bazlı Başarı Özeti ({activeMod})</h4>
                  
                  {analysisResult.isCombo ? (
                    <div>
                      <div className="flex gap-1.5 flex-wrap mb-3">
                        {analysisResult.reqExams.map(et => (
                          <span key={et} className="bg-blue-50 text-s px-3 py-1 rounded-full text-[10px] font-bold border border-blue-100">
                            {et}: %{analysisResult.pctMap[et]} etki
                          </span>
                        ))}
                      </div>

                      <div className="overflow-x-auto border border-border rounded-xl bg-white">
                        <table className="w-full border-collapse text-left">
                          <thead>
                            <tr className="border-b border-border bg-slate-50/50">
                              <th className="px-3 py-3 text-xs font-bold text-text-muted uppercase tracking-wider w-[120px]">No</th>
                              <th className="px-3 py-3 text-xs font-bold text-text-muted uppercase tracking-wider min-w-[150px]">Ad Soyad</th>
                              {analysisResult.reqExams.map(et => (
                                <React.Fragment key={et}>
                                  <th className="px-3 py-3 text-xs font-bold text-text-muted uppercase tracking-wider text-center w-[95px]">{et} (100)</th>
                                  <th className="px-3 py-3 text-xs font-bold text-text-muted uppercase tracking-wider text-center w-[95px] bg-slate-100/30">{et} (%{analysisResult.pctMap[et]})</th>
                                </React.Fragment>
                              ))}
                              <th className="px-3 py-3 text-xs font-bold text-sky-900 uppercase tracking-wider text-center w-[110px] bg-sky-50">Ağırlıklı Not</th>
                            </tr>
                          </thead>
                          <tbody>
                            {students.map(o => {
                              let weightedTotal = 0;
                              return (
                                <tr key={o.id} className="border-b border-border last:border-0 hover:bg-slate-50/20">
                                  <td className="px-3 py-2.5 font-bold text-xs text-slate-800">{o.student_no}</td>
                                  <td className="px-3 py-2.5 text-xs font-medium text-slate-700">{o.full_name}</td>
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
                                        <td className="px-3 py-2.5 text-center font-bold text-xs" style={{ color: getSuccessColor(percentVal) }}>
                                          {percentVal.toFixed(1)}
                                        </td>
                                        <td className="px-3 py-2.5 text-center text-xs text-text-muted bg-slate-50/50">
                                          {weightContrib.toFixed(1)}
                                        </td>
                                      </React.Fragment>
                                    );
                                  })}
                                  <td className="px-3 py-2.5 text-center font-bold text-xs text-white" style={{ backgroundColor: getSuccessColor(weightedTotal) }}>
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
                    <div className="overflow-x-auto border border-border rounded-xl bg-white">
                      <table className="w-full border-collapse text-left">
                        <thead>
                          <tr className="border-b border-border bg-slate-50/50">
                            <th className="px-3 py-3 text-xs font-bold text-text-muted uppercase tracking-wider w-[120px]">No</th>
                            <th className="px-3 py-3 text-xs font-bold text-text-muted uppercase tracking-wider min-w-[150px]">Ad Soyad</th>
                            {analysisResult.filteredSorular.map(q => (
                              <th key={q.id} className="px-3 py-3 text-xs font-bold text-text-muted uppercase tracking-wider text-center w-[85px]">
                                {q.code}<br />
                                <span className="text-[10px] text-text-muted font-normal">
                                  ({q.max_score}p)
                                </span>
                              </th>
                            ))}
                            <th className="px-3 py-3 text-xs font-bold text-text-muted uppercase tracking-wider text-center w-[95px] bg-slate-100/30">Toplam</th>
                            <th className="px-3 py-3 text-xs font-bold text-sky-900 uppercase tracking-wider text-center w-[95px] bg-sky-50">Başarı (%)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {students.map(o => {
                            let totalObtained = 0;
                            return (
                              <tr key={o.id} className="border-b border-border last:border-0 hover:bg-slate-50/20">
                                <td className="px-3 py-2.5 font-bold text-xs text-slate-800">{o.student_no}</td>
                                <td className="px-3 py-2.5 text-xs font-medium text-slate-700">{o.full_name}</td>
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
                                    <td key={q.id} className="px-3 py-2.5 text-center font-bold text-xs" style={{ backgroundColor: cellBg, color: cellColor }}>
                                      {answerLabel}
                                    </td>
                                  );
                                })}
                                <td className="px-3 py-2.5 text-center font-bold text-xs text-slate-800 bg-slate-50">
                                  {totalObtained.toFixed(1)} / {analysisResult.modMaxScore}
                                </td>
                                <td className="px-3 py-2.5 text-center font-bold text-xs text-white" style={{ backgroundColor: getSuccessColor(analysisResult.modMaxScore > 0 ? (totalObtained / analysisResult.modMaxScore) * 100 : 0) }}>
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
                <div className="flex gap-5 flex-col md:flex-row">
                  
                  {/* Students stats */}
                  <div className="flex-1 min-w-[280px] bg-white p-6 rounded-2xl border border-border shadow-sm">
                    <h4 className="font-display m-0 mb-4 text-sm font-bold text-p tracking-tight">📉/🏆 Öğrenci Başarı Sıralaması</h4>
                    <div className="flex flex-col gap-4">
                      
                      <div className="border-l-4 border-danger pl-3">
                        <span className="text-xs font-bold text-danger uppercase tracking-wider mb-1.5 block">En Düşük Skorlar</span>
                        <table className="w-full text-xs font-medium text-slate-700">
                          <tbody>
                            {analysisResult.enDusukOgrenciler.map((o, idx) => (
                              <tr key={idx} className="border-b border-slate-100 last:border-0">
                                <td className="py-1"><b>{o.no}</b></td>
                                <td className="py-1">{o.isim}</td>
                                <td className="py-1 text-right font-bold text-danger">{o.etiket}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      <div className="border-l-4 border-warning pl-3">
                        <span className="text-xs font-bold text-warning uppercase tracking-wider mb-1.5 block">Orta Seviye (Medyan)</span>
                        <table className="w-full text-xs font-medium text-slate-700">
                          <tbody>
                            {analysisResult.medyanOgrenciler.map((o, idx) => (
                              <tr key={idx} className="border-b border-slate-100 last:border-0">
                                <td className="py-1"><b>{o.no}</b></td>
                                <td className="py-1">{o.isim}</td>
                                <td className="py-1 text-right font-bold text-warning">{o.etiket}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      <div className="border-l-4 border-success pl-3">
                        <span className="text-xs font-bold text-success uppercase tracking-wider mb-1.5 block">En Yüksek Skorlar</span>
                        <table className="w-full text-xs font-medium text-slate-700">
                          <tbody>
                            {analysisResult.enYuksekOgrenciler.map((o, idx) => (
                              <tr key={idx} className="border-b border-slate-100 last:border-0">
                                <td className="py-1"><b>{o.no}</b></td>
                                <td className="py-1">{o.isim}</td>
                                <td className="py-1 text-right font-bold text-success">{o.etiket}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                    </div>
                  </div>

                  {/* Questions stats (only for single exam mode) */}
                  {!analysisResult.isCombo && (
                    <div className="flex-1 min-w-[280px] bg-white p-6 rounded-2xl border border-border shadow-sm">
                      <h4 className="font-display m-0 mb-4 text-sm font-bold text-p tracking-tight">🎯 Soru Başarı Sıralaması</h4>
                      <div className="flex flex-col gap-4">
                        
                        <div className="border-l-4 border-danger pl-3">
                          <span className="text-xs font-bold text-danger uppercase tracking-wider mb-1.5 block">En Çok Hatalı / Boş Sorular</span>
                          <table className="w-full text-xs font-medium text-slate-700">
                            <tbody>
                              {analysisResult.enZorSorular.map((s, idx) => (
                                <tr key={idx} className="border-b border-slate-100 last:border-0">
                                  <td className="py-1"><b>{s.code}</b></td>
                                  <td className="py-1 text-text-muted truncate max-w-[150px]">{s.desc || '-'}</td>
                                  <td className="py-1 text-right font-bold text-danger">{s.yuzde.toFixed(1)}%</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>

                        <div className="border-l-4 border-success pl-3">
                          <span className="text-xs font-bold text-success uppercase tracking-wider mb-1.5 block">En Çok Doğru Yanıtlanan Sorular</span>
                          <table className="w-full text-xs font-medium text-slate-700">
                            <tbody>
                              {analysisResult.enKolaySorular.map((s, idx) => (
                                <tr key={idx} className="border-b border-slate-100 last:border-0">
                                  <td className="py-1"><b>{s.code}</b></td>
                                  <td className="py-1 text-text-muted truncate max-w-[150px]">{s.desc || '-'}</td>
                                  <td className="py-1 text-right font-bold text-success">{s.yuzde.toFixed(1)}%</td>
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
                  <div className="bg-white p-6 rounded-2xl border border-border shadow-sm">
                    <h4 className="font-display m-0 mb-3 text-sm font-bold text-p tracking-tight">🎯 Soru Zorluk Analizi — Bloom Taksonomisi</h4>
                    <div className="flex gap-2 flex-wrap mb-4 text-xs text-text-muted font-medium items-center">
                      <span>Zorluk Dağılım Hedefleri:</span>
                      <span className="bg-green-100 text-green-800 px-2.5 py-0.5 rounded-full font-bold">Kolay %20</span>
                      <span className="bg-amber-100 text-amber-800 px-2.5 py-0.5 rounded-full font-bold">Orta %60</span>
                      <span className="bg-red-100 text-red-800 px-2.5 py-0.5 rounded-full font-bold">Zor %20</span>
                    </div>

                    <div className="overflow-x-auto border border-border rounded-xl bg-white">
                      <table className="w-full border-collapse text-left">
                        <thead>
                          <tr className="border-b border-border bg-slate-50/50">
                            <th className="px-3 py-3 text-xs font-bold text-red-900 uppercase tracking-wider text-center bg-red-50/30 w-1/3">Zor (0% - 20%) — Hedef %20</th>
                            <th className="px-3 py-3 text-xs font-bold text-amber-900 uppercase tracking-wider text-center bg-amber-50/30 w-1/3">Orta (20% - 80%) — Hedef %60</th>
                            <th className="px-3 py-3 text-xs font-bold text-green-900 uppercase tracking-wider text-center bg-green-50/30 w-1/3">Kolay (80% - 100%) — Hedef %20</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr className="border-b border-border last:border-0">
                            <td className="px-3 py-4 text-center align-top min-h-[80px]">
                              {analysisResult.zor.length > 0 ? (
                                analysisResult.zor.map(s => (
                                  <span key={s.id} className="bg-danger text-white px-2 py-0.5 rounded text-[10px] font-bold m-0.5 inline-block cursor-help" title={`Başarı: ${s.yuzde.toFixed(1)}%`}>
                                    {s.code}
                                  </span>
                                ))
                              ) : '-'}
                            </td>
                            <td className="px-3 py-4 text-center align-top min-h-[80px]">
                              {analysisResult.orta.length > 0 ? (
                                analysisResult.orta.map(s => (
                                  <span key={s.id} className="bg-warning text-white px-2 py-0.5 rounded text-[10px] font-bold m-0.5 inline-block cursor-help" title={`Başarı: ${s.yuzde.toFixed(1)}%`}>
                                    {s.code}
                                  </span>
                                ))
                              ) : '-'}
                            </td>
                            <td className="px-3 py-4 text-center align-top min-h-[80px]">
                              {analysisResult.kolay.length > 0 ? (
                                analysisResult.kolay.map(s => (
                                  <span key={s.id} className="bg-success text-white px-2 py-0.5 rounded text-[10px] font-bold m-0.5 inline-block cursor-help" title={`Başarı: ${s.yuzde.toFixed(1)}%`}>
                                    {s.code}
                                  </span>
                                ))
                              ) : '-'}
                            </td>
                          </tr>
                          <tr className="bg-slate-50/50 font-bold text-sm">
                            <td className="px-3 py-3 text-center text-red-700">
                              {analysisResult.getBloomSymbol(analysisResult.zorPct, 20)} {analysisResult.zorPct.toFixed(0)}%
                              <span className="text-[10px] text-text-muted font-normal ml-1">
                                ({analysisResult.zor.length} / {totalSoru})
                              </span>
                            </td>
                            <td className="px-3 py-3 text-center text-amber-700">
                              {analysisResult.getBloomSymbol(analysisResult.ortaPct, 60)} {analysisResult.ortaPct.toFixed(0)}%
                              <span className="text-[10px] text-text-muted font-normal ml-1">
                                ({analysisResult.orta.length} / {totalSoru})
                              </span>
                            </td>
                            <td className="px-3 py-3 text-center text-green-700">
                              {analysisResult.getBloomSymbol(analysisResult.kolayPct, 20)} {analysisResult.kolayPct.toFixed(0)}%
                              <span className="text-[10px] text-text-muted font-normal ml-1">
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
