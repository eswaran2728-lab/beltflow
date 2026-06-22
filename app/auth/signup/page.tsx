'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Eye, EyeOff, UserPlus, Clock } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { UserRole } from '@/lib/auth';

const roles: { value: UserRole; label: string; desc: string }[] = [
  { value: 'coach',   label: 'Coach / Master',     desc: 'Manage classes and students' },
  { value: 'parent',  label: 'Parent / Guardian',  desc: 'View my child\'s progress' },
  { value: 'student', label: 'Student',             desc: 'View my own profile' },
];

export default function SignupPage() {
  const { signup } = useAuth();
  const router = useRouter();
  const [role, setRole] = useState<UserRole>('parent');
  const [form, setForm] = useState({ name: '', email: '', password: '', phone: '', childName: '', assignedClass: '' });
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (form.password.length < 6) { setError('Password must be at least 6 characters.'); return; }
    setLoading(true);
    const result = await signup({
      name: form.name, email: form.email, password: form.password, role,
      phone: form.phone || undefined,
      childName: role === 'parent' ? form.childName : undefined,
      assignedClass: role === 'coach' ? form.assignedClass : undefined,
    });
    setLoading(false);
    if (!result.success) { setError(result.error || 'Signup failed. Try again.'); return; }
    setDone(true);
  };

  if (done) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center max-w-sm">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-yellow-100 rounded-2xl mb-5">
            <Clock size={32} className="text-yellow-600" />
          </div>
          <h1 className="text-xl font-extrabold text-gray-900">Registration Submitted!</h1>
          <p className="text-gray-500 text-sm mt-3 leading-relaxed">
            Your account is <strong className="text-yellow-600">pending approval</strong> from the Admin.<br /><br />
            Once approved by <strong>ESWARAN A/L Padmanathan</strong>, you will be able to login with your email and password.
          </p>
          <button onClick={() => router.push('/auth/login')}
            className="mt-6 bg-[#0f172a] text-white font-semibold px-6 py-2.5 rounded-xl text-sm hover:bg-gray-800 transition-colors">
            Back to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-[#0f172a] rounded-2xl mb-4">
            <span className="text-[#f59e0b] font-extrabold text-xl">BF</span>
          </div>
          <h1 className="text-2xl font-extrabold text-gray-900">Create Account</h1>
          <p className="text-gray-500 text-sm mt-1">Register to join BeltFlow</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-4">
          <div className="bg-yellow-50 border border-yellow-100 rounded-xl px-4 py-3 text-xs text-yellow-800">
            Your account will need <strong>Admin approval</strong> before you can login.
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Role selection - no Admin option */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">I am a...</label>
              <div className="grid grid-cols-3 gap-2">
                {roles.map(r => (
                  <label key={r.value}
                    className={`cursor-pointer border-2 rounded-xl p-3 transition-all text-center ${role === r.value ? 'border-[#0f172a] bg-gray-50' : 'border-gray-100 hover:border-gray-200'}`}>
                    <input type="radio" name="role" value={r.value} checked={role === r.value}
                      onChange={() => setRole(r.value)} className="hidden" />
                    <p className="font-semibold text-gray-900 text-xs">{r.label}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{r.desc}</p>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
              <input type="text" value={form.name} onChange={e => setForm({...form, name: e.target.value})}
                placeholder="Your full name" required
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
              <input type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})}
                placeholder="your@email.com" required
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
              <input type="tel" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})}
                placeholder="012-3456789"
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <div className="relative">
                <input type={showPw ? 'text' : 'password'} value={form.password}
                  onChange={e => setForm({...form, password: e.target.value})}
                  placeholder="Min. 6 characters" required
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                <button type="button" onClick={() => setShowPw(!showPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {role === 'parent' && (
              <div className="bg-green-50 border border-green-100 rounded-xl p-4">
                <label className="block text-sm font-medium text-green-900 mb-1">Child&apos;s Name</label>
                <input type="text" value={form.childName} onChange={e => setForm({...form, childName: e.target.value})}
                  placeholder="Your child's full name"
                  className="w-full border border-green-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 bg-white" />
              </div>
            )}
            {role === 'coach' && (
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
                <label className="block text-sm font-medium text-blue-900 mb-1">Your Class / Branch</label>
                <input type="text" value={form.assignedClass} onChange={e => setForm({...form, assignedClass: e.target.value})}
                  placeholder="e.g. Junior A, Nilai Branch"
                  className="w-full border border-blue-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white" />
              </div>
            )}

            {error && (
              <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3 text-sm text-red-600">{error}</div>
            )}

            <button type="submit" disabled={loading}
              className="w-full bg-[#0f172a] text-white font-semibold py-2.5 rounded-xl flex items-center justify-center gap-2 hover:bg-gray-800 transition-colors disabled:opacity-60">
              <UserPlus size={16} />
              {loading ? 'Submitting...' : 'Register — Pending Approval'}
            </button>
          </form>
        </div>

        <p className="text-center text-sm text-gray-500 mt-5">
          Already have an account?{' '}
          <Link href="/auth/login" className="text-blue-600 font-semibold hover:underline">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
