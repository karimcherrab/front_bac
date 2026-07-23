import { Brain } from "lucide-react";

import imageLogin from "../../assets/logo_image.png";

export default function LoginBrandPanel() {
  return (
    <section
      className="
        relative hidden min-h-[700px] flex-col justify-between
        overflow-hidden bg-brand-900 px-12 py-10 text-white
        lg:flex
      "
    >
      {/* خلفية مضيئة */}
      <div
        className="
          pointer-events-none absolute inset-0
          bg-[radial-gradient(circle_at_40%_40%,rgba(108,78,245,0.35),transparent_35%)]
        "
      />

      {/* الشعار */}
      <div className="relative z-10 flex items-center gap-4">
        <div
          className="
            flex h-14 w-14 items-center justify-center
            rounded-2xl bg-brand-600
          "
        >
          <Brain size={34} />
        </div>

        <div>
          <h1 className="text-3xl font-bold">MathMaster</h1>

          <p className="text-sm text-slate-300">
            تعلم بذكاء، تفوق في البكالوريا
          </p>
        </div>
      </div>

      {/* المحتوى */}
      <div className="relative z-10">
        <h2 className="text-5xl font-bold leading-tight">
          تعلم بذكاء
          <br />

          <span className="text-brand-400">
            وتفوّق في البكالوريا
          </span>
        </h2>

        <p className="mt-6 max-w-md text-lg leading-8 text-slate-300">
          منصة ذكية لمساعدتك على فهم الدروس، حل التمارين، ومراجعة تمارين
          البكالوريا خطوة بخطوة.
        </p>

        <div className="mt-12 flex justify-center">
          <img
            src={imageLogin}
            alt="منصة MathMaster التعليمية"
            className="w-[380px] max-w-full drop-shadow-2xl"
          />
        </div>
      </div>
    </section>
  );
}