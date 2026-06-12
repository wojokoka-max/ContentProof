import { auth, currentUser } from '@clerk/nextjs/server';

export interface AccountAccess {
  configured: boolean;
  signedIn: boolean;
  userId: string | null;
  isPremium: boolean;
  isAdmin: boolean;
}

export function isAuthConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY &&
    process.env.CLERK_SECRET_KEY
  );
}

export async function getAccountAccess(): Promise<AccountAccess> {
  if (!isAuthConfigured()) {
    return { configured: false, signedIn: false, userId: null, isPremium: false, isAdmin: false };
  }

  const { userId } = await auth();
  if (!userId) {
    return { configured: true, signedIn: false, userId: null, isPremium: false, isAdmin: false };
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
  const isPremium =
    isAdmin ||
    metadata.plan === 'premium' ||
    metadata.premium === true ||
    premiumUserIds.includes(userId);

  return { configured: true, signedIn: true, userId, isPremium, isAdmin };
}
