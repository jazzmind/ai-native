# Team Features — Future Plan

This document outlines planned team/multi-user functionality for AIdvisory. The database schema already supports the foundation (organizations, memberships with roles), but none of the team UX is implemented yet.

## Schema Foundation (already in place)

- `organizations` — each account is an org with `name`, `companyName`, `slug`, `plan`
- `org_memberships` — links users to orgs with `role` enum (`owner`, `admin`, `member`)
- All data tables (`conversations`, `messages`, `projects`, `user_api_keys`, etc.) are scoped by `orgId`

## Planned Features

### 1. Invite Members by Email
- Owner/admin can invite team members by email address
- Invitee receives an email with a join link
- Pending invitations stored in a new `org_invitations` table
- Invite auto-expires after 7 days
- Rate-limited to prevent abuse

### 2. Role-Based Access Control
- **Owner**: Full control — billing, member management, delete org
- **Admin**: Manage members (invite/remove), manage all projects and settings
- **Member**: Access shared projects, create own projects, use advisors
- Role displayed in UI, changeable by owner/admin

### 3. Shared Projects
- Projects within an org are visible to all org members by default
- Optional "private" flag for personal projects not shared with the team
- Project-level permissions (view/edit) for fine-grained control (future)

### 4. Shared Conversations
- Conversations within org-scoped projects are accessible to all org members
- Members can see each other's chat history for shared projects
- Attribution: each message shows which team member sent it

### 5. API Key Management
- **Per-member keys**: Each member can bring their own API key (current behavior)
- **Org-level key**: Owner can set an org-wide API key that all members share
- Org key takes precedence over member keys when set
- Key usage tracked per-member for accountability

### 6. Team Billing
- Org-level Stripe subscription replaces per-user billing
- Seat-based pricing: base fee + per-seat cost
- Owner manages billing, can view invoices
- Usage dashboard shows per-member usage within the org

### 7. Activity Feed
- Dashboard widget showing recent team activity
- Events: new conversations, projects created, expert reviews requested
- Filterable by member, project, time range
- Helps team leads monitor advisor usage

### 8. Team Settings Page
- `/settings/team` — manage members, roles, invitations
- `/settings/team/billing` — org-level billing management
- Accessible only to owner/admin roles

## Implementation Order (suggested)

1. Invite flow + pending invitations table
2. Role-based access checks in API routes
3. Shared projects visibility
4. Shared conversations
5. Org-level API key
6. Team billing migration
7. Activity feed
8. Team settings pages

## Schema Changes Needed

```sql
-- New table for invitations
CREATE TABLE org_invitations (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizations(id),
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member',
  invited_by TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMP NOT NULL,
  accepted_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Add visibility to projects
ALTER TABLE projects ADD COLUMN visibility TEXT DEFAULT 'shared'; -- 'shared' | 'private'

-- Add org-level API key
ALTER TABLE organizations ADD COLUMN org_api_key_encrypted TEXT;
ALTER TABLE organizations ADD COLUMN org_api_key_hint TEXT;
```
