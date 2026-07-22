import { Search, Bell, ChevronDown, ChevronLeft } from "lucide-react";
import { currentUser } from "../data/lessonData";
import Cookies from "js-cookie";
import { useNavigate } from "react-router-dom";

function Breadcrumb({ items }) {
  return (
    <nav className="hidden items-center gap-2 text-sm text-slate-500 md:flex">
      {items.map((item, i) => (
        <span key={item.label} className="flex items-center gap-2">
          <a
            href={item.href}
            className={
              i === items.length - 1
                ? "font-semibold text-ink-900"
                : "text-slate-400 hover:text-slate-600"
            }
          >
            {item.label}
          </a>
          {i < items.length - 1 && (
            <ChevronLeft size={14} className="text-slate-300" />
          )}
        </span>
      ))}
    </nav>
  );
}

function UserMenu({ user }) {
    const navigate = useNavigate();

const logout = () => {

  Cookies.remove("access_token");
  Cookies.remove("refresh_token");
  Cookies.remove("user");

  navigate("/login", { replace: true });
};
  const initials = user.name?.charAt(0) ?? "؟";
  return (
    <button className="flex items-center gap-2 rounded-full py-1 pl-2 pr-1 hover:bg-slate-50" onClick={logout}>
      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-100 text-sm font-bold text-brand-700 ring-2 ring-brand-200">
        {initials}
      </div>
      <div className="hidden text-right leading-tight sm:block" 
      
      >
        <p className="text-sm font-bold text-ink-900">LogOut</p>
        <p className="text-xs text-slate-400">{user.level}</p>
      </div>
      <ChevronDown size={16} className="text-slate-400" />
    </button>
  );
}

export default function Navbar({ breadcrumb }) {
  return (
    <header className="flex h-16 items-center justify-between border-b border-slate-100 bg-white px-6">
      <Breadcrumb items={breadcrumb} />

      <div className="flex items-center gap-3">
        <button
          aria-label="بحث"
          className="flex h-10 w-10 items-center justify-center rounded-full text-slate-500 hover:bg-slate-50"
        >
          <Search size={18} />
        </button>
        <button
          aria-label="الإشعارات"
          className="relative flex h-10 w-10 items-center justify-center rounded-full text-slate-500 hover:bg-slate-50"
        >
          <Bell size={18} />
          <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-rose-500" />
        </button>
        <UserMenu user={currentUser} />
      </div>
    </header>
  );
}
