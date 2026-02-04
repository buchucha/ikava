
import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { Patient, Veterinarian, WaitlistEntry, Species, Breed } from '../types';
import { PatientDashboard } from './PatientDashboard';
import { supabase } from '../services/supabaseClient';

interface ReceptionPageProps {
  patients: Patient[];
  vets: Veterinarian[];
  waitlist: WaitlistEntry[];
  selectedPatientId: string;
  showDashboard: boolean;
  isAnyModalOpen?: boolean;
  onRegisterPatient: (data: Partial<Patient>) => Promise<Patient | null>;
  onUpdatePatient: (id: string, data: Partial<Patient>) => Promise<Patient | null>;
  onUpdateWaitlist: (id: string, updates: Partial<WaitlistEntry>) => Promise<void>;
  onAddToWaitlist: (entry: Partial<WaitlistEntry>) => Promise<void>;
  onRemoveFromWaitlist: (id: string) => Promise<void>;
  onSelectPatient: (pId: string) => void;
}

/**
 * Calculates birth_date from years and months age using local time.
 * Prevents "31st overflow" by setting date to 1st before calculating months.
 */
const getBirthDateFromAge = (years: number, months: number): string => {
  const d = new Date();
  d.setHours(0, 0, 0, 0); // Local midnight
  d.setDate(1); 
  d.setFullYear(d.getFullYear() - years);
  d.setMonth(d.getMonth() - months);
  
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  
  return `${y}-${m}-${day}`;
};

/**
 * Parses birth_date back into years and months using local time.
 */
const getAgeFromBirthDate = (birthDateStr?: string) => {
  if (!birthDateStr) return { years: 0, months: 0 };
  
  const [bYear, bMonth, bDay] = birthDateStr.split('-').map(Number);
  const birthDate = new Date(bYear, bMonth - 1, bDay);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  
  let years = now.getFullYear() - birthDate.getFullYear();
  let months = now.getMonth() - birthDate.getMonth();
  
  if (months < 0 || (months === 0 && now.getDate() < birthDate.getDate())) {
    years--;
    months += 12;
  }
  return { years: Math.max(0, years), months: Math.max(0, months) };
};

export const ReceptionPage: React.FC<ReceptionPageProps> = ({ 
  patients, 
  vets, 
  waitlist, 
  selectedPatientId,
  showDashboard,
  isAnyModalOpen,
  onRegisterPatient,
  onUpdatePatient,
  onUpdateWaitlist,
  onAddToWaitlist, 
  onRemoveFromWaitlist, 
  onSelectPatient 
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [showNewForm, setShowNewForm] = useState(false);
  const [editingPatientId, setEditingPatientId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [draggedItemId, setDraggedItemId] = useState<string | null>(null);
  const [draggedItemType, setDraggedItemType] = useState<'patient' | 'waitlist' | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  
  const [sidebarWidth, setSidebarWidth] = useState(320); 
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);

  const [collapsedVets, setCollapsedVets] = useState<Record<string, boolean>>({});

  // Breed Search State
  const [allBreeds, setAllBreeds] = useState<Breed[]>([]);
  const [showBreedList, setShowBreedList] = useState(false);

  const [newPatient, setNewPatient] = useState({
    chartNumber: '', // New field for Chart No
    name: '', owner: '', phone: '', breed: '', species: Species.DOG, gender: 'Intact Male'
  });
  const [ageYear, setAgeYear] = useState<string>('');
  const [ageMonth, setAgeMonth] = useState<string>('');

  useEffect(() => {
    const fetchBreeds = async () => {
      const { data } = await supabase.from('breeds').select('*').order('name');
      if (data) setAllBreeds(data);
    };
    fetchBreeds();
  }, []);

  const filteredBreeds = useMemo(() => {
    if (!newPatient.species) return [];
    const speciesMatch = allBreeds.filter(b => b.species === newPatient.species);
    const search = newPatient.breed.trim().toLowerCase();
    if (!search) return speciesMatch;
    return speciesMatch.filter(b => b.name.toLowerCase().includes(search));
  }, [allBreeds, newPatient.species, newPatient.breed]);

  const startResizing = useCallback(() => setIsResizing(true), []);
  const stopResizing = useCallback(() => setIsResizing(false), []);
  const resize = useCallback((e: MouseEvent) => {
    if (isResizing) {
      const newWidth = e.clientX;
      if (newWidth >= 250 && newWidth <= 600) setSidebarWidth(newWidth);
    }
  }, [isResizing]);

  useEffect(() => {
    window.addEventListener("mousemove", resize);
    window.addEventListener("mouseup", stopResizing);
    return () => {
      window.removeEventListener("mousemove", resize);
      window.removeEventListener("mouseup", stopResizing);
    };
  }, [resize, stopResizing]);

  const searchResults = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (query.length < 1) return [];
    const numericQuery = query.replace(/[^0-9]/g, "");
    return patients.filter(p => {
      const name = p.name.toLowerCase();
      const owner = p.owner.toLowerCase();
      const phone = p.phone.replace(/[^0-9]/g, "");
      const chartNo = (p.chartNumber || '').toLowerCase();
      return name.includes(query) || owner.includes(query) || (numericQuery.length > 0 && phone.includes(numericQuery)) || chartNo.includes(query);
    });
  }, [searchTerm, patients]);

  const handleRegisterOrUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      const birthDate = getBirthDateFromAge(parseInt(ageYear) || 0, parseInt(ageMonth) || 0);
      let result: Patient | null = null;
      // Map frontend chartNumber to DB chart_number
      const payload: any = { ...newPatient, birth_date: birthDate, chart_number: newPatient.chartNumber };
      delete payload.chartNumber; // Remove frontend key before sending if desired, though extra keys usually ignored if strict

      if (editingPatientId) {
        result = await onUpdatePatient(editingPatientId, payload);
      } else {
        result = await onRegisterPatient({ ...payload, avatar: `https://i.pravatar.cc/150?u=${newPatient.name}_${Date.now()}` });
      }
      if (result) {
        setShowNewForm(false);
        setEditingPatientId(null);
        onSelectPatient(result.id);
        setNewPatient({
          chartNumber: '',
          name: '', owner: '', phone: '', breed: '', species: Species.DOG, gender: 'Intact Male'
        });
        setAgeYear('');
        setAgeMonth('');
      }
    } catch (err) { console.error(err); } finally { setIsSubmitting(false); }
  };

  const handleEditPatient = (e: React.MouseEvent, p: Patient) => {
    e.preventDefault();
    e.stopPropagation();
    const age = getAgeFromBirthDate(p.birth_date);
    setNewPatient({
      chartNumber: p.chartNumber || '',
      name: p.name,
      owner: p.owner,
      phone: p.phone,
      breed: p.breed,
      species: p.species,
      gender: p.gender
    });
    setAgeYear(String(age.years));
    setAgeMonth(String(age.months));
    setEditingPatientId(p.id);
    onSelectPatient(''); 
    setShowNewForm(true);
  };

  const waitlistByVet = useMemo(() => {
    const groups: Record<string, WaitlistEntry[]> = { 'unassigned': [] };
    vets.forEach(v => groups[v.id] = []);
    waitlist.forEach(w => {
      const vid = w.vetId;
      if (vid && groups[vid]) groups[vid].push(w);
      else groups['unassigned'].push(w);
    });
    return groups;
  }, [waitlist, vets]);

  const handleDragStart = (e: React.DragEvent, id: string, type: 'patient' | 'waitlist') => {
    setDraggedItemId(id);
    setDraggedItemType(type);
    e.dataTransfer.effectAllowed = 'move';
    (e.currentTarget as HTMLElement).classList.add('opacity-50');
  };

  const handleDragEnd = (e: React.DragEvent) => {
    setDraggedItemId(null);
    setDraggedItemType(null);
    setDragOverId(null);
    (e.currentTarget as HTMLElement).classList.remove('opacity-50');
  };

  const handleDrop = async (e: React.DragEvent, targetVetId: string) => {
    e.preventDefault();
    if (!draggedItemId || !draggedItemType) return;
    if (draggedItemType === 'waitlist') {
      const entry = waitlist.find(w => w.id === draggedItemId);
      if (entry && entry.vetId !== targetVetId) await onUpdateWaitlist(draggedItemId, { vetId: targetVetId });
    } else if (draggedItemType === 'patient') {
      const p = patients.find(pat => pat.id === draggedItemId);
      if (p) await onAddToWaitlist({ patientId: p.id, patientName: p.name, breed: p.breed, ownerName: p.owner, vetId: targetVetId, memo: '', type: 'Consultation' });
    }
    setDragOverId(null);
  };

  const activePatient = useMemo(() => 
    patients.find(p => p.id === selectedPatientId) || null
  , [selectedPatientId, patients]);

  return (
    <div className={`flex h-full bg-slate-200 overflow-hidden text-xs font-sans ${isResizing ? 'cursor-col-resize select-none' : ''}`}>
      {/* Sidebar */}
      <div ref={sidebarRef} style={{ width: `${sidebarWidth}px` }} className="relative border-r border-slate-300 flex flex-col bg-white z-10">
        <div className="p-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <h2 className="font-bold text-gray-800">Patient Search</h2>
          <button 
            type="button"
            onClick={() => { 
              setShowNewForm(true); 
              setEditingPatientId(null); 
              setNewPatient({
                chartNumber: '',
                name: '', owner: '', phone: '', breed: '', species: Species.DOG, gender: 'Intact Male'
              });
              setAgeYear('');
              setAgeMonth('');
              onSelectPatient(''); 
            }}
            className="px-2 py-1 bg-blue-600 text-white rounded text-[10px] font-bold hover:bg-blue-700"
          >
            Register New
          </button>
        </div>
        
        <div className="p-2 border-b border-slate-200">
          <div className="relative">
            <input 
              type="text" 
              placeholder="Name / Owner / Phone..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-8 pr-2 py-1.5 bg-white border border-slate-300 rounded text-[11px] text-gray-900 outline-none focus:border-blue-500 font-bold placeholder:text-gray-400"
            />
            <i className="fas fa-search absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400"></i>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {searchTerm.trim().length > 0 && (
            <div className="p-1">
              <div className="px-2 py-1 bg-slate-100 text-[10px] font-bold text-gray-600 border-b border-slate-200 mb-1">Search Results</div>
              {searchResults.map(p => (
                <div 
                  key={p.id} 
                  draggable
                  onDragStart={(e) => handleDragStart(e, p.id, 'patient')}
                  onDragEnd={handleDragEnd}
                  onDoubleClick={() => { setShowNewForm(false); onSelectPatient(p.id); }}
                  className={`px-2 py-1.5 cursor-pointer border-b border-slate-100 flex items-center gap-2 hover:bg-blue-50 transition-colors group ${selectedPatientId === p.id ? 'bg-blue-50' : ''}`}
                >
                  <img src={p.avatar} className="w-8 h-8 rounded border border-slate-200 flex-shrink-0" alt="" />
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between">
                      <span className="font-black text-gray-900 truncate">{p.name}</span>
                      <span className="text-[10px] text-gray-600 font-bold">{p.breed}</span>
                    </div>
                    <div className="text-[10px] text-gray-500 flex justify-between">
                      <span className="truncate font-bold">{p.owner}</span>
                      <span className="font-bold">{p.phone.slice(-4)}</span>
                    </div>
                    {p.chartNumber && <div className="text-[9px] text-blue-600 font-mono mt-0.5">#{p.chartNumber}</div>}
                  </div>
                  <button 
                    type="button"
                    onClick={(e) => handleEditPatient(e, p)}
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-blue-600 bg-white border border-blue-200 shadow-sm hover:bg-blue-600 hover:text-white hover:border-blue-600 transition-all z-20"
                    title="Edit Patient Info"
                  >
                    <i className="fas fa-edit text-[11px]"></i>
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="p-1">
            <div className="px-2 py-1 bg-slate-100 text-[10px] font-bold text-gray-500 border-b border-slate-200 mb-1 flex justify-between items-center">
              <span>Live Waitlist</span>
              <span className="text-blue-600 font-bold">{waitlist.length} cases</span>
            </div>
            {vets.map(vet => (
              <div 
                key={vet.id} 
                className={`mb-1 border border-transparent rounded ${dragOverId === vet.id ? 'bg-blue-50 border-blue-300' : ''}`}
                onDragOver={(e) => { e.preventDefault(); setDragOverId(vet.id); }}
                onDrop={(e) => handleDrop(e, vet.id)}
              >
                <div 
                  onClick={() => setCollapsedVets(prev => ({ ...prev, [vet.id]: !prev[vet.id] }))}
                  className="px-2 py-1 bg-slate-50 border border-slate-200 flex justify-between items-center cursor-pointer hover:bg-slate-100"
                >
                  <span className="font-black text-gray-700">{vet.name}</span>
                  <span className="text-[10px] text-blue-600 font-black">{waitlistByVet[vet.id]?.length || 0}</span>
                </div>
                {!collapsedVets[vet.id] && (
                  <div className="min-h-[10px]">
                    {waitlistByVet[vet.id].map(w => (
                      <div 
                        key={w.id} 
                        draggable
                        onDragStart={(e) => handleDragStart(e, w.id, 'waitlist')}
                        onDoubleClick={() => onSelectPatient(w.patientId)}
                        className={`px-2 py-1.5 border-b border-slate-100 flex justify-between items-center hover:bg-slate-50 group cursor-pointer ${selectedPatientId === w.patientId ? 'bg-blue-50/30' : ''}`}
                      >
                        <div className="flex-1 truncate">
                          <span className="font-black text-gray-900">{w.patientName}</span>
                          <span className="ml-1 text-[10px] text-gray-500 font-bold">[{w.type}]</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-gray-500 font-bold">{w.time}</span>
                          <button onClick={(e) => { e.stopPropagation(); onRemoveFromWaitlist(w.id); }} className="text-gray-300 hover:text-rose-500 opacity-0 group-hover:opacity-100"><i className="fas fa-times"></i></button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}

            <div 
              className={`mt-2 border border-transparent rounded ${dragOverId === 'unassigned' ? 'bg-amber-50 border-amber-300' : ''}`}
              onDragOver={(e) => { e.preventDefault(); setDragOverId('unassigned'); }}
              onDrop={(e) => handleDrop(e, '')}
            >
              <div 
                onClick={() => setCollapsedVets(prev => ({ ...prev, unassigned: !prev.unassigned }))}
                className="px-2 py-1 bg-amber-50 border border-amber-200 flex justify-between items-center cursor-pointer"
              >
                <span className="font-black text-amber-900 uppercase tracking-tighter">Unassigned Queue</span>
                <span className="text-[10px] text-amber-900 font-black">{waitlistByVet['unassigned']?.length || 0}</span>
              </div>
              {!collapsedVets['unassigned'] && (
                <div className="min-h-[10px]">
                  {waitlistByVet['unassigned'].map(w => (
                    <div 
                      key={w.id} 
                      draggable 
                      onDragStart={(e) => handleDragStart(e, w.id, 'waitlist')} 
                      onDragEnd={handleDragEnd} 
                      onDoubleClick={() => onSelectPatient(w.patientId)}
                      className="px-2 py-1.5 border-b border-slate-100 flex justify-between items-center bg-white hover:bg-amber-50 group cursor-pointer"
                    >
                      <span className="font-black text-gray-900 truncate">{w.patientName}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-gray-500 font-bold">{w.time}</span>
                        <button onClick={(e) => { e.stopPropagation(); onRemoveFromWaitlist(w.id); }} className="text-gray-300 hover:text-rose-500"><i className="fas fa-times"></i></button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <div onMouseDown={startResizing} className="absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-blue-400 transition-colors z-20"></div>
      </div>

      {/* Main Area */}
      <div className="flex-1 flex flex-col overflow-hidden bg-slate-200 p-1">
        {activePatient ? (
          <div className="flex-1 bg-white border border-slate-300 rounded flex flex-col overflow-hidden shadow-sm relative">
            <div className="flex-1 overflow-hidden p-1 bg-slate-100">
              <PatientDashboard 
                patient={showDashboard ? activePatient : null} 
                onUpdatePatient={async (updates) => { await onUpdatePatient(activePatient.id, updates); }} 
              />
            </div>
          </div>
        ) : showNewForm ? (
          <div className="flex-1 bg-white border border-slate-300 rounded p-6 overflow-y-auto">
             <form onSubmit={handleRegisterOrUpdate} className="max-w-xl mx-auto space-y-6">
                <div className="flex items-center gap-3 border-b pb-4">
                  <div className="w-10 h-10 bg-blue-600 text-white rounded-xl flex items-center justify-center">
                    <i className={`fas ${editingPatientId ? 'fa-user-edit' : 'fa-user-plus'}`}></i>
                  </div>
                  <h2 className="text-xl font-black text-gray-900 tracking-tight">
                    {editingPatientId ? 'Edit Patient Info' : 'Register New Patient'}
                  </h2>
                </div>
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <label className="font-black text-[11px] text-gray-500 uppercase tracking-widest block">Owner Information</label>
                    <input required value={newPatient.owner} onChange={(e) => setNewPatient(p => ({ ...p, owner: e.target.value }))} placeholder="Owner Name *" className="w-full bg-white border border-slate-300 p-2.5 rounded-lg text-[13px] text-gray-900 font-black outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 shadow-sm placeholder:text-gray-400" />
                    <input required value={newPatient.phone} onChange={(e) => setNewPatient(p => ({ ...p, phone: e.target.value }))} placeholder="Phone Number *" className="w-full bg-white border border-slate-300 p-2.5 rounded-lg text-[13px] text-gray-900 font-black outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 shadow-sm placeholder:text-gray-400" />
                  </div>
                  <div className="space-y-4">
                    <label className="font-black text-[11px] text-gray-500 uppercase tracking-widest block">Patient Information</label>
                    <div className="grid grid-cols-3 gap-2">
                       <div className="col-span-2">
                          <input required value={newPatient.name} onChange={(e) => setNewPatient(p => ({ ...p, name: e.target.value }))} placeholder="Animal Name *" className="w-full bg-white border border-slate-300 p-2.5 rounded-lg text-[13px] text-gray-900 font-black outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 shadow-sm placeholder:text-gray-400" />
                       </div>
                       <div>
                          <input value={newPatient.chartNumber} onChange={(e) => setNewPatient(p => ({ ...p, chartNumber: e.target.value }))} placeholder="Chart No." className="w-full bg-slate-50 border border-slate-300 p-2.5 rounded-lg text-[13px] text-slate-700 font-mono font-black outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 shadow-sm placeholder:text-gray-400" title="PACS Equipment Patient ID" />
                       </div>
                    </div>
                    
                    <div className="flex flex-col gap-2">
                      <select value={newPatient.species} onChange={(e) => setNewPatient(p => ({ ...p, species: e.target.value as Species, breed: '' }))} className="w-full bg-white border border-slate-300 p-2.5 rounded-lg text-[13px] text-gray-900 font-black outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600">
                        <option value={Species.DOG} className="text-gray-900">Dog</option>
                        <option value={Species.CAT} className="text-gray-900">Cat</option>
                        <option value={Species.OTHER} className="text-gray-900">Other</option>
                      </select>
                      
                      <div className="space-y-2">
                        <label className="font-black text-[10px] text-gray-400 uppercase tracking-widest ml-1">Age (Years/Months)</label>
                        <div className="flex gap-2">
                          <div className="flex-1 relative">
                            <input required type="number" min="0" value={ageYear} onChange={(e) => setAgeYear(e.target.value)} placeholder="0" className="w-full bg-white border border-slate-300 p-2.5 rounded-lg text-[13px] text-gray-900 font-black text-center outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 shadow-sm" />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[9px] font-black text-slate-400 uppercase">Y</span>
                          </div>
                          <div className="flex-1 relative">
                            <input required type="number" min="0" max="11" value={ageMonth} onChange={(e) => setAgeMonth(e.target.value)} placeholder="0" className="w-full bg-white border border-slate-300 p-2.5 rounded-lg text-[13px] text-gray-900 font-black text-center outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 shadow-sm" />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[9px] font-black text-slate-400 uppercase">M</span>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="relative group">
                      <input 
                        value={newPatient.breed} 
                        onChange={(e) => {
                          setNewPatient(p => ({ ...p, breed: e.target.value }));
                          setShowBreedList(true);
                        }} 
                        onFocus={() => setShowBreedList(true)}
                        placeholder="Breed (Search...)" 
                        className="w-full bg-white border border-slate-300 p-2.5 rounded-lg text-[13px] text-gray-900 font-black outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 shadow-sm placeholder:text-gray-400" 
                      />
                      {showBreedList && (newPatient.species === Species.DOG || newPatient.species === Species.CAT) && filteredBreeds.length > 0 && (
                        <div className="absolute top-full left-0 right-0 mt-1 max-h-40 overflow-y-auto bg-white border border-slate-200 rounded-lg shadow-lg z-50">
                          {filteredBreeds.map(b => (
                            <div 
                              key={b.id} 
                              onMouseDown={() => {
                                setNewPatient(p => ({ ...p, breed: b.name }));
                                setShowBreedList(false);
                              }}
                              className="px-3 py-2 text-xs font-bold text-slate-700 hover:bg-blue-50 cursor-pointer"
                            >
                              {b.name}
                            </div>
                          ))}
                        </div>
                      )}
                      {showBreedList && (newPatient.species === Species.DOG || newPatient.species === Species.CAT) && filteredBreeds.length === 0 && newPatient.breed && (
                        <div 
                          className="absolute top-full left-0 right-0 mt-1 p-2 bg-white border border-slate-200 rounded-lg shadow-lg z-50 text-[10px] text-slate-400 font-black text-center"
                          onMouseDown={() => setShowBreedList(false)}
                        >
                          Use "{newPatient.breed}" (Custom)
                        </div>
                      )}
                      {/* Click outside backdrop for simple dropdown closing */}
                      {showBreedList && (
                        <div className="fixed inset-0 z-40 bg-transparent" onClick={() => setShowBreedList(false)}></div>
                      )}
                    </div>

                    <div className="space-y-2">
                       <label className="font-black text-[11px] text-gray-500 uppercase tracking-widest block">Gender</label>
                       <select value={newPatient.gender} onChange={(e) => setNewPatient(p => ({ ...p, gender: e.target.value }))} className="w-full bg-white border border-slate-300 p-2.5 rounded-lg text-[13px] text-gray-900 font-black outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600">
                          <option value="Intact Male">Intact Male (수컷)</option>
                          <option value="Castrated Male">Castrated Male (중성화 수컷)</option>
                          <option value="Intact Female">Intact Female (암컷)</option>
                          <option value="Spayed Female">Spayed Female (중성화 암컷)</option>
                       </select>
                    </div>
                  </div>
                </div>
                <div className="flex justify-end gap-3 pt-6 border-t">
                  <button type="button" onClick={() => setShowNewForm(false)} className="px-6 py-2.5 text-gray-500 font-black text-[12px] hover:text-gray-900 uppercase">Cancel</button>
                  <button type="submit" className="px-10 py-2.5 bg-slate-900 text-white rounded-xl font-black text-[12px] uppercase shadow-lg active:scale-95 transition-all">
                    {editingPatientId ? 'Save Changes' : 'Save & Register'}
                  </button>
                </div>
             </form>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-400 bg-white border border-slate-300 rounded">
            <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-6">
              <i className="fas fa-stethoscope text-3xl opacity-20 text-gray-400"></i>
            </div>
            <p className="font-black uppercase tracking-[0.2em] text-gray-400 text-center">Select a patient from the list (Double Click) to start consultation.</p>
          </div>
        )}
      </div>
    </div>
  );
};