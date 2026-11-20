import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { FeedbackInput } from "@/lib/core/feedback";
import { localDatabase } from "@/lib/local/database.server";

/** Server-side Repo contract for the support inbox, separate from study backups. */
export interface FeedbackRepo {
  record(feedback: FeedbackInput): Promise<string>;
}

export function createFeedbackRepo(userId: string, cloud?: SupabaseClient): FeedbackRepo {
  return {
    async record(feedback) {
      const id = randomUUID();
      if (cloud) {
        const { error } = await cloud.from("app_feedback").insert({
          id,
          user_id: userId,
          ...feedback,
        });
        if (error) throw new Error("Não foi possível registrar o feedback.");
      } else {
        localDatabase()
          .prepare(
            "INSERT INTO app_feedback(id,user_id,name,email,category,message) VALUES(?,?,?,?,?,?)",
          )
          .run(id, userId, feedback.name, feedback.email, feedback.category, feedback.message);
      }
      return id;
    },
  };
}
