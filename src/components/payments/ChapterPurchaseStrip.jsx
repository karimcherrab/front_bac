import {
  CheckCircle2,
  LockKeyhole,
} from "lucide-react";

import PackCheckoutButton from "./PackCheckoutButton";
import {
  formatDzd,
} from "../../services/paymentApi";

export default function ChapterPurchaseStrip({
  pack,
  token,
}) {
  if (!pack) {
    return null;
  }

  if (pack.owned) {
    return (
      <div className="mt-2 flex items-center gap-2 rounded-xl border border-emerald-100 bg-emerald-50/70 px-4 py-3 text-xs font-black text-emerald-700">
        <CheckCircle2 size={17} />
        هذا الفصل مفعّل في حسابك
      </div>
    );
  }

  return (
    <div
      className="mt-2 flex flex-col gap-3 rounded-xl border border-violet-100 bg-violet-50/50 p-3 sm:flex-row sm:items-center sm:justify-between"
      onClick={(event) =>
        event.stopPropagation()
      }
    >
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-violet-600 shadow-sm">
          <LockKeyhole size={19} />
        </div>

        <div className="min-w-0">
          <p className="text-xs font-black text-slate-800 sm:text-sm">
            شراء هذا الفصل فقط
          </p>
          <p className="mt-0.5 text-xs font-bold text-violet-600">
            {formatDzd(pack.price_dzd)}
          </p>
        </div>
      </div>

      <PackCheckoutButton
        pack={pack}
        token={token}
        label="فتح الفصل"
        className="w-full sm:w-auto"
      />
    </div>
  );
}
