"use client";

import { useState, useEffect } from "react";
import { Users, UserPlus, Trash2, Mail, Loader2, Crown, Shield, User, Send } from "lucide-react";

interface Member {
  userId: string;
  role: "owner" | "admin" | "member";
  createdAt: string | null;
  isCurrentUser: boolean;
}

interface Invitation {
  id: string;
  email: string;
  role: "admin" | "member";
  invitedBy: string;
  expiresAt: string;
  createdAt: string | null;
}

interface TeamData {
  members: Member[];
  invitations: Invitation[];
  currentUserRole: "owner" | "admin" | "member";
}

const ROLE_ICONS = {
  owner: Crown,
  admin: Shield,
  member: User,
};

const ROLE_LABELS = {
  owner: "Owner",
  admin: "Admin",
  member: "Member",
};

const ROLE_COLORS = {
  owner: "text-amber-400",
  admin: "text-blue-400",
  member: "text-[var(--text-muted)]",
};

export default function TeamSettingsPage() {
  const [data, setData] = useState<TeamData | null>(null);
  const [loading, setLoading] = useState(true);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"admin" | "member">("member");
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteSuccess, setInviteSuccess] = useState<string | null>(null);

  const fetchTeam = async () => {
    try {
      const res = await fetch("/api/settings/team");
      if (!res.ok) throw new Error("Failed to load team");
      setData(await res.json());
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchTeam(); }, []);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setInviteError(null);
    setInviteSuccess(null);
    setInviting(true);
    try {
      const res = await fetch("/api/settings/team/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
      });
      const body = await res.json();
      if (!res.ok) {
        setInviteError(body.error || "Failed to send invitation");
      } else {
        setInviteSuccess(`Invitation sent to ${inviteEmail}`);
        setInviteEmail("");
        fetchTeam();
      }
    } catch {
      setInviteError("Failed to send invitation");
    } finally {
      setInviting(false);
    }
  };

  const handleRemoveMember = async (userId: string) => {
    if (!confirm("Remove this member from the team?")) return;
    await fetch(`/api/settings/team/${userId}`, { method: "DELETE" });
    fetchTeam();
  };

  const handleRevokeInvite = async (invitationId: string) => {
    if (!confirm("Revoke this invitation?")) return;
    await fetch(`/api/settings/team/${invitationId}?type=invitation`, { method: "DELETE" });
    fetchTeam();
  };

  const canManage = data?.currentUserRole === "owner" || data?.currentUserRole === "admin";
  const isOwner = data?.currentUserRole === "owner";

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 size={24} className="animate-spin text-[var(--text-muted)]" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-8">
      <div className="flex items-center gap-2 mb-6">
        <Users size={20} className="text-[var(--accent)]" />
        <div>
          <h2 className="text-lg font-bold text-[var(--text)]">Team Members</h2>
          <p className="text-xs text-[var(--text-muted)]">Manage who has access to your organization</p>
        </div>
      </div>

      {/* Member list */}
      <div className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl mb-6">
        {data?.members.length === 0 ? (
          <div className="text-center py-8 text-sm text-[var(--text-muted)]">No members yet.</div>
        ) : (
          <div className="divide-y divide-[var(--border)]">
            {data?.members.map(member => {
              const RoleIcon = ROLE_ICONS[member.role];
              return (
                <div key={member.userId} className="flex items-center justify-between px-5 py-3.5">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-[var(--bg-tertiary)] border border-[var(--border)] flex items-center justify-center">
                      <User size={14} className="text-[var(--text-muted)]" />
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-[var(--text)]">
                        {member.userId}
                        {member.isCurrentUser && (
                          <span className="ml-2 text-[10px] font-normal text-[var(--text-muted)]">(you)</span>
                        )}
                      </div>
                      {member.createdAt && (
                        <div className="text-[10px] text-[var(--text-muted)]">
                          Joined {new Date(member.createdAt).toLocaleDateString()}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className={`flex items-center gap-1 text-xs font-semibold ${ROLE_COLORS[member.role]}`}>
                      <RoleIcon size={12} />
                      {ROLE_LABELS[member.role]}
                    </div>
                    {isOwner && !member.isCurrentUser && member.role !== 'owner' && (
                      <button
                        onClick={() => handleRemoveMember(member.userId)}
                        className="p-1.5 rounded hover:bg-red-500/10 text-[var(--text-muted)] hover:text-red-400 transition-colors"
                        title="Remove member"
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Pending invitations */}
      {data && data.invitations.length > 0 && (
        <div className="mb-6">
          <h3 className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider mb-3">
            Pending Invitations
          </h3>
          <div className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl divide-y divide-[var(--border)]">
            {data.invitations.map(inv => (
              <div key={inv.id} className="flex items-center justify-between px-5 py-3.5">
                <div className="flex items-center gap-3">
                  <Mail size={14} className="text-[var(--text-muted)]" />
                  <div>
                    <div className="text-sm font-semibold text-[var(--text)]">{inv.email}</div>
                    <div className="text-[10px] text-[var(--text-muted)]">
                      Expires {new Date(inv.expiresAt).toLocaleDateString()} · {ROLE_LABELS[inv.role]}
                    </div>
                  </div>
                </div>
                {canManage && (
                  <button
                    onClick={() => handleRevokeInvite(inv.id)}
                    className="p-1.5 rounded hover:bg-red-500/10 text-[var(--text-muted)] hover:text-red-400 transition-colors"
                    title="Revoke invitation"
                  >
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Invite form — only for owners and admins */}
      {canManage && (
        <div className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <UserPlus size={16} className="text-[var(--accent)]" />
            <h3 className="text-sm font-bold text-[var(--text)]">Invite a team member</h3>
          </div>
          <form onSubmit={handleInvite} className="flex gap-2">
            <input
              type="email"
              value={inviteEmail}
              onChange={e => { setInviteEmail(e.target.value); setInviteError(null); setInviteSuccess(null); }}
              placeholder="colleague@company.com"
              className="flex-1 bg-[var(--bg)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--text)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)]"
              required
            />
            <select
              value={inviteRole}
              onChange={e => setInviteRole(e.target.value as "admin" | "member")}
              className="bg-[var(--bg)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
            >
              <option value="member">Member</option>
              {isOwner && <option value="admin">Admin</option>}
            </select>
            <button
              type="submit"
              disabled={inviting || !inviteEmail}
              className="flex items-center gap-1.5 px-4 py-2 bg-[var(--accent)] text-white text-sm font-semibold rounded-lg disabled:opacity-40 hover:bg-[var(--accent-hover)] transition-colors"
            >
              {inviting ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
              {inviting ? "Sending..." : "Send Invite"}
            </button>
          </form>
          {inviteError && (
            <p className="mt-2 text-xs text-red-400">{inviteError}</p>
          )}
          {inviteSuccess && (
            <p className="mt-2 text-xs text-emerald-400">{inviteSuccess}</p>
          )}
        </div>
      )}

      {!canManage && (
        <div className="text-center py-4 text-sm text-[var(--text-muted)]">
          Only owners and admins can invite new members.
        </div>
      )}
    </div>
  );
}
