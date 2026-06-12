'use client';

import { useCallback, useEffect, useState } from 'react';
import type { AnalysisHistorySummary, SavedAnalysis } from '@/lib/history';
import type { AccountState } from './AccountControls';

interface Props {
  open: boolean;
  account: AccountState;
  adminMode?: boolean;
  refreshKey: number;
  onClose: () => void;
  onOpenAnalysis: (analysis: SavedAnalysis) => void;
}

export function HistoryPanel({
  open,
  account,
  adminMode = false,
  refreshKey,
  onClose,
  onOpenAnalysis,
}: Props) {
  const [items, setItems] = useState<AnalysisHistorySummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const loadHistory = useCallback(async () => {
    const hasAccess = adminMode ? account.isAdmin : account.isPremium;
    if (!open || !hasAccess || !account.historyReady) return;

    setLoading(true);
    setError('');
    try {
      const response = await fetch(adminMode ? '/api/admin/history' : '/api/history', { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? 'Nie udało się pobrać historii.');
      setItems(Array.isArray(data.items) ? data.items : []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Nie udało się pobrać historii.');
    } finally {
      setLoading(false);
    }
  }, [account.historyReady, account.isAdmin, account.isPremium, adminMode, open]);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory, refreshKey]);

  if (!open) return null;

  async function openAnalysis(id: string) {
    setLoading(true);
    setError('');
    try {
      const endpoint = adminMode ? '/api/admin/history' : '/api/history';
      const response = await fetch(`${endpoint}/${encodeURIComponent(id)}`, { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? 'Nie udało się otworzyć analizy.');
      onOpenAnalysis(data.item as SavedAnalysis);
      onClose();
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Nie udało się otworzyć analizy.');
    } finally {
      setLoading(false);
    }
  }

  async function deleteAnalysis(id: string) {
    if (!window.confirm('Usunąć tę analizę z historii?')) return;

    const endpoint = adminMode ? '/api/admin/history' : '/api/history';
    const response = await fetch(`${endpoint}/${encodeURIComponent(id)}`, { method: 'DELETE' });
    if (response.ok) {
      setItems(current => current.filter(item => item.id !== id));
      return;
    }

    const data = await response.json();
    setError(data.error ?? 'Nie udało się usunąć analizy.');
  }

  return (
    <div className="history-backdrop no-print" role="presentation" onMouseDown={onClose}>
      <aside
        className="history-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="history-title"
        onMouseDown={event => event.stopPropagation()}
      >
        <div className="history-header">
          <div>
            <h2 id="history-title">{adminMode ? 'Wszystkie analizy' : 'Historia analiz'}</h2>
            <p>{adminMode ? 'Analizy zachowane przez użytkowników.' : 'Twoje ręcznie zachowane wyniki.'}</p>
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Zamknij historię">×</button>
        </div>

        {!account.signedIn && <HistoryNotice text="Zaloguj się, aby zobaczyć historię analiz." />}
        {account.signedIn && !account.isPremium && !adminMode && (
          <HistoryNotice text="Historia analiz jest dostępna w planie Premium." />
        )}
        {adminMode && account.signedIn && !account.isAdmin && (
          <HistoryNotice text="Ten widok jest dostępny wyłącznie dla administratora." />
        )}
        {(adminMode ? account.isAdmin : account.isPremium) && !account.historyReady && (
          <HistoryNotice text="Historia czeka na podłączenie bazy danych." />
        )}

        {(adminMode ? account.isAdmin : account.isPremium) && account.historyReady && (
          <div className="history-body">
            {error && <div className="history-error">{error}</div>}
            {loading && items.length === 0 && <div className="history-empty">Pobieranie historii...</div>}
            {!loading && items.length === 0 && !error && (
              <div className="history-empty">Nie masz jeszcze zapisanych analiz.</div>
            )}
            {items.map(item => (
              <article className="history-item" key={item.id}>
                <button type="button" className="history-open" onClick={() => void openAnalysis(item.id)}>
                  <strong>{item.title}</strong>
                  <span>
                    {modeLabel(item.inputMode)} · {item.overallScore}/100 · {formatDate(item.updatedAt)}
                  </span>
                  {item.sourceLabel && <small>{item.sourceLabel}</small>}
                  {adminMode && item.ownerId && <small>Użytkownik: {item.ownerId}</small>}
                </button>
                <button
                  type="button"
                  className="history-delete"
                  onClick={() => void deleteAnalysis(item.id)}
                  aria-label={`Usuń analizę: ${item.title}`}
                  title="Usuń analizę"
                >
                  ×
                </button>
              </article>
            ))}
          </div>
        )}
      </aside>
    </div>
  );
}

function HistoryNotice({ text }: { text: string }) {
  return <div className="history-empty">{text}</div>;
}

function modeLabel(mode: AnalysisHistorySummary['inputMode']) {
  if (mode === 'url') return 'URL';
  if (mode === 'html') return 'HTML';
  return 'Tekst';
}

function formatDate(value: string) {
  return new Date(value).toLocaleString('pl-PL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
