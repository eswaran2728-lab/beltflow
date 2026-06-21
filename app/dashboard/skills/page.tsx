'use client';
import { useState } from 'react';
import { Plus, Edit2, Trash2, BookOpen } from 'lucide-react';
import Badge from '@/components/Badge';
import ProgressBar from '@/components/ProgressBar';
import Button from '@/components/Button';
import Modal from '@/components/Modal';
import FormInput from '@/components/FormInput';
import SelectInput from '@/components/SelectInput';
import { mockSkills, mockStudentSkills } from '@/data/skills';
import { mockStudents } from '@/data/students';
import { Skill, SkillProgress, StudentSkill } from '@/lib/types';

const progressColors: Record<SkillProgress, 'red' | 'gold' | 'blue' | 'green'> = {
  'Not Started': 'red', 'Learning': 'gold', 'Good': 'blue', 'Mastered': 'green',
};
const progressPct: Record<SkillProgress, number> = {
  'Not Started': 0, 'Learning': 33, 'Good': 66, 'Mastered': 100,
};
const progressOptions: SkillProgress[] = ['Not Started', 'Learning', 'Good', 'Mastered'];

export default function SkillsPage() {
  const [skills, setSkills] = useState(mockSkills);
  const [studentSkills, setStudentSkills] = useState(mockStudentSkills);
  const [selectedStudent, setSelectedStudent] = useState(mockStudents[0].id);
  const [tab, setTab] = useState<'curriculum' | 'tracker'>('curriculum');
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ name: '', category: 'Foundation', description: '' });

  const student = mockStudents.find(s => s.id === selectedStudent);
  const studentSkillMap = studentSkills.filter(s => s.studentId === selectedStudent);

  const getStudentSkill = (skillId: string): StudentSkill | undefined =>
    studentSkillMap.find(s => s.skillId === skillId);

  const updateProgress = (skillId: string, skillName: string, progress: SkillProgress) => {
    const existing = studentSkills.find(s => s.studentId === selectedStudent && s.skillId === skillId);
    if (existing) {
      setStudentSkills(studentSkills.map(s =>
        s.studentId === selectedStudent && s.skillId === skillId
          ? { ...s, progress, updatedAt: new Date().toISOString().split('T')[0] }
          : s
      ));
    } else {
      setStudentSkills([...studentSkills, {
        id: `ss${Date.now()}`, studentId: selectedStudent, skillId, skillName,
        progress, updatedAt: new Date().toISOString().split('T')[0],
      }]);
    }
  };

  const handleAddSkill = (e: React.FormEvent) => {
    e.preventDefault();
    const newSkill: Skill = {
      id: `sk${Date.now()}`, name: form.name, category: form.category,
      description: form.description, order: skills.length + 1,
    };
    setSkills([...skills, newSkill]);
    setShowModal(false);
    setForm({ name: '', category: 'Foundation', description: '' });
  };

  const categories = [...new Set(skills.map(s => s.category))];

  return (
    <div className="space-y-5 max-w-5xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900">Skills & Curriculum</h1>
          <p className="text-gray-500 text-sm mt-0.5">Track Silambam skill progress for each student</p>
        </div>
        <Button onClick={() => setShowModal(true)} variant="primary">
          <Plus size={16} /> Add Skill
        </Button>
      </div>

      <div className="flex gap-2 bg-white rounded-xl border border-gray-100 p-1 w-fit">
        {(['curriculum', 'tracker'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-5 py-2 rounded-lg text-sm font-semibold capitalize transition-all ${tab === t ? 'bg-gray-900 text-white' : 'text-gray-500 hover:bg-gray-50'}`}>
            {t === 'curriculum' ? 'Curriculum' : 'Student Tracker'}
          </button>
        ))}
      </div>

      {tab === 'curriculum' && (
        <div className="space-y-4">
          {categories.map(cat => (
            <div key={cat} className="bg-white rounded-xl border border-gray-100 shadow-sm">
              <div className="px-5 py-4 border-b border-gray-50">
                <h2 className="font-bold text-gray-900">{cat}</h2>
              </div>
              <div className="divide-y divide-gray-50">
                {skills.filter(s => s.category === cat).map(skill => (
                  <div key={skill.id} className="flex items-center justify-between px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-yellow-50 rounded-lg flex items-center justify-center text-yellow-600 font-bold text-sm flex-shrink-0">
                        {skill.order}
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900 text-sm">{skill.name}</p>
                        {skill.description && <p className="text-xs text-gray-400 mt-0.5">{skill.description}</p>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors text-gray-400">
                        <Edit2 size={14} />
                      </button>
                      <button onClick={() => setSkills(skills.filter(s => s.id !== skill.id))}
                        className="p-1.5 rounded-lg hover:bg-red-50 transition-colors text-gray-400 hover:text-red-500">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'tracker' && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <SelectInput label="Select Student" value={selectedStudent}
              onChange={e => setSelectedStudent(e.target.value)}
              options={mockStudents.map(s => ({ value: s.id, label: `${s.fullName} — ${s.beltRank} Belt` }))} />
          </div>

          {student && (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
              <div className="p-5 border-b border-gray-50 flex items-center gap-4">
                <div className="w-10 h-10 bg-gray-900 rounded-xl flex items-center justify-center text-white font-bold flex-shrink-0">
                  {student.fullName[0]}
                </div>
                <div>
                  <p className="font-bold text-gray-900">{student.fullName}</p>
                  <p className="text-xs text-gray-400">{student.beltRank} Belt · {student.classGroup}</p>
                </div>
              </div>
              <div className="divide-y divide-gray-50">
                {skills.map(skill => {
                  const studentSkill = getStudentSkill(skill.id);
                  const progress = studentSkill?.progress || 'Not Started';
                  return (
                    <div key={skill.id} className="px-5 py-4">
                      <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                        <p className="font-medium text-gray-900 text-sm">{skill.name}</p>
                        <div className="flex gap-1.5">
                          {progressOptions.map(opt => (
                            <button key={opt} onClick={() => updateProgress(skill.id, skill.name, opt)}
                              className={`px-2 py-1 rounded-lg text-xs font-semibold transition-all ${progress === opt ? `${opt === 'Not Started' ? 'bg-red-500' : opt === 'Learning' ? 'bg-yellow-500' : opt === 'Good' ? 'bg-blue-500' : 'bg-green-500'} text-white` : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
                              {opt}
                            </button>
                          ))}
                        </div>
                      </div>
                      <ProgressBar value={progressPct[progress]} color={progressColors[progress]} size="sm" />
                    </div>
                  );
                })}
              </div>
              <div className="px-5 py-4 bg-gray-50 rounded-b-xl border-t border-gray-50">
                <div className="grid grid-cols-4 gap-3">
                  {progressOptions.map(opt => (
                    <div key={opt} className="text-center">
                      <p className="text-xl font-bold text-gray-900">
                        {skills.filter(sk => (getStudentSkill(sk.id)?.progress || 'Not Started') === opt).length}
                      </p>
                      <p className="text-xs text-gray-400">{opt}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Add Skill">
        <form onSubmit={handleAddSkill} className="space-y-4">
          <FormInput label="Skill Name" value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="e.g. Basic Footwork" required />
          <SelectInput label="Category" value={form.category}
            onChange={e => setForm({...form, category: e.target.value})}
            options={['Foundation', 'Intermediate', 'Advanced'].map(c => ({ value: c, label: c }))} />
          <FormInput label="Description (optional)" value={form.description} onChange={e => setForm({...form, description: e.target.value})} placeholder="Brief description of this skill" />
          <div className="flex gap-3 pt-2">
            <Button type="submit" variant="primary" className="flex-1">Add Skill</Button>
            <Button type="button" variant="secondary" onClick={() => setShowModal(false)}>Cancel</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
