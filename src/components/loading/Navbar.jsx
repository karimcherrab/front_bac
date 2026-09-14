import { useState } from "react";
import { Menu, X, UserRound, ArrowLeft } from "lucide-react";
import logo from "../../assets/images/logo.svg";

const links = [
  ["الرئيسية", "#home"],
  ["المواد", "#subjects"],
  ["مميزاتنا", "#features"],
  ["الأسعار", "#pricing"],
  ["آراء التلاميذ", "#testimonials"],
  ["تواصل معنا", "#contact"],
];

export default function Navbar() {
  const [open, setOpen] = useState(false);

  return (
    <header className="absolute inset-x-0 top-0 z-50">
      <div className="container-page flex h-20 items-center justify-between">
        <a href="#home" className="flex items-center gap-3">
          <img src={logo} alt="Backey" className="h-11 w-11" />
          <div className="leading-tight text-white">
            <div className="text-xl font-black tracking-tight">Backey</div>
            <div className="text-[11px] text-slate-300">نحو باك أفضل</div>
          </div>
        </a>

        <nav className="hidden items-center gap-7 lg:flex">
          {links.map(([label, href], index) => (
            <a
              key={label}
              href={href}
              className={`text-sm font-semibold transition hover:text-white ${
                index === 0 ? "text-white" : "text-slate-300"
              }`}
            >
              {label}
            </a>
          ))}
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          <button className="flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-5 py-2.5 text-sm font-bold text-white backdrop-blur hover:bg-white/15">
            <UserRound size={17} />
            تسجيل الدخول
          </button>
          <button className="flex items-center gap-2 rounded-full bg-gradient-to-l from-blue-500 to-indigo-600 px-5 py-2.5 text-sm font-extrabold text-white shadow-lg shadow-blue-500/25 hover:brightness-110">
            ابدأ مجانًا
            <ArrowLeft size={17} />
          </button>
        </div>

        <button
          className="rounded-xl border border-white/20 bg-white/10 p-2 text-white lg:hidden"
          onClick={() => setOpen(!open)}
          aria-label="القائمة"
        >
          {open ? <X /> : <Menu />}
        </button>
      </div>

      {open && (
        <div className="container-page rounded-2xl border border-white/10 bg-[#0a1d3a]/95 p-5 shadow-2xl backdrop-blur-xl lg:hidden">
          <div className="grid gap-2">
            {links.map(([label, href]) => (
              <a
                key={label}
                href={href}
                onClick={() => setOpen(false)}
                className="rounded-xl px-4 py-3 font-semibold text-slate-200 hover:bg-white/10"
              >
                {label}
              </a>
            ))}
          </div>
        </div>
      )}
    </header>
  );
}
