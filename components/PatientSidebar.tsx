
import React from 'react';
import { Patient, Veterinarian, WaitlistEntry } from '../types';

interface PatientSidebarProps {
  width: number;
  searchTerm: string;
  onSearchChange: (val: string) => void;
  searchResults: Patient[];
  selectedPatientId: string;
  onSelectPatient: (id: string) => void;
  waitlist: WaitlistEntry[];
  vets: Veterinarian[];
  waitlistByVet: Record<string, WaitlistEntry[]>;
  collapsedVets: Record<string, boolean>;
  onToggleVet: (id: string) => void;
  onRemoveFromWaitlist: (id: string) => void;
  onDragStart: (e: React.DragEvent, id: string, type: 'patient' | 'waitlist') => void;
  onDragEnd: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent, targetVetId: string) => void;
  onStartResizing: () => void;
  dragOverId: string | null;
  setDragOverId: (id: string | null) => void;
}

export const PatientSidebar: React.FC<PatientSidebarProps> = ({
  width, searchTerm, onSearchChange, searchResults, selectedPatientId, onSelectPatient,
  waitlist, vets, waitlistByVet, collapsedVets, onToggleVet, onRemoveFromWaitlist,
  onDragStart, onDragEnd, onDrop, onStartResizing, dragOverId, setDragOverId
}) => {
  return (
    <div 
      style={{ width: `${width}px` }} 
      className="relative border-r border-slate-300 flex flex-col bg-white z-10 flex-shrink-0 text-xs font-sans"
    >
      {/* Header - Matched with Reception */}
      <div className="p-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
        <h2 className="font-bold text-gray-800 text-xs">Patient Search</h2>
      </div>
      
      {/* Search Input - Matched with Reception */}
      <div className="p-2 border-b border-slate-200">
        <div className="relative">
          <input 
            type="text" 
            placeholder="Name / Owner / Phone..." 
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full pl-8 pr-2 py-1.5 bg-white border border-slate-300 rounded text-[11px] text-gray-900 outline-none focus:border-blue-500 font-bold placeholder:text-gray-400"
          />
          <i className="fas fa-search absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400"></i>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {/* Search Results - Matched with Reception */}
        {searchTerm.trim().length > 0 && (
          <div className="p-1">
            <div className="px-2 py-1 bg-slate-100 text-[10px] font-bold text-gray-600 border-b border-slate-200 mb-1">Search Results</div>
            {searchResults.map(p => (
              <div 
                key={p.id} 
                draggable
                onDragStart={(e) => onDragStart(e, p.id, 'patient')}
                onDragEnd={onDragEnd}
                onDoubleClick={() => onSelectPatient(p.id)}
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
                    {p.phone && <span className="font-bold">{p.phone.slice(-4)}</span>}
                  </div>
                  {p.chartNumber && <div className="text-[9px] text-blue-600 font-mono mt-0.5">#{p.chartNumber}</div>}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Waitlist Sections - Matched with Reception */}
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
              onDragLeave={() => setDragOverId(null)}
              onDrop={(e) => onDrop(e, vet.id)}
            >
              <div 
                onClick={() => onToggleVet(vet.id)}
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
                      onDragStart={(e) => onDragStart(e, w.id, 'waitlist')}
                      onDragEnd={onDragEnd}
                      onDoubleClick={() => onSelectPatient(w.patientId)}
                      className={`px-2 py-1.5 border-b border-slate-100 flex justify-between items-center hover:bg-slate-50 group cursor-pointer ${selectedPatientId === w.patientId ? 'bg-blue-50/30' : ''}`}
                    >
                      <div className="flex-1 truncate">
                        <span className="font-black text-gray-900">{w.patientName}</span>
                        <span className="ml-1 text-[10px] text-gray-400 font-bold">[{w.type}]</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-gray-500 font-bold">{w.time}</span>
                        <button 
                          onClick={(e) => { e.stopPropagation(); onRemoveFromWaitlist(w.id); }} 
                          className="text-gray-300 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <i className="fas fa-times"></i>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}

          {/* Unassigned Queue - Matched with Reception */}
          <div 
            className={`mt-2 border border-transparent rounded ${dragOverId === 'unassigned' ? 'bg-amber-50 border-amber-300' : ''}`}
            onDragOver={(e) => { e.preventDefault(); setDragOverId('unassigned'); }}
            onDragLeave={() => setDragOverId(null)}
            onDrop={(e) => onDrop(e, '')}
          >
            <div 
              onClick={() => onToggleVet('unassigned')}
              className="px-2 py-1 bg-[#fffbeb] border border-[#fde68a] flex justify-between items-center cursor-pointer"
            >
              <span className="font-black text-[#78350f] uppercase tracking-tighter">UNASSIGNED QUEUE</span>
              <span className="text-[10px] text-[#78350f] font-black">{waitlistByVet['unassigned']?.length || 0}</span>
            </div>
            {!collapsedVets['unassigned'] && (
              <div className="min-h-[10px]">
                {waitlistByVet['unassigned'].map(w => (
                  <div 
                    key={w.id} 
                    draggable 
                    onDragStart={(e) => onDragStart(e, w.id, 'waitlist')} 
                    onDragEnd={onDragEnd}
                    onDoubleClick={() => onSelectPatient(w.patientId)}
                    className="px-2 py-1.5 border-b border-slate-100 flex justify-between items-center bg-white hover:bg-[#fffbeb] group cursor-pointer"
                  >
                    <span className="font-black text-gray-900 truncate">{w.patientName}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-gray-500 font-bold">{w.time}</span>
                      <button 
                        onClick={(e) => { e.stopPropagation(); onRemoveFromWaitlist(w.id); }} 
                        className="text-gray-300 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <i className="fas fa-times"></i>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Resizer */}
      <div 
        onMouseDown={onStartResizing} 
        className="absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-blue-400 transition-colors z-20"
      ></div>
    </div>
  );
};
