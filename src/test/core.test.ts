import { buildAdaptivePlan } from "@/lib/core/adaptive-plan";
import { assistantProviderError } from "@/lib/core/assistant";
import { authErrorMessage } from "@/lib/core/auth-errors";
import { describe, expect, it } from "vitest";

describe("erros de autenticação", () => {
  it("distingue limite de envio de e-mails de limite de solicitações", () => {
    expect(authErrorMessage({ code: "over_email_send_rate_limit", message: "limit" })).toContain(
      "serviço de e-mail atingiu o limite",
    );
    expect(authErrorMessage(new Error("Email rate limit exceeded"))).toContain(
      "serviço de e-mail atingiu o limite",
    );
    expect(authErrorMessage({ code: "over_request_rate_limit" })).toContain("Muitas tentativas");
  });
  it("explica restrição do destinatário e mantém erros de credenciais", () => {
    expect(authErrorMessage({ code: "email_address_not_authorized" })).toContain(
      "ainda não está habilitado",
    );
    expect(authErrorMessage(new Error("Invalid login credentials"))).toBe(
      "E-mail ou senha incorretos.",
    );
  });
});

describe("erros do provedor de IA", () => {
  it("distingue saldo esgotado de limite temporário mesmo com HTTP 429", () => {
    expect(assistantProviderError(429, "credit_balance_exhausted")).toContain("créditos");
    expect(assistantProviderError(429, "insufficient_quota")).toContain("créditos");
    expect(assistantProviderError(429, "rate_limit_exceeded")).toContain("Aguarde");
  });
  it("explica chave inválida e modelo indisponível sem expor o erro bruto", () => {
    expect(assistantProviderError(401)).toContain("chave de API");
    expect(assistantProviderError(404)).toContain("modelo");
    expect(assistantProviderError(500)).toBe("O assistente está indisponível no momento.");
  });
});
import { buildPlan } from "@/lib/core/planner";
import { review } from "@/lib/core/srs";
import {
  elapsedMs,
  completeCycle,
  pauseTimer,
  resumeTimer,
  restoreTimer,
  sessionMinutes,
  startTimer,
  timerStorageKey,
} from "@/lib/core/pomodoro";
import { quizStats, streak, minutesInRange } from "@/lib/core/metrics";
import { parseBackup } from "@/lib/core/backup";
import { backupAdditions } from "@/lib/core/backup-additions";
import { validateFile, validateContent } from "@/lib/core/files";
import { QUESTIONS, selectPracticeQuestions } from "@/lib/core/questions";
import type { Task, StudySession } from "@/lib/core/types";
import {
  correctObjective,
  parseStudyOutput,
  progressContext,
  studyQuestionSchema,
} from "@/lib/core/study-tools";
import { generationRequestSchema, gradeRequestSchema } from "@/lib/core/assistant";
import { assistantRequestSchema } from "@/lib/core/assistant";
import { COURSES, findCourse, requireCourse, questionsForCourse } from "@/lib/core/courses";

describe("catálogo de cursos", () => {
  it("oferece exercícios específicos para cada curso sem misturar áreas", () => {
    for (const course of COURSES) {
      const pool = questionsForCourse(QUESTIONS, course.name);
      expect(pool.some((question) => question.topic !== "Técnicas de Estudo")).toBe(true);
      expect(
        pool.every(
          (question) =>
            question.topic === "Técnicas de Estudo" ||
            course.subjects.some((subject) => subject === question.topic),
        ),
      ).toBe(true);
    }
    expect(questionsForCourse(QUESTIONS, "Curso inexistente")).toEqual([]);
  });
  it("oferece somente os quatro cursos do projeto", () => {
    expect(COURSES.map((course) => course.name)).toEqual([
      "Informática para Internet",
      "Agroecologia",
      "Biotecnologia",
      "Mecatrônica",
    ]);
    for (const course of COURSES) expect(course.subjects.length).toBeGreaterThan(0);
  });
  it("reconhece o nome legado sem permitir cursos fora do catálogo", () => {
    expect(requireCourse("Técnico em Informática para Internet")).toBe("Informática para Internet");
    expect(findCourse("Medicina")).toBeUndefined();
    expect(() => requireCourse("")).toThrow();
    expect(() => requireCourse("Medicina")).toThrow();
  });
});

describe("validação do assistente", () => {
  it("aceita conversa e material dentro dos limites", () => {
    expect(
      assistantRequestSchema.safeParse({
        messages: [{ role: "user", content: " Explique SQL " }],
        material: { name: "Resumo", content: "SQL" },
      }).success,
    ).toBe(true);
  });
  it("rejeita estruturas inválidas e mensagens privilegiadas", () => {
    for (const raw of [
      null,
      [],
      { messages: {} },
      { messages: [null] },
      { messages: [{ role: "system", content: "x" }] },
      { messages: [{ role: "assistant", content: "x" }] },
      { messages: [{ role: "user", content: "   " }] },
    ]) {
      expect(assistantRequestSchema.safeParse(raw).success).toBe(false);
    }
  });
  it("rejeita conteúdo excessivo sem truncar silenciosamente", () => {
    const message = { role: "user", content: "x" };
    expect(assistantRequestSchema.safeParse({ messages: Array(13).fill(message) }).success).toBe(
      false,
    );
    expect(
      assistantRequestSchema.safeParse({ messages: [{ ...message, content: "x".repeat(4001) }] })
        .success,
    ).toBe(false);
    expect(
      assistantRequestSchema.safeParse({
        messages: [message],
        material: { name: "Resumo", content: "x".repeat(15001) },
      }).success,
    ).toBe(false);
  });
});

const task = (
  id: string,
  due: string,
  min: number,
  priority: 1 | 2 | 3 = 2,
  done = false,
): Task => ({
  id,
  subject_id: null,
  title: id,
  notes: "",
  due_date: due,
  duration_min: min,
  priority,
  done,
  completed_at: null,
});
// 2026-11-16 é uma segunda-feira
const MON = "2026-11-16";

describe("planejador determinístico", () => {
  it("respeita a disponibilidade diária e o prazo", () => {
    const r = buildPlan([task("a", "2026-11-17", 90)], [60, 60, 0, 0, 0, 0, 0], MON);
    expect(r.blocks).toEqual([
      { date: "2026-11-16", taskId: "a", title: "a", minutes: 60, late: false },
      { date: "2026-11-17", taskId: "a", title: "a", minutes: 30, late: false },
    ]);
    expect(r.unscheduled).toEqual([]);
  });
  it("prioriza prazo mais próximo e depois prioridade alta", () => {
    const r = buildPlan(
      [
        task("baixa", "2026-11-20", 30, 1),
        task("alta", "2026-11-20", 30, 3),
        task("cedo", "2026-11-16", 30, 1),
      ],
      [60, 60, 60, 60, 60, 0, 0],
      MON,
    );
    expect(r.blocks.filter((b) => b.date === MON).map((b) => b.taskId)).toEqual(["cedo", "alta"]);
  });
  it("informa o que não cabe até o prazo", () => {
    const r = buildPlan([task("x", MON, 120)], [45, 0, 0, 0, 0, 0, 0], MON);
    expect(r.unscheduled).toEqual([{ taskId: "x", title: "x", missingMinutes: 75 }]);
  });
  it("ignora concluídas e marca atrasadas para hoje", () => {
    const r = buildPlan(
      [task("feita", MON, 30, 2, true), task("atrasada", "2026-11-10", 30)],
      [60, 0, 0, 0, 0, 0, 0],
      MON,
    );
    expect(r.blocks).toEqual([
      { date: MON, taskId: "atrasada", title: "atrasada", minutes: 30, late: true },
    ]);
  });
  it("é determinístico", () => {
    const ts = [task("a", "2026-11-20", 50, 2), task("b", "2026-11-19", 70, 3)];
    expect(buildPlan(ts, [30, 30, 30, 30, 30, 30, 30], MON)).toEqual(
      buildPlan([...ts].reverse(), [30, 30, 30, 30, 30, 30, 30], MON),
    );
  });
});

describe("revisão espaçada", () => {
  const novo = { interval_days: 0, ease: 2.5, reps: 0 };
  it("errar volta em 1 dia e zera repetições", () => {
    expect(review({ interval_days: 10, ease: 2.5, reps: 4 }, 0, MON)).toEqual({
      interval_days: 1,
      ease: 2.3,
      reps: 0,
      due_date: "2026-11-17",
    });
  });
  it("bom: 1 dia, depois 6 dias, depois intervalo × facilidade", () => {
    const r1 = review(novo, 2, MON);
    expect(r1.interval_days).toBe(1);
    const r2 = review(r1, 2, MON);
    expect(r2.interval_days).toBe(6);
    expect(review(r2, 2, MON).interval_days).toBe(15);
  });
  it("nunca passa de 365 dias", () => {
    expect(review({ interval_days: 300, ease: 3, reps: 10 }, 3, MON).interval_days).toBe(365);
  });
});

describe("pomodoro por timestamps", () => {
  it("descarta estados locais inválidos sem quebrar a tela", () => {
    for (const raw of [null, "{", "null", "{}", '{"targetMin":-1}'])
      expect(restoreTimer(raw)).toBeNull();
    const timer = startTimer(
      { clientId: "c", label: "x", taskId: null, subjectId: null, targetMin: 25 },
      0,
    );
    expect(restoreTimer(JSON.stringify(timer))).toEqual(timer);
  });
  it("encerra na meta ao retornar à aba e permite continuar depois", () => {
    const timer = startTimer(
      { clientId: "c", label: "x", taskId: null, subjectId: null, targetMin: 25 },
      0,
    );
    const completed = completeCycle(timer, 120 * 60000);
    expect(sessionMinutes(completed, 120 * 60000)).toBe(25);
    expect(completed.runningSince).toBeNull();
    const resumed = resumeTimer(completed, 120 * 60000);
    expect(completeCycle(resumed, 125 * 60000)).toBe(resumed);
    expect(sessionMinutes(resumed, 125 * 60000)).toBe(30);
  });
  it("não conta o tempo pausado", () => {
    let s = startTimer(
      { clientId: "c", label: "x", taskId: null, subjectId: null, targetMin: 25 },
      0,
    );
    s = pauseTimer(s, 10 * 60000);
    s = resumeTimer(s, 30 * 60000);
    expect(elapsedMs(s, 35 * 60000)).toBe(15 * 60000);
    expect(sessionMinutes(s, 35 * 60000 + 59000)).toBe(15);
  });
  it("limita a sessão a 480 minutos", () => {
    const s = startTimer(
      { clientId: "c", label: "x", taskId: null, subjectId: null, targetMin: 25 },
      0,
    );
    expect(sessionMinutes(s, 1000 * 60000)).toBe(480);
  });
  it("separa o cronômetro local de cada conta", () => {
    expect(timerStorageKey("real", "usuario-a")).not.toBe(timerStorageKey("real", "usuario-b"));
    expect(timerStorageKey("real", "usuario-a")).not.toBe(timerStorageKey("demo", "usuario-a"));
  });
});

describe("métricas", () => {
  const ses = (day: string, minutes: number): StudySession => ({
    id: day + minutes,
    client_id: day,
    subject_id: null,
    task_id: null,
    title: "",
    started_at: new Date(`${day}T12:00:00`).toISOString(),
    ended_at: "",
    minutes,
  });
  it("resultado agregado dos exercícios soma corretamente", () => {
    const a = (topic: string, correct: boolean) => ({
      id: Math.random().toString(),
      question_id: "q",
      topic,
      correct,
      answered_at: "",
    });
    const r = quizStats([a("Redes", true), a("Redes", false), a("BD", true), a("BD", true)]);
    expect(r).toMatchObject({ correct: 3, total: 4, pct: 75 });
    expect(r.byTopic).toEqual([
      { topic: "BD", correct: 2, total: 2, pct: 100 },
      { topic: "Redes", correct: 1, total: 2, pct: 50 },
    ]);
  });
  it("sequência e minutos no intervalo", () => {
    const ss = [ses("2026-11-16", 30), ses("2026-11-15", 20), ses("2026-11-13", 10)];
    expect(streak(ss, "2026-11-16")).toBe(2);
    expect(minutesInRange(ss, "2026-11-14", "2026-11-16")).toBe(50);
  });
});

describe("backup JSON", () => {
  const base = {
    app: "studymind",
    version: 1,
    exported_at: "2026-11-14T00:00:00Z",
    profile: {
      display_name: "A",
      course: "B",
      objective: "",
      weekly_hours: 8,
      availability: [60, 60, 60, 60, 60, 0, 0],
    },
    subjects: [],
    tasks: [],
    sessions: [],
    flashcards: [],
    goals: [],
    materials: [],
    quiz_answers: [],
  };
  it("aceita um backup válido", () => {
    expect(parseBackup(JSON.stringify(base)).ok).toBe(true);
  });
  it("remapeia referências por tabela quando atividade e disciplina compartilham o ID antigo", () => {
    const id = "11111111-1111-4111-8111-111111111111";
    const parsed = parseBackup(
      JSON.stringify({
        ...base,
        subjects: [{ id, name: "Matemática", color: "indigo" }],
        tasks: [{ ...task(id, MON, 30), subject_id: id }],
      }),
    );
    if (!parsed.ok) throw new Error(parsed.error);
    let sequence = 0;
    const additions = backupAdditions(parsed.data, () => `novo-${++sequence}`);
    expect(additions.tasks?.[0]?.subject_id).toBe(additions.subjects?.[0]?.id);
    expect(additions.tasks?.[0]?.id).not.toBe(additions.subjects?.[0]?.id);
    expect(parsed.data.tasks[0]?.subject_id).toBe(id);
  });
  it("rejeita datas impossíveis, IDs duplicados e cartões órfãos", () => {
    const id = "11111111-1111-4111-8111-111111111111";
    const subject = { id, name: "SQL", color: "blue" };
    expect(parseBackup(JSON.stringify({ ...base, subjects: [subject, subject] })).ok).toBe(false);
    expect(parseBackup(JSON.stringify({ ...base, exported_at: "not-a-timestamp" })).ok).toBe(false);
    const card = {
      id,
      subject_id: id,
      front: "Q",
      back: "A",
      due_date: "2026-11-16",
      interval_days: 0,
      ease: 2.5,
      reps: 0,
    };
    expect(parseBackup(JSON.stringify({ ...base, flashcards: [card] })).ok).toBe(false);
    expect(
      parseBackup(
        JSON.stringify({
          ...base,
          subjects: [subject],
          flashcards: [{ ...card, due_date: "2026-02-31" }],
        }),
      ).ok,
    ).toBe(false);
  });
  it("rejeita JSON quebrado e app errado", () => {
    expect(parseBackup("{").ok).toBe(false);
    expect(parseBackup(JSON.stringify({ ...base, app: "outro" })).ok).toBe(false);
  });
  it("rejeita referência a disciplina inexistente", () => {
    const t = {
      id: "11111111-1111-4111-8111-111111111111",
      subject_id: "22222222-2222-4222-8222-222222222222",
      title: "x",
      notes: "",
      due_date: "2026-11-20",
      duration_min: 30,
      priority: 2,
      done: false,
      completed_at: null,
    };
    expect(parseBackup(JSON.stringify({ ...base, tasks: [t] })).ok).toBe(false);
  });
});

describe("arquivos", () => {
  it("aceita txt/md até 1 MB e pdf até 10 MB", () => {
    expect(validateFile("a.txt", 1_000_000).ok).toBe(true);
    expect(validateFile("a.md", 1_000_001).ok).toBe(false);
    expect(validateFile("a.pdf", 10_000_000).ok).toBe(true);
    expect(validateFile("a.docx", 10).ok).toBe(true);
    expect(validateFile("a.pptx", 10_000_000).ok).toBe(true);
    expect(validateFile("a.docx", 10_000_001).ok).toBe(false);
    expect(validateFile("a.doc", 10).ok).toBe(false);
  });
  it("limita a 200 mil caracteres", () => {
    expect(validateContent("a".repeat(200_000))).toBeNull();
    expect(validateContent("a".repeat(200_001))).not.toBeNull();
  });
});

describe("banco de exercícios", () => {
  it("prioriza questões inéditas e depois as menos praticadas", () => {
    const pool = QUESTIONS.slice(0, 3);
    const answers = [
      { question_id: pool[0]!.id, answered_at: "2026-11-01" },
      { question_id: pool[0]!.id, answered_at: "2026-11-02" },
      { question_id: pool[1]!.id, answered_at: "2026-11-03" },
    ];
    expect(selectPracticeQuestions(pool, answers).map((q) => q.id)).toEqual([
      pool[2]!.id,
      pool[1]!.id,
      pool[0]!.id,
    ]);
    expect(selectPracticeQuestions(pool, answers, 1)).toEqual([pool[2]]);
  });
  it("usa a resposta mais recente para desempatar sem depender da ordem da entrada", () => {
    const pool = QUESTIONS.slice(0, 2);
    const answers = pool.flatMap((q, i) => [
      { question_id: q.id, answered_at: i ? "2026-11-02" : "2026-11-03" },
      { question_id: q.id, answered_at: "2026-11-01" },
    ]);
    expect(selectPracticeQuestions(pool, answers)[0]?.id).toBe(pool[1]!.id);
    expect(selectPracticeQuestions([...pool].reverse(), [...answers].reverse())).toEqual(
      selectPracticeQuestions(pool, answers),
    );
    expect(selectPracticeQuestions(pool, answers, -1)).toEqual([]);
  });
  it("tem mais que as 3 questões originais, ids únicos e gabarito válido", () => {
    expect(QUESTIONS.length).toBeGreaterThan(3);
    expect(new Set(QUESTIONS.map((q) => q.id)).size).toBe(QUESTIONS.length);
    for (const q of QUESTIONS) expect(q.correct).toBeLessThan(q.opts.length);
  });
});

describe("ferramentas de estudo com IA", () => {
  const objective = {
    type: "multiple_choice" as const,
    topic: "Biologia",
    question: "Qual estrutura?",
    options: ["Núcleo", "Membrana", "Ribossomo"],
    correct: 0,
    answer: "Núcleo",
    explanation: "O núcleo contém o material genético.",
  };
  it("valida gabaritos e alternativas antes de exibir questões", () => {
    expect(studyQuestionSchema.safeParse(objective).success).toBe(true);
    expect(studyQuestionSchema.safeParse({ ...objective, correct: 3 }).success).toBe(false);
    expect(studyQuestionSchema.safeParse({ ...objective, options: ["A", "A", "B"] }).success).toBe(
      false,
    );
    expect(
      studyQuestionSchema.safeParse({ ...objective, type: "true_false", options: ["Sim", "Não"] })
        .success,
    ).toBe(false);
    expect(
      studyQuestionSchema.safeParse({
        ...objective,
        type: "true_false",
        options: ["Verdadeiro", "Falso"],
      }).success,
    ).toBe(true);
  });
  it("corrige questões objetivas e separa discursivas", () => {
    expect(correctObjective(objective, 0)).toBe(true);
    expect(correctObjective(objective, 1)).toBe(false);
    expect(() => correctObjective(objective, -1)).toThrow();
    expect(
      correctObjective({ ...objective, type: "open", options: [], correct: null }, 0),
    ).toBeNull();
  });
  it("aceita JSON estruturado e rejeita saída inventada ou tipo diferente", () => {
    const output = { type: "flashcards", cards: [{ front: "O que é?", back: "Um conceito." }] };
    expect(parseStudyOutput("```json\n" + JSON.stringify(output) + "\n```", "flashcards")).toEqual(
      output,
    );
    expect(() => parseStudyOutput("O modelo não está configurado", "flashcards")).toThrow();
    expect(() => parseStudyOutput(JSON.stringify(output), "summary")).toThrow();
    expect(() => parseStudyOutput('{"type":"flashcards","cards":[]}', "flashcards")).toThrow();
  });
  it("exige uma origem e limita a quantidade solicitada", () => {
    const request = {
      action: "generate",
      tool: "quiz",
      material: { name: "Texto", content: "Biologia" },
      count: 10,
    };
    expect(generationRequestSchema.safeParse(request).success).toBe(true);
    expect(generationRequestSchema.safeParse({ ...request, material: null }).success).toBe(false);
    expect(generationRequestSchema.safeParse({ ...request, count: 21 }).success).toBe(false);
    expect(
      generationRequestSchema.safeParse({
        ...request,
        material: { name: "Texto", content: "x".repeat(15001) },
      }).success,
    ).toBe(false);
  });
  it("só permite avaliação discursiva com origem e resposta", () => {
    const request = {
      action: "grade",
      question: { ...objective, type: "open", options: [], correct: null },
      answer: "Núcleo",
      material_id: "11111111-1111-4111-8111-111111111111",
    };
    expect(gradeRequestSchema.safeParse(request).success).toBe(true);
    expect(gradeRequestSchema.safeParse({ ...request, question: objective }).success).toBe(false);
    expect(gradeRequestSchema.safeParse({ ...request, answer: " " }).success).toBe(false);
  });
  it("calcula contexto real de progresso sem alterar dados de entrada", () => {
    const answers = [
      { id: "1", question_id: "1", topic: "Redes", correct: false, answered_at: "2026-11-14" },
      { id: "2", question_id: "2", topic: "Redes", correct: true, answered_at: "2026-11-14" },
    ];
    const result = progressContext(
      [],
      answers,
      [
        {
          id: "s",
          client_id: "s",
          subject_id: null,
          task_id: null,
          title: "Estudo",
          started_at: "2026-11-14T12:00:00Z",
          ended_at: "2026-11-14T12:30:00Z",
          minutes: 30,
        },
      ],
      "2026-11-14",
    );
    expect(result).toMatchObject({
      questions_answered: 2,
      accuracy_percent: 50,
      study_minutes: 30,
      sessions: 1,
      reviews_pending: 0,
    });
    expect(result.topics[0]).toMatchObject({ topic: "Redes", pct: 50 });
    expect(progressContext([], [], [], "2026-11-14").questions_answered).toBe(0);
  });
});

describe("central de aprendizagem", () => {
  it("recomenda a partir dos registros sem depender da ordem das atividades", async () => {
    const { learningRecommendations } = await import("@/lib/core/learning");
    const tasks = [task("b", "2026-11-20", 30), task("a", MON, 30)];
    const before = structuredClone(tasks);
    expect(learningRecommendations(tasks, [], [], [], MON)[0]?.title).toBe("a");
    expect(learningRecommendations([...tasks].reverse(), [], [], [], MON)).toEqual(
      learningRecommendations(tasks, [], [], [], MON),
    );
    expect(tasks).toEqual(before);
    expect(learningRecommendations([], [], [], [], MON)[0]?.section).toBe("materiais");
  });
  it("não recomenda dificuldade sem pelo menos três respostas", async () => {
    const { learningRecommendations } = await import("@/lib/core/learning");
    const answer = { id: "1", question_id: "1", topic: "SQL", correct: false, answered_at: MON };
    expect(learningRecommendations([], [], [answer], [], MON)[0]?.section).toBe("materiais");
    expect(learningRecommendations([], [], [answer, answer, answer], [], MON)[0]?.title).toBe(
      "Praticar SQL",
    );
  });
});

describe("modos do tutor", () => {
  it("valida modos e níveis com padrões compatíveis", () => {
    const messages = [{ role: "user", content: "Explique SQL" }];
    expect(assistantRequestSchema.parse({ messages })).toMatchObject({
      mode: "teacher",
      level: "standard",
    });
    expect(assistantRequestSchema.safeParse({ messages, mode: "system" }).success).toBe(false);
    expect(assistantRequestSchema.safeParse({ messages, level: "arbitrário" }).success).toBe(false);
  });
});

// Planejamento adaptativo usa somente evidências registradas.
describe("plano adaptativo", () => {
  it("redistribui atrasadas e desconta minutos estudados sem alterar a atividade", () => {
    const original = task("late", "2026-11-15", 90);
    const session = {
      id: "s",
      client_id: "s",
      task_id: "late",
      subject_id: null,
      title: "",
      started_at: "2026-11-15T12:00:00Z",
      ended_at: "2026-11-15T12:30:00Z",
      minutes: 30,
    };
    const result = buildAdaptivePlan([original], [30, 30, 0, 0, 0, 0, 0], MON, [], [], [session]);
    expect(result.blocks.map((b) => b.minutes)).toEqual([30, 30]);
    expect(result.unscheduled).toEqual([]);
    expect(original.duration_min).toBe(90);
  });
  it("prioriza dificuldades com amostra mínima e mantém o resultado determinístico", () => {
    const tasks = [task("a", "2026-11-20", 30), task("b", "2026-11-20", 30)];
    const answers = Array.from({ length: 3 }, (_, i) => ({
      id: String(i),
      question_id: String(i),
      topic: tasks[1]!.title,
      correct: false,
      answered_at: MON,
    }));
    const run = (rows: typeof tasks) =>
      buildAdaptivePlan(rows, [30, 30, 0, 0, 0, 0, 0], MON, [], answers, []);
    expect(run(tasks).focus[0]!.task.id).toBe("b");
    expect(run(tasks)).toEqual(run([...tasks].reverse()));
    expect(
      buildAdaptivePlan(
        tasks,
        [30, 30, 0, 0, 0, 0, 0],
        MON,
        [],
        answers.slice(0, 2),
        [],
      ).evidence.every((r) => r.accuracy === null),
    ).toBe(true);
  });
});

import { availabilityError } from "@/lib/core/profile";
import { toISODate } from "@/lib/core/dates";
describe("regressões da avaliação completa", () => {
  it("mantém média antes da baixa fora do grupo de foco", () => {
    const rows = [
      { ...task("a", MON, 30), title: "Z alta", priority: 3 as const },
      { ...task("b", MON, 30), title: "Z média", priority: 2 as const },
      { ...task("c", MON, 30), title: "A baixa", priority: 1 as const },
    ];
    const result = buildAdaptivePlan(rows, [120, 120, 120, 120, 120, 120, 120], MON, [], [], []);
    expect(result.blocks.map((b) => b.taskId)).toEqual(["a", "b", "c"]);
    expect(
      buildAdaptivePlan([...rows].reverse(), [120, 120, 120, 120, 120, 120, 120], MON, [], [], []),
    ).toEqual(result);
  });
  it("desconta sessão no dia local inclusive perto da meia-noite", () => {
    const timestamp = new Date(2026, 10, 19, 22).toISOString();
    const day = toISODate(new Date(timestamp));
    const row = { ...task("night", day, 30) };
    const session: StudySession = {
      id: "s",
      client_id: "s",
      task_id: row.id,
      subject_id: null,
      title: "Noite",
      started_at: timestamp,
      ended_at: new Date(new Date(timestamp).getTime() + 1800000).toISOString(),
      minutes: 30,
    };
    expect(
      buildAdaptivePlan([row], [60, 60, 60, 60, 60, 60, 60], day, [], [], [session]).blocks,
    ).toEqual([]);
  });
  it("valida o total da disponibilidade antes de enviar ao servidor", () => {
    expect(availabilityError([960, 960, 960, 960, 960, 960, 960])).toContain("100 horas");
    expect(availabilityError([960, 960, 960, 960, 960, 960, 240])).toBeNull();
    expect(availabilityError([0, 0, 0, 0, 0, 0, 0])).toContain("30 minutos");
  });
});

import { fullBackupFixture } from "./fixtures/full-backup";
import { fullBackupSchema, fullBackupAdditions } from "@/lib/core/full-backup";
it("valida referências do backup completo e remapeia relações sem alterar a origem", async () => {
  const fixture = await fullBackupFixture();
  const before = structuredClone(fixture);
  const rows = fullBackupAdditions(fixture, "restored-owner", () => crypto.randomUUID());
  expect(rows.study_messages[0]!.conversation_id).toBe(rows.study_conversations[0]!.id);
  expect(rows.material_files[0]!.object_path).toBe(`restored-owner/${rows.material_files[0]!.id}`);
  expect(fixture).toEqual(before);
  const invalid = structuredClone(fixture);
  invalid.records.study_messages[0]!.conversation_id = crypto.randomUUID();
  expect(fullBackupSchema.safeParse(invalid).success).toBe(false);
  const missingFile = structuredClone(fixture);
  missingFile.files = [];
  expect(fullBackupSchema.safeParse(missingFile).success).toBe(false);
});
