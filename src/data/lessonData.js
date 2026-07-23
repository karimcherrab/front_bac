// Static content for the "المتتالية الحسابية" (Arithmetic Sequence) lesson.
// Kept separate from components so it can later be swapped for an API call.

export const breadcrumb = [
  { label: "المتتاليات", href: "#" },
  { label: "المتتالية الحسابية", href: "#" },
  { label: "الشرح التفاعلي", href: "#" },
];

export const currentUser = {
  name: "أحمد",
  level: "رياضيات 3AS",
  avatar: null, // placeholder, rendered with initials
};

export const currentChapter = "المتتاليات";

export const chapterProgress = {
  percent: 65,
  message: "أنت ممتاز! استمر",
};

export const lessonParts = [
  { id: 1, title: "معنى المتتالية", status: "done" },
  { id: 2, title: "طرق تعريف المتتالية", status: "done" },
  { id: 3, title: "المتتالية الحسابية", status: "active" },
  { id: 4, title: "المتتالية الهندسية", status: "locked" },
  { id: 5, title: "نهاية المتتالية", status: "locked" },
  { id: 6, title: "متتاليتان متجاورتان", status: "locked" },
];

export const lessonSteps = [
  { id: "intro", label: "مدخل", icon: "lightbulb" },
  { id: "question_bac", label: "تمارينات بكالوريا", icon: "trophy" },
  { id: "question_generate", label: "تمرين موجه", icon: "sigma" },
  { id: "resume", label: "ملخص ", icon: "pencil" },

  //  { id: "bac", label: "كتابة البكالوريا", icon: "trophy" },
];

export const introStep = {
  badge: "الخطوة الحالية",
  title: "مدخل تشويقي",
  paragraphs: [
    "تخيل أنك تضع في حسابك البنكي كل شهر مبلغًا ثابتًا من المال، ولنفرض 1000 دج كل شهر.",
    "كيف سيكون رصيدك بعد شهر؟ وبعد شهرين؟ وبعد سنة؟",
  ],
  highlight: "هذا النوع من المواقف ندرسه باستعمال المتتالية الحسابية.",
  months: [
    { label: "الشهر 1", value: "1000 دج", coins: 1 },
    { label: "الشهر 2", value: "2000 دج", coins: 2 },
    { label: "الشهر 3", value: "3000 دج", coins: 3 },
    { label: "الشهر n", value: "n × 1000 دج", coins: 4 },
  ],
  footerNote: "سترى كيف يمكن تمثيل هذه المواقف باستعمال المتتاليات الحسابية وقوانينها.",
};

export const sidePanels = {
  resources: {
    title: "موارد إضافية",
    items: [
      { type: "pdf", label: "ملخص المتتالية الحسابية (PDF)" },
      { type: "video", label: "فيديو شرح سريع" },
    ],
  },
  quickExample: {
    title: "مثال سريع",
    sequence: "1, 4, 7, 10, 13, ...",
    note: "الفرق بين كل حدين متتاليين = 3",
    formula: "r = 3",
    conclusion: "هذه متتالية حسابية أساسها",
  },
  goal: {
    title: "هدف الخطوة",
    text: "في هذه الخطوة ستكتشف فكرة المتتالية الحسابية من خلال مثال حياتي بسيط.",
  },
};

export const chatMessages = [
  {
    id: 1,
    from: "bot",
    text: "أهلًا أحمد! 👋\nأنا هنا لمساعدتك على فهم المتتالية الحسابية خطوة بخطوة.\nاسألني أي سؤال في أي وقت 😊",
    time: "10:30",
  },
  {
    id: 2,
    from: "user",
    text: "لماذا نقول أن الزيادة ثابتة؟",
    time: "10:31",
  },
  {
    id: 3,
    from: "bot",
    text: "لأن الفرق بين كل حدين متتاليين متساوٍ.\nأي uₙ₊₁ − uₙ = r حيث r عدد ثابت.",
    time: "10:31",
  },
];

export const chatSuggestions = [
  "أعطني مثال آخر",
  "هل يمكن أن يكون r سالبًا؟",
  "كيف أكتبها في البكالوريا؟",
];




