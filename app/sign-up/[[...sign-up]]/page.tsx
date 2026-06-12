import { SignUp } from '@clerk/nextjs';

export default function SignUpPage() {
  if (!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) {
    return <main className="auth-page">Rejestracja wymaga konfiguracji Clerk.</main>;
  }

  return (
    <main className="auth-page">
      <SignUp />
    </main>
  );
}
