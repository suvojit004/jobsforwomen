import { useEffect, useMemo, useRef, useState } from "react"
import { useNavigate } from "react-router-dom"
import "./jfw-landing.css"

// ============================================================================
// JFW Landing Page -- ported from the standalone jobsforwomen/index.html
// design (static HTML/Tailwind/vanilla-JS source supplied for this replace).
// Home/Explore are a client-side toggle (not separate routes), matching the
// source's single-page behavior. "Register Now"/"Join as Candidate"/
// "Register Company" and every other register CTA navigate to the app's
// real /auth/register/candidate and /auth/register/recruiter routes instead
// of the source's embedded Google Form modals. The Maya FAQ widget still
// uses the same canned keyword-matching responses as the source.
// ============================================================================

type PageId = "home" | "explore"

interface ChatMessage {
  role: "ai" | "user"
  text: string
}

const MAYA: Record<string, string> = {
  jfw: "JFW — Jobs For Women — is India's first career platform built exclusively for women. We are built on a simple belief: a woman doesn't earn just for herself — she earns for a generation. We connect talented women (Generation Shapers) with companies committed to gender equity, pay transparency, and flexible work. Founded by Mahak and Yakshita Tiwari.",
  register:
    "Click 'Register Now' at the top or any register button on the home page. Choose Candidate or Company — you'll be taken straight to our registration form.",
  founder:
    "JFW was founded by Mahak Tiwari (Co-Founder) and Yakshita Tiwari (Co-Founder). Mahak built it after watching brilliant women leave jobs because systems failed them. Yakshita joined because she lived the same story and wanted to fix it (loudly). 💜",
  tool: "JFW has four tools in development: Salary Negotiator, Resume Builder, Mock Interviews, and Skill Certifications. Free downloadable resources — templates and guides — are already available. Full AI-powered features are coming soon!",
  free: "Yes — JFW is completely free for candidates. No catch. Companies pay to access the talent network.",
  premium:
    "Our Premium Partner badge is exclusively for companies that make menstrual leave a mandatory workplace policy. These companies receive: priority placement in search results, a verified Premium Partner badge on all their listings, and higher visibility across the JFW platform.",
  menstrual:
    "Menstrual leave is at the heart of our Premium Partner programme. Any company that mandates menstrual leave as a formal policy earns a Premium Partner badge and priority placement on JFW.",
  maya: "Maya is named after the first two letters of both our founders — MAhak and YAkshita. Put them together and you get MAYA. She carries both founders in her name. 💜",
  industries:
    "JFW covers 40+ industries — IT, Finance, Healthcare, Media, Legal, Education, Design, Fashion, Startups, NGOs, AI/ML, Gaming, CleanTech, and many more. If women work there, we cover it.",
  generation:
    "Women are Generation Shapers — we earn not just for ourselves but for our children, families, and the future. A woman's income shapes education outcomes, breaks cycles of dependence, and creates a legacy of equality. JFW exists because that purpose deserves a platform that truly understands it. 💜",
  default:
    "Great question! JFW is in pre-launch — everything we're building centres on creating real opportunities for women. Register on the Home page to be first in line when we go live! 💜",
}

function matchMayaResponse(question: string): string {
  const q = question.toLowerCase()
  if (q.includes("premium") || q.includes("partner")) return MAYA.premium
  if (q.includes("menstrual") || q.includes("period")) return MAYA.menstrual
  if (q.includes("maya") || q.includes("why maya") || q.includes("name")) return MAYA.maya
  if (q.includes("free") || q.includes("cost") || q.includes("paid") || q.includes("charge")) return MAYA.free
  if (q.includes("tool") || q.includes("feature") || q.includes("resume") || q.includes("salary")) return MAYA.tool
  if (q.includes("register") || q.includes("sign up") || q.includes("join") || q.includes("how do i")) return MAYA.register
  if (q.includes("founder") || q.includes("mahak") || q.includes("yakshita") || q.includes("who built")) return MAYA.founder
  if (q.includes("industr") || q.includes("sector")) return MAYA.industries
  if (q.includes("jfw") || q.includes("what is") || q.includes("platform") || q.includes("about")) return MAYA.jfw
  return MAYA.default
}

const INDUSTRIES = [
  "IT & Software", "Finance", "Healthcare", "Media", "Marketing", "Legal", "Education", "Design & UX",
  "Architecture", "Fashion & Retail", "HR & People", "Consulting", "Government", "Logistics", "Hospitality",
  "Real Estate", "Manufacturing", "Startups", "NGOs", "Research", "Pharma", "Cybersecurity", "Data & Analytics",
  "E-Commerce", "Insurance", "Telecom", "Aerospace", "AgriTech", "Gaming", "Publishing", "CleanTech",
  "Automotive", "Events & PR", "Arts & Culture", "Mental Health", "Sports & Fitness", "Web3", "AI & ML",
  "Film", "Others +",
]

const MANIFESTO_TAGS = [
  "Pay Equity", "Zero Bias", "Flexible Futures", "Returnship Ready", "Women in Leadership",
  "Transparent Culture", "Menstrual Leave", "Built by Women", "Generation Shapers 💜", "Generation Shapers",
  "Earners of Purpose",
]

const MAYA_QUICK_ASKS = [
  "What is JFW?",
  "How do I register?",
  "Who are the founders?",
  "What tools are available?",
  "Is JFW free?",
  "What is the Premium Partner program?",
  "What is menstrual leave on JFW?",
  "Why is the assistant called Maya?",
]

export function LandingPage() {
  const navigate = useNavigate()
  const [page, setPage] = useState<PageId>("home")
  const [choiceOpen, setChoiceOpen] = useState(false)

  const [notifyOpen, setNotifyOpen] = useState(false)
  const [notifyName, setNotifyName] = useState("")
  const [notifyEmail, setNotifyEmail] = useState("")
  const [notifySubmitted, setNotifySubmitted] = useState(false)

  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: "ai", text: "Hi! I'm Maya, JFW's guide — named after MAhak + YAkshita, our two founders. Ask me anything about Jobs For Women. How can I help? 💜" },
  ])
  const [chatInput, setChatInput] = useState("")
  const [isTyping, setIsTyping] = useState(false)

  const containerRef = useRef<HTMLDivElement>(null)
  const msgsRef = useRef<HTMLDivElement>(null)

  // Same particle field as the source: 22 floating dots with randomized
  // size/duration/delay/position/color, generated once per mount.
  const particles = useMemo(
    () =>
      Array.from({ length: 22 }).map(() => {
        const size = +(Math.random() * 3 + 1).toFixed(1)
        const duration = +(Math.random() * 20 + 15).toFixed(1)
        const delay = +(Math.random() * 20).toFixed(1)
        const left = +(Math.random() * 100).toFixed(1)
        const color = Math.random() > 0.5 ? "rgba(232,145,176," : "rgba(180,130,220,"
        const opacity = (Math.random() * 0.4 + 0.1).toFixed(2)
        return { size, duration, delay, left, color, opacity }
      }),
    []
  )

  function goTo(id: PageId) {
    setPage(id)
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  function goToCandidateRegister() {
    setChoiceOpen(false)
    navigate("/auth/register/candidate")
  }

  function goToRecruiterRegister() {
    setChoiceOpen(false)
    navigate("/auth/register/recruiter")
  }

  // Scroll-reveal: re-observe every .jfw-reveal element in the currently
  // active page each time `page` changes (mirrors the source's
  // `setTimeout(initRev,100)` call inside go()).
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) entry.target.classList.add("visible")
        })
      },
      { threshold: 0.06 }
    )
    const targets = el.querySelectorAll(".jfw-reveal")
    targets.forEach((t) => {
      if (!t.classList.contains("visible")) obs.observe(t)
    })
    return () => obs.disconnect()
  }, [page])

  useEffect(() => {
    if (msgsRef.current) msgsRef.current.scrollTop = msgsRef.current.scrollHeight
  }, [messages, isTyping])

  function sendMsg(overrideText?: string) {
    const q = (overrideText ?? chatInput).trim()
    if (!q) return
    setMessages((m) => [...m, { role: "user", text: q }])
    setChatInput("")
    setIsTyping(true)
    setTimeout(() => {
      setIsTyping(false)
      setMessages((m) => [...m, { role: "ai", text: matchMayaResponse(q) }])
    }, 1100)
  }

  function ask(q: string) {
    sendMsg(q)
  }

  function submitNotify() {
    if (!notifyEmail.trim() || !notifyEmail.includes("@")) {
      alert("Please enter a valid email.")
      return
    }
    setNotifySubmitted(true)
    setTimeout(() => {
      setNotifyOpen(false)
    }, 3000)
  }

  return (
    <div ref={containerRef} className="jfw-landing jfw-sans relative bg-[#1a0d2e] text-[#f0e6f6]">
      <div className="jfw-particles">
        {particles.map((p, i) => (
          <div
            key={i}
            className="jfw-particle"
            style={{
              width: p.size,
              height: p.size,
              background: `${p.color}${p.opacity})`,
              left: `${p.left}%`,
              animationDuration: `${p.duration}s`,
              animationDelay: `-${p.delay}s`,
            }}
          />
        ))}
      </div>

      {/* ══ NOTIFY MODAL (present for fidelity with the source; nothing
          currently triggers it there either -- openNotify() was defined but
          unused in the original file) ══ */}
      <div className={`jfw-notify-overlay ${notifyOpen ? "open" : ""}`} onClick={(e) => { if (e.target === e.currentTarget) setNotifyOpen(false) }}>
        <div className="bg-gradient-to-br from-[rgba(45,27,78,.95)] to-[rgba(26,13,46,.98)] border border-[rgba(232,145,176,.25)] rounded-[22px] p-10 max-w-[420px] w-[90%] relative shadow-[0_30px_80px_rgba(0,0,0,.5)]">
          <button className="absolute top-4 right-5 bg-transparent border-none text-[rgba(240,230,246,.62)] text-xl cursor-pointer hover:text-white transition-colors" onClick={() => setNotifyOpen(false)}>✕</button>
          {!notifySubmitted ? (
            <div>
              <h3 className="jfw-serif text-[1.6rem] text-white mb-1">🔔 Get Notified</h3>
              <p className="text-[.86rem] text-[rgba(240,230,246,.62)] leading-[1.7] mb-5">This tool is coming soon! Drop your email and we'll let you know the moment it launches.</p>
              <div className="flex flex-col gap-3">
                <input
                  className="bg-[rgba(26,13,46,.7)] border border-[rgba(232,145,176,.25)] rounded-[10px] px-4 py-[.8rem] text-[.88rem] text-white jfw-sans outline-none focus:border-[#e891b0] placeholder-[rgba(240,230,246,.62)] transition-colors"
                  type="text"
                  value={notifyName}
                  onChange={(e) => setNotifyName(e.target.value)}
                  placeholder="Your name"
                />
                <input
                  className="bg-[rgba(26,13,46,.7)] border border-[rgba(232,145,176,.25)] rounded-[10px] px-4 py-[.8rem] text-[.88rem] text-white jfw-sans outline-none focus:border-[#e891b0] placeholder-[rgba(240,230,246,.62)] transition-colors"
                  type="email"
                  value={notifyEmail}
                  onChange={(e) => setNotifyEmail(e.target.value)}
                  placeholder="Your email address"
                />
                <button
                  onClick={submitNotify}
                  style={{ justifyContent: "center" }}
                  className="inline-flex items-center gap-2 bg-[#d4709a] text-white px-8 py-[.9rem] rounded-full text-[.88rem] font-medium border-none cursor-pointer jfw-sans shadow-[0_0_22px_rgba(232,145,176,.45)] hover:shadow-[0_0_40px_rgba(232,145,176,.45)] hover:-translate-y-0.5 transition-all"
                >
                  Notify Me →
                </button>
              </div>
            </div>
          ) : (
            <div className="text-center py-4">
              <div className="text-[2.5rem] mb-2">💜</div>
              <p className="text-[#f2c4d0] text-[.9rem]">You're on the list! We'll notify you as soon as this launches.</p>
            </div>
          )}
        </div>
      </div>

      {/* ══ NAV ══ */}
      <nav className="fixed top-0 left-0 right-0 z-[200] px-[5%] h-[72px] flex items-center justify-between bg-[rgba(26,13,46,.92)] backdrop-blur-xl border-b border-[rgba(232,145,176,.12)]">
        <div className="flex items-center">
          <div
            className="min-w-[120px] h-[50px] rounded-lg overflow-hidden border-none flex items-center justify-center bg-transparent cursor-pointer relative flex-shrink-0 px-2"
            onClick={() => goTo("home")}
            title="JFW — Jobs For Women"
          >
            <img src="/landing/jfw-logo.jpg" alt="JFW Logo" className="h-full object-contain w-auto block max-h-[45px] max-w-[180px]" />
          </div>
        </div>
        <ul className="flex items-center gap-1 list-none">
          <li><button onClick={() => goTo("home")} className={`jfw-nav-btn ${page === "home" ? "active" : ""}`}>Home</button></li>
          <li><button onClick={() => goTo("explore")} className={`jfw-nav-btn ${page === "explore" ? "active" : ""}`}>Explore</button></li>
          <li><button onClick={() => navigate("/auth/login")} className="jfw-nav-btn">Login</button></li>
          <li>
            <button
              onClick={() => setChoiceOpen(true)}
              className="bg-[#d4709a] text-white px-[1.4rem] py-[.55rem] rounded-full jfw-sans text-[.78rem] tracking-[.06em] uppercase border-none cursor-pointer shadow-[0_0_18px_rgba(232,145,176,.45)] hover:shadow-[0_0_32px_rgba(232,145,176,.45)] hover:-translate-y-px transition-all ml-1"
            >
              Register Now
            </button>
          </li>
        </ul>
      </nav>

      {/* ══ JOIN MODAL ══ */}
      <div className={`jfw-modal-overlay ${choiceOpen ? "open" : ""}`} onClick={(e) => { if (e.target === e.currentTarget) setChoiceOpen(false) }}>
        <div className="bg-[#1e0f38] border border-[rgba(232,145,176,.2)] rounded-[22px] p-10 max-w-[460px] w-full max-h-[88vh] overflow-y-auto relative text-center">
          <button onClick={() => setChoiceOpen(false)} className="absolute top-4 right-4 bg-[rgba(232,145,176,.09)] border border-[rgba(232,145,176,.18)] text-[rgba(240,230,246,.62)] w-8 h-8 rounded-full cursor-pointer text-[.95rem] flex items-center justify-center hover:bg-[rgba(232,145,176,.18)] hover:text-white transition-all jfw-sans">✕</button>
          <h2 className="jfw-serif text-[1.7rem] text-white mb-2">Join JFW</h2>
          <p className="text-[.84rem] text-[rgba(240,230,246,.62)] mb-5 leading-relaxed">Are you a candidate looking for opportunities, or a company looking to hire?</p>
          <div className="flex flex-col gap-4 mt-5">
            <button onClick={goToCandidateRegister} className="inline-flex items-center justify-center gap-2 bg-[#d4709a] text-white w-full py-[1.1rem] text-base rounded-full border-none cursor-pointer jfw-sans shadow-[0_0_22px_rgba(232,145,176,.45)] hover:shadow-[0_0_40px_rgba(232,145,176,.45)] hover:-translate-y-0.5 transition-all">👩 I'm a Candidate</button>
            <button onClick={goToRecruiterRegister} className="inline-flex items-center justify-center gap-2 text-white w-full py-[1.1rem] text-base rounded-full border border-[rgba(232,145,176,.35)] cursor-pointer jfw-sans bg-[rgba(212,112,154,.18)] shadow-[0_0_22px_rgba(232,145,176,.22)] hover:shadow-[0_0_40px_rgba(232,145,176,.45)] hover:-translate-y-0.5 transition-all">🏢 I'm a Company</button>
          </div>
        </div>
      </div>

      {page === "home" && (
        <div className="relative z-[2]">
          {/* HERO */}
          <section className="min-h-screen flex flex-col items-center justify-center text-center px-[5%] pt-28 pb-16 relative overflow-hidden">
            <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(ellipse 90% 70% at 50% 30%,rgba(90,58,138,.5) 0%,transparent 70%),radial-gradient(ellipse 60% 50% at 80% 80%,rgba(212,112,154,.18) 0%,transparent 60%)" }} />
            <div className="jfw-orb w-[500px] h-[500px] bg-[rgba(90,58,138,.35)] -top-24 -left-24" style={{ animationDelay: "0s" }} />
            <div className="jfw-orb w-[400px] h-[400px] bg-[rgba(212,112,154,.18)] -bottom-12 -right-20" style={{ animationDelay: "-3s" }} />

            <div className="jfw-anim-1 jfw-serif relative z-10 font-light text-white leading-none mb-2 tracking-tight drop-shadow-[0_0_80px_rgba(232,145,176,.2)]" style={{ fontSize: "clamp(5.5rem,13vw,11rem)" }}>J<span className="text-[#e891b0] italic">F</span>W</div>
            <div className="jfw-anim-2 jfw-serif relative z-10 italic text-[#f2c4d0] opacity-[.85] tracking-[.02em] mb-7" style={{ fontSize: "clamp(.95rem,1.8vw,1.3rem)" }}>A platform built for women, by women</div>
            <h1 className="jfw-anim-3 jfw-serif relative z-10 font-light text-white max-w-[760px] mx-auto leading-[1.28] mb-4" style={{ fontSize: "clamp(1.7rem,3.5vw,2.8rem)" }}>Where Ambition Finds a Home That <em className="italic text-[#e891b0]">Actually Deserves It</em></h1>
            <p className="jfw-anim-4 relative z-10 text-[.96rem] text-[rgba(240,230,246,.62)] max-w-[500px] leading-[1.78] mx-auto mb-9">Built by two women who had enough of systems that weren't built for them. For every woman who feels the same.</p>
            <div className="jfw-anim-5 relative z-10 flex gap-4 justify-center flex-wrap">
              <button onClick={goToCandidateRegister} className="inline-flex items-center gap-2 bg-[#d4709a] text-white px-8 py-[.9rem] rounded-full text-[.88rem] font-medium tracking-[.03em] border-none cursor-pointer jfw-sans whitespace-nowrap shadow-[0_0_22px_rgba(232,145,176,.45),0_4px_18px_rgba(212,112,154,.4)] hover:shadow-[0_0_40px_rgba(232,145,176,.45),0_8px_28px_rgba(212,112,154,.5)] hover:-translate-y-0.5 transition-all">Join as Candidate →</button>
              <button onClick={goToRecruiterRegister} className="inline-flex items-center gap-2 text-[#f0e6f6] px-8 py-[.9rem] rounded-full text-[.88rem] whitespace-nowrap border border-[rgba(232,145,176,.35)] cursor-pointer jfw-sans bg-[rgba(212,112,154,.18)] shadow-[0_0_22px_rgba(232,145,176,.22),0_4px_18px_rgba(212,112,154,.2)] hover:shadow-[0_0_22px_rgba(232,145,176,.22)] hover:-translate-y-0.5 hover:bg-[rgba(232,145,176,.14)] transition-all">Register Company →</button>
            </div>
            <div className="jfw-anim-6 absolute bottom-6 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 z-10">
              <div className="jfw-sline" />
              <span className="text-[.58rem] tracking-[.18em] uppercase text-[rgba(240,230,246,.62)]">Scroll</span>
            </div>
          </section>

          {/* WHY JFW */}
          <section className="py-28 px-[5%]">
            <div className="jfw-reveal">
              <span className="text-[.65rem] tracking-[.22em] uppercase text-[#e891b0] font-medium mb-3 block">Why JFW Is Different</span>
              <h2 className="jfw-serif text-white font-normal leading-[1.2]" style={{ fontSize: "clamp(2rem,3.8vw,3rem)" }}>Built with Intent. <em className="italic text-[#e891b0]">Designed for You.</em></h2>
              <p className="text-[.96rem] text-[rgba(240,230,246,.62)] leading-[1.8] max-w-[520px] mt-3">Every feature, every policy, every partner on JFW answers one question: does this genuinely help women? Because the purpose of earning is different for a woman — and that changes everything.</p>
            </div>
            <div className="grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-[1.4rem] mt-12">
              <div className="jfw-feature-card jfw-reveal jfw-rd1 bg-[rgba(61,38,96,.55)] border border-[rgba(232,145,176,.2)] rounded-[18px] p-8 backdrop-blur-sm">
                <div className="w-12 h-12 bg-gradient-to-br from-[#5a3a8a] to-[#d4709a] rounded-[13px] flex items-center justify-center mb-5 shadow-[0_0_18px_rgba(212,112,154,.28)]">
                  <svg className="w-[21px] h-[21px] fill-none stroke-white stroke-[1.8] [stroke-linecap:round] [stroke-linejoin:round]" viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
                </div>
                <h3 className="jfw-serif text-[1.25rem] text-white mb-2 leading-[1.3]">Women-First Culture Review</h3>
                <p className="text-[.86rem] text-[rgba(240,230,246,.62)] leading-[1.8]">Before any company can list on JFW, they go through our culture review — assessing workplace policies, flexibility options, and their commitment to gender equity. We set the bar. They meet it.</p>
              </div>
              <div className="jfw-feature-card jfw-reveal jfw-rd2 bg-[rgba(61,38,96,.55)] border border-[rgba(232,145,176,.2)] rounded-[18px] p-8 backdrop-blur-sm">
                <div className="w-12 h-12 bg-gradient-to-br from-[#5a3a8a] to-[#d4709a] rounded-[13px] flex items-center justify-center mb-5 shadow-[0_0_18px_rgba(212,112,154,.28)]">
                  <svg className="w-[21px] h-[21px] fill-none stroke-white stroke-[1.8] [stroke-linecap:round] [stroke-linejoin:round]" viewBox="0 0 24 24"><path d="M6 3h12M6 8h12M15 21L9 13H6m3 0h3a4 4 0 000-8H6" /></svg>
                </div>
                <h3 className="jfw-serif text-[1.25rem] text-white mb-2 leading-[1.3]">Pay Transparency</h3>
                <p className="text-[.86rem] text-[rgba(240,230,246,.62)] leading-[1.8]">Every role listed on JFW shows its salary range. No negotiating blind. No discovering a colleague earns more. We insist on transparency because you deserve to know your worth before you apply.</p>
              </div>
              <div className="jfw-feature-card jfw-reveal jfw-rd3 bg-[rgba(61,38,96,.55)] border border-[rgba(232,145,176,.2)] rounded-[18px] p-8 backdrop-blur-sm">
                <div className="w-12 h-12 bg-gradient-to-br from-[#5a3a8a] to-[#d4709a] rounded-[13px] flex items-center justify-center mb-5 shadow-[0_0_18px_rgba(212,112,154,.28)]">
                  <svg className="w-[21px] h-[21px] fill-none stroke-white stroke-[1.8] [stroke-linecap:round] [stroke-linejoin:round]" viewBox="0 0 24 24"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" /></svg>
                </div>
                <h3 className="jfw-serif text-[1.25rem] text-white mb-2 leading-[1.3]">Menstrual Leave Champions</h3>
                <p className="text-[.86rem] text-[rgba(240,230,246,.62)] leading-[1.8]">Our Premium Partner tier is reserved for companies that mandate menstrual leave as policy. These companies get priority placement, higher visibility, and a verified badge on every listing.</p>
                <div className="jfw-premium-badge inline-flex items-center gap-1 bg-[rgba(232,145,176,.14)] border border-[rgba(232,145,176,.32)] text-[#f2c4d0] text-[.68rem] px-3 py-[.28rem] rounded-full mt-3">⭐ Premium Partner — Menstrual Leave Mandated</div>
              </div>
              <div className="jfw-feature-card jfw-reveal jfw-rd1 bg-[rgba(61,38,96,.55)] border border-[rgba(232,145,176,.2)] rounded-[18px] p-8 backdrop-blur-sm">
                <div className="w-12 h-12 bg-gradient-to-br from-[#5a3a8a] to-[#d4709a] rounded-[13px] flex items-center justify-center mb-5 shadow-[0_0_18px_rgba(212,112,154,.28)]">
                  <svg className="w-[21px] h-[21px] fill-none stroke-white stroke-[1.8] [stroke-linecap:round] [stroke-linejoin:round]" viewBox="0 0 24 24"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></svg>
                </div>
                <h3 className="jfw-serif text-[1.25rem] text-white mb-2 leading-[1.3]">Smart Career Matching</h3>
                <p className="text-[.86rem] text-[rgba(240,230,246,.62)] leading-[1.8]">We match on where you want to go, not just where you've been. Culture fit, flexibility, salary, growth direction — our matching goes deeper than keywords.</p>
              </div>
              <div className="jfw-feature-card jfw-reveal jfw-rd2 bg-[rgba(61,38,96,.55)] border border-[rgba(232,145,176,.2)] rounded-[18px] p-8 backdrop-blur-sm">
                <div className="w-12 h-12 bg-gradient-to-br from-[#5a3a8a] to-[#d4709a] rounded-[13px] flex items-center justify-center mb-5 shadow-[0_0_18px_rgba(212,112,154,.28)]">
                  <svg className="w-[21px] h-[21px] fill-none stroke-white stroke-[1.8] [stroke-linecap:round] [stroke-linejoin:round]" viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" /></svg>
                </div>
                <h3 className="jfw-serif text-[1.25rem] text-white mb-2 leading-[1.3]">Women-Only Community</h3>
                <p className="text-[.86rem] text-[rgba(240,230,246,.62)] leading-[1.8]">A private space for real conversations — mentorship, referrals, advice, celebrations. No performative cheerleading. Just women genuinely supporting women.</p>
              </div>
              <div className="jfw-feature-card jfw-reveal jfw-rd3 bg-[rgba(61,38,96,.55)] border border-[rgba(232,145,176,.2)] rounded-[18px] p-8 backdrop-blur-sm">
                <div className="w-12 h-12 bg-gradient-to-br from-[#5a3a8a] to-[#d4709a] rounded-[13px] flex items-center justify-center mb-5 shadow-[0_0_18px_rgba(212,112,154,.28)]">
                  <svg className="w-[21px] h-[21px] fill-none stroke-white stroke-[1.8] [stroke-linecap:round] [stroke-linejoin:round]" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
                </div>
                <h3 className="jfw-serif text-[1.25rem] text-white mb-2 leading-[1.3]">Returnship Ready</h3>
                <p className="text-[.86rem] text-[rgba(240,230,246,.62)] leading-[1.8]">Career gaps are not red flags on JFW. We celebrate women re-entering the workforce and match them with companies that see experience, not absence.</p>
              </div>
            </div>
          </section>

          {/* COMPANIES JOINING */}
          <section className="py-28 px-[5%]">
            <div className="jfw-reveal text-center mb-16">
              <span className="text-[.65rem] tracking-[.22em] uppercase text-[#e891b0] font-medium mb-3 block">GROWING INTEREST</span>
              <h2 className="jfw-serif text-white font-normal leading-[1.2]" style={{ fontSize: "clamp(2rem,3.8vw,3rem)" }}>Companies Are <em className="italic text-[#e891b0]">Joining Every Day</em></h2>
              <p className="text-[.96rem] text-[rgba(240,230,246,.62)] leading-[1.8] max-w-[560px] mt-4 mx-auto">Companies across 40+ industries are recognizing that real workplace equity attracts top talent. They're signing up to commit to transparency and real change.</p>
            </div>
            <div className="grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-6 max-w-[1100px] mx-auto">
              <div className="jfw-feature-card bg-[rgba(61,38,96,.55)] border border-[rgba(232,145,176,.2)] rounded-[20px] p-10 text-center">
                <div className="jfw-serif text-[3.6rem] text-[#e891b0] font-semibold leading-none mb-3">20+</div>
                <div className="text-[.95rem] text-[rgba(240,230,246,.85)] font-medium mb-2">Companies registered on JFW</div>
                <div className="text-[.82rem] text-[#e891b0] italic">And growing weekly</div>
              </div>
              <div className="jfw-feature-card bg-[rgba(61,38,96,.55)] border border-[rgba(232,145,176,.2)] rounded-[20px] p-10 text-center">
                <div className="jfw-serif text-[3.6rem] text-[#e891b0] font-semibold leading-none mb-3">500+</div>
                <div className="text-[.95rem] text-[rgba(240,230,246,.85)] font-medium mb-2">Women actively registered on JFW</div>
                <div className="text-[.82rem] text-[#e891b0] italic">In 6 months of operations</div>
              </div>
              <div className="jfw-feature-card bg-[rgba(61,38,96,.55)] border border-[rgba(232,145,176,.2)] rounded-[20px] p-10 text-center">
                <div className="jfw-serif text-[3.6rem] text-[#e891b0] font-semibold leading-none mb-3">40+</div>
                <div className="text-[.95rem] text-[rgba(240,230,246,.85)] font-medium mb-2">Industries represented</div>
                <div className="text-[.82rem] text-[#e891b0] italic">From startups to enterprises</div>
              </div>
            </div>
            <div className="jfw-reveal mt-16 max-w-[680px] mx-auto bg-[rgba(61,38,96,.5)] border border-[rgba(232,145,176,.2)] rounded-[22px] p-10 text-center backdrop-blur-sm">
              <h3 className="jfw-serif text-[1.7rem] text-white font-normal mb-3">Want to Partner with JFW?</h3>
              <p className="text-[.9rem] text-[rgba(240,230,246,.62)] leading-[1.75] mb-7">Companies that commit to transparency and equity get priority placement and a Premium Partner badge.</p>
              <button onClick={goToRecruiterRegister} className="inline-flex items-center gap-2 bg-[#d4709a] text-white px-9 py-[.95rem] rounded-full text-[.88rem] font-medium border-none cursor-pointer jfw-sans shadow-[0_0_22px_rgba(232,145,176,.45)] hover:shadow-[0_0_40px_rgba(232,145,176,.45)] hover:-translate-y-0.5 transition-all">Register Your Company →</button>
            </div>
          </section>

          {/* INDUSTRY REVIEWS */}
          <section className="py-28 px-[5%]" style={{ background: "linear-gradient(135deg,rgba(45,27,78,.4),rgba(26,13,46,.6))" }}>
            <div className="jfw-reveal text-center mb-16">
              <span className="text-[.65rem] tracking-[.22em] uppercase text-[#e891b0] font-medium mb-3 block">INDUSTRY REVIEWS</span>
              <h2 className="jfw-serif text-white font-normal leading-[1.2]" style={{ fontSize: "clamp(2rem,3.8vw,3rem)" }}>What Industry Experts <em className="italic text-[#e891b0]">Say</em></h2>
            </div>
            <div className="grid grid-cols-[repeat(auto-fit,minmax(340px,1fr))] gap-8 max-w-[1100px] mx-auto">
              <div className="jfw-feature-card jfw-reveal jfw-rd1 bg-[rgba(61,38,96,.55)] border border-[rgba(232,145,176,.2)] rounded-[20px] p-8 backdrop-blur-sm">
                <div className="flex items-center gap-4 mb-5">
                  <div className="w-12 h-12 rounded-full flex-shrink-0 overflow-hidden border border-[rgba(232,145,176,.2)]" style={{ background: "#fff" }}>
                    <img src="/landing/seainfonet-logo.jpg" alt="SeaInfoNet Logo" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                  </div>
                  <div>
                    <div className="text-white font-medium text-[.95rem]">SeaInfoNet</div>
                    <div className="text-[.78rem] text-[rgba(240,230,246,.55)]">Tech &amp; Career Authority</div>
                  </div>
                </div>
                <div className="flex items-center gap-2 mb-4">
                  <div className="flex gap-[3px]">
                    <span className="text-[#e891b0] text-[1.05rem]">★</span><span className="text-[#e891b0] text-[1.05rem]">★</span><span className="text-[#e891b0] text-[1.05rem]">★</span><span className="text-[#e891b0] text-[1.05rem]">★</span><span className="text-[#e891b0] text-[1.05rem]">★</span>
                  </div>
                  <span className="text-[.8rem] text-[rgba(240,230,246,.62)]">5.0/5.0</span>
                </div>
                <p className="text-[.88rem] text-[rgba(240,230,246,.85)] leading-[1.75] mb-4"><strong className="text-white">"JFW is revolutionizing the career platform space."</strong> With mandatory pay transparency, rigorous women-first culture assessments, and genuine commitment to menstrual leave policies, JFW delivers real equity measures that protect women's actual interests.</p>
                <p className="text-[.85rem] text-[rgba(240,230,246,.7)] leading-[1.7] mb-6"><strong className="text-[#f2c4d0]">Key strength:</strong> Transparent salaries across all listings, rigorous company vetting, and women-only community support for genuine career growth.</p>
                <a href="https://seainfonet.com" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 bg-[rgba(232,145,176,.12)] border border-[rgba(232,145,176,.3)] text-[#f2c4d0] px-5 py-[.65rem] rounded-full text-[.82rem] font-medium no-underline hover:bg-[rgba(232,145,176,.22)] hover:text-white transition-all cursor-pointer">Visit SeaInfoNet →</a>
              </div>
              <div className="jfw-feature-card jfw-reveal jfw-rd2 bg-[rgba(61,38,96,.55)] border border-[rgba(232,145,176,.2)] rounded-[20px] p-8 backdrop-blur-sm">
                <div className="flex items-center gap-4 mb-5">
                  <div className="w-12 h-12 rounded-full flex-shrink-0 overflow-hidden border border-[rgba(232,145,176,.2)]" style={{ background: "#0a1628" }}>
                    <img src="/landing/zerobreach-logo.jpg" alt="ZeroBreach Logo" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                  </div>
                  <div>
                    <div className="text-white font-medium text-[.95rem]">ZeroBreach</div>
                    <div className="text-[.78rem] text-[rgba(240,230,246,.55)]">Security Solutions Partner</div>
                  </div>
                </div>
                <div className="flex items-center gap-2 mb-4">
                  <div className="flex gap-[3px]">
                    <span className="text-[#e891b0] text-[1.05rem]">★</span><span className="text-[#e891b0] text-[1.05rem]">★</span><span className="text-[#e891b0] text-[1.05rem]">★</span><span className="text-[#e891b0] text-[1.05rem]">★</span><span className="text-[#e891b0] text-[1.05rem]">★</span>
                  </div>
                  <span className="text-[.8rem] text-[rgba(240,230,246,.62)]">5.0/5.0</span>
                </div>
                <p className="text-[.88rem] text-[rgba(240,230,246,.85)] leading-[1.75] mb-4"><strong className="text-white">"JFW is doing for career equity what we do for cybersecurity."</strong> Just as ZeroBreach demands proof-of-concept before deployment, JFW demands real data — transparent salaries, verified culture standards, and genuine accountability from companies.</p>
                <p className="text-[.85rem] text-[rgba(240,230,246,.7)] leading-[1.7] mb-6"><strong className="text-[#f2c4d0]">Key strength:</strong> Outcome-first model, rigorous company vetting, and women-only community support that delivers real career impact.</p>
                <a href="https://zerobreach.in" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 bg-[rgba(232,145,176,.12)] border border-[rgba(232,145,176,.3)] text-[#f2c4d0] px-5 py-[.65rem] rounded-full text-[.82rem] font-medium no-underline hover:bg-[rgba(232,145,176,.22)] hover:text-white transition-all cursor-pointer">Visit ZeroBreach →</a>
              </div>
            </div>
          </section>

          {/* WHY SEPARATE PLATFORM */}
          <section className="py-28 px-[5%] relative overflow-hidden" style={{ background: "linear-gradient(160deg,rgba(35,18,60,.7) 0%,rgba(26,13,46,.9) 100%)" }}>
            <div className="absolute -top-32 -right-32 w-[500px] h-[500px] rounded-full pointer-events-none" style={{ background: "radial-gradient(circle,rgba(212,112,154,.12),transparent 70%)" }} />
            <div className="absolute -bottom-24 -left-24 w-[350px] h-[350px] rounded-full pointer-events-none" style={{ background: "radial-gradient(circle,rgba(90,58,138,.18),transparent 70%)" }} />

            <div className="jfw-reveal mb-14">
              <span className="text-[.65rem] tracking-[.22em] uppercase text-[#e891b0] font-medium mb-3 block">The Real Question</span>
              <h2 className="jfw-serif text-white font-normal leading-[1.2]" style={{ fontSize: "clamp(2rem,3.8vw,3rem)" }}>Why Does a Woman Need <em className="italic text-[#e891b0]">Her Own Platform?</em></h2>
              <p className="text-[.96rem] text-[rgba(240,230,246,.62)] leading-[1.8] max-w-[600px] mt-4">Because a woman doesn't earn just for herself. She earns for a generation.</p>
            </div>

            <div className="jfw-reveal mb-16 max-w-[860px]">
              <div className="bg-gradient-to-r from-[rgba(232,145,176,.08)] to-transparent border-l-[3px] border-[#e891b0] pl-8 py-6 rounded-r-[14px]">
                <p className="jfw-serif text-[1.35rem] text-white leading-[1.6] italic">"When a woman earns, she doesn't just pay bills — she reshapes the future. She is the first teacher of every child, the silent architect of every home, and the quiet force behind every generation. Her income is not personal. It is <span className="text-[#e891b0] not-italic font-semibold">generational.</span>"</p>
                <div className="mt-4 text-[.75rem] tracking-[.14em] uppercase text-[#e891b0] opacity-80">— The JFW Belief</div>
              </div>
            </div>

            <div className="grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-[1.4rem] mb-16">
              <div className="jfw-feature-card jfw-reveal jfw-rd1 bg-[rgba(61,38,96,.45)] border border-[rgba(232,145,176,.18)] rounded-[18px] p-8 backdrop-blur-sm">
                <div className="text-[2.2rem] mb-4">👶</div>
                <h3 className="jfw-serif text-[1.2rem] text-white mb-3 leading-[1.3]">She Shapes the Next Generation</h3>
                <p className="text-[.86rem] text-[rgba(240,230,246,.62)] leading-[1.82]">A woman who earns confidently raises children who believe in equity. Her financial independence teaches her sons to respect women and her daughters to never settle. Every rupee she earns is an investment in a better generation — not just a better bank balance.</p>
              </div>
              <div className="jfw-feature-card jfw-reveal jfw-rd2 bg-[rgba(61,38,96,.45)] border border-[rgba(232,145,176,.18)] rounded-[18px] p-8 backdrop-blur-sm">
                <div className="text-[2.2rem] mb-4">🏠</div>
                <h3 className="jfw-serif text-[1.2rem] text-white mb-3 leading-[1.3]">Her Earning Serves Many</h3>
                <p className="text-[.86rem] text-[rgba(240,230,246,.62)] leading-[1.82]">Studies show that when women control household income, more of it goes toward children's education, nutrition, and health. A woman's earning isn't just her livelihood — it's a community investment. She earns for parents, for children, for siblings, for the future. Her purpose is bigger than a paycheck.</p>
              </div>
              <div className="jfw-feature-card jfw-reveal jfw-rd3 bg-[rgba(61,38,96,.45)] border border-[rgba(232,145,176,.18)] rounded-[18px] p-8 backdrop-blur-sm">
                <div className="text-[2.2rem] mb-4">⚖️</div>
                <h3 className="jfw-serif text-[1.2rem] text-white mb-3 leading-[1.3]">Her Barriers Are Different</h3>
                <p className="text-[.86rem] text-[rgba(240,230,246,.62)] leading-[1.82]">A general job board doesn't understand career gaps from maternity. It doesn't flag companies with a gender pay gap. It doesn't show menstrual leave policies or flag toxic cultures. Women need a platform that understands the invisible tax they pay — and refuses to let them pay it alone.</p>
              </div>
            </div>

            <div className="jfw-reveal">
              <div className="bg-[rgba(26,13,46,.8)] border border-[rgba(232,145,176,.22)] rounded-[22px] p-[2.8rem] md:p-[4rem] text-center relative overflow-hidden">
                <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(ellipse 70% 60% at 50% 50%,rgba(212,112,154,.07),transparent 70%)" }} />
                <div className="relative z-10">
                  <div className="inline-flex items-center gap-2 bg-[rgba(232,145,176,.1)] border border-[rgba(232,145,176,.25)] text-[#e891b0] text-[.72rem] tracking-[.18em] uppercase px-5 py-2 rounded-full mb-8">💜 Identity</div>
                  <h3 className="jfw-serif text-white leading-[1.18] mb-6" style={{ fontSize: "clamp(2.2rem,5vw,4rem)" }}>We Are <em className="italic text-[#e891b0]">Generation Shapers.</em></h3>
                  <p className="text-[1rem] text-[rgba(240,230,246,.72)] leading-[1.85] max-w-[640px] mx-auto mb-8">We are not job seekers. We are not just employees. We are mothers, daughters, sisters, caregivers, leaders, and dreamers — and our careers do not exist in isolation. They ripple outward into families, communities, and futures not yet born. When we work with dignity, the world changes. That's why JFW exists. Not just to find you a job. To find you a place where your work means something.</p>
                  <div className="flex flex-wrap gap-3 justify-center">
                    <span className="bg-[rgba(232,145,176,.1)] border border-[rgba(232,145,176,.2)] text-[#f2c4d0] text-[.8rem] px-5 py-2 rounded-full">Mothers who lead</span>
                    <span className="bg-[rgba(232,145,176,.1)] border border-[rgba(232,145,176,.2)] text-[#f2c4d0] text-[.8rem] px-5 py-2 rounded-full">Daughters who rise</span>
                    <span className="bg-[rgba(232,145,176,.1)] border border-[rgba(232,145,176,.2)] text-[#f2c4d0] text-[.8rem] px-5 py-2 rounded-full">Caregivers who career</span>
                    <span className="bg-[rgba(232,145,176,.1)] border border-[rgba(232,145,176,.2)] text-[#f2c4d0] text-[.8rem] px-5 py-2 rounded-full">Returners who reclaim</span>
                    <span className="bg-[rgba(232,145,176,.1)] border border-[rgba(232,145,176,.2)] text-[#f2c4d0] text-[.8rem] px-5 py-2 rounded-full">Earners who invest in tomorrow</span>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* PURPOSE OF EARNING */}
          <section className="py-28 px-[5%]">
            <div className="jfw-reveal mb-14">
              <span className="text-[.65rem] tracking-[.22em] uppercase text-[#e891b0] font-medium mb-3 block">A Different Purpose</span>
              <h2 className="jfw-serif text-white font-normal leading-[1.2]" style={{ fontSize: "clamp(2rem,3.8vw,3rem)" }}>Why a Woman's Earning <em className="italic text-[#e891b0]">Is Never Just Hers</em></h2>
              <p className="text-[.96rem] text-[rgba(240,230,246,.62)] leading-[1.8] max-w-[560px] mt-4">Most job platforms treat earning as a transaction. JFW understands it as a transformation.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
              <div className="jfw-reveal jfw-rd1 flex flex-col gap-5">
                <div className="jfw-feature-card bg-[rgba(61,38,96,.45)] border border-[rgba(232,145,176,.18)] rounded-[18px] p-7 flex items-start gap-5">
                  <div className="flex-shrink-0 w-14 h-14 bg-gradient-to-br from-[#5a3a8a] to-[#d4709a] rounded-[13px] flex items-center justify-center text-[1.6rem]">🎓</div>
                  <div>
                    <h4 className="jfw-serif text-[1.1rem] text-white mb-2">Education of the Next Generation</h4>
                    <p className="text-[.84rem] text-[rgba(240,230,246,.62)] leading-[1.75]">When a mother earns, children stay in school longer. Her income directly translates to educational outcomes for her family — sometimes across two generations. Her salary is not just a number. It's a school fee, a textbook, a future.</p>
                  </div>
                </div>
                <div className="jfw-feature-card bg-[rgba(61,38,96,.45)] border border-[rgba(232,145,176,.18)] rounded-[18px] p-7 flex items-start gap-5">
                  <div className="flex-shrink-0 w-14 h-14 bg-gradient-to-br from-[#5a3a8a] to-[#d4709a] rounded-[13px] flex items-center justify-center text-[1.6rem]">💊</div>
                  <div>
                    <h4 className="jfw-serif text-[1.1rem] text-white mb-2">Health &amp; Safety of Her Household</h4>
                    <p className="text-[.84rem] text-[rgba(240,230,246,.62)] leading-[1.75]">A financially independent woman is more likely to access healthcare for herself and her family, exit unsafe situations, and make decisions based on her own judgment — not financial desperation. Economic freedom is physical safety.</p>
                  </div>
                </div>
                <div className="jfw-feature-card bg-[rgba(61,38,96,.45)] border border-[rgba(232,145,176,.18)] rounded-[18px] p-7 flex items-start gap-5">
                  <div className="flex-shrink-0 w-14 h-14 bg-gradient-to-br from-[#5a3a8a] to-[#d4709a] rounded-[13px] flex items-center justify-center text-[1.6rem]">🌱</div>
                  <div>
                    <h4 className="jfw-serif text-[1.1rem] text-white mb-2">Legacy of Equality</h4>
                    <p className="text-[.84rem] text-[rgba(240,230,246,.62)] leading-[1.75]">When a daughter watches her mother negotiate a salary, she learns that her voice has value. When a son sees his mother respected at work, he grows up respecting women. The ripple effect of one woman's career is immeasurable — and permanent.</p>
                  </div>
                </div>
              </div>

              <div className="jfw-reveal jfw-rd2 flex flex-col gap-5">
                <div className="jfw-feature-card bg-[rgba(61,38,96,.45)] border border-[rgba(232,145,176,.18)] rounded-[18px] p-7 flex items-start gap-5">
                  <div className="flex-shrink-0 w-14 h-14 bg-gradient-to-br from-[#5a3a8a] to-[#d4709a] rounded-[13px] flex items-center justify-center text-[1.6rem]">🏛️</div>
                  <div>
                    <h4 className="jfw-serif text-[1.1rem] text-white mb-2">Economic Contribution to the Nation</h4>
                    <p className="text-[.84rem] text-[rgba(240,230,246,.62)] leading-[1.75]">India's GDP could grow by over 27% if women participated in the workforce equally. Every woman who earns, who thrives, who leads — is not just building her life. She is building the economy. Her ambition is national progress.</p>
                  </div>
                </div>
                <div className="jfw-feature-card bg-[rgba(61,38,96,.45)] border border-[rgba(232,145,176,.18)] rounded-[18px] p-7 flex items-start gap-5">
                  <div className="flex-shrink-0 w-14 h-14 bg-gradient-to-br from-[#5a3a8a] to-[#d4709a] rounded-[13px] flex items-center justify-center text-[1.6rem]">🔁</div>
                  <div>
                    <h4 className="jfw-serif text-[1.1rem] text-white mb-2">Breaking the Cycle of Dependence</h4>
                    <p className="text-[.84rem] text-[rgba(240,230,246,.62)] leading-[1.75]">For generations, women have been conditioned to depend. Every woman who finds a career she loves — with pay she deserves, in a culture that respects her — breaks a cycle that has persisted for centuries. JFW is that break. That turning point. That first breath of something different.</p>
                  </div>
                </div>
                <div className="jfw-feature-card bg-[rgba(61,38,96,.45)] border border-[rgba(232,145,176,.18)] rounded-[18px] p-7 flex items-start gap-5">
                  <div className="flex-shrink-0 w-14 h-14 bg-gradient-to-br from-[#5a3a8a] to-[#d4709a] rounded-[13px] flex items-center justify-center text-[1.6rem]">✨</div>
                  <div>
                    <h4 className="jfw-serif text-[1.1rem] text-white mb-2">She Earns Differently — and That's Her Superpower</h4>
                    <p className="text-[.84rem] text-[rgba(240,230,246,.62)] leading-[1.75]">A man earns for ambition. A woman earns for survival, for purpose, for legacy, for love. She carries the weight of many on her salary slip — and still negotiates less, earns less, and asks for less. JFW says: no more. Know your worth. Ask for it. Receive it. You've earned this — in every sense of the word.</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="jfw-reveal max-w-[760px] mx-auto text-center">
              <div className="bg-[rgba(26,13,46,.7)] border border-[rgba(232,145,176,.18)] rounded-[18px] px-10 py-8">
                <p className="jfw-serif text-[1.2rem] text-white leading-[1.7] italic">"General job boards were built for a general world. But women don't live in a general world. They live in one where their career choices carry the weight of family expectations, societal judgment, biological realities, and generational responsibility. JFW was built for <em className="text-[#e891b0] not-italic">that</em> world."</p>
              </div>
            </div>
          </section>

          {/* INDUSTRIES */}
          <section className="py-28 px-[5%] jfw-reveal">
            <span className="text-[.65rem] tracking-[.22em] uppercase text-[#e891b0] font-medium mb-3 block">Industries We Serve</span>
            <h2 className="jfw-serif text-white font-normal leading-[1.2]" style={{ fontSize: "clamp(2rem,3.8vw,3rem)" }}>Across Every Sector, <em className="italic text-[#e891b0]">For Every Woman</em></h2>
            <p className="text-[.96rem] text-[rgba(240,230,246,.62)] leading-[1.8] max-w-[520px] mt-3">40+ industries — because talented women exist everywhere.</p>
            <div className="flex flex-wrap gap-[.6rem] mt-7">
              {INDUSTRIES.map((ind) => (
                <span key={ind} className="bg-[rgba(61,38,96,.5)] border border-[rgba(232,145,176,.16)] rounded-[7px] px-[.95rem] py-[.42rem] text-[.84rem] text-[rgba(240,230,246,.62)] hover:bg-[rgba(232,145,176,.11)] hover:border-[rgba(232,145,176,.38)] hover:text-white transition-all duration-200 cursor-default">{ind}</span>
              ))}
            </div>
          </section>

          {/* TOOLS */}
          <section className="py-28 px-[5%]">
            <div className="jfw-reveal">
              <span className="text-[.65rem] tracking-[.22em] uppercase text-[#e891b0] font-medium mb-3 block">Powerful Tools</span>
              <h2 className="jfw-serif text-white font-normal leading-[1.2]" style={{ fontSize: "clamp(2rem,3.8vw,3rem)" }}>Your Career <em className="italic text-[#e891b0]">Acceleration Suite</em></h2>
              <p className="text-[.96rem] text-[rgba(240,230,246,.62)] leading-[1.8] max-w-[520px] mt-3">Career-defining tools for JFW members. Resources available now — full AI features coming soon.</p>
            </div>
            <div className="grid grid-cols-[repeat(auto-fit,minmax(270px,1fr))] gap-[1.4rem] mt-12">
              <div className="jfw-feature-card jfw-reveal jfw-rd1 bg-[rgba(61,38,96,.55)] border border-[rgba(232,145,176,.2)] rounded-[20px] p-8 relative overflow-hidden">
                <div className="inline-block bg-[#d4709a] text-white text-[.56rem] tracking-[.14em] uppercase px-3 py-[.26rem] rounded-full mb-[.9rem] shadow-[0_0_10px_rgba(232,145,176,.45)]">COMING SOON</div>
                <div className="w-12 h-12 bg-gradient-to-br from-[rgba(90,58,138,.8)] to-[rgba(212,112,154,.6)] rounded-[13px] flex items-center justify-center mb-[.9rem] shadow-[0_0_16px_rgba(212,112,154,.2)]">
                  <svg viewBox="0 0 24 24" className="w-[21px] h-[21px]"><path d="M6 3h12M6 8h12M15 21L9 13H6m3 0h3a4 4 0 000-8H6" stroke="#fff" fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </div>
                <h3 className="jfw-serif text-[1.25rem] text-white mb-[.45rem] leading-[1.3]">Salary Negotiator</h3>
                <p className="text-[.84rem] text-[rgba(240,230,246,.62)] leading-[1.75]">Master salary negotiation with scripts, psychology tactics, real case studies, and how to handle every pushback. Get ₹2-5 LPA more just by asking.</p>
              </div>
              <div className="jfw-feature-card jfw-reveal jfw-rd2 bg-[rgba(61,38,96,.55)] border border-[rgba(232,145,176,.2)] rounded-[20px] p-8 relative overflow-hidden">
                <div className="inline-block bg-[#d4709a] text-white text-[.56rem] tracking-[.14em] uppercase px-3 py-[.26rem] rounded-full mb-[.9rem] shadow-[0_0_10px_rgba(232,145,176,.45)]">COMING SOON</div>
                <div className="w-12 h-12 bg-gradient-to-br from-[rgba(90,58,138,.8)] to-[rgba(212,112,154,.6)] rounded-[13px] flex items-center justify-center mb-[.9rem] shadow-[0_0_16px_rgba(212,112,154,.2)]">
                  <svg className="w-[21px] h-[21px] fill-none stroke-white stroke-[1.8] [stroke-linecap:round] [stroke-linejoin:round]" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /></svg>
                </div>
                <h3 className="jfw-serif text-[1.25rem] text-white mb-[.45rem] leading-[1.3]">Resume Blueprint</h3>
                <p className="text-[.84rem] text-[rgba(240,230,246,.62)] leading-[1.75]">Beat ATS systems that reject 75% of resumes. Complete framework to get your resume on a recruiter's desk, not in the trash.</p>
              </div>
              <div className="jfw-feature-card jfw-reveal jfw-rd3 bg-[rgba(61,38,96,.55)] border border-[rgba(232,145,176,.2)] rounded-[20px] p-8 relative overflow-hidden">
                <div className="inline-block bg-[#d4709a] text-white text-[.56rem] tracking-[.14em] uppercase px-3 py-[.26rem] rounded-full mb-[.9rem] shadow-[0_0_10px_rgba(232,145,176,.45)]">COMING SOON</div>
                <div className="w-12 h-12 bg-gradient-to-br from-[rgba(90,58,138,.8)] to-[rgba(212,112,154,.6)] rounded-[13px] flex items-center justify-center mb-[.9rem] shadow-[0_0_16px_rgba(212,112,154,.2)]">
                  <svg className="w-[21px] h-[21px] fill-none stroke-white stroke-[1.8] [stroke-linecap:round] [stroke-linejoin:round]" viewBox="0 0 24 24"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" /></svg>
                </div>
                <h3 className="jfw-serif text-[1.25rem] text-white mb-[.45rem] leading-[1.3]">Career Gap Comeback</h3>
                <p className="text-[.84rem] text-[rgba(240,230,246,.62)] leading-[1.75]">Transform your break into your superpower. Reframe your gap, address concerns in interviews, negotiate fairly, and prove stability to employers.</p>
              </div>
              <div className="jfw-feature-card jfw-reveal jfw-rd4 bg-[rgba(61,38,96,.55)] border border-[rgba(232,145,176,.2)] rounded-[20px] p-8 relative overflow-hidden">
                <div className="inline-block bg-[#d4709a] text-white text-[.56rem] tracking-[.14em] uppercase px-3 py-[.26rem] rounded-full mb-[.9rem] shadow-[0_0_10px_rgba(232,145,176,.45)]">COMING SOON</div>
                <div className="w-12 h-12 bg-gradient-to-br from-[rgba(90,58,138,.8)] to-[rgba(212,112,154,.6)] rounded-[13px] flex items-center justify-center mb-[.9rem] shadow-[0_0_16px_rgba(212,112,154,.2)]">
                  <svg className="w-[21px] h-[21px] fill-none stroke-white stroke-[1.8] [stroke-linecap:round] [stroke-linejoin:round]" viewBox="0 0 24 24"><circle cx="12" cy="8" r="6" /><path d="M15.477 12.89L17 22l-5-3-5 3 1.523-9.11" /></svg>
                </div>
                <h3 className="jfw-serif text-[1.25rem] text-white mb-[.45rem] leading-[1.3]">Interview Mastery</h3>
                <p className="text-[.84rem] text-[rgba(240,230,246,.62)] leading-[1.75]">Answer every question with confidence. Scripts for classic questions, STAR method for behavioral, how to handle curveballs, and post-interview strategies.</p>
              </div>
            </div>
          </section>

          {/* FOUNDERS */}
          <section className="py-28 px-[5%]">
            <div className="jfw-reveal">
              <span className="text-[.65rem] tracking-[.22em] uppercase text-[#e891b0] font-medium mb-3 block">The Founders Behind JFW</span>
              <h2 className="jfw-serif text-white font-normal leading-[1.2]" style={{ fontSize: "clamp(2rem,3.8vw,3rem)" }}>Two women. One mission. <em className="italic text-[#e891b0]">Zero settling.</em></h2>
            </div>
            <div className="grid grid-cols-[repeat(auto-fit,minmax(340px,1fr))] gap-8 mt-14">
              <div className="jfw-feature-card jfw-reveal jfw-rd1 bg-[rgba(61,38,96,.55)] rounded-[22px] p-[2.2rem] border border-[rgba(232,145,176,.2)] backdrop-blur-sm">
                <div className="flex items-start gap-[1.3rem] mb-[1.3rem]">
                  <div className="flex-shrink-0">
                    <div className="jfw-favatar w-[200px] h-[200px] rounded-full bg-gradient-to-br from-[#f2c4d0] to-[#d4709a] flex items-center justify-center jfw-serif text-[1.9rem] font-semibold text-[#1a0d2e] shadow-[0_0_28px_rgba(212,112,154,.45)] overflow-hidden">
                      <img src="/landing/founder-mahak.jpg" alt="Mahak Tiwari" />
                    </div>
                  </div>
                  <div>
                    <div className="jfw-serif text-[1.4rem] font-normal text-white mb-[.12rem] leading-[1.2]">Mahak Tiwari</div>
                    <div className="text-[.68rem] tracking-[.12em] uppercase text-[#e891b0]">Co-Founder</div>
                  </div>
                </div>
                <p className="text-[.86rem] text-[rgba(240,230,246,.62)] leading-[1.82] mb-5">Mahak built JFW after watching brilliant women leave jobs not because they couldn't do the work — but because the workplace made them feel they had to choose between ambition and identity. She decided to stop adapting and start building. JFW is her answer: not a diversity campaign, but a whole new platform built on the belief that the problem was never the women. It was the systems around them.</p>
                <div className="jfw-serif text-[1rem] italic text-[rgba(240,230,246,.82)] pt-5 border-t border-[rgba(232,145,176,.14)] leading-[1.65]">"I didn't build JFW to fix women. I built it to fix the systems that were failing them."</div>
                <div className="inline-flex items-center gap-1 mt-[.9rem] bg-[rgba(232,145,176,.09)] border border-[rgba(232,145,176,.22)] text-[#f2c4d0] text-[.68rem] tracking-[.09em] px-[.85rem] py-[.3rem] rounded-full">Co-Founder</div>
              </div>
              <div className="jfw-feature-card jfw-reveal jfw-rd2 bg-[rgba(61,38,96,.55)] rounded-[22px] p-[2.2rem] border border-[rgba(232,145,176,.2)] backdrop-blur-sm">
                <div className="flex items-start gap-[1.3rem] mb-[1.3rem]">
                  <div className="flex-shrink-0">
                    <div className="jfw-favatar w-[200px] h-[200px] rounded-full bg-gradient-to-br from-[#f2c4d0] to-[#d4709a] flex items-center justify-center jfw-serif text-[1.9rem] font-semibold text-[#1a0d2e] shadow-[0_0_28px_rgba(212,112,154,.45)] overflow-hidden">
                      <img src="/landing/founder-yakshita.jpg" alt="Yakshita Tiwari" />
                    </div>
                  </div>
                  <div>
                    <div className="jfw-serif text-[1.4rem] font-normal text-white mb-[.12rem] leading-[1.2]">Yakshita Tiwari</div>
                    <div className="text-[.68rem] tracking-[.12em] uppercase text-[#e891b0]">Co-Founder</div>
                  </div>
                </div>
                <p className="text-[.86rem] text-[rgba(240,230,246,.62)] leading-[1.82] mb-5">Yakshita walks into broken systems and immediately starts drafting better ones — usually while making everyone around her laugh about how absurd the old one was. She joined JFW because she'd lived the same story: brilliant women navigating workplaces that expected endless patience from them but never the other way around. As JFW's Co-Founder, she brings sharp strategy and genuine warmth. She also has very strong opinions about cover letters and will absolutely rewrite yours if it undersells you.</p>
                <div className="jfw-serif text-[1rem] italic text-[rgba(240,230,246,.82)] pt-5 border-t border-[rgba(232,145,176,.14)] leading-[1.65]">"JFW exists because brilliance deserves better than to be wasted on companies that can't see it — and honestly, those companies deserve better too. They just don't know it yet."</div>
                <div className="inline-flex items-center gap-1 mt-[.9rem] bg-[rgba(232,145,176,.09)] border border-[rgba(232,145,176,.22)] text-[#f2c4d0] text-[.68rem] tracking-[.09em] px-[.85rem] py-[.3rem] rounded-full">Co-Founder</div>
              </div>
            </div>
          </section>

          {/* GENERATION SHAPERS */}
          <section className="py-28 px-[5%] relative overflow-hidden">
            <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(ellipse 80% 60% at 30% 50%,rgba(90,58,138,.3) 0%,transparent 70%),radial-gradient(ellipse 50% 40% at 80% 30%,rgba(212,112,154,.12) 0%,transparent 60%)" }} />
            <div className="jfw-reveal relative z-10 max-w-[820px]">
              <span className="text-[.65rem] tracking-[.22em] uppercase text-[#e891b0] font-medium mb-3 block">Why a Separate Platform?</span>
              <h2 className="jfw-serif text-white font-normal leading-[1.18]" style={{ fontSize: "clamp(2.2rem,4.5vw,3.6rem)" }}>Because the purpose of <em className="italic text-[#e891b0]">earning</em> is different for a woman.</h2>
            </div>
            <div className="grid grid-cols-[repeat(auto-fit,minmax(300px,1fr))] gap-[1.6rem] mt-16 relative z-10">
              <div className="jfw-reveal jfw-rd1 bg-[rgba(61,38,96,.55)] border border-[rgba(232,145,176,.2)] rounded-[20px] p-9 backdrop-blur-sm jfw-feature-card">
                <div className="text-[2.8rem] mb-4">👩‍👧‍👦</div>
                <h3 className="jfw-serif text-[1.3rem] text-white mb-3 leading-[1.3]">She Earns to Build Generations</h3>
                <p className="text-[.86rem] text-[rgba(240,230,246,.62)] leading-[1.85]">A woman's income doesn't just sustain a household — it educates children, cares for aging parents, and seeds the next generation's possibilities. When a woman earns with dignity, entire family trees change direction. That's not a paycheck. That's a legacy.</p>
              </div>
              <div className="jfw-reveal jfw-rd2 bg-[rgba(61,38,96,.55)] border border-[rgba(232,145,176,.2)] rounded-[20px] p-9 backdrop-blur-sm jfw-feature-card">
                <div className="text-[2.8rem] mb-4">🌱</div>
                <h3 className="jfw-serif text-[1.3rem] text-white mb-3 leading-[1.3]">She Carries Invisible Labour</h3>
                <p className="text-[.86rem] text-[rgba(240,230,246,.62)] leading-[1.85]">Before she walks into a workplace, she has already managed a household, made dozens of invisible decisions, and navigated systems not built for her. A job platform that doesn't acknowledge this is a platform that sets her up to fail. JFW is built with her full reality in mind.</p>
              </div>
              <div className="jfw-reveal jfw-rd3 bg-[rgba(61,38,96,.55)] border border-[rgba(232,145,176,.2)] rounded-[20px] p-9 backdrop-blur-sm jfw-feature-card">
                <div className="text-[2.8rem] mb-4">💡</div>
                <h3 className="jfw-serif text-[1.3rem] text-white mb-3 leading-[1.3]">She Defines Culture, Not Just Fills Roles</h3>
                <p className="text-[.86rem] text-[rgba(240,230,246,.62)] leading-[1.85]">Women don't just occupy jobs — they shape the emotional intelligence, empathy, and culture of every team they join. General job boards treat her as a résumé. JFW treats her as what she actually is: a force that changes organisations from the inside out.</p>
              </div>
            </div>

            <div className="jfw-reveal mt-16 relative z-10 bg-gradient-to-r from-[rgba(61,38,96,.7)] to-[rgba(26,13,46,.8)] border border-[rgba(232,145,176,.25)] rounded-[22px] p-10 md:p-14 flex flex-col md:flex-row items-center gap-8">
              <div className="flex-1">
                <div className="jfw-serif text-[2.2rem] md:text-[2.8rem] text-[#e891b0] font-light leading-none mb-2">We Are</div>
                <div className="jfw-serif text-[2.8rem] md:text-[4rem] text-white font-semibold leading-none tracking-tight">Generation<br />Shapers.</div>
              </div>
              <div className="flex-1 border-l-0 md:border-l border-[rgba(232,145,176,.2)] md:pl-10">
                <p className="text-[1rem] text-[rgba(240,230,246,.75)] leading-[1.9] mb-5">Every woman who earns independently, negotiates fairly, and chooses a company that respects her — is quietly rewriting the rules for the daughters, nieces, and younger sisters watching her.</p>
                <p className="text-[1rem] text-[rgba(240,230,246,.75)] leading-[1.9] mb-7">A general job board doesn't see this. <strong className="text-[#f2c4d0]">JFW does.</strong> That's why we exist.</p>
                <button onClick={goToCandidateRegister} className="inline-flex items-center gap-2 bg-[#d4709a] text-white px-7 py-[.85rem] rounded-full text-[.88rem] font-medium border-none cursor-pointer jfw-sans shadow-[0_0_22px_rgba(232,145,176,.45)] hover:shadow-[0_0_40px_rgba(232,145,176,.45)] hover:-translate-y-0.5 transition-all">I am a Generation Shaper →</button>
              </div>
            </div>

            <div className="jfw-reveal mt-12 grid grid-cols-2 md:grid-cols-4 gap-[1rem] relative z-10">
              <div className="bg-[rgba(61,38,96,.4)] border border-[rgba(232,145,176,.15)] rounded-[14px] p-6 text-center">
                <div className="jfw-serif text-[2.4rem] text-[#e891b0] font-semibold leading-none mb-1">40+</div>
                <div className="text-[.78rem] text-[rgba(240,230,246,.62)] leading-[1.5]">Industries where women are rewriting the rules</div>
              </div>
              <div className="bg-[rgba(61,38,96,.4)] border border-[rgba(232,145,176,.15)] rounded-[14px] p-6 text-center">
                <div className="jfw-serif text-[2.4rem] text-[#e891b0] font-semibold leading-none mb-1">100%</div>
                <div className="text-[.78rem] text-[rgba(240,230,246,.62)] leading-[1.5]">Free for candidates — your ambition shouldn't cost you</div>
              </div>
              <div className="bg-[rgba(61,38,96,.4)] border border-[rgba(232,145,176,.15)] rounded-[14px] p-6 text-center">
                <div className="jfw-serif text-[2.4rem] text-[#e891b0] font-semibold leading-none mb-1">₹0</div>
                <div className="text-[.78rem] text-[rgba(240,230,246,.62)] leading-[1.5]">Hidden fees, fine print, or compromise asked of you</div>
              </div>
              <div className="bg-[rgba(61,38,96,.4)] border border-[rgba(232,145,176,.15)] rounded-[14px] p-6 text-center">
                <div className="jfw-serif text-[2.4rem] text-[#e891b0] font-semibold leading-none mb-1">1st</div>
                <div className="text-[.78rem] text-[rgba(240,230,246,.62)] leading-[1.5]">India's first equity-verified career platform for women</div>
              </div>
            </div>
          </section>

          {/* MANIFESTO */}
          <section className="py-24 px-[5%] text-center jfw-reveal" style={{ background: "linear-gradient(135deg,rgba(61,38,96,.6),rgba(26,13,46,.8))" }}>
            <h2 className="jfw-serif font-light text-white max-w-[820px] mx-auto leading-[1.38]" style={{ fontSize: "clamp(1.7rem,3.8vw,2.9rem)" }}>We believe every woman deserves a career built on her <em className="italic text-[#e891b0]">talent</em>, her <em className="italic text-[#e891b0]">ambition</em>, and her own <em className="italic text-[#e891b0]">terms</em> — because she is not just an earner. She is a <em className="italic text-[#e891b0]">Generation Shaper</em>.</h2>
            <div className="flex flex-wrap gap-3 justify-center mt-10">
              {MANIFESTO_TAGS.map((tag, i) =>
                tag === "Generation Shapers 💜" ? (
                  <span key={i} className="bg-[#d4709a] text-white text-[.8rem] px-5 py-2 rounded-full shadow-[0_0_14px_rgba(232,145,176,.4)] cursor-default">{tag}</span>
                ) : (
                  <span key={i} className="bg-[rgba(232,145,176,.1)] text-[#f0e6f6] border border-[rgba(232,145,176,.2)] text-[.8rem] px-5 py-2 rounded-full hover:bg-[rgba(232,145,176,.18)] hover:shadow-[0_0_16px_rgba(232,145,176,.18)] transition-all duration-200 cursor-default">{tag}</span>
                )
              )}
            </div>
          </section>

          {/* MAYA */}
          <section className="py-28 px-[5%]">
            <div className="jfw-reveal text-center mb-10">
              <span className="text-[.65rem] tracking-[.22em] uppercase text-[#e891b0] font-medium mb-3 block text-center">Your JFW Guide</span>
              <h2 className="jfw-serif text-white font-normal leading-[1.2]" style={{ fontSize: "clamp(2rem,3.8vw,3rem)" }}>Have Questions? <em className="italic text-[#e891b0]">Ask Maya.</em></h2>
              <p className="text-[.96rem] text-[rgba(240,230,246,.62)] leading-[1.8] max-w-[520px] mt-3 mx-auto"><strong className="text-[#f2c4d0]">MA</strong>hak + <strong className="text-[#f2c4d0]">YA</strong>kshita = MAYA — she carries both founders in her name.</p>
            </div>
            <div className="max-w-[780px] mx-auto jfw-reveal">
              <div className="bg-[rgba(61,38,96,.55)] border border-[rgba(232,145,176,.2)] rounded-[22px] overflow-hidden backdrop-blur-sm">
                <div className="px-6 py-[1.1rem] border-b border-[rgba(232,145,176,.2)] flex items-center gap-2">
                  <div className="w-[9px] h-[9px] rounded-full bg-[#e891b0] shadow-[0_0_9px_rgba(232,145,176,.45)]" style={{ animation: "jfw-blink 2s ease-in-out infinite" }} />
                  <span className="text-[.83rem] text-[rgba(240,230,246,.62)]"><span className="text-white font-medium">Maya</span><span className="text-[.65rem] bg-[rgba(232,145,176,.1)] border border-[rgba(232,145,176,.18)] text-[#f2c4d0] px-2 py-[.18rem] rounded-full ml-1">MA+YA = Mahak + Yakshita</span></span>
                </div>
                <div ref={msgsRef} className="h-[320px] overflow-y-auto p-[1.3rem] flex flex-col gap-[.9rem] jfw-thin-scroll">
                  {messages.map((m, i) => (
                    <div key={i} className={`jfw-msg ${m.role}`}>{m.text}</div>
                  ))}
                  {isTyping && (
                    <div className="jfw-msg ai typing"><span /><span /><span /></div>
                  )}
                </div>
                <div className="flex flex-wrap gap-[.55rem] px-[1.4rem] py-[.9rem] border-t border-[rgba(232,145,176,.1)]">
                  {MAYA_QUICK_ASKS.map((q) => (
                    <button key={q} onClick={() => ask(q)} className="bg-[rgba(232,145,176,.07)] border border-[rgba(232,145,176,.18)] text-[rgba(240,230,246,.62)] text-[.76rem] px-[.9rem] py-[.4rem] rounded-full cursor-pointer jfw-sans hover:bg-[rgba(232,145,176,.15)] hover:border-[#e891b0] hover:text-white transition-all">{q}</button>
                  ))}
                </div>
                <div className="flex gap-[.7rem] px-[1.4rem] py-[.9rem] border-t border-[rgba(232,145,176,.2)]">
                  <input
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder="Ask Maya anything..."
                    onKeyDown={(e) => { if (e.key === "Enter") sendMsg() }}
                    className="flex-1 bg-[rgba(26,13,46,.6)] border border-[rgba(232,145,176,.18)] rounded-full px-[1.1rem] py-[.65rem] jfw-sans text-[.86rem] text-[#f0e6f6] outline-none focus:border-[#e891b0] focus:shadow-[0_0_12px_rgba(232,145,176,.14)] placeholder-[rgba(240,230,246,.28)] transition-all"
                  />
                  <button onClick={() => sendMsg()} className="w-10 h-10 bg-[#d4709a] border-none rounded-full flex items-center justify-center cursor-pointer shadow-[0_0_14px_rgba(232,145,176,.45)] hover:shadow-[0_0_26px_rgba(232,145,176,.45)] hover:scale-105 transition-all flex-shrink-0">
                    <svg className="w-[15px] h-[15px] fill-none stroke-white stroke-2 [stroke-linecap:round]" viewBox="0 0 24 24"><line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" /></svg>
                  </button>
                </div>
              </div>
            </div>
          </section>

          {/* HOME FOOTER */}
          <footer className="bg-[rgba(12,5,22,.97)] border-t border-[rgba(232,145,176,.1)] px-[5%] pt-[4.5rem] pb-10">
            <div className="grid grid-cols-1 md:grid-cols-[2fr_1fr_1fr_1fr] gap-12 pb-[2.8rem] border-b border-[rgba(232,145,176,.1)]">
              <div>
                <div className="jfw-serif text-[1.9rem] font-semibold text-white mb-[.7rem]">J<span className="text-[#e891b0]">F</span>W</div>
                <p className="text-[.84rem] text-[rgba(240,230,246,.62)] leading-[1.8] max-w-[220px]">Jobs For Women — A platform built for women, by women.</p>
              </div>
              <div>
                <h4 className="text-[.65rem] tracking-[.16em] uppercase text-[#e891b0] mb-[1.1rem]">For Candidates</h4>
                <ul className="list-none space-y-[.6rem]">
                  <li><button onClick={goToCandidateRegister} className="text-[.84rem] text-[rgba(240,230,246,.62)] no-underline hover:text-white transition-colors cursor-pointer bg-transparent border-none p-0 text-left">Join as Candidate</button></li>
                  <li><span className="text-[.84rem] text-[rgba(240,230,246,.62)] cursor-default">Salary Negotiator</span></li>
                  <li><span className="text-[.84rem] text-[rgba(240,230,246,.62)] cursor-default">Resume Builder</span></li>
                  <li><span className="text-[.84rem] text-[rgba(240,230,246,.62)] cursor-default">Mock Interviews</span></li>
                  <li><span className="text-[.84rem] text-[rgba(240,230,246,.62)] cursor-default">Certifications</span></li>
                </ul>
              </div>
              <div>
                <h4 className="text-[.65rem] tracking-[.16em] uppercase text-[#e891b0] mb-[1.1rem]">For Companies</h4>
                <ul className="list-none">
                  <li><button onClick={goToRecruiterRegister} className="text-[.84rem] text-[rgba(240,230,246,.62)] no-underline hover:text-white transition-colors cursor-pointer bg-transparent border-none p-0 text-left">Partner with us</button></li>
                </ul>
              </div>
              <div>
                <h4 className="text-[.65rem] tracking-[.16em] uppercase text-[#e891b0] mb-[1.1rem]">Company</h4>
                <ul className="list-none">
                  <li><button onClick={() => goTo("explore")} className="text-[.84rem] text-[rgba(240,230,246,.62)] no-underline hover:text-white transition-colors cursor-pointer bg-transparent border-none p-0 text-left">Our Story</button></li>
                  <li><a href="/terms-and-condition.html" className="text-[.84rem] text-[rgba(240,230,246,.62)] no-underline hover:text-white transition-colors cursor-pointer">Terms &amp; Conditions</a></li>
                  <li><a href="/privacy-policy.html" className="text-[.84rem] text-[rgba(240,230,246,.62)] no-underline hover:text-white transition-colors cursor-pointer">Privacy Policy</a></li>
                </ul>
              </div>
            </div>
            <div className="flex justify-between items-center mt-7 text-[.76rem] text-[rgba(240,230,246,.62)] flex-wrap gap-2">
              <span>© 2025 JFW — Jobs For Women. All rights reserved.</span>
              <span>Made with <span className="text-[#e891b0]">♥</span> by women, for women everywhere</span>
            </div>
          </footer>
        </div>
      )}

      {page === "explore" && (
        <div className="relative z-[2]">
          {/* EXPLORE HERO */}
          <section className="min-h-[55vh] flex flex-col items-center justify-center text-center px-[5%] pt-32 pb-16 relative overflow-hidden" style={{ background: "radial-gradient(ellipse 70% 60% at 50% 40%,rgba(90,58,138,.45) 0%,transparent 70%)" }}>
            <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(ellipse 90% 70% at 50% 30%,rgba(90,58,138,.5) 0%,transparent 70%)" }} />
            <span className="relative z-10 text-[.65rem] tracking-[.22em] uppercase text-[#e891b0] font-medium mb-3 block jfw-reveal">Our Story</span>
            <h1 className="relative z-10 jfw-serif font-light text-white leading-[1.15] mt-2 mb-5 jfw-reveal jfw-rd1" style={{ fontSize: "clamp(3rem,7vw,5.5rem)" }}>Explore <em className="italic text-[#e891b0]">JFW</em></h1>
            <p className="relative z-10 text-[1.05rem] text-[rgba(240,230,246,.62)] max-w-[480px] leading-[1.8] mx-auto jfw-reveal jfw-rd2">The mission, the vision, the values — and everything that drives us.</p>
          </section>

          {/* MISSION & VISION */}
          <section className="py-28 px-[5%]">
            <div className="jfw-reveal">
              <span className="text-[.65rem] tracking-[.22em] uppercase text-[#e891b0] font-medium mb-3 block">At Our Core</span>
              <h2 className="jfw-serif text-white font-normal leading-[1.2]" style={{ fontSize: "clamp(2rem,3.8vw,3rem)" }}>The Mission. <em className="italic text-[#e891b0]">The Vision.</em></h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-12">
              <div className="jfw-feature-card jfw-reveal jfw-rd1 bg-[rgba(61,38,96,.55)] border border-[rgba(232,145,176,.2)] rounded-[22px] p-[2.8rem] relative overflow-hidden">
                <div className="absolute -top-[60px] -right-[60px] w-[180px] h-[180px] rounded-full pointer-events-none" style={{ background: "radial-gradient(circle,rgba(232,145,176,.1),transparent 70%)" }} />
                <span className="text-[.62rem] tracking-[.2em] uppercase text-[#e891b0] mb-[.9rem] block">Our Mission</span>
                <h3 className="jfw-serif text-[1.9rem] italic text-white mb-[1.1rem] leading-[1.2]">Empower every woman.</h3>
                <p className="text-[.9rem] text-[rgba(240,230,246,.62)] leading-[1.88]">To empower every woman with job opportunities that match her needs and lifestyle, along with access to skill-building tools and a safe, trustworthy platform. We are committed to helping women — no matter where they come from — restart or grow their careers with confidence, respect, and purpose.</p>
                <div className="absolute bottom-7 right-9 jfw-serif text-[5rem] font-semibold text-[rgba(232,145,176,.06)] leading-none select-none">01</div>
              </div>
              <div className="jfw-feature-card jfw-reveal jfw-rd2 bg-[rgba(61,38,96,.55)] border border-[rgba(232,145,176,.2)] rounded-[22px] p-[2.8rem] relative overflow-hidden">
                <div className="absolute -top-[60px] -right-[60px] w-[180px] h-[180px] rounded-full pointer-events-none" style={{ background: "radial-gradient(circle,rgba(232,145,176,.1),transparent 70%)" }} />
                <span className="text-[.62rem] tracking-[.2em] uppercase text-[#e891b0] mb-[.9rem] block">Our Vision</span>
                <h3 className="jfw-serif text-[1.9rem] italic text-white mb-[1.1rem] leading-[1.2]">The world's most trusted platform for women.</h3>
                <p className="text-[.9rem] text-[rgba(240,230,246,.62)] leading-[1.88]">To be recognised as the most trusted global platform dedicated to creating abundant opportunities for women, empowering them with equality, dignity, and sustainable careers. A future where no talented woman is left behind — not because of where she comes from, what she looks like, or the choices she's made.</p>
                <div className="absolute bottom-7 right-9 jfw-serif text-[5rem] font-semibold text-[rgba(232,145,176,.06)] leading-none select-none">02</div>
              </div>
            </div>
          </section>

          {/* VALUES */}
          <section className="py-28 px-[5%]" style={{ background: "rgba(35,18,60,.5)" }}>
            <div className="jfw-reveal">
              <span className="text-[.65rem] tracking-[.22em] uppercase text-[#e891b0] font-medium mb-3 block">What We Stand For</span>
              <h2 className="jfw-serif text-white font-normal leading-[1.2]" style={{ fontSize: "clamp(2rem,3.8vw,3rem)" }}>Our Values Aren't <em className="italic text-[#e891b0]">Decoration.</em></h2>
              <p className="text-[.96rem] text-[rgba(240,230,246,.62)] leading-[1.8] max-w-[620px] mt-4">We built JFW separately — not as a filter on a general job board — because the purpose of earning is fundamentally different for a woman. She earns to build generations, to reclaim independence, to rewrite what's possible for every girl watching her. That required a platform built from scratch, with her in mind, by women who lived the same story.</p>
            </div>
            <div className="grid grid-cols-[repeat(auto-fit,minmax(210px,1fr))] gap-[1.1rem] mt-10">
              <div className="jfw-feature-card jfw-reveal jfw-rd1 bg-[rgba(61,38,96,.38)] border border-[rgba(232,145,176,.1)] rounded-[14px] p-[1.6rem] hover:bg-[rgba(61,38,96,.65)] hover:border-[rgba(232,145,176,.3)] transition-all"><h4 className="jfw-serif text-[1.1rem] text-white mb-[.45rem]">Radical Honesty</h4><p className="text-[.82rem] text-[rgba(240,230,246,.62)] leading-[1.75]">Pay transparency, culture scores, honest assessments — uncomfortable truths that change outcomes.</p></div>
              <div className="jfw-feature-card jfw-reveal jfw-rd2 bg-[rgba(61,38,96,.38)] border border-[rgba(232,145,176,.1)] rounded-[14px] p-[1.6rem] hover:bg-[rgba(61,38,96,.65)] hover:border-[rgba(232,145,176,.3)] transition-all"><h4 className="jfw-serif text-[1.1rem] text-white mb-[.45rem]">Intersectional by Design</h4><p className="text-[.82rem] text-[rgba(240,230,246,.62)] leading-[1.75]">Being a woman of colour, a mother, or differently abled compounds inequality. JFW is built for all of them.</p></div>
              <div className="jfw-feature-card jfw-reveal jfw-rd3 bg-[rgba(61,38,96,.38)] border border-[rgba(232,145,176,.1)] rounded-[14px] p-[1.6rem] hover:bg-[rgba(61,38,96,.65)] hover:border-[rgba(232,145,176,.3)] transition-all"><h4 className="jfw-serif text-[1.1rem] text-white mb-[.45rem]">Community Over Competition</h4><p className="text-[.82rem] text-[rgba(240,230,246,.62)] leading-[1.75]">Women lifting women isn't a cliché here — it's the architecture.</p></div>
              <div className="jfw-feature-card jfw-reveal jfw-rd1 bg-[rgba(61,38,96,.38)] border border-[rgba(232,145,176,.1)] rounded-[14px] p-[1.6rem] hover:bg-[rgba(61,38,96,.65)] hover:border-[rgba(232,145,176,.3)] transition-all"><h4 className="jfw-serif text-[1.1rem] text-white mb-[.45rem]">Dignity as a Default</h4><p className="text-[.82rem] text-[rgba(240,230,246,.62)] leading-[1.75]">Every interaction on JFW is held to a standard of basic dignity. Non-negotiable, full stop.</p></div>
              <div className="jfw-feature-card jfw-reveal jfw-rd2 bg-[rgba(61,38,96,.38)] border border-[rgba(232,145,176,.1)] rounded-[14px] p-[1.6rem] hover:bg-[rgba(61,38,96,.65)] hover:border-[rgba(232,145,176,.3)] transition-all"><h4 className="jfw-serif text-[1.1rem] text-white mb-[.45rem]">Progress Over Perfection</h4><p className="text-[.82rem] text-[rgba(240,230,246,.62)] leading-[1.75]">Companies don't need to arrive perfect. They need to commit and show up. We hold them accountable.</p></div>
              <div className="jfw-feature-card jfw-reveal jfw-rd3 bg-[rgba(61,38,96,.38)] border border-[rgba(232,145,176,.1)] rounded-[14px] p-[1.6rem] hover:bg-[rgba(61,38,96,.65)] hover:border-[rgba(232,145,176,.3)] transition-all"><h4 className="jfw-serif text-[1.1rem] text-white mb-[.45rem]">Long-Term Thinking</h4><p className="text-[.82rem] text-[rgba(240,230,246,.62)] leading-[1.75]">Careers women are genuinely proud of, at companies that deserve them — that's our metric.</p></div>
            </div>
          </section>

          {/* PILLARS */}
          <section className="px-[5%] py-[4.5rem] grid grid-cols-[repeat(auto-fit,minmax(190px,1fr))] gap-[1.3rem]">
            <div className="jfw-feature-card jfw-reveal jfw-rd1 bg-[rgba(61,38,96,.55)] border border-[rgba(232,145,176,.2)] rounded-[18px] p-8 text-center"><div className="text-[1.8rem] mb-[.7rem]">🌍</div><h4 className="jfw-serif text-[1.1rem] text-white mb-[.35rem]">Pan-India Launch</h4><p className="text-[.8rem] text-[rgba(240,230,246,.62)] leading-[1.68]">Starting across all major metros and expanding to tier-2 cities in phase 2.</p></div>
            <div className="jfw-feature-card jfw-reveal jfw-rd2 bg-[rgba(61,38,96,.55)] border border-[rgba(232,145,176,.2)] rounded-[18px] p-8 text-center"><div className="text-[1.8rem] mb-[.7rem]">🤝</div><h4 className="jfw-serif text-[1.1rem] text-white mb-[.35rem]">Partner-First Model</h4><p className="text-[.8rem] text-[rgba(240,230,246,.62)] leading-[1.68]">Companies commit to equity standards — not just tick a box.</p></div>
            <div className="jfw-feature-card jfw-reveal jfw-rd3 bg-[rgba(61,38,96,.55)] border border-[rgba(232,145,176,.2)] rounded-[18px] p-8 text-center"><div className="text-[1.8rem] mb-[.7rem]">🌸</div><h4 className="jfw-serif text-[1.1rem] text-white mb-[.35rem]">Menstrual Leave Mandate</h4><p className="text-[.8rem] text-[rgba(240,230,246,.62)] leading-[1.68]">Premium partners must offer menstrual leave as policy. This is non-negotiable.</p></div>
            <div className="jfw-feature-card jfw-reveal jfw-rd4 bg-[rgba(61,38,96,.55)] border border-[rgba(232,145,176,.2)] rounded-[18px] p-8 text-center"><div className="text-[1.8rem] mb-[.7rem]">💜</div><h4 className="jfw-serif text-[1.1rem] text-white mb-[.35rem]">Founded by Women</h4><p className="text-[.8rem] text-[rgba(240,230,246,.62)] leading-[1.68]">Mahak and Yakshita Tiwari built JFW from lived experience.</p></div>
          </section>

          {/* INSTAGRAM */}
          <section className="py-20 px-[5%] text-center jfw-reveal">
            <span className="text-[.65rem] tracking-[.22em] uppercase text-[#e891b0] font-medium mb-3 block text-center">Find Us On</span>
            <h2 className="jfw-serif text-white font-normal leading-[1.2] text-center mb-3" style={{ fontSize: "clamp(2rem,3.8vw,3rem)" }}>Follow Our <em className="italic text-[#e891b0]">Journey</em></h2>
            <p className="text-center text-[rgba(240,230,246,.62)] text-[.92rem] max-w-[400px] mx-auto mb-8">Behind-the-scenes, women's stories, and updates from Mahak and Yakshita directly.</p>
            <div className="text-center">
              <a
                href="https://www.instagram.com/jobsforwoman/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-white px-10 py-4 rounded-full text-[.9rem] font-medium border-none cursor-pointer jfw-sans no-underline hover:-translate-y-0.5 hover:shadow-[0_8px_28px_rgba(253,29,29,.28)] transition-all"
                style={{ background: "linear-gradient(135deg,#833ab4,#fd1d1d,#fcb045)" }}
              >
                <svg className="w-[19px] h-[19px] fill-white" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" /></svg>
                @jobsforwoman
              </a>
            </div>
          </section>

          {/* CTA BANNER */}
          <section className="py-24 px-[5%] text-center" style={{ background: "linear-gradient(135deg,rgba(61,38,96,.6),rgba(26,13,46,.8))" }}>
            <h2 className="jfw-serif font-light text-white max-w-[760px] mx-auto leading-[1.38] jfw-reveal" style={{ fontSize: "clamp(1.7rem,3.8vw,2.9rem)" }}>The workplace wasn't built for women. <em className="italic text-[#e891b0]">So we built something better.</em></h2>
            <div className="mt-9 jfw-reveal jfw-rd1">
              <button onClick={goToCandidateRegister} className="inline-flex items-center gap-2 bg-[#d4709a] text-white px-8 py-[.9rem] rounded-full text-[.88rem] font-medium tracking-[.03em] border-none cursor-pointer jfw-sans shadow-[0_0_22px_rgba(232,145,176,.45),0_4px_18px_rgba(212,112,154,.4)] hover:shadow-[0_0_40px_rgba(232,145,176,.45),0_8px_28px_rgba(212,112,154,.5)] hover:-translate-y-0.5 transition-all">Join the Waitlist →</button>
            </div>
          </section>

          {/* EXPLORE FOOTER */}
          <footer className="bg-[rgba(12,5,22,.97)] border-t border-[rgba(232,145,176,.1)] px-[5%] pt-[4.5rem] pb-10">
            <div className="grid grid-cols-1 md:grid-cols-[2fr_1fr_1fr] gap-12 pb-[2.8rem] border-b border-[rgba(232,145,176,.1)]">
              <div>
                <div className="jfw-serif text-[1.9rem] font-semibold text-white mb-[.7rem]">J<span className="text-[#e891b0]">F</span>W</div>
                <p className="text-[.84rem] text-[rgba(240,230,246,.62)] leading-[1.8] max-w-[220px]">Jobs For Women — A platform built for women, by women.</p>
              </div>
              <div>
                <h4 className="text-[.65rem] tracking-[.16em] uppercase text-[#e891b0] mb-[1.1rem]">Navigate</h4>
                <ul className="list-none space-y-[.6rem]">
                  <li><button onClick={() => goTo("home")} className="text-[.84rem] text-[rgba(240,230,246,.62)] no-underline hover:text-white transition-colors cursor-pointer bg-transparent border-none p-0 text-left">Home</button></li>
                  <li><button onClick={() => goTo("explore")} className="text-[.84rem] text-[rgba(240,230,246,.62)] no-underline hover:text-white transition-colors cursor-pointer bg-transparent border-none p-0 text-left">Explore</button></li>
                </ul>
              </div>
              <div>
                <h4 className="text-[.65rem] tracking-[.16em] uppercase text-[#e891b0] mb-[1.1rem]">Register</h4>
                <ul className="list-none space-y-[.6rem]">
                  <li><button onClick={goToCandidateRegister} className="text-[.84rem] text-[rgba(240,230,246,.62)] no-underline hover:text-white transition-colors cursor-pointer bg-transparent border-none p-0 text-left">As a Candidate</button></li>
                  <li><button onClick={goToRecruiterRegister} className="text-[.84rem] text-[rgba(240,230,246,.62)] no-underline hover:text-white transition-colors cursor-pointer bg-transparent border-none p-0 text-left">As a Company</button></li>
                </ul>
              </div>
            </div>
            <div className="flex justify-between items-center mt-7 text-[.76rem] text-[rgba(240,230,246,.62)] flex-wrap gap-2">
              <span>© 2025 JFW — Jobs For Women.</span>
              <span>Made with <span className="text-[#e891b0]">♥</span> by women</span>
            </div>
          </footer>
        </div>
      )}
    </div>
  )
}

export default LandingPage
