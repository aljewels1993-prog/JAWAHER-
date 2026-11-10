/** Shared data types for both backends (Supabase cloud and on-device). */
export type Lang = 'ar' | 'en';
export type Role = 'student' | 'teacher';
export type Priority = 'low' | 'medium' | 'high';
export type TaskType = 'homework' | 'study' | 'test';

export interface StudentProfile {
  id: string;
  full_name: string;
  username: string;
  language: Lang;
  timezone: string;
  custom_subjects: string[];
  total_points: number;
  created_at: string;
}

export interface TeacherProfile {
  id: string;
  full_name: string;
  school_name: string | null;
  language: Lang;
}

export interface Account {
  userId: string;
  email: string | null;
  role: Role;
  student: StudentProfile | null;
  teacher: TeacherProfile | null;
}

export interface Task {
  id: string;
  student_id: string;
  subject: string;
  title: string;
  description: string | null;
  task_type: TaskType;
  task_date: string;
  /** "HH:MM" or null */
  start_time: string | null;
  duration_minutes: number;
  priority: Priority;
  reminder_minutes: number | null;
  completed: boolean;
  completed_at: string | null;
  created_at: string;
}

export type TaskInput = Pick<Task, 'subject' | 'title' | 'description' | 'task_type' | 'task_date' | 'start_time' | 'duration_minutes' | 'priority' | 'reminder_minutes'>;

export interface StudySession {
  id: string;
  subject: string | null;
  planned_minutes: number;
  status: 'active' | 'completed' | 'cancelled';
  started_at: string;
  completed_at: string | null;
}

export interface RewardResult {
  points_awarded: number;
  bonus_awarded: number;
  new_achievements: string[];
  total_points: number;
}

export type CompleteSessionResult =
  | ({ status: 'completed' | 'already_completed' } & RewardResult)
  | { status: 'too_early'; remaining_seconds: number };

export interface Achievement {
  id: string;
  icon: string;
  name_en: string;
  name_ar: string;
  description_en: string;
  description_ar: string;
  criteria_type: 'sessions_completed' | 'study_minutes' | 'tasks_completed' | 'total_points' | 'study_streak_days';
  threshold: number;
  sort_order: number;
}

export interface StudentAchievement {
  achievement_id: string;
  unlocked_at: string;
}

export interface PointsTransaction {
  id: number | string;
  points: number;
  reason: 'study_session' | 'task_completed' | 'daily_bonus';
  ref_key: string;
  created_at: string;
}

export type NotificationKind =
  | 'welcome' | 'task_reminder' | 'homework_reminder' | 'test_reminder' | 'daily_reminder'
  | 'session_complete' | 'daily_bonus' | 'achievement';

export interface AppNotification {
  id: string;
  kind: NotificationKind;
  data: Record<string, unknown>;
  task_id: string | null;
  scheduled_for: string;
  read_at: string | null;
  created_at: string;
}

export interface StudentStats {
  total_points: number;
  sessions_completed: number;
  study_minutes: number;
  tasks_completed: number;
  today_planned: number;
  today_completed: number;
  today_minutes: number;
  best_streak: number;
  current_streak: number;
  last_active: string | null;
  today: string;
}

export interface WeeklyReportDay {
  date: string;
  minutes: number;
  sessions: number;
  tasks: number;
  points: number;
}

export interface WeeklyReport {
  week_start: string;
  week_end: string;
  study_minutes: number;
  sessions_completed: number;
  tasks_completed: number;
  tasks_planned: number;
  points_earned: number;
  top_subject: string | null;
  subjects: { subject: string; minutes: number }[];
  days: WeeklyReportDay[];
  badges: string[];
}

export interface TeacherStudentRow {
  id: string;
  full_name: string;
  username: string;
  total_points: number;
  tasks_completed: number;
  sessions_completed: number;
  study_minutes: number;
  week_minutes: number;
  badges: number;
  last_active: string | null;
  joined_at: string;
}

export interface SignUpInput {
  fullName: string;
  username: string;
  email: string;
  password: string;
  language: Lang;
  timezone: string;
}

export type ProfilePatch = Partial<Pick<StudentProfile, 'full_name' | 'username' | 'language' | 'custom_subjects'>>;
export type TeacherPatch = Partial<Pick<TeacherProfile, 'full_name' | 'school_name' | 'language'>>;

/** Everything the UI needs from a backend. */
export interface Api {
  readonly mode: 'cloud' | 'device';

  getAccount(): Promise<Account | null>;
  /** Calls back on sign-in/out and on PASSWORD_RECOVERY. Returns an unsubscribe function. */
  onAuthChange(cb: (event: string) => void): () => void;
  signUp(input: SignUpInput): Promise<{ needsConfirmation: boolean }>;
  signIn(email: string, password: string): Promise<void>;
  signOut(): Promise<void>;
  requestPasswordReset(email: string): Promise<void>;
  updatePassword(password: string): Promise<void>;
  usernameAvailable(username: string): Promise<boolean>;
  updateProfile(patch: ProfilePatch): Promise<StudentProfile>;
  updateTeacherProfile(patch: TeacherPatch): Promise<TeacherProfile>;

  listTasks(from: string, to: string, studentId?: string): Promise<Task[]>;
  createTask(input: TaskInput): Promise<Task>;
  updateTask(id: string, input: TaskInput): Promise<Task>;
  deleteTask(id: string): Promise<void>;
  setTaskCompleted(id: string, completed: boolean): Promise<RewardResult>;

  startSession(minutes: number, subject: string | null): Promise<StudySession>;
  completeSession(id: string): Promise<CompleteSessionResult>;
  cancelSession(id: string): Promise<void>;
  listSessions(from: string, to: string, studentId?: string): Promise<StudySession[]>;

  getStats(studentId?: string): Promise<StudentStats>;
  listAchievements(): Promise<Achievement[]>;
  listStudentAchievements(studentId?: string): Promise<StudentAchievement[]>;
  listPoints(limit: number, studentId?: string): Promise<PointsTransaction[]>;

  listNotifications(): Promise<AppNotification[]>;
  markNotificationsRead(ids: string[]): Promise<void>;
  deleteNotification(id: string): Promise<void>;
  ensureDailyReminder(): Promise<void>;

  getWeeklyReport(weekStart: string, studentId?: string): Promise<WeeklyReport>;

  listStudents(search?: string): Promise<TeacherStudentRow[]>;
  getStudentProfile(id: string): Promise<StudentProfile | null>;
}

/** Error with a translatable code (see i18n "error.*"). */
export class ApiError extends Error {
  constructor(public code: string, message?: string) {
    super(message || code);
  }
}
