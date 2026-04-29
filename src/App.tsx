import { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ClipboardCheck, 
  ChevronRight, 
  RotateCcw, 
  Download, 
  Share2, 
  Loader2, 
  Sparkles,
  User,
  Calendar,
  Users,
  History,
  Trash2
} from 'lucide-react';
import { toPng } from 'html-to-image';
import Markdown from 'react-markdown';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

import { allQuestions, type Question } from './data/questions';
import { getDeepAnalysis, type MBTIResult } from './services/gemini';
import RadarChart from './components/RadarChart';
import { animalData } from './data/animals';

// Utility for tailwind classes
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

type Step = 'welcome' | 'form' | 'quiz' | 'analyzing' | 'result' | 'shared' | 'history';

export interface HistoryRecord {
  id: string;
  date: string;
  result: MBTIResult;
  analysis: string;
}

export default function App() {
  const [step, setStep] = useState<Step>('welcome');
  const [userData, setUserData] = useState({ name: '', gender: '', birthMonth: '', birthDay: '', bloodType: '' });
  const [currentQuestions, setCurrentQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [result, setResult] = useState<MBTIResult | null>(null);
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [isGeneratingAnalysis, setIsGeneratingAnalysis] = useState(false);
  const [sharedData, setSharedData] = useState<{name: string, typeCode: string, summary: string} | null>(null);
  const [history, setHistory] = useState<HistoryRecord[]>([]);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{ message: string, onConfirm: () => void } | null>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  useEffect(() => {
    const savedHistory = localStorage.getItem('mbti_history');
    if (savedHistory) {
      try {
        setHistory(JSON.parse(savedHistory));
      } catch (e) {
        console.error('Failed to parse history', e);
      }
    }
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('shared') === 'true' || params.get('s') === '1') {
      const name = params.get('name') || params.get('n') || '未知使用者';
      const typeCode = params.get('typeCode') || params.get('t') || '未知';
      setSharedData({
        name,
        typeCode,
        summary: `我在 MBTI 64型深度測驗中測出了 ${typeCode} 型！這是一個結合大數據與 Gemini AI 的精準分析，快來測測你的隱藏基因吧！`
      });
      setStep('shared');
    }
  }, []);

  const getZodiac = (monthStr: string, dayStr: string) => {
    if (!monthStr || !dayStr) return '未知';
    const month = parseInt(monthStr, 10);
    const day = parseInt(dayStr, 10);
    if ((month === 1 && day <= 20) || (month === 12 && day >= 22)) return "摩羯座";
    if ((month === 1 && day >= 21) || (month === 2 && day <= 18)) return "水瓶座";
    if ((month === 2 && day >= 19) || (month === 3 && day <= 20)) return "雙魚座";
    if ((month === 3 && day >= 21) || (month === 4 && day <= 19)) return "牡羊座";
    if ((month === 4 && day >= 20) || (month === 5 && day <= 20)) return "金牛座";
    if ((month === 5 && day >= 21) || (month === 6 && day <= 21)) return "雙子座";
    if ((month === 6 && day >= 22) || (month === 7 && day <= 22)) return "巨蟹座";
    if ((month === 7 && day >= 23) || (month === 8 && day <= 22)) return "獅子座";
    if ((month === 8 && day >= 23) || (month === 9 && day <= 22)) return "處女座";
    if ((month === 9 && day >= 23) || (month === 10 && day <= 23)) return "天秤座";
    if ((month === 10 && day >= 24) || (month === 11 && day <= 22)) return "天蠍座";
    if ((month === 11 && day >= 23) || (month === 12 && day <= 21)) return "射手座";
    return '未知';
  };

  const getTraitHint = (zodiac: string, bloodType: string) => {
    if (zodiac === '未知' || !bloodType || bloodType === '未知') return null;

    const zodiacTraits: Record<string, string> = {
      "牡羊座": "充滿熱情與行動力",
      "金牛座": "穩重且務實",
      "雙子座": "思維靈活且充滿好奇",
      "巨蟹座": "情感敏銳且具同理心",
      "獅子座": "自信且具備天生領導力",
      "處女座": "心思細膩且追求完美",
      "天秤座": "追求和諧且善於交際",
      "天蠍座": "洞察力深且直覺敏銳",
      "射手座": "熱愛自由且樂觀開朗",
      "摩羯座": "堅毅不拔且具責任感",
      "水瓶座": "思維創新且獨立自主",
      "雙魚座": "浪漫且想像力豐富"
    };

    const bloodTraits: Record<string, string> = {
      "A": "嚴謹、注重細節與秩序",
      "B": "隨性、充滿創意與彈性",
      "O": "積極、具備強大執行力",
      "AB": "理性、具備多面性思維"
    };

    const zTrait = zodiacTraits[zodiac];
    const bTrait = bloodTraits[bloodType];

    if (!zTrait || !bTrait) return null;

    return `當「${zTrait}」的${zodiac}，遇上「${bTrait}」的 ${bloodType} 型血，往往在職場上展現獨特的化學反應。這將如何影響您的 MBTI 決策模式？完成測驗由 AI 為您深度解析！`;
  };

  // Generate quiz: 60 questions total (10 for each of the 6 dimensions)
  const generateQuiz = () => {
    const selected: Question[] = [];
    const dimensions: { dim: Question['dimension'], count: number }[] = [
      { dim: 'EI', count: 10 },
      { dim: 'SN', count: 10 },
      { dim: 'TF', count: 10 },
      { dim: 'JP', count: 10 },
      { dim: 'AO', count: 10 },
      { dim: 'HC', count: 10 }
    ];
    
    dimensions.forEach(({ dim, count }) => {
      const filtered = allQuestions.filter(q => q.dimension === dim);
      const shuffled = [...filtered].sort(() => 0.5 - Math.random());
      selected.push(...shuffled.slice(0, count));
    });
    
    return selected.sort(() => 0.5 - Math.random());
  };

  const startQuiz = () => {
    if (!userData.name || !userData.gender || !userData.birthMonth || !userData.birthDay || !userData.bloodType) {
      showToast('請填寫完整資訊以開始測驗。');
      return;
    }
    setCurrentQuestions(generateQuiz());
    setStep('quiz');
  };

  const handleAnswer = (value: number) => {
    const question = currentQuestions[currentIndex];
    const newAnswers = { ...answers, [question.id]: value };
    setAnswers(newAnswers);
    
    if (currentIndex < currentQuestions.length - 1) {
      setCurrentIndex(prev => prev + 1);
    } else {
      calculateResult(newAnswers);
    }
  };

  const calculateResult = (finalAnswers: Record<number, number>) => {
    setStep('analyzing');
    
    // Small delay to show analyzing state
    setTimeout(async () => {
      const dimensionScores: Record<string, number[]> = {
        EI: [], SN: [], TF: [], JP: [], AO: [], HC: []
      };

      currentQuestions.forEach(q => {
        const answer = finalAnswers[q.id] || 0; // -2 to 2
        // direction 1: 2 is strong E, -2 is strong I
        // direction -1: 2 is strong I, -2 is strong E
        // We want to normalize to 0-100 where 100 is the first letter
        const score = (answer * q.direction + 2) * 25; // -2 -> 0, 2 -> 100
        dimensionScores[q.dimension].push(score);
      });

      const finalScores = {
        EI: Math.round(dimensionScores.EI.reduce((a, b) => a + b, 0) / dimensionScores.EI.length),
        SN: Math.round(dimensionScores.SN.reduce((a, b) => a + b, 0) / dimensionScores.SN.length),
        TF: Math.round(dimensionScores.TF.reduce((a, b) => a + b, 0) / dimensionScores.TF.length),
        JP: Math.round(dimensionScores.JP.reduce((a, b) => a + b, 0) / dimensionScores.JP.length),
        AO: Math.round(dimensionScores.AO.reduce((a, b) => a + b, 0) / dimensionScores.AO.length),
        HC: Math.round(dimensionScores.HC.reduce((a, b) => a + b, 0) / dimensionScores.HC.length),
      };

      const getCode = (score: number, first: string, second: string) => score >= 50 ? first : second;
      const typeCode = [
        getCode(finalScores.EI, 'E', 'I'),
        getCode(finalScores.SN, 'S', 'N'),
        getCode(finalScores.TF, 'T', 'F'),
        getCode(finalScores.JP, 'J', 'P'),
        '-',
        getCode(finalScores.AO, 'A', 'O'),
        '-',
        getCode(finalScores.HC, 'H', 'C'),
      ].join('');

      const mbtiResult: MBTIResult = {
        name: userData.name,
        gender: userData.gender,
        birthday: `${userData.birthMonth}月${userData.birthDay}日`,
        bloodType: userData.bloodType,
        zodiac: getZodiac(userData.birthMonth, userData.birthDay),
        typeCode,
        scores: finalScores
      };

      setResult(mbtiResult);
      setStep('result');
      
      // Trigger AI analysis
      setIsGeneratingAnalysis(true);
      try {
        const aiResponse = await getDeepAnalysis(mbtiResult);
        const finalAnalysis = aiResponse || "無法生成分析，請稍後再試。";
        setAnalysis(finalAnalysis);
        
        // Save to history
        const newRecord: HistoryRecord = {
          id: Date.now().toString(),
          date: new Date().toISOString(),
          result: mbtiResult,
          analysis: finalAnalysis
        };
        setHistory(prev => {
          const updated = [newRecord, ...prev];
          try {
            localStorage.setItem('mbti_history', JSON.stringify(updated));
          } catch (e) {
            console.error('Failed to save history to localStorage', e);
          }
          return updated;
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : '請檢查網路連接或 API 設定。';
        setAnalysis(`分析生成失敗：${message}`);
      } finally {
        setIsGeneratingAnalysis(false);
      }
    }, 1500);
  };

  const exportAsImage = async () => {
    if (!resultRef.current) return;
    try {
      const dataUrl = await toPng(resultRef.current, {
        quality: 1,
        pixelRatio: 2,
        backgroundColor: '#fff7ed',
      });
      const link = document.createElement('a');
      link.download = `MBTI-64-Result-${userData.name}.png`;
      link.href = dataUrl;
      link.click();
      showToast('圖片下載成功！');
    } catch (err) {
      console.error('Failed to export image', err);
      showToast('下載圖片失敗，請稍後再試。');
    }
  };

  const handleShare = async () => {
    if (!result) return;
    
    const params = new URLSearchParams();
    params.set('s', '1');
    params.set('n', result.name);
    params.set('t', result.typeCode);
    
    const longUrl = `${window.location.origin}${window.location.pathname}?${params.toString()}`;
    let shareUrl = longUrl;
    
    showToast('正在生成短網址...');

    try {
      // 使用 spoo.me 短網址服務 (支援 CORS)
      const response = await fetch('https://spoo.me/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json'
        },
        body: `url=${encodeURIComponent(longUrl)}`
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.short_url) {
          shareUrl = data.short_url;
        }
      }
    } catch (error) {
      console.error('短網址生成失敗，使用原始連結:', error);
      // 失敗時會自動退回使用已經優化過較短的 longUrl
    }
    
    try {
      await navigator.clipboard.writeText(shareUrl);
      showToast('已生成分享連結並複製到剪貼簿！');
    } catch (err) {
      const textArea = document.createElement("textarea");
      textArea.value = shareUrl;
      textArea.style.position = "fixed";
      textArea.style.opacity = "0";
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      try {
        document.execCommand('copy');
        showToast('已生成分享連結並複製到剪貼簿！');
      } catch (e) {
        showToast('複製失敗，請手動複製網址分享。');
      }
      document.body.removeChild(textArea);
    }
  };

  const resetQuiz = () => {
    setStep('welcome');
    setUserData({ name: '', gender: '', birthMonth: '', birthDay: '', bloodType: '' });
    setAnswers({});
    setCurrentIndex(0);
    setResult(null);
    setAnalysis(null);
  };

  const loadHistory = (record: HistoryRecord) => {
    setResult(record.result);
    setAnalysis(record.analysis);
    setStep('result');
  };

  const deleteHistory = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setConfirmDialog({
      message: '確定要刪除這筆紀錄嗎？',
      onConfirm: () => {
        setHistory(prev => {
          const updated = prev.filter(r => r.id !== id);
          try {
            localStorage.setItem('mbti_history', JSON.stringify(updated));
          } catch (err) {
            console.error('Failed to update history in localStorage', err);
          }
          return updated;
        });
        showToast('紀錄已刪除');
      }
    });
  };

  const progress = (currentIndex / currentQuestions.length) * 100;

  return (
    <div className="min-h-screen bg-orange-50 text-stone-900 font-sans selection:bg-amber-200">
      <header className="fixed top-0 w-full z-50 bg-white/80 backdrop-blur-md border-b border-amber-100 px-6 py-4 flex justify-between items-center">
        <div 
          className="flex items-center gap-2 cursor-pointer" 
          onClick={() => setStep('welcome')}
        >
          <div className="w-8 h-8 bg-amber-700 rounded-lg flex items-center justify-center">
            <ClipboardCheck className="text-white w-5 h-5" />
          </div>
          <h1 className="text-xl font-serif font-bold text-amber-900 tracking-tight">MBTI 64型深度測驗</h1>
        </div>
        <div className="flex items-center gap-6">
          {step === 'quiz' && (
            <div className="text-sm font-medium text-amber-700 hidden md:block">
              進度: {currentIndex + 1} / {currentQuestions.length}
            </div>
          )}
          <button 
            onClick={() => setStep('history')}
            className="flex items-center gap-2 text-sm font-bold text-amber-700 hover:text-amber-900 transition-colors"
          >
            <History className="w-4 h-4" /> 歷史紀錄
          </button>
        </div>
      </header>

      <main className="pt-24 pb-12 px-6 max-w-4xl mx-auto">
        <AnimatePresence mode="wait">
          {step === 'welcome' && (
            <motion.div
              key="welcome"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="text-center space-y-8 py-12"
            >
              <div className="space-y-4">
                <h2 className="text-5xl md:text-6xl font-serif font-black text-amber-900 leading-tight">
                  探索您的 <span className="text-amber-600">64型</span> <br />
                  隱藏人格基因
                </h2>
                <p className="text-lg text-stone-600 max-w-2xl mx-auto">
                  結合大數據分析與 Gemini AI 深度解析，專為職場競爭力與企業領導力設計。
                  跳脫傳統 16 型框架，更精準地定位您的職場優勢。
                </p>
              </div>
              <button
                onClick={() => setStep('form')}
                className="group relative px-8 py-4 bg-amber-700 text-white rounded-2xl font-bold text-lg shadow-xl hover:bg-amber-800 transition-all hover:scale-105 active:scale-95"
              >
                立即開始深度探索
                <ChevronRight className="inline-block ml-2 group-hover:translate-x-1 transition-transform" />
              </button>
            </motion.div>
          )}

          {step === 'form' && (
            <motion.div
              key="form"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white p-8 md:p-12 rounded-3xl shadow-2xl border border-amber-100 max-w-md mx-auto"
            >
              <h3 className="text-2xl font-serif font-bold text-amber-900 mb-8 flex items-center gap-2">
                <User className="w-6 h-6 text-amber-700" />
                基本資訊登錄
              </h3>
              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-stone-500 uppercase tracking-wider">姓名</label>
                  <input
                    type="text"
                    value={userData.name}
                    onChange={e => setUserData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="請輸入您的姓名"
                    className="w-full p-4 rounded-xl border-2 border-amber-50 focus:border-amber-500 outline-none transition-colors bg-amber-50/30"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-stone-500 uppercase tracking-wider">性別</label>
                    <select
                      value={userData.gender}
                      onChange={e => setUserData(prev => ({ ...prev, gender: e.target.value }))}
                      className="w-full p-4 rounded-xl border-2 border-amber-50 focus:border-amber-500 outline-none transition-colors bg-amber-50/30 appearance-none"
                    >
                      <option value="">選擇性別</option>
                      <option value="男">男性</option>
                      <option value="女">女性</option>
                      <option value="其他">其他</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-stone-500 uppercase tracking-wider">血型</label>
                    <select
                      value={userData.bloodType}
                      onChange={e => setUserData(prev => ({ ...prev, bloodType: e.target.value }))}
                      className="w-full p-4 rounded-xl border-2 border-amber-50 focus:border-amber-500 outline-none transition-colors bg-amber-50/30 appearance-none"
                    >
                      <option value="">選擇血型</option>
                      <option value="A">A型</option>
                      <option value="B">B型</option>
                      <option value="O">O型</option>
                      <option value="AB">AB型</option>
                      <option value="未知">未知</option>
                    </select>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-stone-500 uppercase tracking-wider">生日</label>
                  <div className="flex gap-4">
                    <select
                      value={userData.birthMonth}
                      onChange={e => setUserData(prev => ({ ...prev, birthMonth: e.target.value }))}
                      className="w-1/2 p-4 rounded-xl border-2 border-amber-50 focus:border-amber-500 outline-none transition-colors bg-amber-50/30 appearance-none"
                    >
                      <option value="">選擇月份</option>
                      {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                        <option key={m} value={m}>{m}月</option>
                      ))}
                    </select>
                    <select
                      value={userData.birthDay}
                      onChange={e => setUserData(prev => ({ ...prev, birthDay: e.target.value }))}
                      className="w-1/2 p-4 rounded-xl border-2 border-amber-50 focus:border-amber-500 outline-none transition-colors bg-amber-50/30 appearance-none"
                    >
                      <option value="">選擇日期</option>
                      {Array.from({ length: 31 }, (_, i) => i + 1).map(d => (
                        <option key={d} value={d}>{d}日</option>
                      ))}
                    </select>
                  </div>
                </div>

                <AnimatePresence>
                  {getTraitHint(getZodiac(userData.birthMonth, userData.birthDay), userData.bloodType) && (
                    <motion.div
                      initial={{ opacity: 0, y: -10, height: 0 }}
                      animate={{ opacity: 1, y: 0, height: 'auto' }}
                      exit={{ opacity: 0, y: -10, height: 0 }}
                      className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3 items-start overflow-hidden"
                    >
                      <Sparkles className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                      <p className="text-sm text-amber-800 leading-relaxed font-medium m-0">
                        {getTraitHint(getZodiac(userData.birthMonth, userData.birthDay), userData.bloodType)}
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>

                <button
                  onClick={startQuiz}
                  className="w-full py-4 bg-amber-700 text-white rounded-2xl font-bold text-lg shadow-lg hover:bg-amber-800 transition-all mt-4"
                >
                  進入 64 型深度測驗
                </button>
              </div>
            </motion.div>
          )}

          {step === 'quiz' && (
            <motion.div
              key="quiz"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-12"
            >
              <div className="w-full bg-amber-100 h-3 rounded-full overflow-hidden shadow-inner">
                <motion.div
                  className="bg-amber-600 h-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.5 }}
                />
              </div>

              <div className="bg-white p-10 md:p-16 rounded-[2.5rem] shadow-2xl border border-amber-50 text-center space-y-12 min-h-[400px] flex flex-col justify-center">
                <h4 className="text-2xl md:text-3xl font-medium text-stone-800 leading-relaxed">
                  {currentQuestions[currentIndex]?.text}
                </h4>

                <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-center">
                  <span className="text-sm font-bold text-amber-700 uppercase tracking-widest md:text-right">非常不符合</span>
                  <div className="col-span-3 flex justify-between items-center px-4">
                    {[-2, -1, 0, 1, 2].map(val => (
                      <button
                        key={val}
                        onClick={() => handleAnswer(val)}
                        className={cn(
                          "rounded-full border-2 transition-all duration-300",
                          Math.abs(val) === 2 ? "w-14 h-14" : Math.abs(val) === 1 ? "w-11 h-11" : "w-9 h-9",
                          "border-amber-200 hover:border-amber-600 hover:bg-amber-50 flex items-center justify-center"
                        )}
                      >
                        <div className={cn(
                          "rounded-full bg-amber-600 transition-all duration-300",
                          answers[currentQuestions[currentIndex].id] === val ? "scale-100 opacity-100" : "scale-0 opacity-0",
                          Math.abs(val) === 2 ? "w-8 h-8" : Math.abs(val) === 1 ? "w-6 h-6" : "w-4 h-4"
                        )} />
                      </button>
                    ))}
                  </div>
                  <span className="text-sm font-bold text-amber-700 uppercase tracking-widest md:text-left">非常符合</span>
                </div>
              </div>
            </motion.div>
          )}

          {step === 'analyzing' && (
            <motion.div
              key="analyzing"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center justify-center py-24 space-y-8"
            >
              <div className="relative">
                <Loader2 className="w-20 h-20 text-amber-700 animate-spin" />
                <Sparkles className="w-8 h-8 text-amber-500 absolute -top-2 -right-2 animate-pulse" />
              </div>
              <div className="text-center space-y-2">
                <h3 className="text-2xl font-serif font-bold text-amber-900">正在解析您的隱藏基因...</h3>
                <p className="text-stone-500">大數據模型正在計算您的 64 型人格傾向</p>
              </div>
            </motion.div>
          )}

          {step === 'result' && result && (
            <motion.div
              key="result"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="space-y-8"
            >
              <div ref={resultRef} className="bg-white p-8 md:p-12 rounded-[3rem] shadow-2xl border border-amber-100 space-y-12">
                <div className="flex flex-col md:flex-row justify-between items-start gap-8">
                  <div className="space-y-4">
                    <div className="inline-block px-4 py-1 bg-amber-100 text-amber-800 rounded-full text-sm font-bold tracking-widest uppercase">
                      測驗結果報告
                    </div>
                    <h3 className="text-4xl font-serif font-black text-amber-900 mb-2">
                      {result.name}
                    </h3>

                    {animalData[result.typeCode] && (() => {
                      const ani = animalData[result.typeCode];
                      return (
                        <div className="bg-gradient-to-br from-amber-500 to-amber-700 rounded-3xl p-6 text-white shadow-lg my-6 transform hover:scale-[1.02] transition-transform">
                          <div className="flex items-center gap-4">
                            <div className="text-6xl bg-white/20 w-24 h-24 rounded-full flex items-center justify-center shrink-0">
                              {ani.emoji}
                            </div>
                            <div>
                              <div className="text-amber-100 text-sm font-bold tracking-widest mb-1">{ani.groupName}</div>
                              <div className="text-3xl font-black">{ani.animal}</div>
                              <div className="text-xl font-medium opacity-90 mt-1">{result.typeCode} · {ani.suffixName}</div>
                            </div>
                          </div>
                        </div>
                      );
                    })()}

                    <div className="flex gap-4 text-stone-500 font-medium pb-2 border-b border-amber-100">
                      <div className="flex items-center gap-2"><Users className="w-4 h-4 text-amber-600" /> {result.gender}</div>
                      <div className="flex items-center gap-2"><Calendar className="w-4 h-4 text-amber-600" /> {result.birthday}</div>
                    </div>
                    <div className="flex gap-4 text-stone-500 font-medium">
                      <div className="flex items-center gap-2"><Sparkles className="w-4 h-4 text-amber-600" /> {result.zodiac}</div>
                      <div className="flex items-center gap-2"><User className="w-4 h-4 text-amber-600" /> {result.bloodType}型</div>
                    </div>
                  </div>
                  <div className="w-full md:w-1/2">
                    <RadarChart scores={Object.values(result.scores)} />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {Object.entries(result.scores).map(([key, value]) => {
                    const info = {
                      'EI': { title: '能量', desc: '獲取能量的方式', right: 'E 外向', left: 'I 內向' },
                      'SN': { title: '資訊', desc: '接收資訊的方式', right: 'S 實感', left: 'N 直覺' },
                      'TF': { title: '決策', desc: '做決定的依據', right: 'T 思考', left: 'F 情感' },
                      'JP': { title: '執行', desc: '應對生活的方式', right: 'J 判斷', left: 'P 感知' },
                      'AO': { title: '壓力', desc: '面對壓力的反應', right: 'A 堅定', left: 'O 彈性' },
                      'HC': { title: '社交', desc: '人際互動的風格', right: 'H 熱情', left: 'C 冷靜' }
                    }[key] || { title: '', desc: '', right: '', left: '' };

                    const isFirst = value >= 50;
                    const displayPercent = isFirst ? value : 100 - value;
                    const dominantLabel = isFirst ? info.right : info.left;

                    return (
                      <div key={key} className="bg-amber-50/50 p-5 rounded-2xl border border-amber-100 flex flex-col justify-center gap-4">
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="text-sm font-bold text-amber-900/60 tracking-wider">{info.title}</div>
                            <div className="text-xs text-amber-700/50 mt-0.5">{info.desc}</div>
                          </div>
                          <div className="text-xl font-black text-amber-800 text-right">
                            {dominantLabel} <span className="text-base text-amber-600/80">{displayPercent}%</span>
                          </div>
                        </div>
                        
                        <div className="space-y-2">
                          <div className="flex justify-between text-xs font-bold text-stone-400">
                            <span className={!isFirst ? "text-amber-700" : ""}>{info.left}</span>
                            <span className={isFirst ? "text-amber-700" : ""}>{info.right}</span>
                          </div>
                          <div className="w-full h-3 bg-amber-200/50 rounded-full overflow-hidden relative">
                            <div className="absolute top-0 bottom-0 left-1/2 w-0.5 bg-white z-10 -translate-x-1/2" />
                            {isFirst ? (
                              <motion.div 
                                initial={{ width: 0 }}
                                animate={{ width: `${value - 50}%` }}
                                transition={{ duration: 1, delay: 0.2, ease: "easeOut" }}
                                className="absolute top-0 bottom-0 left-1/2 bg-amber-500 rounded-r-full" 
                              />
                            ) : (
                              <motion.div 
                                initial={{ width: 0 }}
                                animate={{ width: `${50 - value}%` }}
                                transition={{ duration: 1, delay: 0.2, ease: "easeOut" }}
                                className="absolute top-0 bottom-0 right-1/2 bg-amber-500 rounded-l-full" 
                              />
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="space-y-6 pt-8 border-t border-amber-100">
                  <div className="flex items-center gap-3">
                    <Sparkles className="w-6 h-6 text-amber-600" />
                    <h4 className="text-xl font-serif font-bold text-amber-900">Gemini AI 深度解析</h4>
                  </div>
                  
                  {isGeneratingAnalysis ? (
                    <div className="flex items-center gap-3 text-amber-700 font-medium animate-pulse">
                      <Loader2 className="w-5 h-5 animate-spin" />
                      AI 正在生成專屬職場分析報告...
                    </div>
                  ) : (
                    <div className="prose prose-amber max-w-none text-stone-700 leading-relaxed">
                      <Markdown>{analysis || ''}</Markdown>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap gap-4 justify-center">
                <button
                  onClick={exportAsImage}
                  className="flex items-center gap-2 px-6 py-3 bg-amber-700 text-white rounded-xl font-bold hover:bg-amber-800 transition-all shadow-lg"
                >
                  <Download className="w-5 h-5" /> 下載 PNG 報告
                </button>
                <button
                  onClick={handleShare}
                  className="flex items-center gap-2 px-6 py-3 bg-white text-amber-700 border-2 border-amber-700 rounded-xl font-bold hover:bg-amber-50 transition-all shadow-lg"
                >
                  <Share2 className="w-5 h-5" /> 分享結果
                </button>
                <button
                  onClick={resetQuiz}
                  className="flex items-center gap-2 px-6 py-3 bg-stone-200 text-stone-700 rounded-xl font-bold hover:bg-stone-300 transition-all shadow-lg"
                >
                  <RotateCcw className="w-5 h-5" /> 重新測驗
                </button>
              </div>
            </motion.div>
          )}
          {step === 'shared' && sharedData && (
            <motion.div
              key="shared"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="text-center space-y-8 py-12"
            >
              <div className="bg-white p-8 md:p-12 rounded-[3rem] shadow-2xl border border-amber-100 max-w-2xl mx-auto space-y-6">
                <div className="inline-block px-4 py-1 bg-amber-100 text-amber-800 rounded-full text-sm font-bold tracking-widest uppercase">
                  好友分享結果
                </div>
                
                <h2 className="text-4xl font-serif font-black text-amber-900 text-left">
                  {sharedData.name} 的 64型圖騰
                </h2>

                {animalData[sharedData.typeCode] && (() => {
                  const ani = animalData[sharedData.typeCode];
                  return (
                    <div className="bg-gradient-to-br from-amber-500 to-amber-700 rounded-3xl p-6 text-white shadow-lg my-6 transform -rotate-1 text-left">
                      <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4">
                        <div className="text-6xl bg-white/20 w-24 h-24 rounded-full flex items-center justify-center shrink-0">
                          {ani.emoji}
                        </div>
                        <div className="text-center sm:text-left">
                          <div className="text-amber-100 text-sm font-bold tracking-widest mb-1">{ani.groupName}</div>
                          <div className="text-3xl font-black mb-1">{ani.animal}</div>
                          <div className="text-xl font-medium opacity-90">{sharedData.typeCode} · {ani.suffixName}</div>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                <div className="text-lg text-stone-600 bg-amber-50 p-6 rounded-2xl text-left leading-relaxed border border-amber-100">
                  <div className="flex items-center gap-2 mb-2">
                    <Sparkles className="w-5 h-5 text-amber-500" />
                    <span className="font-bold text-amber-900">AI 簡短摘要</span>
                  </div>
                  {sharedData.summary}
                </div>
                <button
                  onClick={() => {
                    window.history.replaceState({}, '', window.location.pathname);
                    setStep('welcome');
                  }}
                  className="mt-8 px-8 py-4 bg-amber-700 text-white rounded-2xl font-bold text-lg shadow-xl hover:bg-amber-800 transition-all hover:scale-105 active:scale-95"
                >
                  我也要測驗
                </button>
              </div>
            </motion.div>
          )}

          {step === 'history' && (
            <motion.div
              key="history"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="max-w-3xl mx-auto space-y-8 py-8"
            >
              <div className="flex items-center justify-between">
                <h2 className="text-3xl font-serif font-black text-amber-900 flex items-center gap-3">
                  <History className="w-8 h-8 text-amber-700" />
                  歷史紀錄
                </h2>
                <button
                  onClick={() => setStep('welcome')}
                  className="px-4 py-2 bg-white text-amber-700 border border-amber-200 rounded-lg font-bold hover:bg-amber-50 transition-colors"
                >
                  返回首頁
                </button>
              </div>

              {history.length === 0 ? (
                <div className="bg-white p-12 rounded-3xl shadow-xl border border-amber-100 text-center space-y-4">
                  <History className="w-16 h-16 text-amber-200 mx-auto" />
                  <p className="text-lg text-stone-500 font-medium">目前還沒有任何測驗紀錄</p>
                  <button
                    onClick={() => setStep('form')}
                    className="mt-4 px-6 py-3 bg-amber-700 text-white rounded-xl font-bold hover:bg-amber-800 transition-all"
                  >
                    立即開始測驗
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {history.map((record) => (
                    <div 
                      key={record.id}
                      onClick={() => loadHistory(record)}
                      className="bg-white p-6 rounded-2xl shadow-md border border-amber-100 hover:shadow-xl hover:border-amber-300 transition-all cursor-pointer group flex flex-col md:flex-row md:items-center justify-between gap-4"
                    >
                      <div className="space-y-2">
                        <div className="flex items-center gap-3">
                          {animalData[record.result.typeCode] && (
                            <div className="text-3xl bg-amber-100 w-12 h-12 rounded-full flex items-center justify-center shrink-0" title={animalData[record.result.typeCode].animal}>
                              {animalData[record.result.typeCode].emoji}
                            </div>
                          )}
                          <div className="flex flex-col">
                            <span className="text-xl font-bold text-amber-900">{record.result.name}</span>
                            <span className="text-sm font-bold text-amber-600 mt-1">
                              {record.result.typeCode} {animalData[record.result.typeCode] ? `· ${animalData[record.result.typeCode].animal}` : ''}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-stone-500">
                          <span className="flex items-center gap-1"><Calendar className="w-4 h-4" /> {new Date(record.date).toLocaleString()}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <button 
                          className="px-4 py-2 bg-amber-50 text-amber-700 rounded-lg font-bold group-hover:bg-amber-100 transition-colors"
                        >
                          查看結果
                        </button>
                        <button 
                          onClick={(e) => deleteHistory(record.id, e)}
                          className="p-2 text-stone-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                          title="刪除紀錄"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <footer className="py-8 text-center text-stone-400 text-sm">
        © 2026 MBTI 64-Type Deep Analysis System. Powered by Gemini AI.
      </footer>

      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-stone-800 text-white px-6 py-3 rounded-full shadow-2xl z-50 flex items-center gap-2 whitespace-nowrap"
          >
            <Sparkles className="w-4 h-4 text-amber-400" />
            {toastMessage}
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {confirmDialog && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className="bg-white p-6 rounded-2xl shadow-2xl max-w-sm w-full space-y-6"
            >
              <h3 className="text-xl font-bold text-stone-900">{confirmDialog.message}</h3>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setConfirmDialog(null)}
                  className="px-4 py-2 text-stone-500 hover:bg-stone-100 rounded-lg font-medium transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={() => {
                    confirmDialog.onConfirm();
                    setConfirmDialog(null);
                  }}
                  className="px-4 py-2 bg-red-500 text-white rounded-lg font-medium hover:bg-red-600 transition-colors"
                >
                  確定
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
