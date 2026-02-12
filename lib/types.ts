export type ApplicationStatus = "INTERESTED" | "DRAFTING" | "READY" | "APPLIED" | "RECRUITER_SCREEN" | "TECHNICAL" | "ONSITE" | "OFFER" | "REJECTED" | "WITHDRAWN";

export interface User {
  id: string;
  email: string;
  name?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface Experience {
  id: string;
  title: string;
  company: string;
  location?: string;
  startDate: string;
  endDate?: string | "Present";
  description?: string; // Rich text or raw text
  bullets: string[]; // "Bullet bank"
  skills: string[]; // Tagged skills
}

export interface Education {
  id: string;
  school: string;
  degree: string; // e.g. "BS Computer Science"
  startYear?: string;
  endYear?: string;
  gpa?: string;
  coursework?: string[];
}

export interface Project {
  id: string;
  name: string;
  description: string;
  link?: string;
  bullets: string[];
  skills: string[];
}

export interface Skill {
  id: string;
  name: string;
  category?: "Technical" | "Soft" | "Language" | "Tool";
  proficiency?: "Beginner" | "Intermediate" | "Advanced" | "Expert";
  yearsOfExperience?: number;
}

export interface CustomProfileField {
  id: string;
  label: string;
  value: string;
  source?: "Resume" | "LinkedIn" | "Manual";
  updatedAt?: Date;
}

export interface Profile {
  id: string;
  userId: string;
  // Contact & Identity
  contactInfo: string; // Formatting can be flexible or structured later
  location?: string;
  linkedin?: string;
  github?: string;
  portfolio?: string;

  // Sections
  experience: Experience[];
  education: Education[];
  projects: Project[];
  skills: Skill[];

  // Metadata
  summary?: string;
  customFields?: CustomProfileField[];
}

export interface Resume {
  id: string;
  userId: string;
  name: string;
  content: string; // Raw text or JSON content for editor
  filePath?: string | null; // For PDF versions
  originalFileName?: string;
  originalMimeType?: string;
  originalFileBase64?: string;
  version: number;
  isLocked: boolean; // "Locked" versions for historical tracking
  createdAt: Date;
  tags?: string[];
  targetRole?: string;
  focusSkills?: string[];
  jobPreferences?: string;
  workshopAnswers?: {
    yearsExperience?: string;
    topAchievements?: string;
    coreStrengths?: string;
    toolsAndTech?: string;
    certifications?: string;
    targetIndustries?: string;
    desiredRoles?: string;
    preferredLocations?: string;
    additionalNotes?: string;
    targetLevel?: string;
    leadershipScope?: string;
    strongestTech?: string;
    achievementMetric?: string;
    workModePreference?: string;
  };
}

export interface CoverLetterTemplate {
  id: string;
  userId: string;
  name: string;
  content: string; // Template with {{variables}}
  category?: string; // e.g. "Startups", "Corporate"
  isDefault?: boolean;
}

export interface AnswerBankItem {
  id: string;
  userId: string;
  question: string;
  answer: string;
  tags: string[]; // "Behavioral", "Technical", "Leadership"
  createdAt: Date;
  updatedAt: Date;
}

export interface Job {
  id: string;
  userId: string;
  // Core Info
  company: string;
  title: string;
  location?: string;
  remotePolicy?: "Remote" | "Hybrid" | "Onsite";
  link?: string | null;
  description?: string | null;

  // Metadata
  source?: string; // LinkedIn, Referral, etc.
  salaryTarget?: string;
  priorityScore?: number; // 1-100
  hardRequirements?: string[]; // e.g. "Security Clearance"

  createdAt: Date;
  updatedAt: Date;
}

export interface Application {
  id: string;
  userId: string;
  jobId: string;
  job: Job;
  status: ApplicationStatus;

  // Documents Snapshot (What was used to apply)
  resumeId?: string | null;
  resumeSnapshot?: string; // Snapshot of content at time of apply
  coverLetterId?: string | null;
  coverLetterSnapshot?: string;

  // Workbench
  notes?: string | null;
  checklist: {
    research: boolean;
    tailor: boolean;
    prepButtons: boolean; // "Auto-fill form"
    review: boolean;
    submitted: boolean;
  };

  // Tracking
  portalUrl?: string;
  portalCredentials?: { username: string; hint: string }; // NO PASSWORDS

  createdAt: Date;
  updatedAt: Date;
  tailoring?: any; // Storing the AI output
}

export interface TailoringOutput {
  id: string;
  applicationId: string;
  keywords: string[];
  missingKeywords: string[];
  suggestedBullets: string[];
  coverLetterDraft: string;
  matchScore: number;
  createdAt: Date;
}

export interface Contact {
  id: string;
  userId: string;
  name: string;
  role: string;
  company: string;
  email?: string;
  linkedin?: string;
  notes?: string;
  lastContactedAt?: Date;
  nextFollowUpDate?: Date;
  tags: string[]; // "Recruiter", "Hiring Manager", "Peer", "Referral"
  createdAt: Date;
  updatedAt: Date;
}

export interface Interaction {
  id: string;
  contactId: string;
  type: "Email" | "LinkedIn" | "Call" | "Coffee" | "Other";
  date: Date;
  notes: string;
}

export interface LinkedInProfileSnapshot {
  id: string;
  userId: string;
  profileUrl: string;
  name?: string;
  headline?: string;
  location?: string;
  about?: string;
  rawText?: string;
  createdAt: Date;
  updatedAt: Date;
}
