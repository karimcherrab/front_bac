import { CheckCircle, XCircle, Info, X } from "lucide-react";

export default function Alert({
  type = "success",
  message,
  onClose,
}) {
  const styles = {
    success: {
      bg: "bg-green-50",
      border: "border-green-200",
      text: "text-green-700",
      icon: <CheckCircle className="text-green-600" size={22} />,
    },
    error: {
      bg: "bg-red-50",
      border: "border-red-200",
      text: "text-red-700",
      icon: <XCircle className="text-red-600" size={22} />,
    },
    info: {
      bg: "bg-blue-50",
      border: "border-blue-200",
      text: "text-blue-700",
      icon: <Info className="text-blue-600" size={22} />,
    },
  };

  const current = styles[type];

  return (
    <div
      className={`fixed top-6 right-6 z-50 flex w-[360px] items-start gap-3 rounded-2xl border p-4 shadow-2xl ${current.bg} ${current.border}`}
    >
      {current.icon}

      <div className="flex-1">
        <p className={`font-semibold ${current.text}`}>
          {message}
        </p>
      </div>

      <button onClick={onClose}>
        <X size={18} className="text-slate-500 hover:text-black" />
      </button>
    </div>
  );
}