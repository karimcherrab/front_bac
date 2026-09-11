// src/components/auth/LoginBrandPanel.jsx

import {
  useNavigate,
} from "react-router-dom";

import Logo from "../Logo";

import imageLogin from "../../assets/logo_image.png";

export default function LoginBrandPanel() {
  const navigate =
    useNavigate();

  return (
    <section
      className="
        relative
        hidden
        min-h-[700px]
        flex-col
        justify-between
        overflow-hidden
        bg-brand-900
        px-12
        py-10
        text-white
        lg:flex
      "
    >
      {/* =========================
          الخلفية المضيئة
      ========================== */}
      <div
        aria-hidden="true"
        className="
          pointer-events-none
          absolute
          inset-0
          bg-[radial-gradient(circle_at_40%_40%,rgba(108,78,245,0.35),transparent_35%)]
        "
      />

      {/* إضاءة إضافية خفيفة */}
      <div
        aria-hidden="true"
        className="
          pointer-events-none
          absolute
          -left-24
          -bottom-24
          h-80
          w-80
          rounded-full
          bg-brand-600/20
          blur-3xl
        "
      />

      <div
        aria-hidden="true"
        className="
          pointer-events-none
          absolute
          -right-24
          top-20
          h-72
          w-72
          rounded-full
          bg-violet-500/10
          blur-3xl
        "
      />

      {/* =========================
          شعار Bacly
      ========================== */}
      <div
        className="
          relative
          z-10
        "
      >
        <button
          type="button"
          onClick={() =>
            navigate("/home")
          }
          aria-label="العودة إلى الصفحة الرئيسية"
          title="الصفحة الرئيسية"
          className="
            group
            inline-flex
            items-center
            rounded-2xl
            px-1.5
            py-2
            transition
            duration-200

            hover:bg-white/[0.06]

            active:scale-[0.98]
          "
        >
          <Logo
            variant="dark"
            className="gap-3.5"
          />
        </button>
      </div>

      {/* =========================
          المحتوى
      ========================== */}
      <div
        className="
          relative
          z-10
        "
      >
        <h2
          className="
            text-5xl
            font-black
            leading-tight
          "
        >
          تعلم بذكاء
          <br />

          <span
            className="
              text-brand-400
            "
          >
            وتفوّق في البكالوريا
          </span>
        </h2>

        <p
          className="
            mt-6
            max-w-md
            text-lg
            leading-8
            text-slate-300
          "
        >
          منصة ذكية لمساعدتك على فهم الدروس،
          حل التمارين، ومراجعة تمارين البكالوريا
          خطوة بخطوة.
        </p>

        {/* =========================
            الصورة
        ========================== */}
        <div
          className="
            mt-10
            flex
            justify-center
          "
        >
          <img
            src={imageLogin}
            alt="منصة Bacly التعليمية"
            className="
              h-auto
              w-[380px]
              max-w-full
              object-contain
              drop-shadow-2xl

              xl:w-[420px]
            "
          />
        </div>
      </div>
    </section>
  );
}