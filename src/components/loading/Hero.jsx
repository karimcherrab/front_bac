import {
  ArrowLeft,
  Play,
  Sparkles,
  ShieldCheck,
  Clock3,
  CreditCard,
  BookOpenCheck,
  UsersRound,
  FileText,
  TrendingUp,
} from "lucide-react";
import heroVisual from "../../assets/images/hero-visual.svg";

const stats = [
  { icon: BookOpenCheck, value: "+50,000", label: "تمرين محلول" },
  { icon: FileText, value: "+300", label: "درس مبسط" },
  { icon: UsersRound, value: "95%", label: "من التلاميذ يوصون بنا" },
  { icon: TrendingUp, value: "+10,000", label: "تلميذ نشط" },
];

export default function Hero() {
  return (
    <section
      id="home"
      className="hero-noise relative min-h-[780px] overflow-hidden bg-[#06172f] pt-28 text-white"
    >
      <div className="absolute inset-0 bg-hero-grid bg-[size:42px_42px] opacity-50" />
      <div className="absolute -left-40 top-40 h-96 w-96 rounded-full bg-blue-600/20 blur-3xl" />

      <div className="container-page relative z-10 grid items-center gap-12 py-12 lg:grid-cols-[1.03fr_.97fr] lg:py-20">
        <div className="text-center lg:text-right">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-4 py-2 text-sm font-bold text-slate-200 backdrop-blur">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white">
              🇩🇿
            </span>
            منصة تعليمية جزائرية 100%
          </div>

          <h1 className="mx-auto max-w-2xl text-4xl font-black leading-[1.35] sm:text-5xl lg:mx-0 lg:text-6xl">
            طريقك نحو
            <span className="text-gradient"> البكالوريا </span>
            يبدأ من هنا
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-base leading-8 text-slate-300 sm:text-lg lg:mx-0">
            دروس مبسطة، تمارين مرتبة حسب كل محور، مواضيع بكالوريا أصلية،
            تمارين مشابهة وتصحيح مفصل مع مساعد ذكي يرافقك خطوة بخطوة.
          </p>

          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row lg:justify-start">
            <button className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-l from-blue-500 to-indigo-600 px-7 py-4 font-extrabold shadow-xl shadow-blue-600/25 sm:w-auto">
              ابدأ مجانًا الآن
              <ArrowLeft size={19} />
            </button>

            <button className="flex w-full items-center justify-center gap-3 rounded-2xl border border-white/20 bg-white/5 px-7 py-4 font-bold backdrop-blur transition hover:bg-white/10 sm:w-auto">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-slate-950">
                <Play size={16} fill="currentColor" />
              </span>
              شاهد كيف تعمل المنصة
            </button>
          </div>

          <div className="mt-6 flex flex-wrap justify-center gap-x-6 gap-y-3 text-sm font-medium text-slate-300 lg:justify-start">
            <span className="flex items-center gap-2"><ShieldCheck size={17} /> تجربة مجانية</span>
            <span className="flex items-center gap-2"><Clock3 size={17} /> دخول سريع وآمن</span>
            <span className="flex items-center gap-2"><CreditCard size={17} /> دون بطاقة بنكية</span>
            <span className="flex items-center gap-2"><Sparkles size={17} /> مساعد AI ذكي</span>
          </div>
        </div>

        <div className="relative mx-auto w-full max-w-[610px]">
          <div className="absolute left-0 top-0 h-48 w-48 rounded-full bg-blue-500/25 blur-3xl" />
          <img
            src={heroVisual}
            alt="واجهة منصة Backey التعليمية"
            className="relative z-10 w-full drop-shadow-[0_35px_50px_rgba(0,0,0,.3)]"
          />
        </div>
      </div>

      <div className="container-page relative z-10 pb-8">
        <div className="glass grid overflow-hidden rounded-[26px] sm:grid-cols-2 lg:grid-cols-4">
          {stats.map(({ icon: Icon, value, label }, index) => (
            <div
              key={label}
              className={`flex items-center justify-center gap-4 px-5 py-6 ${
                index ? "border-t border-white/10 sm:border-t-0 sm:border-r" : ""
              }`}
            >
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10">
                <Icon size={24} />
              </span>
              <div>
                <div className="text-xl font-black">{value}</div>
                <div className="text-sm text-slate-300">{label}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
