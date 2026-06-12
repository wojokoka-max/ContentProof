'use client';

import Link from 'next/link';
import { UserButton } from '@clerk/nextjs';

export interface AccountState {
  configured: boolean;
  signedIn: boolean;
  isPremium: boolean;
  isAdmin: boolean;
  historyReady: boolean;
  plan: 'guest' | 'free' | 'premium' | 'admin';
  remaining: number | null;
  limit: number | null;
  canUseAdvancedModes: boolean;
  canSaveHistory: boolean;
  canExport: boolean;
  billingConfigured: boolean;
  billingPeriod: 'monthly' | 'yearly' | null;
  subscriptionStatus: string | null;
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd: string | null;
}

interface Props {
  authEnabled: boolean;
  account: AccountState;
  onOpenHistory: () => void;
  onOpenAdminHistory: () => void;
}

export function AccountControls({
  authEnabled,
  account,
  onOpenHistory,
  onOpenAdminHistory,
}: Props) {
  if (!authEnabled) return null;

  if (!account.signedIn) {
    return (
      <div className="account-controls no-print">
        <UsageBadge account={account} />
        <Link href="/sign-in" className="header-link">Zaloguj się</Link>
        <Link href="/sign-up" className="header-button">Załóż konto</Link>
      </div>
    );
  }

  return (
    <div className="account-controls no-print">
      {account.isAdmin && (
        <button
          type="button"
          onClick={onOpenAdminHistory}
          title="Otwórz analizy wszystkich użytkowników"
          className="header-link-button"
        >
          <span className="admin-label-desktop">Panel admina</span>
          <span className="admin-label-mobile">Admin</span>
        </button>
      )}
      <button
        type="button"
        onClick={onOpenHistory}
        title={account.isPremium ? 'Otwórz zapisane analizy' : 'Historia jest dostępna w planie Premium'}
        className="header-link-button"
      >
        Historia
      </button>
      <span className={account.isPremium ? 'plan-badge plan-badge-premium' : 'plan-badge'}>
        {account.isAdmin ? 'Admin' : account.isPremium ? 'Premium' : 'Free'}
      </span>
      {!account.isAdmin && (
        <Link href="/pricing" className="header-link">
          {account.subscriptionStatus ? 'Subskrypcja' : 'Premium'}
        </Link>
      )}
      <UsageBadge account={account} />
      <UserButton />
    </div>
  );
}

function UsageBadge({ account }: { account: AccountState }) {
  if (account.remaining === null) {
    return <span className="usage-badge">Bez limitu</span>;
  }

  return (
    <span className="usage-badge" title="Pozostałe analizy w bieżącym pakiecie">
      {account.remaining}/{account.limit}
    </span>
  );
}
