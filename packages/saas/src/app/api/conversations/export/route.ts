import { NextRequest } from "next/server";
import {
  Document,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  BorderStyle,
  Packer,
} from "docx";
import { getConversation, getMessages, type Message } from "@/lib/db";
import { getRequiredUser, handleAuthError } from "@/lib/auth";

const COACH_LABELS: Record<string, string> = {
  founder: "Founder Advisor",
  strategy: "Strategy Advisor",
  funding: "Funding Advisor",
  finance: "Finance Advisor",
  legal: "Legal Advisor",
  growth: "Growth Advisor",
  technology: "Technology Advisor",
  synthesis: "Synthesis",
  "qa-judge": "QA Judge",
};

function coachLabel(key: string | null): string {
  if (!key) return "Advisor";
  return COACH_LABELS[key] || key;
}

function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function buildMarkdown(title: string, messages: Message[]): string {
  const lines: string[] = [];
  lines.push(`# ${title}\n`);
  lines.push(`_Exported ${new Date().toISOString()}_\n`);
  lines.push("---\n");

  for (const msg of messages) {
    if (msg.role === "user") {
      lines.push(`## You\n`);
      lines.push(`_${formatTimestamp(msg.created_at)}_\n`);
      lines.push(msg.content);
      lines.push("");
    } else if (msg.role === "assistant") {
      const label = coachLabel(msg.coach_key);
      const synthTag = msg.coach_key === "synthesis" ? " (Synthesis)" : "";
      const modeTag = msg.mode ? ` [${msg.mode}]` : "";
      lines.push(`## ${label}${synthTag}${modeTag}\n`);
      lines.push(`_${formatTimestamp(msg.created_at)}_\n`);
      lines.push(msg.content);
      lines.push("");
    }
    lines.push("---\n");
  }

  return lines.join("\n");
}

function buildHtml(title: string, messages: Message[]): string {
  const escHtml = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  const msgBlocks = messages
    .map((msg) => {
      if (msg.role === "user") {
        return `
      <div class="message user">
        <div class="header">You <span class="time">${formatTimestamp(msg.created_at)}</span></div>
        <div class="content">${escHtml(msg.content)}</div>
      </div>`;
      } else if (msg.role === "assistant") {
        const label = coachLabel(msg.coach_key);
        const cls = msg.coach_key === "synthesis" ? "synthesis" : "advisor";
        const mode = msg.mode ? ` <span class="mode">[${escHtml(msg.mode)}]</span>` : "";
        return `
      <div class="message ${cls}">
        <div class="header">${escHtml(label)}${mode} <span class="time">${formatTimestamp(msg.created_at)}</span></div>
        <div class="content">${escHtml(msg.content)}</div>
      </div>`;
      }
      return "";
    })
    .join("\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escHtml(title)}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; max-width: 800px; margin: 0 auto; padding: 2rem; background: #f9fafb; color: #1f2937; }
    h1 { margin-bottom: 0.5rem; }
    .meta { color: #6b7280; font-size: 0.875rem; margin-bottom: 1.5rem; }
    .message { border: 1px solid #e5e7eb; border-radius: 12px; padding: 1rem; margin-bottom: 1rem; background: #fff; }
    .message.user { background: #eff6ff; border-color: #bfdbfe; }
    .message.synthesis { background: #fefce8; border-color: #fde68a; }
    .header { font-weight: 600; margin-bottom: 0.5rem; font-size: 0.875rem; }
    .time { color: #9ca3af; font-weight: 400; font-size: 0.75rem; }
    .mode { color: #6b7280; font-size: 0.75rem; }
    .content { white-space: pre-wrap; font-size: 0.875rem; line-height: 1.6; }
  </style>
</head>
<body>
  <h1>${escHtml(title)}</h1>
  <p class="meta">Exported ${new Date().toISOString()}</p>
  ${msgBlocks}
</body>
</html>`;
}

function buildDocxParagraphs(messages: Message[]): Paragraph[] {
  const paragraphs: Paragraph[] = [];

  for (const msg of messages) {
    if (msg.role === "user") {
      paragraphs.push(
        new Paragraph({
          children: [
            new TextRun({ text: "You", bold: true, size: 24 }),
            new TextRun({ text: `  ${formatTimestamp(msg.created_at)}`, color: "999999", size: 18 }),
          ],
          spacing: { before: 300 },
        })
      );
      for (const line of msg.content.split("\n")) {
        paragraphs.push(new Paragraph({ children: [new TextRun({ text: line, size: 22 })] }));
      }
      paragraphs.push(
        new Paragraph({
          border: { bottom: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" } },
          spacing: { after: 200 },
        })
      );
    } else if (msg.role === "assistant") {
      const label = coachLabel(msg.coach_key);
      const modeText = msg.mode ? ` [${msg.mode}]` : "";
      paragraphs.push(
        new Paragraph({
          children: [
            new TextRun({
              text: `${label}${modeText}`,
              bold: true,
              size: 24,
              color: msg.coach_key === "synthesis" ? "B45309" : "2563EB",
            }),
            new TextRun({ text: `  ${formatTimestamp(msg.created_at)}`, color: "999999", size: 18 }),
          ],
          spacing: { before: 300 },
        })
      );
      for (const line of msg.content.split("\n")) {
        if (line.startsWith("# ")) {
          paragraphs.push(new Paragraph({ text: line.slice(2), heading: HeadingLevel.HEADING_2 }));
        } else if (line.startsWith("## ")) {
          paragraphs.push(new Paragraph({ text: line.slice(3), heading: HeadingLevel.HEADING_3 }));
        } else if (line.startsWith("- ") || line.startsWith("* ")) {
          paragraphs.push(
            new Paragraph({
              children: [new TextRun({ text: line.slice(2), size: 22 })],
              bullet: { level: 0 },
            })
          );
        } else {
          paragraphs.push(new Paragraph({ children: [new TextRun({ text: line, size: 22 })] }));
        }
      }
      paragraphs.push(
        new Paragraph({
          border: { bottom: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" } },
          spacing: { after: 200 },
        })
      );
    }
  }

  return paragraphs;
}

export async function POST(req: NextRequest) {
  let user;
  try {
    user = await getRequiredUser();
  } catch (err) {
    return handleAuthError(err);
  }

  const { conversationId, format } = (await req.json()) as {
    conversationId: string;
    format: "markdown" | "html" | "docx";
  };

  if (!conversationId || !format) {
    return Response.json({ error: "conversationId and format are required" }, { status: 400 });
  }

  const conversation = await getConversation(conversationId, user.id);
  if (!conversation) {
    return Response.json({ error: "Conversation not found" }, { status: 404 });
  }

  const messages = await getMessages(conversationId);
  const title = conversation.title || "Conversation";
  const safeTitle = title.replace(/[^a-zA-Z0-9-_ ]/g, "").slice(0, 60);

  if (format === "markdown") {
    const md = buildMarkdown(title, messages);
    return new Response(md, {
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Content-Disposition": `attachment; filename="${safeTitle}.md"`,
      },
    });
  }

  if (format === "html") {
    const html = buildHtml(title, messages);
    return new Response(html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Content-Disposition": `attachment; filename="${safeTitle}.html"`,
      },
    });
  }

  if (format === "docx") {
    const doc = new Document({
      sections: [
        {
          properties: {},
          children: [
            new Paragraph({
              text: title,
              heading: HeadingLevel.HEADING_1,
              alignment: AlignmentType.LEFT,
            }),
            new Paragraph({
              children: [
                new TextRun({ text: `Exported ${new Date().toISOString()}`, color: "999999", size: 18 }),
              ],
              spacing: { after: 400 },
            }),
            ...buildDocxParagraphs(messages),
          ],
        },
      ],
    });

    const buffer = await Packer.toBuffer(doc);
    const arrayBuf = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer;
    return new Response(arrayBuf, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${safeTitle}.docx"`,
      },
    });
  }

  return Response.json({ error: "Invalid format" }, { status: 400 });
}
