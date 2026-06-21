"use client";
import { useRouter } from "next/navigation";

const roles = [
  { id: "admin", emoji: "🏛️", title: "Admin / School Owner", desc: "Manage the entire academy, finances, students, coaches, and subscription.", color: "border-gray-900 hover:bg-gray-900" },
  { id: "coach", emoji: "🥷", title: "Coach / Instructor", desc: "View your classes, mark attendance, add student notes, and approve payments.", color: "border-blue-500 hover:bg-blue-500" },
  { id: "parent", emoji: "👪", title: "Parent", desc: "View your child progress, attendance, upcoming gradings, and pay monthly fees.", color: "border-green-500 hover:bg-green-500" },
  { id: "student", emoji: "🎯", title: "Student", desc: "Track your skills, view your belt progress, upcoming gradings, and tournament medals.", color: "border-yellow-500 hover:bg-yellow-500" },
];

export default function RoleSelectPage() {
  const router = useRouter();
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-xl">
        <div className="text-center mb-8">
          <span className="text-3xl font-extrabold text-yellow-500">BeltFlow</span>
          <h1 className="text-2xl font-bold text-gray-900 mt-4">Select Your Role</h1>
          <p className="text-gray-500 mt-2">How will you be using BeltFlow?</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {roles.map(r => (
            <button key={r.id} onClick={() => router.push("/dashboard")}
              className={"bg-white border-2 rounded-2xl p-6 text-left transition-all group " + r.color + " hover:text-white"}>
              <div className="text-4xl mb-3">{r.emoji}</div>
              <h3 className="font-bold text-gray-900 group-hover:text-white mb-1 transition-colors">{r.title}</h3>
              <p className="text-sm text-gray-500 group-hover:text-white/80 leading-relaxed transition-colors">{r.desc}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
