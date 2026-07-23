// src/pages/SubjectsPage.jsx

import {
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import axios from "axios";
import {
  Atom,
  Beaker,
  Binary,
  BookOpen,
  Brain,
  Calculator,
  Code2,
  FlaskConical,
  Globe2,
  Languages,
  Microscope,
  Pi,
  Sigma,
} from "lucide-react";

import CategoryFilters from "../components/dashboard/CategoryFilters";
import SubjectCard from "../components/dashboard/SubjectCard";

import { subjectCategories } from "../data/subjectsData";
import { UserContext } from "../Utils/UserContext";
const COURSE_URL = import.meta.env.VITE_COURSE_URL;
const URL_GET_SUBJECTS = `${COURSE_URL}subjects/my-branch/`;

const iconMap = {
  Calculator,
  BookOpen,
  Atom,
  Beaker,
  Binary,
  Brain,
  Code2,
  FlaskConical,
  Globe2,
  Languages,
  Microscope,
  Pi,
  Sigma,
};

export default function SubjectsPage() {
  const { token } = useContext(UserContext);

  const [subjects, setSubjects] = useState([]);
  const [activeCategory, setActiveCategory] =
    useState("all");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const getSubjects = async () => {
      if (!token) {
        setSubjects([]);
        setError("يجب تسجيل الدخول لعرض المواد.");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError("");

        const response = await axios.get(
          URL_GET_SUBJECTS,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        const apiSubjects = Array.isArray(
          response.data?.subjects
        )
          ? response.data.subjects
          : [];

        /*
         * نحول بيانات Django إلى نفس البنية القديمة
         * التي يستعملها SubjectCard،
         * حتى لا يتغير التصميم.
         */
        const formattedSubjects = apiSubjects.map(
          (subject) => ({
            id: subject.id,

            code: subject.code,

            /*
             * API يرجع name
             * والتصميم القديم يستعمل title
             */
            title: subject.name,

            description:
              subject.description || "",

            theme:
              subject.theme || "purple",

            /*
             * API يرجع اسم الأيقونة كنص:
             * "Calculator"
             */
            icon:
              iconMap[subject.icon] ||
              BookOpen,

            /*
             * هذه القيم غير موجودة حالياً في API.
             * نضع قيماً افتراضية فقط للمحافظة
             * على التصميم القديم.
             */
            progress:
              Number(subject.progress) || 0,

            lessons:
              Number(subject.lessons) || 0,

            exercises:
              Number(subject.exercises) || 0,

            /*
             * إن لم يرجع API المسار،
             * يتم إنشاؤه باستعمال id.
             */
            path:
              subject.path ||
              `/subjects/${subject.id}`,

            /*
             * عند عدم وجود category في API،
             * تظهر المادة داخل تصنيف "الكل".
             */
            category:
              subject.category || "all",
          })
        );

        setSubjects(formattedSubjects);
      } catch (requestError) {
        console.error(
          "Error getting subjects:",
          requestError
        );

        setSubjects([]);

        if (
          requestError.response?.status === 401
        ) {
          setError(
            "انتهت صلاحية تسجيل الدخول."
          );
        } else if (
          requestError.response?.status === 403
        ) {
          setError(
            "ليس لديك صلاحية لعرض المواد."
          );
        } else if (
          requestError.response?.data?.message
        ) {
          setError(
            requestError.response.data.message
          );
        } else if (
          requestError.response?.data?.detail
        ) {
          setError(
            requestError.response.data.detail
          );
        } else {
          setError(
            "حدث خطأ أثناء تحميل المواد."
          );
        }
      } finally {
        setLoading(false);
      }
    };

    getSubjects();
  }, [token]);

  const filteredSubjects = useMemo(() => {
    if (activeCategory === "all") {
      return subjects;
    }

    return subjects.filter(
      (subject) =>
        subject.category === activeCategory
    );
  }, [subjects, activeCategory]);

  return (
    <main
      dir="rtl"
      className="
        h-full overflow-y-auto
        bg-[#fafbff] px-4 py-7
        sm:px-6 lg:px-9
      "
    >
      <div className="mx-auto max-w-[1450px]">
        {/* Page title */}
        <div className="mb-6 flex items-start gap-3">
          <div className="mt-1 text-violet-600">
            <BookOpen size={31} />
          </div>

          <div>
            <h1 className="text-2xl font-extrabold text-slate-900">
              المواد
            </h1>

            <p className="mt-2 text-sm font-medium text-slate-600">
              استكشف جميع المواد المتاحة وتعلم ما تحب
            </p>
          </div>
        </div>

        <CategoryFilters
          categories={subjectCategories}
          activeCategory={activeCategory}
          onChange={setActiveCategory}
        />

        {loading && (
          <div className="mt-10 rounded-2xl bg-white p-12 text-center shadow-soft">
            <p className="font-bold text-slate-600">
              جاري تحميل المواد...
            </p>
          </div>
        )}

        {!loading && error && (
          <div className="mt-10 rounded-2xl bg-white p-12 text-center shadow-soft">
            <p className="font-bold text-red-600">
              {error}
            </p>
          </div>
        )}

        {!loading && !error && (
          <>
            <section
              className="
                mt-5 grid gap-4
                sm:grid-cols-2
                xl:grid-cols-3
                2xl:grid-cols-4
              "
            >
              {filteredSubjects.map(
                (subject) => (
                  <SubjectCard
                    key={subject.id}
                    subject={subject}
                  />
                )
              )}
            </section>

            {filteredSubjects.length === 0 && (
              <div className="mt-10 rounded-2xl bg-white p-12 text-center shadow-soft">
                <p className="font-bold text-slate-600">
                  لا توجد مواد في هذا التصنيف حالياً
                </p>
              </div>
            )}
          </>
        )}

        {/* <LearningPathBanner /> */}
      </div>
    </main>
  );
}