import { BookOpen, Layers3, Crown, Check, Gift } from "lucide-react";

const plans = [
  {
    icon: BookOpen,
    title: "باقة الوحدة",
    subtitle: "لمن يريد التركيز على محور محدد",
    price: "300",
    note: "دج / الوحدة",
    button: "اختيار الوحدة",
    highlighted: false,
    perks: ["الدروس", "تمارين المحور", "مواضيع البكالوريا", "حلول مفصلة"],
  },
  {
    icon: Layers3,
    title: "باقة المادة كاملة",
    subtitle: "جميع الوحدات + التمارين والمواضيع",
    price: "1500",
    note: "دج / المادة",
    button: "اشترك الآن",
    highlighted: true,
    badge: "الأكثر اختيارًا",
    perks: ["جميع وحدات المادة", "تمارين مشابهة", "متابعة التقدم", "مساعد AI"],
  },
  {
    icon: Crown,
    title: "الباقة الشاملة",
    subtitle: "كل المواد + مزايا إضافية",
    price: "3900",
    note: "دج",
    button: "احصل على الباقة",
    highlighted: false,
    perks: ["كل المواد", "كل التمارين", "مساعد AI", "ميزات إضافية"],
  },
];

export default function Pricing() {
  return (
    <section id="pricing" className="bg-[#f8fbff] py-20">
      <div className="container-page">
        <div className="text-center">
          <h2 className="text-3xl font-black sm:text-4xl">باقات تناسب احتياجاتك</h2>
          <p className="mt-3 text-slate-500">ابدأ مجانًا، ثم اختر فقط ما تحتاجه.</p>
        </div>

        <div className="mt-10 grid gap-5 lg:grid-cols-[1fr_1fr_1fr_.9fr]">
          {plans.map((plan) => {
            const Icon = plan.icon;
            return (
              <article
                key={plan.title}
                className={`price-card relative rounded-[28px] border bg-white p-6 shadow-card ${
                  plan.highlighted ? "border-blue-400 ring-4 ring-blue-100" : "border-slate-100"
                }`}
              >
                {plan.badge && (
                  <span className="absolute -top-4 right-6 rounded-full bg-blue-600 px-4 py-1.5 text-xs font-black text-white">
                    {plan.badge}
                  </span>
                )}
                <span className={`flex h-12 w-12 items-center justify-center rounded-2xl ${
                  plan.highlighted ? "bg-blue-600 text-white" : "bg-blue-50 text-blue-600"
                }`}>
                  <Icon size={24} />
                </span>
                <h3 className="mt-5 text-xl font-black">{plan.title}</h3>
                <p className="mt-2 min-h-12 text-sm leading-6 text-slate-500">{plan.subtitle}</p>

                <div className="mt-5">
                  <span className="text-4xl font-black">{plan.price}</span>
                  <span className="mr-2 text-sm font-bold text-slate-500">{plan.note}</span>
                </div>

                <ul className="mt-6 space-y-3">
                  {plan.perks.map((perk) => (
                    <li key={perk} className="flex items-center gap-2 text-sm text-slate-600">
                      <Check size={17} className="text-emerald-500" />
                      {perk}
                    </li>
                  ))}
                </ul>

                <button className={`mt-7 w-full rounded-2xl px-5 py-3.5 font-extrabold ${
                  plan.highlighted
                    ? "bg-gradient-to-l from-blue-500 to-indigo-600 text-white shadow-lg shadow-blue-500/20"
                    : "border border-blue-200 text-blue-600"
                }`}>
                  {plan.button}
                </button>
              </article>
            );
          })}

          <aside className="rounded-[28px] bg-gradient-to-b from-blue-50 to-white p-6 text-center shadow-card">
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-100 text-violet-600">
              <Gift size={28} />
            </span>
            <h3 className="mt-5 text-2xl font-black">جرّب مجانًا الآن</h3>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              اكتشف تجربة Backey قبل الاشتراك.
            </p>
            <ul className="mx-auto mt-6 max-w-[190px] space-y-3 text-right text-sm text-slate-600">
              {["دروس مختارة", "تمارين مجانية", "تجربة مساعد AI"].map((x) => (
                <li key={x} className="flex items-center gap-2">
                  <Check size={17} className="text-emerald-500" />
                  {x}
                </li>
              ))}
            </ul>
            <button className="mt-7 w-full rounded-2xl bg-[#071a33] px-5 py-3.5 font-extrabold text-white">
              ابدأ التجربة المجانية
            </button>
          </aside>
        </div>
      </div>
    </section>
  );
}
