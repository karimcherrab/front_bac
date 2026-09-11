import React, {useEffect, useRef, useState} from "react";
import "./IslamicMemoryPractice.css";

const modes = [["mixed","متنوّع"],["define","عرّف"],["list","اذكر"],["compare","فرّق"],["extract","استخرج"],["explain","علّل"]];
const tips = {define:"ابدأ بتعريف مباشر، ثم أدرج العناصر الأساسية.",list:"اذكر العناصر المطلوبة بوضوح، ويفضل ترتيبها.",compare:"اذكر وجه المقارنة، ثم وضّح الفرق بين المفهومين.",extract:"استند إلى النص المعطى، واربط إجابتك بما يدل عليها فيه.",explain:"اذكر السبب، ثم بيّن علاقته بما يطلبه السؤال."};
function key(){
  if (crypto.randomUUID) return crypto.randomUUID();
  const b=crypto.getRandomValues(new Uint8Array(16));b[6]=(b[6]&15)|64;b[8]=(b[8]&63)|128;
  const h=Array.from(b,x=>x.toString(16).padStart(2,"0")).join("");
  return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`;
}

export default function IslamicMemoryPractice({token,apiBase="/api/memory-practice",branchCode="",chapterId,initialAxisId,subjectCode="islamic"}) {
  const [lessons,setLessons]=useState([]),[lessonId,setLessonId]=useState(""),[mode,setMode]=useState("mixed");
  const [question,setQuestion]=useState(null),[answer,setAnswer]=useState(""),[history,setHistory]=useState([]);
  const [feedback,setFeedback]=useState(null),[busy,setBusy]=useState(""),[error,setError]=useState("");
  const [showModel,setShowModel]=useState(false),[oldAttempts,setOldAttempts]=useState([]);
  const scope=useRef(0),lock=useRef(false),pending=useRef(null);
  const root=apiBase.replace(/\/$/,"");
  async function api(path,body){
    const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),180000);
    try {
      const res=await fetch(root+path,{method:body?"POST":"GET",headers:{Authorization:`Bearer ${token}`,"Content-Type":"application/json"},...(body?{body:JSON.stringify(body)}:{}),signal:controller.signal});
      const data=await res.json().catch(()=>({}));
      if(!res.ok)throw new Error(data.detail || Object.values(data).flat().join(" ") || "تعذر إكمال الطلب.");
      return data;
    } catch(e) {if(e.name==="AbortError")throw new Error("انتهت مهلة الاتصال. إجابتك باقية؛ أعد المحاولة.");throw e;}
    finally{clearTimeout(timeout);}
  }
  useEffect(()=>{
    const current=++scope.current;setQuestion(null);setAnswer("");setFeedback(null);setHistory([]);setLessons([]);setLessonId("");setError("");
    if(!token){setError("سجّل الدخول لبدء التدريب.");return;}
    api(`/lessons/?chapter_id=${encodeURIComponent(chapterId)}&branch_code=${encodeURIComponent(branchCode)}`).then(d=>{if(current===scope.current){setLessons(d.results);setLessonId(String(d.results.find(x=>String(x.id)===String(initialAxisId))?.id||d.results[0]?.id||""));}}).catch(e=>{if(current===scope.current)setError(e.message);});
    return ()=>{scope.current++;};
  },[token,branchCode,apiBase,chapterId,initialAxisId]);
  useEffect(()=>{
    if(!lessonId || !token)return;
    let active=true;
    api(`/history/?axis_id=${lessonId}`).then(d=>{if(active)setHistory(d.results);}).catch(()=>{});
    return ()=>{active=false;};
  },[lessonId,token,apiBase]);
  function selectLesson(value){scope.current++;setHistory([]);setLessonId(value);setQuestion(null);setAnswer("");setFeedback(null);setError("");setOldAttempts([]);pending.current=null;}
  function open(q){setQuestion(q);setAnswer("");setFeedback(null);setShowModel(false);setOldAttempts(q.attempts||[]);setError("");pending.current=null;}
  async function generate(){
    if(lock.current || !lessonId)return;lock.current=true;setBusy("generate");setError("");const current=scope.current;
    try{const q=await api('/generate/',{axis_id:Number(lessonId),chapter_id:Number(chapterId),branch_code:branchCode,verb:mode});if(current===scope.current){open(q);setHistory(h=>[q,...h.filter(x=>x.id!==q.id)].slice(0,20));}}
    catch(e){if(current===scope.current)setError(e.message);}finally{lock.current=false;setBusy("");}
  }
  async function submit(){
    if(lock.current || !question || !answer.trim())return;
    const value=answer.trim(),current=scope.current;
    if(!pending.current || pending.current.answer!==value || pending.current.question!==question.id)pending.current={answer:value,question:question.id,key:key()};
    lock.current=true;setBusy("grade");setError("");
    try{const result=await api(`/questions/${question.id}/answer/`,{answer:value,request_key:pending.current.key});
      if(current===scope.current){setFeedback(result.result);setShowModel(false);setOldAttempts(a=>[...a.filter(x=>x.id!==result.id),result]);setHistory(h=>h.map(q=>q.id===question.id?{...q,attempts:[...(q.attempts||[]).filter(x=>x.id!==result.id),result]}:q));}}
    catch(e){if(current===scope.current)setError(e.message);}finally{lock.current=false;setBusy("");}
  }
  const currentLesson=lessons.find(x=>String(x.id)===lessonId);
  const ratio=feedback?Math.round(100*feedback.score/feedback.max_score):0;
  return <main className="imp" dir="rtl">
    <header className="imp-header"><a className="imp-brand" href="#memory-main" aria-label="اختبارات الحفظ"><span>ح</span> مساحة الحفظ</a><span className="imp-subject">{subjectCode==="history"?"التاريخ":"التربية الإسلامية"}</span></header>
    <section className="imp-hero"><p className="imp-eyebrow">افهم المطلوب • استرجع • حسّن إجابتك</p><h1>ما تتذكّره،<br/><em>اكتبه بطريقتك.</em></h1><p>تدرّب على أفعال السؤال، واكتشف ما ينقص إجابتك خطوة بخطوة.</p><div className="imp-pills"><span>أسئلة من أفكار الدرس</span><span>تصحيح لكل عنصر</span><span>فرصة للتحسين</span></div></section>
    <div className="imp-layout" id="memory-main">
      <aside className="imp-sidebar"><h2>مسار التدريب</h2><label htmlFor="memory-lesson">اختر الدرس</label><select id="memory-lesson" value={lessonId} disabled={!!busy} onChange={e=>selectLesson(e.target.value)}>{!lessons.length&&<option value="">لا توجد دروس متاحة</option>}{lessons.map(l=><option key={l.id} value={l.id}>{l.order}. {l.title}</option>)}</select>
      <label>فعل السؤال</label><div className="imp-modes">{modes.map(([id,label])=><button key={id} disabled={!!busy} className={mode===id?"active":""} onClick={()=>setMode(id)} aria-pressed={mode===id}>{label}</button>)}</div>
      <button className="imp-primary" disabled={!!busy||!lessonId||!token} onClick={generate}>{busy==="generate"?"جارٍ تجهيز السؤال…":"سؤال جديد ←"}</button>
      <p className="imp-side-note">{currentLesson?.idea_count||0} فكرة سؤال في هذا الدرس. تنوّع الأفعال يساعدك على تجاوز الحفظ الآلي.</p>
      <h3>آخر أسئلتك</h3><div className="imp-history">{history.length?history.map(q=><button disabled={!!busy} key={q.id} onClick={()=>open(q)} className={question?.id===q.id?"selected":""}><span>{q.verb_label}</span>{q.text}<small>{q.attempts?.length?`${q.attempts.length} محاولة` : "لم تجب بعد"}</small></button>):<p>سيظهر تقدمك هنا بعد أول سؤال.</p>}</div></aside>
      <section className="imp-workspace" aria-busy={!!busy}>
        {error&&<div role="alert" className="imp-error">{error}</div>}
        {!question?<div className="imp-empty"><span>01</span><h2>ابدأ بسؤال واحد.</h2><p>اختر درسًا وفعل سؤال، ثم اكتب إجابتك دون الرجوع للحل.</p><button className="imp-primary" disabled={!!busy||!lessonId||!token} onClick={generate}>ابدأ التدريب</button></div>:<>
          <article className="imp-question"><div className="imp-question-meta"><span>{question.verb_label}</span><span>{question.max_score} نقاط</span></div><p className="imp-lesson-title">{question.lesson_title}</p>{question.evidence?.text&&<blockquote>{question.evidence.text}<cite>{question.evidence.reference}</cite></blockquote>}<h2>{question.text}</h2><p className="imp-tip">{tips[question.verb]}</p></article>
          <section className="imp-answer"><div className="imp-section-head"><h2>إجابتك</h2><span>اكتب ما تتذكّره أولًا</span></div><label className="imp-sr" htmlFor="memory-answer">إجابة التلميذ</label><textarea id="memory-answer" value={answer} maxLength={6000} disabled={busy==="grade"} onChange={e=>{setAnswer(e.target.value);setFeedback(null);}} placeholder="ابدأ بإجابة مباشرة، ثم أضف العناصر التي يطلبها السؤال…"/><div className="imp-answer-actions"><small>{answer.length} / 6000</small><button className="imp-primary" disabled={!!busy||!answer.trim()} onClick={submit}>{busy==="grade"?"جارٍ تصحيح إجابتك…":"صحّح إجابتي"}</button></div><p className="imp-disclaimer">تقييم تدريبي تقديري بالذكاء الاصطناعي، وليس علامة رسمية.</p></section>
          {feedback&&<section className="imp-feedback" aria-live="polite"><div className="imp-score"><div><p>نتيجة هذه المحاولة</p><h2>{feedback.score}<small> / {feedback.max_score}</small></h2></div><div className="imp-score-copy"><h3>{ratio===100?"إجابة مكتملة وفق السلم":"إجابتك قابلة للتحسين"}</h3><p>{feedback.summary}</p></div></div>
            <div className="imp-criteria">{feedback.items.map(r=><article key={r.id} className={r.earned===r.possible?"complete":"incomplete"}><div><strong>{r.criterion}</strong><span>{r.earned} / {r.possible}</span></div>{r.quote&&<blockquote>من إجابتك: «{r.quote}»</blockquote>}<p>{r.feedback}</p></article>)}</div>
            {!!feedback.missing.length&&<div className="imp-improve"><h3>لتحصل على العلامة الكاملة</h3><ul>{feedback.missing.map((x,i)=><li key={i}>{x}</li>)}</ul></div>}
            <button className="imp-secondary" onClick={()=>setShowModel(v=>!v)}>{showModel?"إخفاء الإجابة النموذجية":"عرض إجابة نموذجية"}</button>{showModel&&<div className="imp-model">{feedback.model_answer}</div>}
          </section>}
          {oldAttempts.length>0&&<details className="imp-attempts"><summary>محاولاتك السابقة ({oldAttempts.length})</summary>{oldAttempts.map(a=><article key={a.id}><strong>{a.result.score} / {a.result.max_score}</strong><p>{a.answer}</p><p>{a.result.summary}</p></article>)}</details>}
        </>}
      </section>
    </div>
  </main>;
}
