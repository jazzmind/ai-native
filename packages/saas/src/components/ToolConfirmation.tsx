"use client";

import { useState } from "react";
import { Shield, Check, X, ChevronDown, ChevronRight, Zap } from "lucide-react";

interface ToolConfirmationProps {
  confirmationId: string;
  coachKey: string;
  coachName: string;
  tool: string;
  input: Record<string, unknown>;
  onConfirm: (id: string, action: "approve" | "approve_all" | "reject", modifiedInput?: Record<string, unknown>) => void;
}

export function ToolConfirmation({
  confirmationId,
  coachName,
  tool,
  input,
  onConfirm,
}: ToolConfirmationProps) {
  const [showParams, setShowParams] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editedInput, setEditedInput] = useState(JSON.stringify(input, null, 2));

  return (
    <div className="border border-yellow-500/40 bg-yellow-950/20 rounded-xl p-4 my-2">
      <div className="flex items-center gap-2 mb-2">
        <Shield size={16} className="text-yellow-400" />
        <span className="text-sm font-medium">Action Confirmation Required</span>
      </div>

      <p className="text-xs text-[var(--text-muted)] mb-2">
        <strong>{coachName}</strong> wants to execute <code className="bg-[#1a1a2e] px-1 py-0.5 rounded text-xs">{tool}</code>
      </p>

      <button
        onClick={() => setShowParams(!showParams)}
        className="flex items-center gap-1 text-[11px] text-[var(--text-muted)] hover:text-[var(--text)] transition-colors mb-2"
      >
        {showParams ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
        Parameters
      </button>

      {showParams && (
        <div className="mb-3">
          {editMode ? (
            <textarea
              value={editedInput}
              onChange={(e) => setEditedInput(e.target.value)}
              className="w-full bg-[#0d0d0d] rounded-lg p-2 text-[10px] font-mono resize-none min-h-[80px] focus:outline-none border border-[var(--border)]"
              rows={5}
            />
          ) : (
            <pre className="bg-[#0d0d0d] rounded-lg p-2 text-[10px] font-mono overflow-x-auto max-h-32 overflow-y-auto">
              {JSON.stringify(input, null, 2)}
            </pre>
          )}
        </div>
      )}

      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => {
            const finalInput = editMode ? JSON.parse(editedInput) : undefined;
            onConfirm(confirmationId, "approve", finalInput);
          }}
          className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs hover:bg-green-700 transition-colors"
        >
          <Check size={12} /> Approve
        </button>
        <button
          onClick={() => onConfirm(confirmationId, "approve_all")}
          className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs hover:bg-blue-700 transition-colors"
          title="Approve this and all remaining actions in this turn"
        >
          <Zap size={12} /> Approve All
        </button>
        <button
          onClick={() => setEditMode(!editMode)}
          className="flex items-center gap-1 px-3 py-1.5 text-[var(--text-muted)] border border-[var(--border)] rounded-lg text-xs hover:text-[var(--text)] transition-colors"
        >
          Modify
        </button>
        <button
          onClick={() => onConfirm(confirmationId, "reject")}
          className="flex items-center gap-1 px-3 py-1.5 bg-red-600/20 text-red-400 rounded-lg text-xs hover:bg-red-600/30 transition-colors"
        >
          <X size={12} /> Reject
        </button>
      </div>
    </div>
  );
}
