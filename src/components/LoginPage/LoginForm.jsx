import { GraduationCap, Mail, Lock, Eye, ArrowLeft } from "lucide-react";
import AuthInput from "./AuthInput";
import SocialLoginButtons from "./SocialLoginButtons";

import Alert from "../UI/Alert";
import Cookies from "js-cookie";
import { useNavigate ,Link} from "react-router-dom";
import axios from "axios"
import { useState } from "react";

export default function LoginForm() {
  const STUDENT_URL = import.meta.env.VITE_STUDENT_URL;
  const URL_LOGIN = `${STUDENT_URL}login/`;
  console.log(URL_LOGIN)
  const navigate = useNavigate();
  
  const [isLoading, setIsLoading] = useState(false);
  const initialValues = {  email: "", password: "" };
  const [formValues, setFormValues] = useState(initialValues);
  const [formErrors, setFormErrors] = useState({});
  const [alert, setAlert] = useState({
    show: false,
    type: "success",
    message: "",
  });

  const handleChange = (e) => {
      const { name, value } = e.target;
      console.log(value)
      setFormValues({ ...formValues, [name]: value });
    };
  
  const handleSubmit = async (e) => {
      e.preventDefault();
      const errors = validate(formValues);
      setFormErrors(errors);
      // If there are no form errors, proceed with API call
      if (Object.keys(errors).length === 0 ) {
        setIsLoading(true); // Start loading indicator
        performLogIn();
      }
    };
  
    const performLogIn = async () => {
      try {
        const response = await axios.post(URL_LOGIN, 
        {
          "email": formValues.email,
          "password":  formValues.password,
        }
        
        );
        console.log(response)
        if (response.status === 200) {
          // Sign-up successful
          console.log('User registered successfully.');
            Cookies.set("access_token", response.data.tokens.access, {
            expires: 1,      // 1 jour
            secure: false,   // true en production (HTTPS)
            sameSite: "Lax",
          });
  
          Cookies.set("refresh_token", response.data.tokens.refresh, {
            expires: 7,      // 7 jours
            secure: false,
            sameSite: "Lax",
          });
  
           setAlert({
            show: true,
            type: "success",
            message: "🎉 Votre compte a été créé avec succès.",
          });
            setFormValues(initialValues);
  
            setTimeout(() => {
              setAlert((prev) => ({
                ...prev,
                show: false,
              }));
            }, 3000);
               navigate("/", { replace: true });
          // Redirect or show success message
        }
      } catch (error) {
        console.error('Error during sign-up:', error);
        // if(error.response.data.message === "email already exists"){
  
        //   setFormErrors({fullName:error.response.data.message})
        // }
        // Handle error, show error message, etc.
        if(error.response.data.message === "Email already exists"){
  
          setFormErrors({email:error.response.data.message})
        }
      }
      setIsLoading(false); // Stop loading indicator
    }
  const validate = (values) => {
    const errors = {};
  

  
    if (!values.email) {
      errors.email = "Email obligatoire";
    }
  
    if (!values.password) {
      errors.password = "Mot de passe obligatoire";
    }
  

  
    return errors;
  };
  


  return (
    <div className="px-8 py-10 sm:px-14 lg:px-20 flex flex-col justify-center">
      <div className="mx-auto mb-8 flex h-16 w-16 items-center justify-center rounded-full bg-brand-50 text-brand-600">
        <GraduationCap size={34} />
      </div>

      <div className="mb-10 text-center">
        <h2 className="text-4xl font-bold text-ink-900">
          مرحباً بك مجدداً 👋
        </h2>
        <p className="mt-3 text-slate-500">
          سجل دخولك لمتابعة رحلتك التعليمية
        </p>
      </div>

      <form className="space-y-5" onSubmit={handleSubmit}>
        <AuthInput
          label="البريد الإلكتروني"
          type="email"
          placeholder="أدخل بريدك الإلكتروني"
          icon={Mail}
          value={formValues.email}
          onChange={handleChange}
          name="email"
        />

        <AuthInput
          label="كلمة المرور"
          type="password"
          placeholder="أدخل كلمة المرور"
          icon={Lock}
          rightIcon={Eye}
          value={formValues.password}
          onChange={handleChange}
          name="password"
        />

        <div className="flex items-center justify-between text-sm">
          <label className="flex items-center gap-2 text-slate-600">
            <input
              type="checkbox"
              defaultChecked
              className="h-4 w-4 accent-brand-600"
            />
            تذكرني
          </label>

          <button type="button" className="font-bold text-brand-600">
            نسيت كلمة المرور؟
          </button>
        </div>

        <button
          type="submit"
          className="mt-4 flex w-full items-center justify-center gap-3 rounded-2xl bg-brand-600 py-4 text-lg font-bold text-white shadow-lg shadow-brand-500/30 transition hover:bg-brand-700"
        >
          تسجيل الدخول
          <ArrowLeft size={22} />
        </button>
      </form>

      {/* <SocialLoginButtons /> */}

      <p className="mt-8 text-center text-slate-500">
        ليس لديك حساب؟{" "}
          <Link
            to="/signup"
 className="font-bold text-brand-600"          >
               إنشاء حساب جديد
          </Link>
        {/* <button className="font-bold text-brand-600" >

          إنشاء حساب جديد
        </button> */}
      </p>
    </div>
  );
}