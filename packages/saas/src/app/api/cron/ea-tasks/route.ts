import { NextRequest } from "next/server";
import { getDueTasks, markTaskTriggered, rescheduleTask, createNotification } from "@/lib/db";
import { executeBriefingTask, executeCollectionTask } from "@/lib/task-executor";

export const runtime = "nodejs";

function parseRepeatInterval(interval: string): number | null {
  const match = interval.match(/^(\d+)([mhdw])$/);
  if (!match) return null;
  const amount = parseInt(match[1]);
  const units: Record<string, number> = {
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
    w: 7 * 24 * 60 * 60 * 1000,
  };
  return amount * (units[match[2]] ?? units.d);
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const dueTasks = await getDueTasks();
  const eaTasks = dueTasks.filter(
    (t) => t.coachKey === "ea" || t.taskType === "status_report_collection" || t.taskType === "ea_briefing"
  );

  let processed = 0;
  let rescheduled = 0;
  const errors: string[] = [];

  for (const task of eaTasks) {
    try {
      const context = (task.context ?? {}) as Record<string, unknown>;
      const title = (context.title as string) ?? task.taskType;

      // userId is the user's email in this system
      const userEmail = task.userId;

      if (task.taskType === "ea_briefing") {
        await executeBriefingTask(
          { id: task.id, orgId: task.orgId, userId: task.userId, projectId: task.projectId, taskType: task.taskType, context: context, conversationId: task.conversationId },
          userEmail
        );
      } else if (task.taskType === "status_report_collection") {
        await executeCollectionTask(
          { id: task.id, orgId: task.orgId, userId: task.userId, projectId: task.projectId, taskType: task.taskType, context: context, conversationId: task.conversationId },
          userEmail
        );
      } else {
        // Other task types: fall back to in-app notification
        await createNotification({
          orgId: task.orgId,
          userId: task.userId,
          type: "agent_message",
          title: `Chief of Staff: ${title}`,
          body: `Reminder: ${title}`,
          conversationId: task.conversationId ?? undefined,
        });
      }

      await markTaskTriggered(task.id);
      processed++;

      if (task.repeatInterval) {
        const ms = parseRepeatInterval(task.repeatInterval);
        if (ms) {
          await rescheduleTask(task.id, new Date(Date.now() + ms));
          rescheduled++;
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`ea-tasks cron: failed to process task ${task.id}:`, err);
      errors.push(`task ${task.id}: ${msg}`);
    }
  }

  return Response.json({ ok: true, processed, rescheduled, errors });
}
