export const initialConversations = [
  {
    id: "conv-1",
    recruiterName: "Riya Kapoor",
    companyName: "Creative Minds",
    avatarLetters: "RK",
    online: true,
    lastMessageText: "Perfect, see you there!",
    lastMessageTime: "9:46 AM",
    unreadCount: 2,
    thread: [
      {
        id: "msg-1-1",
        sender: "recruiter",
        text: "Hi Priya! Thanks for applying to the UI/UX Designer role at Creative Minds.",
        timestamp: "9:30 AM",
      },
      {
        id: "msg-1-2",
        sender: "candidate",
        text: "Hi Riya, thanks for reaching out! I'm really excited about the opportunity.",
        timestamp: "9:35 AM",
      },
      {
        id: "msg-1-3",
        sender: "recruiter",
        text: "Great! I have scheduled your interview for 18 May 2025. Please confirm your availability.",
        timestamp: "9:40 AM",
      },
      {
        id: "msg-1-4",
        sender: "candidate",
        text: "That time works perfectly for me. Looking forward to it!",
        timestamp: "9:45 AM",
      },
      {
        id: "msg-1-5",
        sender: "recruiter",
        text: "Perfect, see you there!",
        timestamp: "9:46 AM",
      },
    ],
  },
  {
    id: "conv-2",
    recruiterName: "Ananya Mehta",
    companyName: "TechNova Solutions",
    avatarLetters: "AM",
    online: true,
    lastMessageText: "Hi Priya, we viewed your profile and would love to connect.",
    lastMessageTime: "Yesterday",
    unreadCount: 0,
    thread: [
      {
        id: "msg-2-1",
        sender: "recruiter",
        text: "Hi Priya, we viewed your profile for the Frontend Developer position and would love to connect.",
        timestamp: "Yesterday, 3:00 PM",
      },
      {
        id: "msg-2-2",
        sender: "candidate",
        text: "Thank you Ananya! I would love to connect and discuss the role details.",
        timestamp: "Yesterday, 3:15 PM",
      },
    ],
  },
  {
    id: "conv-3",
    recruiterName: "Neha Iyer",
    companyName: "WriteAway",
    avatarLetters: "NI",
    online: false,
    lastMessageText: "We have received your content samples. Our team is reviewing them.",
    lastMessageTime: "2 days ago",
    unreadCount: 0,
    thread: [
      {
        id: "msg-3-1",
        sender: "recruiter",
        text: "Hello Priya, we've received your content writer samples. We will review them and get back to you shortly.",
        timestamp: "2 days ago, 11:20 AM",
      },
    ],
  },
]
export default initialConversations
