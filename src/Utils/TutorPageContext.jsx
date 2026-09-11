import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

const TutorPageContext = createContext(null);

const SECTION_LABELS = {
  intro: "الشرح",
  resume: "مراجعة المحور",
  question_bac: "تمارين البكالوريا الخاصة بالمحور",
  question_generate: "تمارين مولدة بالذكاء الاصطناعي",
  bac: "تمارين البكالوريا الكاملة",
  "generete-bac": "تمارين شبيهة بالبكالوريا",
};

function trimText(value, limit = 5000) {
  return String(value ?? "")
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
      "[data-tutor-question-id]",
      "[data-tutor-step-id]",
      "[data-question-id]",
      "[data-exercise-id]",
      "article",
      "section",
    ].join(","),
  );
}

function inferExerciseKind(sectionId = "") {
  if (sectionId === "resume") return "adaptive_test_question";
  if (sectionId === "question_bac") return "axis_question";
  if (sectionId === "question_generate") return "generated_axis_exercise";
  if (sectionId === "bac") return "bac_exercise";
  if (sectionId === "generete-bac") return "generated_bac_exercise";
  return "visible_exercise";
}

function normalizeExercise(exercise) {
  if (!exercise) return null;

  return {
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
        exercise.question ||
        exercise.standalone_text ||
        exercise.visible_text,
      7000,
    ),
    difficulty: exercise.difficulty || "",
    skill: exercise.skill || "",
    year: exercise.year ?? null,
    exercise_number: exercise.exercise_number ?? null,
    axis_tags: Array.isArray(exercise.axis_tags)
      ? exercise.axis_tags.slice(0, 20)
      : [],
    branch: exercise.branch || "",
    reference_exercise_ids: Array.isArray(exercise.reference_exercise_ids)
      ? exercise.reference_exercise_ids.slice(0, 20)
      : [],
  };
}

function normalizeQuestion(question) {
  if (!question) return null;

  return {
    id: safeId(
      question.id ??
        question.question_id,
    ),
    code: question.code || "",
    number:
      question.number ??
      question.display_order ??
      "",
    title: question.title || "",
    text: trimText(
      question.text ||
        question.statement ||
        question.question ||
        question.standalone_text ||
        question.visible_text,
      6500,
    ),
    skill: question.skill || "",
  };
}

function normalizeStep(step) {
  if (!step) return null;

  return {
    id: safeId(
      step.id ??
        step.step_id ??
        step.step_number ??
        step.number,
    ),
    number:
      step.number ??
      step.step_number ??
      step.order ??
      "",
    title: step.title || "",
    type: step.type || "",
    text: trimText(
      step.text ||
        step.content ||
        step.statement ||
        step.explanation ||
        step.calculation ||
        step.description ||
        step.result,
      4000,
    ),
  };
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
    question: null,
    step: null,
    view_state: {
      solution_visible: false,
      alternative_solution_visible: false,
      visible_hints: 0,
      showing_reexplanation: false,
    },
    selection: "",
    visible_block: "",
  });

  useEffect(() => {
    setPageContextState((previous) => ({
      ...previous,
      chapter_id: Number(chapterId) || 0,
      chapter_title: chapterTitle,
    }));
  }, [chapterId, chapterTitle]);

  const setPageContext = useCallback((patch) => {
    setPageContextState((previous) => ({
      ...previous,
      ...(typeof patch === "function"
        ? patch(previous)
        : patch),
    }));
  }, []);

  const setAxisContext = useCallback((axis) => {
    setPageContextState((previous) => ({
      ...previous,
      axis_id: safeId(axis?.id),
      axis_tag: axis?.tag || "",
      axis_title: axis?.title || "",
      exercise: null,
      question: null,
      step: null,
      selection: "",
      visible_block: "",
      view_state: {
        solution_visible: false,
        alternative_solution_visible: false,
        visible_hints: 0,
        showing_reexplanation: false,
      },
    }));
  }, []);

  const setSectionContext = useCallback((section) => {
    const id = section?.id || "";

    setPageContextState((previous) => ({
      ...previous,
      section_id: id,
      section_title:
        section?.title ||
        SECTION_LABELS[id] ||
        "",
      exercise: null,
      question: null,
      step: null,
      selection: "",
      visible_block: "",
      view_state: {
        solution_visible: false,
        alternative_solution_visible: false,
        visible_hints: 0,
        showing_reexplanation: false,
      },
    }));
  }, []);

  const setExerciseContext = useCallback((exercise) => {
    setPageContextState((previous) => ({
      ...previous,
      exercise: normalizeExercise(exercise),
      question: null,
      step: null,
    }));
  }, []);

  const setQuestionContext = useCallback((question) => {
    setPageContextState((previous) => ({
      ...previous,
      question: normalizeQuestion(question),
      step: null,
    }));
  }, []);

  const setStepContext = useCallback((step) => {
    setPageContextState((previous) => ({
      ...previous,
      step: normalizeStep(step),
    }));
  }, []);

  const setViewState = useCallback((patch) => {
    setPageContextState((previous) => ({
      ...previous,
      view_state: {
        ...previous.view_state,
        ...(patch || {}),
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
      dataset.exerciseId ||
      null;

    const questionId =
      dataset.tutorQuestionId ||
      dataset.questionId ||
      null;

    const stepId =
      dataset.tutorStepId ||
      null;

    const title =
      dataset.tutorTitle ||
      block.getAttribute("aria-label") ||
      "";

    setPageContextState((previous) => {
      const next = {
        ...previous,
        visible_block: visibleText,
      };

      if (exerciseId) {
        next.exercise = {
          ...(previous.exercise || {}),
          kind:
            dataset.tutorExerciseKind ||
            previous.exercise?.kind ||
            inferExerciseKind(previous.section_id),
          id: exerciseId,
          code:
            dataset.tutorCode ||
            previous.exercise?.code ||
            "",
          title:
            dataset.tutorExerciseTitle ||
            title ||
            previous.exercise?.title ||
            "",
          text:
            previous.exercise?.text ||
            visibleText,
          difficulty:
            dataset.tutorDifficulty ||
            previous.exercise?.difficulty ||
            "",
          skill:
            dataset.tutorSkill ||
            previous.exercise?.skill ||
            "",
        };
      }

      if (questionId) {
        const sameQuestion =
          String(previous.question?.id ?? "") ===
          String(questionId);

        next.question = {
          ...(sameQuestion ? previous.question || {} : {}),
          id: questionId,
          number:
            dataset.tutorQuestionNumber ||
            (sameQuestion ? previous.question?.number : "") ||
            "",
          title:
            dataset.tutorQuestionTitle ||
            title ||
            (sameQuestion ? previous.question?.title : "") ||
            "",
          text:
            dataset.tutorQuestionText ||
            (sameQuestion ? previous.question?.text : "") ||
            visibleText,
          skill:
            dataset.tutorSkill ||
            (sameQuestion ? previous.question?.skill : "") ||
            "",
        };
      }

      if (stepId) {
        const sameStep =
          String(previous.step?.id ?? "") ===
          String(stepId);

        next.step = {
          ...(sameStep ? previous.step || {} : {}),
          id: stepId,
          number:
            dataset.tutorStepNumber ||
            (sameStep ? previous.step?.number : "") ||
            "",
          title:
            dataset.tutorStepTitle ||
            title ||
            (sameStep ? previous.step?.title : "") ||
            "",
          type:
            dataset.tutorStepType ||
            (sameStep ? previous.step?.type : "") ||
            "solution_step",
          text:
            dataset.tutorStepText ||
            (sameStep ? previous.step?.text : "") ||
            visibleText,
        };
      }

      // Legacy fallback: إذا لم توجد data attributes نحتفظ بالنص المرئي فقط.
      if (!exerciseId && !questionId && !stepId) {
        next.step = {
          id: null,
          number: "",
          title,
          type: "visible_block",
          text: visibleText,
        };
      }

      return next;
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
      question: pageContext.question,
      step: pageContext.step,
      view_state: pageContext.view_state,
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
      setQuestionContext,
      setStepContext,
      setViewState,
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
      setQuestionContext,
      setStepContext,
      setViewState,
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
