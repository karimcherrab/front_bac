import { Brain } from "lucide-react";
import image_login from "../../assets/logo_image.png"
export default function LoginBrandPanel() {
  return (
    <div className="relative hidden lg:flex flex-col justify-between bg-brand-900 px-12 py-10 text-white overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_40%_40%,rgba(108,78,245,0.35),transparent_35%)]" />

      <div className="relative z-10 flex items-center gap-4">
        <div className="h-14 w-14 rounded-2xl bg-brand-600 flex items-center justify-center">
          <Brain size={34} />
        </div>
        <div>
          <h1 className="text-3xl font-bold">MathMaster</h1>
          <p className="text-sm text-slate-300">تعلم بذكاء، تفوق في البكالوريا</p>
        </div>
      </div>

      <div className="relative z-10">
        <h2 className="text-5xl font-bold leading-tight">
          تعلم بذكاء <br />
          <span className="text-brand-400">وتفوّق في البكالوريا</span>
        </h2>

        <p className="mt-6 max-w-md text-lg leading-8 text-slate-300">
          منصة ذكية لمساعدتك على فهم الدروس، حل التمارين، ومراجعة تمارين
          البكالوريا خطوة بخطوة.
        </p>

        <div className="mt-12 flex justify-center">
          <img
            src={image_login}
            alt="MathMaster illustration"
            className="w-[380px] drop-shadow-2xl"
          />
        </div>
      </div>

      {/* <div className="relative z-10 rounded-3xl border border-white/10 bg-white/10 p-5 backdrop-blur">
        <div className="flex items-center gap-5">
          <div className="flex h-20 w-20 items-center justify-center rounded-full border-[7px] border-brand-500 text-xl font-bold">
            65%
          </div>
          <div>
            <p className="text-sm text-slate-300">تقدمك في هذا الجزء</p>
            <p className="mt-2 font-bold">أنت ممتاز! استمر ⭐</p>
          </div>
        </div>
      </div> */}
    </div>
  );
}