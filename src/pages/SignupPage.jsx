// SignupPage.jsx
import SignUpBrandPanel from "../components/SignupPage/SignUpBrandPanel";
import SignUpForm from "../components/SignupPage/SignUpForm";

export default function SignupPage() {
  return (
    <div
      dir="rtl"
      className="min-h-screen bg-[#f7f8ff] flex items-center justify-center px-6 py-8 font-sans"
    >
      <div className="w-full max-w-6xl overflow-hidden rounded-[32px] bg-white shadow-2xl grid grid-cols-1 lg:grid-cols-2">
        <SignUpBrandPanel />
        <div className="flex h-full items-center justify-center px-6 py-6 lg:px-10">
          <SignUpForm />
        </div>
      </div>
    </div>
  );
}