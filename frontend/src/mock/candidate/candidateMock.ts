export const initialCandidateData = {
  fullName: "Priya Sharma",
  role: "Frontend Developer",
  email: "priya.sharma@email.com",
  phone: "+91 98765 43210",
  location: "Bengaluru, Karnataka",
  experience: "2.5 Years",
  currentCtc: "₹ 8.5 LPA",
  profileCompletion: 85,
  skills: ["React", "JavaScript", "Tailwind", "HTML", "CSS", "C/C++"],
  languages: ["English", "Hindi", "Kannada"],
  socialLinks: [
    { id: "s-1", platform: "LinkedIn", url: "https://linkedin.com/in/priyasharma" },
    { id: "s-2", platform: "GitHub", url: "https://github.com/priyasharma" },
    { id: "s-3", platform: "Portfolio", url: "https://priyasharma.dev" },
  ],
  careerBreak: {
    hasBreak: true,
    reason: "Family care",
    duration: "Jun 2022 - Mar 2023",
    summary:
      "I took a career break to focus on my family commitments and personal growth. I used this time to enhance my skills through online courses and personal projects.",
  },
  resume: {
    name: "Priya_Sharma_Resume.pdf",
    uploadDate: "10 May 2025",
    verified: true,
  },
  education: [
    {
      id: "edu-1",
      degree: "B.E. in Computer Science",
      institution: "Visvesvaraya Technological University",
      duration: "2018 - 2022",
      grade: "CGPA: 8.5/10",
    },
    {
      id: "edu-2",
      degree: "High School Diploma (Science)",
      institution: "National Public School, Bangalore",
      duration: "2016 - 2018",
      grade: "92%",
    },
  ],
  workExperience: [
    {
      id: "work-1",
      jobTitle: "Frontend Engineer",
      company: "TechNova Solutions",
      duration: "Mar 2023 - Present",
      description:
        "Developed and maintained highly responsive web applications using React 18/19 and Tailwind CSS. Collaborated with UI/UX designers to implement pixel-perfect layouts and smooth micro-animations using Framer Motion.",
    },
    {
      id: "work-2",
      jobTitle: "Software Engineer Intern",
      company: "InnoTech Pvt. Ltd.",
      duration: "Jan 2022 - Jun 2022",
      description:
        "Assisted in front-end development using JavaScript and React. Worked on fixing bug tickets, refactoring styling classes, and writing Unit Tests.",
    },
  ],
  preferences: {
    expectedSalary: "₹ 12 LPA",
    preferredLocation: ["Bengaluru", "Remote", "Pune"],
    availability: "Immediate",
    noticePeriod: "15 Days",
  },
}
