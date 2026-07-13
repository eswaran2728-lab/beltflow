import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-3xl mx-auto px-4 py-12">
        <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 mb-8"><ArrowLeft size={15} /> Back to BeltFlow</Link>
        <h1 className="text-3xl font-extrabold text-gray-900 mb-2">Privacy Policy</h1>
        <p className="text-sm text-gray-400 mb-10">Last updated: July 2026</p>

        <div className="prose prose-sm max-w-none text-gray-700 space-y-6 leading-relaxed">
          <p>
            BeltFlow (&quot;we&quot;, &quot;us&quot;) is a martial arts academy management system. This policy explains what
            personal data we collect, why, and how it is protected, in compliance with Malaysia&apos;s
            Personal Data Protection Act 2010 (PDPA).
          </p>

          <section>
            <h2 className="text-lg font-bold text-gray-900 mt-8 mb-2">1. What we collect</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Account data:</strong> name, email, phone number, and role (admin, coach, parent, student).</li>
              <li><strong>Student data:</strong> full name, IC/MyKid number, date of birth, gender, belt rank, medical notes, and photos where provided.</li>
              <li><strong>Attendance, payment, grading, and tournament records</strong> tied to a student.</li>
              <li><strong>Guardian relationships</strong> linking parent accounts to their children&apos;s student records.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gray-900 mt-8 mb-2">2. Why we collect it</h2>
            <p>Solely to operate the academy: tracking attendance, collecting fees, recording belt progress, managing
            tournament results, and letting parents follow their child&apos;s progress. We do not sell or share your
            data with third parties for marketing.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gray-900 mt-8 mb-2">3. Who can see your data</h2>
            <p>Access is strictly role-based and enforced at the database level:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Academy admins and assigned coaches can see students in their academy/classes.</li>
              <li>Parents can only see their own linked children&apos;s records.</li>
              <li>Students can only see their own record.</li>
              <li>Medical notes are visible only to admin and the student&apos;s assigned coaches.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gray-900 mt-8 mb-2">4. Children&apos;s data</h2>
            <p>Many students are minors. Their data is entered and managed by the academy admin/coach or their
            parent/guardian. By registering as a parent, you consent to your child&apos;s data being stored and
            processed for the purposes described in this policy.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gray-900 mt-8 mb-2">5. Data retention & deletion</h2>
            <p>Data is retained while your academy account is active. You may request correction or deletion of
            your personal data or your child&apos;s data at any time by contacting your academy admin.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gray-900 mt-8 mb-2">6. Security</h2>
            <p>Data is stored with Supabase (PostgreSQL) using Row Level Security policies, encrypted in transit,
            and access-controlled by authenticated sessions.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gray-900 mt-8 mb-2">7. Contact</h2>
            <p>For any privacy questions or data requests, contact your academy administrator directly.</p>
          </section>
        </div>
      </div>
    </div>
  );
}
