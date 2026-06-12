import { clerkMiddleware } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

export default clerkMiddleware((_auth, request) => {
  const response = NextResponse.next();
  if (!request.cookies.get('cp_guest_id')) {
    response.cookies.set('cp_guest_id', crypto.randomUUID(), {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 24 * 365,
      path: '/',
    });
  }
  return response;
});

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api)(.*)',
  ],
};
