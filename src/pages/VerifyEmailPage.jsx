import {
  useEffect,
  useRef,
  useState,
} from "react";

import {
  Link,
  useSearchParams,
} from "react-router-dom";

import axios from "axios";

import {
  CheckCircle2,
  LoaderCircle,
  MailCheck,
  RefreshCw,
  XCircle,
} from "lucide-react";


export default function VerifyEmailPage() {
  const [
    searchParams,
  ] = useSearchParams();

  const requestStarted =
    useRef(false);

  const studentUrl =
    import.meta.env.VITE_STUDENT_URL;

  const verifyUrl = studentUrl
    ? (
        `${studentUrl.replace(/\/+$/, "")}` +
        "/verify-email/"
      )
    : "";

  const token =
    searchParams.get("token") || "";

  const [status, setStatus] =
    useState("loading");

  const [message, setMessage] =
    useState(
      "جاري التحقق من رابط التفعيل..."
    );

  const [errorCode, setErrorCode] =
    useState("");

  useEffect(() => {
    if (requestStarted.current) {
      return;
    }

    requestStarted.current = true;

    const verifyEmail = async () => {
      if (!verifyUrl) {
        setStatus("error");

        setMessage(
          "VITE_STUDENT_URL غير موجود داخل ملف .env.",
        );

        return;
      }

      if (!token) {
        setStatus("error");

        setErrorCode(
          "invalid_verification_link"
        );

        setMessage(
          "رابط التفعيل لا يحتوي على رمز صالح.",
        );

        return;
      }

      try {
        const response = await axios.post(
          verifyUrl,
          {
            token,
          },
          {
            headers: {
              "Content-Type":
                "application/json",

              Accept:
                "application/json",
            },

            timeout: 20000,
          },
        );

        setStatus("success");

        setMessage(
          response.data?.message ||
          (
            "تم تأكيد بريدك الإلكتروني " +
            "بنجاح."
          ),
        );
      } catch (error) {
        console.error(
          "Email verification error:",
          error.response?.data || error,
        );

        const responseData =
          error.response?.data || {};

        setStatus("error");

        setErrorCode(
          responseData.code || ""
        );

        setMessage(
          responseData.message ||
          (
            "تعذر تأكيد البريد الإلكتروني. " +
            "قد يكون الرابط منتهي الصلاحية."
          ),
        );
      }
    };

    verifyEmail();
  }, [
    token,
    verifyUrl,
  ]);

  const isExpired =
    errorCode ===
    "verification_link_expired";

  return (
    <main
      dir="rtl"
      className="
        flex min-h-screen items-center
        justify-center bg-slate-50
        px-4 py-10
      "
    >
      <section
        className="
          w-full max-w-lg rounded-3xl
          border border-slate-200
          bg-white p-8 text-center
          shadow-xl shadow-slate-200/50
          sm:p-10
        "
      >
        {status === "loading" && (
          <>
            <div
              className="
                mx-auto flex h-20 w-20
                items-center justify-center
                rounded-full bg-blue-50
                text-blue-600
              "
            >
              <LoaderCircle
                size={38}
                className="animate-spin"
              />
            </div>

            <h1
              className="
                mt-6 text-2xl font-black
                text-slate-900
              "
            >
              تأكيد البريد الإلكتروني
            </h1>

            <p
              className="
                mt-3 text-sm leading-7
                text-slate-500
              "
            >
              {message}
            </p>
          </>
        )}

        {status === "success" && (
          <>
            <div
              className="
                mx-auto flex h-20 w-20
                items-center justify-center
                rounded-full bg-emerald-50
                text-emerald-600
              "
            >
              <MailCheck size={40} />
            </div>

            <h1
              className="
                mt-6 text-2xl font-black
                text-slate-900
              "
            >
              تم تفعيل حسابك
            </h1>

            <div
              className="
                mt-4 flex items-start gap-3
                rounded-2xl border
                border-emerald-200
                bg-emerald-50 px-4 py-4
                text-right text-sm
                leading-7 text-emerald-700
              "
            >
              <CheckCircle2
                size={21}
                className="mt-1 shrink-0"
              />

              <span>
                {message}
              </span>
            </div>

            <Link
              to="/login"
              className="
                mt-6 flex w-full items-center
                justify-center rounded-2xl
                bg-blue-600 py-3.5
                font-bold text-white
                transition hover:bg-blue-700
              "
            >
              تسجيل الدخول
            </Link>
          </>
        )}

        {status === "error" && (
          <>
            <div
              className="
                mx-auto flex h-20 w-20
                items-center justify-center
                rounded-full bg-red-50
                text-red-600
              "
            >
              <XCircle size={40} />
            </div>

            <h1
              className="
                mt-6 text-2xl font-black
                text-slate-900
              "
            >
              تعذر تفعيل الحساب
            </h1>

            <div
              className="
                mt-4 rounded-2xl border
                border-red-200 bg-red-50
                px-4 py-4 text-sm
                leading-7 text-red-700
              "
            >
              {message}
            </div>

            {isExpired && (
              <div
                className="
                  mt-4 flex items-start gap-2
                  rounded-2xl bg-amber-50
                  px-4 py-3 text-right
                  text-sm leading-6
                  text-amber-700
                "
              >
                <RefreshCw
                  size={18}
                  className="mt-1 shrink-0"
                />

                <span>
                  انتقل إلى صفحة تسجيل
                  الدخول أو صفحة إعادة
                  الإرسال للحصول على رابط
                  جديد.
                </span>
              </div>
            )}

            <Link
              to="/login"
              className="
                mt-6 flex w-full items-center
                justify-center rounded-2xl
                bg-blue-600 py-3.5
                font-bold text-white
                transition hover:bg-blue-700
              "
            >
              العودة إلى تسجيل الدخول
            </Link>
          </>
        )}
      </section>
    </main>
  );
}