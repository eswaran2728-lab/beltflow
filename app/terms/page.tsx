import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-3xl mx-auto px-4 py-12">
        <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 mb-8"><ArrowLeft size={15} /> Back to BeltFlow</Link>
        <h1 className="text-3xl font-extrabold text-gray-900 mb-2">Terms of Service</h1>
        <p className="text-sm text-gray-400 mb-10">Last updated: July 2026</p>

        <div className="prose prose-sm max-w-none text-gray-700 space-y-6 leading-relaxed">
          <section>
            <h2 className="text-lg font-bold text-gray-900 mt-8 mb-2">1. Acceptance</h2>
            <p>By registering for or using BeltFlow, you agree to these terms. If you are registering on behalf of
            a student under 18, you confirm you are their parent or legal guardian and consent on their behalf.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gray-900 mt-8 mb-2">2. Account approval</h2>
            <p>New coach, parent, and student accounts require approval by the academy admin before login is
            possible. The academy admin is responsible for verifying who they approve.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gray-900 mt-8 mb-2">3. Use of the service</h2>
            <p>BeltFlow is provided to help martial arts academies manage students, attendance, payments, grading,
            and tournaments. You agree to use it only for legitimate academy administration and not to misuse,
            scrape, or attempt to access data outside your authorized role.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gray-900 mt-8 mb-2">4. Payments</h2>
            <p>Cash and transfer payments recorded in BeltFlow are claims submitted by parents and must be approved
            by academy staff before being treated as paid. BeltFlow does not process card or bank payments directly
            at this time; it only records and tracks payment status.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gray-900 mt-8 mb-2">5. Digital certificates</h2>
            <p>Certificates issued through BeltFlow are verifiable via a public link but do not replace any official
            grading body certification your association may separately require.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gray-900 mt-8 mb-2">6. Availability</h2>
            <p>BeltFlow is provided &quot;as is&quot; during its MVP period without uptime guarantees. We aim to keep the
            service reliable but are not liable for data loss or downtime.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gray-900 mt-8 mb-2">7. Changes</h2>
            <p>These terms may be updated as BeltFlow evolves. Continued use after changes means you accept the
            updated terms.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gray-900 mt-8 mb-2">8. Contact</h2>
            <p>For questions about these terms, contact your academy administrator.</p>
          </section>
        </div>
      </div>
    </div>
  );
}
