import {
  Check,
  ChevronLeft,
  FileText,
  Lock,
  Play,
  Sparkles,
  Trophy,
} from "lucide-react";

import { useContext } from "react";
import { useNavigate } from "react-router-dom";

import { UserContext } from "../Utils/UserContext";

function StatusIcon({
  status,
  isSelected,
}) {
  if (status === "done") {
    return (
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-500 shadow-sm">
        <Check
          size={15}
          className="text-white"
          strokeWidth={3}
        />
      </span>
    );
  }

  if (isSelected || status === "active") {
    return (
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white shadow-sm">
        <Play
          size={12}
          className="fill-blue-700 text-blue-700"
        />
      </span>
    );
  }

  if (status === "locked") {
    return (
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/10">
        <Lock
          size={13}
          className="text-blue-200/60"
        />
      </span>
    );
  }

  return (
    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/5">
      <Play
        size={11}
        className="text-blue-100/70"
      />
    </span>
  );
}

function PartRow({
  part,
  currentAxis,
  setCurrentAxis,
  setActiveId
}) {
  const isSelected =
    String(currentAxis?.id) === String(part?.id);

  const status = part?.status || "available";
  const isLocked = status === "locked";

  const handleClick = () => {
    if (isLocked) return;
    setActiveId("intro")
    setCurrentAxis(part);
  };

  return (
    <li>
      <button
        type="button"
        disabled={isLocked}
        onClick={handleClick}
        className={[
          "group relative flex w-full items-center",
          "justify-between gap-3 overflow-hidden",
          "rounded-2xl px-4 py-3.5 text-right",
          "transition duration-200",
          isSelected
            ? [
                "bg-gradient-to-l",
                "from-violet-500 to-blue-500",
                "text-white",
                "shadow-[0_12px_30px_-15px_rgba(124,58,237,0.9)]",
              ].join(" ")
            : isLocked
              ? "cursor-not-allowed text-blue-200/35"
              : "text-blue-50 hover:bg-white/10",
        ].join(" ")}
      >
        {isSelected && (
          <span className="absolute inset-y-0 right-0 w-1 rounded-l-full bg-amber-300" />
        )}

        <div className="min-w-0 flex-1">
          <span className="block text-sm font-black leading-6">
            {part?.order}. {part?.title}
          </span>

          {isSelected && (
            <span className="mt-1 block text-[11px] font-bold text-violet-100">
              أنت تدرس هذا المحور الآن
            </span>
          )}
        </div>

        <StatusIcon
          status={status}
          isSelected={isSelected}
        />
      </button>
    </li>
  );
}

function BacExercisesButton({
  chapterId,
  exercisesCount,
  setActiveId,
}) {
  const navigate = useNavigate();
  // const {  token , setActiveId , activeId } = useContext(UserContext);

  const openBacExercises = () => {
    // navigate(`/bac/chapter/${chapterId}`);

setActiveId("bac")


  };

  return (
    <div className="mt-7">
      <div className="mb-3 flex items-center gap-2">
        <span className="h-px flex-1 bg-white/10" />

        <span className="text-[11px] font-black text-blue-100/60">
          بعد إنهاء محاور الدرس
        </span>

        <span className="h-px flex-1 bg-white/10" />
      </div>

      <button
        type="button"
        onClick={openBacExercises}
        className={[
          "group relative w-full overflow-hidden",
          "rounded-[22px] border border-amber-200/25",
          "bg-gradient-to-l from-amber-400 via-orange-400 to-orange-500",
          "px-4 py-4 text-right text-white",
          "shadow-[0_18px_38px_-18px_rgba(249,115,22,0.85)]",
          "transition duration-300",
          "hover:-translate-y-1",
          "hover:shadow-[0_24px_48px_-18px_rgba(249,115,22,0.95)]",
        ].join(" ")}
      >
        <span className="pointer-events-none absolute -left-8 -top-12 h-28 w-28 rounded-full bg-white/20 blur-2xl" />

        <div className="relative flex items-center gap-3">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/20 shadow-inner backdrop-blur">
            <Trophy size={25} />
          </span>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h3 className="text-base font-black">
                تمارين البكالوريا
              </h3>

              <Sparkles size={16} />
            </div>

            <p className="mt-1 text-xs font-bold leading-5 text-orange-50">
              طبّق ما تعلمته على تمارين البكالوريا الحقيقية
            </p>

            {Number(exercisesCount) > 0 && (
              <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-white/20 px-2.5 py-1 text-[11px] font-black">
                <FileText size={12} />
                {exercisesCount} تمرين
              </span>
            )}
          </div>

          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/20 transition group-hover:-translate-x-1">
            <ChevronLeft size={19} />
          </span>
        </div>
      </button>
    </div>
  );
}

export default function LessonPartsList({
  parts = [],
  chapterId = 1,
  exercisesCount = 0,
}) {
  const {
    current_axis: currentAxis,
    setCurrent_axis: setCurrentAxis,
    setActiveId:setActiveId,
  } = useContext(UserContext);

  return (
    <div className="mt-8 px-5">
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm font-bold text-blue-100/75">
          أجزاء الدرس
        </p>

        <span className="rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-black text-blue-100">
          {parts.length} محور
        </span>
      </div>

      {parts.length > 0 ? (
        <ul className="space-y-2">
          {parts.map((part) => (
            <PartRow
              key={part.id}
              part={part}
              currentAxis={currentAxis}
              setCurrentAxis={setCurrentAxis}
                setActiveId = {setActiveId}
            />
          ))}
        </ul>
      ) : (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-center">
          <p className="text-sm font-bold text-blue-100/70">
            لا توجد أجزاء مضافة لهذا الدرس.
          </p>
        </div>
      )}

      <BacExercisesButton
        chapterId={chapterId}
        exercisesCount={exercisesCount}
        setActiveId = {setActiveId}
      />
    </div>
  );
}