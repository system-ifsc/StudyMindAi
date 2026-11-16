/** Contrato aplicado pelo Lovable em 16/11/2026. user_id é imposto pelo Repo. */
export interface Conversation {
  id: string;
  subject_id: string | null;
  material_id: string | null;
  task_id: string | null;
  title: string;
  mode: "tutor" | "summary" | "explanation" | "questions" | "review";
  level: "beginner" | "intermediate" | "advanced";
  created_at?: string;
  updated_at?: string;
}
export interface StudyMessage {
  id: string;
  conversation_id: string;
  client_id: string;
  role: "user" | "assistant";
  content: string;
  model: string | null;
  created_at?: string;
}
export interface MessageSource {
  id: string;
  message_id: string;
  material_id: string | null;
  title: string;
  url: string | null;
  excerpt: string;
  page_number: number | null;
  created_at?: string;
}
export interface MessageFeedback {
  id: string;
  message_id: string;
  rating: -1 | 1;
  comment: string;
  created_at?: string;
  updated_at?: string;
}
export interface QuestionSet {
  id: string;
  subject_id: string | null;
  material_id: string | null;
  task_id: string | null;
  conversation_id: string | null;
  title: string;
  mode: "practice" | "exam" | "review";
  level: "beginner" | "intermediate" | "advanced";
  model: string | null;
  created_at?: string;
}
export interface GeneratedQuestion {
  id: string;
  set_id: string;
  position: number;
  kind: "multiple_choice" | "short_answer" | "essay" | "true_false";
  prompt: string;
  expected_answer: string;
  explanation: string;
  rubric: Record<string, unknown>;
  created_at?: string;
}
export interface QuestionOption {
  id: string;
  question_id: string;
  position: number;
  content: string;
  is_correct: boolean;
}
export interface QuestionSource {
  id: string;
  question_id: string;
  material_id: string | null;
  title: string;
  url: string | null;
  excerpt: string;
  page_number: number | null;
}
export interface QuestionAttempt {
  id: string;
  set_id: string;
  client_id: string;
  status: "in_progress" | "submitted" | "evaluated";
  started_at: string;
  submitted_at: string | null;
  score: number | null;
  evaluation: string;
}
export interface AttemptAnswer {
  id: string;
  set_id: string;
  attempt_id: string;
  question_id: string;
  answer: string;
  correct: boolean | null;
  score: number | null;
  evaluation: string;
  answered_at: string;
  evaluated_at: string | null;
}
export interface MaterialFile {
  id: string;
  material_id: string;
  bucket_id: string;
  object_path: string;
  original_name: string;
  mime_type: string;
  size_bytes: number;
  sha256: string | null;
  extraction_status: "pending" | "processing" | "ready" | "failed";
  extraction_error: string | null;
  created_at?: string;
}
export interface LearningTables {
  study_conversations: Conversation;
  study_messages: StudyMessage;
  study_message_sources: MessageSource;
  study_message_feedback: MessageFeedback;
  generated_question_sets: QuestionSet;
  generated_questions: GeneratedQuestion;
  generated_question_options: QuestionOption;
  generated_question_sources: QuestionSource;
  question_attempts: QuestionAttempt;
  question_attempt_answers: AttemptAnswer;
  material_files: MaterialFile;
}
export function emptyLearningTables(): { [K in keyof LearningTables]: LearningTables[K][] } {
  return {
    study_conversations: [],
    study_messages: [],
    study_message_sources: [],
    study_message_feedback: [],
    generated_question_sets: [],
    generated_questions: [],
    generated_question_options: [],
    generated_question_sources: [],
    question_attempts: [],
    question_attempt_answers: [],
    material_files: [],
  };
}
