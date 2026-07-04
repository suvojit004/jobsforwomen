import { useState } from "react"
import { initialCandidateData } from "../mock/candidateMock"
import type {
  ExtendedCandidate,
  WorkExperience,
  Education,
  SocialLink,
  JobPreferences,
} from "../types/candidate"

export function useProfile() {
  const [candidateData, setCandidateData] = useState<ExtendedCandidate>(initialCandidateData)
  const [isEditing, setIsEditing] = useState(false)
  const [editingData, setEditingData] = useState<ExtendedCandidate>(initialCandidateData)

  const startEditing = () => {
    setEditingData(JSON.parse(JSON.stringify(candidateData)))
    setIsEditing(true)
  }

  const cancelChanges = () => {
    setIsEditing(false)
  }

  const saveChanges = () => {
    setCandidateData(editingData)
    setIsEditing(false)
  }

  const updatePersonalInfo = (fields: Partial<Pick<ExtendedCandidate, "fullName" | "role" | "email" | "phone" | "location" | "experience" | "currentCtc">>) => {
    setEditingData((prev) => ({
      ...prev,
      ...fields,
    }))
  }

  const updateCareerBreak = (fields: Partial<ExtendedCandidate["careerBreak"]>) => {
    setEditingData((prev) => ({
      ...prev,
      careerBreak: {
        ...prev.careerBreak,
        ...fields,
      },
    }))
  }

  const updatePreferences = (fields: Partial<JobPreferences>) => {
    setEditingData((prev) => ({
      ...prev,
      preferences: {
        ...prev.preferences,
        ...fields,
      },
    }))
  }

  // Work Experience management
  const addWorkExperience = (exp: Omit<WorkExperience, "id">) => {
    const newExp: WorkExperience = {
      ...exp,
      id: `work-${Date.now()}`,
    }
    setEditingData((prev) => ({
      ...prev,
      workExperience: [...prev.workExperience, newExp],
    }))
  }

  const updateWorkExperience = (id: string, fields: Partial<WorkExperience>) => {
    setEditingData((prev) => ({
      ...prev,
      workExperience: prev.workExperience.map((item) =>
        item.id === id ? { ...item, ...fields } : item
      ),
    }))
  }

  const removeWorkExperience = (id: string) => {
    setEditingData((prev) => ({
      ...prev,
      workExperience: prev.workExperience.filter((item) => item.id !== id),
    }))
  }

  // Education management
  const addEducation = (edu: Omit<Education, "id">) => {
    const newEdu: Education = {
      ...edu,
      id: `edu-${Date.now()}`,
    }
    setEditingData((prev) => ({
      ...prev,
      education: [...prev.education, newEdu],
    }))
  }

  const updateEducation = (id: string, fields: Partial<Education>) => {
    setEditingData((prev) => ({
      ...prev,
      education: prev.education.map((item) =>
        item.id === id ? { ...item, ...fields } : item
      ),
    }))
  }

  const removeEducation = (id: string) => {
    setEditingData((prev) => ({
      ...prev,
      education: prev.education.filter((item) => item.id !== id),
    }))
  }

  // Skills & Languages management
  const addSkill = (skill: string) => {
    if (!editingData.skills.includes(skill)) {
      setEditingData((prev) => ({
        ...prev,
        skills: [...prev.skills, skill],
      }))
    }
  }

  const removeSkill = (skill: string) => {
    setEditingData((prev) => ({
      ...prev,
      skills: prev.skills.filter((s) => s !== skill),
    }))
  }

  const addLanguage = (lang: string) => {
    if (!editingData.languages.includes(lang)) {
      setEditingData((prev) => ({
        ...prev,
        languages: [...prev.languages, lang],
      }))
    }
  }

  const removeLanguage = (lang: string) => {
    setEditingData((prev) => ({
      ...prev,
      languages: prev.languages.filter((l) => l !== lang),
    }))
  }

  // Social Links management
  const addSocialLink = (platform: SocialLink["platform"], url: string) => {
    const newLink: SocialLink = {
      id: `social-${Date.now()}`,
      platform,
      url,
    }
    setEditingData((prev) => ({
      ...prev,
      socialLinks: [...prev.socialLinks, newLink],
    }))
  }

  const updateSocialLink = (id: string, url: string) => {
    setEditingData((prev) => ({
      ...prev,
      socialLinks: prev.socialLinks.map((link) =>
        link.id === id ? { ...link, url } : link
      ),
    }))
  }

  const removeSocialLink = (id: string) => {
    setEditingData((prev) => ({
      ...prev,
      socialLinks: prev.socialLinks.filter((link) => link.id !== id),
    }))
  }

  return {
    candidateData,
    isEditing,
    editingData,
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
