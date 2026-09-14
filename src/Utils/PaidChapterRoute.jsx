import {
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

import {
  AlertTriangle,
  Loader2,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";

import {
  Navigate,
  useLocation,
  useNavigate,
  useParams,
} from "react-router-dom";

import {
  UserContext,
} from "./UserContext";

import {
  checkChapterAccess,
  getApiErrorMessage,
} from "../services/paymentApi";

import {
  buildLessonPath,
} from "../utils/lessonPath";


export default function PaidChapterRoute({
  children,
}) {
  const {
    token,
  } = useContext(UserContext) || {};

  const {
    id_subjects,
    id_chapter,
  } = useParams();

  const location =
    useLocation();

  const navigate =
    useNavigate();

  const [
    state,
    setState,
  ] = useState({
    status: "checking",
    data: null,
    error: "",
  });

  const [
    retryKey,
    setRetryKey,
  ] = useState(0);


  const verify = useCallback(
    async (signal) => {
      if (!token) {
        setState({
          status: "unauthenticated",
          data: null,
          error: "",
        });

        return;
      }

      const chapterId =
        Number(id_chapter);

      if (
        !Number.isInteger(chapterId)
        || chapterId <= 0
      ) {
        setState({
          status: "not-found",
          data: null,
          error: (
            "معرّف الوحدة غير صالح."
          ),
        });

        return;
      }

      try {
        setState({
          status: "checking",
          data: null,
          error: "",
        });

        const data =
          await checkChapterAccess({
            token,
            chapterId,
            signal,
          });

        if (signal.aborted) {
          return;
        }

        const reason =
          data?.reason || "";

        // Backend explicitly says inactive.
        if (reason === "inactive") {
          setState({
            status: "inactive",
            data,
            error:
              data?.detail ||
              "هذه الوحدة غير مفعّلة حاليًا.",
          });

          return;
        }

        // Paid but student has not bought it.
        if (
          data?.allowed !== true
          && reason ===
            "payment_required"
        ) {
          setState({
            status: "denied",
            data,
            error: "",
          });

          return;
        }

        if (
          data?.allowed !== true
        ) {
          setState({
            status: "error",
            data,
            error:
              data?.detail ||
              "تعذر تحديد صلاحية الوصول.",
          });

          return;
        }

        const subjectId =
          Number(
            data?.chapter
              ?.subject_id
          );

        const canonicalChapterId =
          Number(
            data?.chapter?.id
          );

        const chapterCode =
          data?.chapter?.code ||
          `chapter-${canonicalChapterId}`;

        if (
          !Number.isInteger(
            subjectId
          )
          ||
          !Number.isInteger(
            canonicalChapterId
          )
        ) {
          setState({
            status: "error",
            data,
            error: (
              "الخادم لم يُرجع بيانات الوحدة كاملة."
            ),
          });

          return;
        }

        const canonicalPath =
          buildLessonPath(
            subjectId,
            canonicalChapterId,
            chapterCode,
          );

        // Fix old URLs or incorrect subject/code without treating
        // them as an access failure.
        if (
          location.pathname
          !== canonicalPath
        ) {
          navigate(
            canonicalPath,
            {
              replace: true,
              state: {
                ...location.state,
                chapterTitle:
                  data?.chapter
                    ?.title,
                subjectId,
              },
            },
          );

          return;
        }

        setState({
          status: "allowed",
          data,
          error: "",
        });
      } catch (requestError) {
        if (
          requestError?.name ===
            "CanceledError"
          ||
          requestError?.code ===
            "ERR_CANCELED"
        ) {
          return;
        }

        const httpStatus =
          requestError?.response
            ?.status;

        if (httpStatus === 401) {
          setState({
            status:
              "unauthenticated",
            data: null,
            error: "",
          });

          return;
        }

        if (httpStatus === 404) {
          const detail =
            requestError?.response
              ?.data?.detail;

          setState({
            status: "not-found",
            data: null,
            error:
              detail ||
              (
                "Endpoint الوصول أعاد 404. "
                + "تأكد من إضافة access/chapters "
                + "داخل payments/urls.py."
              ),
          });

          return;
        }

        setState({
          status: "error",
          data: null,
          error:
            getApiErrorMessage(
              requestError,
              (
                "تعذر التحقق من "
                + "صلاحية الوصول إلى الوحدة."
              ),
            ),
        });
      }
    },
    [
      id_chapter,
      location.pathname,
      location.state,
      navigate,
      token,
    ],
  );


  useEffect(() => {
    const controller =
      new AbortController();

    verify(
      controller.signal
    );

    return () => {
      controller.abort();
    };
  }, [
    retryKey,
    verify,
  ]);


  if (
    state.status
    === "unauthenticated"
  ) {
    return (
      <Navigate
        to="/login"
        replace
        state={{
          from:
            location.pathname,
        }}
      />
    );
  }


  if (
    state.status
    === "denied"
  ) {
    const subjectId =
      state.data?.chapter
        ?.subject_id ||
      id_subjects;

    const chapterId =
      state.data?.chapter?.id ||
      id_chapter;

    return (
      <Navigate
        to={
          `/subjects/${subjectId}`
          + `?offer=${chapterId}`
        }
        replace
        state={{
          paymentRequired: true,
          requestedChapterId:
            chapterId,
        }}
      />
    );
  }


  if (
    state.status
    === "inactive"
  ) {
    return renderState({
      title:
        "الوحدة غير مفعّلة",
      message:
        state.error,
      buttonLabel:
        "العودة إلى المادة",
      onAction: () => {
        const subjectId =
          state.data?.chapter
            ?.subject_id ||
          id_subjects;

        navigate(
          subjectId
            ? `/subjects/${subjectId}`
            : "/subjects",
          {
            replace: true,
          },
        );
      },
    });
  }


  if (
    state.status
    === "not-found"
  ) {
    return renderState({
      title:
        "تعذر العثور على الوحدة",
      message:
        state.error ||
        "هذه الوحدة غير موجودة.",
      buttonLabel:
        "إعادة التحقق",
      onAction: () => {
        setRetryKey(
          (value) =>
            value + 1
        );
      },
    });
  }


  if (
    state.status === "error"
  ) {
    return renderState({
      title:
        "تعذر فتح الوحدة",
      message:
        state.error,
      buttonLabel:
        "إعادة التحقق",
      onAction: () => {
        setRetryKey(
          (value) =>
            value + 1
        );
      },
    });
  }


  if (
    state.status === "allowed"
  ) {
    return children;
  }


  return (
    <div
      dir="rtl"
      className="
        flex min-h-dvh
        items-center justify-center
        bg-slate-50 px-4
      "
    >
      <div
        className="
          flex flex-col
          items-center text-center
        "
      >
        <div
          className="
            relative flex
            h-16 w-16
            items-center
            justify-center
            rounded-2xl
            bg-violet-50
            text-violet-600
          "
        >
          <ShieldCheck
            size={26}
          />

          <Loader2
            size={18}
            className="
              absolute
              -bottom-1 -left-1
              animate-spin
              rounded-full
              bg-white
              text-violet-600
            "
          />
        </div>

        <p
          className="
            mt-4 text-sm
            font-black
            text-slate-800
          "
        >
          نتحقق من صلاحية الوحدة
        </p>

        <p
          className="
            mt-1 text-xs
            font-semibold
            text-slate-400
          "
        >
          لحظات فقط...
        </p>
      </div>
    </div>
  );
}


function renderState({
  title,
  message,
  buttonLabel,
  onAction,
}) {
  return (
    <div
      dir="rtl"
      className="
        flex min-h-dvh
        items-center justify-center
        bg-slate-50 px-4
      "
    >
      <div
        className="
          w-full max-w-md
          rounded-3xl
          border border-slate-200
          bg-white p-6
          text-center
          shadow-xl
          shadow-slate-200/50
        "
      >
        <div
          className="
            mx-auto flex
            h-14 w-14
            items-center
            justify-center
            rounded-2xl
            bg-amber-50
            text-amber-600
          "
        >
          <AlertTriangle
            size={26}
          />
        </div>

        <h1
          className="
            mt-4 text-lg
            font-black
            text-slate-900
          "
        >
          {title}
        </h1>

        <p
          className="
            mt-2 text-sm
            font-semibold
            leading-7
            text-slate-500
          "
        >
          {message}
        </p>

        <button
          type="button"
          onClick={onAction}
          className="
            mt-5 inline-flex
            h-11 items-center
            justify-center gap-2
            rounded-xl
            bg-violet-600
            px-5 text-sm
            font-black text-white
          "
        >
          <RefreshCw
            size={17}
          />
          {buttonLabel}
        </button>
      </div>
    </div>
  );
}
