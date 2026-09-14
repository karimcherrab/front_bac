import { ArrowLeft, Sparkles } from "lucide-react";
import ctaVisual from "../../assets/images/cta-visual.svg";

export default function CTA() {
  return (
    <section className="bg-[#f8fbff] pb-16">
      <div className="container-page">
        <div className="relative overflow-hidden rounded-[34px] bg-[#071a33] px-7 py-10 text-white shadow-soft sm:px-12">
          <img
            src={ctaVisual}
            alt=""
            className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-60"
          />
          <div className="relative z-10 mx-auto max-w-2xl text-center">
            <div className="mx-auto mb-4 flex w-max items-center gap-2 rounded-full border border-white/10 bg-white/10 px-4 py-2 text-sm font-bold backdrop-blur">
              <Sparkles size={17} />
              مستقبلك يبدأ بخطوة
            </div>
            <h2 className="text-3xl font-black sm:text-4xl">أنت أقرب إلى حلمك مما تتخيل</h2>
            <p className="mx-auto mt-4 max-w-xl leading-8 text-slate-300">
              انضم إلى آلاف التلاميذ، نظّم مراجعتك، وتقدم نحو البكالوريا بثقة.
            </p>
            <button className="mt-7 inline-flex items-center gap-2 rounded-2xl bg-gradient-to-l from-blue-500 to-indigo-600 px-7 py-4 font-extrabold shadow-xl shadow-blue-500/20">
              ابدأ مجانًا الآن
              <ArrowLeft size={19} />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
