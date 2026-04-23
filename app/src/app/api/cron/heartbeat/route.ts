import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getDueTasks, markTaskTriggered, rescheduleTask } from "@/lib/db/queries/agent-tasks";
import { createNotification } from "@/lib/db/queries/notifications";
import { addMessage } from "@/lib/db";
import { COACH_META } from "@/lib/coaches";

export const runtime = "nodejs";
export const maxDuration = 60;

const DURATION_MAP: Record<string, number> = {
  m: 60 * 1000,
  h: 60 * 60 * 1000,
  d: 24 * 60 * 60 * 1000,
  w: 7 * 24 * 60 * 60 * 1000,
};

function parseRepeatInterval(interval: string): number | null {
  const match = interval.match(/^(\d+)([mhdw])$/);
  if (!match) return null;
  return parseInt(match[1]) * (DURATION_MAP[match[2]] || DURATION_MAP.d);
}

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${cronSecret}`) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    const dueTasks = await getDueTasks();

    if (dueTasks.length === 0) {
      return Response.json({ processed: 0 });
    }

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    let processed = 0;

    for (const task of dueTasks) {
      try {
        const coach = COACH_META.find(c => c.key === task.coachKey);
        const coachName = coach?.name || task.coachKey;
        const context = task.context as Record<string, any> || {};
        const title = context.title || "Follow-up";

        const TASK_PROMPTS: Record<string, string> = {
          coaching_followup: `You are ${coachName}, a business coach. Generate a brief, encouraging follow-up message for a coaching task titled "${title}". Include a specific challenge or question to keep them engaged. Be concise (2-3 sentences).`,
          reminder: `You are ${coachName}. Generate a brief reminder about: "${title}". Be helpful and direct. (1-2 sentences).`,
          deadline: `You are ${coachName}. Generate a brief deadline reminder about: "${title}". Emphasize urgency while being supportive. (2-3 sentences).`,
          check_in: `You are ${coachName}. Generate a brief check-in message about: "${title}". Ask about progress and offer to help. (2-3 sentences).`,
        };

        const prompt = TASK_PROMPTS[task.taskType] || TASK_PROMPTS.check_in;

        const result = await client.messages.create({
          model: "claude-haiku-4-5-20250415",
          max_tokens: 200,
          messages: [{ role: "user", content: prompt }],
        });

        const messageText = result.content[0]?.type === 'text' ? result.content[0].text : '';

        if (messageText && task.conversationId) {
          await addMessage(task.conversationId, "assistant", messageText, task.coachKey, null);
        }

        await createNotification({
          orgId: task.orgId,
          userId: task.userId,
          type: 'agent_message',
          title: `${coachName}: ${title}`,
          body: messageText.slice(0, 200),
          conversationId: task.conversationId || undefined,
        });

        if (task.repeatInterval) {
          const intervalMs = parseRepeatInterval(task.repeatInterval);
          if (intervalMs) {
            const nextTrigger = new Date(Date.now() + intervalMs);
            await rescheduleTask(task.id, nextTrigger);
          } else {
            await markTaskTriggered(task.id);
          }
        } else {
          await markTaskTriggered(task.id);
        }

        processed++;
      } catch (err) {
        console.error(`Failed to process task ${task.id}:`, err);
        await markTaskTriggered(task.id);
      }
    }

    return Response.json({ processed, total: dueTasks.length });
  } catch (err) {
    console.error("Heartbeat cron error:", err);
    return Response.json({ error: "Internal error" }, { status: 500 });
  }
}
