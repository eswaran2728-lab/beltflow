'use client';
import { useState } from 'react';
import Link from 'next/link';
import { Rocket, Check, ChevronRight, X, Copy } from 'lucide-react';

interface Props {
  hasAcademyInfo: boolean;
  hasBelts: boolean;
  hasBranchOrClass: boolean;
  hasStudent: boolean;
}

export default function OnboardingChecklist({ hasAcademyInfo, hasBelts, hasBranchOrClass, hasStudent }: Props) {
  const [dismissed, setDismissed] = useState(false);
  const [copied, setCopied] = useState(false);

  const steps = [
    { done: hasAcademyInfo, label: 'Set your academy name & description', href: '/dashboard/settings' },
    { done: hasBelts, label: 'Review belt / rank levels', href: '/dashboard/settings' },
    { done: hasBranchOrClass, label: 'Add a branch and your first class', href: '/dashboard/settings' },
    { done: hasStudent, label: 'Add your first student', href: '/dashboard/students' },
  ];
  const remaining = steps.filter(s => !s.done);

  if (dismissed || remaining.length === 0) return null;

  const copyInviteLink = () => {
    const url = typeof window !== 'undefined' ? `${window.location.origin}/auth/signup` : '';
    navigator.clipboard.writeText(url).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  };

  return (
    <div className="bg-gradient-to-br from-indigo-50 to-blue-50 border border-indigo-100 rounded-2xl p-5 relative">
      <button onClick={() => setDismissed(true)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"><X size={16} /></button>
      <div className="flex items-center gap-2 mb-1">
        <Rocket size={18} className="text-indigo-600" />
        <h2 className="font-bold text-gray-900">Get your academy set up</h2>
      </div>
      <p className="text-sm text-gray-500 mb-4">{remaining.length} step{remaining.length === 1 ? '' : 's'} left. Complete these so coaches, parents, and students can get going.</p>
      <div className="space-y-2">
        {steps.map(s => (
          <Link key={s.label} href={s.href}
            className={`flex items-center justify-between px-4 py-2.5 rounded-xl border text-sm ${s.done ? 'bg-white/60 border-transparent text-gray-400' : 'bg-white border-indigo-100 text-gray-900 hover:border-indigo-300'}`}>
            <span className="flex items-center gap-2">
              <span className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${s.done ? 'bg-green-500' : 'bg-gray-200'}`}>
                {s.done && <Check size={12} className="text-white" />}
              </span>
              <span className={s.done ? 'line-through' : 'font-medium'}>{s.label}</span>
            </span>
            {!s.done && <ChevronRight size={15} className="text-gray-400" />}
          </Link>
        ))}
      </div>
      <div className="mt-4 pt-4 border-t border-indigo-100 flex items-center justify-between flex-wrap gap-2">
        <p className="text-xs text-gray-500">Invite coaches/parents/students — share your signup link, then approve them in Approvals.</p>
        <button onClick={copyInviteLink} className="flex items-center gap-1.5 bg-white border border-indigo-200 text-indigo-700 text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-indigo-50">
          <Copy size={12} /> {copied ? 'Copied!' : 'Copy Signup Link'}
        </button>
      </div>
    </div>
  );
}
