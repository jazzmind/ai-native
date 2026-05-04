"use client";

interface Conversation {
  id: string;
  title: string;
  updated_at: string;
}

interface SidebarProps {
  conversations: Conversation[];
  activeId: string | null;
  onSelect: (id: string) => void;
}

export function Sidebar({ conversations, activeId, onSelect }: SidebarProps) {
  return (
    <div className="w-56 h-full bg-[var(--bg-secondary)] border-r border-[var(--border)] flex flex-col">
      <div className="flex-1 overflow-y-auto scrollbar-thin p-2">
        {conversations.map((conv) => (
          <button
            key={conv.id}
            onClick={() => onSelect(conv.id)}
            className={`w-full text-left px-3 py-2 rounded-lg text-sm mb-1 truncate transition-colors ${
              activeId === conv.id
                ? "bg-[var(--bg-tertiary)] text-[var(--text)]"
                : "text-[var(--text-muted)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text)]"
            }`}
          >
            {conv.title}
          </button>
        ))}
        {conversations.length === 0 && (
          <p className="text-[var(--text-muted)] text-xs text-center mt-4">
            No conversations yet
          </p>
        )}
      </div>
    </div>
  );
}
