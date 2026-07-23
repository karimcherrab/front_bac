import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import axios from "axios";
import Cookies from "js-cookie";

import {
  ArrowLeft,
  CheckCircle2,
  GraduationCap,
  LoaderCircle,
  Lock,
  Mail,
  X,
  XCircle,
} from "lucide-react";

import AuthInput from "./AuthInput";

const INITIAL_VALUES = {
  email: "",
  password: "",
};

export default function LoginForm() {
  const navigate = useNavigate();

  const studentUrl = import.meta.env.VITE_STUDENT_URL;

  const loginUrl = `${studentUrl?.replace(/\/+$/, "")}/login/`;

  const [formValues, setFormValues] = useState(INITIAL_VALUES);
  const [formErrors, setFormErrors] = useState({});

  const [isLoading, setIsLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  const [notification, setNotification] = useState({
    show: false,
    type: "success",
    message: "",
  });

  const showNotification = (type, message) => {
    setNotification({
      show: true,
      type,
      message,
    });
  };

  const closeNotification = () => {
    setNotification((previousNotification) => ({
      ...previousNotification,
      show: false,
    }));
  };

  const handleChange = (event) => {
    const { name, value } = event.target;

    setFormValues((previousValues) => ({
      ...previousValues,
      [name]: value,
    }));

    // حذف خطأ الحقل بمجرد أن يبدأ المستخدم بالكتابة
    if (formErrors[name]) {
      setFormErrors((previousErrors) => ({
        ...previousErrors,
        [name]: "",
      }));
    }

    if (notification.show) {
      closeNotification();
    }
  };

  const validateForm = () => {
    const errors = {};

    const email = formValues.email.trim();

    if (!email) {
      errors.email = "البريد الإلكتروني مطلوب.";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.email = "أدخل بريداً إلكترونياً صحيحاً.";
    }

    if (!formValues.password) {
      errors.password = "كلمة المرور مطلوبة.";
    }

    return errors;
  };

  const extractErrorMessage = (error) => {
    if (!error.response) {
      return "تعذر الاتصال بالخادم. تحقق من الإنترنت وتشغيل Django.";
    }

    const status = error.response.status;
    const data = error.response.data;

    if (status === 401 || status === 403) {
      return "البريد الإلكتروني أو كلمة المرور غير صحيحة.";
    }

    if (typeof data === "string") {
      return data;
    }

    if (data?.message) {
      return data.message;
    }

    if (data?.detail) {
      return data.detail;
    }

    if (data?.non_field_errors?.length > 0) {
      return data.non_field_errors[0];
    }

    if (data?.email?.length > 0) {
      return data.email[0];
    }

    if (data?.password?.length > 0) {
      return data.password[0];
    }

    if (status >= 500) {
      return "حدث خطأ داخل الخادم. حاول مرة أخرى.";
    }

    return "فشل تسجيل الدخول. تحقق من معلوماتك وحاول مجدداً.";
  };

  const getTokensFromResponse = (responseData) => {
    // يدعم:
    // { tokens: { access, refresh } }
    // أو { access, refresh }
    // أو { access_token, refresh_token }

    const accessToken =
      responseData?.tokens?.access ||
      responseData?.access ||
      responseData?.access_token;

    const refreshToken =
      responseData?.tokens?.refresh ||
      responseData?.refresh ||
      responseData?.refresh_token;

    return {
      accessToken,
      refreshToken,
    };
  };

  const saveAuthenticationData = (responseData) => {
    const { accessToken, refreshToken } =
      getTokensFromResponse(responseData);

    if (!accessToken) {
      throw new Error("ACCESS_TOKEN_MISSING");
    }

    const cookieOptions = {
      secure: import.meta.env.PROD,
      sameSite: "Lax",
      path: "/",
    };

    Cookies.set("access_token", accessToken, {
      ...cookieOptions,
      expires: rememberMe ? 1 : undefined,
    });

    if (refreshToken) {
      Cookies.set("refresh_token", refreshToken, {
        ...cookieOptions,
        expires: rememberMe ? 7 : undefined,
      });
    }

    // حفظ بيانات الطالب إن كانت موجودة في الرد
    if (responseData?.student) {
      localStorage.setItem(
        "student",
        JSON.stringify(responseData.student),
      );
    } else if (responseData?.user) {
      localStorage.setItem(
        "student",
        JSON.stringify(responseData.user),
      );
    }
  };

  const performLogin = async () => {
    if (!studentUrl) {
      showNotification(
        "error",
        "الرابط VITE_STUDENT_URL غير موجود في ملف البيئة.",
      );

      return;
    }

    setIsLoading(true);

    try {
      const response = await axios.post(
        loginUrl,
        {
          email: formValues.email.trim(),
          password: formValues.password,
        },
        {
          headers: {
            "Content-Type": "application/json",
          },
          timeout: 15000,
        },
      );

      saveAuthenticationData(response.data);

      setFormErrors({});

      showNotification(
        "success",
        "تم تسجيل الدخول بنجاح، مرحباً بك في MathMaster.",
      );

      // نترك رسالة النجاح ظاهرة قليلاً ثم ننتقل
      window.setTimeout(() => {
        navigate("/", {
          replace: true,
        });
      }, 1000);
    } catch (error) {
      console.error("Login error:", error);

      if (error.message === "ACCESS_TOKEN_MISSING") {
        showNotification(
          "error",
          "تم قبول الطلب، لكن الخادم لم يُرجع رمز الدخول access token.",
        );

        return;
      }

      const errorMessage = extractErrorMessage(error);

      showNotification("error", errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (isLoading) {
      return;
    }

    closeNotification();

    const errors = validateForm();

    setFormErrors(errors);

    if (Object.keys(errors).length > 0) {
      return;
    }

    await performLogin();
  };

  return (
    <>
      {/* رسالة النجاح أو الخطأ */}
      {notification.show && (
        <div
          dir="rtl"
          className="
            fixed left-1/2 top-6 z-[9999]
            w-[calc(100%-32px)] max-w-md
            -translate-x-1/2
            animate-[fadeIn_.25s_ease-out]
          "
        >
          <div
            role="alert"
            className={`
              flex items-start gap-3 rounded-2xl
              border px-5 py-4 shadow-2xl backdrop-blur-md
              ${
                notification.type === "success"
                  ? "border-emerald-200 bg-emerald-50/95 text-emerald-800"
                  : "border-red-200 bg-red-50/95 text-red-800"
              }
            `}
          >
            <div className="mt-0.5 shrink-0">
              {notification.type === "success" ? (
                <CheckCircle2 size={24} />
              ) : (
                <XCircle size={24} />
              )}
            </div>

            <p className="flex-1 text-sm font-bold leading-6">
              {notification.message}
            </p>

            <button
              type="button"
              onClick={closeNotification}
              aria-label="إغلاق الرسالة"
              className="
                shrink-0 rounded-lg p-1
                transition hover:bg-black/5
              "
            >
              <X size={18} />
            </button>
          </div>
        </div>
      )}

      <section
        className="
          flex flex-col justify-center
          px-6 py-10
          sm:px-14
          lg:min-h-[700px] lg:px-20
        "
      >
        <div
          className="
            mx-auto mb-8 flex h-16 w-16
            items-center justify-center rounded-full
            bg-brand-50 text-brand-600
          "
        >
          <GraduationCap size={34} />
        </div>

        <div className="mb-10 text-center">
          <h2 className="text-3xl font-bold text-ink-900 sm:text-4xl">
            مرحباً بك مجدداً 👋
          </h2>

          <p className="mt-3 text-slate-500">
            سجل دخولك لمتابعة رحلتك التعليمية
          </p>
        </div>

        <form
          className="space-y-5"
          onSubmit={handleSubmit}
          noValidate
        >
          <div>
            <AuthInput
              label="البريد الإلكتروني"
              type="email"
              placeholder="أدخل بريدك الإلكتروني"
              icon={Mail}
              value={formValues.email}
              onChange={handleChange}
              name="email"
              disabled={isLoading}
              autoComplete="email"
            />

            {formErrors.email && (
              <p className="mt-2 text-sm font-medium text-red-600">
                {formErrors.email}
              </p>
            )}
          </div>

          <div>
            <AuthInput
              label="كلمة المرور"
              type="password"
              placeholder="أدخل كلمة المرور"
              icon={Lock}
              value={formValues.password}
              onChange={handleChange}
              name="password"
              disabled={isLoading}
              autoComplete="current-password"
            />

            {formErrors.password && (
              <p className="mt-2 text-sm font-medium text-red-600">
                {formErrors.password}
              </p>
            )}
          </div>

          <div className="flex items-center justify-between gap-4 text-sm">
            <label
              className="
                flex cursor-pointer items-center gap-2
                text-slate-600
              "
            >
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(event) =>
                  setRememberMe(event.target.checked)
                }
                disabled={isLoading}
                className="
                  h-4 w-4 cursor-pointer
                  accent-brand-600
                  disabled:cursor-not-allowed
                "
              />

              تذكرني
            </label>

            <Link
              to="/forgot-password"
              className="
                font-bold text-brand-600
                transition hover:text-brand-700
              "
            >
              نسيت كلمة المرور؟
            </Link>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="
              mt-4 flex w-full items-center justify-center
              gap-3 rounded-2xl bg-brand-600
              py-4 text-lg font-bold text-white
              shadow-lg shadow-brand-500/30
              transition
              hover:bg-brand-700
              disabled:cursor-not-allowed
              disabled:bg-brand-400
              disabled:shadow-none
            "
          >
            {isLoading ? (
              <>
                <LoaderCircle
                  size={23}
                  className="animate-spin"
                />

                جارٍ تسجيل الدخول...
              </>
            ) : (
              <>
                تسجيل الدخول
                <ArrowLeft size={22} />
              </>
            )}
          </button>
        </form>

        <p className="mt-8 text-center text-slate-500">
          ليس لديك حساب؟{" "}

          <Link
            to="/signup"
            className="
              font-bold text-brand-600
              transition hover:text-brand-700
            "
          >
            إنشاء حساب جديد
          </Link>
        </p>
      </section>
    </>
  );
}