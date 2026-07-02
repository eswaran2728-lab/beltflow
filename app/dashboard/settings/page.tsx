'use client';
import { useState } from 'react';
import { Save, Plus, Trash2, Building2, Users, BookOpen, DollarSign, Award } from 'lucide-react';
import Button from '@/components/Button';
import FormInput from '@/components/FormInput';
import Badge from '@/components/Badge';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { useLive } from '@/lib/useLive';
import {
  getSettings, getBranches, getClasses, getSkills,
  updateSettings, addBranch, deleteBranch, addClass, deleteClass, addSkill, deleteSkill,
} from '@/lib/db';
import { AcademySettings, BELT_LEVELS } from '@/lib/types';

const martialArts = ['Silambam', 'Karate', 'Taekwondo', 'Muay Thai', 'BJJ', 'Kung Fu', 'Other'];
const tabs = ['Academy', 'Branches & Classes', 'Belt Levels', 'Skills', 'Fees', 'Instructors'];

interface InstructorProfile {
  id: string;
  full_name: string;
  email: string;
  role: string;
}

export default function SettingsPage() {
  const { currentUser } = useAuth();
  const isAdmin = currentUser?.role === 'admin';
  const [tab, setTab] = useState('Academy');
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const { data: settings } = useLive(getSettings, ['academy_settings']);
  const { data: branches } = useLive(getBranches, ['branches']);
  const { data: classes } = useLive(getClasses, ['classes']);
  const { data: skills } = useLive(getSkills, ['skills']);
  const { data: instructors } = useLive(async () => {
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name, email, role')
      .in('role', ['admin', 'coach'])
      .eq('status', 'approved');
    return (data ?? []) as InstructorProfile[];
  }, ['profiles']);

  const [form, setForm] = useState<AcademySettings | null>(null);
  const [newSkill, setNewSkill] = useState({ name: '', category: 'Foundation' });
  const [newBranch, setNewBranch] = useState({ name: '', address: '', phone: '' });
  const [newClass, setNewClass] = useState({ name: '', schedule: '', branchId: '' });

  // Initialize the form once settings load (state adjusted during render)
  if (settings && form === null) setForm(settings);

  const handleSave = async () => {
    if (!form || !settings) return;
    setSaving(true);
    setError('');
    try {
      await updateSettings(settings.id, form);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save settings.');
    } finally {
      setSaving(false);
    }
  };

  const handleAddSkill = async () => {
    if (!newSkill.name) return;
    await addSkill({ name: newSkill.name, category: newSkill.category, order: (skills?.length ?? 0) + 1 });
    setNewSkill({ name: '', category: 'Foundation' });
  };

  const handleAddBranch = async () => {
    if (!newBranch.name) return;
    await addBranch(newBranch);
    setNewBranch({ name: '', address: '', phone: '' });
  };

  const handleAddClass = async () => {
    if (!newClass.name) return;
    await addClass({ name: newClass.name, schedule: newClass.schedule, branchId: newClass.branchId || null });
    setNewClass({ name: '', schedule: '', branchId: '' });
  };

  if (!isAdmin) {
    return (
      <div className="max-w-lg mx-auto text-center py-20">
        <p className="text-gray-500">Settings are managed by the academy admin.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5 max-w-4xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900">Settings</h1>
          <p className="text-gray-500 text-sm mt-0.5">Manage your academy configuration</p>
        </div>
        <Button onClick={handleSave} variant="primary" disabled={saving || !form}>
          <Save size={15} /> {saving ? 'Saving...' : saved ? 'Saved!' : 'Save Changes'}
        </Button>
      </div>

      {error && <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>}

      <div className="flex gap-1 flex-wrap bg-white rounded-xl border border-gray-100 p-1">
        {tabs.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${tab === t ? 'bg-gray-900 text-white' : 'text-gray-500 hover:bg-gray-50'}`}>
            {t}
          </button>
        ))}
      </div>

      {tab === 'Academy' && form && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-4">
          <h2 className="font-bold text-gray-900 flex items-center gap-2"><Building2 size={16} /> Academy Information</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="col-span-2">
              <FormInput label="Academy / Association Name" value={form.name}
                onChange={e => setForm({...form, name: e.target.value})} />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <textarea value={form.description} onChange={e => setForm({...form, description: e.target.value})}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 h-24 resize-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Martial Art Style</label>
              <select value={form.martialArtStyle} onChange={e => setForm({...form, martialArtStyle: e.target.value})}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                {martialArts.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <FormInput label="Phone" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} />
            <FormInput label="Email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} />
            <div className="col-span-2">
              <FormInput label="Address" value={form.address} onChange={e => setForm({...form, address: e.target.value})} />
            </div>
          </div>
        </div>
      )}

      {tab === 'Branches & Classes' && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <h2 className="font-bold text-gray-900 mb-4">Branches</h2>
            <div className="space-y-3 mb-4">
              {(branches ?? []).map(b => (
                <div key={b.id} className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-3">
                  <div>
                    <p className="font-semibold text-gray-900 text-sm">{b.name}</p>
                    <p className="text-xs text-gray-500">{[b.address, b.phone].filter(Boolean).join(' · ')}</p>
                  </div>
                  <button onClick={() => deleteBranch(b.id)}
                    className="text-red-400 hover:text-red-600 p-1.5 rounded-lg hover:bg-red-50">
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
              {(branches ?? []).length === 0 && <p className="text-sm text-gray-400">No branches yet. Add your first branch below.</p>}
            </div>
            <div className="border-t border-gray-50 pt-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Add Branch</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <FormInput label="Branch Name" value={newBranch.name} onChange={e => setNewBranch({...newBranch, name: e.target.value})} placeholder="e.g. Sungai Pelek" />
                <FormInput label="Address" value={newBranch.address} onChange={e => setNewBranch({...newBranch, address: e.target.value})} placeholder="Full address" />
                <FormInput label="Phone" value={newBranch.phone} onChange={e => setNewBranch({...newBranch, phone: e.target.value})} placeholder="03-xxxx xxxx" />
              </div>
              <Button size="sm" className="mt-3" onClick={handleAddBranch}><Plus size={14} /> Add Branch</Button>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <h2 className="font-bold text-gray-900 mb-4">Classes</h2>
            <div className="space-y-3 mb-4">
              {(classes ?? []).map(c => {
                const branch = branches?.find(b => b.id === c.branchId);
                return (
                  <div key={c.id} className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-3">
                    <div>
                      <p className="font-semibold text-gray-900 text-sm">{c.name}</p>
                      <p className="text-xs text-gray-500">{c.schedule}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {branch && <Badge label={branch.name} color="blue" />}
                      <button onClick={() => deleteClass(c.id)}
                        className="text-red-400 hover:text-red-600 p-1.5 rounded-lg hover:bg-red-50">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                );
              })}
              {(classes ?? []).length === 0 && <p className="text-sm text-gray-400">No classes yet. Add your first class below.</p>}
            </div>
            <div className="border-t border-gray-50 pt-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Add Class</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <FormInput label="Class Name" value={newClass.name} onChange={e => setNewClass({...newClass, name: e.target.value})} placeholder="e.g. Junior A" />
                <FormInput label="Schedule" value={newClass.schedule} onChange={e => setNewClass({...newClass, schedule: e.target.value})} placeholder="Tue & Fri 7:00 PM" />
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Branch</label>
                  <select value={newClass.branchId} onChange={e => setNewClass({...newClass, branchId: e.target.value})}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                    <option value="">No branch</option>
                    {(branches ?? []).map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                </div>
              </div>
              <Button size="sm" className="mt-3" onClick={handleAddClass}><Plus size={14} /> Add Class</Button>
            </div>
          </div>
        </div>
      )}

      {tab === 'Belt Levels' && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <h2 className="font-bold text-gray-900 flex items-center gap-2 mb-4"><Award size={16} /> Belt / Rank Levels</h2>
          <p className="text-sm text-gray-500 mb-4">These belt levels are used across the system for grading and student profiles.</p>
          <div className="flex flex-wrap gap-2">
            {BELT_LEVELS.map(b => (
              <div key={b} className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5">
                <span className="text-sm font-medium text-gray-800">{b}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'Skills' && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <h2 className="font-bold text-gray-900 flex items-center gap-2 mb-4"><BookOpen size={16} /> Skills / Curriculum</h2>
          <div className="space-y-2 mb-4">
            {(skills ?? []).map(s => (
              <div key={s.id} className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-3">
                <div>
                  <p className="font-semibold text-gray-900 text-sm">{s.name}</p>
                  <p className="text-xs text-gray-400">{s.category}</p>
                </div>
                <button onClick={() => deleteSkill(s.id)}
                  className="text-red-400 hover:text-red-600 p-1.5 rounded-lg hover:bg-red-50">
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
            {(skills ?? []).length === 0 && <p className="text-sm text-gray-400">No skills configured yet.</p>}
          </div>
          <div className="border-t border-gray-50 pt-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Add Skill</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="col-span-2">
                <FormInput label="Skill Name" value={newSkill.name} onChange={e => setNewSkill({...newSkill, name: e.target.value})} placeholder="e.g. Sedikuchi" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                <select value={newSkill.category} onChange={e => setNewSkill({...newSkill, category: e.target.value})}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                  {['Foundation', 'Intermediate', 'Advanced'].map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>
            <Button size="sm" className="mt-3" onClick={handleAddSkill}><Plus size={14} /> Add Skill</Button>
          </div>
        </div>
      )}

      {tab === 'Fees' && form && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <h2 className="font-bold text-gray-900 flex items-center gap-2 mb-4"><DollarSign size={16} /> Monthly Fee Settings</h2>
          <div className="max-w-xs">
            <label className="block text-sm font-medium text-gray-700 mb-1">Monthly Fee Amount (RM)</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-semibold text-sm">RM</span>
              <input type="number" value={form.monthlyFee} onChange={e => setForm({...form, monthlyFee: Number(e.target.value)})}
                className="w-full border border-gray-200 rounded-lg pl-10 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <p className="text-xs text-gray-400 mt-2">This will be the default monthly fee shown to parents during payment. Remember to press Save Changes.</p>
          </div>
          <div className="mt-5 bg-yellow-50 border border-yellow-100 rounded-xl p-4">
            <p className="text-sm font-semibold text-yellow-900">Current Fee: RM {settings?.monthlyFee ?? '—'}/month</p>
            <p className="text-xs text-yellow-700 mt-1">Changing the fee will not retroactively update existing payment records.</p>
          </div>
        </div>
      )}

      {tab === 'Instructors' && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <h2 className="font-bold text-gray-900 flex items-center gap-2 mb-4"><Users size={16} /> Instructors / Coaches</h2>
          <div className="space-y-3">
            {(instructors ?? []).map(i => (
              <div key={i.id} className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-gray-900 rounded-xl flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                    {i.full_name[0]}
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900 text-sm">{i.full_name}</p>
                    <p className="text-xs text-gray-500">{i.email}</p>
                  </div>
                </div>
                <Badge label={i.role === 'admin' ? 'Admin' : 'Coach'} color={i.role === 'admin' ? 'navy' : 'blue'} />
              </div>
            ))}
            {(instructors ?? []).length === 0 && <p className="text-sm text-gray-400">No approved instructors yet.</p>}
          </div>
          <p className="text-xs text-gray-400 mt-4">
            Coaches register from the signup page and appear here after you approve them in{' '}
            <Link href="/dashboard/approvals" className="text-blue-600 hover:underline">Approvals</Link>.
          </p>
        </div>
      )}
    </div>
  );
}
