import { useState, useEffect } from "react"
import { toast } from "sonner"
import { mapResumeData } from "../utils/resumeMapper"
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

  const mapProfileToState = (prof: any): ExtendedCandidate => {
    return {
      fullName: prof?.fullName ?? "",
      role: prof?.title ?? "Working Professional",
      email: prof?.user?.email ?? "",
      phone: prof?.phone ?? "",
      location: prof?.location ?? "",
      experience: prof?.totalExperience ?? "",
      currentCtc: prof?.expectedSalary ?? "",
      bio: prof?.bio ?? "",
      avatarUrl: prof?.avatarUrl ?? "",
      profileCompletion: prof?.profileCompletePercent ?? 0,
      skills: (prof?.skills ?? []).map((s: any) => s.skill?.name ?? s.name ?? s),
      languages: prof?.languages?.length ? prof.languages : ["English"],
      socialLinks: prof?.socialLinks ?? [],
      careerBreak: prof?.careerBreak ?? {
        hasBreak: false,
        reason: "",
        duration: "",
        summary: "",
      },
      resume: mapResumeData(prof?.resumeUrl, prof?.resumePublicId, prof?.resumeMetadata),
      education: prof?.education ?? [],
      workExperience: prof?.experience ?? [],
      preferences: {
        expectedSalary: prof?.expectedSalary ?? "",
        preferredLocation: prof?.preferredLocations?.length ? prof.preferredLocations : [],
        availability: prof?.availability ?? "Immediate",
        noticePeriod: prof?.noticePeriod ?? "",
      },
    }
  }

  const fetchProfile = async (showLoading = true) => {
    if (showLoading) setIsLoading(true)
    try {
      const prof = await candidateApi.getProfile()
      setCandidateData((prev) => {
        const mapped = mapProfileToState(prof)
        if (!prev) return mapped
        return {
          ...prev,
          ...mapped,
          // Prevent overwriting a newer locally uploaded resume with stale data
          resume: prev.resume.url ? prev.resume : mapped.resume,
        }
      })
    } catch (err: any) {
      console.error("Failed to fetch profile", err)
      toast.error(err?.message || "Failed to load profile.")
    } finally {
      if (showLoading) setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchProfile(true)
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

  const [saveError, setSaveError] = useState<string | null>(null)

  const saveChanges = async () => {
    if (editingData) {
      setSaveError(null)
      try {
        const payload = {
          fullName: editingData.fullName,
          title: editingData.role,
          bio: editingData.bio,
          phone: editingData.phone,
          location: editingData.location,
          totalExperience: editingData.experience,
          noticePeriod: editingData.preferences.noticePeriod,
          expectedSalary: editingData.currentCtc,
          availability: editingData.preferences.availability,
          preferredLocations: editingData.preferences.preferredLocation,
          careerBreak: editingData.careerBreak,
          languages: editingData.languages,
          socialLinks: editingData.socialLinks,
          skills: editingData.skills,
          education: editingData.education,
          experience: editingData.workExperience,
        }
        const updated = await candidateApi.updateProfile(payload)
        // Re-sync from the server's response (not just the local optimistic
        // edits) so the UI reflects exactly what was actually persisted.
        setCandidateData(updated ? mapProfileToState(updated) : editingData)
        setIsEditing(false)
      } catch (err: any) {
        console.error("Failed to save profile changes", err)
        setSaveError(err?.message || "Failed to save changes. Please try again.")
      }
    }
  }

  const updatePersonalInfo = (fields: Partial<Pick<ExtendedCandidate, "fullName" | "role" | "email" | "phone" | "location" | "experience" | "currentCtc" | "bio">>) => {
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

  const uploadResume = async (file: File) => {
    try {
      const updated = await candidateApi.uploadResume(file)
      if (updated) {
        setCandidateData((prev) => {
          if (!prev) return mapProfileToState(updated)
          return {
            ...prev,
            resume: mapResumeData(updated.resumeUrl, updated.resumePublicId, updated.resumeMetadata),
          }
        })
        setEditingData((prev) => {
          if (!prev) return null
          return {
            ...prev,
            resume: mapResumeData(updated.resumeUrl, updated.resumePublicId, updated.resumeMetadata),
          }
        })
      }
      return updated
    } catch (err: any) {
      console.error("Failed to upload resume in hook:", err)
      throw err
    }
  }

  const deleteResume = async () => {
    try {
      const updated = await candidateApi.deleteResume()
      if (updated) {
        setCandidateData((prev) => {
          if (!prev) return mapProfileToState(updated)
          return {
            ...prev,
            resume: mapResumeData(updated.resumeUrl, updated.resumePublicId, updated.resumeMetadata),
          }
        })
        setEditingData((prev) => {
          if (!prev) return null
          return {
            ...prev,
            resume: mapResumeData(updated.resumeUrl, updated.resumePublicId, updated.resumeMetadata),
          }
        })
      }
      return updated
    } catch (err: any) {
      console.error("Failed to delete resume in hook:", err)
      throw err
    }
  }

  const uploadAvatar = async (file: File) => {
    try {
      const updated = await candidateApi.uploadAvatar(file)
      if (updated) {
        setCandidateData((prev) => (prev ? { ...prev, avatarUrl: updated.avatarUrl ?? "" } : prev))
        setEditingData((prev) => (prev ? { ...prev, avatarUrl: updated.avatarUrl ?? "" } : prev))
      }
      return updated
    } catch (err: any) {
      console.error("Failed to upload avatar in hook:", err)
      throw err
    }
  }

  const deleteAvatar = async () => {
    try {
      const updated = await candidateApi.deleteAvatar()
      setCandidateData((prev) => (prev ? { ...prev, avatarUrl: "" } : prev))
      setEditingData((prev) => (prev ? { ...prev, avatarUrl: "" } : prev))
      return updated
    } catch (err: any) {
      console.error("Failed to delete avatar in hook:", err)
      throw err
    }
  }

  return {
    candidateData,
    isEditing,
    editingData,
    isLoading,
    saveError,
    refreshProfile: () => fetchProfile(false),
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
    uploadResume,
    deleteResume,
    uploadAvatar,
    deleteAvatar,
  }
}
