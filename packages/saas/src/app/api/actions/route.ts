import { NextRequest } from "next/server";
import { getRequiredUser, handleAuthError } from "@/lib/auth";
import {
  listAgentTasksForUser,
  dismissTask,
  countArtifactsForTask,
  getLatestArtifactForTask,
  updateAgentTask,
  getAgentTask,
  markTaskTriggered,
  rescheduleTask,
} from "@/lib/db";
import { executeBriefingTask, executeCollectionTask } from "@/lib/task-executor";
import { sendEmail, artifactEmailHtml } from "@/lib/email";

const BASE_URL =
  process.env.APP_URL ||
  process.env.NEXT_PUBLIC_APP_URL ||
  process.env.NEXTAUTH_URL ||
  "http://localhost:3000";

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
  let user;
  try {
    user = await getRequiredUser();
  } catch (err) {
    return handleAuthError(err);
  }

  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get("projectId");
  if (!projectId) {
    return Response.json({ error: "projectId is required" }, { status: 400 });
  }

  const tasks = await listAgentTasksForUser(user.id, projectId);

  // Enrich briefing/status tasks with artifact counts
  const enriched = await Promise.all(
    tasks.map(async (task) => {
      if (task.taskType === "ea_briefing" || task.taskType === "status_report_collection") {
        const [count, latest] = await Promise.all([
          countArtifactsForTask(task.id),
          getLatestArtifactForTask(task.id),
        ]);
        return { ...task, artifactCount: count, latestArtifactId: latest?.id ?? null };
      }
      return task;
    })
  );

  return Response.json({ tasks: enriched });
}

export async function POST(req: NextRequest) {
  let user;
  try {
    user = await getRequiredUser();
  } catch (err) {
    return handleAuthError(err);
  }

  const body = await req.json();
  const { action, taskId } = body;

  if (!taskId) {
    return Response.json({ error: "taskId is required" }, { status: 400 });
  }

  if (action === "dismiss") {
    await dismissTask(taskId, user.id);
    return Response.json({ ok: true });
  }

  if (action === "update") {
    const { title, repeatInterval, triggerAt, context } = body;
    await updateAgentTask(taskId, user.id, {
      title,
      repeatInterval: repeatInterval !== undefined ? repeatInterval : undefined,
      triggerAt: triggerAt ? new Date(triggerAt) : undefined,
      context,
    });
    return Response.json({ ok: true });
  }

  if (action === "run") {
    // Manually trigger a task run immediately
    const task = await getAgentTask(taskId, user.id);
    if (!task) {
      return Response.json({ error: "Task not found" }, { status: 404 });
    }

    const context = (task.context ?? {}) as Record<string, unknown>;
    const dueTask = {
      id: task.id,
      orgId: task.orgId,
      userId: task.userId,
      projectId: task.projectId,
      taskType: task.taskType,
      context,
      conversationId: task.conversationId,
    };

    try {
      if (task.taskType === "ea_briefing") {
        await executeBriefingTask(dueTask, user.email);
      } else if (task.taskType === "status_report_collection") {
        await executeCollectionTask(dueTask, user.email);
      } else {
        return Response.json({ error: `Manual run not supported for task type: ${task.taskType}` }, { status: 400 });
      }

      await markTaskTriggered(task.id);

      // If recurring, reschedule from now
      if (task.repeatInterval) {
        const ms = parseRepeatInterval(task.repeatInterval);
        if (ms) {
          await rescheduleTask(task.id, new Date(Date.now() + ms));
        }
      }

      return Response.json({ ok: true });
    } catch (err: any) {
      return Response.json({ ok: false, error: err.message }, { status: 500 });
    }
  }

  if (action === "resend") {
    // Re-send the email for the latest artifact without re-running the task
    const artifact = await getLatestArtifactForTask(taskId);
    if (!artifact) {
      return Response.json({ error: "No artifact found for this task" }, { status: 404 });
    }
    const artifactUrl = `${BASE_URL}/artifacts/${artifact.id}`;
    const date = new Date(artifact.createdAt ?? Date.now()).toLocaleDateString("en-US", {
      weekday: "long", year: "numeric", month: "long", day: "numeric",
    });
    await sendEmail(
      user.email,
      `${artifact.title} — ${date}`,
      artifactEmailHtml({ title: artifact.title, content: artifact.content, artifactUrl, runNumber: artifact.runNumber, date }),
    );
    return Response.json({ ok: true });
  }

  return Response.json({ error: "Invalid action" }, { status: 400 });
}
