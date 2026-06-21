'use client';
import { useState } from 'react';
import { Save, Plus, Trash2, Building2, Users, BookOpen, DollarSign, Award } from 'lucide-react';
import Button from '@/components/Button';
import FormInput from '@/components/FormInput';
import Badge from '@/components/Badge';
import { mockAcademySettings } from '@/data/academySettings';
import { mockAcademy } from '@/lib/mock-db';
import { BeltRank } from '@/lib/types';

const belts: BeltRank[] = ['White', 'Yellow', 'Orange', 'Green', 'Blue', 'Purple', 'Brown', 'Red', 'Black'];
const martialArts = ['Silambam', 'Karate', 'Taekwondo', 'Muay Thai', 'BJJ', 'Kung Fu', 'Other'];
const tabs = ['Academy', 'Branches & Classes', 'Belt Levels', 'Skills', 'Fees', 'Instructors'];

export default function SettingsPage() {
  const [tab, setTab] = useState('Academy');
  const [saved, setSaved] = useState(false);

  // Academy settings state
  const [academy, setAcademy] = useState({ ...mockAcademy });
  const [settings, setSettings] = useState({ ...mockAcademySettings });
  const [newSkill, setNewSkill] = useState({ name: '', category: 'Foundation' });
  const [newBranch, setNewBranch] = useState({ name: '', address: '', phone: '' });
  const [monthlyFee, setMonthlyFee] = useState(mockAcademySettings.monthlyFee);

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const addSkill = () => {
    if (!newSkill.name) return;
    setSettings({
      ...settings,
      skills: [...settings.skills, { id: `sk${Date.now()}`, name: newSkill.name, category: newSkill.category, order: settings.skills.length + 1 }],
    });
    setNewSkill({ name: '', category: 'Foundation' });
  };

  const addBranch = () => {
    if (!newBranch.name) return;
    setSettings({
      ...settings,
      branches: [...settings.branches, { id: `b${Date.now()}`, academyId: 'academy1', ...newBranch }],
    });
    setNewBranch({ name: '', address: '', phone: '' });
  };

  return (
    <div className="space-y-5 max-w-4xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900">Settings</h1>
          <p className="text-gray-500 text-sm mt-0.5">Manage your academy configuration</p>
        </div>
        <Button onClick={handleSave} variant="primary">
          <Save size={15} /> {saved ? 'Saved!' : 'Save Changes'}
        </Button>
      </div>

      <div className="flex gap-1 flex-wrap bg-white rounded-xl border border-gray-100 p-1">
        {tabs.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${tab === t ? 'bg-gray-900 text-white' : 'text-gray-500 hover:bg-gray-50'}`}>
            {t}
          </button>
        ))}
      </div>

      {tab === 'Academy' && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-4">
          <h2 className="font-bold text-gray-900 flex items-center gap-2"><Building2 size={16} /> Academy Information</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="col-span-2">
              <FormInput label="Academy / Association Name" value={academy.name}
                onChange={e => setAcademy({...academy, name: e.target.value})} />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <textarea value={academy.description} onChange={e => setAcademy({...academy, description: e.target.value})}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 h-24 resize-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Martial Art Style</label>
              <select value={settings.martialArtStyle} onChange={e => setSettings({...settings, martialArtStyle: e.target.value})}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                {martialArts.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <FormInput label="Phone" value={academy.phone} onChange={e => setAcademy({...academy, phone: e.target.value})} />
            <FormInput label="Email" value={academy.email} onChange={e => setAcademy({...academy, email: e.target.value})} />
            <div className="col-span-2">
              <FormInput label="Address" value={academy.address} onChange={e => setAcademy({...academy, address: e.target.value})} />
            </div>
          </div>
        </div>
      )}

      {tab === 'Branches & Classes' && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <h2 className="font-bold text-gray-900 mb-4">Branches</h2>
            <div className="space-y-3 mb-4">
              {settings.branches.map(b => (
                <div key={b.id} className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-3">
                  <div>
                    <p className="font-semibold text-gray-900 text-sm">{b.name}</p>
                    <p className="text-xs text-gray-500">{b.address} · {b.phone}</p>
                  </div>
                  <button onClick={() => setSettings({...settings, branches: settings.branches.filter(br => br.id !== b.id)})}
                    className="text-red-400 hover:text-red-600 p-1.5 rounded-lg hover:bg-red-50">
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
            <div className="border-t border-gray-50 pt-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Add Branch</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <FormInput label="Branch Name" value={newBranch.name} onChange={e => setNewBranch({...newBranch, name: e.target.value})} placeholder="e.g. Nilai Branch" />
                <FormInput label="Address" value={newBranch.address} onChange={e => setNewBranch({...newBranch, address: e.target.value})} placeholder="Full address" />
                <FormInput label="Phone" value={newBranch.phone} onChange={e => setNewBranch({...newBranch, phone: e.target.value})} placeholder="03-xxxx xxxx" />
              </div>
              <Button size="sm" className="mt-3" onClick={addBranch}><Plus size={14} /> Add Branch</Button>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <h2 className="font-bold text-gray-900 mb-4">Classes</h2>
            <div className="space-y-3">
              {settings.classes.map(c => (
                <div key={c.id} className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-3">
                  <div>
                    <p className="font-semibold text-gray-900 text-sm">{c.name}</p>
                    <p className="text-xs text-gray-500">{c.schedule}</p>
                  </div>
                  <Badge label={c.branchId === 'b1' ? 'Sepang Main' : 'Nilai Branch'} color="blue" />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {tab === 'Belt Levels' && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <h2 className="font-bold text-gray-900 flex items-center gap-2 mb-4"><Award size={16} /> Belt / Rank Levels</h2>
          <p className="text-sm text-gray-500 mb-4">These belt levels are used across the system for grading and student profiles.</p>
          <div className="flex flex-wrap gap-2 mb-6">
            {settings.beltLevels.map(b => (
              <div key={b} className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5">
                <span className="text-sm font-medium text-gray-800">{b}</span>
                <button onClick={() => setSettings({...settings, beltLevels: settings.beltLevels.filter(bl => bl !== b)})}
                  className="text-gray-300 hover:text-red-400 transition-colors"><Trash2 size={12} /></button>
              </div>
            ))}
          </div>
          <div className="border-t border-gray-50 pt-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Add Belt Level</h3>
            <div className="flex gap-2">
              <select className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                onChange={e => { if (e.target.value) { setSettings({...settings, beltLevels: [...settings.beltLevels, e.target.value as BeltRank]}); e.target.value = ''; }}}>
                <option value="">Select belt to add...</option>
                {belts.filter(b => !settings.beltLevels.includes(b)).map(b => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>
          </div>
        </div>
      )}

      {tab === 'Skills' && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <h2 className="font-bold text-gray-900 flex items-center gap-2 mb-4"><BookOpen size={16} /> Skills / Curriculum</h2>
          <div className="space-y-2 mb-4">
            {(settings.skills.length > 0 ? settings.skills : [{id: 'sk1', name: 'Basic Footwork', category: 'Foundation', order: 1}, {id: 'sk2', name: 'Single Stick Spinning', category: 'Foundation', order: 2}]).map(s => (
              <div key={s.id} className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-3">
                <div>
                  <p className="font-semibold text-gray-900 text-sm">{s.name}</p>
                  <p className="text-xs text-gray-400">{s.category}</p>
                </div>
                <button onClick={() => setSettings({...settings, skills: settings.skills.filter(sk => sk.id !== s.id)})}
                  className="text-red-400 hover:text-red-600 p-1.5 rounded-lg hover:bg-red-50">
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
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
            <Button size="sm" className="mt-3" onClick={addSkill}><Plus size={14} /> Add Skill</Button>
          </div>
        </div>
      )}

      {tab === 'Fees' && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <h2 className="font-bold text-gray-900 flex items-center gap-2 mb-4"><DollarSign size={16} /> Monthly Fee Settings</h2>
          <div className="max-w-xs">
            <label className="block text-sm font-medium text-gray-700 mb-1">Monthly Fee Amount (RM)</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-semibold text-sm">RM</span>
              <input type="number" value={monthlyFee} onChange={e => setMonthlyFee(Number(e.target.value))}
                className="w-full border border-gray-200 rounded-lg pl-10 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <p className="text-xs text-gray-400 mt-2">This will be the default monthly fee shown to parents during payment.</p>
          </div>
          <div className="mt-5 bg-yellow-50 border border-yellow-100 rounded-xl p-4">
            <p className="text-sm font-semibold text-yellow-900">Current Fee: RM {monthlyFee}/month</p>
            <p className="text-xs text-yellow-700 mt-1">Changing the fee will not retroactively update existing payment records.</p>
          </div>
        </div>
      )}

      {tab === 'Instructors' && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <h2 className="font-bold text-gray-900 flex items-center gap-2 mb-4"><Users size={16} /> Instructors / Coaches</h2>
          <div className="space-y-3">
            {[
              { name: 'Eswaran Padmanathan', role: 'Admin / Instructor', email: 'admin@beltflow.my' },
              { name: 'Coach Mani', role: 'Senior Coach', email: 'mani@beltflow.my' },
              { name: 'Coach Siva', role: 'Coach', email: 'siva@beltflow.my' },
            ].map(i => (
              <div key={i.email} className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-gray-900 rounded-xl flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                    {i.name[0]}
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900 text-sm">{i.name}</p>
                    <p className="text-xs text-gray-500">{i.role} · {i.email}</p>
                  </div>
                </div>
                <Badge label={i.role === 'Admin / Instructor' ? 'Admin' : 'Coach'} color={i.role.includes('Admin') ? 'navy' : 'blue'} />
              </div>
            ))}
          </div>
          <Button size="sm" className="mt-4" variant="secondary"><Plus size={14} /> Invite Instructor</Button>
        </div>
      )}
    </div>
  );
}
