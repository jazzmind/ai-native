import Anthropic from "@anthropic-ai/sdk";
import {
  getFeedbackStats,
  getRecentNegativeFeedback,
  getActiveBehaviors,
  createRevision,
  listRevisions,
  getMessages,
} from "./db";
import { COACH_META } from "./coaches";

let _client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!_client) {
    _client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return _client;
}

interface AnalysisResult {
  shouldPropose: boolean;
  coachKey: string;
  analysis?: string;
  proposedDirective?: string;
  feedbackIds?: string[];
}

export async function checkAndProposeBehaviorRevisions(
  userId: string,
  projectId: string
): Promise<AnalysisResult[]> {
  const results: AnalysisResult[] = [];

  for (const coach of COACH_META) {
    const result = await analyzeCoachFeedback(userId, projectId, coach.key);
    if (result.shouldPropose) {
      results.push(result);
    }
  }

  return results;
}

async function analyzeCoachFeedback(
  userId: string,
  projectId: string,
  coachKey: string
): Promise<AnalysisResult> {
  const noProposal: AnalysisResult = { shouldPropose: false, coachKey };

  const pendingRevisions = await listRevisions(userId, projectId, "proposed");
  if (pendingRevisions.some((r) => r.coach_key === coachKey)) {
    return noProposal;
  }

  const recentDown = await getRecentNegativeFeedback(userId, coachKey, projectId, 20);
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const recentSevenDays = recentDown.filter((f) => f.created_at >= sevenDaysAgo);

  const stats = await getFeedbackStats(userId, projectId, coachKey);
  const negativeRate = stats.total > 0 ? stats.down / stats.total : 0;

  const threshold1 = recentSevenDays.length >= 3;
  const threshold2 = stats.total >= 5 && negativeRate > 0.3;

  if (!threshold1 && !threshold2) {
    return noProposal;
  }

  const negativeFeedback = recentDown.slice(0, 10);
  const feedbackIds = negativeFeedback.map((f) => f.id);

  const messageContexts: string[] = [];
  for (const fb of negativeFeedback) {
    const messages = await getMessages(fb.conversation_id);
    const targetMsg = messages.find((m) => m.id === fb.message_id);
    const prevUserMsg = messages
      .filter((m) => m.role === "user" && m.id < fb.message_id)
      .pop();

    if (targetMsg) {
      let ctx = "";
      if (prevUserMsg) ctx += `User asked: "${prevUserMsg.content.slice(0, 200)}"\n`;
      ctx += `${coachKey} responded: "${targetMsg.content.slice(0, 300)}"`;
      if (fb.comment) ctx += `\nUser feedback: "${fb.comment}"`;
      if (fb.mode) ctx += `\nMode: ${fb.mode}`;
      messageContexts.push(ctx);
    }
  }

  if (messageContexts.length === 0) {
    return noProposal;
  }

  const currentBehaviors = await getActiveBehaviors(userId, projectId, coachKey);
  const behaviorText = currentBehaviors.length > 0
    ? currentBehaviors.map((b) => `- ${b.directive}`).join("\n")
    : "None currently set.";

  const coachName = COACH_META.find((c) => c.key === coachKey)?.name || coachKey;

  try {
    const client = getClient();
    const response = await client.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 500,
      system: `You analyze patterns in negative user feedback for an AI advisor called "${coachName}" and propose specific behavioral adjustments.

Respond with ONLY valid JSON (no markdown):
{"analysis": "2-3 sentence description of the pattern", "directive": "A specific behavioral instruction to address the issues"}

The directive should be:
- Specific and actionable (not vague like "be better")
- Written as an instruction to the advisor
- Addressing the root cause pattern, not individual symptoms`,
      messages: [{
        role: "user",
        content: `The user has given ${recentSevenDays.length} thumbs-down in the last 7 days (${stats.down}/${stats.total} total, ${Math.round(negativeRate * 100)}% negative rate).

Current behavioral directives:
${behaviorText}

Messages that received negative feedback:
${messageContexts.map((c, i) => `\n--- Example ${i + 1} ---\n${c}`).join("\n")}

Analyze the pattern and propose a behavioral directive.`,
      }],
    });

    const text = response.content[0].type === "text" ? response.content[0].text : "";
    const parsed = JSON.parse(text);

    if (parsed.analysis && parsed.directive) {
      await createRevision(
        coachKey,
        projectId,
        userId,
        parsed.analysis,
        parsed.directive,
        feedbackIds
      );

      return {
        shouldPropose: true,
        coachKey,
        analysis: parsed.analysis,
        proposedDirective: parsed.directive,
        feedbackIds,
      };
    }
  } catch {
    // AI analysis failed, skip
  }

  return noProposal;
}
