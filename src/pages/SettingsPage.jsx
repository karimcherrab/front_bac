// src/pages/SettingsPage.jsx

import {
  Eye,
  EyeOff,
  LockKeyhole,
  Save,
  Settings,
  UserRound,
} from "lucide-react";

import {
  useContext,
  useEffect,
  useState,
} from "react";

import axios from "axios";
import Cookies from "js-cookie";

import {
  UserContext,
} from "../Utils/UserContext";


function extractErrorMessage(error) {
  if (
    error?.code ===
    "ECONNABORTED"
  ) {
    return "انتهت مهلة الاتصال بالخادم.";
  }

  if (!error?.response) {
    return "تعذر الاتصال بالخادم. تحقق من تشغيل Django وعنوان API.";
  }

  const data =
    error.response.data;

  if (!data) {
    return "حدث خطأ غير متوقع.";
  }

  if (
    typeof data === "string"
  ) {
    return data;
  }

  if (data.message) {
    return data.message;
  }

  if (data.detail) {
    return data.detail;
  }

  const keys =
    Object.keys(data);

  if (keys.length === 0) {
    return "حدث خطأ غير متوقع.";
  }

  const firstError =
    data[keys[0]];

  if (
    Array.isArray(firstError)
  ) {
    return firstError[0];
  }

  if (
    typeof firstError === "string"
  ) {
    return firstError;
  }

  if (
    firstError &&
    typeof firstError === "object"
  ) {
    const nestedKeys =
      Object.keys(firstError);

    if (
      nestedKeys.length > 0
    ) {
      const nestedError =
        firstError[
          nestedKeys[0]
        ];

      if (
        Array.isArray(
          nestedError,
        )
      ) {
        return nestedError[0];
      }

      if (
        typeof nestedError ===
        "string"
      ) {
        return nestedError;
      }
    }
  }

  return "حدث خطأ غير متوقع.";
}


function getAuthConfig() {
  const accessToken =
    Cookies.get(
      "access_token",
    );

  return {
    headers: {
      "Content-Type":
        "application/json",

      ...(accessToken
        ? {
            Authorization:
              `Bearer ${accessToken}`,
          }
        : {}),
    },

    timeout: 15000,
  };
}


export default function SettingsPage() {
  const {
    user,
    setUser,
  } = useContext(UserContext);

  const [
    student,
    setStudent,
  ] = useState(
    user || null,
  );

  const [
    pageLoading,
    setPageLoading,
  ] = useState(true);

  const [
    nameLoading,
    setNameLoading,
  ] = useState(false);

  const [
    passwordLoading,
    setPasswordLoading,
  ] = useState(false);

  const [
    pageError,
    setPageError,
  ] = useState("");

  const [
    nameForm,
    setNameForm,
  ] = useState({
    new_username: "",
    confirm_username: "",
  });

  const [
    passwordForm,
    setPasswordForm,
  ] = useState({
    current_password: "",
    new_password: "",
    confirm_password: "",
  });

  const [
    showCurrentPassword,
    setShowCurrentPassword,
  ] = useState(false);

  const [
    showNewPassword,
    setShowNewPassword,
  ] = useState(false);

  const [
    showConfirmPassword,
    setShowConfirmPassword,
  ] = useState(false);

  const [
    nameMessage,
    setNameMessage,
  ] = useState({
    type: "",
    text: "",
  });

  const [
    passwordMessage,
    setPasswordMessage,
  ] = useState({
    type: "",
    text: "",
  });

  /*
   * نحتفظ بـ baseUrl
   * كما هو في مشروعك.
   *
   * مثال:
   * VITE_STUDENT_URL=
   * http://127.0.0.1:8000/api/accounts/
   */
  const baseUrl =
    import.meta.env
      .VITE_STUDENT_URL;


  useEffect(() => {
    let mounted = true;

    async function loadProfile() {
      setPageLoading(true);
      setPageError("");

      try {
        const response =
          await axios.get(
            `${baseUrl}me/`,
            getAuthConfig(),
          );

        if (!mounted) {
          return;
        }

        const currentStudent =
          response.data.student;

        setStudent(
          currentStudent,
        );

        if (setUser) {
          setUser(
            currentStudent,
          );
        }
      } catch (error) {
        console.error(
          "Profile loading error:",
          error,
        );

        if (!mounted) {
          return;
        }

        setPageError(
          extractErrorMessage(
            error,
          ),
        );
      } finally {
        if (mounted) {
          setPageLoading(false);
        }
      }
    }

    loadProfile();

    return () => {
      mounted = false;
    };
  }, [
    baseUrl,
    setUser,
  ]);


  function handleNameChange(
    event,
  ) {
    const {
      name,
      value,
    } = event.target;

    setNameForm(
      (previous) => ({
        ...previous,
        [name]: value,
      }),
    );

    setNameMessage({
      type: "",
      text: "",
    });
  }


  function handlePasswordChange(
    event,
  ) {
    const {
      name,
      value,
    } = event.target;

    setPasswordForm(
      (previous) => ({
        ...previous,
        [name]: value,
      }),
    );

    setPasswordMessage({
      type: "",
      text: "",
    });
  }


  async function handleNameSubmit(
    event,
  ) {
    event.preventDefault();

    setNameMessage({
      type: "",
      text: "",
    });

    const newUsername =
      nameForm
        .new_username
        .trim();

    const confirmUsername =
      nameForm
        .confirm_username
        .trim();

    if (!newUsername) {
      setNameMessage({
        type: "error",
        text:
          "أدخل الاسم الجديد.",
      });

      return;
    }

    if (
      newUsername.length < 2
    ) {
      setNameMessage({
        type: "error",
        text:
          "يجب أن يحتوي الاسم على حرفين على الأقل.",
      });

      return;
    }

    if (
      newUsername !==
      confirmUsername
    ) {
      setNameMessage({
        type: "error",
        text:
          "تأكيد الاسم غير مطابق.",
      });

      return;
    }

    try {
      setNameLoading(true);

      const response =
        await axios.patch(
          `${baseUrl}settings/name/`,
          {
            new_username:
              newUsername,

            confirm_username:
              confirmUsername,
          },
          getAuthConfig(),
        );

      const updatedStudent =
        response.data.student;

      setStudent(
        updatedStudent,
      );

      if (setUser) {
        setUser(
          updatedStudent,
        );
      }

      localStorage.setItem(
        "student",
        JSON.stringify(
          updatedStudent,
        ),
      );

      setNameForm({
        new_username: "",
        confirm_username: "",
      });

      setNameMessage({
        type: "success",
        text:
          response.data.message ||
          "تم تغيير الاسم بنجاح.",
      });
    } catch (error) {
      console.error(
        "Update name error:",
        error,
      );

      setNameMessage({
        type: "error",
        text:
          extractErrorMessage(
            error,
          ),
      });
    } finally {
      setNameLoading(false);
    }
  }


  async function handlePasswordSubmit(
    event,
  ) {
    event.preventDefault();

    setPasswordMessage({
      type: "",
      text: "",
    });

    const {
      current_password,
      new_password,
      confirm_password,
    } = passwordForm;

    if (
      !current_password ||
      !new_password ||
      !confirm_password
    ) {
      setPasswordMessage({
        type: "error",
        text:
          "أكمل جميع حقول كلمة المرور.",
      });

      return;
    }

    if (
      new_password.length < 8
    ) {
      setPasswordMessage({
        type: "error",
        text:
          "يجب أن تحتوي كلمة المرور الجديدة على 8 أحرف على الأقل.",
      });

      return;
    }

    if (
      new_password !==
      confirm_password
    ) {
      setPasswordMessage({
        type: "error",
        text:
          "تأكيد كلمة المرور غير مطابق.",
      });

      return;
    }

    if (
      current_password ===
      new_password
    ) {
      setPasswordMessage({
        type: "error",
        text:
          "يجب أن تكون كلمة المرور الجديدة مختلفة عن الحالية.",
      });

      return;
    }

    try {
      setPasswordLoading(true);

      const response =
        await axios.patch(
          `${baseUrl}settings/password/`,
          {
            current_password,
            new_password,
            confirm_password,
          },
          getAuthConfig(),
        );

      setPasswordForm({

        
        current_password: "",
        new_password: "",
        confirm_password: "",
      });

      setShowCurrentPassword(
        false,
      );

      setShowNewPassword(
        false,
      );

      setShowConfirmPassword(
        false,
      );

      setPasswordMessage({
        type: "success",
        text:
          response.data.message ||
          "تم تغيير كلمة المرور بنجاح.",
      });
    } catch (error) {
      console.error(
        "Update password error:",
        error,
      );

      setPasswordMessage({
        type: "error",
        text:
          extractErrorMessage(
            error,
          ),
      });
    } finally {
      setPasswordLoading(false);
    }
  }


  if (pageLoading) {
    return (
      <div
        dir="rtl"
        className="
          flex h-full min-h-0
          items-center
          justify-center
          overflow-hidden
          bg-[#fafbff]
        "
      >
        <div
          className="
            h-10 w-10
            animate-spin
            rounded-full
            border-4
            border-violet-200
            border-t-violet-600
          "
        />
      </div>
    );
  }


  return (
    <main
      dir="rtl"
      className="
        h-full min-h-0
        overflow-y-auto
        overscroll-contain
        bg-[#fafbff]
        px-6 py-8
        font-[Tajawal]
        lg:px-10
      "
    >
      <div
        className="
          mx-auto
          max-w-6xl
          pb-12
        "
      >
        <header className="mb-8">
          <div
            className="
              mb-2 flex
              items-center gap-3
            "
          >
            <div
              className="
                flex h-11 w-11
                items-center
                justify-center
                rounded-2xl
                bg-violet-100
                text-violet-600
              "
            >
              <Settings
                size={23}
              />
            </div>

            <h1
              className="
                text-3xl
                font-bold
                text-slate-900
              "
            >
              الإعدادات
            </h1>
          </div>

          <p
            className="
              pr-14 text-sm
              text-slate-500
            "
          >
            إدارة معلومات حسابك
          </p>
        </header>


        {pageError && (
          <div
            className="
              mb-6 rounded-2xl
              border border-red-200
              bg-red-50
              px-5 py-4
              text-sm font-semibold
              text-red-700
            "
          >
            {pageError}
          </div>
        )}


        <section
          className="
            mb-6 rounded-3xl
            border border-slate-100
            bg-white p-6
            shadow-[0_8px_30px_rgba(15,23,42,0.05)]
            md:p-8
          "
        >
          <div
            className="
              mb-7 flex
              items-start gap-4
              border-b
              border-slate-100
              pb-6
            "
          >
            <div
              className="
                flex h-12 w-12
                shrink-0
                items-center
                justify-center
                rounded-2xl
                bg-violet-100
                text-violet-600
              "
            >
              <UserRound
                size={24}
              />
            </div>

            <div>
              <h2
                className="
                  text-xl
                  font-bold
                  text-slate-900
                "
              >
                تغيير الاسم
              </h2>

              <p
                className="
                  mt-1 text-sm
                  text-slate-500
                "
              >
                تحديث الاسم الذي يظهر
                داخل المنصة
              </p>
            </div>
          </div>

          <form
            onSubmit={
              handleNameSubmit
            }
            className="space-y-5"
          >
            <div
              className="
                grid gap-5
                md:grid-cols-2
              "
            >
              <Field
                label="الاسم الحالي"
                value={
                  student?.username ||
                  ""
                }
                disabled
              />

              <Field
                label="الاسم الجديد"
                name="new_username"
                value={
                  nameForm
                    .new_username
                }
                onChange={
                  handleNameChange
                }
                placeholder={
                  "أدخل الاسم الجديد"
                }
              />

              <Field
                label={
                  "تأكيد الاسم الجديد"
                }
                name={
                  "confirm_username"
                }
                value={
                  nameForm
                    .confirm_username
                }
                onChange={
                  handleNameChange
                }
                placeholder={
                  "أعد إدخال الاسم الجديد"
                }
              />
            </div>

            <MessageBox
              message={nameMessage}
            />

            <button
              type="submit"
              disabled={nameLoading}
              className="
                inline-flex min-h-11
                items-center
                justify-center
                gap-2 rounded-xl
                bg-gradient-to-l
                from-violet-600
                to-indigo-600
                px-6 text-sm
                font-bold text-white
                shadow-lg
                shadow-violet-200
                transition
                hover:-translate-y-0.5
                hover:shadow-xl
                disabled:cursor-not-allowed
                disabled:opacity-60
              "
            >
              <Save size={18} />

              {nameLoading
                ? "جارٍ الحفظ..."
                : "حفظ التغييرات"}
            </button>
          </form>
        </section>


        <section
          className="
            rounded-3xl
            border border-slate-100
            bg-white p-6
            shadow-[0_8px_30px_rgba(15,23,42,0.05)]
            md:p-8
          "
        >
          <div
            className="
              mb-7 flex
              items-start gap-4
              border-b
              border-slate-100
              pb-6
            "
          >
            <div
              className="
                flex h-12 w-12
                shrink-0
                items-center
                justify-center
                rounded-2xl
                bg-violet-100
                text-violet-600
              "
            >
              <LockKeyhole
                size={24}
              />
            </div>

            <div>
              <h2
                className="
                  text-xl
                  font-bold
                  text-slate-900
                "
              >
                تغيير كلمة السر
              </h2>

              <p
                className="
                  mt-1 text-sm
                  text-slate-500
                "
              >
                اختر كلمة مرور قوية
                لحماية حسابك
              </p>
            </div>
          </div>

          <form
            onSubmit={
              handlePasswordSubmit
            }
            className="space-y-5"
          >
            <div
              className="
                grid gap-5
                md:grid-cols-2
              "
            >
              <PasswordField
                label={
                  "كلمة السر الحالية"
                }
                name={
                  "current_password"
                }
                value={
                  passwordForm
                    .current_password
                }
                onChange={
                  handlePasswordChange
                }
                placeholder={
                  "أدخل كلمة السر الحالية"
                }
                visible={
                  showCurrentPassword
                }
                onToggle={() =>
                  setShowCurrentPassword(
                    (previous) =>
                      !previous,
                  )
                }
              />

              <PasswordField
                label={
                  "كلمة السر الجديدة"
                }
                name="new_password"
                value={
                  passwordForm
                    .new_password
                }
                onChange={
                  handlePasswordChange
                }
                placeholder={
                  "أدخل كلمة السر الجديدة"
                }
                visible={
                  showNewPassword
                }
                onToggle={() =>
                  setShowNewPassword(
                    (previous) =>
                      !previous,
                  )
                }
              />

              <PasswordField
                label={
                  "تأكيد كلمة السر الجديدة"
                }
                name={
                  "confirm_password"
                }
                value={
                  passwordForm
                    .confirm_password
                }
                onChange={
                  handlePasswordChange
                }
                placeholder={
                  "أعد إدخال كلمة السر الجديدة"
                }
                visible={
                  showConfirmPassword
                }
                onToggle={() =>
                  setShowConfirmPassword(
                    (previous) =>
                      !previous,
                  )
                }
              />
            </div>

            <MessageBox
              message={
                passwordMessage
              }
            />

            <button
              type="submit"
              disabled={
                passwordLoading
              }
              className="
                inline-flex min-h-11
                items-center
                justify-center
                gap-2 rounded-xl
                bg-gradient-to-l
                from-violet-600
                to-indigo-600
                px-6 text-sm
                font-bold text-white
                shadow-lg
                shadow-violet-200
                transition
                hover:-translate-y-0.5
                hover:shadow-xl
                disabled:cursor-not-allowed
                disabled:opacity-60
              "
            >
              <LockKeyhole
                size={18}
              />

              {passwordLoading
                ? "جارٍ التحديث..."
                : "تحديث كلمة السر"}
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}


function Field({
  label,
  disabled = false,
  ...props
}) {
  return (
    <label className="block">
      <span
        className="
          mb-2 block
          text-sm font-semibold
          text-slate-700
        "
      >
        {label}
      </span>

      <input
        {...props}
        disabled={disabled}
        className="
          h-12 w-full
          rounded-xl
          border border-slate-200
          bg-white px-4
          text-sm text-slate-800
          outline-none transition
          placeholder:text-slate-400
          focus:border-violet-500
          focus:ring-4
          focus:ring-violet-100
          disabled:cursor-not-allowed
          disabled:bg-slate-50
          disabled:text-slate-500
        "
      />
    </label>
  );
}


function PasswordField({
  label,
  visible,
  onToggle,
  ...props
}) {
  return (
    <label className="block">
      <span
        className="
          mb-2 block
          text-sm font-semibold
          text-slate-700
        "
      >
        {label}
      </span>

      <div className="relative">
        <input
          {...props}
          type={
            visible
              ? "text"
              : "password"
          }
          className="
            h-12 w-full
            rounded-xl
            border border-slate-200
            bg-white px-4 pl-12
            text-sm text-slate-800
            outline-none transition
            placeholder:text-slate-400
            focus:border-violet-500
            focus:ring-4
            focus:ring-violet-100
          "
        />

        <button
          type="button"
          onClick={onToggle}
          className="
            absolute left-3
            top-1/2 flex
            h-8 w-8
            -translate-y-1/2
            items-center
            justify-center
            rounded-lg
            text-slate-400
            transition
            hover:bg-violet-50
            hover:text-violet-600
          "
        >
          {visible ? (
            <EyeOff size={18} />
          ) : (
            <Eye size={18} />
          )}
        </button>
      </div>
    </label>
  );
}


function MessageBox({
  message,
}) {
  if (!message?.text) {
    return null;
  }

  const success =
    message.type ===
    "success";

  return (
    <div
      className={`
        rounded-xl border
        px-4 py-3
        text-sm font-medium

        ${
          success
            ? `
              border-emerald-200
              bg-emerald-50
              text-emerald-700
            `
            : `
              border-red-200
              bg-red-50
              text-red-700
            `
        }
      `}
    >
      {message.text}
    </div>
  );
}