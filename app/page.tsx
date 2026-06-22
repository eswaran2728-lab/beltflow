import Link from "next/link";
import { CheckCircle, Users, Calendar, Award, CreditCard, BarChart3, Trophy, Shield, Star, ArrowRight, Zap } from "lucide-react";

const features = [
  { icon: Users, title: "Student Management", desc: "Manage student profiles, belt ranks, parent contacts, and emergency information in one place." },
  { icon: Calendar, title: "Attendance Tracking", desc: "Mark attendance by class, auto-detect absences, and get alerts when students are at risk." },
  { icon: Award, title: "Belt Grading", desc: "Create grading events, track pass/fail results, and automatically update student belt ranks." },
  { icon: CreditCard, title: "Payment Management", desc: "Track monthly fees, approve cash payments, send overdue reminders, and generate receipts." },
  { icon: BarChart3, title: "Skills & Curriculum", desc: "Track each student progress across your martial art curriculum with visual indicators." },
  { icon: Trophy, title: "Tournament Management", desc: "Manage tournament registration, track medal results, and showcase student achievements." },
  { icon: Shield, title: "AI Retention Coach", desc: "Automatically identify at-risk students and get suggested WhatsApp messages to re-engage them." },
  { icon: Zap, title: "Parent Portal", desc: "Parents can view their child progress, pay fees, and stay connected with the academy." },
];

const plans = [
  { name: "Free Trial", price: "Free", period: "14 days", border: "border-gray-200", badge: "", features: ["Up to 20 students", "Basic attendance", "Student management"] },
  { name: "Starter", price: "RM49", period: "/month", border: "border-blue-200", badge: "Popular", features: ["Up to 50 students", "Attendance and Payments", "Parent portal", "Basic reports"] },
  { name: "Academy", price: "RM99", period: "/month", border: "border-yellow-400", badge: "Best Value", features: ["Up to 150 students", "Full dashboard", "Belt grading", "Skill tracking", "Coach tools", "Cash payment approval"] },
  { name: "Association", price: "RM199", period: "/month", border: "border-purple-200", badge: "Enterprise", features: ["Multiple branches", "Multiple coaches", "Advanced reports", "Custom settings", "Priority support"] },
];

const testimonials = [
  { name: "Guru Selvam", role: "Silambam Instructor, KL", text: "BeltFlow transformed how we manage our 80+ students. Attendance and payment collection is now effortless." },
  { name: "Sensei Ravi", role: "Karate Academy, Penang", text: "The belt grading module saves us hours every grading season. Highly recommended for any martial arts school." },
  { name: "Coach Priya", role: "Taekwondo Club, JB", text: "Parents love the portal. They can check their child progress anytime without calling us." },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white text-gray-900">
      <nav className="sticky top-0 z-50 bg-white/95 backdrop-blur border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <span className="text-2xl font-extrabold text-yellow-500">BeltFlow</span>
          <div className="hidden md:flex items-center gap-6 text-sm font-medium text-gray-600">
            <a href="#features" className="hover:text-gray-900">Features</a>
            <a href="#pricing" className="hover:text-gray-900">Pricing</a>
            <a href="#about" className="hover:text-gray-900">About</a>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/auth/login" className="text-sm font-medium text-gray-600 hover:text-gray-900 hidden sm:block">Log in</Link>
            <Link href="/auth/signup" className="bg-gray-900 text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-gray-800">Start Free</Link>
          </div>
        </div>
      </nav>

      <section className="bg-gray-900 text-white py-24 px-4 relative overflow-hidden">
        <div className="absolute inset-0 opacity-20">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-yellow-500 rounded-full blur-3xl" />
          <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-blue-600 rounded-full blur-3xl" />
        </div>
        <div className="relative max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-yellow-500/20 text-yellow-400 text-sm font-semibold px-4 py-1.5 rounded-full mb-6 border border-yellow-500/30">
            <Zap size={14} /> Silambam, Karate, Taekwondo, Muay Thai, BJJ
          </div>
          <h1 className="text-4xl md:text-6xl font-extrabold leading-tight mb-6">
            Manage Your Martial Arts<br /><span className="text-yellow-500">Academy with Ease</span>
          </h1>
          <p className="text-xl text-white/70 mb-10 max-w-2xl mx-auto leading-relaxed">
            Built for martial arts. Powered by progress. BeltFlow helps you manage students, track attendance, collect fees, grade belts, and grow your academy.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/auth/signup" className="bg-yellow-500 text-white font-bold px-8 py-4 rounded-xl hover:bg-yellow-600 text-lg flex items-center gap-2 shadow-lg shadow-yellow-500/30">
              Start Free Trial <ArrowRight size={20} />
            </Link>
            <Link href="/dashboard" className="bg-white/10 text-white font-semibold px-8 py-4 rounded-xl hover:bg-white/20 text-lg border border-white/20">
              View Demo
            </Link>
          </div>
          <p className="text-white/30 text-sm mt-6">No credit card required - 14-day free trial - Cancel anytime</p>
        </div>
      </section>

      <section className="bg-yellow-500 py-5 px-4">
        <div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-4 text-center text-white">
          {[{ v: "500+", l: "Academies" }, { v: "12,000+", l: "Students Tracked" }, { v: "98%", l: "Retention Rate" }, { v: "6", l: "Martial Art Styles" }].map(s => (
            <div key={s.l}><p className="text-2xl font-extrabold">{s.v}</p><p className="text-white/80 text-sm">{s.l}</p></div>
          ))}
        </div>
      </section>

      <section id="about" className="py-20 px-4 bg-gray-50">
        <div className="max-w-3xl mx-auto text-center">
          <div className="w-20 h-20 bg-yellow-500 rounded-full flex items-center justify-center mx-auto mb-6 text-3xl shadow-lg">🥋</div>
          <h2 className="text-3xl font-extrabold mb-6 text-gray-900">Built by a Martial Arts Instructor</h2>
          <p className="text-lg text-gray-600 leading-relaxed mb-6">
            Founded by <strong>ESWARAN A/L PADMANATHAN</strong>, Silambam instructor and proud student of{' '}
            <strong>Mahaguru Sri S. Arumugam</strong>, <strong>Dato&apos; Mahaguru A. Sivakumar</strong>,{' '}
            <strong>Grandmaster Vijaya Sekaran</strong> and <strong>Master Kanesan</strong>.
          </p>
          <p className="text-gray-500 leading-relaxed mb-8">
            Having managed a Silambam academy firsthand, Eswaran understood the pain of tracking 100+ students with spreadsheets and WhatsApp groups. BeltFlow was built to solve real problems faced by real instructors across Malaysia and beyond.
          </p>
          <div className="inline-flex items-center gap-3 bg-white border border-gray-200 px-6 py-4 rounded-xl shadow-sm">
            <div className="w-14 h-14 bg-gray-900 rounded-full flex items-center justify-center text-white font-bold text-xl flex-shrink-0">E</div>
            <div className="text-left">
              <p className="font-extrabold text-gray-900 text-lg">ESWARAN A/L PADMANATHAN</p>
              <p className="text-sm text-gray-500 mt-0.5">Founder · Silambam Instructor</p>
              <p className="text-sm text-gray-500">Persatuan Silambam Malaysia Daerah Sepang</p>
              <p className="text-xs text-yellow-600 mt-1 font-medium">📸 Photo coming soon</p>
            </div>
          </div>
        </div>
      </section>

      <section id="features" className="py-20 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-extrabold text-gray-900 mb-4">Complete Academy Management</h2>
            <p className="text-gray-500 text-lg max-w-xl mx-auto">From student enrollment to championship tracking, BeltFlow covers your entire academy workflow.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {features.map(f => (
              <div key={f.title} className="bg-white border border-gray-100 rounded-2xl p-6 hover:shadow-md transition-all hover:border-blue-100">
                <div className="w-12 h-12 bg-gray-900/5 rounded-xl flex items-center justify-center mb-4">
                  <f.icon size={24} className="text-gray-900" />
                </div>
                <h3 className="font-bold text-gray-900 mb-2">{f.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 px-4 bg-gray-900 text-white">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-extrabold mb-4">Who is BeltFlow For?</h2>
            <p className="text-white/60 text-lg">Designed for every role in your martial arts academy</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {[
              { emoji: "🏛️", title: "Academy Owners", desc: "Full control over finances, subscriptions, settings, and academy-wide reports." },
              { emoji: "🥷", title: "Coaches", desc: "Mark attendance, add performance notes, plan lessons, and track student progress." },
              { emoji: "👪", title: "Parents", desc: "View your child progress, pay fees online, and receive grading updates instantly." },
              { emoji: "🎯", title: "Students", desc: "Track your skill progress, view upcoming gradings, and celebrate tournament medals." },
            ].map(r => (
              <div key={r.title} className="bg-white/5 border border-white/10 rounded-2xl p-6 hover:bg-white/10 transition-all">
                <div className="text-4xl mb-4">{r.emoji}</div>
                <h3 className="font-bold text-white mb-2">{r.title}</h3>
                <p className="text-sm text-white/60 leading-relaxed">{r.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Demo Section */}
      <section id="demo" className="py-20 px-4 bg-[#0f172a]">
        <div className="max-w-4xl mx-auto text-center">
          <span className="inline-block bg-yellow-500 text-gray-900 text-xs font-bold px-4 py-1.5 rounded-full mb-4 uppercase tracking-wide">Try It Free — No Login Needed</span>
          <h2 className="text-3xl font-extrabold text-white mb-4">See BeltFlow in Action</h2>
          <p className="text-white/60 mb-10 max-w-xl mx-auto">Click any role below to explore the full dashboard with sample data. No account required.</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { role: 'admin',   label: 'Admin View',   desc: 'Full dashboard & all data', emoji: '🛡️', color: 'bg-white text-gray-900' },
              { role: 'coach',   label: 'Coach View',   desc: 'Classes & student progress', emoji: '🥋', color: 'bg-blue-600 text-white' },
              { role: 'parent',  label: 'Parent View',  desc: "Child's progress & payments", emoji: '👨‍👧', color: 'bg-green-600 text-white' },
              { role: 'student', label: 'Student View', desc: 'My profile & achievements', emoji: '⭐', color: 'bg-purple-600 text-white' },
            ].map(d => (
              <a key={d.role} href={`/demo/${d.role}`}
                className={`${d.color} rounded-2xl p-6 text-center hover:opacity-90 transition-all hover:scale-105 cursor-pointer block`}>
                <div className="text-4xl mb-3">{d.emoji}</div>
                <p className="font-extrabold text-sm">{d.label}</p>
                <p className="text-xs opacity-70 mt-1">{d.desc}</p>
              </a>
            ))}
          </div>
          <p className="text-white/30 text-xs mt-8">Demo uses sample data only. Register for a real account to manage your academy.</p>
        </div>
      </section>

      <section id="pricing" className="py-20 px-4 bg-gray-50">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-extrabold text-gray-900 mb-4">Plans for Every Academy</h2>
            <p className="text-gray-500 text-lg">Start free. Scale as you grow. No hidden fees.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {plans.map(p => (
              <div key={p.name} className={"bg-white border-2 " + p.border + " rounded-2xl p-6 relative hover:shadow-lg transition-all"}>
                {p.badge && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-yellow-500 text-white text-xs font-bold px-3 py-1 rounded-full whitespace-nowrap">{p.badge}</span>
                )}
                <h3 className="font-bold text-gray-900 text-lg mb-1">{p.name}</h3>
                <div className="mb-4">
                  <span className="text-3xl font-extrabold text-gray-900">{p.price}</span>
                  <span className="text-gray-400 text-sm">{p.period}</span>
                </div>
                <ul className="space-y-2 mb-6">
                  {p.features.map(f => (
                    <li key={f} className="flex items-start gap-2 text-sm text-gray-600">
                      <CheckCircle size={15} className="text-green-500 mt-0.5 flex-shrink-0" />{f}
                    </li>
                  ))}
                </ul>
                <Link href="/auth/signup" className="block text-center bg-gray-900 text-white text-sm font-semibold px-4 py-2.5 rounded-xl hover:bg-gray-800 transition-colors">
                  Get Started
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 px-4">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-extrabold text-gray-900 mb-4">Loved by Instructors Across Malaysia</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {testimonials.map(t => (
              <div key={t.name} className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
                <div className="flex gap-1 mb-4">{[...Array(5)].map((_, i) => <Star key={i} size={14} className="text-yellow-500 fill-yellow-500" />)}</div>
                <p className="text-gray-600 text-sm leading-relaxed mb-4">{t.text}</p>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-gray-900 rounded-full flex items-center justify-center text-white font-bold text-sm">{t.name[0]}</div>
                  <div>
                    <p className="font-semibold text-gray-900 text-sm">{t.name}</p>
                    <p className="text-xs text-gray-400">{t.role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 px-4 bg-gray-900 text-white">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-extrabold mb-6">Ready to Transform Your Academy?</h2>
          <p className="text-white/60 text-lg mb-10">Join hundreds of martial arts academies using BeltFlow to grow and run a professional operation.</p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/auth/signup" className="bg-yellow-500 text-white font-bold px-10 py-4 rounded-xl hover:bg-yellow-600 text-lg flex items-center gap-2 shadow-lg">
              Start Your Free Trial <ArrowRight size={20} />
            </Link>
            <Link href="/dashboard" className="bg-white/10 border border-white/20 text-white font-semibold px-8 py-4 rounded-xl hover:bg-white/20 text-lg">
              View Live Demo
            </Link>
          </div>
        </div>
      </section>

      <footer className="bg-gray-900 border-t border-white/10 py-8 px-4">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div>
            <span className="text-yellow-500 font-bold text-xl">BeltFlow</span>
            <p className="text-white/40 text-xs mt-1">Built for martial arts. Powered by progress.</p>
          </div>
          <p className="text-white/40 text-sm text-center">
            Created by <span className="text-white/70 font-medium">ESWARAN A/L PADMANATHAN</span>
          </p>
          <div className="flex items-center gap-4 text-sm text-white/40">
            <Link href="/auth/login" className="hover:text-white/70">Login</Link>
            <Link href="/auth/signup" className="hover:text-white/70">Sign Up</Link>
            <Link href="/dashboard" className="hover:text-white/70">Demo</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
