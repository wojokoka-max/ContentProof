import type { InputMode } from './types';
import type { AccountAccess } from './auth';
import { getDatabase, isDatabaseConfigured } from './db';

export type AccessPlan = 'guest' | 'free' | 'premium' | 'admin';

export interface UsageStatus {
  plan: AccessPlan;
  remaining: number | null;
  limit: number | null;
  canUseAdvancedModes: boolean;
  canSaveHistory: boolean;
  canExport: boolean;
}

export interface QuotaReservation extends UsageStatus {
  allowed: boolean;
  subjectId: string;
  reason: string | null;
}

interface QuotaRow {
  allowed: boolean;
  remaining: number | null;
  limit_value: number | null;
  reason: string | null;
}

interface BucketRow {
  bucket_key: string;
  used: number;
  limit_value: number;
  created_at: string;
}

export function resolvePlan(access: AccountAccess): AccessPlan {
  if (access.isAdmin) return 'admin';
  if (access.isPremium) return 'premium';
  if (access.signedIn) return 'free';
  return 'guest';
}

export function planFeatures(plan: AccessPlan): Pick<
  UsageStatus,
  'canUseAdvancedModes' | 'canSaveHistory' | 'canExport'
> {
  const premium = plan === 'premium' || plan === 'admin';
  return {
    canUseAdvancedModes: premium,
    canSaveHistory: premium,
    canExport: premium,
  };
}

export async function getUsageStatus(
  access: AccountAccess,
  guestId?: string
): Promise<UsageStatus> {
  const plan = resolvePlan(access);
  const features = planFeatures(plan);

  if (plan === 'admin') {
    return { ...features, plan, remaining: null, limit: null };
  }

  const fallbackLimit = plan === 'premium' ? 30 : plan === 'free' ? 3 : 1;
  if (!isDatabaseConfigured()) {
    return { ...features, plan, remaining: fallbackLimit, limit: fallbackLimit };
  }

  if (plan === 'guest' && !guestId) {
    return { ...features, plan, remaining: 1, limit: 1 };
  }

  const subjectId = access.userId ?? `guest:${guestId}`;
  const sql = getDatabase();
  const rows = await sql`
    SELECT bucket_key, used, limit_value, created_at
    FROM analysis_quota_buckets
    WHERE subject_id = ${subjectId}
    ORDER BY created_at ASC
  ` as BucketRow[];

  if (plan === 'guest') {
    const bucket = rows.find(row => row.bucket_key === 'guest:lifetime');
    return { ...features, plan, remaining: Math.max(1 - (bucket?.used ?? 0), 0), limit: 1 };
  }

  const monthKey = new Date().toISOString().slice(0, 7);
  if (plan === 'premium') {
    const bucket = rows.find(row => row.bucket_key === `premium:${monthKey}`);
    return { ...features, plan, remaining: Math.max(30 - (bucket?.used ?? 0), 0), limit: 30 };
  }

  const starter = rows.find(row => row.bucket_key === 'free:starter');
  if (!starter || starter.used < 3) {
    return { ...features, plan, remaining: Math.max(3 - (starter?.used ?? 0), 0), limit: 3 };
  }

  const starterMonth = starter.created_at.slice(0, 7);
  if (monthKey <= starterMonth) {
    return { ...features, plan, remaining: 0, limit: 3 };
  }

  const monthly = rows.find(row => row.bucket_key === `free:${monthKey}`);
  return { ...features, plan, remaining: Math.max(1 - (monthly?.used ?? 0), 0), limit: 1 };
}

export async function reserveQuota(
  access: AccountAccess,
  guestId: string,
  analysisId: string,
  mode: InputMode
): Promise<QuotaReservation> {
  const plan = resolvePlan(access);
  const features = planFeatures(plan);
  const subjectId = access.userId ?? `guest:${guestId}`;

  if (!features.canUseAdvancedModes && mode !== 'text') {
    return {
      ...features,
      plan,
      subjectId,
      allowed: false,
      remaining: null,
      limit: null,
      reason: 'premium_mode',
    };
  }

  if (plan === 'admin') {
    return {
      ...features,
      plan,
      subjectId,
      allowed: true,
      remaining: null,
      limit: null,
      reason: null,
    };
  }

  if (!isDatabaseConfigured()) {
    return {
      ...features,
      plan,
      subjectId,
      allowed: false,
      remaining: null,
      limit: null,
      reason: 'database_unavailable',
    };
  }

  const sql = getDatabase();
  const rows = await sql`
    SELECT * FROM reserve_analysis_quota(
      ${subjectId},
      ${analysisId},
      ${plan},
      ${mode}
    )
  ` as QuotaRow[];
  const row = rows[0];

  return {
    ...features,
    plan,
    subjectId,
    allowed: Boolean(row?.allowed),
    remaining: row?.remaining ?? 0,
    limit: row?.limit_value ?? null,
    reason: row?.reason ?? 'limit_reached',
  };
}

export async function completeQuota(subjectId: string, analysisId: string, plan: AccessPlan) {
  if (plan === 'admin' || !isDatabaseConfigured()) return;
  const sql = getDatabase();
  await sql`SELECT complete_analysis_quota(${subjectId}, ${analysisId})`;
}

export async function releaseQuota(subjectId: string, analysisId: string, plan: AccessPlan) {
  if (plan === 'admin' || !isDatabaseConfigured()) return;
  const sql = getDatabase();
  await sql`SELECT release_analysis_quota(${subjectId}, ${analysisId})`;
}

export function quotaErrorMessage(reason: string | null, plan: AccessPlan): string {
  if (reason === 'premium_mode') {
    return 'Analiza HTML i URL jest dostępna w planie Premium.';
  }
  if (reason === 'database_unavailable') {
    return 'Limity analiz nie są jeszcze skonfigurowane.';
  }
  if (plan === 'guest') {
    return 'Bezpłatna analiza próbna została wykorzystana. Załóż konto, aby otrzymać 3 pełne analizy tekstu.';
  }
  if (plan === 'free') {
    return 'Twój bezpłatny limit został wykorzystany. Kolejna analiza będzie dostępna w następnym miesiącu albo od razu w Premium.';
  }
  return 'Miesięczny limit analiz został wykorzystany.';
}
