import type { Repo } from "./types";
import type { StudyQuestion } from "@/lib/core/study-tools";

/** IDs estáveis permitem repetir gravações interrompidas sem duplicar registros. */
export async function saveQuizDefinition(
  repo: Repo,
  quiz: { title: string; questions: StudyQuestion[] },
  ids: { set: string; questions: string[]; options: string[][] },
  source: { material_id: string } | { material: { name: string; content: string } },
) {
  let materialId: string;
  if ("material_id" in source) materialId = source.material_id;
  else {
    // Mesma chave em tabelas diferentes: estável em novas tentativas de salvar.
    materialId = ids.set;
    if (!(await repo.get("materials", materialId)))
      await repo.insert("materials", { id: materialId, ...source.material, kind: "md" });
  }
  if (!(await repo.get("generated_question_sets", ids.set)))
    await repo.insert("generated_question_sets", {
      id: ids.set,
      title: quiz.title,
      material_id: materialId,
      subject_id: null,
      task_id: null,
      conversation_id: null,
      mode: "practice",
      level: "intermediate",
      model: null,
    });
  for (const [index, q] of quiz.questions.entries()) {
    const id = ids.questions[index]!;
    if (!(await repo.get("generated_questions", id)))
      await repo.insert("generated_questions", {
        id,
        set_id: ids.set,
        position: index,
        kind: q.type === "open" ? "essay" : q.type,
        prompt: q.question,
        expected_answer: q.answer,
        explanation: q.explanation,
        rubric: { topic: q.topic, expected_questions: quiz.questions.length },
      });
    // A restrição UNIQUE(question_id,position) e os IDs permanecem iguais ao repetir.
    const existing = (await repo.list("generated_question_options")).filter(
      (o) => o.question_id === id,
    );
    for (const [position, content] of q.options.entries())
      if (!existing.some((o) => o.position === position))
        await repo.insert("generated_question_options", {
          id: ids.options[index]![position]!,
          question_id: id,
          position,
          content,
          is_correct: q.correct === position,
        });
  }
  return materialId;
}
