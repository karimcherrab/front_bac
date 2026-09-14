import {
  Bot,
  Target,
  BookOpen,
  ChartNoAxesCombined,
  BadgeCheck,
} from "lucide-react";

const features = [
  {
    icon: BookOpen,
    title: "محتوى مطابق للبكالوريا",
    text: "دروس وتمارين حسب البرنامج الرسمي وبترتيب يسهل المراجعة.",
    style: "bg-blue-50 text-blue-600",
  },
  {
    icon: Target,
    title: "تمارين مشابهة",
    text: "تدرب على أفكار قريبة من أسئلة البكالوريا الحقيقية.",
    style: "bg-rose-50 text-rose-500",
  },
  {
    icon: Bot,
    title: "مساعد بالذكاء الاصطناعي",
    text: "اسأل، افهم الخطأ، واحصل على شرح بسيط بدل حفظ الحل.",
    style: "bg-violet-50 text-violet-600",
  },
  {
    icon: BadgeCheck,
    title: "تصحيح مفصل وواضح",
    text: "حلول منظمة خطوة بخطوة لكل تمرين لتثبيت المنهجية.",
    style: "bg-orange-50 text-orange-500",
  },
  {
    icon: ChartNoAxesCombined,
    title: "متابعة التقدم",
    text: "اعرف نقاط قوتك وضعفك وتابع مستوى إتقانك لكل محور.",
    style: "bg-emerald-50 text-emerald-600",
  },
];

export default function Features() {
  return (
    <section id="features" className="bg-white py-8">
      <div className="container-page grid gap-4 md:grid-cols-3 lg:grid-cols-5">
        {features.map(({ icon: Icon, title, text, style }) => (
          <article
            key={title}
            className="feature-card rounded-3xl border border-slate-100 bg-white p-5 text-center shadow-card"
          >
            <span className={`mx-auto flex h-12 w-12 items-center justify-center rounded-2xl ${style}`}>
              <Icon size={24} />
            </span>
            <h3 className="mt-4 font-extrabold">{title}</h3>
            <p className="mt-2 text-sm leading-6 text-slate-500">{text}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
