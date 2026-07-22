import { MathJaxContext } from "better-react-mathjax";

const mathJaxConfig = {
  loader: {
    load: ["input/tex", "output/chtml"],
  },

  tex: {
    inlineMath: [
      ["\\(", "\\)"],
      ["$", "$"],
    ],

    displayMath: [
      ["\\[", "\\]"],
      ["$$", "$$"],
    ],

    processEscapes: true,
    processEnvironments: true,

    packages: {
      "[+]": ["ams", "base", "autoload", "newcommand"],
    },
  },

  chtml: {
    scale: 1,
    matchFontHeight: false,
    displayAlign: "center",
    displayIndent: "0",
  },

  options: {
    skipHtmlTags: [
      "script",
      "noscript",
      "style",
      "textarea",
      "pre",
      "code",
    ],
  },

  startup: {
    typeset: false,
  },
};

export default function MathJaxProvider({ children }) {
  return (
    <MathJaxContext
      version={3}
      config={mathJaxConfig}
      src="https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-chtml.js"
    >
      {children}
    </MathJaxContext>
  );
}