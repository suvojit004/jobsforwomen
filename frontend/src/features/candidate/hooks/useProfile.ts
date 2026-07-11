import { useState, useEffect } from "react"
import { candidateApi } from "../services/candidateApi"
import type {
  ExtendedCandidate,
  WorkExperience,
  Education,
  SocialLink,
  JobPreferences,
} from "../types/candidate"

export function useProfile() {
  const [candidateData, setCandidateData] = useState<ExtendedCandidate | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [editingData, setEditingData] = useState<ExtendedCandidate | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function fetchProfile() {
      setIsLoading(true)
      try {
        const prof = await candidateApi.getProfile()
        const extendedProfile: ExtendedCandidate = {
          fullName: prof?.fullName || "",
          role: prof?.title || "Professional",
          email: "", // User level
          phone: prof?.phone || "",
          location: prof?.bio || "",
          experience: prof?.noticePeriod || "",
          currentCtc: prof?.expectedSalary || "",
          profileCompletion: 85,
          skills: (prof?.skills || []).map((s: any) => s.skill?.name || s.name || s),
          languages: prof?.languages || ["English"],
          socialLinks: prof?.socialLinks || [],
          careerBreak: {
            hasBreak: true,
            reason: "Maternity Leave",
            duration: "2 Years",
            summary: "Focused on parenting and upskilling in modern technologies."
          },
          resume: {
            name: prof?.resumeUrl ? "Resume_latest.pdf" : "",
            uploadDate: "Just now",
            verified: !!prof?.resumeUrl
          },
          education: prof?.education || [],
          workExperience: prof?.workExperience || [],
          preferences: {
            expectedSalary: prof?.expectedSalary || "",
            preferredLocation: [prof?.bio || ""],
            availability: "Immediate",
            noticePeriod: prof?.noticePeriod || ""
          }
        }
        setCandidateData(extendedProfile)
      } catch (err) {
        console.error("Failed to fetch profile", err)
      } finally {
        setIsLoading(false)
      }
    }
    fetchProfile()
  }, [])

  const startEditing = () => {
    if (candidateData) {
      setEditingData(JSON.parse(JSON.stringify(candidateData)))
      setIsEditing(true)
    }
  }

  const cancelChanges = () => {
    setIsEditing(false)
  }

  const saveChanges = async () => {
    if (editingData) {
      try {
        const payload = {
          fullName: editingData.fullName,
          title: editingData.role,
          phone: editingData.phone,
          bio: editingData.location,
          noticePeriod: editingData.experience,
          expectedSalary: editingData.currentCtc,
          languages: editingData.languages,
          socialLinks: editingData.socialLinks,
          skills: editingData.skills,
          education: editingData.education,
          workExperience: editingData.workExperience,
        }
        await candidateApi.updateProfile(payload)
        setCandidateData(editingData)
        setIsEditing(false)
      } catch (err) {
        console.error("Failed to save profile changes", err)
      }
    }
  }

  const updatePersonalInfo = (fields: Partial<Pick<ExtendedCandidate, "fullName" | "role" | "email" | "phone" | "location" | "experience" | "currentCtc">>) => {
    if (editingData) {
      setEditingData((prev: any) => ({
        ...prev,
        ...fields,
      }))
    }
  }

  const updateCareerBreak = (fields: Partial<ExtendedCandidate["careerBreak"]>) => {
    if (editingData) {
      setEditingData((prev: any) => ({
        ...prev,
        careerBreak: {
          ...prev.careerBreak,
          ...fields,
        },
      }))
    }
  }

  const updatePreferences = (fields: Partial<JobPreferences>) => {
    if (editingData) {
      setEditingData((prev: any) => ({
        ...prev,
        preferences: {
          ...prev.preferences,
          ...fields,
        },
      }))
    }
  }

  // Work Experience management
  const addWorkExperience = (exp: Omit<WorkExperience, "id">) => {
    const newExp: WorkExperience = {
      ...exp,
      id: `work-${Date.now()}`,
    }
    if (editingData) {
      setEditingData((prev: any) => ({
        ...prev,
        workExperience: [...prev.workExperience, newExp],
      }))
    }
  }

  const updateWorkExperience = (id: string, fields: Partial<WorkExperience>) => {
    if (editingData) {
      setEditingData((prev: any) => ({
        ...prev,
        workExperience: prev.workExperience.map((item: WorkExperience) =>
          item.id === id ? { ...item, ...fields } : item
        ),
      }))
    }
  }

  const removeWorkExperience = (id: string) => {
    if (editingData) {
      setEditingData((prev: any) => ({
        ...prev,
        workExperience: prev.workExperience.filter((item: WorkExperience) => item.id !== id),
      }))
    }
  }

  // Education management
  const addEducation = (edu: Omit<Education, "id">) => {
    const newEdu: Education = {
      ...edu,
      id: `edu-${Date.now()}`,
    }
    if (editingData) {
      setEditingData((prev: any) => ({
        ...prev,
        education: [...prev.education, newEdu],
      }))
    }
  }

  const updateEducation = (id: string, fields: Partial<Education>) => {
    if (editingData) {
      setEditingData((prev: any) => ({
        ...prev,
        education: prev.education.map((item: Education) =>
          item.id === id ? { ...item, ...fields } : item
        ),
      }))
    }
  }

  const removeEducation = (id: string) => {
    if (editingData) {
      setEditingData((prev: any) => ({
        ...prev,
        education: prev.education.filter((item: Education) => item.id !== id),
      }))
    }
  }

  // Skills & Languages management
  const addSkill = (skill: string) => {
    if (editingData && !editingData.skills.includes(skill)) {
      setEditingData((prev: any) => ({
        ...prev,
        skills: [...prev.skills, skill],
      }))
    }
  }

  const removeSkill = (skill: string) => {
    if (editingData) {
      setEditingData((prev: any) => ({
        ...prev,
        skills: prev.skills.filter((s: string) => s !== skill),
      }))
    }
  }

  const addLanguage = (lang: string) => {
    if (editingData && !editingData.languages.includes(lang)) {
      setEditingData((prev: any) => ({
        ...prev,
        languages: [...prev.languages, lang],
      }))
    }
  }

  const removeLanguage = (lang: string) => {
    if (editingData) {
      setEditingData((prev: any) => ({
        ...prev,
        languages: prev.languages.filter((l: string) => l !== lang),
      }))
    }
  }

  // Social Links management
  const addSocialLink = (platform: SocialLink["platform"], url: string) => {
    const newLink: SocialLink = {
      id: `social-${Date.now()}`,
      platform,
      url,
    }
    if (editingData) {
      setEditingData((prev: any) => ({
        ...prev,
        socialLinks: [...prev.socialLinks, newLink],
      }))
    }
  }

  const updateSocialLink = (id: string, url: string) => {
    if (editingData) {
      setEditingData((prev: any) => ({
        ...prev,
        socialLinks: prev.socialLinks.map((link: SocialLink) =>
          link.id === id ? { ...link, url } : link
        ),
      }))
    }
  }

  const removeSocialLink = (id: string) => {
    if (editingData) {
      setEditingData((prev: any) => ({
        ...prev,
        socialLinks: prev.socialLinks.filter((link: SocialLink) => link.id !== id),
      }))
    }
  }

  return {
    candidateData,
    isEditing,
    editingData,
    isLoading,
    startEditing,
    cancelChanges,
    saveChanges,
    updatePersonalInfo,
    updateCareerBreak,
    updatePreferences,
    addWorkExperience,
    updateWorkExperience,
    removeWorkExperience,
    addEducation,
    updateEducation,
    removeEducation,
    addSkill,
    removeSkill,
    addLanguage,
    removeLanguage,
    addSocialLink,
    updateSocialLink,
    removeSocialLink,
  }
}
