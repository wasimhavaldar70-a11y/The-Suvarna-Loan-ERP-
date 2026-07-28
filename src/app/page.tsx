'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getSessionUser } from '../lib/supabase/client';

export default function RootPage() {
  const router = useRouter();

  useEffect(() => {
    const session = getSessionUser();
    if (session && session.user) {
      if (session.user.role === 'Super Admin') {
        router.push('/admin/dashboard');
      } else {
        router.push('/dashboard');
      }
    } else {
      router.push('/login');
    }
  }, [router]);

  return (
    <div className="flex h-screen w-screen items-center justify-center bg-slate-950 text-white">
      <div className="flex flex-col items-center gap-3">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-amber-500 border-t-transparent"></div>
        <span className="text-sm font-medium text-amber-200">Redirecting to SuvarnaLoan ERP...</span>
      </div>
    </div>
  );
}
