import { SignIn } from '@clerk/nextjs';

export default function SignInPage() {
  if (!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) {
    return <main className="auth-page">Logowanie wymaga konfiguracji Clerk.</main>;
  }

  return (
    <main className="auth-page">
      <SignIn />
    </main>
  );
}
