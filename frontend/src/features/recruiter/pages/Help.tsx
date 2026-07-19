import { useState } from "react"
import {
  HelpCircle,
  Mail,
  MessageSquare,
  Search,
  ChevronDown,
  ChevronUp,
  Heart,
  Award,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { DashboardCard } from "@/components/shared/DashboardCard"

interface FAQItem {
  question: string
  answer: string
  category: "hiring" | "perks" | "account"
}

export function Help() {
  const [search, setSearch] = useState("")
  const [openIdx, setOpenIdx] = useState<number | null>(0)

  const faqs: FAQItem[] = [
    {
      question: "How do I tag a job posting as supporting a Career Returnship?",
      answer: "When posting or editing a job opportunity, scroll down to the 'Workplace Equality Perks' section and check the 'Returnship Opportunity' box. This automatically highlights your listing with a special Returnship tag on the candidate search feed.",
      category: "hiring",
    },
    {
      question: "What is the Menstrual Leave Champion program?",
      answer: "JobsForWomen awards the Menstrual Leave Champion badge to partner organizations providing paid menstrual leave or flexible rest hours. You can activate this in your Company Profile settings. Toggling it displays a dedicated badge on all your listings to attract women seeking progressive workplaces.",
      category: "perks",
    },
    {
      question: "How do I schedule an interview with an applicant?",
      answer: "Go to your 'Applicants' page, click the 'Eye' icon next to a candidate (e.g. Priya Sharma) to preview her profile, and click 'Schedule Interview'. Configure the date, time, and recruiter name. Once confirmed, this appointment syncs directly to the candidate's tracking timeline.",
      category: "hiring",
    },
    {
      question: "Can I edit an active job posting?",
      answer: "Yes, navigate to 'My Jobs', select the opportunity title to inspect details, and click 'Edit Posting' in the header. The form will load all current settings. Click 'Save Specifications' to update the posting across both candidate explore feeds and recruiter logs.",
      category: "hiring",
    },
    {
      question: "Are candidate resumes verified?",
      answer: "No -- resumes are not screened or manually verified by the platform. A candidate's profile simply shows whether they've uploaded a resume ('Resume Uploaded'). Recruiters can view or download the file directly from the candidate preview panel, but its contents are not independently checked.",
      category: "account",
    },
  ]

  const filteredFaqs = faqs.filter(
    (f) =>
      f.question.toLowerCase().includes(search.toLowerCase()) ||
      f.answer.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="space-y-6 max-w-3xl mx-auto select-none">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-black tracking-normal text-slate-950 dark:text-white flex items-center gap-2">
          Help & Support Center
        </h1>
        <p className="mt-1 text-sm font-semibold text-slate-500 dark:text-slate-400">
          Find guides on sourcing returnees, configuring champion badges, and managing pipelines.
        </p>
      </div>

      {/* Support Sourcing Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <DashboardCard className="p-4 space-y-2 flex flex-col justify-between">
          <div className="space-y-1.5">
            <div className="size-8 rounded-lg bg-purple-50 text-[#6B2C91] dark:bg-purple-950/20 dark:text-pink-300 flex items-center justify-center">
              <HelpCircle className="size-4.5" />
            </div>
            <h4 className="text-xs font-black text-slate-900 dark:text-white uppercase">Sourcing Guide</h4>
            <p className="text-[10px] leading-normal text-slate-500 font-semibold dark:text-slate-400">
              Optimize listings with flexible tags and diversity metrics.
            </p>
          </div>
          <Button variant="link" className="text-[10px] text-[#6B2C91] dark:text-pink-200 p-0 h-auto justify-start font-bold">
            Read Sourcing Guide
          </Button>
        </DashboardCard>

        <DashboardCard className="p-4 space-y-2 flex flex-col justify-between">
          <div className="space-y-1.5">
            <div className="size-8 rounded-lg bg-pink-50 text-pink-500 dark:bg-pink-950/20 dark:text-pink-300 flex items-center justify-center">
              <Heart className="size-4.5" />
            </div>
            <h4 className="text-xs font-black text-slate-900 dark:text-white uppercase">Returnee Support</h4>
            <p className="text-[10px] leading-normal text-slate-500 font-semibold dark:text-slate-400">
              Tips on conducting screeners and handling returnee gap intervals.
            </p>
          </div>
          <Button variant="link" className="text-[10px] text-[#6B2C91] dark:text-pink-200 p-0 h-auto justify-start font-bold">
            Review Guidelines
          </Button>
        </DashboardCard>

        <DashboardCard className="p-4 space-y-2 flex flex-col justify-between">
          <div className="space-y-1.5">
            <div className="size-8 rounded-lg bg-emerald-50 text-emerald-500 dark:bg-emerald-950/20 dark:text-emerald-300 flex items-center justify-center">
              <Award className="size-4.5" />
            </div>
            <h4 className="text-xs font-black text-slate-900 dark:text-white uppercase">Leave Policies</h4>
            <p className="text-[10px] leading-normal text-slate-500 font-semibold dark:text-slate-400">
              How to configure Menstrual Leave programs and flexibility templates.
            </p>
          </div>
          <Button variant="link" className="text-[10px] text-[#6B2C91] dark:text-pink-200 p-0 h-auto justify-start font-bold">
            Learn More
          </Button>
        </DashboardCard>
      </div>

      {/* FAQ Search */}
      <DashboardCard className="p-5 space-y-5">
        <h3 className="text-xs font-black text-slate-900 uppercase dark:text-white border-b border-slate-100 pb-2 dark:border-slate-800">
          Frequently Asked Questions
        </h3>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search FAQs..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 py-1.5 text-xs focus-visible:outline-none dark:border-slate-800 dark:bg-slate-900 dark:text-white"
          />
        </div>

        <div className="space-y-3">
          {filteredFaqs.length > 0 ? (
            filteredFaqs.map((faq, idx) => {
              const isOpen = openIdx === idx
              return (
                <div
                  key={idx}
                  className="border border-slate-150 rounded-xl overflow-hidden dark:border-slate-850"
                >
                  <button
                    type="button"
                    onClick={() => setOpenIdx(isOpen ? null : idx)}
                    className="w-full p-4 flex items-center justify-between text-left text-xs font-black text-slate-800 hover:bg-slate-50/50 dark:text-slate-200 dark:hover:bg-slate-850/50 cursor-pointer"
                  >
                    <span>{faq.question}</span>
                    {isOpen ? <ChevronUp className="size-4 text-slate-400" /> : <ChevronDown className="size-4 text-slate-400" />}
                  </button>
                  {isOpen && (
                    <div className="p-4 bg-slate-50/40 dark:bg-slate-950/20 text-xs font-semibold text-slate-500 leading-relaxed border-t border-slate-150 dark:border-slate-850 dark:text-slate-400">
                      {faq.answer}
                    </div>
                  )}
                </div>
              )
            })
          ) : (
            <p className="text-xs text-slate-400 dark:text-slate-500 text-center py-6">
              No questions matched your search criteria.
            </p>
          )}
        </div>
      </DashboardCard>

      {/* Support contact info */}
      <DashboardCard className="p-5 space-y-4">
        <h3 className="text-xs font-black text-slate-900 uppercase dark:text-white border-b border-slate-100 pb-2 dark:border-slate-800">
          Still Need Assistance?
        </h3>
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 flex items-start gap-3 p-3.5 border border-slate-150 rounded-xl dark:border-slate-850">
            <Mail className="size-5 text-[#6B2C91] dark:text-pink-300 mt-0.5" />
            <div>
              <p className="text-xs font-black text-slate-800 dark:text-slate-200">Email Support</p>
              <p className="text-[10px] font-semibold text-slate-400 mt-0.5">support@jobsforwomen.info</p>
            </div>
          </div>
          <div className="flex-1 flex items-start gap-3 p-3.5 border border-slate-150 rounded-xl dark:border-slate-850">
            <MessageSquare className="size-5 text-emerald-500 mt-0.5" />
            <div>
              <p className="text-xs font-black text-slate-800 dark:text-slate-200">Instant Helpdesk Chat</p>
              <p className="text-[10px] font-semibold text-slate-400 mt-0.5">Average response time: 5 mins</p>
            </div>
          </div>
        </div>
      </DashboardCard>
    </div>
  )
}
export default Help
