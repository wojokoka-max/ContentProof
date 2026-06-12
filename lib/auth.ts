import { auth, currentUser } from '@clerk/nextjs/server';
import { getBillingAccess, type BillingPeriod } from './billing';

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
  const premiumUserIds = (process.env.PREMIUM_USER_IDS ?? '')
    .split(',')
    .map(value => value.trim())
    .filter(Boolean);
  const adminUserIds = (process.env.ADMIN_USER_IDS ?? '')
    .split(',')
    .map(value => value.trim())
    .filter(Boolean);
  const isAdmin =
    metadata.role === 'admin' ||
    metadata.admin === true ||
    adminUserIds.includes(userId);
  const billing = await getBillingAccess(userId);
  const isPremium =
    isAdmin ||
    billing.isSubscriber ||
    metadata.plan === 'premium' ||
    metadata.premium === true ||
    premiumUserIds.includes(userId);

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
