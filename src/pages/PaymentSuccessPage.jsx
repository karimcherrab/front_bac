import {
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

import {
  CheckCircle2,
  Loader2,
  RefreshCw,
  TriangleAlert,
} from "lucide-react";

import {
  Link,
  useSearchParams,
} from "react-router-dom";

import {
  UserContext,
} from "../Utils/UserContext";

import {
  formatDzd,
  getApiErrorMessage,
  refreshPurchase,
} from "../services/paymentApi";

const sleep = (ms) =>
  new Promise((resolve) =>
    setTimeout(resolve, ms),
  );

export default function PaymentSuccessPage() {
  const [searchParams] = useSearchParams();
  const purchaseId = searchParams.get("purchase");

  const {
    token,
  } = useContext(UserContext);

  const [purchase, setPurchase] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const verifyPayment = useCallback(
    async (cancelled = () => false) => {
      if (!purchaseId) {
        setError("معرّف عملية الشراء غير موجود في الرابط.");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError("");

        let latest = null;

        for (let attempt = 0; attempt < 4; attempt += 1) {
          latest = await refreshPurchase({
            token,
            purchaseId,
          });

          if (cancelled()) {
            return;
          }

          setPurchase(latest);

          if (
            latest?.status === "paid" ||
            latest?.status === "failed" ||
            latest?.status === "refunded"
          ) {
            break;
          }

          await sleep(1200);
        }
      } catch (requestError) {
        if (cancelled()) {
          return;
        }

        setError(
          getApiErrorMessage(
            requestError,
            "تعذر التحقق من عملية الدفع.",
          ),
        );
      } finally {
        if (!cancelled()) {
          setLoading(false);
        }
      }
    },
    [purchaseId, token],
  );

  useEffect(() => {
    let stopped = false;

    verifyPayment(() => stopped);

    return () => {
      stopped = true;
    };
  }, [verifyPayment]);

  const subjectId =
    purchase?.pack?.subject_id || null;

  const backPath = subjectId
    ? `/subjects/${subjectId}`
    : "/subjects";

  const paid = purchase?.status === "paid";

  return (
    <div
      dir="rtl"
      className="flex min-h-[calc(100dvh-104px)] items-center justify-center bg-[#fafbff] px-4 py-10"
    >
      <div className="w-full max-w-xl rounded-3xl border border-slate-100 bg-white p-6 text-center shadow-xl shadow-slate-200/40 sm:p-9">
        {loading ? (
          <>
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-violet-50">
              <Loader2
                size={36}
                className="animate-spin text-violet-600"
              />
            </div>
            <h1 className="mt-5 text-xl font-black text-slate-900">
              جاري تأكيد الدفع
            </h1>
            <p className="mt-2 text-sm font-semibold leading-7 text-slate-500">
              نتحقق من Chargily ومن تفعيل المحتوى في حسابك.
            </p>
          </>
        ) : error ? (
          <>
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-amber-50 text-amber-600">
              <TriangleAlert size={35} />
            </div>
            <h1 className="mt-5 text-xl font-black text-slate-900">
              لم نستطع تأكيد العملية الآن
            </h1>
            <p className="mt-2 text-sm font-semibold leading-7 text-slate-500">
              {error}
            </p>
            <button
              type="button"
              onClick={() => verifyPayment()}
              className="mt-6 inline-flex h-11 items-center gap-2 rounded-xl bg-violet-600 px-5 text-sm font-black text-white"
            >
              <RefreshCw size={17} />
              تحقق مرة أخرى
            </button>
          </>
        ) : paid ? (
          <>
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
              <CheckCircle2 size={39} />
            </div>

            <h1 className="mt-5 text-2xl font-black text-slate-900">
              تم الدفع وتفعيل المحتوى
            </h1>

            <p className="mt-2 text-sm font-semibold leading-7 text-slate-500">
              تم تفعيل {purchase?.pack?.target_title || purchase?.pack?.name || "المحتوى"} في حسابك بنجاح.
            </p>

            <div className="mt-6 rounded-2xl bg-slate-50 p-4 text-right">
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="font-bold text-slate-500">
                  المبلغ
                </span>
                <span className="font-black text-slate-900">
                  {formatDzd(purchase?.amount_dzd)}
                </span>
              </div>

              <div className="mt-3 flex items-center justify-between gap-3 text-sm">
                <span className="font-bold text-slate-500">
                  الحالة
                </span>
                <span className="font-black text-emerald-600">
                  مدفوع
                </span>
              </div>
            </div>

            <Link
              to={backPath}
              className="mt-6 inline-flex h-12 w-full items-center justify-center rounded-xl bg-violet-600 px-5 text-sm font-black text-white transition hover:bg-violet-700"
            >
              ابدأ الدراسة الآن
            </Link>
          </>
        ) : (
          <>
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-violet-50 text-violet-600">
              <Loader2 size={34} />
            </div>
            <h1 className="mt-5 text-xl font-black text-slate-900">
              العملية ما زالت قيد المعالجة
            </h1>
            <p className="mt-2 text-sm font-semibold leading-7 text-slate-500">
              لم تصل حالة مدفوع بعد. يمكنك التحقق مرة أخرى دون إعادة الدفع.
            </p>
            <button
              type="button"
              onClick={() => verifyPayment()}
              className="mt-6 inline-flex h-11 items-center gap-2 rounded-xl bg-violet-600 px-5 text-sm font-black text-white"
            >
              <RefreshCw size={17} />
              تحقق مرة أخرى
            </button>
          </>
        )}
      </div>
    </div>
  );
}
