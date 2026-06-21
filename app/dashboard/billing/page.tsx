'use client';
import { CreditCard, CheckCircle, Sparkles } from 'lucide-react';

const futurePlans = [
  { name: 'Starter', price: 'RM49/mo', limit: '50 students', features: ['Student management', 'Attendance', 'Payments', 'Parent portal'] },
  { name: 'Academy', price: 'RM99/mo', limit: '150 students', features: ['Everything in Starter', 'Belt grading', 'Skill tracking', 'Coach tools', 'Cash approvals'] },
  { name: 'Association', price: 'RM199/mo', limit: 'Unlimited', features: ['Everything in Academy', 'Multiple branches', 'Multiple coaches', 'Advanced reports', 'Priority support'] },
];

export default function BillingPage() {
  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl p-8 text-white text-center">
        <div className="inline-flex items-center justify-center w-14 h-14 bg-yellow-500 rounded-2xl mb-5">
          <CreditCard size={28} className="text-white" />
        </div>
        <h1 className="text-2xl font-extrabold mb-2">Billing &amp; Subscription</h1>
        <div className="inline-flex items-center gap-2 bg-yellow-500 text-gray-900 font-bold px-4 py-2 rounded-full mb-4">
          <Sparkles size={16} />
          Coming Soon
        </div>
        <p className="text-white/70 text-sm max-w-md mx-auto leading-relaxed">
          BeltFlow MVP is currently <strong className="text-white">100% free</strong> for all academies and Daerah testing.
          Paid subscription plans will be activated in a future update.
        </p>
      </div>

      <div className="bg-green-50 border border-green-100 rounded-2xl p-5 flex items-start gap-4">
        <CheckCircle size={22} className="text-green-500 flex-shrink-0 mt-0.5" />
        <div>
          <p className="font-bold text-green-900">You are on the Free MVP Plan</p>
          <p className="text-sm text-green-700 mt-1">
            All features are unlocked with no payment required. No subscription charges, no trial limitations,
            and no expiry restrictions during the MVP testing period.
          </p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
        <h2 className="font-bold text-gray-900 mb-4">What&apos;s Included — Free Now</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {['Student management', 'Attendance tracking', 'Belt grading', 'Skill progress', 'Parent portal', 'Cash payments', 'Coach tools', 'Tournaments', 'Reports'].map(f => (
            <div key={f} className="flex items-center gap-2 text-sm text-gray-700">
              <CheckCircle size={14} className="text-green-500 flex-shrink-0" />{f}
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
        <h2 className="font-bold text-gray-900 mb-1">Future Pricing Plans</h2>
        <p className="text-sm text-gray-400 mb-4">For reference only — not charged yet.</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {futurePlans.map(p => (
            <div key={p.name} className="border border-gray-100 rounded-xl p-4 opacity-60">
              <h3 className="font-bold text-gray-900 text-sm">{p.name}</h3>
              <p className="text-lg font-extrabold text-gray-400 mt-0.5">{p.price}</p>
              <p className="text-xs text-gray-400">{p.limit}</p>
              <ul className="mt-3 space-y-1">
                {p.features.map(f => (
                  <li key={f} className="flex items-start gap-1.5 text-xs text-gray-500">
                    <CheckCircle size={11} className="text-gray-300 mt-0.5 flex-shrink-0" />{f}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
