import { auth, currentUser } from '@clerk/nextjs/server';
import { getBillingAccess, type BillingPeriod } from './billing';

const OWNER_GITHUB_USERNAMES = ['wojokoka-max'];

export interface AccountAccess {
  configured: boolean;
  signedIn: boolean;
  userId: string | null;
  isPremium: boolean;
  isAdmin: boolean;
  billingConfigured: boolean;
  billingPeriod: BillingPeriod | null;
  subscriptionStatus: string | null;
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd: string | null;
}

export function isAuthConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY &&
    process.env.CLERK_SECRET_KEY
  );
}

export async function getAccountAccess(): Promise<AccountAccess> {
  if (!isAuthConfigured()) {
    return emptyAccountAccess(false);
  }

  const { userId } = await auth();
  if (!userId) {
    return emptyAccountAccess(true);
  }

  const user = await currentUser();
  const metadata = user?.publicMetadata ?? {};
  const email = user?.primaryEmailAddress?.emailAddress?.toLowerCase() ?? null;
  const githubIdentifiers = githubAccountIdentifiers(user?.externalAccounts ?? []);
  const premiumUserIds = (process.env.PREMIUM_USER_IDS ?? '')
    .split(',')
    .map(value => value.trim())
    .filter(Boolean);
  const premiumEmails = (process.env.PREMIUM_EMAILS ?? '')
    .split(',')
    .map(value => value.trim().toLowerCase())
    .filter(Boolean);
  const adminUserIds = (process.env.ADMIN_USER_IDS ?? '')
    .split(',')
    .map(value => value.trim())
    .filter(Boolean);
  const adminEmails = (process.env.ADMIN_EMAILS ?? '')
    .split(',')
    .map(value => value.trim().toLowerCase())
    .filter(Boolean);
  const adminGithubUsernames = (process.env.ADMIN_GITHUB_USERNAMES ?? '')
    .split(',')
    .map(value => value.trim().toLowerCase())
    .filter(Boolean);
  const ownerGithubUsernames = [
    ...OWNER_GITHUB_USERNAMES,
    ...adminGithubUsernames,
  ];
  const isAdmin =
    metadata.role === 'admin' ||
    metadata.admin === true ||
    adminUserIds.includes(userId) ||
    (email ? adminEmails.includes(email) : false) ||
    githubIdentifiers.some(identifier => ownerGithubUsernames.includes(identifier));
  const billing = await getBillingAccess(userId);
  const isPremium =
    isAdmin ||
    billing.isSubscriber ||
    metadata.plan === 'premium' ||
    metadata.premium === true ||
    premiumUserIds.includes(userId) ||
    (email ? premiumEmails.includes(email) : false);

  return {
    configured: true,
    signedIn: true,
    userId,
    isPremium,
    isAdmin,
    billingConfigured: billing.configured,
    billingPeriod: billing.billingPeriod,
    subscriptionStatus: billing.subscriptionStatus,
    cancelAtPeriodEnd: billing.cancelAtPeriodEnd,
    currentPeriodEnd: billing.currentPeriodEnd,
  };
}

function githubAccountIdentifiers(
  externalAccounts: NonNullable<Awaited<ReturnType<typeof currentUser>>>['externalAccounts']
): string[] {
  const githubAccount = externalAccounts.find(account => account.provider === 'oauth_github');
  if (!githubAccount) return [];

  const data = githubAccount as unknown as Record<string, unknown>;
  return [
    data.username,
    data.externalUsername,
    data.providerUserId,
    data.externalId,
  ]
    .filter((value): value is string => typeof value === 'string')
    .map(value => value.trim().toLowerCase())
    .filter(Boolean);
}

function emptyAccountAccess(configured: boolean): AccountAccess {
  return {
    configured,
    signedIn: false,
    userId: null,
    isPremium: false,
    isAdmin: false,
    billingConfigured: false,
    billingPeriod: null,
    subscriptionStatus: null,
    cancelAtPeriodEnd: false,
    currentPeriodEnd: null,
  };
}
