import { NextRequest } from 'next/server';
import { getRequiredUser, handleAuthError, isAdmin } from '@/lib/auth';
import { listAllOrganizationsWithStats, getOrgWithMembers, updateOrganization } from '@/lib/db/queries/organizations';

export async function GET(req: NextRequest) {
  try {
    const user = await getRequiredUser();
    if (!isAdmin(user.email)) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const orgId = req.nextUrl.searchParams.get('orgId');

    if (orgId) {
      const org = await getOrgWithMembers(orgId);
      if (!org) return Response.json({ error: 'Not found' }, { status: 404 });
      return Response.json(org);
    }

    const orgs = await listAllOrganizationsWithStats();
    return Response.json({ organizations: orgs });
  } catch (err) {
    return handleAuthError(err);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const user = await getRequiredUser();
    if (!isAdmin(user.email)) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { orgId, plan, subscriptionStatus } = await req.json();
    if (!orgId) {
      return Response.json({ error: 'orgId is required' }, { status: 400 });
    }

    const updates: Record<string, any> = {};
    if (plan && ['free', 'pro', 'team'].includes(plan)) updates.plan = plan;
    if (subscriptionStatus) updates.subscriptionStatus = subscriptionStatus;

    if (Object.keys(updates).length === 0) {
      return Response.json({ error: 'No valid updates provided' }, { status: 400 });
    }

    await updateOrganization(orgId, updates);
    return Response.json({ ok: true });
  } catch (err) {
    return handleAuthError(err);
  }
}
