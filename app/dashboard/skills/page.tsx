'use client';
import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import Badge from '@/components/Badge';
import ProgressBar from '@/components/ProgressBar';
import Button from '@/components/Button';
import Modal from '@/components/Modal';
import FormInput from '@/components/FormInput';
import SelectInput from '@/components/SelectInput';
import { useAuth } from '@/lib/auth-context';
import { useLive } from '@/lib/useLive';
import { getSkills, getStudentSkills, getStudents, addSkill, deleteSkill, setSkillLevel } from '@/lib/db';
import { SkillLevel, SKILL_LEVELS, SKILL_LEVEL_LABEL, SKILL_LEVEL_PCT } from '@/lib/types';

const skillColor: Record<SkillLevel, 'red' | 'gold' | 'blue' | 'green'> = { not_started: 'red', learning: 'gold', good: 'blue', mastered: 'green' };
const btnColor: Record<SkillLevel, string> = { not_started: 'bg-red-500', learning: 'bg-yellow-500', good: 'bg-blue-500', mastered: 'bg-green-500' };

export default function SkillsPage() {
  const { currentUser } = useAuth();
  const isStaff = currentUser?.role === 'admin' || currentUser?.role === 'coach';
  const { data: skills } = useLive(getSkills, ['skills']);
  const { data: allStudentSkills, refetch } = useLive(() => getStudentSkills(), ['student_skills']);
  const { data: students } = useLive(getStudents, ['students']);

  const [tab, setTab] = useState<'curriculum' | 'tracker'>('curriculum');
  const [selStudent, setSelStudent] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: '', category: 'Foundation' });

  const student = selStudent || students?.[0]?.id || '';
  const categories = [...new Set((skills ?? []).map(s => s.category))];

  const setLevel = async (skillId: string, level: SkillLevel) => {
    if (!currentUser || !student) return;
    await setSkillLevel(student, skillId, level, currentUser.id);
    await refetch();
  };

  const createSkill = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    setSaving(true);
    try { await addSkill(currentUser.academyId, form.name, form.category, (skills?.length ?? 0) + 1); setShowModal(false); setForm({ name: '', category: 'Foundation' }); }
    finally { setSaving(false); }
  };

  const levelOf = (skillId: string): SkillLevel => (allStudentSkills ?? []).find(x => x.studentId === student && x.skillId === skillId)?.level ?? 'not_started';

  return (
    <div className="space-y-5 max-w-5xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div><h1 className="text-2xl font-extrabold text-gray-900">Skills & Curriculum</h1><p className="text-gray-500 text-sm mt-0.5">Track skill progress per student</p></div>
        {isStaff && <Button onClick={() => setShowModal(true)} variant="primary"><Plus size={16} /> Add Skill</Button>}
      </div>

      <div className="flex gap-2 bg-white rounded-xl border border-gray-100 p-1 w-fit">
        {(['curriculum', 'tracker'] as const).map(t => <button key={t} onClick={() => setTab(t)} className={`px-5 py-2 rounded-lg text-sm font-semibold capitalize ${tab === t ? 'bg-gray-900 text-white' : 'text-gray-500 hover:bg-gray-50'}`}>{t === 'curriculum' ? 'Curriculum' : 'Student Tracker'}</button>)}
      </div>

      {tab === 'curriculum' && (
        <div className="space-y-4">
          {categories.map(cat => (
            <div key={cat} className="bg-white rounded-xl border border-gray-100 shadow-sm">
              <div className="px-5 py-4 border-b border-gray-50"><h2 className="font-bold text-gray-900">{cat}</h2></div>
              <div className="divide-y divide-gray-50">
                {(skills ?? []).filter(s => s.category === cat).map(sk => (
                  <div key={sk.id} className="flex items-center justify-between px-5 py-4">
                    <div className="flex items-center gap-3"><div className="w-8 h-8 bg-yellow-50 rounded-lg flex items-center justify-center text-yellow-600 font-bold text-sm">{sk.sortOrder}</div><p className="font-semibold text-gray-900 text-sm">{sk.name}</p></div>
                    {isStaff && <button onClick={() => deleteSkill(sk.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500"><Trash2 size={14} /></button>}
                  </div>
                ))}
              </div>
            </div>
          ))}
          {categories.length === 0 && <div className="bg-white rounded-xl border border-gray-100 p-10 text-center text-gray-400 text-sm">No skills yet.</div>}
        </div>
      )}

      {tab === 'tracker' && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <SelectInput label="Select Student" value={student} onChange={e => setSelStudent(e.target.value)} options={(students ?? []).map(s => ({ value: s.id, label: `${s.fullName} — ${s.beltName} Belt` }))} />
          </div>
          {student && (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm divide-y divide-gray-50">
              {(skills ?? []).map(sk => {
                const lvl = levelOf(sk.id);
                return (
                  <div key={sk.id} className="px-5 py-4">
                    <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                      <p className="font-medium text-gray-900 text-sm">{sk.name}</p>
                      {isStaff ? (
                        <div className="flex gap-1.5">{SKILL_LEVELS.map(opt => <button key={opt} onClick={() => setLevel(sk.id, opt)} className={`px-2 py-1 rounded-lg text-xs font-semibold ${lvl === opt ? `${btnColor[opt]} text-white` : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>{SKILL_LEVEL_LABEL[opt]}</button>)}</div>
                      ) : <Badge label={SKILL_LEVEL_LABEL[lvl]} color={skillColor[lvl]} />}
                    </div>
                    <ProgressBar value={SKILL_LEVEL_PCT[lvl]} color={skillColor[lvl]} size="sm" />
                  </div>
                );
              })}
              {(skills ?? []).length === 0 && <div className="px-5 py-10 text-center text-gray-400 text-sm">No skills in the curriculum.</div>}
            </div>
          )}
        </div>
      )}

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Add Skill">
        <form onSubmit={createSkill} className="space-y-4">
          <FormInput label="Skill Name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. Basic Footwork" required />
          <SelectInput label="Category" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} options={['Foundation', 'Intermediate', 'Advanced'].map(c => ({ value: c, label: c }))} />
          <div className="flex gap-3 pt-2"><Button type="submit" variant="primary" className="flex-1" disabled={saving}>{saving ? 'Adding...' : 'Add Skill'}</Button><Button type="button" variant="secondary" onClick={() => setShowModal(false)}>Cancel</Button></div>
        </form>
      </Modal>
    </div>
  );
}
