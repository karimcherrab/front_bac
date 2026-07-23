import SignUpBrandPanel from "../components/SignupPage/SignUpBrandPanel";
import SignUpForm from "../components/SignupPage/SignUpForm";

export default function SignupPage() {
  return (
    <main
      dir="rtl"
      className="
        flex min-h-screen items-center justify-center
        bg-[#f7f8ff] px-4 py-6 font-sans
        sm:px-6 sm:py-8
      "
    >
      <div
        className="
          grid w-full max-w-6xl grid-cols-1
          overflow-hidden rounded-[32px]
          bg-white shadow-2xl
          lg:grid-cols-2
        "
      >
        <SignUpBrandPanel />

        <div
          className="
            flex min-h-[700px] items-center
            justify-center px-6 py-8
            lg:px-10
          "
        >
          <SignUpForm />
        </div>
      </div>
    </main>
  );
}