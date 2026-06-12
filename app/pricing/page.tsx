'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { AccountState } from '@/components/AccountControls';

type CheckoutState = 'idle' | 'monthly' | 'yearly' | 'portal';

const EMPTY_ACCOUNT: AccountState = {
  configured: false,
  signedIn: false,
  isPremium: false,
  isAdmin: false,
  historyReady: false,
  plan: 'guest',
  remaining: 1,
  limit: 1,
  canUseAdvancedModes: false,
  canSaveHistory: false,
  canExport: false,
  billingConfigured: false,
  billingPeriod: null,
  subscriptionStatus: null,
  cancelAtPeriodEnd: false,
  currentPeriodEnd: null,
};

export default function PricingPage() {
  const [account, setAccount] = useState<AccountState>(EMPTY_ACCOUNT);
  const [loading, setLoading] = useState(true);
  const [checkoutState, setCheckoutState] = useState<CheckoutState>('idle');
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    fetch('/api/account', { cache: 'no-store' })
      .then(response => response.json())
      .then(data => {
        if (!active) return;
        setAccount({
          ...EMPTY_ACCOUNT,
          ...data,
          signedIn: Boolean(data.signedIn),
          isPremium: Boolean(data.isPremium),
          isAdmin: Boolean(data.isAdmin),
          billingConfigured: Boolean(data.billingConfigured),
        });
      })
      .catch(() => {
        if (active) setError('Nie udało się pobrać informacji o koncie.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  async function startCheckout(period: 'monthly' | 'yearly') {
    setCheckoutState(period);
    setError('');
    try {
      const response = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ period }),
      });
      const data = await response.json();
      if (!response.ok || !data.url) throw new Error(data.error ?? 'Nie udało się rozpocząć płatności.');
      window.location.href = data.url;
    } catch (checkoutError) {
      setError(checkoutError instanceof Error ? checkoutError.message : 'Nie udało się rozpocząć płatności.');
      setCheckoutState('idle');
    }
  }

  async function openPortal() {
    setCheckoutState('portal');
    setError('');
    try {
      const response = await fetch('/api/billing/portal', { method: 'POST' });
      const data = await response.json();
      if (!response.ok || !data.url) throw new Error(data.error ?? 'Nie udało się otworzyć subskrypcji.');
      window.location.href = data.url;
    } catch (portalError) {
      setError(portalError instanceof Error ? portalError.message : 'Nie udało się otworzyć subskrypcji.');
      setCheckoutState('idle');
    }
  }

  const hasStripeSubscription = account.subscriptionStatus === 'active'
    || account.subscriptionStatus === 'trialing';

  return (
    <main className="pricing-page">
      <div className="pricing-topbar">
        <Link href="/" className="header-link">← ContentProof</Link>
        {account.signedIn && <span className="plan-badge">{account.isPremium ? 'Premium' : 'Free'}</span>}
      </div>

      <header className="pricing-header">
        <h1>Wybierz plan</h1>
        <p>Pełna analiza dla okazjonalnej kontroli albo regularna praca z treściami, URL i HTML.</p>
      </header>

      {error && <div className="pricing-message pricing-error">{error}</div>}
      {hasStripeSubscription && (
        <div className="pricing-message">
          Premium jest aktywne
          {account.currentPeriodEnd
            ? ` do ${new Date(account.currentPeriodEnd).toLocaleDateString('pl-PL')}`
            : ''}.
          {account.cancelAtPeriodEnd ? ' Subskrypcja nie odnowi się automatycznie.' : ''}
        </div>
      )}

      <section className="pricing-grid" aria-label="Plany ContentProof">
        <PlanCard
          name="Free"
          price="0 zł"
          note="Idealne do przetestowania narzędzia."
          features={[
            '1 analiza bez konta',
            '3 analizy tekstu po rejestracji',
            'Później 1 analiza miesięcznie',
            'Bez historii i eksportu PDF',
          ]}
          action={account.signedIn ? 'Twój plan podstawowy' : 'Załóż konto'}
          actionHref={account.signedIn ? undefined : '/sign-up'}
          disabled={account.signedIn}
        />

        <PlanCard
          name="Premium miesięczny"
          price="49 zł"
          suffix="/ mies."
          note="Najlepszy plan dla większości użytkowników."
          features={[
            '30 analiz miesięcznie',
            'Analiza tekstu, URL i HTML',
            'Historia analiz i zapis wyników',
            'Pełny SEO Pack i eksport PDF',
          ]}
          action={hasStripeSubscription ? 'Zarządzaj subskrypcją' : 'Wybieram miesięczny'}
          onAction={hasStripeSubscription ? openPortal : () => startCheckout('monthly')}
          actionHref={!account.signedIn ? '/sign-in' : undefined}
          disabled={loading || account.isAdmin || (!account.billingConfigured && account.signedIn)}
          busy={checkoutState === 'monthly' || checkoutState === 'portal'}
        />

        <PlanCard
          name="Premium roczny"
          price="399 zł"
          suffix="/ rok"
          note="Najbardziej opłacalna opcja. Oszczędzasz 189 zł rocznie."
          featured
          features={[
            'Wszystko z planu Premium miesięcznego',
            '30 analiz w każdym miesiącu',
            'Ta sama pełna funkcjonalność',
            'Około 32% taniej niż miesięcznie',
          ]}
          action={hasStripeSubscription ? 'Zarządzaj subskrypcją' : 'Wybieram roczny'}
          onAction={hasStripeSubscription ? openPortal : () => startCheckout('yearly')}
          actionHref={!account.signedIn ? '/sign-in' : undefined}
          disabled={loading || account.isAdmin || (!account.billingConfigured && account.signedIn)}
          busy={checkoutState === 'yearly' || checkoutState === 'portal'}
        />
      </section>

      <p className="pricing-footnote">
        Nie oferujemy planu bez limitu. Chroni to stabilność platformy i jakość analiz.
      </p>
    </main>
  );
}

interface PlanCardProps {
  name: string;
  price: string;
  suffix?: string;
  note: string;
  features: string[];
  action: string;
  actionHref?: string;
  onAction?: () => void;
  disabled?: boolean;
  busy?: boolean;
  featured?: boolean;
}

function PlanCard({
  name,
  price,
  suffix,
  note,
  features,
  action,
  actionHref,
  onAction,
  disabled,
  busy,
  featured,
}: PlanCardProps) {
  const actionClass = featured ? 'pricing-action pricing-action-primary' : 'pricing-action';
  return (
    <article className={featured ? 'pricing-card pricing-card-featured' : 'pricing-card'}>
      <div>
        <h2>{name}</h2>
        <div className="pricing-price">{price} {suffix && <small>{suffix}</small>}</div>
        <p>{note}</p>
      </div>
      <ul>
        {features.map(feature => <li key={feature}>{feature}</li>)}
      </ul>
      {actionHref ? (
        <Link href={actionHref} className={actionClass}>{action}</Link>
      ) : (
        <button type="button" className={actionClass} onClick={onAction} disabled={disabled || busy}>
          {busy ? 'Otwieranie...' : action}
        </button>
      )}
    </article>
  );
}
