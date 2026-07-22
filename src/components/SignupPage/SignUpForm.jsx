 // SignUpForm.jsx

import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  User,
  Mail,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  LoaderCircle,
} from "lucide-react";
import axios from "axios";
import Select from "react-select";
import Cookies from "js-cookie";

import Alert from "../UI/Alert";

export default function SignUpForm() {
  const navigate = useNavigate();
  const STUDENT_URL = import.meta.env.VITE_STUDENT_URL;
  const COURSE_URL = import.meta.env.VITE_COURSE_URL;

  const URL_SIGNUP = `${STUDENT_URL}signup/`;
  const URL_BRANCHES = `${COURSE_URL}branches/`;

  // const URL_SIGNUP =
  //   "http://127.0.0.1:8000/api/account/signup/";

  // const URL_BRANCHES =
  //   "http://127.0.0.1:8000/api/course/branches/";

  const initialValues = {
    username: "",
    email: "",
    password: "",
    branch: "",
    acceptTerms: false,
  };

  const [formValues, setFormValues] =
    useState(initialValues);

  const [formErrors, setFormErrors] =
    useState({});

  const [branches, setBranches] =
    useState([]);

  const [
    isLoadingBranches,
    setIsLoadingBranches,
  ] = useState(false);

  const [branchesError, setBranchesError] =
    useState("");

  const [isLoading, setIsLoading] =
    useState(false);

  const [showPassword, setShowPassword] =
    useState(false);

  const [alert, setAlert] = useState({
    show: false,
    type: "success",
    message: "",
  });

  useEffect(() => {
    getBranches();
  }, []);

  const getBranches = async () => {
    setIsLoadingBranches(true);
    setBranchesError("");

    try {
      const response = await axios.get(
        URL_BRANCHES
      );

      const branchesData =
        response.data?.branches || [];

      const formattedBranches =
        branchesData.map((branch) => ({
          value: branch.code,
          label: branch.name,
          id: branch.id,
          code: branch.code,
        }));

      setBranches(formattedBranches);
    } catch (error) {
      console.error(
        "Erreur chargement branches :",
        error
      );

      setBranchesError(
        "تعذر تحميل الشعب. تحقق من تشغيل الخادم."
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

    setFormValues((previousValues) => ({
      ...previousValues,
      [name]:
        type === "checkbox"
          ? checked
          : value,
    }));

    setFormErrors((previousErrors) => ({
      ...previousErrors,
      [name]: "",
      general: "",
    }));
  };

  const handleBranchChange = (
    selectedOption
  ) => {
    setFormValues((previousValues) => ({
      ...previousValues,
      branch:
        selectedOption?.value || "",
    }));

    setFormErrors((previousErrors) => ({
      ...previousErrors,
      branch: "",
      general: "",
    }));
  };

  const validate = (values) => {
    const errors = {};

    const username =
      values.username.trim();

    const email =
      values.email.trim();

    if (!username) {
      errors.username =
        "الاسم الكامل إجباري";
    } else if (username.length < 2) {
      errors.username =
        "الاسم يجب أن يحتوي على حرفين على الأقل";
    }

    if (!email) {
      errors.email =
        "البريد الإلكتروني إجباري";
    } else if (
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
        email
      )
    ) {
      errors.email =
        "البريد الإلكتروني غير صحيح";
    }

    if (!values.password) {
      errors.password =
        "كلمة المرور إجبارية";
    } else if (
      values.password.length < 8
    ) {
      errors.password =
        "كلمة المرور يجب أن تحتوي على 8 أحرف على الأقل";
    }

    if (!values.branch) {
      errors.branch =
        "يرجى اختيار الشعبة";
    }

    if (!values.acceptTerms) {
      errors.acceptTerms =
        "يجب الموافقة على الشروط والأحكام";
    }

    return errors;
  };

  const getFirstError = (value) => {
    if (Array.isArray(value)) {
      return value[0];
    }

    if (typeof value === "string") {
      return value;
    }

    return "";
  };

  const extractApiErrors = (error) => {
    const data = error.response?.data;

    if (!data) {
      return {
        general:
          "تعذر الاتصال بالخادم. تحقق من تشغيل Django.",
      };
    }

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
          data.non_field_errors
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
      errors.general =
        "حدث خطأ أثناء إنشاء الحساب.";
    }

    return errors;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    const errors =
      validate(formValues);

    setFormErrors(errors);

    if (
      Object.keys(errors).length > 0
    ) {
      return;
    }

    setIsLoading(true);
    setAlert((previousAlert) => ({
      ...previousAlert,
      show: false,
    }));

    try {
      /*
       * StudentSerializer يستعمل:
       *
       * branch = serializers.SlugRelatedField(
       *   slug_field="code",
       *   queryset=Branch.objects.all(),
       * )
       *
       * لذلك نرسل branch code مثل:
       * "math" أو "science"
       */
      const payload = {
        username:
          formValues.username.trim(),

        email:
          formValues.email
            .trim()
            .toLowerCase(),

        password:
          formValues.password,

        branch:
          formValues.branch,
      };

      console.log(
        "Signup payload:",
        payload
      );

      const response = await axios.post(
        URL_SIGNUP,
        payload,
        {
          headers: {
            "Content-Type":
              "application/json",
          },
        }
      );

      if (response.status === 201) {
        const accessToken =
          response.data?.tokens?.access;

        const refreshToken =
          response.data?.tokens?.refresh;

        if (accessToken) {
          Cookies.set(
            "access_token",
            accessToken,
            {
              expires: 1,
              secure:
                window.location
                  .protocol === "https:",
              sameSite: "Lax",
            }
          );
        }

        if (refreshToken) {
          Cookies.set(
            "refresh_token",
            refreshToken,
            {
              expires: 7,
              secure:
                window.location
                  .protocol === "https:",
              sameSite: "Lax",
            }
          );
        }

        setFormValues(initialValues);
        setFormErrors({});

        setAlert({
          show: true,
          type: "success",
          message:
            "🎉 تم إنشاء حسابك بنجاح.",
        });

        setTimeout(() => {
          navigate("/", {
            replace: true,
          });
        }, 1000);
      }
    } catch (error) {
      console.error(
        "Erreur inscription :",
        error.response?.data || error
      );

      const apiErrors =
        extractApiErrors(error);

      setFormErrors(apiErrors);

      setAlert({
        show: true,
        type: "error",
        message:
          apiErrors.general ||
          apiErrors.username ||
          apiErrors.email ||
          apiErrors.password ||
          apiErrors.branch ||
          "تعذر إنشاء الحساب.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const selectedBranch =
    branches.find(
      (branch) =>
        branch.value ===
        formValues.branch
    ) || null;

  const passwordInputBox = `
    flex items-center rounded-2xl border bg-slate-50 px-4
    transition focus-within:bg-white focus-within:ring-4
    ${
      formErrors.password
        ? "border-red-400 focus-within:border-red-500 focus-within:ring-red-100"
        : "border-slate-200 focus-within:border-brand-500 focus-within:ring-brand-100"
    }
  `;

  const selectStyles = {
    control: (
      provided,
      state
    ) => ({
      ...provided,
      minHeight: "50px",
      borderRadius: "16px",
      paddingLeft: "6px",
      paddingRight: "6px",
      backgroundColor: "#f8fafc",

      borderColor: formErrors.branch
        ? "#f87171"
        : state.isFocused
          ? "#3b82f6"
          : "#e2e8f0",

      boxShadow: state.isFocused
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
      provided
    ) => ({
      ...provided,
      padding: "4px 8px",
    }),

    placeholder: (
      provided
    ) => ({
      ...provided,
      color: "#94a3b8",
      fontSize: "14px",
    }),

    singleValue: (
      provided
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
      state
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

      color: state.isSelected
        ? "white"
        : "#334155",
    }),

    indicatorSeparator: () => ({
      display: "none",
    }),
  };

  return (
    <div
      className="w-full max-w-md"
      dir="rtl"
    >
      <Link
        to="/"
        className="mb-4 inline-flex items-center gap-2 text-sm text-slate-500 transition hover:text-brand-600"
      >
        <ArrowRight size={17} />
        العودة إلى الرئيسية
      </Link>

      <div className="mb-6">
        <h1 className="text-3xl font-black text-slate-900">
          إنشاء حساب
        </h1>

        <p className="mt-2 text-sm text-slate-500">
          ابدأ رحلتك نحو التفوق في
          البكالوريا.
        </p>
      </div>

      {formErrors.general && (
        <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
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
            className="w-full bg-transparent px-3 py-3 text-sm outline-none disabled:cursor-not-allowed disabled:opacity-60"
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
            className="w-full bg-transparent px-3 py-3 text-left text-sm outline-none disabled:cursor-not-allowed disabled:opacity-60"
            dir="ltr"
          />
        </Field>

        <div>
          <label className="mb-1.5 block text-sm font-semibold text-slate-700">
            كلمة المرور
          </label>

          <div
            className={
              passwordInputBox
            }
          >
            <Lock
              className="shrink-0 text-slate-400"
              size={19}
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
              value={formValues.password}
              onChange={handleChange}
              disabled={isLoading}
              className="w-full bg-transparent px-3 py-3 text-sm outline-none disabled:cursor-not-allowed disabled:opacity-60"
            />

            <button
              type="button"
              onClick={() =>
                setShowPassword(
                  (previousValue) =>
                    !previousValue
                )
              }
              disabled={isLoading}
              className="shrink-0 text-slate-400 transition hover:text-brand-600 disabled:cursor-not-allowed"
              aria-label={
                showPassword
                  ? "إخفاء كلمة المرور"
                  : "إظهار كلمة المرور"
              }
            >
              {showPassword ? (
                <EyeOff size={19} />
              ) : (
                <Eye size={19} />
              )}
            </button>
          </div>

          {formErrors.password && (
            <p className="mt-1.5 text-xs font-medium text-red-500">
              {formErrors.password}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-semibold text-slate-700">
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
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-medium text-red-500">
                {branchesError}
              </p>

              <button
                type="button"
                onClick={getBranches}
                className="shrink-0 text-xs font-bold text-brand-600 hover:underline"
              >
                إعادة المحاولة
              </button>
            </div>
          )}

          {formErrors.branch && (
            <p className="text-xs font-medium text-red-500">
              {formErrors.branch}
            </p>
          )}
        </div>

        <div>
          <label className="flex cursor-pointer items-start gap-3 text-xs leading-6 text-slate-600">
            <input
              name="acceptTerms"
              type="checkbox"
              checked={
                formValues.acceptTerms
              }
              onChange={handleChange}
              disabled={isLoading}
              className="mt-1 h-4 w-4 rounded border-slate-300 accent-brand-600"
            />

            <span>
              أوافق على
              <span className="font-bold text-brand-600">
                {" "}
                الشروط والأحكام{" "}
              </span>
              وسياسة الخصوصية.
            </span>
          </label>

          {formErrors.acceptTerms && (
            <p className="mt-1 text-xs font-medium text-red-500">
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
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-brand-600 py-3.5 text-base font-bold text-white shadow-lg shadow-brand-600/25 transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-slate-400 disabled:shadow-none"
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

        <p className="text-center text-sm text-slate-500">
          لديك حساب بالفعل؟
          <Link
            to="/login"
            className="mr-2 font-bold text-brand-600 hover:underline"
          >
            تسجيل الدخول
          </Link>
        </p>
      </form>

      {alert.show && (
        <Alert
          type={alert.type}
          message={alert.message}
          onClose={() =>
            setAlert(
              (previousAlert) => ({
                ...previousAlert,
                show: false,
              })
            )
          }
        />
      )}
    </div>
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
      <label className="mb-1.5 block text-sm font-semibold text-slate-700">
        {label}
      </label>

      <div
        className={`
          flex items-center rounded-2xl border bg-slate-50 px-4
          transition focus-within:bg-white focus-within:ring-4
          ${
            error
              ? "border-red-400 focus-within:border-red-500 focus-within:ring-red-100"
              : "border-slate-200 focus-within:border-brand-500 focus-within:ring-brand-100"
          }
        `}
      >
        <span className="shrink-0 text-slate-400">
          {icon}
        </span>

        {children}
      </div>

      {error && (
        <p className="mt-1.5 text-xs font-medium text-red-500">
          {error}
        </p>
      )}
    </div>
  );
}