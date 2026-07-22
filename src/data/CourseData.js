// src/data/mathCourseData.js

export const mathCourse = {
  title: "الرياضيات",
  description:
    "تعلم الأعداد، المعادلات، الهندسة والتحليل الرياضي خطوة بخطوة",
  progress: 70,
  lessonsCount: 39,
  exercisesCount: 20,
  examsCount: 8,
  level: "الثانية ثانوي",
  duration: "25 ساعة",
  lastUpdate: "15 يونيو 2026",
};

export const mathLessons = [
  {
    id: 1,
    number: "01",
    title: "  المتتاليات العددية",
    description:
      "تعريف المتتالية وطرق التعيين وبعض المتتاليات الشهيرة",
    level: "أساسي",
    duration: "15 دقيقة",
    progress: 100,
    iconText: "{aₙ}",
    color: "green",
    category: "basic",
    chapter: "sequences",
  },
  // {
  //   id: 2,
  //   number: "02",
  //   title: "المتتاليات الحسابية والهندسية",
  //   description:
  //     "دراسة المتتاليات الحسابية والهندسية وخصائصها",
  //   level: "أساسي",
  //   duration: "20 دقيقة",
  //   progress: 75,
  //   iconText: "aₙ",
  //   color: "blue",
  //   category: "basic",
  //   chapter: "sequences-arithmetic-geometric",
  // },
  // {
  //   id: 3,
  //   number: "03",
  //   title: "المبدأ الرياضي للاستقراء",
  //   description:
  //     "تعلم طريقة الاستقراء الرياضي وتطبيقاتها",
  //   level: "متوسط",
  //   duration: "25 دقيقة",
  //   progress: 40,
  //   iconText: "n→∞",
  //   color: "purple",
  //   category: "medium",
  //   chapter: "induction",
  // },
  // {
  //   id: 4,
  //   number: "04",
  //   title: "نهايات المتتاليات",
  //   description:
  //     "حساب نهايات المتتاليات والتقارب",
  //   level: "متوسط",
  //   duration: "25 دقيقة",
  //   progress: 0,
  //   iconText: "lim",
  //   color: "pink",
  //   category: "medium",
  //   chapter: "limits",
  // },
  // {
  //   id: 5,
  //   number: "05",
  //   title: "المتتاليات المحدودة",
  //   description:
  //     "دراسة المتتاليات المحدودة والمتقاربة",
  //   level: "متقدم",
  //   duration: "30 دقيقة",
  //   progress: 0,
  //   iconText: "≤≥",
  //   color: "orange",
  //   category: "advanced",
  //   chapter: "bounded-sequences",
  // },
  // {
  //   id: 6,
  //   number: "06",
  //   title: "المتتاليات المتجاورة",
  //   description:
  //     "نظرية المتتاليتين المتجاورتين وتطبيقاتها",
  //   level: "متقدم",
  //   duration: "30 دقيقة",
  //   progress: 0,
  //   iconText: "↑↓",
  //   color: "orange",
  //   category: "advanced",
  //   chapter: "adjacent-sequences",
  // },
];