import {
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  Link,
  useNavigate,
} from "react-router-dom";

import axios from "axios";
import Select from "react-select";

import {
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  LoaderCircle,
  Lock,
  Mail,
  User,
  X,
  XCircle,
} from "lucide-react";

import {
  UserContext,
} from "../../Utils/UserContext";

const INITIAL_VALUES = {
  username: "",
  email: "",
  password: "",
  branch: "",
  acceptTerms: false,
};

export default function SignUpForm() {
  const navigate = useNavigate();

  /*
   * login تحفظ Cookies وتحدث token داخل Context
   * فوراً، لذلك لا نحتاج إلى Refresh.
   */
  const { login } =
    useContext(UserContext);

  const studentUrl =
    import.meta.env.VITE_STUDENT_URL;

  const courseUrl =
    import.meta.env.VITE_COURSE_URL;

  const signupUrl = studentUrl
    ? `${studentUrl.replace(/\/+$/, "")}/signup/`
    : "";

  const branchesUrl = courseUrl
    ? `${courseUrl.replace(/\/+$/, "")}/branches/`
    : "";

  const [formValues, setFormValues] =
    useState(INITIAL_VALUES);

  const [formErrors, setFormErrors] =
    useState({});

  const [branches, setBranches] =
    useState([]);

  const [
    isLoadingBranches,
    setIsLoadingBranches,
  ] = useState(false);

  const [
    branchesError,
    setBranchesError,
  ] = useState("");

  const [isLoading, setIsLoading] =
    useState(false);

  const [
    showPassword,
    setShowPassword,
  ] = useState(false);

  const [
    notification,
    setNotification,
  ] = useState({
    show: false,
    type: "success",
    message: "",
  });

  const showNotification = (
    type,
    message,
  ) => {
    setNotification({
      show: true,
      type,
      message,
    });
  };

  const closeNotification = () => {
    setNotification((previous) => ({
      ...previous,
      show: false,
    }));
  };

  useEffect(() => {
    const controller =
      new AbortController();

    const getBranches = async () => {
      if (!branchesUrl) {
        setBranches([]);
        setBranchesError(
          "VITE_COURSE_URL غير موجود داخل ملف .env.",
        );

        return;
      }

      setIsLoadingBranches(true);
      setBranchesError("");

      try {
        const response = await axios.get(
          branchesUrl,
          {
            signal: controller.signal,
            headers: {
              Accept: "application/json",
            },
            timeout: 15000,
          },
        );

        const branchesData =
          Array.isArray(
            response.data?.branches,
          )
            ? response.data.branches
            : Array.isArray(response.data)
              ? response.data
              : [];

        const formattedBranches =
          branchesData.map((branch) => ({
            value:
              branch.code ||
              String(branch.id),

            label:
              branch.name ||
              branch.title ||
              branch.code,

            id: branch.id,
            code: branch.code,
          }));

        setBranches(formattedBranches);
      } catch (error) {
        if (
          error.code === "ERR_CANCELED" ||
          error.name === "CanceledError"
        ) {
          return;
        }

        console.error(
          "Branches loading error:",
          error,
        );

        setBranches([]);

        if (
          error.code === "ECONNABORTED"
        ) {
          setBranchesError(
            "انتهت مدة الاتصال أثناء تحميل الشعب.",
          );
        } else if (!error.response) {
          setBranchesError(
            "تعذر الاتصال بالخادم لتحميل الشعب.",
          );
        } else {
          setBranchesError(
            error.response?.data?.message ||
              error.response?.data?.detail ||
              "تعذر تحميل الشعب.",
          );
        }
      } finally {
        setIsLoadingBranches(false);
      }
    };

    getBranches();

    return () => {
      controller.abort();
    };
  }, [branchesUrl]);

  const retryGetBranches = async () => {
    if (!branchesUrl) {
      setBranchesError(
        "VITE_COURSE_URL غير موجود داخل ملف .env.",
      );

      return;
    }

    setIsLoadingBranches(true);
    setBranchesError("");

    try {
      const response = await axios.get(
        branchesUrl,
        {
          headers: {
            Accept: "application/json",
          },
          timeout: 15000,
        },
      );

      const branchesData =
        Array.isArray(
          response.data?.branches,
        )
          ? response.data.branches
          : Array.isArray(response.data)
            ? response.data
            : [];

      setBranches(
        branchesData.map((branch) => ({
          value:
            branch.code ||
            String(branch.id),

          label:
            branch.name ||
            branch.title ||
            branch.code,

          id: branch.id,
          code: branch.code,
        })),
      );
    } catch (error) {
      console.error(
        "Retry branches error:",
        error,
      );

      setBranchesError(
        error.response?.data?.message ||
          error.response?.data?.detail ||
          "تعذر تحميل الشعب. تحقق من تشغيل الخادم.",
      );
    } finally {
      setIsLoadingBranches(false);
    }
  };

  const handleChange = (event) => {
    const {
      name,
      value,
      type,
      checked,
    } = event.target;

    setFormValues((previous) => ({
      ...previous,
      [name]:
        type === "checkbox"
          ? checked
          : value,
    }));

    setFormErrors((previous) => ({
      ...previous,
      [name]: "",
      general: "",
    }));

    if (notification.show) {
      closeNotification();
    }
  };

  const handleBranchChange = (
    selectedOption,
  ) => {
    setFormValues((previous) => ({
      ...previous,
      branch:
        selectedOption?.value || "",
    }));

    setFormErrors((previous) => ({
      ...previous,
      branch: "",
      general: "",
    }));

    if (notification.show) {
      closeNotification();
    }
  };

  const validateForm = () => {
    const errors = {};

    const username =
      formValues.username.trim();

    const email =
      formValues.email.trim();

    if (!username) {
      errors.username =
        "الاسم الكامل إجباري.";
    } else if (username.length < 2) {
      errors.username =
        "الاسم يجب أن يحتوي على حرفين على الأقل.";
    }

    if (!email) {
      errors.email =
        "البريد الإلكتروني إجباري.";
    } else if (
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
        email,
      )
    ) {
      errors.email =
        "البريد الإلكتروني غير صحيح.";
    }

    if (!formValues.password) {
      errors.password =
        "كلمة المرور إجبارية.";
    } else if (
      formValues.password.length < 8
    ) {
      errors.password =
        "كلمة المرور يجب أن تحتوي على 8 أحرف على الأقل.";
    }

    if (!formValues.branch) {
      errors.branch =
        "يرجى اختيار الشعبة.";
    }

    if (!formValues.acceptTerms) {
      errors.acceptTerms =
        "يجب الموافقة على الشروط والأحكام.";
    }

    return errors;
  };

  const getFirstError = (value) => {
    if (Array.isArray(value)) {
      return String(value[0] || "");
    }

    if (typeof value === "string") {
      return value;
    }

    return "";
  };

  const extractApiErrors = (error) => {
    if (
      error.code === "ECONNABORTED"
    ) {
      return {
        general:
          "انتهت مدة الاتصال بالخادم. حاول مجدداً.",
      };
    }

    if (!error.response) {
      return {
        general:
          "تعذر الاتصال بالخادم. تحقق من تشغيل Django والإنترنت.",
      };
    }

    const data =
      error.response.data || {};

    const errors = {};

    if (data.username) {
      errors.username =
        getFirstError(data.username);
    }

    if (data.email) {
      errors.email =
        getFirstError(data.email);
    }

    if (data.password) {
      errors.password =
        getFirstError(data.password);
    }

    if (data.branch) {
      errors.branch =
        getFirstError(data.branch);
    }

    if (data.non_field_errors) {
      errors.general =
        getFirstError(
          data.non_field_errors,
        );
    }

    if (
      data.message &&
      !errors.general
    ) {
      errors.general =
        getFirstError(data.message);
    }

    if (
      data.detail &&
      !errors.general
    ) {
      errors.general =
        getFirstError(data.detail);
    }

    if (
      Object.keys(errors).length === 0
    ) {
      if (
        error.response.status >= 500
      ) {
        errors.general =
          "حدث خطأ داخل الخادم أثناء إنشاء الحساب.";
      } else {
        errors.general =
          "تعذر إنشاء الحساب. تحقق من المعلومات.";
      }
    }

    return errors;
  };

  const getAuthenticationData = (
    responseData,
  ) => {
    const accessToken =
      responseData?.tokens?.access ||
      responseData?.access ||
      responseData?.access_token;

    const refreshToken =
      responseData?.tokens?.refresh ||
      responseData?.refresh ||
      responseData?.refresh_token;

    const userData =
      responseData?.student ||
      responseData?.user ||
      responseData?.data?.student ||
      null;

    return {
      accessToken,
      refreshToken,
      userData,
    };
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (isLoading) {
      return;
    }

    closeNotification();

    const errors = validateForm();

    setFormErrors(errors);

    if (
      Object.keys(errors).length > 0
    ) {
      return;
    }

    if (!signupUrl) {
      showNotification(
        "error",
        "VITE_STUDENT_URL غير موجود داخل ملف .env.",
      );

      return;
    }

    setIsLoading(true);

    try {
      const payload = {
        username:
          formValues.username.trim(),

        email:
          formValues.email
            .trim()
            .toLowerCase(),

        password:
          formValues.password,

        /*
         * نرسل branch code مثل:
         * math أو science
         */
        branch:
          formValues.branch,
      };

      const response = await axios.post(
        signupUrl,
        payload,
        {
          headers: {
            "Content-Type":
              "application/json",

            Accept:
              "application/json",
          },
          timeout: 15000,
        },
      );

      const {
        accessToken,
        refreshToken,
        userData,
      } = getAuthenticationData(
        response.data,
      );

      /*
       * بعض Endpoints ترجع 200،
       * وبعضها ترجع 201.
       */
      if (
        response.status !== 200 &&
        response.status !== 201
      ) {
        throw new Error(
          "UNEXPECTED_RESPONSE",
        );
      }

      if (!accessToken) {
        /*
         * إذا كان Signup لا يرجع tokens،
         * لا ندخل المستخدم تلقائياً.
         */
        setFormValues(INITIAL_VALUES);
        setFormErrors({});

        showNotification(
          "success",
          "تم إنشاء حسابك بنجاح. يمكنك الآن تسجيل الدخول.",
        );

        window.setTimeout(() => {
          navigate("/login", {
            replace: true,
          });
        }, 1200);

        return;
      }

      /*
       * تحديث Context مباشرة.
       * هذا يمنع مشكلة ظهور المواد فقط بعد Refresh.
       */
      login({
        accessToken,
        refreshToken,
        userData,
        rememberMe: true,
      });

      setFormValues(INITIAL_VALUES);
      setFormErrors({});

      showNotification(
        "success",
        "تم إنشاء حسابك وتسجيل دخولك بنجاح.",
      );

      window.setTimeout(() => {
        navigate("/", {
          replace: true,
        });
      }, 900);
    } catch (error) {
      console.error(
        "Signup error:",
        error.response?.data || error,
      );

      if (
        error.message ===
        "UNEXPECTED_RESPONSE"
      ) {
        showNotification(
          "error",
          "أرجع الخادم استجابة غير متوقعة.",
        );

        return;
      }

      const apiErrors =
        extractApiErrors(error);

      setFormErrors(apiErrors);

      showNotification(
        "error",
        apiErrors.general ||
          apiErrors.username ||
          apiErrors.email ||
          apiErrors.password ||
          apiErrors.branch ||
          "تعذر إنشاء الحساب.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  const selectedBranch = useMemo(
    () =>
      branches.find(
        (branch) =>
          branch.value ===
          formValues.branch,
      ) || null,
    [
      branches,
      formValues.branch,
    ],
  );

  const passwordInputBox = `
    flex items-center rounded-2xl border
    bg-slate-50 px-4 transition
    focus-within:bg-white focus-within:ring-4
    ${
      formErrors.password
        ? "border-red-400 focus-within:border-red-500 focus-within:ring-red-100"
        : "border-slate-200 focus-within:border-brand-500 focus-within:ring-brand-100"
    }
  `;

  const selectStyles = {
    control: (
      provided,
      state,
    ) => ({
      ...provided,

      minHeight: "50px",
      borderRadius: "16px",
      paddingLeft: "6px",
      paddingRight: "6px",
      backgroundColor: "#f8fafc",

      borderColor:
        formErrors.branch
          ? "#f87171"
          : state.isFocused
            ? "#3b82f6"
            : "#e2e8f0",

      boxShadow:
        state.isFocused
          ? formErrors.branch
            ? "0 0 0 4px #fee2e2"
            : "0 0 0 4px #dbeafe"
          : "none",

      cursor: "pointer",
      direction: "rtl",

      "&:hover": {
        borderColor:
          formErrors.branch
            ? "#ef4444"
            : "#3b82f6",
      },
    }),

    valueContainer: (
      provided,
    ) => ({
      ...provided,
      padding: "4px 8px",
    }),

    placeholder: (
      provided,
    ) => ({
      ...provided,
      color: "#94a3b8",
      fontSize: "14px",
    }),

    singleValue: (
      provided,
    ) => ({
      ...provided,
      color: "#0f172a",
      fontSize: "14px",
      fontWeight: "600",
    }),

    menu: (provided) => ({
      ...provided,
      borderRadius: "14px",
      overflow: "hidden",
      zIndex: 50,
      direction: "rtl",
    }),

    option: (
      provided,
      state,
    ) => ({
      ...provided,

      cursor: "pointer",
      fontSize: "14px",
      textAlign: "right",

      backgroundColor:
        state.isSelected
          ? "#2563eb"
          : state.isFocused
            ? "#eff6ff"
            : "white",

      color:
        state.isSelected
          ? "white"
          : "#334155",
    }),

    indicatorSeparator: () => ({
      display: "none",
    }),
  };

  return (
    <>
      {notification.show && (
        <div
          dir="rtl"
          className="
            fixed left-1/2 top-6
            z-[9999] w-[calc(100%-32px)]
            max-w-md -translate-x-1/2
          "
        >
          <div
            role="alert"
            className={`
              flex items-start gap-3 rounded-2xl
              border px-5 py-4 shadow-2xl
              backdrop-blur-md
              ${
                notification.type ===
                "success"
                  ? "border-emerald-200 bg-emerald-50/95 text-emerald-800"
                  : "border-red-200 bg-red-50/95 text-red-800"
              }
            `}
          >
            <div className="mt-0.5 shrink-0">
              {notification.type ===
              "success" ? (
                <CheckCircle2 size={24} />
              ) : (
                <XCircle size={24} />
              )}
            </div>

            <p
              className="
                flex-1 text-sm font-bold
                leading-6
              "
            >
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

      <div
        className="w-full max-w-md"
        dir="rtl"
      >
        <Link
          to="/"
          className="
            mb-4 inline-flex items-center
            gap-2 text-sm text-slate-500
            transition hover:text-brand-600
          "
        >
          <ArrowRight size={17} />
          العودة إلى الرئيسية
        </Link>

        <div className="mb-6">
          <h1
            className="
              text-3xl font-black
              text-slate-900
            "
          >
            إنشاء حساب
          </h1>

          <p className="mt-2 text-sm text-slate-500">
            ابدأ رحلتك نحو التفوق في
            البكالوريا.
          </p>
        </div>

        {formErrors.general && (
          <div
            className="
              mb-4 rounded-2xl border
              border-red-200 bg-red-50
              px-4 py-3 text-sm
              font-medium text-red-700
            "
          >
            {formErrors.general}
          </div>
        )}

        <form
          className="space-y-3.5"
          onSubmit={handleSubmit}
          noValidate
        >
          <Field
            label="الاسم الكامل"
            icon={<User size={19} />}
            error={formErrors.username}
          >
            <input
              name="username"
              type="text"
              autoComplete="name"
              placeholder="أدخل اسمك الكامل"
              value={formValues.username}
              onChange={handleChange}
              disabled={isLoading}
              className="
                w-full bg-transparent px-3
                py-3 text-sm outline-none
                disabled:cursor-not-allowed
                disabled:opacity-60
              "
            />
          </Field>

          <Field
            label="البريد الإلكتروني"
            icon={<Mail size={19} />}
            error={formErrors.email}
          >
            <input
              name="email"
              type="email"
              autoComplete="email"
              placeholder="example@email.com"
              value={formValues.email}
              onChange={handleChange}
              disabled={isLoading}
              className="
                w-full bg-transparent px-3
                py-3 text-left text-sm
                outline-none
                disabled:cursor-not-allowed
                disabled:opacity-60
              "
              dir="ltr"
            />
          </Field>

          <div>
            <label
              className="
                mb-1.5 block text-sm
                font-semibold text-slate-700
              "
            >
              كلمة المرور
            </label>

            <div
              className={
                passwordInputBox
              }
            >
              <Lock
                size={19}
                className="
                  shrink-0 text-slate-400
                "
              />

              <input
                name="password"
                type={
                  showPassword
                    ? "text"
                    : "password"
                }
                autoComplete="new-password"
                placeholder="********"
                value={
                  formValues.password
                }
                onChange={handleChange}
                disabled={isLoading}
                className="
                  w-full bg-transparent
                  px-3 py-3 text-sm
                  outline-none
                  disabled:cursor-not-allowed
                  disabled:opacity-60
                "
              />

              <button
                type="button"
                onClick={() =>
                  setShowPassword(
                    (previous) =>
                      !previous,
                  )
                }
                disabled={isLoading}
                aria-label={
                  showPassword
                    ? "إخفاء كلمة المرور"
                    : "إظهار كلمة المرور"
                }
                className="
                  shrink-0 text-slate-400
                  transition
                  hover:text-brand-600
                  disabled:cursor-not-allowed
                "
              >
                {showPassword ? (
                  <EyeOff size={19} />
                ) : (
                  <Eye size={19} />
                )}
              </button>
            </div>

            {formErrors.password && (
              <p
                className="
                  mt-1.5 text-xs
                  font-medium text-red-500
                "
              >
                {formErrors.password}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <label
              className="
                block text-sm font-semibold
                text-slate-700
              "
            >
              الشعبة
            </label>

            <Select
              options={branches}
              value={selectedBranch}
              onChange={
                handleBranchChange
              }
              placeholder={
                isLoadingBranches
                  ? "جاري تحميل الشعب..."
                  : "🎓 اختر الشعبة"
              }
              isLoading={
                isLoadingBranches
              }
              isDisabled={
                isLoadingBranches ||
                isLoading
              }
              isClearable
              isSearchable
              noOptionsMessage={() =>
                branchesError
                  ? "تعذر تحميل الشعب"
                  : "لا توجد شعب"
              }
              loadingMessage={() =>
                "جاري التحميل..."
              }
              styles={selectStyles}
            />

            {branchesError && (
              <div
                className="
                  flex items-center
                  justify-between gap-3
                "
              >
                <p
                  className="
                    text-xs font-medium
                    text-red-500
                  "
                >
                  {branchesError}
                </p>

                <button
                  type="button"
                  onClick={
                    retryGetBranches
                  }
                  disabled={
                    isLoadingBranches
                  }
                  className="
                    shrink-0 text-xs
                    font-bold text-brand-600
                    hover:underline
                    disabled:cursor-not-allowed
                    disabled:opacity-50
                  "
                >
                  إعادة المحاولة
                </button>
              </div>
            )}

            {formErrors.branch && (
              <p
                className="
                  text-xs font-medium
                  text-red-500
                "
              >
                {formErrors.branch}
              </p>
            )}
          </div>

          <div>
            <label
              className="
                flex cursor-pointer
                items-start gap-3 text-xs
                leading-6 text-slate-600
              "
            >
              <input
                name="acceptTerms"
                type="checkbox"
                checked={
                  formValues.acceptTerms
                }
                onChange={handleChange}
                disabled={isLoading}
                className="
                  mt-1 h-4 w-4 rounded
                  border-slate-300
                  accent-brand-600
                "
              />

              <span>
                أوافق على{" "}

                <span
                  className="
                    font-bold
                    text-brand-600
                  "
                >
                  الشروط والأحكام
                </span>{" "}

                وسياسة الخصوصية.
              </span>
            </label>

            {formErrors.acceptTerms && (
              <p
                className="
                  mt-1 text-xs
                  font-medium text-red-500
                "
              >
                {formErrors.acceptTerms}
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={
              isLoading ||
              isLoadingBranches ||
              branches.length === 0
            }
            className="
              flex w-full items-center
              justify-center gap-2
              rounded-2xl bg-brand-600
              py-3.5 text-base font-bold
              text-white shadow-lg
              shadow-brand-600/25
              transition hover:bg-brand-700
              disabled:cursor-not-allowed
              disabled:bg-slate-400
              disabled:shadow-none
            "
          >
            {isLoading ? (
              <>
                <LoaderCircle
                  size={20}
                  className="animate-spin"
                />

                جاري إنشاء الحساب...
              </>
            ) : (
              "إنشاء الحساب"
            )}
          </button>

          <p
            className="
              text-center text-sm
              text-slate-500
            "
          >
            لديك حساب بالفعل؟

            <Link
              to="/login"
              className="
                mr-2 font-bold
                text-brand-600
                hover:underline
              "
            >
              تسجيل الدخول
            </Link>
          </p>
        </form>
      </div>
    </>
  );
}

function Field({
  label,
  icon,
  children,
  error,
}) {
  return (
    <div>
      <label
        className="
          mb-1.5 block text-sm
          font-semibold text-slate-700
        "
      >
        {label}
      </label>

      <div
        className={`
          flex items-center rounded-2xl
          border bg-slate-50 px-4
          transition focus-within:bg-white
          focus-within:ring-4
          ${
            error
              ? "border-red-400 focus-within:border-red-500 focus-within:ring-red-100"
              : "border-slate-200 focus-within:border-brand-500 focus-within:ring-brand-100"
          }
        `}
      >
        <span
          className="
            shrink-0 text-slate-400
          "
        >
          {icon}
        </span>

        {children}
      </div>

      {error && (
        <p
          className="
            mt-1.5 text-xs
            font-medium text-red-500
          "
        >
          {error}
        </p>
      )}
    </div>
  );
}