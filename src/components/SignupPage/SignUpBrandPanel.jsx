// SignUpBrandPanel.jsx
import { Brain, CheckCircle } from "lucide-react";
import signup_illustration from "../../assets/signup-illustration.png";

export default function SignUpBrandPanel() {
  return (
    <div className="relative hidden h-full overflow-hidden bg-brand-900 text-white lg:flex lg:flex-col lg:justify-between lg:px-10 lg:py-8">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_35%_25%,rgba(108,78,245,0.45),transparent_35%)]" />
      <div className="absolute -bottom-24 -left-24 h-72 w-72 rounded-full bg-brand-600/20 blur-3xl" />

      <div className="relative z-10 flex items-center gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-600">
          <Brain size={30} />
        </div>

        <div>
          <h1 className="text-2xl font-bold">MathMaster</h1>
          <p className="text-xs text-slate-300">
            تعلم بذكاء، تفوق في البكالوريا
          </p>
        </div>
      </div>

      <div className="relative z-10 text-center">
        <h2 className="text-4xl font-black leading-tight">
          ابدأ رحلتك
          <br />
          <span className="text-brand-300">نحو النجاح</span>
        </h2>

        <p className="mx-auto mt-4 max-w-md text-sm leading-7 text-slate-300">
          أنشئ حسابك الآن، راجع الدروس، حل تمارين البكالوريا، واستفد من مساعد
          ذكي يرافقك خطوة بخطوة.
        </p>

        <img
          src={signup_illustration}
          alt="Signup Illustration"
          className="mx-auto mt-5 h-[250px] object-contain drop-shadow-2xl xl:h-[285px]"
        />
      </div>

      <div className="relative z-10 rounded-3xl border border-white/10 bg-white/10 p-4 backdrop-blur">

      </div>
    </div>
  );
}