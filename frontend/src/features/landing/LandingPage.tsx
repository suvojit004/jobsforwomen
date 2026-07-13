import { useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { motion, AnimatePresence } from "framer-motion"
import { useTheme } from "next-themes"
import { 
  ArrowRight, 
  Sparkles, 
  Menu, 
  X, 
  ShieldCheck, 
  ChevronDown, 
  Heart, 
  Calendar, 
  Award,
  Sun,
  Moon
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Logo } from "@/components/shared/Logo"

export function LandingPage() {
  const navigate = useNavigate()
  const { theme, setTheme } = useTheme()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [activeFaq, setActiveFaq] = useState<number | null>(null)

  const isDark = theme === "dark"

  const toggleFaq = (index: number) => {
    setActiveFaq(activeFaq === index ? null : index)
  }

  const testimonials = [
    {
      name: "Sneha Iyer",
      role: "Senior Software Engineer",
      company: "Google India",
      image: "SI",
      content: "JFW helped me resume my career after a 2-year maternity break. The Returnship program was incredibly supportive and transparent about expectations."
    },
    {
      name: "Meera Deshmukh",
      role: "HR Director",
      company: "Tech Mahindra",
      image: "MD",
      content: "Registering our company on JFW allowed us to find vetted, qualified female leaders. Their culture verification badge has boosted our employer brand significantly."
    },
    {
      name: "Dr. Ananya Sen",
      role: "VP of Product",
      company: "Airtel",
      image: "AS",
      content: "Salary transparency and menstrual leave champions are the initiatives that drew me to JFW. An absolute game-changer for women in tech."
    }
  ]

  const faqs = [
    {
      q: "What makes JobsForWomen.info unique?",
      a: "JobsForWomen is a women-first career platform. We focus on salary transparency, menstrual leave policies, culture verification, and specific returnship opportunities for women resuming their career journeys."
    },
    {
      q: "Who can register as a Candidate?",
      a: "Any female professional looking for opportunities, mentorship, returnships, or career progression. Registering, building a profile, and applying for jobs is completely free."
    },
    {
      q: "How does Company Verification work?",
      a: "Companies that register must submit verification details and agree to core policies like gender pay equality, safety metrics, and inclusive leave plans. Our JFW admins review and approve companies before they can list jobs."
    },
    {
      q: "What is the Returnship Program?",
      a: "Returnships are specialized paid internship/career transition programs designed for women who have taken career breaks (due to maternity, caregiving, etc.) to ease back into corporate roles."
    }
  ]

  return (
    <div className="min-h-screen bg-[#FDFBFD] dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans antialiased selection:bg-[#6B2C91]/10 selection:text-[#6B2C91] transition-colors duration-300">
      {/* Navigation Bar */}
      <nav className="sticky top-0 z-50 border-b border-slate-100 dark:border-slate-900 bg-[#FDFBFD]/80 dark:bg-slate-950/80 backdrop-blur-md">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center gap-3">
              <Logo />
              <span className="text-lg font-extrabold tracking-tight bg-gradient-to-r from-[#6B2C91] to-pink-600 bg-clip-text text-transparent">
                JobsForWomen.info
              </span>
            </div>

            {/* Desktop Menu */}
            <div className="hidden md:flex items-center gap-8">
              <a href="#about" className="text-sm font-semibold text-slate-650 dark:text-slate-300 hover:text-[#6B2C91] dark:hover:text-pink-400 transition-colors">About</a>
              <a href="#why-choose" className="text-sm font-semibold text-slate-650 dark:text-slate-300 hover:text-[#6B2C91] dark:hover:text-pink-400 transition-colors">Features</a>
              <a href="#testimonials" className="text-sm font-semibold text-slate-655 dark:text-slate-300 hover:text-[#6B2C91] dark:hover:text-pink-400 transition-colors">Testimonials</a>
              <a href="#faq" className="text-sm font-semibold text-slate-650 dark:text-slate-300 hover:text-[#6B2C91] dark:hover:text-pink-400 transition-colors">FAQ</a>
            </div>

            <div className="hidden md:flex items-center gap-4">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setTheme(isDark ? "light" : "dark")}
                aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
                className="text-slate-600 dark:text-slate-300"
              >
                {isDark ? <Sun className="size-5" /> : <Moon className="size-5" />}
              </Button>
              <Button variant="ghost" className="font-semibold text-slate-700 dark:text-slate-300 hover:text-[#6B2C91] dark:hover:text-pink-450" onClick={() => navigate("/auth/login")}>
                Login
              </Button>
              <Button className="rounded-full bg-gradient-to-r from-[#6B2C91] to-pink-600 font-semibold text-white shadow-md hover:from-[#5A247A] hover:to-pink-700" onClick={() => navigate("/auth/register/candidate")}>
                Join as Candidate
              </Button>
            </div>

            {/* Mobile menu button */}
            <div className="flex md:hidden items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setTheme(isDark ? "light" : "dark")}
                aria-label="Toggle theme"
                className="text-slate-600 dark:text-slate-300"
              >
                {isDark ? <Sun className="size-5" /> : <Moon className="size-5" />}
              </Button>
              <Button variant="ghost" size="icon" onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="text-slate-600 dark:text-slate-300">
                {mobileMenuOpen ? <X className="size-6" /> : <Menu className="size-6" />}
              </Button>
            </div>
          </div>
        </div>

        {/* Mobile menu */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div 
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="md:hidden border-b border-slate-100 dark:border-slate-900 bg-[#FDFBFD] dark:bg-slate-950"
            >
              <div className="space-y-1 px-2 pb-4 pt-2">
                <a href="#about" onClick={() => setMobileMenuOpen(false)} className="block rounded-lg px-3 py-2 text-base font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-900 hover:text-[#6B2C91] dark:hover:text-pink-400">About</a>
                <a href="#why-choose" onClick={() => setMobileMenuOpen(false)} className="block rounded-lg px-3 py-2 text-base font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-900 hover:text-[#6B2C91] dark:hover:text-pink-400">Features</a>
                <a href="#testimonials" onClick={() => setMobileMenuOpen(false)} className="block rounded-lg px-3 py-2 text-base font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-900 hover:text-[#6B2C91] dark:hover:text-pink-400">Testimonials</a>
                <a href="#faq" onClick={() => setMobileMenuOpen(false)} className="block rounded-lg px-3 py-2 text-base font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-900 hover:text-[#6B2C91] dark:hover:text-pink-400">FAQ</a>
                <div className="mt-4 flex flex-col gap-2 px-3">
                  <Button variant="outline" className="w-full font-semibold border-slate-200 dark:border-slate-800" onClick={() => { setMobileMenuOpen(false); navigate("/auth/login") }}>
                    Login
                  </Button>
                  <Button className="w-full bg-gradient-to-r from-[#6B2C91] to-pink-600 font-semibold text-white" onClick={() => { setMobileMenuOpen(false); navigate("/auth/register/candidate") }}>
                    Join as Candidate
                  </Button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>

      {/* Hero Section */}
      <section className="relative overflow-hidden py-20 lg:py-32">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 gap-12 lg:grid-cols-12 lg:items-center">
            {/* Hero Left */}
            <div className="lg:col-span-7 space-y-8 text-center lg:text-left">
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="inline-flex items-center gap-2 rounded-full border border-pink-100 dark:border-pink-500/20 bg-pink-50/50 dark:bg-pink-500/10 px-4 py-1.5 text-sm font-semibold text-pink-600 dark:text-pink-400"
              >
                <Sparkles className="size-4" />
                <span>Empowering India's Female Workforce</span>
              </motion.div>

              <motion.h1 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.1 }}
                className="text-4xl font-extrabold tracking-tight sm:text-5xl lg:text-6xl text-slate-900 dark:text-white leading-tight"
              >
                Connecting Vetted Talent to <br />
                <span className="bg-gradient-to-r from-[#6B2C91] via-pink-600 to-amber-500 bg-clip-text text-transparent">
                  Women-First Employers
                </span>
              </motion.h1>

              <motion.p 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.2 }}
                className="mx-auto lg:mx-0 max-w-2xl text-lg text-slate-500 dark:text-slate-450 font-medium"
              >
                JobsForWomen.info links top female professionals with employers championing wage parity, flexible returnships, menstrual wellness, and transparent salary policies.
              </motion.p>

              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.3 }}
                className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start"
              >
                <Button size="lg" className="rounded-full bg-gradient-to-r from-[#6B2C91] to-pink-600 px-8 font-bold text-white shadow-lg hover:shadow-xl transition-all" onClick={() => navigate("/auth/register/candidate")}>
                  Join as Candidate
                  <ArrowRight className="ml-2 size-5" />
                </Button>
                <Button size="lg" variant="outline" className="rounded-full border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-8 font-bold text-slate-700 dark:text-slate-300 shadow-sm hover:bg-slate-50 dark:hover:bg-slate-800" onClick={() => navigate("/auth/register/recruiter")}>
                  Register Company
                </Button>
              </motion.div>
            </div>

            {/* Hero Right / Graphic Mock */}
            <div className="lg:col-span-5 relative flex justify-center">
              <motion.div 
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.6 }}
                className="w-full max-w-md rounded-3xl bg-gradient-to-br from-pink-500/10 to-[#6B2C91]/15 p-6 border border-white dark:border-slate-900 shadow-2xl relative bg-white/40 dark:bg-slate-900/40 backdrop-blur-md"
              >
                <div className="absolute -top-6 -left-6 bg-amber-400 text-slate-950 font-extrabold text-xs px-4 py-2 rounded-2xl shadow-md rotate-[-6deg]">
                  🌟 Wage Equality Certified
                </div>
                <div className="absolute -bottom-6 -right-6 bg-pink-600 text-white font-extrabold text-xs px-4 py-2 rounded-2xl shadow-md rotate-[6deg]">
                  💪 Returnship Programs Active
                </div>

                <div className="space-y-4">
                  <div className="flex items-center gap-3 border-b border-slate-200/50 dark:border-slate-800/50 pb-4">
                    <div className="h-10 w-10 rounded-full bg-pink-100 dark:bg-pink-900/20 flex items-center justify-center font-bold text-pink-600 dark:text-pink-400">JFW</div>
                    <div>
                      <h4 className="font-bold text-sm">Culture Verified Employers</h4>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">Updated today</p>
                    </div>
                  </div>
                  <div className="space-y-3">
                    {[
                      { name: "Google India", perk: "Menstrual Leave Champion", val: "Approved" },
                      { name: "Tech Mahindra", perk: "Maternity Returnships", val: "Verified" },
                      { name: "Microsoft", perk: "Salary Range Transparency", val: "Verified" }
                    ].map((comp, idx) => (
                      <div key={idx} className="flex items-center justify-between bg-white/70 dark:bg-slate-900/80 p-3 rounded-xl border border-slate-100 dark:border-slate-800 shadow-sm">
                        <div>
                          <p className="font-bold text-xs">{comp.name}</p>
                          <p className="text-[10px] text-[#6B2C91] dark:text-pink-400 font-semibold">{comp.perk}</p>
                        </div>
                        <span className="text-[10px] bg-green-50 dark:bg-green-950/20 text-green-700 dark:text-green-400 font-extrabold px-2.5 py-1 rounded-full border border-green-200 dark:border-green-900/35">
                          {comp.val}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            </div>
          </div>
        </div>
      </section>

      {/* About Section */}
      <section id="about" className="py-20 bg-slate-50/50 dark:bg-slate-900/20 border-y border-slate-100 dark:border-slate-900">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center space-y-4 max-w-3xl mx-auto">
            <h2 className="text-xs font-black uppercase tracking-widest text-[#6B2C91] dark:text-pink-400">Our Mission</h2>
            <h3 className="text-3xl font-extrabold sm:text-4xl text-slate-900 dark:text-white">About JobsForWomen.info</h3>
            <p className="text-base text-slate-550 dark:text-slate-400 font-medium leading-relaxed">
              JobsForWomen is dedicated to solving gender disparity in tech and corporate systems. 
              We partner exclusively with employers who support working mothers, offer mentorship pathways, verify internal safe cultures, and commit to absolute compensation transparency.
            </p>
          </div>
        </div>
      </section>

      {/* Why Choose Section */}
      <section id="why-choose" className="py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 space-y-16">
          <div className="text-center space-y-4">
            <h2 className="text-xs font-black uppercase tracking-widest text-[#6B2C91] dark:text-pink-400">Why Choose Us</h2>
            <h3 className="text-3xl font-extrabold text-slate-900 dark:text-white">Features Built For Equality</h3>
          </div>

          <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-4">
            {[
              {
                icon: <Award className="size-8 text-[#6B2C91] dark:text-pink-300" />,
                title: "Wage Transparency",
                desc: "Every job listing must publish its complete salary brackets. No hidden pay discrepancies."
              },
              {
                icon: <Heart className="size-8 text-pink-600 dark:text-pink-400" />,
                title: "Menstrual Leave Champion",
                desc: "We prioritize listings from companies that offer dedicated menstrual leave plans."
              },
              {
                icon: <Calendar className="size-8 text-amber-500" />,
                title: "Flexible Returnships",
                desc: "Dedicated onboarding structures designed for female professionals resuming work after a gap."
              },
              {
                icon: <ShieldCheck className="size-8 text-emerald-500" />,
                title: "Verified Safe Cultures",
                desc: "Strict verification requirements detailing POSH frameworks and gender diversity metrics."
              }
            ].map((feature, idx) => (
              <div key={idx} className="bg-white dark:bg-slate-900 p-8 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-md transition-all space-y-4">
                <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl inline-block">{feature.icon}</div>
                <h4 className="font-extrabold text-lg text-slate-900 dark:text-white">{feature.title}</h4>
                <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed font-medium">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section id="testimonials" className="py-20 bg-slate-50/50 dark:bg-slate-900/20 border-y border-slate-100 dark:border-slate-900">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 space-y-16">
          <div className="text-center space-y-4">
            <h2 className="text-xs font-black uppercase tracking-widest text-[#6B2C91] dark:text-pink-400">Testimonials</h2>
            <h3 className="text-3xl font-extrabold text-slate-900 dark:text-white">Success Stories From JFW</h3>
          </div>

          <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
            {testimonials.map((item, idx) => (
              <div key={idx} className="bg-white dark:bg-slate-900 p-8 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col justify-between">
                <p className="text-slate-600 dark:text-slate-300 font-medium italic mb-6">"{item.content}"</p>
                <div className="flex items-center gap-4">
                  <div className="h-10 w-10 rounded-full bg-pink-100 dark:bg-pink-900/35 flex items-center justify-center font-bold text-pink-600 dark:text-pink-400 text-xs">
                    {item.image}
                  </div>
                  <div>
                    <h4 className="font-extrabold text-sm text-slate-900 dark:text-white">{item.name}</h4>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold">{item.role} • {item.company}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section id="faq" className="py-20">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 space-y-16">
          <div className="text-center space-y-4">
            <h2 className="text-xs font-black uppercase tracking-widest text-[#6B2C91] dark:text-pink-400">FAQ</h2>
            <h3 className="text-3xl font-extrabold text-slate-900 dark:text-white">Frequently Asked Questions</h3>
          </div>

          <div className="space-y-4">
            {faqs.map((faq, idx) => (
              <div key={idx} className="bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden">
                <button 
                  onClick={() => toggleFaq(idx)}
                  className="w-full flex items-center justify-between p-6 text-left font-bold text-slate-900 dark:text-white hover:text-[#6B2C91] dark:hover:text-pink-400 transition-colors"
                >
                  <span>{faq.q}</span>
                  <ChevronDown className={`size-5 transition-transform duration-200 ${activeFaq === idx ? "rotate-180" : ""}`} />
                </button>
                <AnimatePresence>
                  {activeFaq === idx && (
                    <motion.div 
                      initial={{ height: 0 }}
                      animate={{ height: "auto" }}
                      exit={{ height: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="px-6 pb-6 pt-0 text-sm text-slate-500 dark:text-slate-400 leading-relaxed border-t border-slate-55 dark:border-slate-800">
                        {faq.a}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-950 text-slate-400 py-12 border-t border-slate-900">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <Logo compact />
                <span className="text-white font-extrabold text-md tracking-tight">JFW.info</span>
              </div>
              <p className="text-xs leading-relaxed">
                Empowering female career pathways and connecting verified companies to vetted talent across India.
              </p>
            </div>
            <div>
              <h4 className="text-white font-bold text-sm mb-4">Candidates</h4>
              <ul className="space-y-2 text-xs">
                <li><Link to="/auth/register/candidate" className="hover:text-white">Register Profile</Link></li>
                <li><Link to="/auth/login" className="hover:text-white">Login Account</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-bold text-sm mb-4">Companies</h4>
              <ul className="space-y-2 text-xs">
                <li><Link to="/auth/register/recruiter" className="hover:text-white">Register Company</Link></li>
                <li><a href="#why-choose" className="hover:text-white">Verification Rules</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-bold text-sm mb-4">Legal</h4>
              <ul className="space-y-2 text-xs">
                <li>
                  <span className="cursor-default text-slate-500" title="Not published yet">
                    Privacy Policy (Coming Soon)
                  </span>
                </li>
                <li>
                  <span className="cursor-default text-slate-500" title="Not published yet">
                    Terms of Use (Coming Soon)
                  </span>
                </li>
              </ul>
            </div>
          </div>
          <div className="mt-12 pt-8 border-t border-slate-900 text-center text-[11px]">
            © {new Date().getFullYear()} JobsForWomen.info. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  )
}

export default LandingPage
