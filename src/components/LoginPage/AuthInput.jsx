export default function AuthInput({
  label,
  type = "text",
  placeholder,
  icon: Icon,
  rightIcon: RightIcon,
  value,
  onChange,
  name

}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-bold text-slate-700">
        {label}
      </label>

      <div className="relative">
        {Icon && (
          <Icon
            size={21}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400"
          />
        )}

        {RightIcon && (
          <RightIcon
            size={21}
            className="absolute left-4 top-1/2 -translate-y-1/2 cursor-pointer text-slate-400"
          />
        )}

        <input
          type={type}
          placeholder={placeholder}
          value={value}
          onChange={onChange}
          name = {name}
          className="w-full rounded-2xl border border-slate-200 bg-white py-4 pr-12 pl-12 text-right outline-none transition focus:border-brand-500 focus:ring-4 focus:ring-brand-100"
        />
      </div>
    </div>
  );
}