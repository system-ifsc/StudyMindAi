import { fileDigest, bytesToBase64, type FullBackup } from "@/lib/core/full-backup";
import { TABLES } from "@/lib/core/types";

/** Um registro em cada tabela, com todas as referências e um binário privado. */
export async function fullBackupFixture(): Promise<FullBackup> {
  const ids = Object.fromEntries(TABLES.map((table) => [table, crypto.randomUUID()]));
  const now = "2026-11-19T12:00:00.000Z";
  const bytes = new TextEncoder().encode("SELECT consulta dados. Arquivo original privado.");
  const sha256 = await fileDigest(bytes);
  const source = {
    material_id: ids["materials"],
    title: "SQL",
    url: null,
    excerpt: "SELECT",
    page_number: null,
  };
  const records = {
    subjects: [{ id: ids["subjects"], name: "SQL", color: "teal" }],
    tasks: [
      {
        id: ids["tasks"],
        subject_id: ids["subjects"],
        title: "Estudar SQL",
        notes: "",
        due_date: "2026-11-20",
        duration_min: 30,
        priority: 2,
        done: false,
        completed_at: null,
      },
    ],
    study_sessions: [
      {
        id: ids["study_sessions"],
        client_id: crypto.randomUUID(),
        subject_id: ids["subjects"],
        task_id: ids["tasks"],
        title: "Estudo",
        started_at: now,
        ended_at: "2026-11-19T12:30:00.000Z",
        minutes: 30,
      },
    ],
    flashcards: [
      {
        id: ids["flashcards"],
        subject_id: ids["subjects"],
        front: "Consultar?",
        back: "SELECT",
        due_date: "2026-11-20",
        interval_days: 1,
        ease: 2.5,
        reps: 1,
      },
    ],
    goals: [{ id: ids["goals"], title: "Aprender", target_date: null, done: false }],
    materials: [
      {
        id: ids["materials"],
        subject_id: ids["subjects"],
        name: "SQL",
        kind: "txt",
        content: "SELECT consulta dados.",
      },
    ],
    quiz_answers: [
      {
        id: ids["quiz_answers"],
        question_id: "sql-1",
        topic: "SQL",
        correct: true,
        answered_at: now,
      },
    ],
    study_conversations: [
      {
        id: ids["study_conversations"],
        subject_id: ids["subjects"],
        material_id: ids["materials"],
        task_id: ids["tasks"],
        title: "Dúvida",
        mode: "review",
        level: "advanced",
      },
    ],
    study_messages: [
      {
        id: ids["study_messages"],
        client_id: crypto.randomUUID(),
        conversation_id: ids["study_conversations"],
        role: "assistant",
        content: "Use `SELECT`.",
        model: null,
      },
    ],
    study_message_sources: [
      { id: ids["study_message_sources"], message_id: ids["study_messages"], ...source },
    ],
    study_message_feedback: [
      {
        id: ids["study_message_feedback"],
        message_id: ids["study_messages"],
        rating: 1,
        comment: "Útil",
      },
    ],
    generated_question_sets: [
      {
        id: ids["generated_question_sets"],
        subject_id: ids["subjects"],
        material_id: ids["materials"],
        task_id: ids["tasks"],
        conversation_id: ids["study_conversations"],
        title: "Simulado",
        mode: "practice",
        level: "intermediate",
        model: null,
      },
    ],
    generated_questions: [
      {
        id: ids["generated_questions"],
        set_id: ids["generated_question_sets"],
        position: 0,
        kind: "multiple_choice",
        prompt: "Qual comando consulta?",
        expected_answer: "SELECT",
        explanation: "SELECT consulta.",
        rubric: { topic: "SQL", expected_questions: 1 },
      },
    ],
    generated_question_options: ["SELECT", "DELETE", "INSERT"].map((content, position) => ({
      id: position === 0 ? ids["generated_question_options"] : crypto.randomUUID(),
      question_id: ids["generated_questions"],
      position,
      content,
      is_correct: position === 0,
    })),
    generated_question_sources: [
      { id: ids["generated_question_sources"], question_id: ids["generated_questions"], ...source },
    ],
    question_attempts: [
      {
        id: ids["question_attempts"],
        set_id: ids["generated_question_sets"],
        client_id: crypto.randomUUID(),
        status: "evaluated",
        started_at: now,
        submitted_at: now,
        score: 100,
        evaluation: "Correto",
      },
    ],
    question_attempt_answers: [
      {
        id: ids["question_attempt_answers"],
        set_id: ids["generated_question_sets"],
        attempt_id: ids["question_attempts"],
        question_id: ids["generated_questions"],
        answer: "0",
        correct: true,
        score: 100,
        evaluation: "Correto",
        answered_at: now,
        evaluated_at: now,
      },
    ],
    material_files: [
      {
        id: ids["material_files"],
        material_id: ids["materials"],
        bucket_id: "study-materials",
        object_path: `old-owner/${ids["material_files"]}`,
        original_name: "sql.txt",
        mime_type: "text/plain",
        size_bytes: bytes.length,
        sha256,
        extraction_status: "ready",
        extraction_error: null,
      },
    ],
  };
  return {
    app: "studymind",
    version: 2,
    exported_at: now,
    profile: {
      display_name: "Restaurado",
      course: "Informática para Internet",
      objective: "Aprender SQL",
      weekly_hours: 5,
      availability: [60, 60, 60, 60, 60, 0, 0],
    },
    records,
    files: [{ id: ids["material_files"], base64: bytesToBase64(bytes), sha256 }],
  } as FullBackup;
}
