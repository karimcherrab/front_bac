// src/pages/DashboardHomePage.jsx

import {
  ArrowLeft,
  BookOpen,
  Bot,
  GraduationCap,
  MessageCircle,
  Sparkles,
} from "lucide-react";

import { useNavigate } from "react-router-dom";


const mainFeatures = [
  {
    title: "الدروس المبسطة",
    description:
      "شرح واضح ومنظم لكل محور، مع إمكانية إعادة الشرح بالذكاء الاصطناعي إذا احتجت طريقة أبسط.",
    icon: BookOpen,
    iconClass: "bg-blue-50 text-blue-600",
    path: "/subjects",
    action: "ابدأ التعلم",
  },
  {
    title: "تمارين البكالوريا",
    description:
      "تدرّب على مواضيع البكالوريا مع حلول مفصلة وشرح بسيط خطوة بخطوة.",
    icon: GraduationCap,
    iconClass: "bg-emerald-50 text-emerald-600",
    path: "/bac",
    action: "تدرّب الآن",
  },
  {
    title: "المساعد الذكي",
    description:
      "اسأل عن أي درس أو تمرين أو بكالوريا واحصل على شرح مباشر ومناسب لسؤالك.",
    icon: Bot,
    iconClass: "bg-violet-50 text-violet-600",
    path: "/tutor",
    action: "ابدأ المحادثة",
  },
];


const subjects = [
  {
    title: "الرياضيات",
    subtitle: "دروس، تمارين وبكالوريا",
    symbol: "f(x)",
    className: "bg-violet-50 text-violet-600",
  },
  {
    title: "الفيزياء",
    subtitle: "دروس، تمارين وبكالوريا",
    symbol: "⚛",
    className: "bg-blue-50 text-blue-600",
  },
  {
    title: "علوم الطبيعة",
    subtitle: "دروس، تمارين وبكالوريا",
    symbol: "◉",
    className: "bg-emerald-50 text-emerald-600",
  },
  {
    title: "اللغة العربية",
    subtitle: "دروس، تمارين وبكالوريا",
    symbol: "ض",
    className: "bg-orange-50 text-orange-600",
  },
];


const quickQuestions = [
  "اشرح لي الاشتقاقية ببساطة",
  "ماذا جاء في بكالوريا 2019؟",
  "أعطني تمرينًا مشابهًا",
];


export default function DashboardHomePage() {
  const navigate = useNavigate();

  return (
    <div
      dir="rtl"
      className="
        mx-auto
        w-full
        max-w-[1720px]

        px-5
        pb-20
        pt-8

        sm:px-7

        lg:px-10
        lg:pt-10

        2xl:px-12
      "
    >

      {/* =====================================================
          HERO
      ===================================================== */}

      <section
        className="
          relative
          min-h-[520px]
          overflow-hidden
          rounded-[40px]

          border
          border-violet-100

          bg-[linear-gradient(135deg,#ffffff_0%,#faf9ff_48%,#f2efff_100%)]

          px-7
          py-12

          shadow-[0_30px_90px_rgba(76,29,149,0.07)]

          sm:px-10
          sm:py-14

          lg:flex
          lg:items-center
          lg:px-16
          lg:py-16

          xl:min-h-[570px]
          xl:px-20
        "
      >

        {/* Background decoration */}

        <div
          className="
            pointer-events-none
            absolute
            -left-32
            -top-36

            h-[420px]
            w-[420px]

            rounded-full
            bg-violet-200/25
            blur-[100px]
          "
        />

        <div
          className="
            pointer-events-none
            absolute
            -bottom-40
            right-[30%]

            h-[380px]
            w-[380px]

            rounded-full
            bg-blue-200/20
            blur-[100px]
          "
        />

        <div
          className="
            relative
            z-10

            grid
            w-full
            items-center

            gap-14

            lg:grid-cols-[1.05fr_0.95fr]

            xl:gap-20
          "
        >

          {/* ================= TEXT ================= */}

          <div>

            <div
              className="
                mb-6
                inline-flex
                items-center
                gap-2.5

                rounded-full

                border
                border-violet-100

                bg-white/80

                px-4
                py-2.5

                text-[13px]
                font-extrabold
                text-violet-600

                shadow-sm
                backdrop-blur
              "
            >
              <Sparkles size={17} />

              تعلم بطريقة أسهل وأذكى
            </div>


            <h1
              className="
                max-w-[760px]

                text-[44px]
                font-black

                leading-[1.25]
                tracking-[-0.025em]

                text-slate-950

                sm:text-[54px]

                lg:text-[62px]

                xl:text-[70px]
              "
            >
              تعلّم بوضوح،
              <br />

              <span
                className="
                  bg-gradient-to-l
                  from-violet-600
                  via-indigo-600
                  to-blue-600

                  bg-clip-text
                  text-transparent
                "
              >
                وتقدّم بثقة
              </span>
            </h1>


            <p
              className="
                mt-7
                max-w-[700px]

                text-[17px]
                font-medium

                leading-9

                text-slate-500

                sm:text-[18px]

                xl:text-[19px]
                xl:leading-10
              "
            >
              منصة تجمع لك الدروس،
              تمارين البكالوريا،
              والشرح بالذكاء الاصطناعي
              في مكان واحد وبطريقة بسيطة.
            </p>


            <div
              className="
                mt-9

                flex
                flex-wrap

                gap-4
              "
            >

              <button
                type="button"
                onClick={() =>
                  navigate("/subjects")
                }
                className="
                  inline-flex

                  h-[58px]
                  min-w-[190px]

                  items-center
                  justify-center

                  gap-2.5

                  rounded-[18px]

                  bg-gradient-to-l
                  from-violet-600
                  to-blue-600

                  px-7

                  text-[15px]
                  font-extrabold
                  text-white

                  shadow-[0_16px_35px_rgba(99,102,241,0.25)]

                  transition-all
                  duration-200

                  hover:-translate-y-1

                  hover:shadow-[0_20px_45px_rgba(99,102,241,0.32)]

                  active:translate-y-0
                "
              >
                <BookOpen size={21} />

                ابدأ التعلم
              </button>


              <button
                type="button"
                onClick={() =>
                  navigate("/tutor")
                }
                className="
                  inline-flex

                  h-[58px]
                  min-w-[180px]

                  items-center
                  justify-center

                  gap-2.5

                  rounded-[18px]

                  border
                  border-slate-200

                  bg-white

                  px-7

                  text-[15px]
                  font-extrabold
                  text-slate-700

                  shadow-sm

                  transition-all
                  duration-200

                  hover:-translate-y-1
                  hover:border-violet-200
                  hover:bg-violet-50
                  hover:text-violet-700
                "
              >
                <MessageCircle size={21} />

                اسأل المساعد
              </button>

            </div>

          </div>


          {/* ================= AI CARD ================= */}

          <div
            className="
              rounded-[34px]

              border
              border-slate-200/80

              bg-white/95

              p-7

              shadow-[0_24px_65px_rgba(15,23,42,0.09)]

              backdrop-blur-xl

              sm:p-8

              xl:p-9
            "
          >

            <div
              className="
                flex
                items-start
                justify-between
                gap-5
              "
            >

              <div>
                <h3
                  className="
                    text-[21px]
                    font-black
                    text-slate-950

                    xl:text-[23px]
                  "
                >
                  ماذا تريد أن تفهم؟
                </h3>

                <p
                  className="
                    mt-2

                    text-[14px]
                    leading-7

                    text-slate-400
                  "
                >
                  اسأل عن درس، تمرين أو موضوع بكالوريا.
                </p>
              </div>


              <div
                className="
                  flex

                  h-[58px]
                  w-[58px]

                  shrink-0

                  items-center
                  justify-center

                  rounded-[19px]

                  bg-violet-50

                  text-violet-600
                "
              >
                <Bot size={27} />
              </div>

            </div>


            {/* Fake input */}

            <button
              type="button"
              onClick={() =>
                navigate("/tutor")
              }
              className="
                mt-7

                flex

                h-[76px]
                w-full

                items-center
                justify-between

                gap-4

                rounded-[22px]

                border
                border-slate-200

                bg-[#fafbff]

                px-5

                text-right

                transition-all
                duration-200

                hover:border-violet-200
                hover:bg-white

                hover:shadow-[0_8px_25px_rgba(99,102,241,0.06)]
              "
            >

              <span
                className="
                  text-[15px]
                  font-medium
                  text-slate-400
                "
              >
                اكتب سؤالك هنا...
              </span>


              <span
                className="
                  flex

                  h-12
                  w-12

                  shrink-0

                  items-center
                  justify-center

                  rounded-[15px]

                  bg-gradient-to-br
                  from-violet-600
                  to-blue-600

                  text-white

                  shadow-md
                  shadow-violet-200
                "
              >
                <ArrowLeft size={20} />
              </span>

            </button>


            {/* Questions */}

            <div
              className="
                mt-6

                flex
                flex-wrap

                gap-2.5
              "
            >
              {quickQuestions.map(
                (question) => (
                  <button
                    key={question}
                    type="button"
                    onClick={() =>
                      navigate("/tutor")
                    }
                    className="
                      rounded-full

                      border
                      border-slate-200

                      bg-white

                      px-4
                      py-2.5

                      text-[12px]
                      font-bold

                      text-slate-500

                      transition-all

                      hover:border-violet-200
                      hover:bg-violet-50
                      hover:text-violet-600
                    "
                  >
                    {question}
                  </button>
                ),
              )}
            </div>

          </div>

        </div>

      </section>


      {/* =====================================================
          FEATURES
      ===================================================== */}

      <section
        className="
          mt-16

          lg:mt-20
        "
      >

        <div
          className="
            mb-9
            text-center
          "
        >

          <p
            className="
              text-[13px]
              font-extrabold
              text-violet-600
            "
          >
            كل ما تحتاجه
          </p>

          <h2
            className="
              mt-2

              text-[30px]
              font-black
              tracking-tight
              text-slate-950

              sm:text-[36px]
            "
          >
            اختر طريقتك في التعلم
          </h2>

        </div>


        <div
          className="
            grid

            gap-6

            md:grid-cols-3
          "
        >

          {mainFeatures.map(
            (feature) => {
              const Icon =
                feature.icon;

              return (
                <button
                  key={feature.title}
                  type="button"
                  onClick={() =>
                    navigate(
                      feature.path,
                    )
                  }
                  className="
                    group

                    min-h-[330px]

                    rounded-[32px]

                    border
                    border-slate-200

                    bg-white

                    p-8

                    text-right

                    shadow-[0_6px_24px_rgba(15,23,42,0.035)]

                    transition-all
                    duration-300

                    hover:-translate-y-2
                    hover:border-violet-200

                    hover:shadow-[0_25px_55px_rgba(99,102,241,0.10)]

                    xl:p-9
                  "
                >

                  <div
                    className={`
                      flex

                      h-[66px]
                      w-[66px]

                      items-center
                      justify-center

                      rounded-[21px]

                      ${feature.iconClass}
                    `}
                  >
                    <Icon size={29} />
                  </div>


                  <h3
                    className="
                      mt-7

                      text-[21px]
                      font-black

                      text-slate-950

                      xl:text-[23px]
                    "
                  >
                    {feature.title}
                  </h3>


                  <p
                    className="
                      mt-4

                      max-w-[390px]

                      text-[14px]

                      leading-8

                      text-slate-500

                      xl:text-[15px]
                    "
                  >
                    {feature.description}
                  </p>


                  <div
                    className="
                      mt-7

                      flex
                      items-center

                      gap-2

                      text-[14px]
                      font-extrabold

                      text-violet-600
                    "
                  >
                    {feature.action}

                    <ArrowLeft
                      size={17}
                      className="
                        transition-transform
                        duration-200

                        group-hover:-translate-x-1.5
                      "
                    />
                  </div>

                </button>
              );
            },
          )}

        </div>

      </section>


      {/* =====================================================
          SUBJECTS
      ===================================================== */}

      <section
        className="
          mt-16

          lg:mt-20
        "
      >

        {/* Header */}

        <div
          className="
            mb-8

            flex
            items-end
            justify-between

            gap-4
          "
        >

          <div>

            <p
              className="
                text-[13px]
                font-extrabold
                text-violet-600
              "
            >
              المواد
            </p>

            <h2
              className="
                mt-2

                text-[30px]
                font-black

                tracking-tight

                text-slate-950

                sm:text-[36px]
              "
            >
              ابدأ من مادّتك
            </h2>

          </div>


          <button
            type="button"
            onClick={() =>
              navigate("/subjects")
            }
            className="
              hidden

              h-12

              items-center
              justify-center

              gap-2

              rounded-[15px]

              border
              border-slate-200

              bg-white

              px-5

              text-[13px]
              font-extrabold

              text-slate-600

              transition-all

              hover:border-violet-200
              hover:bg-violet-50
              hover:text-violet-700

              sm:flex
            "
          >
            عرض جميع المواد

            <ArrowLeft size={16} />
          </button>

        </div>


        {/* Subjects cards */}

        <div
          className="
            grid

            gap-5

            sm:grid-cols-2

            xl:grid-cols-4
          "
        >

          {subjects.map(
            (subject) => (
              <button
                key={subject.title}
                type="button"
                onClick={() =>
                  navigate("/subjects")
                }
                className="
                  group

                  flex

                  min-h-[190px]

                  items-center

                  gap-5

                  rounded-[28px]

                  border
                  border-slate-200

                  bg-white

                  p-7

                  text-right

                  shadow-[0_5px_20px_rgba(15,23,42,0.03)]

                  transition-all
                  duration-300

                  hover:-translate-y-1.5
                  hover:border-violet-200

                  hover:shadow-[0_20px_40px_rgba(99,102,241,0.08)]
                "
              >

                <div
                  className={`
                    flex

                    h-[70px]
                    w-[70px]

                    shrink-0

                    items-center
                    justify-center

                    rounded-[22px]

                    text-[19px]
                    font-black

                    ${subject.className}
                  `}
                >
                  {subject.symbol}
                </div>


                <div
                  className="
                    min-w-0
                  "
                >

                  <h3
                    className="
                      text-[18px]
                      font-black

                      text-slate-950
                    "
                  >
                    {subject.title}
                  </h3>


                  <p
                    className="
                      mt-2

                      text-[13px]
                      leading-6

                      text-slate-400
                    "
                  >
                    {subject.subtitle}
                  </p>


                  <div
                    className="
                      mt-4

                      flex
                      items-center

                      gap-1.5

                      text-[12px]
                      font-bold

                      text-violet-600

                      opacity-0

                      transition-all

                      group-hover:opacity-100
                    "
                  >
                    فتح المادة

                    <ArrowLeft
                      size={14}
                    />
                  </div>

                </div>

              </button>
            ),
          )}

        </div>


        {/* Mobile all subjects */}

        <button
          type="button"
          onClick={() =>
            navigate("/subjects")
          }
          className="
            mt-5

            flex

            h-13
            w-full

            items-center
            justify-center

            gap-2

            rounded-2xl

            border
            border-slate-200

            bg-white

            text-[13px]
            font-extrabold

            text-slate-600

            sm:hidden
          "
        >
          عرض جميع المواد

          <ArrowLeft size={15} />
        </button>

      </section>

    </div>
  );
}