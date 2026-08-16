import {
  AlertCircle,
  ArrowLeft,
  Scale,
  BookOpenCheck,
  Brain,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  CircleHelp,
  Crown,
  FileQuestion,
  FileDown,
  Eye,
  GraduationCap,
  Lightbulb,
  Loader2,
  OctagonX,
  RefreshCcw,
  Route,
  Search,
  ShieldCheck,
  Sparkles,
  Target,
  X,
} from "lucide-react";
import { forwardRef, useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import Cookies from "js-cookie";

/* =========================================================
   AxisRevisionPage — Unified Islamic Revision Renderer
   يدعم المحاور 1 → 4 تلقائيًا حسب JSON:
   1) foundation_to_methods
   2) reason_roadmap
   3) balance_two_paths
   4) classification_tree / tree
========================================================= */

const CARD =
  "rounded-[30px] border border-slate-200/80 bg-white shadow-[0_18px_55px_rgba(15,23,42,0.045)]";

function cn(...classes) {
  return classes.filter(Boolean).join(" ");
}

function arr(value) {
  if (Array.isArray(value)) return value;
  if (value === null || value === undefined || value === "") return [];
  return [value];
}

function textOf(value) {
  if (value === null || value === undefined) return "";

  if (typeof value === "string" || typeof value === "number") {
    return String(value);
  }

  if (typeof value === "object") {
    return (
      value.text ||
      value.title ||
      value.label ||
      value.term ||
      value.definition ||
      value.description ||
      value.explanation ||
      value.answer ||
      value.content ||
      value.name ||
      ""
    );
  }

  return String(value);
}

function getToken() {
  return (
    Cookies.get("access_token") ||
    Cookies.get("access") ||
    localStorage.getItem("access_token") ||
    localStorage.getItem("access") ||
    ""
  );
}

function uniqueNumbers(values) {
  return [...new Set(arr(values).map(Number).filter(Boolean))].sort(
    (a, b) => a - b
  );
}

function collectYearsFromRevision(content) {
  const bac = content?.bac_analysis || {};
  const years = new Set();

  arr(bac?.years).forEach((year) => {
    if (year) years.add(Number(year));
  });

  arr(bac?.sample?.years).forEach((year) => {
    if (year) years.add(Number(year));
  });

  arr(bac?.question_types).forEach((type) => {
    arr(type?.frequency?.years).forEach((year) => {
      if (year) years.add(Number(year));
    });

    arr(type?.real_bac_examples).forEach((example) => {
      if (example?.year) years.add(Number(example.year));
    });

    if (type?.real_bac_example?.year) {
      years.add(Number(type.real_bac_example.year));
    }
  });

  arr(bac?.bac_examples).forEach((example) => {
    if (example?.year) years.add(Number(example.year));
  });

  arr(bac?.bac_timeline).forEach((item) => {
    if (item?.year) years.add(Number(item.year));
  });

  return [...years].filter(Boolean).sort((a, b) => a - b);
}

function detectDiagramType(content) {
  const explicit =
    content?.react_rendering?.diagram_type ||
    content?.axis_summary?.diagram?.type ||
    "";

  if (explicit) return explicit;

  const axis = content?.axis_summary || {};

  if (axis?.learning_map?.type) return axis.learning_map.type;

  if (axis?.tree?.branches?.length) return "classification_tree";

  if (axis?.memory_map?.length === 4 && content?.axis_tag === "quran_values") {
    return "classification_tree";
  }

  return "generic";
}

export default function AxisRevisionPage({ axisId }) {
  const API_BASE_URL = import.meta.env.VITE_BASE_URL || "";

  const [revision, setRevision] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [activeBranch, setActiveBranch] = useState(0);
  const [openedStudySection, setOpenedStudySection] = useState(0);
  const [openedQuestionType, setOpenedQuestionType] = useState(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState("");
  const pdfExportRef = useRef(null);

  const loadRevision = async () => {
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

      setRevision(
        responseData?.revision ||
          responseData?.data ||
          responseData
      );

      setActiveBranch(0);
      setOpenedStudySection(0);
      setOpenedQuestionType(null);
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

    loadRevision();
  }, [axisId]);

  const content = useMemo(
    () => revision?.content || revision || {},
    [revision]
  );

  const axisSummary = content?.axis_summary || {};
  const bacAnalysis = content?.bac_analysis || {};

  const diagramType = useMemo(
    () => detectDiagramType(content),
    [content]
  );

  const branches = useMemo(
    () => buildBranches(axisSummary),
    [axisSummary]
  );

  const studySections = useMemo(() => {
    const nativeSections = arr(axisSummary?.study_sections);
    if (nativeSections.length) return nativeSections;

    return branches.map((branch, index) => ({
      id: branch.id || `section_${index + 1}`,
      title: branch.title,
      intro: branch.explanation || "",
      points: branch.summaryPoints,
      children: branch.children,
      memory_tip: branch.memoryTip || "",
    }));
  }, [axisSummary, branches]);

  const years = useMemo(
    () => collectYearsFromRevision(content),
    [content]
  );

  useEffect(() => {
    return () => {
      if (pdfPreviewUrl) URL.revokeObjectURL(pdfPreviewUrl);
    };
  }, [pdfPreviewUrl]);

  const waitForPaint = () =>
    new Promise((resolve) =>
      requestAnimationFrame(() =>
        requestAnimationFrame(resolve)
      )
    );

  const buildPdfBlob = async () => {
    if (!pdfExportRef.current) return null;

    try {
      setPdfLoading(true);

      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
        import("html2canvas-pro"),
        import("jspdf"),
      ]);

      await waitForPaint();

      const pages = Array.from(
        pdfExportRef.current.querySelectorAll("[data-pdf-page='true']")
      );

      if (!pages.length) {
        throw new Error("No PDF pages found");
      }

      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
        compress: true,
      });

      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();

      for (let index = 0; index < pages.length; index += 1) {
        const page = pages[index];

        await new Promise((resolve) => {
          if ("requestIdleCallback" in window) {
            window.requestIdleCallback(() => resolve(), { timeout: 180 });
          } else {
            window.requestAnimationFrame(() => resolve());
          }
        });

        const canvas = await html2canvas(page, {
          scale: 1.45,
          useCORS: true,
          allowTaint: false,
          backgroundColor: "#ffffff",
          logging: false,
          removeContainer: true,
          imageTimeout: 10000,
          scrollX: 0,
          scrollY: 0,
          windowWidth: 1120,
          windowHeight: 1584,
        });

        const imageData = canvas.toDataURL("image/jpeg", 0.92);

        if (index > 0) pdf.addPage();

        pdf.addImage(
          imageData,
          "JPEG",
          0,
          0,
          pageWidth,
          pageHeight,
          undefined,
          "FAST"
        );
      }

      return pdf.output("blob");
    } catch (pdfError) {
      console.error("PDF generation error:", pdfError);
      setError(
        "تعذر إنشاء ملف PDF. تأكد من تثبيت html2canvas-pro و jspdf ثم أعد المحاولة."
      );
      return null;
    } finally {
      setPdfLoading(false);
    }
  };

  const handlePreviewPdf = async () => {
    const blob = await buildPdfBlob();
    if (!blob) return;

    if (pdfPreviewUrl) URL.revokeObjectURL(pdfPreviewUrl);
    const url = URL.createObjectURL(blob);
    setPdfPreviewUrl(url);
  };

  const handleDownloadPdf = async () => {
    const blob = await buildPdfBlob();
    if (!blob) return;

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `axis-${axisId}-revision.pdf`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 250);
  };

  if (loading) {
    return <LoadingState />;
  }

  if (error) {
    return <ErrorState message={error} onRetry={loadRevision} />;
  }

  if (!revision) return null;

  return (
    <main
      dir="rtl"
      className="h-full overflow-y-auto bg-[#f7f8f6] text-slate-950"
    >
      <div className="mx-auto max-w-[1540px] px-3 py-4 sm:px-5 lg:px-7 lg:py-6">
        <PdfActions
          loading={pdfLoading}
          onPreview={handlePreviewPdf}
          onDownload={handleDownloadPdf}
        />

        <div>
        <Hero
          revision={content}
          axisId={axisId}
          years={years}
          branchesCount={
            branches.length ||
            studySections.length ||
            arr(axisSummary?.diagram?.stages).length
          }
          bacCount={
            arr(bacAnalysis?.question_types).length ||
            arr(bacAnalysis?.question_patterns).length ||
            bacAnalysis?.question_count ||
            bacAnalysis?.sample?.exercise_count ||
            0
          }
        />

        <div className="mt-5">
          <DiagramRouter
            type={diagramType}
            content={content}
            axisSummary={axisSummary}
            branches={branches}
            activeBranch={activeBranch}
            onSelectBranch={setActiveBranch}
          />
        </div>

        {studySections.length > 0 && (
          <div className="mt-5">
            <StudySections
              sections={studySections}
              openedIndex={openedStudySection}
              onToggle={(index) =>
                setOpenedStudySection((current) =>
                  current === index ? -1 : index
                )
              }
            />
          </div>
        )}

        <div className="mt-5">
          <ComparisonsPanel
            items={
              arr(axisSummary?.do_not_confuse).length
                ? axisSummary.do_not_confuse
                : axisSummary?.comparison_table
            }
          />
        </div>

        <div className="mt-5">
          <BacSection
            bac={bacAnalysis}
            openedId={openedQuestionType}
            onToggle={(id) =>
              setOpenedQuestionType((current) =>
                current === id ? null : id
              )
            }
          />
        </div>

        <Footer title={content.title} axisId={axisId} />
        </div>

        <PdfCompactDocument
          ref={pdfExportRef}
          content={content}
          axisSummary={axisSummary}
          branches={branches}
          studySections={studySections}
          axisId={axisId}
        />

        <PdfPreviewModal
          url={pdfPreviewUrl}
          title={content.title}
          onClose={() => {
            if (pdfPreviewUrl) URL.revokeObjectURL(pdfPreviewUrl);
            setPdfPreviewUrl("");
          }}
        />
      </div>
    </main>
  );
}

/* =========================================================
   DATA ADAPTER
========================================================= */

function buildBranches(axisSummary) {
  const explicit = arr(axisSummary?.memory_map);

  if (explicit.length) {
    return explicit.map((item, index) => ({
      id: item.id || `branch_${index + 1}`,
      title:
        item.title ||
        item.label ||
        item.keyword ||
        `الفكرة ${index + 1}`,
      keyword:
        item.keyword ||
        item.memory_word ||
        item.short ||
        item.title ||
        `مفتاح ${index + 1}`,
      explanation:
        item.explanation ||
        item.content ||
        item.description ||
        "",
      summaryPoints: arr(
        item.summary_points ||
        item.points
      ),
      memoryTip:
        item.memory_tip ||
        item.clue ||
        item.hint ||
        "",
      children:
        arr(item.children).length
          ? arr(item.children)
          : arr(item.items),
    }));
  }

  const tree = arr(axisSummary?.tree?.branches);

  if (tree.length) {
    return tree.map((item, index) => ({
      id: item.id || `tree_${index + 1}`,
      title: item.title || item.label || `القسم ${index + 1}`,
      keyword: item.keyword || item.title || "",
      explanation: item.description || "",
      summaryPoints: arr(item.points),
      memoryTip: item.memory_tip || "",
      children: arr(item.children || item.items),
    }));
  }

  return [];
}

/* =========================================================
   HERO
========================================================= */

function Hero({
  revision,
  axisId,
  years,
  branchesCount,
  bacCount,
}) {
  return (
    <section className="relative overflow-hidden rounded-[34px] bg-[#10382f] text-white shadow-[0_30px_90px_rgba(16,56,47,.15)]">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -right-20 -top-20 h-72 w-72 rounded-full bg-emerald-300/10 blur-3xl" />
        <div className="absolute -bottom-20 left-16 h-72 w-72 rounded-full bg-teal-200/10 blur-3xl" />
      </div>

      <div className="relative px-5 py-7 sm:px-8 lg:px-10 lg:py-9">
        <div className="grid gap-7 lg:grid-cols-[1fr_380px] lg:items-center">
          <div>
            <div className="flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1.5 text-[11px] font-black text-emerald-100">
                <Sparkles size={14} />
                ملخص ذكي + بكالوريا
              </span>

              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] font-black text-white/60">
                المحور {String(axisId).padStart(2, "0")}
              </span>
            </div>

            <h1 className="mt-5 max-w-4xl text-3xl font-black leading-[1.55] sm:text-4xl lg:text-[42px]">
              {revision.title}
            </h1>

            {revision.subtitle && (
              <p className="mt-3 max-w-4xl text-sm font-semibold leading-8 text-emerald-50/70 sm:text-base">
                {revision.subtitle}
              </p>
            )}

            {revision.learning_goal && (
              <p className="mt-4 max-w-4xl rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-xs font-bold leading-7 text-white/60">
                {revision.learning_goal}
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <HeroStat
              value={branchesCount || "—"}
              label="أقسام الحفظ"
            />
            <HeroStat
              value={bacCount || "—"}
              label="أنماط/تمارين البكالوريا"
            />

            <div className="col-span-2 rounded-2xl border border-white/10 bg-white/8 p-4">
              <p className="text-[10px] font-black text-emerald-200">
                سنوات البكالوريا الموجودة
              </p>

              <div className="mt-2 flex flex-wrap gap-1.5">
                {years.length > 0 ? (
                  years.map((year) => (
                    <span
                      key={year}
                      className="rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-black text-white"
                    >
                      {year}
                    </span>
                  ))
                ) : (
                  <span className="text-xs font-bold text-white/50">
                    لا توجد سنوات محددة في البيانات
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function HeroStat({ value, label }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/8 p-4 text-center">
      <p className="text-2xl font-black">{value}</p>
      <p className="mt-1 text-[11px] font-bold text-emerald-100/60">
        {label}
      </p>
    </div>
  );
}

/* =========================================================
   DIAGRAM ROUTER
========================================================= */

function DiagramRouter({
  type,
  content,
  axisSummary,
  branches,
  activeBranch,
  onSelectBranch,
}) {
  if (
    type === "foundation_to_methods" ||
    axisSummary?.learning_map?.type === "foundation_to_methods"
  ) {
    return (
      <Axis1Diagram
        foundation={axisSummary?.foundation}
        map={axisSummary?.learning_map}
        branches={branches}
        activeBranch={activeBranch}
        onSelect={onSelectBranch}
      />
    );
  }

  if (type === "reason_roadmap") {
    return (
      <ReasonRoadmap diagram={axisSummary?.diagram} />
    );
  }

  if (type === "balance_two_paths") {
    return (
      <HealthBalanceDiagram diagram={axisSummary?.diagram} />
    );
  }

  if (
    type === "classification_tree" ||
    type === "tree" ||
    axisSummary?.tree?.branches?.length
  ) {
    return (
      <ValuesTreeDiagram
        axisSummary={axisSummary}
        branches={branches}
        activeBranch={activeBranch}
        onSelect={onSelectBranch}
      />
    );
  }

  return (
    <GenericDiagram
      title={content?.title}
      centralIdea={axisSummary?.central_idea}
      branches={branches}
      activeBranch={activeBranch}
      onSelect={onSelectBranch}
    />
  );
}

/* =========================================================
   AXIS 1 — FOUNDATION → IMPORTANCE → 8 METHODS
========================================================= */

function Axis1Diagram({
  foundation,
  map,
  branches,
  activeBranch,
  onSelect,
}) {
  if (!foundation && !map) return null;

  return (
    <div className="space-y-5">
      <CreedFoundationCard foundation={foundation} />

      {map && (
        <section className={`${CARD} overflow-hidden`}>
          <PanelHeading
            icon={Target}
            eyebrow="المخطط الأنسب لهذا المحور"
            title={map.title || "مخطط تثبيت العقيدة"}
            subtitle="العقيدة ← أهميتها ← سؤال مركزي ← الوسائل الثماني."
          />

          <div className="p-4 sm:p-6 lg:p-8">
            <div className="mx-auto max-w-6xl">
              <div className="mx-auto max-w-md rounded-[30px] bg-[#10382f] px-6 py-6 text-center text-white shadow-[0_20px_60px_rgba(16,56,47,.16)]">
                <p className="text-[10px] font-black text-emerald-300">
                  أساس الدرس
                </p>
                <h3 className="mt-1 text-2xl font-black">
                  {map?.top?.title}
                </h3>
                {map?.top?.subtitle && (
                  <p className="mt-2 text-sm font-bold text-emerald-50/70">
                    {map.top.subtitle}
                  </p>
                )}
              </div>

              <Connector />

              {map?.middle?.title && (
                <>
                  <div className="mx-auto max-w-3xl rounded-[28px] border border-emerald-100 bg-emerald-50/55 p-5 text-center">
                    <p className="text-[10px] font-black text-emerald-700">
                      {map.middle.title}
                    </p>

                    <div className="mt-3 flex flex-wrap justify-center gap-2">
                      {arr(map?.middle?.items).map((item, index) => (
                        <span
                          key={index}
                          className="rounded-full border border-emerald-200 bg-white px-3 py-2 text-xs font-black text-emerald-950"
                        >
                          {textOf(item)}
                        </span>
                      ))}
                    </div>
                  </div>

                  <Connector />
                </>
              )}

              {map?.question && (
                <div className="mx-auto max-w-2xl rounded-2xl border-2 border-dashed border-emerald-300 bg-white px-5 py-4 text-center">
                  <p className="text-[10px] font-black text-slate-400">
                    السؤال الذي يفتح بقية الدرس
                  </p>
                  <p className="mt-1 text-lg font-black leading-8 text-slate-950">
                    {map.question}
                  </p>
                </div>
              )}

              <div className="relative mt-8">
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {arr(map?.methods).map((method, index) => {
                    const active = activeBranch === index;

                    return (
                      <button
                        key={method.order || index}
                        type="button"
                        onClick={() => onSelect(index)}
                        className={cn(
                          "rounded-[24px] border p-4 text-right transition-all",
                          active
                            ? "border-emerald-700 bg-emerald-950 text-white shadow-lg"
                            : "border-slate-200 bg-white text-slate-900 hover:border-emerald-300 hover:bg-emerald-50/40"
                        )}
                      >
                        <span
                          className={cn(
                            "mb-3 flex h-9 w-9 items-center justify-center rounded-xl text-xs font-black",
                            active
                              ? "bg-white/10 text-emerald-200"
                              : "bg-emerald-50 text-emerald-800"
                          )}
                        >
                          {method.order || index + 1}
                        </span>

                        <h3 className="mt-1 text-sm font-black leading-6">
                          {method.name}
                        </h3>

                        {method.meaning && (
                          <p
                            className={cn(
                              "mt-2 text-[11px] font-semibold leading-6",
                              active
                                ? "text-white/65"
                                : "text-slate-500"
                            )}
                          >
                            {method.meaning}
                          </p>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {map?.memory_chain && (
                <MemoryChain text={map.memory_chain} />
              )}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

function CreedFoundationCard({ foundation }) {
  if (!foundation) return null;

  const blocks = arr(foundation?.blocks);
  const importance = foundation?.importance || {};

  return (
    <section className={`${CARD} overflow-hidden`}>
      <PanelHeading
        icon={BookOpenCheck}
        eyebrow="الأساس الذي يجب حفظه"
        title={foundation.title || "العقيدة الإسلامية"}
      />

      <div className="grid gap-5 p-5 sm:p-7 lg:grid-cols-2">
        <div className="space-y-7">
          {blocks.map((block, index) => (
            <div
              key={block.title || index}
              className="rounded-[26px] border border-slate-200 bg-white p-5"
            >
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-950 text-xs font-black text-white">
                  {index + 1}
                </span>

                <h3 className="text-base font-black text-slate-950">
                  {block.title}
                </h3>
              </div>

              {block.content && (
                <p className="mt-4 text-sm font-bold leading-8 text-slate-700">
                  {block.content}
                </p>
              )}

              {block.memory_tip && (
                <TipBox>{block.memory_tip}</TipBox>
              )}
            </div>
          ))}
        </div>

        {importance?.title && (
          <div className="rounded-[28px] bg-[#10382f] p-5 text-white sm:p-6">
            <p className="text-[10px] font-black text-emerald-300">
              لماذا هي مهمة؟
            </p>

            <h3 className="mt-1 text-xl font-black">
              {importance.title}
            </h3>

            <div className="mt-5 space-y-3">
              {arr(importance?.points).map((point, index) => (
                <div
                  key={index}
                  className="flex gap-3 rounded-2xl border border-white/10 bg-white/7 p-4"
                >
                  <CheckCircle2
                    size={17}
                    className="mt-1 shrink-0 text-emerald-300"
                  />
                  <p className="text-sm font-bold leading-7 text-emerald-50">
                    {textOf(point)}
                  </p>
                </div>
              ))}
            </div>

            {importance.memory_tip && (
              <div className="mt-5 rounded-2xl bg-white/10 p-4">
                <p className="text-[10px] font-black text-emerald-300">
                  سطر الحفظ
                </p>
                <p className="mt-1 text-sm font-black leading-7">
                  {importance.memory_tip}
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

/* =========================================================
   AXIS 2 — ROADMAP
========================================================= */

const roadmapIcons = {
  crown: Crown,
  brain: Brain,
  stop: OctagonX,
  shield: ShieldCheck,
};

function ReasonRoadmap({ diagram }) {
  if (!diagram) return null;

  return (
    <section className={`${CARD} overflow-hidden`}>
      <PanelHeading
        icon={Route}
        eyebrow="المخطط الأنسب لهذا المحور"
        title={diagram.title || "طريق العقل في القرآن"}
        subtitle="أربع محطات متتابعة، وكل محطة تفتح جزءًا من الدرس."
      />

      <div className="p-5 sm:p-7">
        <div className="mx-auto max-w-sm rounded-2xl bg-slate-950 px-5 py-4 text-center text-white">
          <Sparkles
            className="mx-auto mb-2 text-emerald-300"
            size={19}
          />
          <p className="font-black">{diagram.start}</p>
        </div>

        <Connector />

        <div className="grid gap-3 lg:grid-cols-4">
          {arr(diagram?.stages).map((stage, index) => (
            <RoadStage
              key={stage.word || index}
              stage={stage}
              index={index}
            />
          ))}
        </div>

        {diagram.finish && (
          <div className="mx-auto mt-6 max-w-xl rounded-[24px] border-2 border-dashed border-emerald-300 bg-emerald-50 p-4 text-center">
            <p className="text-xs font-black text-emerald-700">
              النتيجة
            </p>
            <p className="mt-1 font-black text-emerald-950">
              {diagram.finish}
            </p>
          </div>
        )}
      </div>
    </section>
  );
}

function RoadStage({ stage, index }) {
  const Icon = roadmapIcons[stage.icon] || Brain;

  return (
    <article className="rounded-[26px] border border-slate-200 bg-slate-50/60 p-4">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#10382f] text-white">
          <Icon size={19} />
        </span>

        <div>
          <p className="text-[10px] font-black text-emerald-700">
            المحطة {index + 1}
          </p>
          <p className="text-base font-black leading-6">{stage.title || stage.word}</p>
        </div>
      </div>

      <div className="mt-3 space-y-2">
        {arr(stage.items).map((item, i) => (
          <PointRow key={i} text={textOf(item)} compact />
        ))}
      </div>

      {stage.memory && (
        <p className="mt-3 rounded-xl bg-emerald-50 p-3 text-xs font-black leading-6 text-emerald-950">
          {stage.memory}
        </p>
      )}
    </article>
  );
}

/* =========================================================
   AXIS 3 — BALANCE / TWO PATHS
========================================================= */

function HealthBalanceDiagram({ diagram }) {
  if (!diagram) return null;

  return (
    <section className={`${CARD} overflow-hidden`}>
      <PanelHeading
        icon={Scale}
        eyebrow="المخطط الأنسب لهذا المحور"
        title={diagram.title || "ميزان الإنسان"}
        subtitle="مساران متكاملان: صحة النفس وصحة الجسد."
      />

      <div className="p-5 sm:p-7">
        <div className="mx-auto max-w-xl rounded-[30px] bg-[#10382f] p-6 text-center text-white">
          <Sparkles
            className="mx-auto text-emerald-300"
            size={22}
          />
          <h3 className="mt-2 text-2xl font-black">
            {diagram?.root?.title}
          </h3>
          {diagram?.root?.subtitle && (
            <p className="mt-2 text-sm font-bold text-emerald-50/75">
              {diagram.root.subtitle}
            </p>
          )}
        </div>

        <Connector />

        <div className="grid gap-5 lg:grid-cols-2">
          <HealthPath
            path={diagram?.left_path}
            icon={Brain}
          />
          <HealthPath
            path={diagram?.right_path}
            icon={ShieldCheck}
          />
        </div>

        {diagram.bottom && (
          <div className="mx-auto mt-6 max-w-2xl rounded-2xl border-2 border-dashed border-emerald-300 bg-emerald-50 p-4 text-center">
            <p className="font-black text-emerald-950">
              {diagram.bottom}
            </p>
          </div>
        )}
      </div>
    </section>
  );
}

function HealthPath({ path, icon: Icon }) {
  if (!path) return null;

  return (
    <div className="rounded-[28px] border border-slate-200 bg-slate-50/55 p-5">
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-950 text-white">
          <Icon size={21} />
        </span>

        <h3 className="text-xl font-black">
          {path.title}
        </h3>
      </div>

      {path.definition && (
        <p className="mt-4 rounded-2xl bg-white p-4 text-sm font-bold leading-8 text-slate-700">
          {path.definition}
        </p>
      )}

      <div className="mt-4 space-y-2">
        {arr(path?.stages).map((stage, index) => (
          <div
            key={index}
            className="flex gap-3 rounded-2xl border border-slate-200 bg-white p-4"
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-xs font-black text-emerald-900">
              {index + 1}
            </span>

            <div>
              <p className="font-black text-emerald-950">
                {stage.label}
              </p>
              <p className="mt-1 text-xs font-bold leading-6 text-slate-600">
                {stage.detail}
              </p>
            </div>
          </div>
        ))}
      </div>

      {path.result && (
        <div className="mt-4 rounded-2xl bg-[#171918] p-4 text-white">
          <p className="text-[10px] font-black text-emerald-300">
            النتيجة
          </p>
          <p className="mt-1 text-sm font-black leading-7">
            {path.result}
          </p>
        </div>
      )}
    </div>
  );
}

/* =========================================================
   AXIS 4 — CLASSIFICATION TREE
========================================================= */

function ValuesTreeDiagram({
  axisSummary,
  branches,
  activeBranch,
  onSelect,
}) {
  const treeBranches = arr(axisSummary?.tree?.branches);
  const displayBranches =
    treeBranches.length > 0
      ? treeBranches.map((item, index) => ({
          id: item.id || `tree_${index}`,
          title: item.title || item.label,
          children: arr(item.children || item.items),
        }))
      : branches;

  if (!displayBranches.length) return null;

  return (
    <section className={`${CARD} overflow-hidden`}>
      <PanelHeading
        icon={Brain}
        eyebrow="المخطط الكامل للدرس"
        title="القيم في القرآن الكريم"
        subtitle="اقرأ من الأعلى إلى الأسفل: القيم ← الأنواع الأربعة ← القيم التابعة لكل نوع."
      />

      <div className="p-4 sm:p-6 lg:p-8">
        <div className="mx-auto max-w-[1320px]">
          <div className="mx-auto max-w-xl rounded-[30px] bg-[#10382f] px-6 py-7 text-center text-white shadow-[0_22px_60px_rgba(16,56,47,.18)]">
            <p className="text-[10px] font-black text-emerald-300">
              عنوان المخطط
            </p>
            <h3 className="mt-1 text-2xl font-black leading-9">
              {axisSummary?.tree?.root ||
                "القيم في القرآن الكريم"}
            </h3>
          </div>

          <div className="mx-auto h-7 w-px bg-emerald-300" />
          <div className="mx-auto mb-5 h-px w-[82%] bg-emerald-200" />

          <div className="grid gap-4 lg:grid-cols-4">
            {displayBranches.slice(0, 4).map((branch, index) => {
              const active = activeBranch === index;
              const children = arr(branch.children);

              return (
                <div
                  key={branch.id || index}
                  className="relative"
                >
                  <div className="absolute -top-5 left-1/2 h-5 w-px -translate-x-1/2 bg-emerald-200" />

                  <button
                    type="button"
                    onClick={() => onSelect(index)}
                    className={cn(
                      "w-full rounded-[24px] border p-4 text-right transition-all",
                      active
                        ? "border-emerald-950 bg-emerald-950 text-white shadow-[0_16px_35px_rgba(6,95,70,.16)]"
                        : "border-emerald-100 bg-emerald-50/60 text-slate-900 hover:border-emerald-300 hover:bg-emerald-50"
                    )}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span
                        className={cn(
                          "flex h-8 w-8 items-center justify-center rounded-xl text-xs font-black",
                          active
                            ? "bg-white/10 text-emerald-200"
                            : "bg-white text-emerald-900"
                        )}
                      >
                        {index + 1}
                      </span>

                      {active && (
                        <CheckCircle2
                          size={17}
                          className="text-emerald-300"
                        />
                      )}
                    </div>

                    <p className="mt-3 text-base font-black leading-7">
                      {branch.title}
                    </p>
                  </button>

                  <div className="mx-auto h-4 w-px bg-slate-200" />

                  <div className="space-y-2">
                    {children.map((child, childIndex) => (
                      <button
                        key={`${textOf(child)}-${childIndex}`}
                        type="button"
                        onClick={() => onSelect(index)}
                        className="flex w-full items-center gap-3 rounded-2xl border border-slate-200 bg-white px-3 py-3 text-right transition hover:border-emerald-200"
                      >
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-[10px] font-black text-slate-500">
                          {childIndex + 1}
                        </span>

                        <span className="text-xs font-black leading-6 text-slate-800">
                          {textOf(child)}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {axisSummary?.tree?.memory_rule && (
            <MemoryChain
              text={axisSummary.tree.memory_rule}
            />
          )}
        </div>
      </div>
    </section>
  );
}

/* =========================================================
   GENERIC FALLBACK
========================================================= */

function GenericDiagram({
  title,
  centralIdea,
  branches,
  activeBranch,
  onSelect,
}) {
  if (!branches.length) return null;

  return (
    <section className={`${CARD} overflow-hidden`}>
      <PanelHeading
        icon={Brain}
        eyebrow="خريطة الدرس"
        title={title || "ملخص المحور"}
        subtitle={centralIdea}
      />

      <div className="grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-4">
        {branches.map((branch, index) => (
          <button
            key={branch.id || index}
            type="button"
            onClick={() => onSelect(index)}
            className={cn(
              "rounded-2xl border p-4 text-right transition",
              activeBranch === index
                ? "border-emerald-800 bg-emerald-950 text-white"
                : "border-slate-200 bg-white hover:bg-emerald-50"
            )}
          >
            <p className="text-xs font-black">
              {branch.keyword}
            </p>
            <p className="mt-2 font-black">
              {branch.title}
            </p>
          </button>
        ))}
      </div>
    </section>
  );
}

/* =========================================================
   STUDY SECTIONS — AXIS 2 & 3
========================================================= */

function StudySections({
  sections,
  openedIndex,
  onToggle,
  expandAll = false,
}) {
  if (!sections.length) return null;

  return (
    <section className="space-y-4">
      {sections.map((section, index) => {
        const open = expandAll || openedIndex === index;

        return (
          <article
            key={section.id || index}
            className={`${CARD} overflow-hidden`}
          >
            <button
              type="button"
              onClick={() => onToggle(index)}
              className="flex w-full items-center justify-between gap-4 p-5 text-right sm:p-6"
            >
              <div>
                <p className="text-[10px] font-black text-emerald-700">
                  قسم {index + 1}
                </p>
                <h2 className="mt-1 text-xl font-black">
                  {section.title}
                </h2>
              </div>

              {open ? (
                <ChevronUp size={19} />
              ) : (
                <ChevronDown size={19} />
              )}
            </button>

            {open && (
              <StudySectionBody section={section} />
            )}
          </article>
        );
      })}
    </section>
  );
}

function StudySectionBody({ section }) {
  // إذا كان القسم يحتوي تفاصيل children، لا نعرض summary points فوقها
  // حتى لا تتكرر نفس المعلومة مرتين كما في المحورين 1 و4.
  return (
    <div className="border-t border-slate-100 p-5 sm:p-6">
      {section.intro && (
        <p className="rounded-2xl bg-slate-50 p-4 text-sm font-bold leading-8 text-slate-700">
          {section.intro}
        </p>
      )}

      {section.definition && (
        <div className="mt-4 rounded-2xl bg-emerald-50/60 p-4">
          <p className="text-[10px] font-black text-emerald-700">
            التعريف
          </p>
          <p className="mt-2 text-sm font-black leading-8">
            {section.definition}
          </p>
        </div>
      )}

      {arr(section.points).length > 0 &&
        arr(section.children).length === 0 && (
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {arr(section.points).map((point, index) => (
              <PointRow
                key={index}
                text={textOf(point)}
              />
            ))}
          </div>
        )}

      {arr(section.items).length > 0 && (
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {arr(section.items).map((item, index) => (
            <PointStudyCard
              key={index}
              item={item}
            />
          ))}
        </div>
      )}

      {arr(section.children).length > 0 && (
        <div className="mt-5 space-y-4">
          {arr(section.children).map((child, index) => (
            <AccordionChildCard
              key={child?.id || child?.name || child?.title || index}
              child={child}
              index={index}
            />
          ))}
        </div>
      )}

      {arr(section.comparisons).length > 0 && (
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {arr(section.comparisons).map((item, index) => (
            <ComparisonCard
              key={index}
              item={item}
            />
          ))}
        </div>
      )}

      {arr(section.two_sides).length > 0 && (
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          {arr(section.two_sides).map((side, index) => (
            <SideStudyCard
              key={index}
              side={side}
            />
          ))}
        </div>
      )}

      {arr(section.subsections).length > 0 && (
        <div className="mt-5 grid gap-4">
          {arr(section.subsections).map((sub, index) => (
            <SubsectionCard
              key={index}
              subsection={sub}
            />
          ))}
        </div>
      )}

      {section.evidence && (
        <div className="mt-4">
          <EvidenceBox evidence={section.evidence} />
        </div>
      )}

      {section.memory_tip && (
        <TipBox>{section.memory_tip}</TipBox>
      )}

      {section.exam_answer && (
        <div className="mt-4 rounded-2xl bg-[#10382f] p-4 text-white">
          <p className="text-[10px] font-black text-emerald-300">
            صياغة تساعدك في البكالوريا
          </p>
          <p className="mt-2 text-sm font-black leading-7">
            {section.exam_answer}
          </p>
        </div>
      )}
    </div>
  );
}

function AccordionChildCard({ child, index }) {
  if (
    child === null ||
    child === undefined ||
    child === ""
  ) {
    return null;
  }

  if (
    typeof child === "string" ||
    typeof child === "number"
  ) {
    return (
      <div className="flex gap-3 rounded-2xl border border-slate-200 bg-white p-4">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-xs font-black text-emerald-900">
          {index + 1}
        </span>
        <p className="text-sm font-black leading-7 text-slate-800">
          {String(child)}
        </p>
      </div>
    );
  }

  const title =
    child.name ||
    child.title ||
    child.label ||
    "";

  const meaning =
    child.definition ||
    child.meaning ||
    child.explanation ||
    "";

  const points = arr(child.points);
  const evidence =
    child.evidence ||
    child.quran_evidence ||
    null;

  const recognition =
    child.recognition ||
    child.recognition_key ||
    child.how_to_recognize ||
    "";

  if (
    !title &&
    !meaning &&
    !points.length &&
    !evidence &&
    !recognition &&
    !child.exam_note &&
    !child.answer_template
  ) {
    return null;
  }

  return (
    <article className="overflow-hidden rounded-[26px] border border-slate-200 bg-white">
      <div className="flex items-start gap-3 border-b border-slate-100 px-5 py-4">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-xs font-black text-emerald-900">
          {index + 1}
        </span>

        <div className="min-w-0">
          {title && (
            <h3 className="text-base font-black leading-7 text-slate-950">
              {title}
            </h3>
          )}

          {meaning && (
            <p className="mt-1 text-xs font-bold leading-6 text-slate-500">
              {meaning}
            </p>
          )}
        </div>
      </div>

      <div className="grid gap-4 p-5 lg:grid-cols-[1fr_.92fr]">
        <div className="space-y-2">
          {points.map((point, pointIndex) => (
            <PointRow
              key={pointIndex}
              text={textOf(point)}
              bare
            />
          ))}

          {!points.length && meaning && (
            <PointRow text={meaning} bare />
          )}
        </div>

        <div className="space-y-3">
          {evidence && (
            <EvidenceBox evidence={evidence} />
          )}

          {recognition && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <p className="text-[10px] font-black text-amber-700">
                مفتاح التمييز في السند
              </p>
              <p className="mt-1 text-xs font-black leading-6 text-amber-950">
                {textOf(recognition)}
              </p>
            </div>
          )}

          {child.exam_note && (
            <div className="rounded-2xl border border-sky-200 bg-sky-50 p-4">
              <p className="text-[10px] font-black text-sky-700">
                ملاحظة للبكالوريا
              </p>
              <p className="mt-1 text-xs font-bold leading-6 text-sky-950">
                {child.exam_note}
              </p>
            </div>
          )}

          {child.answer_template && (
            <div className="rounded-2xl bg-slate-950 p-4 text-white">
              <p className="text-[10px] font-black text-emerald-300">
                صيغة جواب مناسبة
              </p>
              <p className="mt-1 text-xs font-bold leading-6 text-slate-100">
                {child.answer_template}
              </p>
            </div>
          )}
        </div>
      </div>
    </article>
  );
}

function PointStudyCard({ item }) {
  if (
    typeof item === "string" ||
    typeof item === "number"
  ) {
    return (
      <PointRow text={String(item)} />
    );
  }

  const title =
    item?.title ||
    item?.name ||
    item?.label ||
    "";

  const explanation =
    item?.explanation ||
    item?.meaning ||
    item?.content ||
    "";

  if (!title && !explanation) return null;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      {title && (
        <p className="font-black">
          {title}
        </p>
      )}

      {explanation && (
        <p className="mt-2 text-xs font-bold leading-6 text-slate-600">
          {explanation}
        </p>
      )}

      {item?.evidence && (
        <div className="mt-3">
          <EvidenceBox evidence={item.evidence} />
        </div>
      )}
    </div>
  );
}

function SideStudyCard({ side }) {
  if (!side) return null;

  return (
    <div className="rounded-[24px] border border-emerald-200 bg-emerald-50/40 p-5">
      <h3 className="font-black text-emerald-950">
        {side.title}
      </h3>

      {side.meaning && (
        <p className="mt-2 text-xs font-bold leading-6 text-slate-600">
          {side.meaning}
        </p>
      )}

      <div className="mt-3 space-y-2">
        {arr(side.items).map((item, index) => (
          <PointStudyCard
            key={index}
            item={item}
          />
        ))}
      </div>

      {side.memory_tip && (
        <p className="mt-3 text-xs font-black text-emerald-800">
          مفتاح الحفظ: {side.memory_tip}
        </p>
      )}
    </div>
  );
}

function SubsectionCard({ subsection }) {
  if (!subsection) return null;

  return (
    <article className="rounded-[26px] border border-slate-200 p-5">
      <h3 className="text-lg font-black">
        {subsection.title}
      </h3>

      <div className="mt-3 space-y-3">
        {arr(subsection.items).map((item, index) => {
          if (
            typeof item === "string" ||
            typeof item === "number"
          ) {
            return (
              <PointRow
                key={index}
                text={String(item)}
                bare
              />
            );
          }

          return (
            <PointStudyCard
              key={index}
              item={item}
            />
          );
        })}
      </div>

      {subsection.evidence && (
        <div className="mt-4">
          <EvidenceBox
            evidence={subsection.evidence}
          />
        </div>
      )}

      {subsection.memory_tip && (
        <p className="mt-4 text-xs font-black text-emerald-800">
          مفتاح الحفظ: {subsection.memory_tip}
        </p>
      )}
    </article>
  );
}

/* =========================================================
   COMPARISONS
========================================================= */

function ComparisonsPanel({ items }) {
  const rows = arr(items);

  if (!rows.length) return null;

  return (
    <section className={`${CARD} p-5 sm:p-6`}>
      <PanelHeadingInline
        icon={CircleHelp}
        title="لا تخلط في البكالوريا"
        subtitle="الفروق التي تمنع أكثر الأخطاء شيوعًا."
      />

      <div className="mt-5 grid gap-3 md:grid-cols-2">
        {rows.map((item, index) => (
          <ComparisonCard
            key={index}
            item={item}
          />
        ))}
      </div>
    </section>
  );
}

function ComparisonCard({ item }) {
  if (!item) return null;

  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
      <p className="font-black text-amber-950">
        {item.a} ≠ {item.b}
      </p>
      <p className="mt-2 text-xs font-bold leading-6 text-amber-900">
        {item.difference}
      </p>

      {item.memory && (
        <p className="mt-3 rounded-xl bg-white p-3 text-xs font-black text-amber-800">
          {item.memory}
        </p>
      )}
    </div>
  );
}

/* =========================================================
   BAC SECTION — supports question_types + question_patterns
========================================================= */

function BacSection({
  bac,
  openedId,
  onToggle,
  expandAll = false,
}) {
  if (!bac) return null;

  const questionTypes = arr(bac?.question_types);
  const questionPatterns = arr(bac?.question_patterns);

  if (
    !questionTypes.length &&
    !questionPatterns.length &&
    !bac?.overview
  ) {
    return null;
  }

  return (
    <section className={`${CARD} overflow-hidden`}>
      <PanelHeading
        icon={FileQuestion}
        eyebrow="البكالوريا"
        title="كيف يأتي هذا المحور في البكالوريا؟"
        subtitle={bac?.overview}
      />

      <div className="p-4 sm:p-5">
        {questionTypes.length > 0 ? (
          <QuestionTypesList
            items={questionTypes}
            openedId={openedId}
            onToggle={onToggle}
            expandAll={expandAll}
          />
        ) : (
          <QuestionPatternsGrid
            items={questionPatterns}
          />
        )}

        {arr(bac?.writing_method).length > 0 && (
          <div className="mt-5 rounded-2xl bg-[#10382f] p-5 text-white">
            <p className="text-[10px] font-black text-emerald-300">
              منهجية الإجابة
            </p>

            <div className="mt-3 space-y-2">
              {arr(bac.writing_method).map((item, index) => (
                <p
                  key={index}
                  className="text-sm font-bold leading-7"
                >
                  • {textOf(item)}
                </p>
              ))}
            </div>

            {bac?.answer_template && (
              <div className="mt-4 rounded-xl bg-white/10 p-3 text-sm font-black">
                {bac.answer_template}
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

function QuestionTypesList({
  items,
  openedId,
  onToggle,
  expandAll = false,
}) {
  return (
    <div className="space-y-3">
      {items.map((type, index) => {
        const id = type.id || index;
        const open = expandAll || openedId === id;
        const years = uniqueNumbers(
          type?.frequency?.years
        );

        return (
          <article
            key={id}
            className={cn(
              "overflow-hidden rounded-[24px] border transition",
              open
                ? "border-indigo-200 bg-indigo-50/30"
                : "border-slate-200 bg-white"
            )}
          >
            <button
              type="button"
              onClick={() => onToggle(id)}
              className="w-full p-4 text-right"
            >
              <div className="flex items-start gap-4">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-indigo-950 text-sm font-black text-white">
                  {index + 1}
                </span>

                <div className="min-w-0 flex-1">
                  <h3 className="font-black leading-7 text-slate-950">
                    {type.title}
                  </h3>

                  {type.description && (
                    <p className="mt-1 text-xs font-semibold leading-6 text-slate-500">
                      {type.description}
                    </p>
                  )}

                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {type?.frequency?.verified_occurrences !==
                      undefined && (
                      <span className="rounded-full bg-indigo-50 px-3 py-1 text-[10px] font-black text-indigo-700">
                        {type.frequency.verified_occurrences} ظهور
                      </span>
                    )}

                    {years.map((year) => (
                      <span
                        key={year}
                        className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[10px] font-black text-amber-800"
                      >
                        {year}
                      </span>
                    ))}
                  </div>
                </div>

                {open ? (
                  <ChevronUp size={18} />
                ) : (
                  <ChevronDown size={18} />
                )}
              </div>
            </button>

            {open && (
              <QuestionTypeBody type={type} />
            )}
          </article>
        );
      })}
    </div>
  );
}

function QuestionTypeBody({ type }) {
  return (
    <div className="border-t border-indigo-100 bg-white p-4 sm:p-5">
      <div className="grid gap-3 lg:grid-cols-3">
        <DetailsBox
          title="كيف أتعرف عليه؟"
          icon={Search}
          items={arr(type.how_to_recognize)}
        />

        <DetailsBox
          title="طريقة الإجابة"
          icon={CheckCircle2}
          items={arr(type?.method?.steps)}
          numbered
        />

        <DetailsBox
          title="أخطاء يجب تجنبها"
          icon={X}
          items={arr(type.common_mistakes)}
        />
      </div>

      {type?.method?.answer_template && (
        <div className="mt-4 rounded-2xl bg-slate-950 p-4 text-white">
          <p className="text-[10px] font-black text-emerald-300">
            قالب الإجابة
          </p>
          <p className="mt-2 text-sm font-black leading-7">
            {type.method.answer_template}
          </p>
        </div>
      )}
    </div>
  );
}

function QuestionPatternsGrid({ items }) {
  if (!items.length) return null;

  return (
    <div className="grid gap-3 md:grid-cols-2">
      {items.map((item, index) => (
        <div
          key={index}
          className="rounded-2xl border border-slate-200 p-4"
        >
          {item.memory_word && (
            <span className="rounded-full bg-emerald-100 px-3 py-1 text-[10px] font-black text-emerald-900">
              {item.memory_word}
            </span>
          )}

          <h3 className="mt-3 font-black">
            {item.title}
          </h3>

          {(item.trigger || arr(item.signals).length > 0) && (
            <div className="mt-2">
              <p className="text-[10px] font-black text-slate-400">
                كيف أتعرف عليه؟
              </p>

              {item.trigger && (
                <p className="mt-1 text-xs font-bold leading-6 text-slate-500">
                  {item.trigger}
                </p>
              )}

              {arr(item.signals).map((signal, i) => (
                <p
                  key={i}
                  className="mt-1 text-xs font-bold leading-6 text-slate-500"
                >
                  • {textOf(signal)}
                </p>
              ))}
            </div>
          )}

          {(item.answer ||
            item.answer_method) && (
            <div className="mt-3 rounded-xl bg-emerald-50 p-3">
              <p className="text-xs font-black leading-6 text-emerald-950">
                {item.answer || item.answer_method}
              </p>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

/* =========================================================
   RECOGNITION / MISTAKES
========================================================= */

/* =========================================================
   SELF CHECK / QUICK REVIEW
========================================================= */

/* =========================================================
   UI HELPERS
========================================================= */

function PanelHeading({
  icon: Icon,
  eyebrow,
  title,
  subtitle,
}) {
  return (
    <div className="border-b border-slate-100 px-5 py-5 sm:px-7">
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-950 text-white">
          <Icon size={20} />
        </span>

        <div>
          {eyebrow && (
            <p className="text-[10px] font-black text-emerald-700">
              {eyebrow}
            </p>
          )}

          <h2 className="text-xl font-black text-slate-950">
            {title}
          </h2>

          {subtitle && (
            <p className="mt-1 max-w-4xl text-sm font-semibold leading-7 text-slate-500">
              {subtitle}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function PanelHeadingInline({
  icon: Icon,
  title,
  subtitle,
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-900">
        <Icon size={19} />
      </span>

      <div>
        <h2 className="text-lg font-black text-slate-950">
          {title}
        </h2>

        {subtitle && (
          <p className="mt-1 text-xs font-semibold leading-6 text-slate-500">
            {subtitle}
          </p>
        )}
      </div>
    </div>
  );
}

function PointRow({
  text,
  bare = false,
  compact = false,
}) {
  if (!text) return null;

  return (
    <div
      className={cn(
        "flex gap-3",
        bare
          ? "px-1 py-1"
          : compact
          ? "rounded-xl bg-white p-3"
          : "rounded-2xl border border-emerald-100 bg-emerald-50/45 p-4"
      )}
    >
      <CheckCircle2
        size={16}
        className="mt-1 shrink-0 text-emerald-700"
      />
      <p className="text-sm font-bold leading-7 text-slate-700">
        {text}
      </p>
    </div>
  );
}

function EvidenceBox({ evidence }) {
  if (!evidence) return null;

  const text =
    typeof evidence === "string"
      ? evidence
      : evidence.text || "";

  const reference =
    typeof evidence === "object"
      ? evidence.reference
      : "";

  if (!text) return null;

  return (
    <div className="rounded-2xl border border-emerald-100 bg-emerald-50/40 p-4">
      <p className="text-[10px] font-black text-emerald-700">
        الدليل
      </p>
      <p className="mt-2 text-sm font-black leading-8 text-slate-900">
        {text}
      </p>

      {reference && (
        <p className="mt-1 text-[17px] font-black text-emerald-800">
          {reference}
        </p>
      )}
    </div>
  );
}

function TipBox({ children }) {
  if (!children) return null;

  return (
    <div className="mt-4 flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4">
      <Lightbulb
        size={17}
        className="mt-1 shrink-0 text-amber-700"
      />
      <p className="text-sm font-black leading-7 text-amber-950">
        {children}
      </p>
    </div>
  );
}

function MemoryChain({ text }) {
  if (!text) return null;

  return (
    <div className="mt-6 rounded-[26px] bg-[#171918] p-5 text-center text-white">
      <p className="text-[10px] font-black text-emerald-300">
        سلسلة الاسترجاع
      </p>
      <p className="mt-2 text-sm font-black leading-8 sm:text-base">
        {text}
      </p>
    </div>
  );
}

function Connector() {
  return (
    <div className="mx-auto h-8 w-px bg-emerald-300" />
  );
}

function DetailsBox({
  title,
  icon: Icon,
  items,
  numbered = false,
}) {
  const rows = arr(items);

  if (!rows.length) return null;

  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex items-center gap-2">
        <Icon
          size={17}
          className="text-emerald-800"
        />
        <p className="font-black">
          {title}
        </p>
      </div>

      <div className="mt-3 space-y-2">
        {rows.map((item, index) => (
          <div
            key={index}
            className="flex gap-3 rounded-xl bg-white p-3"
          >
            {numbered ? (
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-800 text-[10px] font-black text-white">
                {index + 1}
              </span>
            ) : (
              <CheckCircle2
                size={15}
                className="mt-1 shrink-0 text-emerald-700"
              />
            )}

            <p className="text-xs font-bold leading-6 text-slate-600">
              {textOf(item)}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

/* =========================================================
   PDF ACTIONS / PREVIEW
   Requires:
   npm install html2canvas jspdf
========================================================= */


/* =========================================================
   COMPACT PDF DOCUMENT
   تصميم PDF مستقل عن صفحة الموقع:
   - A4
   - عمودان رأسيان
   - بدون قسم "كيف يأتي هذا المحور في البكالوريا؟"
   - بدون Accordion
========================================================= */

const PdfCompactDocument = forwardRef(
  (
    {
      content,
      axisSummary,
      branches,
      studySections,
      axisId,
    },
    ref
  ) => {
    const pdfSections = buildCompactPdfSections(
      content,
      branches,
      studySections
    );

    const pageGroups = chunkPdfSections(pdfSections);

    return (
      <div
        ref={ref}
        dir="rtl"
        aria-hidden="true"
        className="pointer-events-none fixed left-[-20000px] top-0 z-[-100]"
        style={{
          width: "1120px",
          fontFamily:
            '"Tajawal", "Cairo", "Arial", sans-serif',
        }}
      >
        {pageGroups.map((pageSections, pageIndex) => (
          <PdfCompactPage
            key={pageIndex}
            content={content}
            axisSummary={axisSummary}
            axisId={axisId}
            pageIndex={pageIndex}
            totalPages={pageGroups.length}
            sections={pageSections}
          />
        ))}
      </div>
    );
  }
);

PdfCompactDocument.displayName = "PdfCompactDocument";

function buildCompactPdfSections(content, branches, studySections) {
  const sections = arr(studySections);

  let normalized;

  if (sections.length) {
    normalized = sections.map((section, index) =>
      normalizePdfSection(section, index)
    );
  } else {
    normalized = arr(branches).map((branch, index) =>
      normalizePdfSection(
        {
          id: branch.id,
          title: branch.title,
          intro: branch.explanation,
          points: branch.summaryPoints,
          children: branch.children,
        },
        index
      )
    );
  }

  return sanitizePdfSections(content, normalized);
}

function sanitizePdfSections(content, sections) {
  const axisTag =
    content?.axis_tag ||
    content?.tag ||
    "";

  if (
    axisTag !== "quran_psychological_physical_health" &&
    !String(content?.title || "").includes("الصحة النفسية والجسمية")
  ) {
    return sections;
  }

  // نسخة PDF لمحور الصحة تلتزم بالملخص المدرسي المعتمد.
  // لذلك لا نطبع الأقسام الإضافية التي أُنشئت للتوسيع التعليمي
  // وليست موجودة في ملخص المصدر.
  const excludedSubsectionTitles = new Set([
    "صفات النفس السليمة",
    "أصناف النفس في القرآن",
  ]);

  return sections.map((section) => ({
    ...section,
    subsections: arr(section.subsections).filter(
      (subsection) =>
        !excludedSubsectionTitles.has(
          String(subsection?.title || "").trim()
        )
    ),
  }));
}

function normalizePdfSection(section, index) {
  return {
    id: section?.id || `pdf_section_${index + 1}`,
    title:
      section?.title ||
      section?.name ||
      `القسم ${index + 1}`,
    intro:
      section?.definition ||
      section?.intro ||
      section?.explanation ||
      "",
    points: arr(section?.points),
    items: arr(section?.items),
    children: arr(section?.children),
    subsections: arr(section?.subsections),
    comparisons: arr(section?.comparisons),
    twoSides: arr(section?.two_sides),
    evidence: section?.evidence || null,
  };
}

function pdfSectionWeight(section) {
  let weight = 1;

  weight += arr(section?.points).length * 0.2;
  weight += arr(section?.items).length * 0.28;
  weight += arr(section?.children).length * 0.42;
  weight += arr(section?.subsections).length * 0.7;
  weight += arr(section?.comparisons).length * 0.35;
  weight += arr(section?.twoSides).length * 0.7;

  return weight;
}

function chunkPdfSections(sections) {
  if (!sections.length) return [[]];

  // مع الخط الكبير لا نضع 4 أقسام في A4 واحدة لأن آخر قسم قد يُقصّ
  // (كما حدث مع "القيم الأسرية" في المحور 4).
  // كل صفحة تحمل قسمين: قسم في كل نصف/عمود.
  const pages = [];
  const sectionsPerPage = 2;

  for (let i = 0; i < sections.length; i += sectionsPerPage) {
    pages.push(sections.slice(i, i + sectionsPerPage));
  }

  return pages;
}

function PdfCompactPage({
  content,
  axisSummary,
  axisId,
  pageIndex,
  totalPages,
  sections,
}) {
  const midpoint = Math.ceil(sections.length / 2);
  const rightColumn = sections.slice(0, midpoint);
  const leftColumn = sections.slice(midpoint);

  return (
    <section
      data-pdf-page="true"
      className="relative overflow-hidden bg-white text-slate-950"
      style={{
        width: "1120px",
        height: "1584px",
        padding: "30px 38px 28px",
        boxSizing: "border-box",
      }}
    >
      <PdfPageHeader
        title={content?.axis_title || content?.title}
        axisId={axisId}
      />

      {pageIndex === 0 && (
        <PdfIntroStrip axisSummary={axisSummary} />
      )}

      <div
        className="mt-3 grid grid-cols-2 gap-0"
        style={{
          height: pageIndex === 0 ? "1390px" : "1450px",
          direction: "rtl",
        }}
      >
        <div className="border-l border-slate-300 pl-6 pr-2">
          <PdfColumn sections={rightColumn} />
        </div>

        <div className="pr-6 pl-2">
          <PdfColumn sections={leftColumn} />
        </div>
      </div>

      <div className="absolute bottom-3 left-8 right-8 flex items-center justify-between border-t border-slate-200 pt-2 text-[14px] font-bold text-slate-400">
        <span>
          {pageIndex + 1} / {totalPages}
        </span>
        <span>
          ملخص دروس العلوم الإسلامية
        </span>
      </div>
    </section>
  );
}

function PdfPageHeader({ title, axisId }) {
  return (
    <div className="flex items-center justify-between border-b-2 border-slate-900 pb-3">
      <div>
        <p className="text-[17px] font-black text-emerald-800">
          السنة الثالثة ثانوي - العلوم الإسلامية
        </p>

        <h1 className="mt-1 text-[34px] font-black leading-[1.35] text-slate-950">
          {title}
        </h1>
      </div>

      <div className="rounded-lg bg-[#10382f] px-4 py-2 text-center text-white">
        <p className="text-[16px] font-bold text-emerald-200">
          المحور
        </p>
        <p className="text-[28px] font-black">
          {String(axisId).padStart(2, "0")}
        </p>
      </div>
    </div>
  );
}

function PdfIntroStrip({ axisSummary }) {
  const definition =
    axisSummary?.definition?.content ||
    axisSummary?.central_idea ||
    "";

  if (!definition) return null;

  return (
    <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5">
      <p className="text-[17px] font-black text-emerald-800">
        الفكرة العامة
      </p>
      <p className="mt-1 text-[19px] font-bold leading-9 text-slate-700">
        {definition}
      </p>
    </div>
  );
}

function PdfColumn({ sections }) {
  return (
    <div className="space-y-3">
      {sections.map((section, index) => (
        <PdfCompactSection
          key={section.id || index}
          section={section}
        />
      ))}
    </div>
  );
}

function PdfCompactSection({ section }) {
  return (
    <article className="break-inside-avoid">
      <div className="mb-2 inline-flex bg-sky-100 px-3 py-1.5">
        <h2 className="text-[24px] font-black leading-9 text-slate-950">
          {section.title}
        </h2>
      </div>

      {section.intro && (
        <p className="mb-1.5 text-[18px] font-bold leading-[1.9] text-slate-700">
          {section.intro}
        </p>
      )}

      {arr(section.points).map((point, index) => (
        <PdfBullet
          key={`point-${index}`}
          text={textOf(point)}
        />
      ))}

      {arr(section.items).map((item, index) => (
        <PdfItem
          key={`item-${index}`}
          item={item}
        />
      ))}

      {arr(section.children).map((child, index) => (
        <PdfItem
          key={`child-${index}`}
          item={child}
        />
      ))}

      {arr(section.subsections).map((sub, index) => (
        <div
          key={`sub-${index}`}
          className="mt-2 border-r-2 border-emerald-300 pr-2"
        >
          <p className="text-[19px] font-black leading-8 text-emerald-900">
            {sub.title}
          </p>

          <div className="mt-0.5">
            {arr(sub.items).map((item, itemIndex) => (
              <PdfItem
                key={itemIndex}
                item={item}
                nested
              />
            ))}
          </div>

          {sub.evidence && (
            <PdfEvidence evidence={sub.evidence} />
          )}
        </div>
      ))}

      {arr(section.comparisons).map((comparison, index) => (
        <div
          key={`comparison-${index}`}
          className="mt-1.5 bg-amber-50 px-2 py-1.5"
        >
          <p className="text-[18px] font-black text-amber-900">
            {comparison.a} / {comparison.b}
          </p>
          <p className="mt-0.5 text-[17.5px] font-bold leading-8 text-slate-700">
            {comparison.difference}
          </p>
        </div>
      ))}

      {arr(section.twoSides).map((side, index) => (
        <div key={`side-${index}`} className="mt-1.5">
          <p className="text-[19px] font-black text-emerald-900">
            {side.title}
          </p>

          {side.meaning && (
            <p className="text-[17.5px] font-bold leading-8 text-slate-600">
              {side.meaning}
            </p>
          )}

          {arr(side.items).map((item, itemIndex) => (
            <PdfItem
              key={itemIndex}
              item={item}
              nested
            />
          ))}
        </div>
      ))}

      {section.evidence && (
        <PdfEvidence evidence={section.evidence} />
      )}
    </article>
  );
}

function PdfItem({ item, nested = false }) {
  if (
    item === null ||
    item === undefined ||
    item === ""
  ) {
    return null;
  }

  if (
    typeof item === "string" ||
    typeof item === "number"
  ) {
    return (
      <PdfBullet
        text={String(item)}
        nested={nested}
      />
    );
  }

  const title =
    item.name ||
    item.title ||
    item.label ||
    "";

  const meaning =
    item.definition ||
    item.meaning ||
    item.explanation ||
    item.content ||
    "";

  const points = arr(item.points);

  return (
    <div className={nested ? "mt-1" : "mt-2"}>
      {(title || meaning) && (
        <p className="text-[18px] font-bold leading-[1.9] text-slate-800">
          {title && (
            <span className="font-black text-[#8a3417]">
              {title}:{" "}
            </span>
          )}
          {meaning}
        </p>
      )}

      {points.map((point, index) => (
        <PdfBullet
          key={index}
          text={textOf(point)}
          nested
        />
      ))}

      {item.evidence && (
        <PdfEvidence evidence={item.evidence} />
      )}
    </div>
  );
}

function PdfBullet({ text, nested = false }) {
  if (!text) return null;

  return (
    <div
      className={cn(
        "flex items-start gap-1.5",
        nested ? "mt-1 pr-2" : "mt-1"
      )}
    >
      <span className="mt-[10px] h-2 w-2 shrink-0 rounded-full bg-slate-800" />
      <p className="text-[18px] font-bold leading-[1.9] text-slate-700">
        {text}
      </p>
    </div>
  );
}

function PdfEvidence({ evidence }) {
  const evidenceText =
    typeof evidence === "string"
      ? evidence
      : evidence?.text || "";

  const reference =
    typeof evidence === "object"
      ? evidence?.reference
      : "";

  if (!evidenceText) return null;

  return (
    <div className="mt-1.5 bg-emerald-50 px-2 py-1.5">
      <p className="text-[17px] font-black leading-8 text-emerald-950">
        {evidenceText}
      </p>

      {reference && (
        <p className="mt-0.5 text-[15px] font-black text-emerald-700">
          {reference}
        </p>
      )}
    </div>
  );
}

function PdfActions({ loading, onPreview, onDownload }) {
  return (
    <div
      data-html2canvas-ignore="true"
      className="mb-4 flex flex-wrap items-center justify-end gap-2"
    >
      <button
        type="button"
        onClick={onPreview}
        disabled={loading}
        className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-black text-slate-700 shadow-sm transition hover:border-emerald-300 hover:text-emerald-900 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading ? <Loader2 size={16} className="animate-spin" /> : <Eye size={16} />}
        عرض PDF
      </button>

      <button
        type="button"
        onClick={onDownload}
        disabled={loading}
        className="inline-flex items-center gap-2 rounded-2xl bg-emerald-950 px-4 py-2.5 text-sm font-black text-white shadow-sm transition hover:bg-emerald-900 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading ? <Loader2 size={16} className="animate-spin" /> : <FileDown size={16} />}
        تحميل PDF
      </button>
    </div>
  );
}

function PdfPreviewModal({ url, title, onClose }) {
  if (!url) return null;

  return (
    <div
      data-html2canvas-ignore="true"
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/70 p-3 backdrop-blur-sm sm:p-6"
    >
      <div className="flex h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-[28px] bg-white shadow-2xl">
        <div className="flex items-center justify-between gap-4 border-b border-slate-200 px-4 py-3 sm:px-5">
          <div className="min-w-0">
            <p className="text-[10px] font-black text-emerald-700">معاينة الملخص PDF</p>
            <h3 className="truncate text-sm font-black text-slate-900 sm:text-base">{title}</h3>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600 transition hover:bg-slate-200"
            aria-label="إغلاق معاينة PDF"
          >
            <X size={18} />
          </button>
        </div>

        <iframe
          title={`PDF - ${title || "ملخص المحور"}`}
          src={url}
          className="min-h-0 flex-1 bg-slate-100"
        />
      </div>
    </div>
  );
}

/* =========================================================
   STATES / FOOTER
========================================================= */

function LoadingState() {
  return (
    <div
      dir="rtl"
      className="flex min-h-[520px] items-center justify-center bg-[#f7f8f6]"
    >
      <div className="text-center">
        <Loader2
          className="mx-auto animate-spin text-emerald-800"
          size={34}
        />
        <p className="mt-4 text-sm font-black text-slate-700">
          جاري تحميل ملخص المحور...
        </p>
      </div>
    </div>
  );
}

function ErrorState({ message, onRetry }) {
  return (
    <div
      dir="rtl"
      className="flex min-h-[520px] items-center justify-center bg-[#f7f8f6] p-4"
    >
      <div className={`${CARD} max-w-lg p-6 text-center`}>
        <AlertCircle
          className="mx-auto text-rose-600"
          size={36}
        />

        <p className="mt-4 font-black text-slate-900">
          {message}
        </p>

        <button
          type="button"
          onClick={onRetry}
          className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-emerald-950 px-5 py-3 text-sm font-black text-white"
        >
          <RefreshCcw size={16} />
          إعادة المحاولة
        </button>
      </div>
    </div>
  );
}

function Footer({ title, axisId }) {
  return (
    <footer className="mt-6 pb-5 text-center">
      <p className="text-[14px] font-bold text-slate-400">
        المحور {axisId} • {title}
      </p>
    </footer>
  );
}
