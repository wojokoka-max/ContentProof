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
      <div className="no-print" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <UsageBadge account={account} />
        <Link href="/sign-in" className="header-link">Zaloguj się</Link>
        <Link href="/sign-up" className="header-button">Załóż konto</Link>
      </div>
    );
  }

  return (
    <div className="no-print" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      {account.isAdmin && (
        <button
          type="button"
          onClick={onOpenAdminHistory}
          title="Otwórz analizy wszystkich użytkowników"
          className="header-link-button"
        >
          Panel admina
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
