import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";

const TutorPageContext = createContext(null);

const SECTION_LABELS = {
  intro: "الشرح",
  resume: "مراجعة المحور",
  question_bac: "تمارين البكالوريا",
  question_generate: "تمارين مولدة بالذكاء الاصطناعي",
  bac: "تمارين بكالوريا الفصل",
  "generete-bac": "تمارين شبيهة بالبكالوريا",
};

function trimText(value, limit = 5000) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, limit);
}

function safeId(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  return value;
}

function getClosestContextBlock(target) {
  if (!(target instanceof Element)) return null;

  return target.closest(
    [
      "[data-tutor-context]",
      "[data-tutor-exercise-id]",
      "[data-tutor-step-id]",
      "[data-question-id]",
      "[data-exercise-id]",
      "article",
      "section",
    ].join(","),
  );
}

export function TutorPageProvider({
  children,
  chapterId,
  chapterTitle = "الدرس الحالي",
}) {
  const [pageContext, setPageContextState] = useState({
    chapter_id: Number(chapterId) || 0,
    chapter_title: chapterTitle,
    axis_id: null,
    axis_tag: "",
    axis_title: "",
    section_id: "",
    section_title: "",
    exercise: null,
    step: null,
    selection: "",
    visible_block: "",
  });

  const setPageContext = useCallback((patch) => {
    setPageContextState((previous) => ({
      ...previous,
      ...(typeof patch === "function" ? patch(previous) : patch),
    }));
  }, []);

  const setAxisContext = useCallback((axis) => {
    setPageContextState((previous) => ({
      ...previous,
      axis_id: safeId(axis?.id),
      axis_tag: axis?.tag || "",
      axis_title: axis?.title || "",
      exercise: null,
      step: null,
      selection: "",
      visible_block: "",
    }));
  }, []);

  const setSectionContext = useCallback((section) => {
    const id = section?.id || "";

    setPageContextState((previous) => ({
      ...previous,
      section_id: id,
      section_title:
        section?.title || SECTION_LABELS[id] || "",
      exercise: null,
      step: null,
      selection: "",
      visible_block: "",
    }));
  }, []);

  const setExerciseContext = useCallback((exercise) => {
    if (!exercise) {
      setPageContextState((previous) => ({
        ...previous,
        exercise: null,
      }));
      return;
    }

    setPageContextState((previous) => ({
      ...previous,
      exercise: {
        kind:
          exercise.kind ||
          exercise.type ||
          "visible_exercise",
        id: safeId(exercise.id),
        code: exercise.code || "",
        title: exercise.title || "",
        text: trimText(
          exercise.text ||
            exercise.statement ||
            exercise.standalone_text ||
            exercise.visible_text,
          6000,
        ),
        difficulty: exercise.difficulty || "",
        skill: exercise.skill || "",
      },
    }));
  }, []);

  const setStepContext = useCallback((step) => {
    if (!step) {
      setPageContextState((previous) => ({
        ...previous,
        step: null,
      }));
      return;
    }

    setPageContextState((previous) => ({
      ...previous,
      step: {
        id: safeId(step.id),
        title: step.title || "",
        type: step.type || "",
        text: trimText(
          step.text || step.content || step.statement,
          3500,
        ),
      },
    }));
  }, []);

  const capturePointerContext = useCallback((event) => {
    const block = getClosestContextBlock(event.target);
    if (!block) return;

    const dataset = block.dataset || {};
    const visibleText = trimText(block.innerText, 5000);

    const exerciseId =
      dataset.tutorExerciseId ||
      dataset.questionId ||
      dataset.exerciseId ||
      null;

    const stepId = dataset.tutorStepId || null;
    const title =
      dataset.tutorTitle ||
      block.getAttribute("aria-label") ||
      "";

    setPageContextState((previous) => {
      const exerciseSection = [
        "question_bac",
        "question_generate",
        "bac",
        "generete-bac",
        "resume",
      ].includes(previous.section_id);

      if (exerciseId || exerciseSection) {
        return {
          ...previous,
          visible_block: visibleText,
          exercise: {
            kind:
              dataset.tutorExerciseKind ||
              (previous.section_id === "resume"
                ? "adaptive_test_question"
                : previous.section_id === "question_bac"
                  ? "course_question"
                  : "visible_exercise"),
            id: exerciseId,
            code: dataset.tutorCode || "",
            title,
            text: visibleText,
            difficulty: dataset.tutorDifficulty || "",
            skill: dataset.tutorSkill || "",
          },
          step: stepId
            ? {
                id: stepId,
                title,
                type: dataset.tutorStepType || "",
                text: visibleText,
              }
            : previous.step,
        };
      }

      return {
        ...previous,
        visible_block: visibleText,
        step: {
          id: stepId,
          title,
          type: dataset.tutorStepType || "lesson_block",
          text: visibleText,
        },
      };
    });
  }, []);

  const captureSelectionContext = useCallback(() => {
    const selected = trimText(
      window.getSelection?.()?.toString?.() || "",
      3000,
    );

    if (!selected) return;

    setPageContextState((previous) => ({
      ...previous,
      selection: selected,
    }));
  }, []);

  const clearSelection = useCallback(() => {
    setPageContextState((previous) => ({
      ...previous,
      selection: "",
    }));
  }, []);

  const transportContext = useMemo(
    () => ({
      axis_id: pageContext.axis_id,
      axis_tag: pageContext.axis_tag,
      axis_title: pageContext.axis_title,
      section_id: pageContext.section_id,
      section_title: pageContext.section_title,
      exercise: pageContext.exercise,
      step: pageContext.step,
      selection: pageContext.selection,
      visible_block: pageContext.visible_block,
    }),
    [pageContext],
  );

  const value = useMemo(
    () => ({
      pageContext,
      transportContext,
      setPageContext,
      setAxisContext,
      setSectionContext,
      setExerciseContext,
      setStepContext,
      capturePointerContext,
      captureSelectionContext,
      clearSelection,
    }),
    [
      pageContext,
      transportContext,
      setPageContext,
      setAxisContext,
      setSectionContext,
      setExerciseContext,
      setStepContext,
      capturePointerContext,
      captureSelectionContext,
      clearSelection,
    ],
  );

  return (
    <TutorPageContext.Provider value={value}>
      {children}
    </TutorPageContext.Provider>
  );
}

export function useTutorPageContext() {
  const context = useContext(TutorPageContext);
  if (!context) {
    throw new Error(
      "useTutorPageContext يجب استعماله داخل TutorPageProvider.",
    );
  }
  return context;
}
