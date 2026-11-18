import { z } from "zod";
import { backupSchema } from "./backup";
import type { TableName } from "./types";
const id = z.string().uuid();
const nullableId = id.nullable();
const stamp = z.iso.datetime({ offset: true });
const base = { id, created_at: stamp.optional() };
const learningBase = z.object(base);
const source = {
  material_id: nullableId,
  title: z.string().max(200),
  url: z.string().max(2000).nullable(),
  excerpt: z.string().max(60000),
  page_number: z.number().int().positive().nullable(),
};
export const profileSchema = backupSchema.shape.profile.extend({ id, onboarded: z.boolean() });
export const rowSchemas: Record<TableName, z.ZodType> = {
  subjects: backupSchema.shape.subjects.element.extend({ created_at: stamp.optional() }),
  tasks: backupSchema.shape.tasks.element.extend({ created_at: stamp.optional() }),
  study_sessions: backupSchema.shape.sessions.element.refine(
    (s) => Date.parse(s.ended_at) >= Date.parse(s.started_at),
    "A sessão termina antes de começar.",
  ),
  flashcards: backupSchema.shape.flashcards.element,
  goals: backupSchema.shape.goals.element,
  materials: backupSchema.shape.materials.element.extend({
    subject_id: nullableId.optional(),
    created_at: stamp.optional(),
    updated_at: stamp.optional(),
  }),
  quiz_answers: backupSchema.shape.quiz_answers.element,
  study_conversations: learningBase.extend({
    subject_id: nullableId,
    material_id: nullableId,
    task_id: nullableId,
    title: z.string().min(1).max(200),
    mode: z.enum(["tutor", "summary", "explanation", "questions", "review"]),
    level: z.enum(["beginner", "intermediate", "advanced"]),
    updated_at: stamp.optional(),
  }),
  study_messages: learningBase.extend({
    conversation_id: id,
    client_id: id,
    role: z.enum(["user", "assistant"]),
    content: z.string().min(1).max(100000),
    model: z.string().nullable(),
  }),
  study_message_sources: learningBase.extend({ ...source, message_id: id }),
  study_message_feedback: learningBase.extend({
    message_id: id,
    rating: z.union([z.literal(-1), z.literal(1)]),
    comment: z.string().max(4000),
    updated_at: stamp.optional(),
  }),
  generated_question_sets: learningBase.extend({
    subject_id: nullableId,
    material_id: nullableId,
    task_id: nullableId,
    conversation_id: nullableId,
    title: z.string().min(1).max(200),
    mode: z.enum(["practice", "exam", "review"]),
    level: z.enum(["beginner", "intermediate", "advanced"]),
    model: z.string().nullable(),
  }),
  generated_questions: learningBase.extend({
    set_id: id,
    position: z.number().int().nonnegative(),
    kind: z.enum(["multiple_choice", "short_answer", "essay", "true_false"]),
    prompt: z.string().min(1).max(2000),
    expected_answer: z.string().max(3000),
    explanation: z.string().max(3000),
    rubric: z.record(z.string(), z.unknown()),
  }),
  generated_question_options: learningBase.extend({
    question_id: id,
    position: z.number().int().nonnegative(),
    content: z.string().max(1000),
    is_correct: z.boolean(),
  }),
  generated_question_sources: learningBase.extend({ ...source, question_id: id }),
  question_attempts: learningBase.extend({
    set_id: id,
    client_id: id,
    status: z.enum(["in_progress", "submitted", "evaluated"]),
    started_at: stamp,
    submitted_at: stamp.nullable(),
    score: z.number().min(0).max(100).nullable(),
    evaluation: z.string().max(100000),
  }),
  question_attempt_answers: learningBase.extend({
    set_id: id,
    attempt_id: id,
    question_id: id,
    answer: z.string().max(15000),
    correct: z.boolean().nullable(),
    score: z.number().min(0).max(100).nullable(),
    evaluation: z.string().max(100000),
    answered_at: stamp,
    evaluated_at: stamp.nullable(),
  }),
  material_files: learningBase.extend({
    material_id: id,
    bucket_id: z.literal("study-materials"),
    object_path: z.string().max(300),
    original_name: z.string().min(1).max(255),
    mime_type: z.string().max(200),
    size_bytes: z.number().int().min(0).max(10000000),
    sha256: z.string().nullable(),
    extraction_status: z.enum(["pending", "processing", "ready", "failed"]),
    extraction_error: z.string().nullable(),
  }),
};
// Schema-independent ownership references used by the local Repo.
export const rowReferences: Partial<Record<TableName, Record<string, TableName>>> = {
  tasks: { subject_id: "subjects" },
  study_sessions: { subject_id: "subjects", task_id: "tasks" },
  flashcards: { subject_id: "subjects" },
  materials: { subject_id: "subjects" },
  study_conversations: { subject_id: "subjects", material_id: "materials", task_id: "tasks" },
  study_messages: { conversation_id: "study_conversations" },
  study_message_sources: { message_id: "study_messages", material_id: "materials" },
  study_message_feedback: { message_id: "study_messages" },
  generated_question_sets: {
    subject_id: "subjects",
    material_id: "materials",
    task_id: "tasks",
    conversation_id: "study_conversations",
  },
  generated_questions: { set_id: "generated_question_sets" },
  generated_question_options: { question_id: "generated_questions" },
  generated_question_sources: { question_id: "generated_questions", material_id: "materials" },
  question_attempts: { set_id: "generated_question_sets" },
  question_attempt_answers: {
    set_id: "generated_question_sets",
    attempt_id: "question_attempts",
    question_id: "generated_questions",
  },
  material_files: { material_id: "materials" },
};
