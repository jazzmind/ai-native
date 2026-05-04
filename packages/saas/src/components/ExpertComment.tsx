"use client";

import { UserCheck } from "lucide-react";

interface ExpertCommentProps {
  authorEmail: string;
  authorName: string | null;
  content: string;
  createdAt: string;
}

export function ExpertCommentDisplay({ authorName, authorEmail, content, createdAt }: ExpertCommentProps) {
  const displayName = authorName || authorEmail;

  return (
    <div className="flex justify-start mb-4">
      <div className="max-w-[80%]">
        <div className="flex items-center gap-1.5 text-xs text-[var(--text-muted)] mb-1 ml-1">
          <UserCheck size={12} className="text-purple-400" />
          <span className="text-purple-400 font-medium">{displayName}</span>
          <span className="text-[10px] bg-purple-500/20 text-purple-400 px-1.5 py-0.5 rounded-full font-medium">
            Expert
          </span>
          <span className="text-[10px]">
            {new Date(createdAt).toLocaleString()}
          </span>
        </div>
        <div className="bg-purple-950/20 border border-purple-500/30 rounded-2xl rounded-bl-sm px-4 py-3 text-sm">
          {content}
        </div>
      </div>
    </div>
  );
}
