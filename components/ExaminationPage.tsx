
import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { Patient, Veterinarian, WaitlistEntry, DepartmentOrder, DepartmentType, BillingItem, OrderImage } from '../types';
import { supabase } from '../services/supabaseClient';
import { PacsViewer } from './PacsViewer';
import { OrderModal } from './OrderModal';
import { ImageModal } from './ImageModal';

interface ExaminationPageProps {
  patients: Patient[];
  selectedPatientId: string;
  activeSoapId?: string;
  onSelectPatient: (id: string) => void;
  vets: Veterinarian[];
  waitlist: WaitlistEntry[];
  onAddToWaitlist: (entry: Partial<WaitlistEntry>) => Promise<void>;
  onUpdateWaitlist: (id: string, updates: Partial<WaitlistEntry>) => Promise<void>;
  onRemoveFromWaitlist: (id: string) => Promise<void>;
}

const DEPT_CONFIG: Record<DepartmentType, { icon: string, color: string, label: string, bg: string }> = {
  'Treatment': { icon: 'fa-briefcase-medical', color: 'text-indigo-600', label: '처치', bg: 'bg-indigo-50' },
  'Pharmacy': { icon: 'fa-pills', color: 'text-emerald-600', label: '약제', bg: 'bg-emerald-50' },
  'X-ray': { icon: 'fa-radiation', color: 'text-slate-700', label: 'X-ray', bg: 'bg-slate-100' },
  'Ultrasound': { icon: 'fa-wave-square', color: 'text-blue-600', label: '초음파', bg: 'bg-blue-50' }
};

const RoomStatusBoard = ({ 
  title, subTitle, department, icon, colorClass, items = [], onDropRoom, onOrderDragStart, onOrderDrop, onOrderDoubleClick, onRoomDoubleClick
}: any) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const [dragOverItemIndex, setDragOverItemIndex] = useState<number | null>(null);

  const textColor = colorClass.includes('indigo') ? 'text-indigo-600' : colorClass.includes('emerald') ? 'text-emerald-600' : colorClass.includes('slate') ? 'text-slate-600' : 'text-blue-600';

  return (
    <div 
      onDoubleClick={(e) => { e.stopPropagation(); onRoomDoubleClick?.(department); }}
      className={`flex flex-col h-full bg-white border rounded-lg overflow-hidden shadow-[0_2px_8px_-4px_rgba(0,0,0,0.05)] transition-all group relative ${isDragOver ? 'border-blue-500 ring-2 ring-blue-500/10 z-10' : 'border-slate-200'}`}
      onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={(e) => { e.preventDefault(); setIsDragOver(false); onDropRoom?.(department); }}
    >
      <div className="px-3 py-2 border-b border-slate-100 flex justify-between items-center min-h-[40px] pointer-events-none select-none bg-white">
        <div className="flex items-center gap-2">
          <i className={`fas ${icon} ${textColor} text-sm opacity-90`}></i>
          <div className="flex flex-col leading-none">
            <span className="font-black text-slate-800 text-[11px] uppercase tracking-tight">{title}</span>
            <span className="text-[8px] text-slate-400 font-bold uppercase tracking-wider">{subTitle}</span>
          </div>
        </div>
        <span className={`text-[10px] font-black px-1.5 py-0.5 rounded bg-slate-100 text-slate-600`}>{items.length}</span>
      </div>

      <div className="flex-1 bg-white/50 p-2 overflow-y-auto relative custom-scrollbar">
        {items.length === 0 ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-300 pointer-events-none select-none px-4 text-center">
             <i className={`fas ${icon} text-2xl opacity-10 mb-2`}></i>
             <p className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-300 opacity-60">Empty</p>
          </div>
        ) : (
           <div className="space-y-4">
               {items.map((item: DepartmentOrder, index: number) => (
                 <div 
                    key={item.id} 
                    draggable 
                    onDragStart={(e) => onOrderDragStart(e, item.id)} 
                    onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setDragOverItemIndex(index); }} 
                    onDragLeave={() => setDragOverItemIndex(null)} 
                    onDrop={(e) => { e.preventDefault(); e.stopPropagation(); onOrderDrop(item.id); setDragOverItemIndex(null); }} 
                    onDoubleClick={(e) => { e.stopPropagation(); onOrderDoubleClick?.(item); }}
                    className={`bg-white p-2.5 rounded border shadow-sm flex flex-col gap-1.5 transition-all group/item relative cursor-move hover:border-blue-300 ${dragOverItemIndex === index ? 'border-blue-500 bg-blue-50 translate-y-0.5' : 'border-slate-200'}`}
                 >
                    <div className="flex justify-between items-start">
                       <div className="flex items-center gap-2 min-w-0">
                         <span className="font-black text-slate-800 text-xs truncate">{item.patient_name}</span>
                         <span className="text-[9px] text-slate-400 font-bold whitespace-nowrap">{new Date(item.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                       </div>
                       <span className={`text-[8px] px-1.5 py-0.5 rounded font-black uppercase tracking-wider ${item.status === 'In Progress' ? 'bg-blue-50 text-blue-600' : 'bg-amber-50 text-amber-600'}`}>{item.status}</span>
                    </div>
                    <div className="text-[10px] font-medium leading-snug break-words text-slate-700">
                       {item.items && item.items.length > 0 ? (
                         <div className="space-y-1">
                           {item.items.map((i, idx) => (
                             <div key={idx} className="flex justify-between items-center bg-slate-50 px-1.5 py-0.5 rounded">
                               <span className="truncate">{i.name}</span>
                               <span className="text-[8px] text-slate-400 font-bold">x{i.quantity}</span>
                             </div>
                           ))}
                         </div>
                       ) : item.request_details}
                    </div>
                    <div className="flex items-center justify-between mt-0.5 pt-1.5 border-t border-slate-50">
                      <div className="flex items-center gap-1"><i className="fas fa-user-md text-[8px] text-slate-300"></i><span className="text-[9px] text-slate-400 font-bold">{item.vet_name}</span></div>
                    </div>
                 </div>
               ))}
           </div>
        )}
      </div>
    </div>
  );
};

export const ExaminationPage: React.FC<ExaminationPageProps> = ({ 
  patients, selectedPatientId, activeSoapId, onSelectPatient, vets, waitlist, onAddToWaitlist, onUpdateWaitlist, onRemoveFromWaitlist
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [sidebarWidth, setSidebarWidth] = useState(320); 
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);

  const [draggedItemId, setDraggedItemId] = useState<string | null>(null);
  const [draggedItemType, setDraggedItemType] = useState<'patient' | 'waitlist' | 'order' | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  
  const [orders, setOrders] = useState<DepartmentOrder[]>([]);
  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);
  const [draftOrder, setDraftOrder] = useState<Partial<DepartmentOrder> | null>(null);
  const [editingOrder, setEditingOrder] = useState<DepartmentOrder | null>(null);
  const [isSubmittingOrder, setIsSubmittingOrder] = useState(false);
  const [viewingImage, setViewingImage] = useState<string | null>(null);
  const [collapsedVets, setCollapsedVets] = useState<Record<string, boolean>>({});
  const [isHistoryOpen, setIsHistoryOpen] = useState(false); 
  const [isActiveQueueOpen, setIsActiveQueueOpen] = useState(true); 

  const activePatient = useMemo(() => patients.find(p => p.id === selectedPatientId) || null, [selectedPatientId, patients]);

  useEffect(() => {
    const fetchOrders = async () => {
      const { data, error } = await supabase.from('department_orders').select('*').order('order_index', { ascending: true }).order('created_at', { ascending: true });
      if (!error && data) setOrders(data as DepartmentOrder[]);
    };
    fetchOrders();

    const channel = supabase.channel('orders-sync-v10')
      .on('postgres_changes', { event: '*', table: 'department_orders', schema: 'public' }, (payload) => {
         if (payload.eventType === 'INSERT') setOrders(prev => [...prev, payload.new as DepartmentOrder].sort((a,b) => a.order_index - b.order_index));
         else if (payload.eventType === 'UPDATE') setOrders(prev => prev.map(o => o.id === (payload.new as any).id ? payload.new as any : o).sort((a,b) => a.order_index - b.order_index));
         else if (payload.eventType === 'DELETE') setOrders(prev => prev.filter(o => o.id !== (payload.old as any).id));
      }).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const resize = useCallback((e: MouseEvent) => { if (isResizing) { const newWidth = e.clientX; if (newWidth >= 250 && newWidth <= 600) setSidebarWidth(newWidth); } }, [isResizing]);
  useEffect(() => {
    window.addEventListener("mousemove", resize); window.addEventListener("mouseup", () => setIsResizing(false));
    return () => { window.removeEventListener("mousemove", resize); window.removeEventListener("mouseup", () => setIsResizing(false)); };
  }, [resize]);

  const waitlistByVet = useMemo(() => {
    const groups: Record<string, WaitlistEntry[]> = { 'unassigned': [] };
    vets.forEach(v => groups[v.id] = []);
    waitlist.forEach(w => { if (w.vetId && groups[w.vetId]) groups[w.vetId].push(w); else groups['unassigned'].push(w); });
    return groups;
  }, [waitlist, vets]);

  const handleRoomDrop = (department: DepartmentType) => {
    if (!draggedItemId || draggedItemType === 'order') return;
    let patientId = '', patientName = '';
    if (draggedItemType === 'patient') { const p = patients.find(x => x.id === draggedItemId); if (p) { patientId = p.id; patientName = p.name; } }
    else if (draggedItemType === 'waitlist') { const w = waitlist.find(x => x.id === draggedItemId); if (w) { patientId = w.patientId; patientName = w.patientName; } }
    if (patientId && patientName) { setEditingOrder(null); setDraftOrder({ patient_id: patientId, patient_name: patientName, department }); setIsOrderModalOpen(true); }
  };

  const handleHistoryDrop = async (e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation();
    const id = e.dataTransfer.getData('text/plain') || draggedItemId;
    if (!id) return;
    try {
      const { error } = await supabase.from('department_orders').update({ status: 'Completed' }).eq('id', id);
      if (error) throw error;
    } catch (err: any) {
      console.error('Failed to complete order:', err.message);
    } finally {
      setDragOverId(null); setDraggedItemId(null); setDraggedItemType(null);
    }
  };

  const handleDeleteHistoryImage = async (orderId: string, imgUrl: string) => {
    try {
      const order = orders.find(o => o.id === orderId);
      if (!order) return;
      const newImages = (order.images || []).filter(i => i.url !== imgUrl);
      let newAttachmentUrl = order.attachment_url;
      if (order.attachment_url === imgUrl) {
          newAttachmentUrl = newImages.length > 0 ? newImages[0].url : null;
      }
      const { error: orderError } = await supabase.from('department_orders').update({ images: newImages, attachment_url: newAttachmentUrl }).eq('id', orderId);
      if (orderError) throw orderError;
      if (order.soap_id) {
        const { data: soapData, error: fetchError } = await supabase.from('soap_records').select('images').eq('id', order.soap_id).single();
        if (!fetchError && soapData && Array.isArray(soapData.images)) {
          const updatedSoapImages = soapData.images.filter((url: string) => url !== imgUrl);
          await supabase.from('soap_records').update({ images: updatedSoapImages }).eq('id', order.soap_id);
        }
      }
    } catch (err: any) {
      console.error('Image deletion failed:', err.message);
    }
  };

  const handleSaveOrder = async (vetName: string, details: string, items: BillingItem[], vetId: string, soapId: string, department: DepartmentType, images: OrderImage[], status: 'Pending' | 'In Progress' | 'Completed') => {
    setIsSubmittingOrder(true);
    try {
      const patientId = editingOrder?.patient_id || draftOrder?.patient_id;
      const primaryUrl = images && images.length > 0 ? images[0].url : null;
      let orderId = editingOrder?.id;
      let targetSoapId = soapId || editingOrder?.soap_id;
      
      if (editingOrder) {
        await supabase.from('department_orders').update({ vet_name: vetName, request_details: details, items: items, department, images, status, attachment_url: primaryUrl }).eq('id', editingOrder.id);
      } else if (draftOrder) {
        const { data: newOrder, error } = await supabase.from('department_orders').insert([{ 
          patient_id: draftOrder.patient_id, 
          patient_name: draftOrder.patient_name, 
          soap_id: targetSoapId || null, 
          department, 
          vet_name: vetName, 
          request_details: details, 
          status, items, images, 
          attachment_url: primaryUrl 
        }]).select().single();
        if (error) throw error;
        orderId = newOrder.id;
      }

      if (targetSoapId && images && images.length > 0) {
        const { data: currentSoap } = await supabase.from('soap_records').select('images').eq('id', targetSoapId).single();
        const existingImages = currentSoap?.images || [];
        const newUrls = images.map(img => img.url);
        const combined = Array.from(new Set([...existingImages, ...newUrls]));
        await supabase.from('soap_records').update({ images: combined }).eq('id', targetSoapId);
      }
      
      if (orderId && patientId && items.length > 0) {
        await supabase.from('billing_items').delete().eq('linked_order_id', orderId);
        let { data: invoice } = await supabase.from('billing_invoices').select('id').eq('patient_id', patientId).eq('status', 'Unpaid').single();
        if (!invoice) { const { data } = await supabase.from('billing_invoices').insert({ patient_id: patientId, status: 'Unpaid' }).select().single(); invoice = data; }
        if (invoice) {
           await supabase.from('billing_items').insert(items.map(i => ({ invoice_id: invoice.id, linked_order_id: orderId, service_id: i.service_id, item_name: i.name, category: i.category, unit_price: i.unit_price, quantity: i.quantity, total_price: i.total_price, performing_vet_id: vetId })));
        }
      }
      setIsOrderModalOpen(false); setDraftOrder(null); setEditingOrder(null);
    } catch (e: any) { console.error(e.message); } finally { setIsSubmittingOrder(false); }
  };

  const handleDeleteOrder = async () => {
    if (!editingOrder) return;
    try {
      await supabase.from('billing_items').delete().eq('linked_order_id', editingOrder.id);
      await supabase.from('department_orders').delete().eq('id', editingOrder.id);
      setIsOrderModalOpen(false); setEditingOrder(null);
    } catch (e: any) { console.error(e.message); }
  };

  const unifiedHistory = useMemo(() => {
    if (!selectedPatientId) return null;
    const completed = orders.filter(o => String(o.patient_id) === String(selectedPatientId) && o.status === 'Completed');
    const groups: Record<string, DepartmentOrder[]> = {};
    completed.forEach(o => { const k = new Date(o.created_at).toISOString().split('T')[0]; if (!groups[k]) groups[k] = []; groups[k].push(o); });
    return Object.entries(groups).sort((a,b) => b[0].localeCompare(a[0]));
  }, [orders, selectedPatientId]);

  return (
    <div className={`flex h-full bg-slate-100 overflow-hidden text-xs font-sans ${isResizing ? 'cursor-col-resize select-none' : ''}`}>
      <div ref={sidebarRef} style={{ width: `${sidebarWidth}px` }} className="relative border-r border-slate-300 flex flex-col bg-white z-10 flex-shrink-0 shadow-sm">
        <div className="p-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between"><h2 className="font-bold text-gray-700">Patient Search</h2></div>
        <div className="p-2 border-b border-slate-200"><div className="relative"><input type="text" placeholder="Search..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-8 pr-2 py-1.5 bg-white border border-slate-300 rounded text-[11px] font-bold outline-none" /><i className="fas fa-search absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400"></i></div></div>
        <div className="flex-1 overflow-y-auto custom-scrollbar p-1">
          {vets.map(vet => (
            <div key={vet.id} className={`mb-1 border border-transparent rounded ${dragOverId === vet.id ? 'bg-blue-50 border-blue-300' : ''}`} onDragOver={(e) => { e.preventDefault(); setDragOverId(vet.id); }} onDrop={() => setDragOverId(null)}>
              <div onClick={() => setCollapsedVets(p => ({...p, [vet.id]: !p[vet.id]}))} className="px-2 py-1 bg-slate-50 border border-slate-200 flex justify-between items-center cursor-pointer hover:bg-slate-100"><span className="font-black text-gray-700">{vet.name}</span><span className="text-[10px] text-blue-600 font-black">{waitlistByVet[vet.id]?.length || 0}</span></div>
              {!collapsedVets[vet.id] && waitlistByVet[vet.id].map(w => <div key={w.id} draggable onDragStart={(e) => {setDraggedItemId(w.id); setDraggedItemType('waitlist');}} onDoubleClick={() => onSelectPatient(w.patientId)} className={`px-2 py-1.5 border-b border-slate-100 flex justify-between items-center hover:bg-slate-50 group cursor-pointer ${selectedPatientId === w.patientId ? 'bg-blue-50/50' : ''}`}><span className="font-black text-gray-900 truncate">{w.patientName}</span><span className="text-[10px] text-gray-500 font-bold">{w.time}</span></div>)}
            </div>
          ))}
        </div>
        <div onMouseDown={() => setIsResizing(true)} className="absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-blue-400 z-20"></div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        <div className={`${isActiveQueueOpen ? 'flex-1' : 'w-10 bg-slate-200'} p-2 flex flex-col h-full border-r border-slate-300 gap-2 transition-all relative`} onClick={() => !isActiveQueueOpen && setIsActiveQueueOpen(true)}>
           {isActiveQueueOpen ? (
             <>
               <div className="flex items-center justify-between bg-white border border-slate-300 px-3 py-2 rounded-lg shadow-sm">
                 <h2 className="text-[11px] font-black uppercase tracking-tight flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></div>Global Active Queue</h2>
                 <button onClick={(e) => { e.stopPropagation(); setIsActiveQueueOpen(false); }} className="w-6 h-6 rounded hover:bg-slate-100 flex items-center justify-center text-slate-400"><i className="fas fa-chevron-left text-xs"></i></button>
               </div>
               <div className="flex-1 grid grid-cols-4 gap-2 min-h-0">
                 {['Treatment', 'Pharmacy', 'X-ray', 'Ultrasound'].map(d => (
                   <RoomStatusBoard key={d} title={DEPT_CONFIG[d as DepartmentType].label} subTitle={d} department={d} icon={DEPT_CONFIG[d as DepartmentType].icon} colorClass={DEPT_CONFIG[d as DepartmentType].bg} items={orders.filter(o => o.department === d && o.status !== 'Completed')} onDropRoom={handleRoomDrop} onOrderDragStart={(e: React.DragEvent, id: string)=>{ e.dataTransfer.setData('text/plain', id); setDraggedItemId(id); setDraggedItemType('order'); }} onOrderDrop={(id:any)=>{}} onOrderDoubleClick={(o:any)=>{setEditingOrder(o); setIsOrderModalOpen(true);}} onRoomDoubleClick={(d:any)=>{ if(selectedPatientId) { setDraftOrder({patient_id:selectedPatientId, patient_name:activePatient?.name, department:d}); setIsOrderModalOpen(true); } }} />
                 ))}
               </div>
             </>
           ) : <div className="flex flex-col h-full items-center justify-center gap-4 py-8"><div className="writing-mode-vertical-rl text-[10px] font-black text-slate-400 uppercase tracking-widest" style={{writingMode:'vertical-rl'}}>Active Queue</div></div>}
        </div>

        <div className={`${isHistoryOpen ? 'flex-1' : 'w-10'} transition-all flex flex-col bg-slate-50/30 border-l border-white relative`} onClick={() => !isHistoryOpen && setIsHistoryOpen(true)} onDragOver={(e) => { e.preventDefault(); if(draggedItemType === 'order') setDragOverId('history-panel'); }} onDragLeave={() => setDragOverId(null)} onDrop={handleHistoryDrop}>
           {dragOverId === 'history-panel' && <div className="absolute inset-0 z-50 bg-emerald-500/10 border-2 border-emerald-500 rounded-lg flex items-center justify-center pointer-events-none m-2"><div className="bg-white px-4 py-2 rounded-full shadow-lg font-black text-emerald-600 text-[10px] uppercase tracking-widest animate-bounce flex items-center gap-2"><i className="fas fa-check-double"></i> Drop to Complete</div></div>}
           {isHistoryOpen ? (
             <div className="flex flex-col h-full w-full p-2 gap-2 animate-in fade-in duration-300">
               <div className="flex items-center justify-between flex-shrink-0 bg-white border border-slate-200 px-3 py-2 rounded-lg shadow-sm">
                 <h2 className="text-[11px] font-black uppercase tracking-tight flex items-center gap-2"><i className="fas fa-history text-slate-400"></i>Patient History</h2>
                 <button onClick={(e) => { e.stopPropagation(); setIsHistoryOpen(false); }} className="w-6 h-6 rounded hover:bg-slate-200 flex items-center justify-center text-slate-400"><i className="fas fa-chevron-right text-xs"></i></button>
               </div>
               <div className="flex-1 overflow-y-auto custom-scrollbar p-1">
                 {unifiedHistory?.map(([date, dateOrders]) => (
                   <div key={date} className="relative pb-4">
                      <div className="sticky top-0 z-20 flex items-center gap-2 py-2 bg-slate-50/90 backdrop-blur-sm"><span className="bg-slate-700 text-white text-[9px] font-black px-2 py-0.5 rounded shadow-sm">{date}</span><div className="flex-1 h-px bg-slate-200"></div></div>
                      <div className="mt-3 space-y-3 pl-2 border-l-2 border-slate-200 ml-1.5">
                         {dateOrders.map((order) => (
                           <div key={order.id} className="bg-white rounded-xl border border-slate-200 shadow-sm p-3">
                              <div className="flex justify-between items-center mb-2"><span className={`text-[10px] font-black uppercase ${DEPT_CONFIG[order.department].color}`}>{DEPT_CONFIG[order.department].label}</span><span className="text-[9px] text-slate-400">{new Date(order.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span></div>
                              {order.items && order.items.length > 0 ? (
                                <div className="flex flex-wrap gap-1 mb-2">
                                  {order.items.map((item, i) => <span key={i} className="px-1.5 py-0.5 bg-slate-100 border border-slate-200 rounded text-[9px] font-bold text-slate-700 leading-none">{item.name}</span>)}
                                </div>
                              ) : <div className="text-[10px] font-bold text-slate-600 italic mb-2">{order.request_details || 'No details'}</div>}
                              {order.images && order.images.length > 0 && (
                                <div className="flex gap-1.5 mb-2 overflow-x-auto pb-1 scrollbar-none">
                                  {order.images.map((img, idx) => (
                                    <div key={idx} className="relative w-10 h-10 flex-shrink-0 rounded-lg border border-slate-200 bg-slate-50 overflow-hidden shadow-sm group">
                                      <img src={img.url} className="w-full h-full object-cover cursor-zoom-in" alt={img.name} onClick={() => setViewingImage(img.url)} />
                                      <button onClick={(e) => { e.stopPropagation(); handleDeleteHistoryImage(order.id, img.url); }} className="absolute top-0 right-0 w-4 h-4 bg-rose-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10 rounded-bl-lg"><i className="fas fa-trash-alt text-[8px]"></i></button>
                                    </div>
                                  ))}
                                </div>
                              )}
                              <div className="flex items-center gap-1.5"><span className="text-[9px] text-slate-500 font-bold">{order.vet_name}</span></div>
                           </div>
                         ))}
                      </div>
                   </div>
                 ))}
               </div>
             </div>
           ) : <div className="flex flex-col h-full items-center justify-center gap-4 py-8"><div className="writing-mode-vertical-rl text-[10px] font-black text-slate-400 uppercase tracking-widest" style={{writingMode:'vertical-rl'}}>Completed History</div></div>}
        </div>
      </div>
      <OrderModal isOpen={isOrderModalOpen} onClose={() => { setIsOrderModalOpen(false); setDraftOrder(null); setEditingOrder(null); }} onSave={handleSaveOrder} onDelete={handleDeleteOrder} draftOrder={draftOrder} editingOrder={editingOrder} vets={vets} isSubmitting={isSubmittingOrder} activeSoapId={activeSoapId} />
      {viewingImage && <ImageModal src={viewingImage} onClose={() => setViewingImage(null)} />}
    </div>
  );
};
