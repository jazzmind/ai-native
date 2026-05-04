import { Resend } from 'resend';

let _resend: Resend | null = null;

function getResend(): Resend {
  if (!_resend) {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) throw new Error('RESEND_API_KEY environment variable is not set');
    _resend = new Resend(apiKey);
  }
  return _resend;
}

export async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  const resend = getResend();
  const from = process.env.RESEND_FROM_EMAIL || process.env.EMAIL_FROM || 'EA <ea@notifications.busibox.ai>';

  const { error } = await resend.emails.send({ from, to, subject, html });
  if (error) throw new Error(`Failed to send email: ${error.message}`);
}

/** Strip markdown syntax and collapse whitespace for use in plain-text previews. */
export function stripMarkdownForPreview(text: string, maxChars = 500): string {
  return text
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/`[^`]+`/g, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/^\s*[-*+]\s+/gm, "• ")
    .replace(/^\s*\d+\.\s+/gm, "")
    .replace(/^---+$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, maxChars) + (text.length > maxChars ? "…" : "");
}

/**
 * Convert markdown to inline-styled HTML suitable for email clients.
 * Email clients strip <style> blocks, so every element must carry its own style="".
 */
export function markdownToEmailHtml(md: string): string {
  // Escape HTML entities in a string (used for code blocks before other transforms)
  const esc = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  // Process fenced code blocks first so their contents aren't touched by inline rules
  const codeBlocks: string[] = [];
  let text = md.replace(/```[\w]*\n([\s\S]*?)```/g, (_, code) => {
    const idx = codeBlocks.push(
      `<pre style="background:#1e1e2e;border:1px solid #333;border-radius:6px;padding:12px 16px;margin:16px 0;overflow-x:auto;font-family:'Courier New',Courier,monospace;font-size:13px;line-height:1.5;color:#cdd6f4"><code>${esc(code.trimEnd())}</code></pre>`
    ) - 1;
    return `\x00CODE${idx}\x00`;
  });

  // Escape HTML entities in remaining text (after code-block placeholders are extracted)
  // so that user/LLM content cannot inject arbitrary HTML. Inline markdown transforms
  // below produce trusted HTML tags on top of this pre-escaped text.
  text = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  // Inline code (esc() applied to captured code before transform)
  text = text.replace(/`([^`]+)`/g, (_, code) =>
    `<code style="background:#2a2a3a;border:1px solid #3a3a4a;border-radius:4px;padding:1px 5px;font-family:'Courier New',Courier,monospace;font-size:13px;color:#cba6f7">${code}</code>`
  );

  // Bold + italic together (***text***)
  text = text.replace(/\*\*\*(.+?)\*\*\*/g, '<strong style="font-weight:700"><em style="font-style:italic">$1</em></strong>');
  // Bold
  text = text.replace(/\*\*(.+?)\*\*/g, '<strong style="font-weight:700">$1</strong>');
  // Italic
  text = text.replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, '<em style="font-style:italic">$1</em>');

  // Links — sanitize href to only allow http/https/mailto.
  // Display text is already HTML-escaped from the pass above.
  text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, linkText, href) => {
    const rawHref = href.trim().replace(/&amp;/g, '&'); // restore for URL parse
    const safeHref = /^(https?:|mailto:)/i.test(rawHref) ? esc(rawHref) : '#';
    return `<a href="${safeHref}" style="color:#7c3aed;text-decoration:underline">${linkText}</a>`;
  });

  // HR
  text = text.replace(/^---+$/gm, '<hr style="border:none;border-top:1px solid #2a2a2a;margin:24px 0">');

  // Process line by line for headings, lists, paragraphs
  const lines = text.split('\n');
  const htmlLines: string[] = [];
  let inUl = false;
  let inOl = false;
  let listCount = 0;

  const closeList = () => {
    if (inUl) { htmlLines.push('</ul>'); inUl = false; }
    if (inOl) { htmlLines.push('</ol>'); inOl = false; }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Headings (text already pre-escaped above)
    const h1 = line.match(/^# (.+)/);
    const h2 = line.match(/^## (.+)/);
    const h3 = line.match(/^### (.+)/);
    const h4 = line.match(/^#### (.+)/);
    if (h1) { closeList(); htmlLines.push(`<h1 style="font-size:22px;font-weight:700;color:#f5f5f5;margin:28px 0 8px;padding-bottom:6px;border-bottom:1px solid #2a2a2a">${h1[1]}</h1>`); continue; }
    if (h2) { closeList(); htmlLines.push(`<h2 style="font-size:18px;font-weight:600;color:#f5f5f5;margin:24px 0 8px;padding-bottom:4px;border-bottom:1px solid #2a2a2a">${h2[1]}</h2>`); continue; }
    if (h3) { closeList(); htmlLines.push(`<h3 style="font-size:16px;font-weight:600;color:#e5e5e5;margin:20px 0 6px">${h3[1]}</h3>`); continue; }
    if (h4) { closeList(); htmlLines.push(`<h4 style="font-size:14px;font-weight:600;color:#d4d4d4;margin:16px 0 4px">${h4[1]}</h4>`); continue; }

    // Unordered list item
    const ulItem = line.match(/^\s*[-*+]\s+(.+)/);
    if (ulItem) {
      if (inOl) { htmlLines.push('</ol>'); inOl = false; }
      if (!inUl) { htmlLines.push('<ul style="margin:8px 0 8px 0;padding-left:20px;color:#d4d4d4">'); inUl = true; }
      htmlLines.push(`<li style="font-size:14px;line-height:1.7;margin:4px 0;color:#d4d4d4">${ulItem[1]}</li>`);
      continue;
    }

    // Ordered list item
    const olItem = line.match(/^\s*\d+\.\s+(.+)/);
    if (olItem) {
      if (inUl) { htmlLines.push('</ul>'); inUl = false; }
      if (!inOl) { listCount = 1; htmlLines.push('<ol style="margin:8px 0 8px 0;padding-left:20px;color:#d4d4d4">'); inOl = true; }
      htmlLines.push(`<li style="font-size:14px;line-height:1.7;margin:4px 0;color:#d4d4d4">${olItem[1]}</li>`);
      listCount++;
      continue;
    }

    // Empty line closes lists
    if (line.trim() === '') {
      closeList();
      htmlLines.push('');
      continue;
    }

    // Code block placeholder
    if (line.includes('\x00CODE')) {
      closeList();
      htmlLines.push(line);
      continue;
    }

    // HR line (already converted above, just pass through)
    if (line.startsWith('<hr ')) {
      closeList();
      htmlLines.push(line);
      continue;
    }

    // Regular paragraph text (pre-escaped)
    closeList();
    htmlLines.push(`<p style="font-size:14px;line-height:1.75;color:#d4d4d4;margin:10px 0">${line}</p>`);
  }

  closeList();

  // Re-join and restore code blocks
  let result = htmlLines.join('\n');
  codeBlocks.forEach((block, idx) => {
    result = result.replace(`\x00CODE${idx}\x00`, block);
  });

  return result;
}

export function artifactEmailHtml(opts: {
  title: string;
  content: string;       // full markdown content
  artifactUrl: string;
  runNumber: number;
  date: string;
}): string {
  const bodyHtml = markdownToEmailHtml(opts.content);
  const escHtml = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="dark">
</head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;background:#0f0f0f;color:#e5e5e5;margin:0;padding:0">
  <div style="max-width:640px;margin:40px auto;padding:0 16px">
    <!-- Header -->
    <div style="background:#7c3aed;border-radius:12px 12px 0 0;padding:24px 32px">
      <h1 style="margin:0;font-size:20px;font-weight:700;color:#fff;line-height:1.3">${escHtml(opts.title)}</h1>
      <p style="margin:6px 0 0;font-size:13px;color:#ddd6fe">Run #${escHtml(String(opts.runNumber))} &nbsp;·&nbsp; ${escHtml(opts.date)}</p>
    </div>

    <!-- Body -->
    <div style="background:#1a1a1a;border:1px solid #2a2a2a;border-top:none;padding:32px">
      ${bodyHtml}
    </div>

    <!-- CTA -->
    <div style="background:#141414;border:1px solid #2a2a2a;border-top:none;padding:24px 32px;text-align:center">
      <a href="${escHtml(opts.artifactUrl)}"
         style="display:inline-block;background:#7c3aed;color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-size:14px;font-weight:600;letter-spacing:0.01em">
        Open in app →
      </a>
    </div>

    <!-- Footer -->
    <div style="padding:16px 0;text-align:center;font-size:12px;color:#525252">
      Delivered by your Chief of Staff &nbsp;·&nbsp;
      <a href="${escHtml(opts.artifactUrl)}" style="color:#7c3aed;text-decoration:none">View in app</a>
    </div>
  </div>
</body>
</html>`;
}

export function collectionEmailHtml(opts: {
  title: string;
  description: string;
  collectUrl: string;
  expiresAt: string;
}): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#0f0f0f;color:#e5e5e5;margin:0;padding:0">
  <div style="max-width:600px;margin:40px auto;background:#1a1a1a;border-radius:12px;overflow:hidden;border:1px solid #2a2a2a">
    <div style="background:#0f766e;padding:24px 32px">
      <h1 style="margin:0;font-size:20px;font-weight:600;color:#fff">${opts.title}</h1>
      <p style="margin:4px 0 0;font-size:13px;color:#99f6e4">Your input is needed</p>
    </div>
    <div style="padding:32px">
      <p style="margin:0 0 24px;color:#a3a3a3;font-size:14px;line-height:1.6">${opts.description}</p>
      <a href="${opts.collectUrl}" style="display:inline-block;background:#0f766e;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-size:14px;font-weight:500">Provide Updates →</a>
    </div>
    <div style="padding:16px 32px;border-top:1px solid #2a2a2a;font-size:12px;color:#525252">
      This link expires on ${opts.expiresAt} · Delivered by your Chief of Staff
    </div>
  </div>
</body>
</html>`;
}
