import {
  AlertCircle,
  BarChart3,
  BookOpen,
  BrainCircuit,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ClipboardCheck,
  FileQuestion,
  GraduationCap,
  Lightbulb,
  ListChecks,
  Loader2,
  RefreshCcw,
  Search,
  Sparkles,
  Star,
  Target,
  Timer,
  TriangleAlert,
  Trophy,
  X,
  Zap,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { MathJax } from "better-react-mathjax";
import { useParams } from "react-router-dom";
import axios from "axios";
import Cookies from "js-cookie";

const CARD =
  "rounded-2xl border bg-white shadow-[0_10px_35px_rgba(15,23,42,0.05)]";

const TONES = {
  violet: {
    border: "border-violet-200",
    soft: "bg-violet-50",
    title: "text-violet-800",
    strong: "bg-violet-600",
    chip: "bg-violet-100 text-violet-700",
  },
  blue: {
    border: "border-blue-200",
    soft: "bg-blue-50",
    title: "text-blue-800",
    strong: "bg-blue-600",
    chip: "bg-blue-100 text-blue-700",
  },
  emerald: {
    border: "border-emerald-200",
    soft: "bg-emerald-50",
    title: "text-emerald-800",
    strong: "bg-emerald-600",
    chip: "bg-emerald-100 text-emerald-700",
  },
  rose: {
    border: "border-rose-200",
    soft: "bg-rose-50",
    title: "text-rose-800",
    strong: "bg-rose-600",
    chip: "bg-rose-100 text-rose-700",
  },
  amber: {
    border: "border-amber-200",
    soft: "bg-amber-50",
    title: "text-amber-800",
    strong: "bg-amber-500",
    chip: "bg-amber-100 text-amber-700",
  },
};

export default function AxisRevisionPage({axisId}) {
  // const { axisId: routeAxisId } = useParams();
  // const axisId = routeAxisId || 1;
  const API_BASE_URL = import.meta.env.VITE_BASE_URL || "";

  const [revision, setRevision] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [openedQuestionType, setOpenedQuestionType] = useState(null);
  const [openedSelfCheck, setOpenedSelfCheck] = useState(null);

  const getToken = () =>
    Cookies.get("access_token") ||
    Cookies.get("access") ||
    localStorage.getItem("access_token") ||
    localStorage.getItem("access") ||
    "";

  const getAxisRevision = async () => {
    try {
      setLoading(true);
      setError("");

      const token = getToken();
      const response = await axios.get(
        `${API_BASE_URL}/api/axes/${axisId}/revision/`,
        {
          headers: token
            ? {
                Authorization: `Bearer ${token}`,
              }
            : {},
        }
      );

      const responseData = response.data;
      const revisionData =
        responseData?.revision || responseData?.data || responseData;

      setRevision(revisionData);
    } catch (requestError) {
      console.error("Axis revision request error:", requestError);

      if (requestError?.response?.status === 401) {
        setError("انتهت جلسة تسجيل الدخول. يرجى تسجيل الدخول من جديد.");
      } else if (requestError?.response?.status === 404) {
        setError("لا يوجد ملخص مراجعة لهذا المحور.");
      } else {
        setError(
          requestError?.response?.data?.detail ||
            requestError?.response?.data?.message ||
            "تعذر تحميل ملخص المحور."
        );
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!axisId) {
      setError("معرف المحور غير موجود.");
      setLoading(false);
      return;
    }

    getAxisRevision();
  }, [axisId]);

  const content = useMemo(() => revision?.content || {}, [revision]);
  const axisSummary = content?.axis_summary || {};
  const bacAnalysis = content?.bac_analysis || {};
  const questionTypes = bacAnalysis?.question_types || [];
  const commonMistakes = content?.common_mistakes || [];
  const quickReference = content?.quick_reference || [];
  const selfCheck = content?.self_check || [];
  const revisionCard = content?.revision_card || {};
  const recognitionGuide = content?.recognition_guide || [];
  const decisionTree = content?.decision_tree || [];

  const totalOccurrences = useMemo(
    () =>
      questionTypes.reduce(
        (sum, item) =>
          sum + Number(item?.frequency?.verified_occurrences || 0),
        0
      ),
    [questionTypes]
  );

  const years = useMemo(() => {
    const found = new Set();
    questionTypes.forEach((item) => {
      (item?.frequency?.years || []).forEach((year) => found.add(year));
      if (item?.real_bac_example?.year) found.add(item.real_bac_example.year);
    });
    return [...found].sort((a, b) => a - b);
  }, [questionTypes]);

  if (loading) {
    return <LoadingState />;
  }

  if (error) {
    return <ErrorState message={error} onRetry={getAxisRevision} />;
  }

  if (!revision) return null;

  return (
    <main
      dir="rtl"
      className="h-full overflow-y-auto bg-[#f8f9ff] px-3 py-4 sm:px-5 lg:px-7"
    >
      <div className="mx-auto max-w-[1600px] space-y-4">
        <HeroHeader
          revision={revision}
          axisId={axisId}
          totalOccurrences={totalOccurrences}
        />

        <StatsBar
          content={content}
          questionTypes={questionTypes}
          totalOccurrences={totalOccurrences}
        />

        <div className="grid gap-4 xl:grid-cols-12">
          <div className="space-y-4 xl:col-span-4">
            <AxisSummaryCard axisSummary={axisSummary} />
            <CommonMistakesCard items={commonMistakes} />
          </div>

          <div className="space-y-4 xl:col-span-4">
            <CoreConceptsCard axisSummary={axisSummary} />
            <RecognitionCard items={recognitionGuide} questionTypes={questionTypes} />
          </div>

          <div className="space-y-4 xl:col-span-4">
            <DefinitionMethodsCard axisSummary={axisSummary} />
            <BacExamplesCard questionTypes={questionTypes} />
          </div>
        </div>

        <BacQuestionTypesTable
          questionTypes={questionTypes}
          years={years}
          openedQuestionType={openedQuestionType}
          onToggle={(id) =>
            setOpenedQuestionType((current) => (current === id ? null : id))
          }
        />

        <div className="grid gap-4 xl:grid-cols-12">
          <div className="xl:col-span-5">
            <DecisionTreeCard
              items={decisionTree}
              quickReference={quickReference}
            />
          </div>

          <div className="xl:col-span-3">
            <QuickReferenceCard items={quickReference} />
          </div>

          <div className="xl:col-span-4">
            <SelfCheckCard
              items={selfCheck}
              openedId={openedSelfCheck}
              onToggle={(id) =>
                setOpenedSelfCheck((current) => (current === id ? null : id))
              }
            />
          </div>
        </div>

        {!!revisionCard?.items?.length && (
          <GoldenSummaryCard revisionCard={revisionCard} />
        )}

        <FooterNote title={revision.title} axisId={axisId} />
      </div>
    </main>
  );
}

function HeroHeader({ revision, axisId, totalOccurrences }) {
  return (
    <section className={`${CARD} overflow-hidden border-violet-200`}>
      <div className="relative px-5 py-5 sm:px-7">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_10%_20%,rgba(124,58,237,0.08),transparent_28%),radial-gradient(circle_at_90%_10%,rgba(59,130,246,0.08),transparent_30%)]" />

        <div className="relative grid items-center gap-5 lg:grid-cols-[180px_1fr_180px]">
          <div className="order-2 rounded-2xl border border-violet-200 bg-white/90 p-4 text-center lg:order-1">
            <Star className="mx-auto text-amber-500" size={32} />
            <p className="mt-2 text-xs font-black text-violet-700">درجة الأهمية</p>
            <p className="mt-1 text-3xl font-black text-slate-900">5/5</p>
            <p className="mt-1 text-xs text-slate-500">أساسي في البكالوريا</p>
          </div>

          <div className="order-1 text-center lg:order-2">
            <span className="inline-flex items-center gap-2 rounded-full bg-violet-600 px-4 py-2 text-xs font-black text-white shadow-lg shadow-violet-200">
              <Sparkles size={15} />
              ورقة مراجعة ذكية
            </span>

            <h1 className="mt-4 text-2xl font-black leading-[1.7] text-slate-950 md:text-3xl xl:text-[34px]">
              {revision.title}
            </h1>

            <p className="mx-auto mt-2 max-w-4xl text-sm font-semibold leading-7 text-slate-600 md:text-base">
              {revision.subtitle ||
                "ملخص مبسط + أنواع أسئلة البكالوريا + طريقة الحل + الأخطاء الشائعة"}
            </p>

            <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
              <span className="rounded-full bg-violet-100 px-4 py-1.5 text-xs font-black text-violet-700">
                محور {String(axisId).padStart(2, "0")}
              </span>
              <span className="rounded-full bg-blue-100 px-4 py-1.5 text-xs font-black text-blue-700">
                شرح بسيط ومباشر
              </span>
              <span className="rounded-full bg-emerald-100 px-4 py-1.5 text-xs font-black text-emerald-700">
                {totalOccurrences} ظهور موثق
              </span>
            </div>
          </div>

          <div className="order-3 rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-600 p-4 text-center text-white shadow-lg shadow-violet-200">
            <GraduationCap className="mx-auto" size={34} />
            <p className="mt-2 text-xs font-bold text-violet-100">الهدف</p>
            <p className="mt-1 font-black">مراجعة المحور بسرعة</p>
          </div>
        </div>
      </div>
    </section>
  );
}

function StatsBar({ content, questionTypes, totalOccurrences }) {
  const stats = [
    {
      icon: BookOpen,
      label: "المستوى",
      value: content?.level || "سهل",
      tone: "blue",
    },
    {
      icon: Timer,
      label: "مدة المراجعة",
      value: content?.estimated_duration || "25 دقيقة",
      tone: "violet",
    },
    {
      icon: Target,
      label: "أهداف المحور",
      value: `${content?.objectives_count || questionTypes.length || 0} أهداف`,
      tone: "rose",
    },
    {
      icon: CalendarDays,
      label: "أكثر الأسئلة تكراراً",
      value: questionTypes[0]?.title || "حسب المعطيات",
      tone: "blue",
    },
    {
      icon: BarChart3,
      label: "عدد مرات السقوط",
      value: `${totalOccurrences} مرة`,
      tone: "amber",
    },
  ];

  return (
    <section className={`${CARD} border-indigo-200 px-3 py-3`}>
      <div className="grid divide-y divide-slate-200 sm:grid-cols-2 sm:divide-y-0 xl:grid-cols-5 xl:divide-x xl:divide-x-reverse">
        {stats.map((stat, index) => {
          const Icon = stat.icon;
          const tone = TONES[stat.tone];
          return (
            <div key={index} className="flex items-center justify-center gap-3 px-3 py-3 text-center">
              <div className={`rounded-xl p-2.5 ${tone.soft}`}>
                <Icon size={21} className={tone.title} />
              </div>
              <div>
                <p className={`text-xs font-black ${tone.title}`}>{stat.label}</p>
                <p className="mt-1 line-clamp-2 text-sm font-bold text-slate-700">{stat.value}</p>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function AxisSummaryCard({ axisSummary }) {
  const points = axisSummary?.summary_points || axisSummary?.key_points || [];

  return (
    <SectionCard title="ملخص المحور" icon={ListChecks} tone="violet">
      {axisSummary?.central_idea && (
        <MathText className="text-sm font-medium leading-8 text-slate-700">
          {axisSummary.central_idea}
        </MathText>
      )}

      {!!points.length && (
        <div className="mt-4 space-y-2.5">
          {points.map((item, index) => (
            <div key={index} className="flex gap-2.5 rounded-xl bg-slate-50 p-3">
              <CheckCircle2 className="mt-1 shrink-0 text-violet-600" size={17} />
              <MathText className="text-sm leading-7 text-slate-700">{item}</MathText>
            </div>
          ))}
        </div>
      )}

      {axisSummary?.central_rule && (
        <div className="mt-4 rounded-xl border border-dashed border-violet-300 bg-violet-50 p-4 text-center">
          <p className="text-xs font-black text-violet-700">الفكرة الأساسية</p>
          <MathText className="mt-2 font-bold leading-7 text-slate-800">
            {axisSummary.central_rule}
          </MathText>
        </div>
      )}
    </SectionCard>
  );
}

function CoreConceptsCard({ axisSummary }) {
  const concepts = axisSummary?.core_concepts || [];

  return (
    <SectionCard title="المفاهيم والقواعد الأساسية" icon={BookOpen} tone="blue">
      <div className="space-y-3">
        {concepts.slice(0, 6).map((concept, index) => (
          <div key={concept.id || index} className="grid grid-cols-[34px_1fr] gap-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-sm font-black text-white">
              {index + 1}
            </span>
            <div>
              <p className="font-black text-blue-700">{concept.title}</p>
              <MathText className="mt-1 text-sm leading-7 text-slate-700">
                {concept.content}
              </MathText>
              {concept.formula && (
                <MathText className="mt-2 rounded-lg bg-blue-50 px-3 py-2 text-center font-bold text-slate-800">
                  {concept.formula}
                </MathText>
              )}
            </div>
          </div>
        ))}

        {!concepts.length && (
          <EmptyMini text="لا توجد مفاهيم أساسية في البيانات الحالية." />
        )}
      </div>
    </SectionCard>
  );
}

function DefinitionMethodsCard({ axisSummary }) {
  const concepts = axisSummary?.core_concepts || [];
  const methods = axisSummary?.definition_methods || concepts.slice(-2);

  return (
    <SectionCard title="طرق التعريف: مقارنة" icon={BrainCircuit} tone="emerald">
      <div className="overflow-hidden rounded-xl border border-emerald-200">
        <div className="grid grid-cols-2 bg-emerald-50 text-center text-xs font-black text-emerald-800">
          <div className="border-l border-emerald-200 p-3">حد عام مباشر</div>
          <div className="p-3">علاقة تراجعية</div>
        </div>

        <div className="grid grid-cols-2 text-sm">
          {[0, 1].map((columnIndex) => {
            const item = methods[columnIndex] || {};
            return (
              <div
                key={columnIndex}
                className="min-h-[220px] border-l border-emerald-100 p-4 last:border-l-0"
              >
                <p className="font-black text-slate-800">
                  {item.title || (columnIndex === 0 ? "صيغة مباشرة" : "تعريف تراجعي")}
                </p>
                <MathText className="mt-3 rounded-lg bg-slate-50 p-3 text-center font-bold leading-7">
                  {item.formula || (columnIndex === 0 ? "\\(u_n=f(n)\\)" : "\\(u_{n+1}=f(u_n,n)\\)")}
                </MathText>
                <MathText className="mt-3 leading-7 text-slate-600">
                  {item.content ||
                    (columnIndex === 0
                      ? "نعوض مباشرة بقيمة الرتبة المطلوبة."
                      : "نحسب الحدود بالتتابع انطلاقاً من الحد الابتدائي.")}
                </MathText>
                {item.memory_tip && (
                  <div className="mt-3 rounded-lg bg-emerald-50 p-2.5 text-xs font-bold leading-6 text-emerald-800">
                    {item.memory_tip}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </SectionCard>
  );
}

function BacExamplesCard({ questionTypes }) {
  const examples = questionTypes
    .map((type) => ({
      type,
      example: type.real_bac_example || type.training_example,
    }))
    .filter((item) => item.example)
    .slice(0, 4);

  return (
    <SectionCard title="أمثلة حقيقية من البكالوريا" icon={FileQuestion} tone="violet">
      <div className="space-y-3">
        {examples.map(({ type, example }, index) => (
          <article key={type.id || index} className="rounded-xl border border-violet-200 bg-violet-50/50 p-3.5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-black text-violet-800">
                  {type.title}
                  {example.year ? ` — بكالوريا ${example.year}` : ""}
                </p>
                {example.exercise && (
                  <p className="mt-1 text-xs font-bold text-violet-500">{example.exercise}</p>
                )}
              </div>
              <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-black text-violet-700">
                مثال {index + 1}
              </span>
            </div>

            <MathText className="mt-3 text-sm leading-7 text-slate-700">
              {example.statement}
            </MathText>

            {example.final_answer && (
              <MathText className="mt-3 rounded-lg bg-white p-2.5 text-center text-sm font-black text-violet-700">
                {example.final_answer}
              </MathText>
            )}
          </article>
        ))}

        {!examples.length && <EmptyMini text="لا توجد أمثلة محفوظة لهذا المحور." />}
      </div>
    </SectionCard>
  );
}

function RecognitionCard({ items, questionTypes }) {
  const fallback = questionTypes.slice(0, 5).map((type) => ({
    clue: type?.how_to_recognize?.[0] || type.title,
    result: type.title,
  }));
  const rows = items.length ? items : fallback;

  return (
    <SectionCard title="كيف أتعرف على نوع السؤال؟" icon={Search} tone="emerald">
      <div className="space-y-2.5">
        {rows.map((item, index) => (
          <div key={index} className="grid grid-cols-[1fr_auto] items-center gap-3 rounded-xl border border-emerald-100 bg-emerald-50/60 p-3">
            <MathText className="text-sm leading-7 text-slate-700">
              {item.clue || item.condition || item.if_you_see || item}
            </MathText>
            <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-emerald-700">
              {item.result || item.type || item.answer || "حدد الطريقة"}
            </span>
          </div>
        ))}
        {!rows.length && <EmptyMini text="لم تتم إضافة دليل التعرف بعد." />}
      </div>
    </SectionCard>
  );
}

function CommonMistakesCard({ items }) {
  return (
    <SectionCard title="الأخطاء الشائعة" icon={TriangleAlert} tone="rose">
      <div className="space-y-2.5">
        {items.map((item, index) => (
          <div key={index} className="rounded-xl border border-rose-100 bg-rose-50 p-3">
            <div className="flex gap-2">
              <X className="mt-1 shrink-0 text-rose-500" size={16} />
              <MathText className="text-sm font-bold leading-7 text-rose-800">
                {item.mistake || item}
              </MathText>
            </div>
            {item.correction && (
              <div className="mt-2 flex gap-2 border-t border-rose-100 pt-2">
                <Check className="mt-1 shrink-0 text-emerald-500" size={16} />
                <MathText className="text-sm leading-7 text-slate-700">
                  {item.correction}
                </MathText>
              </div>
            )}
          </div>
        ))}
        {!items.length && <EmptyMini text="لا توجد أخطاء شائعة مسجلة." />}
      </div>
    </SectionCard>
  );
}

function BacQuestionTypesTable({
  questionTypes,
  years,
  openedQuestionType,
  onToggle,
}) {
  return (
    <section className={`${CARD} overflow-hidden border-rose-200`}>
      <SectionTitle
        title="أنواع أسئلة البكالوريا في هذا المحور"
        icon={FileQuestion}
        tone="rose"
        subtitle="اضغط على أي نوع لعرض طريقة التعرف عليه، خطوات الحل، المثال والأخطاء الشائعة."
      />

      <div className="p-3 sm:p-5">
        <div className="hidden overflow-hidden rounded-xl border border-slate-200 lg:block">
          <div className="grid grid-cols-[90px_1.7fr_145px_1.2fr_110px] bg-rose-50 text-center text-xs font-black text-slate-700">
            <div className="p-3">النوع</div>
            <div className="border-r border-rose-100 p-3">وصف السؤال</div>
            <div className="border-r border-rose-100 p-3">عدد مرات السقوط</div>
            <div className="border-r border-rose-100 p-3">السنوات</div>
            <div className="border-r border-rose-100 p-3">التفاصيل</div>
          </div>

          {questionTypes.map((type, index) => {
            const frequency = type.frequency || {};
            const typeYears = frequency.years || [];
            const isOpen = openedQuestionType === type.id;
            return (
              <div key={type.id || index} className="border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => onToggle(type.id)}
                  className="grid w-full grid-cols-[90px_1.7fr_145px_1.2fr_110px] items-center text-right transition hover:bg-slate-50"
                >
                  <div className="flex justify-center p-3">
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-rose-500 font-black text-white">
                      {index + 1}
                    </span>
                  </div>
                  <div className="border-r border-slate-100 p-3">
                    <p className="font-black text-slate-900">{type.title}</p>
                    {type.description && (
                      <MathText className="mt-1 text-xs leading-6 text-slate-600">
                        {type.description}
                      </MathText>
                    )}
                  </div>
                  <div className="border-r border-slate-100 p-3 text-center">
                    <span className="font-black text-rose-600">
                      {frequency.verified_occurrences || 0} مرة
                    </span>
                  </div>
                  <div className="border-r border-slate-100 p-3 text-center text-xs leading-6 text-slate-600">
                    {typeYears.length ? typeYears.join("، ") : "غير محددة"}
                  </div>
                  <div className="flex justify-center border-r border-slate-100 p-3">
                    {isOpen ? <ChevronUp /> : <ChevronDown />}
                  </div>
                </button>

                {isOpen && <QuestionTypeDetails type={type} />}
              </div>
            );
          })}
        </div>

        <div className="space-y-3 lg:hidden">
          {questionTypes.map((type, index) => {
            const isOpen = openedQuestionType === type.id;
            return (
              <article key={type.id || index} className="overflow-hidden rounded-xl border border-slate-200">
                <button
                  type="button"
                  onClick={() => onToggle(type.id)}
                  className="flex w-full items-center justify-between gap-3 bg-slate-50 p-4 text-right"
                >
                  <div className="flex items-center gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-rose-500 font-black text-white">
                      {index + 1}
                    </span>
                    <div>
                      <p className="font-black text-slate-900">{type.title}</p>
                      <p className="mt-1 text-xs font-bold text-rose-600">
                        {type?.frequency?.verified_occurrences || 0} مرة
                      </p>
                    </div>
                  </div>
                  {isOpen ? <ChevronUp /> : <ChevronDown />}
                </button>
                {isOpen && <QuestionTypeDetails type={type} />}
              </article>
            );
          })}
        </div>

        {!!years.length && (
          <div className="mt-4 rounded-xl bg-rose-50 px-4 py-3 text-center text-xs font-black text-rose-700">
            السنوات الموثقة في البيانات: {years.join("، ")}
          </div>
        )}
      </div>
    </section>
  );
}

function QuestionTypeDetails({ type }) {
  const example = type.real_bac_example || type.training_example;

  return (
    <div className="bg-white p-4 sm:p-5">
      <div className="grid gap-4 lg:grid-cols-3">
        <InfoBlock title="كيف أتعرف عليه؟" tone="emerald">
          <BulletList items={type.how_to_recognize || []} tone="emerald" />
        </InfoBlock>

        <InfoBlock title="طريقة الحل" tone="blue">
          <NumberedList items={type?.method?.steps || []} />
        </InfoBlock>

        <InfoBlock title="الأخطاء الشائعة" tone="rose">
          <BulletList items={type.common_mistakes || []} tone="rose" />
        </InfoBlock>
      </div>

      {example && (
        <div className="mt-4 rounded-xl border border-violet-200 bg-violet-50 p-4">
          <p className="font-black text-violet-800">
            {example.year ? `مثال من بكالوريا ${example.year}` : "مثال تدريبي"}
          </p>
          <MathText className="mt-3 leading-8 text-slate-700">
            {example.statement}
          </MathText>

          {!!example.solution_steps?.length && (
            <div className="mt-3 grid gap-2 md:grid-cols-2">
              {example.solution_steps.map((step, index) => (
                <MathText key={index} className="rounded-lg bg-white p-3 text-sm leading-7 text-slate-700">
                  {index + 1}. {step}
                </MathText>
              ))}
            </div>
          )}

          {example.final_answer && (
            <MathText className="mt-3 rounded-lg bg-violet-600 p-3 text-center font-black text-white">
              {example.final_answer}
            </MathText>
          )}
        </div>
      )}
    </div>
  );
}

function DecisionTreeCard({ items, quickReference }) {
  const nodes = items.length
    ? items
    : quickReference.slice(0, 6).map((item, index) => ({
        question: item.if_asked,
        answer: item.apply,
        id: index,
      }));

  return (
    <SectionCard title="خطة اتخاذ القرار" icon={ClipboardCheck} tone="amber">
      <div className="rounded-xl border border-amber-200 bg-amber-50/40 p-3">
        <div className="mx-auto w-fit rounded-lg border border-amber-300 bg-white px-5 py-2 text-sm font-black text-slate-800">
          ما نوع المعطيات؟
        </div>
        <div className="mx-auto h-5 w-px bg-amber-300" />

        <div className="grid gap-3 md:grid-cols-2">
          {nodes.map((node, index) => (
            <div key={node.id || index} className="relative rounded-xl border border-amber-200 bg-white p-3 text-center">
              <div className="absolute -top-2 right-1/2 h-2 w-px bg-amber-300" />
              <MathText className="text-xs font-black leading-6 text-amber-800">
                {node.question || node.condition || node.if_asked}
              </MathText>
              <div className="my-2 flex justify-center">
                <ChevronDown size={16} className="text-amber-500" />
              </div>
              <MathText className="rounded-lg bg-amber-50 p-2 text-sm font-bold leading-6 text-slate-700">
                {node.answer || node.action || node.apply}
              </MathText>
            </div>
          ))}
        </div>

        {!nodes.length && <EmptyMini text="لم تتم إضافة شجرة القرار بعد." />}
      </div>
    </SectionCard>
  );
}

function QuickReferenceCard({ items }) {
  return (
    <SectionCard title="جدول مراجعة سريع" icon={Zap} tone="violet">
      <div className="overflow-hidden rounded-xl border border-slate-200">
        <div className="grid grid-cols-2 bg-violet-50 text-center text-xs font-black text-violet-800">
          <div className="border-l border-violet-100 p-3">إذا طلب منك</div>
          <div className="p-3">ماذا تطبق؟</div>
        </div>
        {items.map((item, index) => (
          <div key={index} className="grid grid-cols-2 border-t border-slate-200 text-xs">
            <MathText className="border-l border-slate-100 p-3 leading-6 text-slate-700">
              {item.if_asked}
            </MathText>
            <MathText className="p-3 font-bold leading-6 text-violet-700">
              {item.apply}
            </MathText>
          </div>
        ))}
        {!items.length && <EmptyMini text="لا يوجد جدول مراجعة سريع." />}
      </div>
    </SectionCard>
  );
}

function SelfCheckCard({ items, openedId, onToggle }) {
  return (
    <SectionCard title="تحقق من فهمك" icon={Trophy} tone="blue">
      <div className="space-y-2.5">
        {items.map((question, index) => {
          const id = question.id || index;
          const isOpen = openedId === id;
          return (
            <div key={id} className="overflow-hidden rounded-xl border border-blue-100">
              <button
                type="button"
                onClick={() => onToggle(id)}
                className="flex w-full items-start justify-between gap-3 bg-blue-50 p-3 text-right"
              >
                <div className="flex gap-2.5">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-black text-white">
                    {index + 1}
                  </span>
                  <MathText className="text-sm font-bold leading-7 text-slate-800">
                    {question.question}
                  </MathText>
                </div>
                {isOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
              </button>

              {isOpen && (
                <div className="p-3">
                  <MathText className="rounded-lg bg-emerald-50 p-3 text-sm font-bold leading-7 text-emerald-800">
                    {question.answer}
                  </MathText>
                  {question.skill && (
                    <p className="mt-2 text-xs font-black text-blue-600">
                      المهارة: {question.skill}
                    </p>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {!items.length && <EmptyMini text="لم تتم إضافة أسئلة تحقق بعد." />}
      </div>
    </SectionCard>
  );
}

function GoldenSummaryCard({ revisionCard }) {
  return (
    <section className={`${CARD} border-indigo-200 bg-gradient-to-l from-indigo-50 via-white to-violet-50 p-5`}>
      <div className="flex items-center gap-2 text-indigo-800">
        <Sparkles size={22} />
        <h2 className="text-lg font-black">{revisionCard.title || "الخلاصة الذهبية"}</h2>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {revisionCard.items.map((item, index) => (
          <div key={index} className="flex gap-2.5 rounded-xl border border-indigo-100 bg-white p-3">
            <CheckCircle2 className="mt-1 shrink-0 text-indigo-600" size={17} />
            <MathText className="text-sm leading-7 text-slate-700">{item}</MathText>
          </div>
        ))}
      </div>

      {revisionCard.golden_rule && (
        <MathText className="mt-4 rounded-xl bg-indigo-600 p-3 text-center font-black text-white">
          {revisionCard.golden_rule}
        </MathText>
      )}
    </section>
  );
}

function FooterNote({ title, axisId }) {
  return (
    <footer className="flex flex-col items-center justify-between gap-3 rounded-2xl border border-blue-200 bg-blue-50 px-5 py-3 text-center text-xs font-bold text-blue-800 sm:flex-row">
      <div className="flex items-center gap-2">
        <BookOpen size={16} />
        هذا الملخص يغطي محور {axisId}: {title}
      </div>
      <div className="flex items-center gap-2">
        <GraduationCap size={18} />
        صمم للمراجعة السريعة والتحضير للبكالوريا
      </div>
    </footer>
  );
}

function SectionCard({ title, icon: Icon, tone = "blue", children }) {
  const toneClass = TONES[tone];
  return (
    <section className={`${CARD} ${toneClass.border} overflow-hidden`}>
      <div className={`flex items-center gap-2 border-b ${toneClass.border} ${toneClass.soft} px-4 py-3`}>
        <Icon size={19} className={toneClass.title} />
        <h2 className={`text-base font-black ${toneClass.title}`}>{title}</h2>
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

function SectionTitle({ title, subtitle, icon: Icon, tone = "blue" }) {
  const toneClass = TONES[tone];
  return (
    <div className={`border-b ${toneClass.border} ${toneClass.soft} px-5 py-4`}>
      <div className="flex items-center gap-2">
        <Icon size={21} className={toneClass.title} />
        <h2 className={`text-lg font-black ${toneClass.title}`}>{title}</h2>
      </div>
      {subtitle && <p className="mt-1 text-sm leading-7 text-slate-600">{subtitle}</p>}
    </div>
  );
}

function InfoBlock({ title, tone, children }) {
  const toneClass = TONES[tone];
  return (
    <div className={`rounded-xl border ${toneClass.border} ${toneClass.soft} p-4`}>
      <p className={`font-black ${toneClass.title}`}>{title}</p>
      <div className="mt-3">{children}</div>
    </div>
  );
}

function BulletList({ items, tone = "blue" }) {
  const toneClass = TONES[tone];
  if (!items.length) return <EmptyMini text="لا توجد بيانات." />;

  return (
    <div className="space-y-2">
      {items.map((item, index) => (
        <div key={index} className="flex gap-2">
          <CheckCircle2 size={16} className={`mt-1 shrink-0 ${toneClass.title}`} />
          <MathText className="text-sm leading-7 text-slate-700">{item}</MathText>
        </div>
      ))}
    </div>
  );
}

function NumberedList({ items }) {
  if (!items.length) return <EmptyMini text="لا توجد خطوات حل." />;

  return (
    <div className="space-y-2">
      {items.map((item, index) => (
        <div key={index} className="flex gap-2">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-black text-white">
            {index + 1}
          </span>
          <MathText className="text-sm leading-7 text-slate-700">{item}</MathText>
        </div>
      ))}
    </div>
  );
}

function EmptyMini({ text }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-center text-sm font-bold text-slate-500">
      {text}
    </div>
  );
}

function LoadingState() {
  return (
    <main dir="rtl" className="flex min-h-[520px] items-center justify-center bg-[#f8f9ff] p-5">
      <div className="text-center">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-violet-100">
          <Loader2 size={42} className="animate-spin text-violet-600" />
        </div>
        <p className="mt-4 font-black text-slate-700">جاري تجهيز ملخص المحور...</p>
        <p className="mt-1 text-sm text-slate-500">يتم ترتيب المفاهيم والأسئلة والأمثلة</p>
      </div>
    </main>
  );
}

function ErrorState({ message, onRetry }) {
  return (
    <main dir="rtl" className="flex min-h-[520px] items-center justify-center bg-[#f8f9ff] p-5">
      <section className="w-full max-w-lg rounded-3xl border border-rose-200 bg-white p-8 text-center shadow-sm">
        <AlertCircle size={46} className="mx-auto text-rose-500" />
        <h2 className="mt-4 text-xl font-black text-slate-900">حدث خطأ</h2>
        <p className="mt-3 leading-7 text-slate-600">{message}</p>
        <button
          type="button"
          onClick={onRetry}
          className="mt-6 inline-flex items-center gap-2 rounded-xl bg-violet-600 px-5 py-3 font-bold text-white transition hover:bg-violet-700"
        >
          <RefreshCcw size={18} />
          إعادة المحاولة
        </button>
      </section>
    </main>
  );
}

function MathText({ children, className = "" }) {
  if (children === null || children === undefined || children === "") return null;

  return (
    <MathJax dynamic className={className}>
      {String(children)}
    </MathJax>
  );
}