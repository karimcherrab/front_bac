import { useContext, useEffect, useState } from "react";
import axios from "axios";

import StepTabs from "./StepTabs";

import IntroStep from "./IntroStep";
// import IntroStep from "./module/CivilEngineeringLesson";
// import IntroStep from "./module/ScienceLesson";
import ScienceLesson from "./module/ScienceLesson";

import HistoryStoryLesson from "./module/HistoryStoryLesson";
import IslamicLesson from "./module/IslamicLesson";

import QuestionBac from "./QuestionBac";
import GeneratedAIExercises from "./Questions/Generate_question";
import BacChapterExercises from "./Questions/BacChapterExercises";

import BacIslamic from "./Questions/BacIslamic";
import GeneratedBacExercisesPage from "./Questions/GeneratedBacExercisesPage";

import AxisRevisionPage from "./module/AdaptiveAssessment";

import { lessonSteps } from "../data/lessonData";
import { UserContext } from "../Utils/UserContext";
import { useTutorPageContext } from "../Utils/TutorPageContext";

import {
  useLocation,
  useParams,
} from "react-router-dom";

const API_BASE_URL = import.meta.env.VITE_COURSE_URL;


// =====================================================
// Parse JSON
// =====================================================

function parseMaybeJson(value) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return null;
  }

  if (typeof value === "object") {
    return value;
  }

  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}


// =====================================================
// Error message
// =====================================================

function getErrorMessage(
  error,
  defaultMessage
) {
  if (error?.code === "ERR_NETWORK") {
    return "تعذر الاتصال بالخادم. تأكد من تشغيل Django.";
  }

  if (error?.response?.status === 401) {
    return "انتهت صلاحية تسجيل الدخول. سجّل الدخول من جديد.";
  }

  if (error?.response?.status === 404) {
    return "لم يتم العثور على بيانات هذا المحور.";
  }

  return (
    error?.response?.data?.detail ||
    error?.response?.data?.message ||
    defaultMessage
  );
}


// =====================================================
// Normaliser le nom de matière
// =====================================================

function normalizeCourseName(value = "") {
  return String(value)
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[إأآ]/g, "ا")
    .replace(/ى/g, "ي");
}


// =====================================================
// Détecter matière islamique
// =====================================================

function isIslamicCourse(courseName) {
  const name = normalizeCourseName(
    courseName
  );

  return (
    name.includes("اسلام") ||
    name.includes("شريعة") ||
    name.includes("تربية اسلامية") ||
    name.includes("علوم اسلامية")
  );
}


// =====================================================
// Détecter Histoire
// =====================================================

function isHistoryCourse(courseName) {
  const name = normalizeCourseName(
    courseName
  );

  return (
    name === "التاريخ" ||
    name === "تاريخ" ||
    name.includes("التاريخ")
  );
}


// =====================================================
// Détecter Sciences
// =====================================================

function isScienceCourse(courseName) {
  const name = normalizeCourseName(
    courseName
  );

  return (
    name === "علوم تجريبية" ||
    name === "العلوم التجريبية"
  );
}


// =====================================================
// LessonCard
// =====================================================

export default function LessonCard() {
  const {
    current_axis,
    token,
    setActiveId,
    activeId,
    user,
  } = useContext(UserContext);

  const { id_chapter } = useParams();

  const location = useLocation();

  const {
    setAxisContext,
    setSectionContext,
    setExerciseContext,
    setQuestionContext,
    setStepContext,
    setViewState,
    capturePointerContext,
    captureSelectionContext,
  } = useTutorPageContext();


  // =====================================================
  // Nom matière envoyé avec navigate()
  // =====================================================

  const courseName =
    location.state?.courseName || "";

  // اسم المادة قد يضيع عند تحديث الصفحة لأن location.state غير دائم.
  // لذلك نحاول أيضا قراءته من بيانات المحور/الدرس إن كانت موجودة.
  const resolvedCourseName =
    courseName ||
    current_axis?.course_name ||
    current_axis?.course?.name ||
    current_axis?.chapter?.course?.name ||
    "";

  console.log(
    "Course name :",
    resolvedCourseName
  );


  // =====================================================
  // States
  // =====================================================

  const [
    coursByAxis,
    setCoursByAxis,
  ] = useState({});

  const [
    questionsByAxis,
    setQuestionsByAxis,
  ] = useState({});

  const [
    loadingCourse,
    setLoadingCourse,
  ] = useState(false);

  const [
    loadingQuestions,
    setLoadingQuestions,
  ] = useState(false);

  const [
    courseError,
    setCourseError,
  ] = useState("");

  const [
    questionsError,
    setQuestionsError,
  ] = useState("");


  // =====================================================
  // Current axis
  // =====================================================

  const axisId =
    current_axis?.id;

  const axisTag =
    current_axis?.tag;


  const cour = axisId
    ? coursByAxis[axisId]
    : null;


  const questionBac = axisId
    ? questionsByAxis[axisId]
    : null;


  const questions = Array.isArray(
    questionBac?.questions
  )
    ? questionBac.questions
    : [];


  // =====================================================
  // Synchroniser le contexte du tuteur
  // =====================================================

  useEffect(() => {
    setAxisContext(
      current_axis
        ? {
            id: current_axis.id,
            tag: current_axis.tag || "",
            title: current_axis.title || "",
          }
        : null
    );
  }, [
    axisId,
    axisTag,
    current_axis?.title,
    setAxisContext,
  ]);

  useEffect(() => {
    const sectionTitles = {
      intro: "الشرح",
      resume: "مراجعة المحور",
      question_bac: "تمارين البكالوريا",
      question_generate: "تمارين مولدة بالذكاء الاصطناعي",
      bac: "تمارين بكالوريا الفصل",
      "generete-bac": "تمارين شبيهة بالبكالوريا",
    };

    setSectionContext({
      id: activeId || "",
      title: sectionTitles[activeId] || "",
    });
  }, [activeId, setSectionContext]);


  // =====================================================
  // Chargement selon onglet
  // =====================================================

  useEffect(() => {
    if (!axisId) return;

    // ==========================
    // Cours
    // ==========================

    if (
      activeId === "intro" &&
      !coursByAxis[axisId]
    ) {
      getCour(
        axisId,
        axisTag
      );
    }


    // ==========================
    // Questions BAC
    // ==========================

    if (
      activeId === "question_bac" &&
      !questionsByAxis[axisId]
    ) {
      getQuestionBac(
        axisId
      );
    }
  }, [
    activeId,
    axisId,
    axisTag,
    token,
    coursByAxis,
    questionsByAxis,
  ]);


  // =====================================================
  // Charger le cours
  // =====================================================

  async function getCour(
    selectedAxisId,
    selectedAxisTag
  ) {
    if (!selectedAxisId) {
      return;
    }

    try {
      setLoadingCourse(true);

      setCourseError("");


      const response =
        await axios.get(
          `${API_BASE_URL}axes/${selectedAxisId}/`,
          {
            headers: {
              Authorization:
                `Bearer ${token}`,
            },
          }
        );


      console.log(
        "بيانات الدرس:",
        response.data
      );


      const rawCourse =
        response.data;


      const parsedCourse =
        parseMaybeJson(
          rawCourse
        );


      setCoursByAxis(
        (previous) => ({
          ...previous,

          [selectedAxisId]:
            parsedCourse,
        })
      );
    } catch (error) {
      console.error(
        "خطأ تحميل الدرس:",
        error
      );


      setCourseError(
        getErrorMessage(
          error,
          "حدث خطأ أثناء تحميل الدرس."
        )
      );
    } finally {
      setLoadingCourse(false);
    }
  }


  // =====================================================
  // Charger Questions BAC
  // =====================================================

  async function getQuestionBac(
    selectedAxisId
  ) {
    if (!selectedAxisId) {
      return;
    }

    try {
      setLoadingQuestions(true);

      setQuestionsError("");


      const response =
        await axios.get(
          `${API_BASE_URL}axes/${selectedAxisId}/questions/`,
          {
            headers: {
              Authorization:
                `Bearer ${token}`,
            },
          }
        );


      console.log(
        "بيانات تمارين البكالوريا:",
        response.data
      );


      const normalizedData = {
        axis:
          response.data?.axis ||
          current_axis ||
          null,

        count:
          response.data?.count ??
          response.data
            ?.questions
            ?.length ??
          0,

        filters:
          response.data?.filters ||
          {},

        questions:
          Array.isArray(
            response.data
              ?.questions
          )
            ? response.data
                .questions
            : Array.isArray(
                  response.data
                )
              ? response.data
              : [],
      };


      setQuestionsByAxis(
        (previous) => ({
          ...previous,

          [selectedAxisId]:
            normalizedData,
        })
      );
    } catch (error) {
      console.error(
        "خطأ تحميل التمارين:",
        error
      );


      setQuestionsError(
        getErrorMessage(
          error,
          "حدث خطأ أثناء تحميل التمارين."
        )
      );
    } finally {
      setLoadingQuestions(
        false
      );
    }
  }


  // =====================================================
  // Retry
  // =====================================================

  function retryCurrentSection() {
    if (!axisId) return;


    // ===================================================
    // Retry cours
    // ===================================================

    if (
      activeId === "intro"
    ) {
      setCoursByAxis(
        (previous) => {
          const next = {
            ...previous,
          };

          delete next[
            axisId
          ];

          return next;
        }
      );


      getCour(
        axisId,
        axisTag
      );

      return;
    }


    // ===================================================
    // Retry questions BAC
    // ===================================================

    if (
      activeId ===
      "question_bac"
    ) {
      setQuestionsByAxis(
        (previous) => {
          const next = {
            ...previous,
          };

          delete next[
            axisId
          ];

          return next;
        }
      );


      getQuestionBac(
        axisId
      );
    }
  }


  // =====================================================
  // Loading
  // =====================================================

  function renderLoading(
    message
  ) {
    return (
      <div
        dir="rtl"
        className="
          flex
          min-h-[320px]
          flex-col
          items-center
          justify-center
          gap-4
          p-8
          text-center
        "
      >
        <div
          className="
            h-11
            w-11
            animate-spin
            rounded-full
            border-4
            border-slate-200
            border-t-blue-600
          "
        />

        <p
          className="
            font-bold
            text-slate-600
          "
        >
          {message}
        </p>
      </div>
    );
  }


  // =====================================================
  // Error
  // =====================================================

  function renderError(
    message
  ) {
    return (
      <div
        dir="rtl"
        className="
          flex
          min-h-[320px]
          items-center
          justify-center
          p-6
        "
      >
        <div
          className="
            w-full
            max-w-lg
            rounded-3xl
            border
            border-red-200
            bg-red-50
            p-6
            text-center
          "
        >
          <h3
            className="
              text-lg
              font-black
              text-red-800
            "
          >
            تعذر تحميل البيانات
          </h3>

          <p
            className="
              mt-2
              font-medium
              leading-7
              text-red-700
            "
          >
            {message}
          </p>

          <button
            type="button"
            onClick={
              retryCurrentSection
            }
            className="
              mt-5
              rounded-xl
              bg-red-600
              px-5
              py-2.5
              font-bold
              text-white
              transition
              hover:bg-red-700
            "
          >
            إعادة المحاولة
          </button>
        </div>
      </div>
    );
  }


  // =====================================================
  // Empty
  // =====================================================

  function renderEmpty(
    title,
    description
  ) {
    return (
      <div
        dir="rtl"
        className="
          flex
          min-h-[320px]
          items-center
          justify-center
          p-6
        "
      >
        <div
          className="
            w-full
            max-w-lg
            rounded-3xl
            border
            border-slate-200
            bg-slate-50
            p-7
            text-center
          "
        >
          <h3
            className="
              text-xl
              font-black
              text-slate-800
            "
          >
            {title}
          </h3>

          <p
            className="
              mt-2
              font-medium
              leading-7
              text-slate-500
            "
          >
            {description}
          </p>
        </div>
      </div>
    );
  }


  // =====================================================
  // Render Lesson
  // =====================================================

  function renderLesson() {
    // ===================================================
    // علوم تجريبية
    // ===================================================

    if (
      isScienceCourse(
        resolvedCourseName
      )
    ) {
      return (
        <ScienceLesson
          key={
            `science-${axisId}`
          }
          data={cour}
          axisId={axisId}
        />
      );
    }


    // ===================================================
    // العلوم الإسلامية
    // ===================================================

    if (
      isIslamicCourse(
        resolvedCourseName
      )
    ) {
      return (
        <IslamicLesson
          key={
            `islamic-${axisId}`
          }
          data={cour}
          axisId={axisId}
        />
      );
    }


    // ===================================================
    // التاريخ
    // ===================================================

    if (
      isHistoryCourse(
        resolvedCourseName
      )
    ) {
      return (
        <HistoryStoryLesson
          key={
            `history-${axisId}`
          }
          data={cour}
          axisId={axisId}
        />
      );
    }


    // ===================================================
    // جميع المواد الأخرى
    // ===================================================

    return (
      <IntroStep
        key={
          `intro-${axisId}`
        }
        data={cour}
        axisId={axisId}
      />
    );
  }


  // =====================================================
  // Render Content
  // =====================================================

  function renderContent() {
    // ===================================================
    // Pas d'axe
    // ===================================================

    if (!axisId) {
      return renderEmpty(
        "لم يتم اختيار محور",
        "اختر محورًا من القائمة لعرض الدرس وتمارين البكالوريا."
      );
    }


    // ===================================================
    // COURS
    // ===================================================

    if (
      activeId === "intro"
    ) {
      if (
        loadingCourse &&
        !cour
      ) {
        return renderLoading(
          "جاري تحميل الدرس..."
        );
      }


      if (courseError) {
        return renderError(
          courseError
        );
      }


      if (!cour) {
        return renderEmpty(
          "لا يوجد درس حاليًا",
          "لم يتم العثور على محتوى درس خاص بهذا المحور."
        );
      }


      // =================================================
      // Sélection automatique du composant
      // =================================================

      return renderLesson();
    }


    // ===================================================
    // Résumé
    // ===================================================

    if (
      activeId === "resume"
    ) {
      return (
        <AxisRevisionPage
          axisId={axisId}
          onTutorExerciseChange={
            setExerciseContext
          }
          onTutorQuestionChange={
            setQuestionContext
          }
          onTutorStepChange={
            setStepContext
          }
          onTutorViewStateChange={
            setViewState
          }
        />
      );
    }


    // ===================================================
    // Questions BAC
    // ===================================================

    if (
      activeId ===
      "question_bac"
    ) {
      if (
        loadingQuestions &&
        !questionBac
      ) {
        return renderLoading(
          "جاري تحميل تمارين البكالوريا..."
        );
      }


      if (
        questionsError
      ) {
        return renderError(
          questionsError
        );
      }


      if (
        !questionBac ||
        questions.length === 0
      ) {
        return renderEmpty(
          "لا توجد تمارين",
          "لا توجد تمارين بكالوريا مرتبطة بهذا المحور حاليًا."
        );
      }


      return (
        <QuestionBac
          key={
            `questions-axis-${axisId}`
          }
          data={
            questionBac
          }
          onTutorExerciseChange={
            setExerciseContext
          }
          onTutorQuestionChange={
            setQuestionContext
          }
          onTutorStepChange={
            setStepContext
          }
          onTutorViewStateChange={
            setViewState
          }
        />
      );
    }


    // ===================================================
    // Exercices AI
    // ===================================================

    if (
      activeId ===
      "question_generate"
    ) {
      return (
        <GeneratedAIExercises
          axisId={axisId}
          data={cour}
          onTutorExerciseChange={
            setExerciseContext
          }
          onTutorQuestionChange={
            setQuestionContext
          }
          onTutorStepChange={
            setStepContext
          }
          onTutorViewStateChange={
            setViewState
          }
        />
      );
    }


    // ===================================================
    // Exercices BAC chapitre
    // ===================================================

    if (
      activeId === "bac"
    ) {
      // =================================================
      // العلوم الإسلامية + التاريخ:
      // عرض نصي مخصص للبكالوريا.
      // باقي المواد:
      // نبقي BacChapterExercises كما هو.
      // =================================================

      const useTextualBac =
        isIslamicCourse(resolvedCourseName) ||
        isHistoryCourse(resolvedCourseName);

      if (useTextualBac) {
        return (
          <BacIslamic
            key={`textual-bac-${id_chapter}-${resolvedCourseName}`}
            chapterId={id_chapter}
            courseName={resolvedCourseName}
            onTutorExerciseChange={
              setExerciseContext
            }
            onTutorQuestionChange={
              setQuestionContext
            }
            onTutorStepChange={
              setStepContext
            }
            onTutorViewStateChange={
              setViewState
            }
          />
        );
      }

      return (
        <BacChapterExercises
          key={`bac-chapter-${id_chapter}`}
          chapterId={
            id_chapter
          }
          onTutorExerciseChange={
            setExerciseContext
          }
          onTutorQuestionChange={
            setQuestionContext
          }
          onTutorStepChange={
            setStepContext
          }
          onTutorViewStateChange={
            setViewState
          }
        />
      );
    }


    // ===================================================
    // BAC généré
    // ===================================================

    if (
      activeId ===
      "generete-bac"
    ) {
      return (
        <GeneratedBacExercisesPage
          chapterId={
            id_chapter
          }
          branchCode={
            user?.branch?.code
          }
          onTutorExerciseChange={
            setExerciseContext
          }
          onTutorQuestionChange={
            setQuestionContext
          }
          onTutorStepChange={
            setStepContext
          }
          onTutorViewStateChange={
            setViewState
          }
        />
      );
    }


    return null;
  }


  // =====================================================
  // Main
  // =====================================================

  return (
    <div
      dir="rtl"
      onPointerDownCapture={capturePointerContext}
      onMouseUpCapture={captureSelectionContext}
      onKeyUpCapture={captureSelectionContext}
      className="
        overflow-hidden
        rounded-3xl
        border
        border-slate-200
        bg-white
        shadow-card
      "
    >
      {activeId !== "bac" && activeId !== "generete-bac" && !(isIslamicCourse(resolvedCourseName) || isHistoryCourse(resolvedCourseName))  ? (
        <StepTabs
          steps={
            lessonSteps
          }
          activeId={
            activeId
          }
          onSelect={
            setActiveId
          }
        />
      ) : (
        <div />
      )}

      {renderContent()}
    </div>
  );
}