import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.jsx";
import "./index.css";
import {UserProvider} from './Utils/UserContext.jsx'
import "katex/dist/katex.min.css";
import { MathJaxContext } from "better-react-mathjax";
import MathJaxProvider from "./Utils/MathJaxProvider";


ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <MathJaxProvider>
      <UserProvider>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </UserProvider>
    </MathJaxProvider>
  </React.StrictMode>
);