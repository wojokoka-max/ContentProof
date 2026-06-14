# ContentProof

ContentProof to platforma wspierająca analizę jakości treści przed publikacją.

Celem projektu jest pomoc twórcom, blogerom i małym firmom w tworzeniu:

* bardziej czytelnych treści,
* lepszej struktury SEO,
* bardziej naturalnego języka,
* treści przyjaznych użytkownikowi,
* oraz contentu mniej „mechanicznego”.

ContentProof analizuje między innymi:

* strukturę nagłówków,
* meta dane,
* schema.org,
* Open Graph,
* linkowanie wewnętrzne,
* UX readability,
* rytm tekstu,
* sztuczne frazy AI,
* mobile-first readability.

Projekt skupia się na praktycznych sugestiach zamiast technicznego żargonu.

Filozofia:
technologia ma pomagać człowiekowi pisać lepiej, a nie zmuszać go do tworzenia tekstów pod algorytm.

## Logowanie i historia Premium

Historia analiz używa Clerk do logowania i Neon Postgres do przechowywania danych.

1. Skopiuj `.env.example` do `.env.local` i uzupełnij klucze Clerk oraz `DATABASE_URL`.
2. Uruchom migrację `db/migrations/001_analysis_history.sql` w konsoli SQL bazy Neon.
3. Uruchom migrację `db/migrations/002_analysis_limits.sql`, aby włączyć limity planów.
4. Uruchom migrację `db/migrations/003_billing_subscriptions.sql`, aby przygotować płatności.
5. Uruchom kolejno migracje `004`, `005` i `006_credit_limits_and_purchases.sql`.
6. Ustaw użytkownikowi Clerk `publicMetadata.plan` na `premium`. W testach można też wpisać identyfikator użytkownika do `PREMIUM_USER_IDS`.

Analizy nie zapisują się automatycznie. Użytkownik Premium zapisuje konkretny wynik przyciskiem „Zachowaj analizę”.

## Dostęp administratora

Administrator automatycznie otrzymuje dostęp Premium oraz może otworzyć panel ze wszystkimi zapisanymi analizami.

Najprościej dodać identyfikator własnego użytkownika Clerk do zmiennej `ADMIN_USER_IDS` w Vercel. Alternatywnie można ustawić użytkownikowi Clerk `publicMetadata.role` na `admin`.

Panel administratora nie zmienia wyników analizatora. Daje wyłącznie dostęp do historii zapisanej w bazie.

## Limity planów

- Gość: 1 pełna analiza tekstu.
- Free: 5 kredytów miesięcznie na analizy tekstu.
- Premium miesięczny: 30 kredytów miesięcznie, tryby Tekst, HTML i URL, historia oraz eksport PDF.
- Premium roczny: 200 kredytów miesięcznie i pełna funkcjonalność Premium.
- Administrator: wszystkie funkcje bez limitu.

Jedna analiza zużywa jeden kredyt. Zalogowany użytkownik każdego planu może dokupić 5 niewygasających kredytów za 9 zł. Najpierw wykorzystywana jest pula miesięczna, a następnie kredyty dokupione.

Nieudana analiza ani błąd pobierania adresu URL nie zużywa limitu.

## Płatności Stripe

Płatności korzystają ze Stripe Checkout i pozostają w trybie testowym, dopóki używane są testowe klucze Stripe.

Wymagane zmienne:

- `NEXT_PUBLIC_APP_URL`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRICE_MONTHLY`
- `STRIPE_PRICE_YEARLY`
- `STRIPE_PRICE_CREDITS_5`

Webhook Stripe powinien wskazywać na `/api/billing/webhook` i obsługiwać:

- `checkout.session.completed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`

Dostęp Premium jest nadawany na podstawie podpisanego webhooka i aktywnej subskrypcji zapisanej w Neon. Sam powrót użytkownika ze strony płatności nie zmienia planu.
