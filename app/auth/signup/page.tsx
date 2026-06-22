'use client';
import { useRouter } from 'next/navigation';
import { Lock } from 'lucide-react';

export default function SignupPage() {
  const router = useRouter();
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="text-center max-w-sm">
        <div className="inline-flex items-center justify-center w-14 h-14 bg-gray-100 rounded-2xl mb-4">
          <Lock size={24} className="text-gray-400" />
        </div>
        <h1 className="text-xl font-extrabold text-gray-900">Registration Closed</h1>
        <p className="text-gray-500 text-sm mt-2 leading-relaxed">
          BeltFlow accounts are managed by the Admin.<br />
          Please contact <strong>ESWARAN A/L Padmanathan</strong> to get your login details.
        </p>
        <button onClick={() => router.push('/auth/login')}
          className="mt-6 bg-[#0f172a] text-white font-semibold px-6 py-2.5 rounded-xl text-sm hover:bg-gray-800 transition-colors">
          Back to Login
        </button>
      </div>
    </div>
  );
}
