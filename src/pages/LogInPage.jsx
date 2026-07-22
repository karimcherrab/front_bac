import React from 'react'
import LoginBrandPanel from '../components/LoginPage/LoginBrandPanel'
import LoginForm from '../components/LoginPage/LoginForm'

const LogInPage = () => {
   return (
    <div
      dir="rtl"
      className="min-h-screen bg-[#f7f8ff] flex items-center justify-center px-6 py-8 font-sans"
    >
      <div className="w-full max-w-6xl overflow-hidden rounded-[32px] bg-white shadow-2xl grid grid-cols-1 lg:grid-cols-2">
        <LoginBrandPanel />
        <LoginForm />
      </div>
    </div>
  );
}

export default LogInPage