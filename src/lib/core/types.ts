import type { LearningTables } from "./learning-data";
export type Priority = 1 | 2 | 3;

export interface Profile {
  id: string;
  display_name: string;
  course: string;
  objective: string;
  weekly_hours: number;
  /** Minutos disponíveis por dia da semana, índice 0 = segunda … 6 = domingo. */
  availability: number[];
  onboarded: boolean;
}

export interface Subject {
  id: string;
  name: string;
  color: string;
  created_at?: string;
}
export interface Task {
  id: string;
  subject_id: string | null;
  title: string;
  notes: string;
  due_date: string;
  duration_min: number;
  priority: Priority;
  done: boolean;
  completed_at: string | null;
  created_at?: string;
}
export interface StudySession {
  id: string;
  client_id: string;
  subject_id: string | null;
  task_id: string | null;
  title: string;
  started_at: string;
  ended_at: string;
  minutes: number;
}
export interface Flashcard {
  id: string;
  subject_id: string | null;
  front: string;
  back: string;
  due_date: string;
  interval_days: number;
  ease: number;
  reps: number;
}
export interface Goal {
  id: string;
  title: string;
  target_date: string | null;
  done: boolean;
}
export interface Material {
  id: string;
  name: string;
  kind: "txt" | "md" | "pdf";
  content: string;
  updated_at?: string;
  subject_id?: string | null;
}
export interface QuizAnswer {
  id: string;
  question_id: string;
  topic: string;
  correct: boolean;
  answered_at: string;
}

export interface Tables extends LearningTables {
  subjects: Subject;
  tasks: Task;
  study_sessions: StudySession;
  flashcards: Flashcard;
  goals: Goal;
  materials: Material;
  quiz_answers: QuizAnswer;
}
export type TableName = keyof Tables;
export const TABLES: TableName[] = [
  "subjects",
  "tasks",
  "study_sessions",
  "flashcards",
  "goals",
  "materials",
  "quiz_answers",
  "study_conversations",
  "study_messages",
  "study_message_sources",
  "study_message_feedback",
  "generated_question_sets",
  "generated_questions",
  "generated_question_options",
  "generated_question_sources",
  "question_attempts",
  "question_attempt_answers",
  "material_files",
];
