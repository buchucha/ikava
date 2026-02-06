
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { DepartmentOrder, Veterinarian, DepartmentType, Patient, WaitlistEntry, SOAPRecord } from '../types';
import { supabase } from '../services/supabaseClient';
import { OrderModal } from './OrderModal';
import { PatientSidebar } from './PatientSidebar';

interface ExaminationPageProps {
  vets: Veterinarian[];
  patients: Patient[];
  waitlist: WaitlistEntry[];
  onImageDoubleClick: (src: string) => void;
  activePatient: Patient | null;
  onSelectPatient: (id: string) => void;
  onAddToWaitlist: (entry: Partial<WaitlistEntry>) => Promise<void>;
  onUpdateWaitlist: (id: string, updates: Partial<WaitlistEntry>) => Promise<void>;
  onRemoveFromWaitlist: (id: string) => Promise<void>;
  clinicSettings?: any;
  currentSoap: Partial<SOAPRecord>;
}

const DEPT_CONFIG: { type: DepartmentType; label: string; icon: string; color: string }[] = [
  { type: 'Treatment', label: 'Treatment', icon: 'fa-briefcase-medical', color: 'indigo' },
  { type: 'Pharmacy', label: 'Pharmacy', icon: 'fa-pills', color: 'emerald' },
  { type: 'X-ray', label: 'X-ray', icon: 'fa-radiation', color: 'slate' },
  { type: 'Ultrasound', label: 'Ultrasound', icon: 'fa-wave-square', color: 'blue' }
];

export const ExaminationPage: React.FC<ExaminationPageProps> = ({ 
  vets, patients, waitlist, onImageDoubleClick, activePatient, onSelectPatient,
  onAddToWaitlist, onUpdateWaitlist, onRemoveFromWaitlist, clinicSettings, currentSoap
}) => {
  const [orders, setOrders] = useState<DepartmentOrder[]>([]);
  const [editingOrder, setEditingOrder] = useState<DepartmentOrder | null>(null);
  const [preSelectedDept, setPreSelectedDept] = useState<DepartmentType | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'Pending' | 'Completed'>('Pending');
  
  const [sidebarWidth, setSidebarWidth] = useState(320);
  const [isResizingSidebar, setIsResizingSidebar] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [collapsedVets, setCollapsedVets] = useState<Record<string, boolean>>({});
  const [draggedItemId, setDraggedItemId] = useState<string | null>(null);
  const [draggedItemType, setDraggedItemType] = useState<'patient' | 'waitlist' | 'order' | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [isDropZoneOver, setIsDropZoneOver] = useState(false);

  const fetchOrders = async () => {
    setIsLoading(true);
    const { data } = await supabase.from('department_orders').select('*').order('created_at', { ascending: false });
    if (data) setOrders(data);
    setIsLoading(false);
  };

  useEffect(() => {
    fetchOrders();
    const sub = supabase.channel('orders').on('postgres_changes', { event: '*', table: 'department_orders' }, fetchOrders).subscribe();
    return () => { sub.unsubscribe(); };
  }, []);

  const handleResize = useCallback((e: MouseEvent) => {
    if (isResizingSidebar) {
      const newWidth = e.clientX;
      if (newWidth >= 250 && newWidth <= 500) setSidebarWidth(newWidth);
    }
  }, [isResizingSidebar]);

  const stopResizing = useCallback(() => setIsResizingSidebar(false), []);

  useEffect(() => {
    window.addEventListener('mousemove', handleResize);
    window.addEventListener('mouseup', stopResizing);
    return () => {
      window.removeEventListener('mousemove', handleResize);
      window.removeEventListener('mouseup', stopResizing);
    };
  }, [handleResize, stopResizing]);

  const searchResults = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    return query ? patients.filter(p => p.name.toLowerCase().includes(query) || p.owner.toLowerCase().includes(query) || p.phone.includes(query)) : [];
  }, [searchTerm, patients]);

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

  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'In Progress': return 'bg-blue-600 text-white shadow-blue-500/20';
      case 'Pending': return 'bg-amber-500 text-white shadow-amber-500/20';
      case 'Completed': return 'bg-emerald-600 text-white shadow-emerald-500/20';
      default: return 'bg-slate-100 text-slate-500';
    }
  };

  const openNewOrder = (dept: DepartmentType) => {
    if (viewMode === 'Completed') return;
    setEditingOrder(null);
    setPreSelectedDept(dept);
    setIsModalOpen(true);
  };

  const handleCompleteOrder = async (orderId: string) => {
    const { error } = await supabase.from('department_orders').update({ status: 'Completed' }).eq('id', orderId);
    if (!error) fetchOrders();
  };

  return (
    <div className="flex h-full bg-slate-100 overflow-hidden font-sans">
      <PatientSidebar 
        width={sidebarWidth}
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        searchResults={searchResults}
        selectedPatientId={activePatient?.id || ''}
        onSelectPatient={onSelectPatient}
        waitlist={waitlist}
        vets={vets}
        waitlistByVet={waitlistByVet}
        collapsedVets={collapsedVets}
        onToggleVet={(id) => setCollapsedVets(prev => ({ ...prev, [id]: !prev[id] }))}
        onRemoveFromWaitlist={onRemoveFromWaitlist}
        onDragStart={(e, id, type) => { setDraggedItemId(id); setDraggedItemType(type); }}
        onDragEnd={() => { setDraggedItemId(null); setDraggedItemType(null); }}
        onDrop={async (e, targetVetId) => {
          if (!draggedItemId) return;
          if (draggedItemType === 'waitlist') {
            await onUpdateWaitlist(draggedItemId, { vetId: targetVetId });
          } else if (draggedItemType === 'patient') {
            const p = patients.find(pat => pat.id === draggedItemId);
            if (p) await onAddToWaitlist({ patientId: p.id, patientName: p.name, breed: p.breed, ownerName: p.owner, vetId: targetVetId, type: 'Examination' });
          }
        }}
        onStartResizing={() => setIsResizingSidebar(true)}
        dragOverId={dragOverId}
        setDragOverId={setDragOverId}
      />

      <div className="flex-1 flex flex-col min-w-0 bg-slate-200 shadow-inner">
        <header className="h-12 border-b border-slate-300 bg-white px-5 flex items-center justify-between flex-shrink-0 z-10 shadow-sm">
          <div className="flex items-center gap-6">
            <h2 className="text-sm font-black text-slate-800 uppercase tracking-tight flex items-center gap-2">
              <i className="fas fa-microscope text-blue-600"></i> {viewMode === 'Pending' ? 'Active Worklist' : 'Completed Archive'}
            </h2>
            <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200">
              <button 
                type="button"
                onClick={() => setViewMode('Pending')}
                className={`px-4 py-1 text-[10px] font-black uppercase tracking-wider rounded-md transition-all ${viewMode === 'Pending' ? 'bg-white text-blue-600 shadow-sm border border-slate-200' : 'text-slate-400 hover:text-slate-600'}`}
              >
                Pending
              </button>
              <button 
                type="button"
                onClick={() => setViewMode('Completed')}
                className={`px-4 py-1 text-[10px] font-black uppercase tracking-wider rounded-md transition-all ${viewMode === 'Completed' ? 'bg-white text-emerald-600 shadow-sm border border-slate-200' : 'text-slate-400 hover:text-slate-600'}`}
              >
                Completed
              </button>
            </div>
            {viewMode === 'Completed' && activePatient && (
              <div className="flex items-center gap-2 px-3 py-1 bg-emerald-50 rounded-full border border-emerald-100 animate-in fade-in zoom-in-95 duration-300">
                <span className="text-[10px] font-black text-emerald-700 uppercase tracking-widest italic">Viewing: {activePatient.name}</span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-4">
             {viewMode === 'Pending' && <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest italic animate-pulse">Drag orders to the right to complete</span>}
             <div className="h-4 w-px bg-slate-300"></div>
             <div className="flex items-center gap-1">
               <span className="text-[10px] font-black text-slate-400 uppercase">Total Items</span>
               <span className={`${viewMode === 'Pending' ? 'bg-rose-500' : 'bg-emerald-500'} text-white text-[10px] font-black px-1.5 py-0.5 rounded leading-none min-w-[20px] text-center`}>
                 {orders.filter(o => {
                   if (viewMode === 'Pending') return o.status !== 'Completed';
                   return o.status === 'Completed' && o.patient_id === activePatient?.id;
                 }).length}
               </span>
             </div>
          </div>
        </header>

        <div className="flex-1 grid grid-cols-4 gap-0.5 p-0.5 overflow-hidden">
          {viewMode === 'Completed' && !activePatient ? (
            <div className="col-span-4 flex flex-col items-center justify-center bg-white/60 backdrop-blur-sm m-1 rounded-xl border border-dashed border-slate-300">
              <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-6">
                <i className="fas fa-user-circle text-slate-300 text-3xl"></i>
              </div>
              <p className="text-xs font-black text-slate-400 uppercase tracking-[0.3em] text-center px-20 leading-relaxed">
                Please select a patient from the sidebar<br/>to view their completed history.
              </p>
            </div>
          ) : DEPT_CONFIG.map((dept) => {
            const deptOrders = orders.filter(o => {
              if (viewMode === 'Pending') {
                return o.department === dept.type && o.status !== 'Completed';
              } else {
                return o.department === dept.type && o.status === 'Completed' && o.patient_id === activePatient?.id;
              }
            });

            return (
              <div 
                key={dept.type} 
                onDoubleClick={() => openNewOrder(dept.type)}
                className={`flex flex-col bg-white/40 backdrop-blur-sm border border-slate-300 shadow-inner group transition-colors ${viewMode === 'Completed' ? 'bg-slate-50/30' : 'hover:bg-slate-50/50'}`}
              >
                <div className="p-3 border-b border-slate-300 flex items-center justify-between sticky top-0 z-10 bg-white/80">
                  <div className="flex items-center gap-2">
                    <div className={`w-6 h-6 rounded bg-${dept.color}-50 flex items-center justify-center text-${dept.color}-600`}>
                      <i className={`fas ${dept.icon} text-[10px]`}></i>
                    </div>
                    <h3 className="text-[11px] font-black text-slate-800 uppercase tracking-widest">{dept.label}</h3>
                  </div>
                  <span className={`bg-${dept.color}-100 text-${dept.color}-700 px-1.5 py-0.5 rounded text-[10px] font-black`}>
                    {deptOrders.length}
                  </span>
                </div>

                <div className="flex-1 overflow-y-auto p-3 custom-scrollbar space-y-3">
                  {deptOrders.map(order => {
                    // NAS(Tailscale) 동기화 주소 판별 (프로토콜 유연하게 대응)
                    const tailscaleImgs = order.images?.filter((img: any) => {
                      const src = typeof img === 'string' ? img : img.url;
                      return src?.includes('ikava.tailbce91b.ts.net');
                    }) || [];
                    
                    const hasAnyImages = (order.images?.length || 0) > 0;
                    const hasTailscale = tailscaleImgs.length > 0;

                    return (
                      <div 
                        key={order.id} 
                        draggable={viewMode === 'Pending'}
                        onDragStart={(e) => {
                          setDraggedItemId(order.id);
                          setDraggedItemType('order');
                        }}
                        onDragEnd={() => {
                          setDraggedItemId(null);
                          setDraggedItemType(null); // Fixed typo from 'order' to null
                          setIsDropZoneOver(false);
                        }}
                        onClick={(e) => { e.stopPropagation(); setEditingOrder(order); setPreSelectedDept(null); setIsModalOpen(true); }}
                        className="bg-white border border-slate-200 rounded-xl p-3 shadow-sm hover:shadow-md hover:border-blue-500 transition-all cursor-pointer group relative overflow-hidden"
                      >
                        {viewMode === 'Completed' && <div className="absolute top-0 right-0 w-8 h-8 bg-emerald-50 text-emerald-500 flex items-center justify-center opacity-30"><i className="fas fa-check-circle text-xs"></i></div>}
                        <div className="flex justify-between items-start mb-2">
                          <span className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider ${getStatusStyle(order.status)}`}>
                            {order.status}
                          </span>
                          <span className="text-[9px] font-bold text-slate-400">
                            {new Date(order.created_at || '').toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}
                          </span>
                        </div>
                        <h4 className="text-xs font-black text-slate-900 truncate mb-1">{order.patient_name}</h4>
                        <p className="text-[10px] font-bold text-slate-500 uppercase truncate mb-2">By {order.vet_name}</p>
                        
                        {order.request_details && (
                          <div className="bg-slate-50 p-2 rounded-lg border border-slate-100 mb-2">
                            <p className="text-[10px] font-bold text-slate-600 line-clamp-2 leading-snug italic">"{order.request_details}"</p>
                          </div>
                        )}

                        <div className="flex justify-between items-center">
                          <div className="flex -space-x-1.5 items-center">
                            {hasTailscale ? (
                              tailscaleImgs.slice(0, 3).map((img: any, i) => {
                                const src = typeof img === 'string' ? img : img.url;
                                return (
                                  <div 
                                    key={i} 
                                    onDoubleClick={(e) => {
                                      e.stopPropagation(); // 카드 상세 클릭 방지
                                      onImageDoubleClick(src);
                                    }}
                                    className="w-6 h-6 rounded-md border border-blue-500 ring-1 ring-blue-500/20 overflow-hidden bg-white shadow-sm cursor-zoom-in"
                                  >
                                    <img 
                                      src={src} 
                                      referrerPolicy="no-referrer"
                                      crossOrigin="anonymous"
                                      className="w-full h-full object-cover" 
                                      alt="" 
                                      onError={() => {
                                        console.error(`이미지 로드 실패 [${src}]`);
                                      }}
                                    />
                                  </div>
                                );
                              })
                            ) : hasAnyImages ? (
                              <div className="flex items-center gap-1.5 px-2 py-0.5 bg-slate-50 rounded border border-slate-200 animate-pulse">
                                <i className="fas fa-sync fa-spin text-[8px] text-blue-500"></i>
                                <span className="text-[8px] font-black text-slate-400 uppercase tracking-tighter">Syncing...</span>
                              </div>
                            ) : null}
                          </div>
                          <i className="fas fa-chevron-right text-[10px] text-slate-200 group-hover:text-blue-500 transition-colors"></i>
                        </div>
                      </div>
                    );
                  })}
                  {deptOrders.length === 0 && (
                    <div className="h-full flex flex-col items-center justify-center py-20 opacity-10 pointer-events-none">
                      <i className={`fas ${dept.icon} text-4xl mb-4`}></i>
                      <p className="text-[10px] font-black uppercase tracking-widest text-center">No {viewMode === 'Pending' ? 'Active' : 'Archived'} Items</p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Completion Drop Zone (Right Sidebar) */}
      <div 
        onDragOver={(e) => {
          e.preventDefault();
          if (draggedItemType === 'order') setIsDropZoneOver(true);
        }}
        onDragLeave={() => setIsDropZoneOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDropZoneOver(false);
          if (draggedItemId && draggedItemType === 'order') {
            handleCompleteOrder(draggedItemId);
          }
        }}
        className={`w-14 flex flex-col border-l transition-all duration-300 z-30 relative overflow-hidden shadow-[0_0_30px_rgba(0,0,0,0.1)] ${
          isDropZoneOver 
          ? 'bg-emerald-600 border-emerald-500 ring-4 ring-emerald-400 ring-inset' 
          : draggedItemType === 'order' 
            ? 'bg-slate-800 border-slate-700 animate-pulse'
            : 'bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 border-slate-800'
        }`}
      >
        <div className="h-1 bg-white/10 w-full mb-8"></div>
        <div className="flex-1 flex flex-col items-center py-6 gap-12 pointer-events-none">
          <div className={`w-10 h-10 rounded-2xl flex items-center justify-center transition-all duration-300 ${isDropZoneOver ? 'bg-white text-emerald-600 scale-125' : 'bg-slate-700 text-emerald-400 shadow-lg'}`}>
            <i className={`fas ${isDropZoneOver ? 'fa-check-double' : 'fa-check'} text-lg`}></i>
          </div>
          <div className="flex items-center gap-4 whitespace-nowrap" style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>
            <span className={`text-[11px] font-black uppercase tracking-[0.5em] transition-colors duration-300 ${isDropZoneOver ? 'text-white' : 'text-slate-400'}`}>
              {isDropZoneOver ? 'RELEASE TO FINISH' : 'DRAG TO COMPLETE'}
            </span>
          </div>
          <div className="mt-auto mb-8 flex flex-col items-center gap-4">
             <div className={`w-8 h-12 rounded-full border-2 border-dashed transition-all duration-300 flex items-center justify-center ${isDropZoneOver ? 'border-white bg-white/20' : 'border-slate-700'}`}>
                <i className={`fas fa-arrow-right text-[10px] ${isDropZoneOver ? 'text-white' : 'text-slate-700'} transition-transform duration-300 ${isDropZoneOver ? 'rotate-90' : ''}`}></i>
             </div>
          </div>
        </div>
        <div className="h-1 bg-white/10 w-full mt-auto"></div>
        {isDropZoneOver && <div className="absolute inset-0 bg-white/10 animate-pulse pointer-events-none"></div>}
      </div>

      {isModalOpen && (
        <OrderModal 
          isOpen={isModalOpen}
          onClose={() => { setIsModalOpen(false); setEditingOrder(null); setPreSelectedDept(null); }}
          editingOrder={editingOrder}
          draftOrder={preSelectedDept ? { department: preSelectedDept, patient_id: activePatient?.id, patient_name: activePatient?.name } : undefined}
          vets={vets}
          activeSoapId={currentSoap?.id}
          isSubmitting={false}
          clinicSettings={clinicSettings}
          onSave={async (vName, det, items, vId, sId, dept, imgs, status) => {
            const soapId = sId || currentSoap?.id;
            if (editingOrder) {
              await supabase.from('department_orders').update({
                vet_name: vName, request_details: det, items, department: dept, images: imgs, status, soap_id: soapId
              }).eq('id', editingOrder.id);
            } else {
              await supabase.from('department_orders').insert([{
                patient_id: activePatient?.id,
                patient_name: activePatient?.name,
                vet_name: vName,
                request_details: det,
                items,
                department: dept,
                images: imgs,
                status,
                soap_id: soapId
              }]);
            }
            setIsModalOpen(false); 
            setEditingOrder(null);
            setPreSelectedDept(null);
            fetchOrders(); 
          }}
          onDelete={async () => {
            if (editingOrder) {
              await supabase.from('department_orders').delete().eq('id', editingOrder.id);
              setIsModalOpen(false);
              setEditingOrder(null);
              setPreSelectedDept(null);
              fetchOrders();
            }
          }}
        />
      )}
    </div>
  );
};
