import {
  useState,
} from "react";

import {
  CheckCircle2,
  CreditCard,
  Loader2,
} from "lucide-react";

import {
  createCheckout,
  formatDzd,
  getApiErrorMessage,
} from "../../services/paymentApi";

export default function PackCheckoutButton({
  pack,
  token,
  label,
  showPrice = false,
  className = "",
  onError,
  onOwned,
}) {
  const [loading, setLoading] = useState(false);
  const [localError, setLocalError] = useState("");

  if (!pack) {
    return null;
  }

  const owned = pack.owned === true;

  const handleCheckout = async (event) => {
    event?.preventDefault?.();
    event?.stopPropagation?.();

    if (owned) {
      onOwned?.();
      return;
    }

    if (!token) {
      const message = "يجب تسجيل الدخول قبل إتمام عملية الشراء.";
      setLocalError(message);
      onError?.(message);
      return;
    }

    try {
      setLoading(true);
      setLocalError("");

      const checkout = await createCheckout({
        token,
        packId: pack.id,
      });

      if (checkout?.owned === true) {
        onOwned?.();
        return;
      }

      if (!checkout?.checkout_url) {
        throw new Error(
          "لم يُرجع الخادم رابط الدفع.",
        );
      }

      window.location.assign(
        checkout.checkout_url,
      );
    } catch (requestError) {
      if (requestError?.response?.data?.owned) {
        onOwned?.();
        return;
      }

      const message = getApiErrorMessage(
        requestError,
        "تعذر بدء عملية الدفع. حاول مرة أخرى.",
      );

      setLocalError(message);
      onError?.(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-w-0"
      onClick={(event) =>
        event.stopPropagation()
      }
      onKeyDown={(event) =>
        event.stopPropagation()
      }
    >
      <button
        type="button"
        disabled={loading || owned}
        onClick={handleCheckout}
        className={`
          inline-flex
          min-h-11
          items-center
          justify-center
          gap-2
          rounded-xl
          px-4
          text-sm
          font-black
          transition
          active:scale-[0.98]

          ${
            owned
              ? "cursor-default bg-emerald-50 text-emerald-700"
              : "bg-violet-600 text-white shadow-lg shadow-violet-200/60 hover:bg-violet-700"
          }

          ${loading ? "cursor-wait opacity-80" : ""}
          ${className}
        `}
      >
        {loading ? (
          <Loader2
            size={18}
            className="animate-spin"
          />
        ) : owned ? (
          <CheckCircle2 size={18} />
        ) : (
          <CreditCard size={18} />
        )}

        <span>
          {owned
            ? "تم الشراء"
            : label || "اشتر الآن"}
        </span>

        {!owned && showPrice && (
          <span className="opacity-90">
            {formatDzd(pack.price_dzd)}
          </span>
        )}
      </button>

      {localError && (
        <p className="mt-2 max-w-sm text-xs font-bold leading-5 text-red-500">
          {localError}
        </p>
      )}
    </div>
  );
}
