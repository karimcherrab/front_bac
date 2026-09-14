import { Star, Quote } from "lucide-react";

const testimonials = [
  {
    name: "سارة",
    branch: "شعبة علوم تجريبية",
    initials: "س",
    text: "المنصة ساعدتني كثيرًا في فهم الدروس، وأكثر شيء أعجبني أن الحلول واضحة ومقسمة خطوة بخطوة.",
  },
  {
    name: "أيمن",
    branch: "شعبة رياضيات",
    initials: "أ",
    text: "أصبحت أعرف نقاط ضعفي في كل محور، والتمارين المشابهة جعلتني أراجع بطريقة منظمة بدل العشوائية.",
  },
  {
    name: "مريم",
    branch: "شعبة آداب وفلسفة",
    initials: "م",
    text: "جمعت كل ما أحتاجه في مكان واحد، وهذا وفر علي الكثير من الوقت في البحث بين مصادر مختلفة.",
  },
];

export default function Testimonials() {
  return (
    <section id="testimonials" className="bg-white py-20">
      <div className="container-page">
        <div className="text-center">
          <h2 className="text-3xl font-black sm:text-4xl">ماذا يقول تلاميذنا؟</h2>
          <p className="mt-3 text-slate-500">تجربة مصممة لتكون بسيطة وواضحة ومفيدة فعلاً.</p>
        </div>

        <div className="mt-10 grid gap-5 lg:grid-cols-3">
          {testimonials.map((item) => (
            <article key={item.name} className="relative rounded-[28px] border border-slate-100 bg-[#fbfdff] p-7 shadow-card">
              <Quote className="absolute left-6 top-6 text-blue-100" size={42} />
              <div className="flex items-center gap-4">
                <span className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-lg font-black text-white">
                  {item.initials}
                </span>
                <div>
                  <h3 className="font-extrabold">{item.name}</h3>
                  <p className="text-sm text-slate-500">{item.branch}</p>
                </div>
              </div>

              <div className="mt-5 flex gap-1 text-amber-400">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} size={17} fill="currentColor" />
                ))}
              </div>

              <p className="mt-4 leading-8 text-slate-600">“{item.text}”</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
