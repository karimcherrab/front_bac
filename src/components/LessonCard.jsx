import { useContext, useEffect, useState } from "react";
import axios from "axios";

import StepTabs from "./StepTabs";
import IntroStep from "./IntroStep";
import QuestionBac from "./QuestionBac";
import GeneratedAIExercises from "./Questions/Generate_question";
import BacChapterExercises from "./Questions/BacChapterExercises";

import StepNavFooter from "./StepNavFooter";

import { lessonSteps } from "../data/lessonData";
import { UserContext } from "../Utils/UserContext";

const API_BASE_URL = import.meta.env.VITE_COURSE_URL;

function parseMaybeJson(value) {
  if (value === null || value === undefined || value === "") {
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

function getErrorMessage(error, defaultMessage) {
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

export default function LessonCard() {
  const { current_axis, token , setActiveId , activeId } = useContext(UserContext);

  // const [activeId, setActiveId] = useState("intro");


  const [coursByAxis, setCoursByAxis] = useState({});
  const [questionsByAxis, setQuestionsByAxis] = useState({});

  /*
   * نفصل تحميل الدرس عن تحميل التمارين حتى لا يتعارضا.
   */
  const [loadingCourse, setLoadingCourse] = useState(false);
  const [loadingQuestions, setLoadingQuestions] = useState(false);

  const [courseError, setCourseError] = useState("");
  const [questionsError, setQuestionsError] = useState("");

  const axisId = current_axis?.id;
  const axisTag = current_axis?.tag;

  const cour = axisId ? coursByAxis[axisId] : null;

  /*
   * questionBac هو كائن كامل وليس مصفوفة.
   */
  const questionBac = axisId
    ? questionsByAxis[axisId]
    : null;

  const questions = Array.isArray(questionBac?.questions)
    ? questionBac.questions
    : [];

  useEffect(() => {
    if (!axisId) return;

    if (activeId === "intro" && !coursByAxis[axisId]) {
      getCour(axisId, axisTag);
    }

    if (
      activeId === "question_bac" &&
      !questionsByAxis[axisId]
    ) {
      getQuestionBac(axisId);
    }

    // if (activeId === "question_generate" ) {
    //   getCour(axisId, axisTag);
    // }


  }, [
    activeId,
    axisId,
    axisTag,
    token,
    coursByAxis,
    questionsByAxis,
  ]);

  async function getCour(selectedAxisId, selectedAxisTag) {
    if (!selectedAxisId) return;

    try {
      setLoadingCourse(true);
      setCourseError("");

      const response = await axios.get(
        `${API_BASE_URL}axes/${selectedAxisId}/`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      console.log("بيانات الدرس:", response.data);

 
       console.log("bbbbbbbbbbbbbbbbbb")
      console.log(response)
      const rawCourse =response.data;

      const parsedCourse = parseMaybeJson(rawCourse);
      console.log("aaaaaaaaaaaaaaaaaaaaaa")
      console.log(parsedCourse)
      setCoursByAxis((previous) => ({
        ...previous,
        [selectedAxisId]: parsedCourse,
      }));
    } catch (error) {
      console.error("خطأ تحميل الدرس:", error);

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

  async function getQuestionBac(selectedAxisId) {
    if (!selectedAxisId) return;

    try {
      setLoadingQuestions(true);
      setQuestionsError("");

      const response = await axios.get(
        `${API_BASE_URL}axes/${selectedAxisId}/questions/`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      console.log(
        "الاستجابة الكاملة للتمارين:",
        response
      );

      console.log(
        "بيانات تمارين البكالوريا:",
        response.data
      );

      console.log(
        "الأسئلة:",
        response.data?.questions
      );

      /*
       * نحفظ response.data كاملًا.
       *
       * لا نحفظ response وحده.
       * لا نحفظ response.data.questions فقط،
       * لأن مكوّن QuestionBac يحتاج أيضًا axis و count.
       */
      const normalizedData = {
        axis:
          response.data?.axis ||
          current_axis ||
          null,

        count:
          response.data?.count ??
          response.data?.questions?.length ??
          0,

        filters:
          response.data?.filters || {},

        questions: Array.isArray(
          response.data?.questions
        )
          ? response.data.questions
          : Array.isArray(response.data)
            ? response.data
            : [],
      };

      setQuestionsByAxis((previous) => ({
        ...previous,
        [selectedAxisId]: normalizedData,
      }));
    } catch (error) {
      console.error("خطأ تحميل التمارين:", error);

      setQuestionsError(
        getErrorMessage(
          error,
          "حدث خطأ أثناء تحميل التمارين."
        )
      );
    } finally {
      setLoadingQuestions(false);
    }
  }

  function retryCurrentSection() {
    if (!axisId) return;

    if (activeId === "intro") {
      setCoursByAxis((previous) => {
        const next = { ...previous };
        delete next[axisId];
        return next;
      });

      getCour(axisId, axisTag);
      return;
    }

    if (activeId === "question_bac") {
      setQuestionsByAxis((previous) => {
        const next = { ...previous };
        delete next[axisId];
        return next;
      });

      getQuestionBac(axisId);
    }
  }

  function renderLoading(message) {
    return (
      <div
        dir="rtl"
        className="flex min-h-[320px] flex-col items-center justify-center gap-4 p-8 text-center"
      >
        <div className="h-11 w-11 animate-spin rounded-full border-4 border-slate-200 border-t-blue-600" />

        <p className="font-bold text-slate-600">
          {message}
        </p>
      </div>
    );
  }

  function renderError(message) {
    return (
      <div
        dir="rtl"
        className="flex min-h-[320px] items-center justify-center p-6"
      >
        <div className="w-full max-w-lg rounded-3xl border border-red-200 bg-red-50 p-6 text-center">
          <h3 className="text-lg font-black text-red-800">
            تعذر تحميل البيانات
          </h3>

          <p className="mt-2 font-medium leading-7 text-red-700">
            {message}
          </p>

          <button
            type="button"
            onClick={retryCurrentSection}
            className="mt-5 rounded-xl bg-red-600 px-5 py-2.5 font-bold text-white transition hover:bg-red-700"
          >
            إعادة المحاولة
          </button>
        </div>
      </div>
    );
  }

  function renderEmpty(title, description) {
    return (
      <div
        dir="rtl"
        className="flex min-h-[320px] items-center justify-center p-6"
      >
        <div className="w-full max-w-lg rounded-3xl border border-slate-200 bg-slate-50 p-7 text-center">
          <h3 className="text-xl font-black text-slate-800">
            {title}
          </h3>

          <p className="mt-2 font-medium leading-7 text-slate-500">
            {description}
          </p>
        </div>
      </div>
    );
  }

  function renderContent() {
    if (!axisId) {
      return renderEmpty(
        "لم يتم اختيار محور",
        "اختر محورًا من القائمة لعرض الدرس وتمارين البكالوريا."
      );
    }

    if (activeId === "intro") {
      if (loadingCourse && !cour) {
        return renderLoading("جاري تحميل الدرس...");
      }

      if (courseError) {
        return renderError(courseError);
      }

      if (!cour) {
        return renderEmpty(
          "لا يوجد درس حاليًا",
          "لم يتم العثور على محتوى درس خاص بهذا المحور."
        );
      }

      return <IntroStep data={cour}  axisId={axisId} />;
    }

    if (activeId === "question_bac") {
      if (loadingQuestions && !questionBac) {
        return renderLoading(
          "جاري تحميل تمارين البكالوريا..."
        );
      }

      if (questionsError) {
        return renderError(questionsError);
      }

    
      if (!questionBac || questions.length === 0) {
        return renderEmpty(
          "لا توجد تمارين",
          "لا توجد تمارين بكالوريا مرتبطة بهذا المحور حاليًا."
        );
      }


      return (
        <QuestionBac
          key={`questions-axis-${axisId}`}
          data={questionBac}
          
        />
      );
    }


        if (activeId === "question_generate") {
              return (
        <GeneratedAIExercises
     axisId = {axisId}
         data={cour}
          
        />
      );
        }


       if (activeId === "bac") {
              return (
        <BacChapterExercises
            chapterId={1}
          
        />
      );
        }


        

    return null;
  }

  return (
    <div
      dir="rtl"
      className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-card"
    >
       {
        activeId !== "bac" ?   <StepTabs
        steps={lessonSteps}
        activeId={activeId}
        onSelect={setActiveId}
      /> : <div></div>
       }
    

      {renderContent()}
{/* 
      <StepNavFooter
        onNext={() =>
          console.log("الانتقال إلى المرحلة التالية")
        }
        onSkip={() =>
          console.log("تخطي الشرح")
        }
      /> */}
    </div>
  );
}