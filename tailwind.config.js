/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Tajawal", "Cairo", "sans-serif"],
      },
      colors: {
        brand: {
          50: "#f1efff",
          100: "#e4e0ff",
          200: "#c9c2ff",
          300: "#a99dff",
          400: "#8b7cff",
          500: "#6c4ef5",
          600: "#5a3bdb",
          700: "#4a2eb8",
          800: "#2563EB",
          900: "#15123a",
        },
        ink: {
          900: "#181a2e",
        },
      },
      boxShadow: {
        soft: "0 2px 10px 0 rgb(20 20 50 / 0.06)",
        card: "0 1px 3px 0 rgb(20 20 50 / 0.08)",
      },
      borderRadius: {
        xl2: "1.1rem",
      },
    },
  },
  plugins: [],
};
