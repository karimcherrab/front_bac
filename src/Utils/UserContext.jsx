// UserContext.jsx
import { createContext, useState } from "react";

export const UserContext = createContext();
import Cookies from "js-cookie";

export function UserProvider({ children }) {
  const [chapter, setChapter] = useState(null);
  const [current_axis, setCurrent_axis] = useState(null);
  const [token, setToken] = useState(Cookies.get("access_token"));
  // const [token, setToken] = useState("");
  const [activeId, setActiveId] = useState("intro");
  return (
    <UserContext.Provider value={{ chapter, setChapter,current_axis,setCurrent_axis,token,setToken ,setActiveId,activeId}}>
      {children}
    </UserContext.Provider>
  );
}