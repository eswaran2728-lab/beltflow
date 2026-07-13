'use client';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Award, Printer, ArrowLeft } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { useLive } from '@/lib/useLive';
import { getCertificate } from '@/lib/db';

export default function CertificatePage() {
  const { id } = useParams<{ id: string }>();
  const { currentUser, loading: authLoading } = useAuth();
  const { data: cert, loading } = useLive(() => getCertificate(id), ['certificates'], [id]);

  if (authLoading || loading) {
    return <div className="min-h-screen flex items-center justify-center"><div className="w-8 h-8 border-2 border-gray-900 border-t-transparent rounded-full animate-spin" /></div>;
  }
  if (!currentUser) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-center px-4">
        <p className="text-gray-500">Please log in to view this certificate.</p>
        <Link href="/auth/login" className="text-blue-600 text-sm mt-2 hover:underline">Go to Login</Link>
      </div>
    );
  }
  if (!cert) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-center px-4">
        <p className="text-gray-500">Certificate not found, or you don&apos;t have access to it.</p>
        <Link href="/dashboard" className="text-blue-600 text-sm mt-2 hover:underline">Back to Dashboard</Link>
      </div>
    );
  }

  const verifyUrl = typeof window !== 'undefined' ? `${window.location.origin}/verify/${cert.verifyCode}` : '';

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="print:hidden max-w-3xl mx-auto px-4 pt-6 flex items-center justify-between">
        <Link href="/dashboard" className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900"><ArrowLeft size={15} /> Back</Link>
        <button onClick={() => window.print()} className="flex items-center gap-2 bg-gray-900 text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-gray-800">
          <Printer size={15} /> Print / Save as PDF
        </button>
      </div>

      <div className="max-w-3xl mx-auto p-4 print:p-0">
        <div className="bg-white rounded-2xl print:rounded-none shadow-sm print:shadow-none border-8 border-double border-yellow-500 mt-6 print:mt-0 p-10 sm:p-14 text-center">
          <div className="w-16 h-16 bg-yellow-50 rounded-full flex items-center justify-center mx-auto mb-6">
            <Award size={32} className="text-yellow-600" />
          </div>
          <p className="text-xs uppercase tracking-[0.2em] text-gray-400 font-semibold">{cert.academyName}</p>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-gray-900 mt-3">Certificate of Achievement</h1>
          <p className="text-gray-500 mt-6">This certifies that</p>
          <p className="text-2xl sm:text-3xl font-bold text-gray-900 my-3">{cert.studentName}</p>
          <p className="text-gray-600 max-w-md mx-auto">{cert.title}</p>

          <div className="grid grid-cols-2 gap-6 mt-10 pt-6 border-t border-gray-100 text-sm max-w-md mx-auto">
            <div><p className="text-gray-400 text-xs uppercase">Certificate No.</p><p className="font-semibold text-gray-900 mt-1">{cert.certNo}</p></div>
            <div><p className="text-gray-400 text-xs uppercase">Date Issued</p><p className="font-semibold text-gray-900 mt-1">{cert.issuedAt}</p></div>
          </div>

          <div className="mt-8 flex flex-col items-center gap-2">
            <p className="text-xs text-gray-400">Verify this certificate at</p>
            <p className="text-xs text-blue-600 font-mono break-all">{verifyUrl}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
