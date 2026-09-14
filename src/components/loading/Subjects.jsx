import {
  Calculator,
  FlaskConical,
  Leaf,
  BookOpenText,
  Languages,
  Landmark,
  UsersRound,
  MoreHorizontal,
  ArrowLeft,
} from "lucide-react";

const subjects = [
  { icon: Calculator, name: "الرياضيات", sub: "Mathématiques", cls: "bg-rose-50 text-rose-500" },
  { icon: FlaskConical, name: "العلوم الفيزيائية", sub: "Sciences Physiques", cls: "bg-violet-50 text-violet-600" },
  { icon: Leaf, name: "علوم الطبيعة والحياة", sub: "SVT", cls: "bg-emerald-50 text-emerald-600" },
  { icon: BookOpenText, name: "اللغة العربية", sub: "Arabe", cls: "bg-orange-50 text-orange-500" },
  { icon: Languages, name: "اللغة الفرنسية", sub: "Français", cls: "bg-sky-50 text-sky-500" },
  { icon: Languages, name: "اللغة الإنجليزية", sub: "English", cls: "bg-pink-50 text-pink-500" },
  { icon: Landmark, name: "التاريخ والجغرافيا", sub: "Histoire & Géo", cls: "bg-slate-100 text-slate-600" },
  { icon: UsersRound, name: "الفلسفة", sub: "Philosophie", cls: "bg-teal-50 text-teal-600" },
  { icon: MoreHorizontal, name: "وغيرها", sub: "المزيد قريبًا", cls: "bg-indigo-50 text-indigo-600" },
];

export default function Subjects() {
  return (
    <section id="subjects" className="bg-[#f8fbff] py-20">
      <div className="container-page">
        <div className="text-center">
          <span className="rounded-full bg-blue-50 px-4 py-2 text-sm font-extrabold text-blue-600">
            جميع الشعب مدعومة
          </span>
          <h2 className="mt-5 text-3xl font-black sm:text-4xl">
            كل المواد في مكان واحد
          </h2>
          <p className="mx-auto mt-3 max-w-xl leading-7 text-slate-500">
            محتوى منظم ومحدث لمساعدتك على المراجعة بثقة مهما كانت شعبتك.
          </p>
        </div>

        <div className="mt-10 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-9">
          {subjects.map(({ icon: Icon, name, sub, cls }) => (
            <button
              key={name}
              className="subject-card flex min-h-[142px] flex-col items-center justify-center rounded-3xl border border-slate-100 bg-white p-4 shadow-card"
            >
              <span className={`flex h-12 w-12 items-center justify-center rounded-2xl ${cls}`}>
                <Icon size={24} />
              </span>
              <span className="mt-3 text-sm font-extrabold">{name}</span>
              <span className="mt-1 text-[11px] text-slate-400">{sub}</span>
            </button>
          ))}
        </div>

        <div className="mt-8 text-center">
          <button className="inline-flex items-center gap-2 rounded-2xl border border-blue-200 bg-white px-6 py-3 font-extrabold text-blue-600 shadow-sm">
            استكشف جميع المواد
            <ArrowLeft size={18} />
          </button>
        </div>
      </div>
    </section>
  );
}
