export default function SocialLoginButtons() {
  return (
    <>
      <div className="my-8 flex items-center gap-4 text-sm text-slate-400">
        <div className="h-px flex-1 bg-slate-200" />
        أو سجل الدخول باستخدام
        <div className="h-px flex-1 bg-slate-200" />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <button className="rounded-2xl border border-slate-200 py-3 font-bold text-slate-600 transition hover:bg-slate-50">
          Google
        </button>

        <button className="rounded-2xl border border-slate-200 py-3 font-bold text-slate-600 transition hover:bg-slate-50">
          حساب الطالب
        </button>
      </div>
    </>
  );
}