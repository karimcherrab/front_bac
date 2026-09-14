import {
  useContext,
  useState,
} from "react";

import {
  ArrowRight,
  RefreshCw,
  XCircle,
} from "lucide-react";

import {
  Link,
  useNavigate,
  useSearchParams,
} from "react-router-dom";

import {
  UserContext,
} from "../Utils/UserContext";

import {
  getApiErrorMessage,
  refreshPurchase,
} from "../services/paymentApi";

export default function PaymentFailedPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const purchaseId = searchParams.get("purchase");

  const {
    token,
  } = useContext(UserContext);

  const [checking, setChecking] = useState(false);
  const [error, setError] = useState("");

  const checkAgain = async () => {
    if (!purchaseId) {
      setError("معرّف عملية الشراء غير موجود.");
      return;
    }

    try {
      setChecking(true);
      setError("");

      const purchase = await refreshPurchase({
        token,
        purchaseId,
      });

      if (purchase?.status === "paid") {
        navigate(
          `/payment/success?purchase=${purchaseId}`,
          {
            replace: true,
          },
        );
        return;
      }

      setError(
        "لم يتم تسجيل العملية كمدفوعة. يمكنك العودة إلى العروض والمحاولة من جديد.",
      );
    } catch (requestError) {
      setError(
        getApiErrorMessage(
          requestError,
          "تعذر التحقق من العملية.",
        ),
      );
    } finally {
      setChecking(false);
    }
  };

  return (
    <div
      dir="rtl"
      className="flex min-h-[calc(100dvh-104px)] items-center justify-center bg-[#fafbff] px-4 py-10"
    >
      <div className="w-full max-w-xl rounded-3xl border border-slate-100 bg-white p-7 text-center shadow-xl shadow-slate-200/40 sm:p-9">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-red-50 text-red-500">
          <XCircle size={39} />
        </div>

        <h1 className="mt-5 text-2xl font-black text-slate-900">
          لم تكتمل عملية الدفع
        </h1>

        <p className="mt-2 text-sm font-semibold leading-7 text-slate-500">
          لم يتم تفعيل أي محتوى بسبب هذه الصفحة وحدها. إذا خُصم المبلغ فعلًا، اضغط على التحقق مرة أخرى قبل إعادة الدفع.
        </p>

        {error && (
          <p className="mt-4 rounded-xl bg-amber-50 p-3 text-xs font-bold leading-6 text-amber-700">
            {error}
          </p>
        )}

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            disabled={checking}
            onClick={checkAgain}
            className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-violet-200 bg-violet-50 px-4 text-sm font-black text-violet-700 disabled:opacity-60"
          >
            <RefreshCw
              size={17}
              className={checking ? "animate-spin" : ""}
            />
            تحقق مرة أخرى
          </button>

          <Link
            to="/pricing"
            className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 text-sm font-black text-white"
          >
            العودة إلى العروض
            <ArrowRight size={17} />
          </Link>
        </div>
      </div>
    </div>
  );
}
