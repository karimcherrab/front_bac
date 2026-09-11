import React, {useEffect, useState} from "react";
import IslamicMemoryPractice from "./IslamicMemoryPractice";
import GeneratedBacExercisesPage from "./GeneratedBacExercisesPage";

export const MEMORY_API = (import.meta.env.VITE_MEMORY_API_URL || "/api/memory-practice").replace(/\/+$/, "");

export default function BacPracticeRouter({token,chapterId,axisId,branchCode,...tutorProps}) {
  const [context,setContext]=useState(null),[error,setError]=useState(""),[retry,setRetry]=useState(0);
  useEffect(()=>{
    const controller=new AbortController();let active=true;
    setContext(null);setError("");
    if(!token || !chapterId) {setError("سجّل الدخول واختر الوحدة أولًا.");return;}
    fetch(`${MEMORY_API}/context/?chapter_id=${encodeURIComponent(chapterId)}`,{
      headers:{Authorization:`Bearer ${token}`},signal:controller.signal
    }).then(async r=>{const d=await r.json();if(!r.ok)throw new Error(d.detail||"تعذر تحديد مادة الوحدة.");return d;})
      .then(d=>{if(active)setContext(d);}).catch(e=>{if(active&&e.name!=="AbortError")setError(e.message);});
    return ()=>{active=false;controller.abort();};
  },[chapterId,token,retry]);
  if(error)return <div dir="rtl" className="p-8 text-center"><p role="alert">{error}</p><button type="button" onClick={()=>setRetry(v=>v+1)} className="mt-4 rounded-xl bg-blue-600 px-5 py-3 text-white">إعادة المحاولة</button></div>;
  if(!context || String(context.chapter_id)!==String(chapterId))return <p dir="rtl" role="status" className="p-8 text-center">جارٍ تحديد مادة الوحدة…</p>;
  return context.practice_mode==="memory"
    ? <IslamicMemoryPractice key={`memory-${chapterId}-${axisId||"all"}`} token={token} apiBase={MEMORY_API} chapterId={chapterId} initialAxisId={axisId} branchCode={branchCode||""} subjectCode={context.subject_code}/>
    : <GeneratedBacExercisesPage key={`standard-${chapterId}`} chapterId={chapterId} branchCode={branchCode} subjectCode={context.subject_code} courseName={context.subject_name} {...tutorProps}/>;
}
