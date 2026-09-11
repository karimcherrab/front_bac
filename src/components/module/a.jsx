[17/08/2026 23:58] Cherrab Karim: import React, { useEffect, useState } from "react";
import {
  Trophy,
  Target,
  Brain,
  Flame,
  BookOpen,
  AlertTriangle,
  CheckCircle2,
  ArrowRight,
  Sparkles,
  Send,
} from "lucide-react";

const API = "http://127.0.0.1:8000/api/adaptive";

const StatCard = ({ icon: Icon, title, value, color }) => (
  <div className="rounded-3xl bg-white p-5 shadow-sm border border-gray-100">
    <div className="flex items-center justify-between">
      <div>
        <p className="text-gray-500 text-sm">{title}</p>
        <h3 className="text-2xl font-bold mt-1">{value}</h3>
      </div>

      <div
        className={w-12 h-12 rounded-2xl flex items-center justify-center bg-gradient-to-br ${color}}
      >
        <Icon className="text-white" size={22} />
      </div>
    </div>
  </div>
);

const ProgressBar = ({ value }) => (
  <div className="w-full h-3 bg-gray-200 rounded-full overflow-hidden">
    <div
      className="h-full bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full transition-all"
      style={{ width: ${value}% }}
    />
  </div>
);

export default function AdaptiveAssessmentPage({ axisId = 1 }) {
  const [progress, setProgress] = useState(null);
  const [loading, setLoading] = useState(true);

  const [test, setTest] = useState(null);
  const [currentQuestion, setCurrentQuestion] = useState(null);

  const [answer, setAnswer] = useState("");

  const [grading, setGrading] = useState(null);

  useEffect(() => {
    loadProgress();
  }, []);

  const loadProgress = async () => {
    try {
      const res = await fetch(${API}/axes/${axisId}/progress/, {
        credentials: "include",
      });

      const data = await res.json();
      setProgress(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const generateTest = async () => {
    const res = await fetch(
      ${API}/axes/${axisId}/tests/generate/,
      {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          include_all_variants: true,
        }),
      }
    );

    const data = await res.json();

    setTest(data);

    if (data.test_questions?.length)
      setCurrentQuestion(data.test_questions[0]);
  };

  const submitAnswer = async () => {
    const res = await fetch(
      ${API}/test-questions/${currentQuestion.id}/submit/,
      {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          answer: {
            steps: [
              {
                order: 1,
                content: answer,
              },
            ],
            final_answer: answer,
          },
          time_spent_seconds: 120,
        }),
      }
    );

    const data = await res.json();
    setGrading(data);
  };

  if (loading)
    return (
      <div className="p-12 text-center text-gray-500">
        تحميل...
      </div>
    );

  return (
    <div className="min-h-screen bg-slate-50">

      <div className="max-w-7xl mx-auto p-6 space-y-8">

        {/* Hero */}

        <div className="rounded-[32px] bg-gradient-to-r from-blue-600 via-cyan-500 to-sky-500 p-8 text-white relative overflow-hidden">

          <div className="absolute right-0 top-0 opacity-20">
            <Sparkles size={220} />
          </div>

          <div className="relative">

            <div className="inline-flex items-center gap-2 bg-white/15 px-4 py-2 rounded-full mb-5">
              <Brain size={18} />
              <span>نظام BAC الذكي</span>
            </div>

            <h1 className="text-4xl font-bold mb-3">
              {progress?.axis?.title}
            </h1>

            <p className="text-blue-100 max-w-2xl">
              أكمل جميع أفكار البكالوريا حتى تصل إلى إتقان
              المحور بالكامل.
            </p>
[17/08/2026 23:58] Cherrab Karim: <div className="mt-8 max-w-md">
              <div className="flex justify-between mb-2 text-sm">
                <span>التقدم نحو 20/20</span>
                <span>
                  {Math.round(
                    progress?.ideas?.length
                      ? progress.ideas.reduce(
                          (a, b) => a + Number(b.mastery_score),
                          0
                        ) / progress.ideas.length
                      : 0
                  )}
                  %
                </span>
              </div>

              <ProgressBar
                value={
                  progress?.ideas?.length
                    ? progress.ideas.reduce(
                        (a, b) => a + Number(b.mastery_score),
                        0
                      ) / progress.ideas.length
                    : 0
                }
              />
            </div>

          </div>

        </div>

        {/* Stats */}

        <div className="grid md:grid-cols-4 gap-5">

          <StatCard
            icon={BookOpen}
            title="BAC Ideas"
            value={progress.ideas.length}
            color="from-blue-500 to-cyan-500"
          />

          <StatCard
            icon={Target}
            title="Variants"
            value={progress.variants.length}
            color="from-violet-500 to-purple-500"
          />

          <StatCard
            icon={Flame}
            title="Skills"
            value={progress.skills.length}
            color="from-orange-400 to-red-500"
          />

          <StatCard
            icon={Trophy}
            title="Weaknesses"
            value={progress.weaknesses.length}
            color="from-emerald-500 to-green-500"
          />

        </div>

        {/* Weakness */}

        <div className="grid lg:grid-cols-3 gap-6">

          <div className="lg:col-span-2 bg-white rounded-3xl p-6 shadow-sm border">

            <div className="flex justify-between items-center mb-6">

              <h2 className="font-bold text-xl">
                أفكار البكالوريا
              </h2>

              <button
                onClick={generateTest}
                className="px-5 py-3 rounded-2xl bg-blue-600 text-white flex items-center gap-2 hover:bg-blue-700"
              >
                ابدأ الاختبار الشامل
                <ArrowRight size={18} />
              </button>

            </div>

            <div className="space-y-4">

              {progress.ideas.map((idea) => (
                <div
                  key={idea.idea_code}
                  className="border rounded-2xl p-5 hover:border-blue-400 transition"
                >

                  <div className="flex justify-between items-center">

                    <div>

                      <h3 className="font-bold text-lg">
                        {idea.idea_title}
                      </h3>

                      <p className="text-sm text-gray-500 mt-1">
                        {idea.mastered_variants_count} Variants
                        متقنة
                      </p>

                    </div>

                    <div className="text-right">

                      <span className="font-bold text-blue-600">
                        {Math.round(idea.mastery_score)}%
                      </span>

                    </div>

                  </div>

                  <div className="mt-4">
                    <ProgressBar
                      value={idea.mastery_score}
                    />
                  </div>

                </div>
              ))}

            </div>

          </div>

          {/* Weakness */}

          <div className="bg-white rounded-3xl p-6 shadow-sm border">

            <h2 className="font-bold text-xl mb-5 flex items-center gap-2">
              <AlertTriangle className="text-red-500" />
              نقاط الضعف
            </h2>

            <div className="space-y-4">
[17/08/2026 23:58] Cherrab Karim: {progress.weaknesses.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  ممتاز! لا توجد نقاط ضعف حالياً.
                </div>
              ) : (
                progress.weaknesses.map((w) => (
                  <div
                    key={w.id}
                    className="rounded-2xl border border-red-200 bg-red-50 p-4"
                  >

                    <div className="font-bold text-red-700">
                      {w.title || w.error_code}
                    </div>

                    <div className="text-sm text-gray-600 mt-2">
                      تكرر {w.occurrences} مرة
                    </div>

                    <div className="mt-3">
                      <ProgressBar
                        value={w.severity_score}
                      />
                    </div>

                  </div>
                ))
              )}

            </div>

          </div>

        </div>

        {/* Test */}

        {currentQuestion && (
          <div className="bg-white rounded-3xl shadow-sm border p-8 space-y-6">

            <div className="flex justify-between">

              <div>

                <h2 className="font-bold text-2xl">
                  السؤال الحالي
                </h2>

                <p className="text-gray-500 mt-1">
                  {currentQuestion.question.idea_code} •{" "}
                  {currentQuestion.question.variant_code}
                </p>

              </div>

              <div className="bg-blue-100 text-blue-700 px-4 py-2 rounded-xl font-bold">
                {currentQuestion.points} نقطة
              </div>

            </div>

            <div className="rounded-2xl bg-slate-50 p-6 border leading-8 text-lg">

              {currentQuestion.question.statement.text ||
                JSON.stringify(
                  currentQuestion.question.statement
                )}

            </div>

            <textarea
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              placeholder="اكتب خطوات الحل هنا..."
              className="w-full h-56 rounded-2xl border p-5 focus:ring-4 focus:ring-blue-100 outline-none resize-none"
            />

            <button
              onClick={submitAnswer}
              className="px-6 py-3 rounded-2xl bg-green-600 hover:bg-green-700 text-white flex items-center gap-2"
            >
              إرسال الحل
              <Send size={18} />
            </button>

          </div>
        )}

        {/* Grading */}

        {grading && (
          <div className="bg-white rounded-3xl shadow-sm border p-8">

            <div className="flex items-center gap-3 mb-6">

              <CheckCircle2 className="text-green-600" size={30} />

              <h2 className="font-bold text-2xl">
                نتيجة التصحيح
              </h2>

            </div>

            <div className="grid md:grid-cols-3 gap-4 mb-6">

              <StatCard
                icon={Trophy}
                title="النقطة"
                value={${grading.score}/${grading.max_score}}
                color="from-green-500 to-emerald-500"
              />

              <StatCard
                icon={Target}
                title="النسبة"
                value={${Math.round(grading.percentage)}%}
                color="from-blue-500 to-cyan-500"
              />

              <StatCard
                icon={Brain}
                title="المحاولة"
                value={grading.attempt_number}
                color="from-violet-500 to-purple-500"
              />

            </div>

            <div className="rounded-2xl bg-blue-50 border border-blue-200 p-5">

              <div className="font-bold mb-2">
                ملاحظات الذكاء الاصطناعي
              </div>

              <p>{grading.feedback}</p>

            </div>

          </div>
        )}

      </div>

    </div>
  );
}