import { motion } from "framer-motion"
import { useProfile } from "../hooks/useProfile"
import { ProfileHeader } from "../components/Profile/ProfileHeader"
import { PersonalDetailsForm } from "../components/Profile/PersonalDetailsForm"
import { ExperienceSection } from "../components/Profile/ExperienceSection"
import { EducationSection } from "../components/Profile/EducationSection"
import { SkillsSection } from "../components/Profile/SkillsSection"
import { PreferencesSection } from "../components/Profile/PreferencesSection"

// Reuse existing dashboard cards
import { CareerBreakCard } from "@/components/dashboard/CareerBreakCard"
import { ResumeCard } from "@/components/dashboard/ResumeCard"

export function Profile() {
  const {
    candidateData,
    isEditing,
    editingData,
    isLoading,
    saveError,
    refreshProfile,
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
  } = useProfile()

  if (isLoading || !candidateData) {
    return <div className="p-8 text-center text-sm font-bold text-[#6B2C91]">Loading candidate profile...</div>
  }

  // Select data source depending on edit mode
  const currentData = isEditing ? editingData : candidateData
  if (!currentData) return null

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className="space-y-5"
    >
      <div>
        <h1 className="text-2xl font-black tracking-normal text-slate-950 dark:text-white">
          My Profile
        </h1>
        <p className="mt-1 text-sm font-semibold text-slate-500 dark:text-slate-400">
          Manage your personal information, work history, and preferences.
        </p>
      </div>

      {saveError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-xs font-bold text-red-700 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-300">
          {saveError}
        </div>
      )}

      {/* Header Info */}
      <ProfileHeader
        candidate={currentData}
        isEditing={isEditing}
        onEdit={startEditing}
        onSave={saveChanges}
        onCancel={cancelChanges}
      />

      {/* Responsive Grid layout */}
      <div className="grid gap-5 lg:grid-cols-12">
        {/* Left Column: Personal info & Work/Education details */}
        <div className="space-y-5 lg:col-span-8">
          <PersonalDetailsForm
            candidate={currentData}
            isEditing={isEditing}
            onChange={updatePersonalInfo}
            onAddLanguage={addLanguage}
            onRemoveLanguage={removeLanguage}
            onAddSocialLink={addSocialLink}
            onRemoveSocialLink={removeSocialLink}
            onUpdateSocialLink={updateSocialLink}
          />

          <ExperienceSection
            experiences={currentData.workExperience}
            isEditing={isEditing}
            onAddExperience={addWorkExperience}
            onUpdateExperience={updateWorkExperience}
            onRemoveExperience={removeWorkExperience}
          />

          <EducationSection
            education={currentData.education}
            isEditing={isEditing}
            onAddEducation={addEducation}
            onUpdateEducation={updateEducation}
            onRemoveEducation={removeEducation}
          />
        </div>

        {/* Right Column: Preferences, Skills, Resume & Career Break */}
        <div className="space-y-5 lg:col-span-4">
          <SkillsSection
            skills={currentData.skills}
            isEditing={isEditing}
            onAddSkill={addSkill}
            onRemoveSkill={removeSkill}
          />

          <PreferencesSection
            preferences={currentData.preferences}
            isEditing={isEditing}
            onChange={updatePreferences}
          />

          {/* Reused Dashboard Components */}
          <CareerBreakCard
            careerBreak={currentData.careerBreak}
            isEditing={isEditing}
            onChange={updateCareerBreak}
          />
          <ResumeCard resume={currentData.resume} onChanged={refreshProfile} />
        </div>
      </div>
    </motion.div>
  )
}
