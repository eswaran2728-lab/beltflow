'use client';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { CheckCircle, XCircle, Award } from 'lucide-react';
import { useLive } from '@/lib/useLive';
import { verifyCertificate } from '@/lib/db';

export default function VerifyPage() {
  const { code } = useParams<{ code: string }>();
  const { data: cert, loading } = useLive(() => verifyCertificate(code), [], [code]);

  return (
    <div className="min-h-screen bg-[#0f172a] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <span className="text-2xl font-extrabold text-yellow-500">BeltFlow</span>
          <p className="text-white/40 text-sm mt-1">Certificate Verification</p>
        </div>

        <div className="bg-white rounded-2xl p-8 text-center">
          {loading ? (
            <div className="w-8 h-8 border-2 border-gray-900 border-t-transparent rounded-full animate-spin mx-auto" />
          ) : cert ? (
            <>
              <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle size={32} className="text-green-600" />
              </div>
              <p className="text-green-700 font-bold text-sm uppercase tracking-wide">Verified Authentic</p>
              <div className="w-10 h-10 bg-yellow-50 rounded-full flex items-center justify-center mx-auto my-4">
                <Award size={20} className="text-yellow-600" />
              </div>
              <h1 className="text-lg font-bold text-gray-900">{cert.title}</h1>
              <p className="text-gray-500 text-sm mt-1">awarded to</p>
              <p className="text-xl font-extrabold text-gray-900 mt-1">{cert.studentDisplay}</p>
              <div className="mt-6 pt-6 border-t border-gray-100 grid grid-cols-2 gap-4 text-sm text-left">
                <div><p className="text-gray-400 text-xs">Academy</p><p className="font-semibold text-gray-900">{cert.academyName}</p></div>
                <div><p className="text-gray-400 text-xs">Date Issued</p><p className="font-semibold text-gray-900">{cert.issuedAt}</p></div>
                <div className="col-span-2"><p className="text-gray-400 text-xs">Certificate No.</p><p className="font-semibold text-gray-900">{cert.certNo}</p></div>
              </div>
            </>
          ) : (
            <>
              <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
                <XCircle size={32} className="text-red-500" />
              </div>
              <p className="text-red-600 font-bold">Certificate Not Found</p>
              <p className="text-gray-400 text-sm mt-2">This code doesn&apos;t match any issued certificate.</p>
            </>
          )}
        </div>

        <p className="text-center text-white/30 text-xs mt-6">
          <Link href="/" className="hover:text-white/60">Powered by BeltFlow</Link>
        </p>
      </div>
    </div>
  );
}
