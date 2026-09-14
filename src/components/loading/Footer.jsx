// import { Instagram, Youtube, Facebook, Music2 } from "lucide-react";
import logo from "../../assets/images/logo.svg";

export default function Footer() {
  return (
    <footer id="contact" className="bg-white py-10">
      <div className="container-page">
        <div className="grid gap-8 border-b border-slate-100 pb-8 md:grid-cols-[1.2fr_2fr_1fr] md:items-center">
          <div className="flex items-center gap-3">
            <img src={logo} alt="Backey" className="h-12 w-12" />
            <div>
              <div className="text-xl font-black">Backey</div>
              <div className="text-xs text-slate-500">منصة البكالوريا الجزائرية</div>
            </div>
          </div>

          <div className="flex flex-wrap gap-x-6 gap-y-3 text-sm font-semibold text-slate-500">
            <a href="#home">الرئيسية</a>
            <a href="#subjects">المواد</a>
            <a href="#features">مميزاتنا</a>
            <a href="#pricing">الأسعار</a>
            <a href="#contact">تواصل معنا</a>
          </div>

          {/* <div className="flex gap-2 md:justify-end">
            {[Music2, Instagram, Youtube, Facebook].map((Icon, index) => (
              <button key={index} className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
                <Icon size={18} />
              </button>
            ))}
          </div> */}
        </div>

        <div className="flex flex-col gap-3 pt-6 text-xs text-slate-400 sm:flex-row sm:items-center sm:justify-between">
          <p>© 2026 Backey. جميع الحقوق محفوظة.</p>
          <div className="flex gap-4">
            <a href="#">الشروط والأحكام</a>
            <a href="#">سياسة الخصوصية</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
