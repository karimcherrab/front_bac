import Cookies from "js-cookie";
import { Navigate } from "react-router-dom";

export default function GuestRoute({ children }) {
  const token = Cookies.get("access_token");

  if (token) {
    return <Navigate to="/" replace />;
  }

  return children;
}