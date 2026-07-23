import React from "react";

import LoginBrandPanel from "../components/LoginPage/LoginBrandPanel";
import LoginForm from "../components/LoginPage/LoginForm";

export default function LogInPage() {
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
        <LoginBrandPanel />
        <LoginForm />
      </div>
    </main>
  );
}