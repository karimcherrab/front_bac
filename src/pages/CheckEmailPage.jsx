import {
  useMemo,
  useState,
} from "react";

import {
  Link,
  useLocation,
  useSearchParams,
} from "react-router-dom";

import axios from "axios";

import {
  ArrowRight,
  CheckCircle2,
  LoaderCircle,
  Mail,
  RefreshCw,
  XCircle,
} from "lucide-react";


export default function CheckEmailPage() {
  const location = useLocation();

  const [
    searchParams,
  ] = useSearchParams();

  const studentUrl =
    import.meta.env.VITE_STUDENT_URL;

  const resendUrl = studentUrl
    ? (
        `${studentUrl.replace(/\/+$/, "")}` +
        "/resend-verification/"
      )
    : "";

  const email = useMemo(() => {
    return (
      location.state?.email ||
      searchParams.get("email") ||
      ""
    )
      .trim()
      .toLowerCase();
  }, [
    location.state,
    searchParams,
  ]);

  const [isLoading, setIsLoading] =
    useState(false);

  const [
    feedback,
    setFeedback,
  ] = useState({
    type: "",
    message:
      location.state?.message || "",
  });

  const resendVerificationEmail =
    async () => {
      if (!email) {
        setFeedback({
          type: "error",
          message:
            "البريد الإلكتروني غير موجود.",
        });

        return;
      }

      if (!resendUrl) {
        setFeedback({
          type: "error",
          message:
            "VITE_STUDENT_URL غير موجود.",
        });

        return;
      }

      if (isLoading) {
        return;
      }

      setIsLoading(true);
      setFeedback({
        type: "",
        message: "",
      });

      try {
        const response = await axios.post(
          resendUrl,
          {
            email,
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

        setFeedback({
          type: "success",
          message:
            response.data?.message ||
            "تم إرسال رابط جديد.",
        });
      } catch (error) {
        console.error(
          "Resend verification error:",
          error.response?.data || error,
        );

        setFeedback({
          type: "error",
          message:
            error.response?.data?.message ||
            (
              "تعذر إرسال رابط التفعيل. " +
              "حاول مجددًا."
            ),
        });
      } finally {
        setIsLoading(false);
      }
    };

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
          bg-white p-7 shadow-xl
          shadow-slate-200/50
          sm:p-10
        "
      >
        <div
          className="
            mx-auto flex h-20 w-20
            items-center justify-center
            rounded-full bg-blue-50
            text-blue-600
          "
        >
          <Mail size={38} />
        </div>

        <div className="mt-6 text-center">
          <h1
            className="
              text-2xl font-black
              text-slate-900
            "
          >
            تحقق من بريدك الإلكتروني
          </h1>

          <p
            className="
              mt-3 text-sm leading-7
              text-slate-500
            "
          >
            أرسلنا إليك رابطًا لتأكيد
            بريدك وتفعيل حسابك.
          </p>

          {email && (
            <p
              dir="ltr"
              className="
                mt-3 break-all rounded-xl
                bg-slate-50 px-4 py-3
                text-sm font-bold
                text-slate-700
              "
            >
              {email}
            </p>
          )}
        </div>

        <div
          className="
            mt-6 rounded-2xl
            border border-blue-100
            bg-blue-50 px-5 py-4
            text-sm leading-7
            text-blue-800
          "
        >
          افتح الرسالة واضغط على زر
          تأكيد البريد الإلكتروني. بعد
          ذلك يمكنك تسجيل الدخول إلى
          المنصة.
        </div>

        {feedback.message && (
          <div
            className={`
              mt-5 flex items-start gap-3
              rounded-2xl border px-4 py-3
              text-sm font-medium leading-6
              ${
                feedback.type === "error"
                  ? (
                      "border-red-200 " +
                      "bg-red-50 text-red-700"
                    )
                  : (
                      "border-emerald-200 " +
                      "bg-emerald-50 " +
                      "text-emerald-700"
                    )
              }
            `}
          >
            {feedback.type === "error" ? (
              <XCircle
                className="mt-0.5 shrink-0"
                size={20}
              />
            ) : (
              <CheckCircle2
                className="mt-0.5 shrink-0"
                size={20}
              />
            )}

            <span>
              {feedback.message}
            </span>
          </div>
        )}

        <button
          type="button"
          onClick={
            resendVerificationEmail
          }
          disabled={
            isLoading || !email
          }
          className="
            mt-6 flex w-full items-center
            justify-center gap-2
            rounded-2xl border
            border-blue-200 bg-blue-50
            py-3.5 font-bold text-blue-700
            transition hover:bg-blue-100
            disabled:cursor-not-allowed
            disabled:opacity-50
          "
        >
          {isLoading ? (
            <>
              <LoaderCircle
                size={19}
                className="animate-spin"
              />
              جاري إرسال الرابط...
            </>
          ) : (
            <>
              <RefreshCw size={19} />
              إعادة إرسال رابط التفعيل
            </>
          )}
        </button>

        <Link
          to="/login"
          className="
            mt-4 flex w-full items-center
            justify-center gap-2
            rounded-2xl bg-blue-600
            py-3.5 font-bold text-white
            transition hover:bg-blue-700
          "
        >
          الانتقال إلى تسجيل الدخول
          <ArrowRight size={18} />
        </Link>

        <p
          className="
            mt-5 text-center text-xs
            leading-6 text-slate-400
          "
        >
          لم تجد الرسالة؟ تحقق من مجلد
          الرسائل غير المرغوب فيها Spam.
        </p>
      </section>
    </main>
  );
}