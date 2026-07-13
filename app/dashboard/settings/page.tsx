'use client';
import { useState } from 'react';
import { Save, Plus, Trash2, Building2, BookOpen, DollarSign, Award, Users } from 'lucide-react';
import Button from '@/components/Button';
import FormInput from '@/components/FormInput';
import Badge from '@/components/Badge';
import { useAuth } from '@/lib/auth-context';
import { useLive } from '@/lib/useLive';
import {
  getAcademy, getBranches, getClasses, getBelts, getSkills, getCoachProfiles,
  updateAcademy, addBranch, deleteBranch, addClass, deleteClass, addBelt, deleteBelt,
  addSkill, deleteSkill, assignCoach, unassignCoach,
} from '@/lib/db';
import { Academy, DAY_NAMES } from '@/lib/types';

const tabs = ['Academy', 'Branches', 'Classes', 'Belts', 'Skills', 'Fees'];

export default function SettingsPage() {
  const { currentUser } = useAuth();
  const isAdmin = currentUser?.role === 'admin';
  const [tab, setTab] = useState('Academy');
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  const { data: academy } = useLive(getAcademy, ['academies']);
  const { data: branches } = useLive(getBranches, ['branches']);
  const { data: classes, refetch: refetchClasses } = useLive(getClasses, ['classes', 'class_coaches']);
  const { data: belts } = useLive(getBelts, ['belts']);
  const { data: skills } = useLive(getSkills, ['skills']);
  const { data: coaches } = useLive(getCoachProfiles, ['profiles']);

  const [form, setForm] = useState<Academy | null>(null);
  const [newBranch, setNewBranch] = useState({ name: '', address: '' });
  const [newClass, setNewClass] = useState({ name: '', branchId: '', dayOfWeek: '2', startTime: '19:00', endTime: '21:00', fee: '' });
  const [newBelt, setNewBelt] = useState({ name: '', color: '#3B82F6' });
  const [newSkill, setNewSkill] = useState({ name: '', category: 'Foundation' });

  if (academy && form === null) setForm(academy);

  if (!isAdmin) return <div className="max-w-lg mx-auto text-center py-20 text-gray-500">Settings are managed by the academy admin.</div>;

  const save = async () => {
    if (!form || !academy) return;
    setSaving(true);
    try { await updateAcademy(academy.id, form); setSaved(true); setTimeout(() => setSaved(false), 2000); }
    finally { setSaving(false); }
  };

  const aid = currentUser!.academyId;

  return (
    <div className="space-y-5 max-w-4xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div><h1 className="text-2xl font-extrabold text-gray-900">Settings</h1><p className="text-gray-500 text-sm mt-0.5">Manage your academy configuration</p></div>
        <Button onClick={save} variant="primary" disabled={saving || !form}><Save size={15} /> {saving ? 'Saving...' : saved ? 'Saved!' : 'Save Changes'}</Button>
      </div>

      <div className="flex gap-1 flex-wrap bg-white rounded-xl border border-gray-100 p-1">
        {tabs.map(t => <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all ${tab === t ? 'bg-gray-900 text-white' : 'text-gray-500 hover:bg-gray-50'}`}>{t}</button>)}
      </div>

      {tab === 'Academy' && form && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-4">
          <h2 className="font-bold text-gray-900 flex items-center gap-2"><Building2 size={16} /> Academy Information</h2>
          <FormInput label="Academy / Association Name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 h-24 resize-none" />
          </div>
        </div>
      )}

      {tab === 'Branches' && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <h2 className="font-bold text-gray-900 mb-4">Branches</h2>
          <div className="space-y-3 mb-4">
            {(branches ?? []).map(b => (
              <div key={b.id} className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-3">
                <div><p className="font-semibold text-gray-900 text-sm">{b.name}</p><p className="text-xs text-gray-500">{b.address}</p></div>
                <button onClick={() => deleteBranch(b.id)} className="text-red-400 hover:text-red-600 p-1.5 rounded-lg hover:bg-red-50"><Trash2 size={14} /></button>
              </div>
            ))}
            {(branches ?? []).length === 0 && <p className="text-sm text-gray-400">No branches yet.</p>}
          </div>
          <div className="border-t border-gray-50 pt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <FormInput label="Branch Name" value={newBranch.name} onChange={e => setNewBranch({ ...newBranch, name: e.target.value })} placeholder="e.g. Sungai Pelek" />
            <FormInput label="Address" value={newBranch.address} onChange={e => setNewBranch({ ...newBranch, address: e.target.value })} placeholder="Full address" />
          </div>
          <Button size="sm" className="mt-3" onClick={async () => { if (newBranch.name) { await addBranch(aid, newBranch.name, newBranch.address); setNewBranch({ name: '', address: '' }); } }}><Plus size={14} /> Add Branch</Button>
        </div>
      )}

      {tab === 'Classes' && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <h2 className="font-bold text-gray-900 mb-4">Classes</h2>
          <div className="space-y-3 mb-4">
            {(classes ?? []).map(c => (
              <div key={c.id} className="bg-gray-50 rounded-xl px-4 py-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-gray-900 text-sm">{c.name}</p>
                    <p className="text-xs text-gray-500">{c.dayOfWeek != null ? `${DAY_NAMES[c.dayOfWeek]} ${c.startTime ?? ''}–${c.endTime ?? ''}` : c.scheduleNote}{c.monthlyFeeOverride != null ? ` · RM${c.monthlyFeeOverride}` : ''}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {(branches ?? []).find(b => b.id === c.branchId) && <Badge label={branches!.find(b => b.id === c.branchId)!.name} color="blue" />}
                    <button onClick={() => deleteClass(c.id)} className="text-red-400 hover:text-red-600 p-1.5 rounded-lg hover:bg-red-50"><Trash2 size={14} /></button>
                  </div>
                </div>
                <div className="mt-2 flex items-center gap-2 flex-wrap">
                  <span className="text-xs text-gray-400 flex items-center gap-1"><Users size={11} /> Coaches:</span>
                  {c.coachNames.length ? c.coachNames.map((n, i) => (
                    <span key={i} className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 text-xs px-2 py-0.5 rounded-full">
                      {n}<button onClick={() => unassignCoach(c.id, c.coachIds[i])} className="hover:text-red-500">×</button>
                    </span>
                  )) : <span className="text-xs text-gray-400">none</span>}
                  {(coaches ?? []).filter(co => !c.coachIds.includes(co.id)).length > 0 && (
                    <select onChange={e => { if (e.target.value) { assignCoach(c.id, e.target.value).then(refetchClasses); e.target.value = ''; } }} className="border border-gray-200 rounded px-1.5 py-0.5 text-xs bg-white">
                      <option value="">+ assign coach</option>
                      {(coaches ?? []).filter(co => !c.coachIds.includes(co.id)).map(co => <option key={co.id} value={co.id}>{co.fullName}</option>)}
                    </select>
                  )}
                </div>
              </div>
            ))}
            {(classes ?? []).length === 0 && <p className="text-sm text-gray-400">No classes yet.</p>}
          </div>
          <div className="border-t border-gray-50 pt-4 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <FormInput label="Class Name" value={newClass.name} onChange={e => setNewClass({ ...newClass, name: e.target.value })} placeholder="e.g. Junior A" />
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Branch</label>
                <select value={newClass.branchId} onChange={e => setNewClass({ ...newClass, branchId: e.target.value })} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white">
                  <option value="">No branch</option>{(branches ?? []).map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Day</label>
                <select value={newClass.dayOfWeek} onChange={e => setNewClass({ ...newClass, dayOfWeek: e.target.value })} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white">
                  {DAY_NAMES.map((d, i) => <option key={i} value={i}>{d}</option>)}
                </select>
              </div>
              <FormInput label="Start" type="time" value={newClass.startTime} onChange={e => setNewClass({ ...newClass, startTime: e.target.value })} />
              <FormInput label="End" type="time" value={newClass.endTime} onChange={e => setNewClass({ ...newClass, endTime: e.target.value })} />
              <FormInput label="Fee (opt)" type="number" value={newClass.fee} onChange={e => setNewClass({ ...newClass, fee: e.target.value })} placeholder="default" />
            </div>
            <Button size="sm" onClick={async () => {
              if (!newClass.name) return;
              await addClass(aid, { name: newClass.name, branchId: newClass.branchId || null, dayOfWeek: parseInt(newClass.dayOfWeek), startTime: newClass.startTime, endTime: newClass.endTime, scheduleNote: '', monthlyFeeOverride: newClass.fee ? parseFloat(newClass.fee) : null });
              setNewClass({ name: '', branchId: '', dayOfWeek: '2', startTime: '19:00', endTime: '21:00', fee: '' });
            }}><Plus size={14} /> Add Class</Button>
          </div>
        </div>
      )}

      {tab === 'Belts' && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <h2 className="font-bold text-gray-900 flex items-center gap-2 mb-4"><Award size={16} /> Belt / Rank Levels</h2>
          <div className="flex flex-wrap gap-2 mb-4">
            {(belts ?? []).map(b => (
              <div key={b.id} className="flex items-center gap-1.5 border border-gray-200 rounded-lg px-3 py-1.5">
                <span className="w-3 h-3 rounded-full" style={{ background: b.colorHex }} />
                <span className="text-sm font-medium text-gray-800">{b.name}</span>
                <button onClick={() => deleteBelt(b.id)} className="text-gray-300 hover:text-red-400"><Trash2 size={12} /></button>
              </div>
            ))}
          </div>
          <div className="border-t border-gray-50 pt-4 flex items-end gap-3">
            <FormInput label="Belt Name" value={newBelt.name} onChange={e => setNewBelt({ ...newBelt, name: e.target.value })} placeholder="e.g. Green" />
            <input type="color" value={newBelt.color} onChange={e => setNewBelt({ ...newBelt, color: e.target.value })} className="h-10 w-14 rounded border border-gray-200" />
            <Button size="sm" onClick={async () => { if (newBelt.name) { await addBelt(aid, newBelt.name, newBelt.color, (belts?.length ?? 0) + 1); setNewBelt({ name: '', color: '#3B82F6' }); } }}><Plus size={14} /> Add</Button>
          </div>
        </div>
      )}

      {tab === 'Skills' && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <h2 className="font-bold text-gray-900 flex items-center gap-2 mb-4"><BookOpen size={16} /> Skills / Curriculum</h2>
          <div className="space-y-2 mb-4">
            {(skills ?? []).map(s => (
              <div key={s.id} className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-3">
                <div><p className="font-semibold text-gray-900 text-sm">{s.name}</p><p className="text-xs text-gray-400">{s.category}</p></div>
                <button onClick={() => deleteSkill(s.id)} className="text-red-400 hover:text-red-600 p-1.5 rounded-lg hover:bg-red-50"><Trash2 size={14} /></button>
              </div>
            ))}
            {(skills ?? []).length === 0 && <p className="text-sm text-gray-400">No skills yet.</p>}
          </div>
          <div className="border-t border-gray-50 pt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="col-span-2"><FormInput label="Skill Name" value={newSkill.name} onChange={e => setNewSkill({ ...newSkill, name: e.target.value })} placeholder="e.g. Sedikuchi" /></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
              <select value={newSkill.category} onChange={e => setNewSkill({ ...newSkill, category: e.target.value })} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white">
                {['Foundation', 'Intermediate', 'Advanced'].map(c => <option key={c} value={c}>{c}</option>)}
              </select></div>
          </div>
          <Button size="sm" className="mt-3" onClick={async () => { if (newSkill.name) { await addSkill(aid, newSkill.name, newSkill.category, (skills?.length ?? 0) + 1); setNewSkill({ name: '', category: 'Foundation' }); } }}><Plus size={14} /> Add Skill</Button>
        </div>
      )}

      {tab === 'Fees' && form && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <h2 className="font-bold text-gray-900 flex items-center gap-2 mb-4"><DollarSign size={16} /> Default Monthly Fee</h2>
          <div className="max-w-xs">
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-semibold text-sm">RM</span>
              <input type="number" value={form.monthlyFeeDefault} onChange={e => setForm({ ...form, monthlyFeeDefault: Number(e.target.value) })} className="w-full border border-gray-200 rounded-lg pl-10 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <p className="text-xs text-gray-400 mt-2">Used when a class has no fee override. Press Save Changes to apply.</p>
          </div>
        </div>
      )}
    </div>
  );
}
