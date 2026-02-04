
import React, { useState, useMemo } from 'react';
import { Patient, Veterinarian, WaitlistEntry, SOAPRecord, SOAPField, ClinicSettings, DepartmentType, BillingItem, DepartmentOrder, OrderImage } from '../types';
import { PatientSidebar } from './PatientSidebar';
import { SOAPEditor } from './SOAPEditor';
import { HistoryCard } from './HistoryCard';
import { OrderModal } from './OrderModal';
import { supabase } from '../services/supabaseClient';

interface ConsultationPageProps {
  patients: Patient[];
  vets: Veterinarian[];
  waitlist: WaitlistEntry[];
  selectedPatientId: string;
  onSelectPatient: (id: string) => void;
  // Fix: Removed duplicate onUpdateWaitlist property
  onAddToWaitlist: (entry: Partial<WaitlistEntry>) => Promise<void>;
  onUpdateWaitlist: (id: string, updates: Partial<WaitlistEntry>) => Promise<void>;
  onRemoveFromWaitlist: (id: string) => Promise<void>;
  
  soapStep: 'S' | 'O' | 'A' | 'P';
  setSoapStep: (step: 'S' | 'O' | 'A' | 'P') => void;
  currentSoap: Partial<SOAPRecord>;
  onUpdateSoap: (field: SOAPField, value: any) => void;
  isSavingSoap: boolean;
  onSaveSoap: () => void;
  history: SOAPRecord[];
  onLoadHistory: (record: SOAPRecord) => void;
  setViewingImage: (src: string | null) => void;
  onNewChart: (pId: string) => void;
  
  onSuggestTests: () => void;
  onSuggestDdx: () => void;
  onSuggestTx: () => void;
  onSuggestRx: () => void;
  onSuggestSummary: () => void;
  clinicSettings: ClinicSettings;
}

const PatientHeader: React.FC<{ 
  patient: Patient; 
  activeSoapId?: string;
  onOpenOrder: () => void;
}> = ({ patient, activeSoapId, onOpenOrder }) => (
  <div className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 flex-shrink-0 shadow-sm z-10">
    <div className="flex items-center gap-6">
      <div className="flex items-center gap-4">
        <img src={patient.avatar} alt={patient.name} className="w-10 h-10 rounded-xl object-cover border border-slate-200 shadow-sm" />
        <div>
          <h2 className="text-lg font-black text-slate-900 leading-none">{patient.name}</h2>
          <span className="text-xs font-bold text-slate-500">{patient.breed} • {patient.gender}</span>
        </div>
      </div>
      <div className="h-8 w-px bg-slate-100"></div>
      <div className="flex gap-6">
        <div className="flex flex-col">
           <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Age</span>
           <span className="text-sm font-bold text-slate-700">{patient.age}</span>
        </div>
        <div className="flex flex-col">
           <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Weight</span>
           <span className="text-sm font-bold text-blue-600">{patient.weight} kg</span>
        </div>
      </div>
    </div>
    
    <div className="flex items-center gap-3">
       <button 
         onClick={onOpenOrder}
         className="flex items-center gap-2 px-6 py-2 rounded-lg transition-all shadow-md active:scale-95 bg-blue-600 text-white hover:bg-blue-700"
       >
         <i className="fas fa-clipboard-list text-sm"></i>
         <span className="text-xs font-black uppercase tracking-wide">Place Order</span>
       </button>
    </div>
  </div>
);

export const ConsultationPage: React.FC<ConsultationPageProps> = (props) => {
  const [sidebarWidth, setSidebarWidth] = useState(300);
  const [isResizing, setIsResizing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [collapsedVets, setCollapsedVets] = useState<Record<string, boolean>>({});
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [isHistoryExpanded, setIsHistoryExpanded] = useState(true);
  const [expandedHistoryId, setExpandedHistoryId] = useState<string | null>(null);
  
  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);
  const [isSubmittingOrder, setIsSubmittingOrder] = useState(false);

  const activePatient = useMemo(() => 
    props.patients.find(p => p.id === props.selectedPatientId), 
    [props.patients, props.selectedPatientId]
  );

  const searchResults = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (query.length < 1) return [];
    return props.patients.filter(p => 
      p.name.toLowerCase().includes(query) || 
      p.owner.toLowerCase().includes(query) || 
      (p.chartNumber && p.chartNumber.toLowerCase().includes(query))
    );
  }, [searchTerm, props.patients]);

  const waitlistByVet = useMemo(() => {
    const groups: Record<string, WaitlistEntry[]> = { 'unassigned': [] };
    props.vets.forEach(v => groups[v.id] = []);
    props.waitlist.forEach(w => {
      const vid = w.vetId;
      if (vid && groups[vid]) groups[vid].push(w);
      else groups['unassigned'].push(w);
    });
    return groups;
  }, [props.waitlist, props.vets]);

  const handleDragStart = (e: React.DragEvent, id: string, type: 'patient' | 'waitlist') => {
    e.dataTransfer.setData('id', id);
    e.dataTransfer.setData('type', type);
  };

  const handleDrop = async (e: React.DragEvent, targetVetId: string) => {
    e.preventDefault();
    const id = e.dataTransfer.getData('id');
    const type = e.dataTransfer.getData('type');
    if (type === 'waitlist') {
      await props.onUpdateWaitlist(id, { vetId: targetVetId });
    } else if (type === 'patient') {
      const p = props.patients.find(pat => pat.id === id);
      if (p) await props.onAddToWaitlist({ patientId: p.id, patientName: p.name, breed: p.breed, ownerName: p.owner, vetId: targetVetId, memo: '', type: 'Consultation' });
    }
    setDragOverId(null);
  };

  const handleDeleteHistoryImage = async (soapId: string, imgUrl: string) => {
    try {
      const { data: soapData, error: soapError } = await supabase
        .from('soap_records')
        .select('images')
        .eq('id', soapId)
        .single();
      
      if (soapError) throw soapError;
      
      const currentImages: string[] = Array.isArray(soapData.images) ? soapData.images : [];
      const updatedImages = currentImages.filter(url => url !== imgUrl);

      const { error: soapUpdateError } = await supabase
        .from('soap_records')
        .update({ images: updatedImages })
        .eq('id', soapId);
      
      if (soapUpdateError) throw soapUpdateError;

      const { data: ordersData } = await supabase
        .from('department_orders')
        .select('id, images, attachment_url')
        .eq('soap_id', soapId);
      
      if (ordersData && ordersData.length > 0) {
        for (const order of ordersData) {
          const orderImages: OrderImage[] = Array.isArray(order.images) ? order.images : [];
          const updatedOrderImages = orderImages.filter(img => img.url !== imgUrl);
          
          let newAttachmentUrl = order.attachment_url;
          if (order.attachment_url === imgUrl) {
            newAttachmentUrl = updatedOrderImages.length > 0 ? updatedOrderImages[0].url : null;
          }

          await supabase
            .from('department_orders')
            .update({ 
              images: updatedOrderImages,
              attachment_url: newAttachmentUrl
            })
            .eq('id', order.id);
        }
      }

      if (props.currentSoap?.id === soapId) {
        props.onUpdateSoap('images', updatedImages);
      }
    } catch (err: any) {
      console.error('Image deletion failed:', err.message);
    }
  };

  const handleSaveOrder = async (vetName: string, details: string, items: BillingItem[], vetId: string, soapId: string, department: DepartmentType, images: OrderImage[], status: 'Pending' | 'In Progress' | 'Completed' = 'Pending') => {
    // CRITICAL FIX: !soapId 체크 제거. soapId가 없어도 오더 저장이 가능해야 합니다.
    if (!activePatient) return;
    setIsSubmittingOrder(true);
    try {
      const primaryUrl = images && images.length > 0 ? images[0].url : null;
      const { data: newOrder, error: orderError } = await supabase.from('department_orders').insert([{
        patient_id: activePatient.id,
        patient_name: activePatient.name,
        soap_id: soapId || null, // SOAP ID가 없으면 null로 전송
        department: department,
        vet_name: vetName,
        request_details: details,
        status: status,
        order_index: 0, 
        items: items,
        images: images, 
        attachment_url: primaryUrl
      }]).select().single();

      if (orderError) throw orderError;

      // SOAP ID가 있는 경우에만 이미지 동기화
      if (soapId && images && images.length > 0) {
        const { data: currentSoapData } = await supabase.from('soap_records').select('images').eq('id', soapId).single();
        const existingImages: string[] = Array.isArray(currentSoapData?.images) ? currentSoapData.images : [];
        const newUrls = images.map(img => img.url);
        const combined = Array.from(new Set([...existingImages, ...newUrls]));
        await supabase.from('soap_records').update({ images: combined }).eq('id', soapId);
        props.onUpdateSoap('images', combined);
      }

      if (items.length > 0 && newOrder) {
        let { data: invoice } = await supabase.from('billing_invoices').select('id').eq('patient_id', activePatient.id).eq('status', 'Unpaid').single();
        if (!invoice) {
           const { data: newInv } = await supabase.from('billing_invoices').insert({ patient_id: activePatient.id, status: 'Unpaid' }).select().single();
           invoice = newInv;
        }
        if (invoice) {
           const billingItemsPayload = items.map(item => ({
              invoice_id: invoice.id,
              linked_order_id: newOrder.id,
              service_id: item.service_id,
              item_name: item.name,
              category: item.category,
              unit_price: item.unit_price,
              quantity: item.quantity || 1,
              total_price: item.total_price,
              performing_vet_id: vetId || null
           }));
           await supabase.from('billing_items').insert(billingItemsPayload);
        }
      }
      setIsOrderModalOpen(false);
    } catch (e: any) {
      console.error('Failed to send order:', e.message);
    } finally {
      setIsSubmittingOrder(false);
    }
  };

  return (
    <div className="flex h-full bg-slate-100 overflow-hidden">
      <PatientSidebar 
        width={sidebarWidth}
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        searchResults={searchResults}
        selectedPatientId={props.selectedPatientId}
        onSelectPatient={props.onSelectPatient}
        waitlist={props.waitlist}
        vets={props.vets}
        waitlistByVet={waitlistByVet}
        collapsedVets={collapsedVets}
        onToggleVet={(id) => setCollapsedVets(prev => ({...prev, [id]: !prev[id]}))}
        onRemoveFromWaitlist={props.onRemoveFromWaitlist}
        onDragStart={handleDragStart}
        onDragEnd={() => {}}
        onDrop={handleDrop}
        onStartResizing={() => setIsResizing(true)}
        dragOverId={dragOverId}
        setDragOverId={setDragOverId}
      />

      <main className="flex-1 flex flex-col overflow-hidden relative min-w-0 bg-white">
        {activePatient ? (
          <>
            <PatientHeader 
              patient={activePatient} 
              activeSoapId={props.currentSoap?.id}
              onOpenOrder={() => setIsOrderModalOpen(true)} 
            />
            <div className="flex-1 flex overflow-hidden">
              <div className="flex-1 flex flex-col min-w-0">
                <SOAPEditor 
                  activeStep={props.soapStep} 
                  onStepChange={props.setSoapStep} 
                  record={props.currentSoap} 
                  onUpdate={props.onUpdateSoap} 
                  isSaving={props.isSavingSoap} 
                  onSave={props.onSaveSoap} 
                  onSuggestTests={props.onSuggestTests} 
                  onSuggestDdx={props.onSuggestDdx} 
                  onSuggestTx={props.onSuggestTx} 
                  onSuggestRx={props.onSuggestRx} 
                  onSuggestSummary={props.onSuggestSummary} 
                  onImageDoubleClick={props.setViewingImage}
                  clinicSettings={props.clinicSettings}
                />
              </div>

              <div className={`${isHistoryExpanded ? 'w-[350px]' : 'w-10'} bg-white border-l border-slate-200 flex flex-col transition-all duration-300 shadow-xl z-20`}>
                {isHistoryExpanded ? (
                  <>
                    <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
                      <div><h3 className="font-black text-slate-800 text-sm uppercase tracking-tight">History Ledger</h3></div>
                      <div className="flex gap-2">
                        <button onClick={() => props.onNewChart(props.selectedPatientId)} className="w-8 h-8 bg-blue-600 text-white rounded-lg flex items-center justify-center hover:bg-blue-700 transition-all"><i className="fas fa-plus text-xs"></i></button>
                        <button onClick={() => setIsHistoryExpanded(false)} className="w-8 h-8 text-slate-400 hover:bg-slate-100 rounded-lg flex items-center justify-center"><i className="fas fa-chevron-right text-xs"></i></button>
                      </div>
                    </div>
                    <div className="flex-1 overflow-y-auto p-3 custom-scrollbar">
                      {props.history.length === 0 ? (
                        <div className="text-slate-400 text-center py-20 font-black uppercase tracking-widest text-[9px]">No records found</div>
                      ) : (
                        props.history.map(entry => (
                          <HistoryCard 
                            key={entry.id} 
                            entry={entry} 
                            isExpanded={expandedHistoryId === entry.id} 
                            onToggle={() => setExpandedHistoryId(expandedHistoryId === entry.id ? null : entry.id)} 
                            onLoadRecord={props.onLoadHistory} 
                            onImageDoubleClick={props.setViewingImage}
                            onDeleteImage={handleDeleteHistoryImage}
                          />
                        ))
                      )}
                    </div>
                  </>
                ) : (
                  <div className="flex flex-col h-full items-center py-6 gap-6 cursor-pointer hover:bg-slate-50 transition-colors" onClick={() => setIsHistoryExpanded(true)}>
                    <i className="fas fa-chevron-left text-slate-300"></i>
                    <div className="writing-mode-vertical-rl text-[10px] font-black text-slate-400 uppercase tracking-widest" style={{ writingMode: 'vertical-rl' }}>History</div>
                  </div>
                )}
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-300">
            <i className="fas fa-user-md text-6xl mb-4 opacity-20"></i>
            <p className="font-black uppercase tracking-[0.2em]">Select a patient to start consultation</p>
          </div>
        )}
      </main>

      {isOrderModalOpen && activePatient && (
        <OrderModal 
          isOpen={isOrderModalOpen}
          onClose={() => setIsOrderModalOpen(false)}
          onSave={handleSaveOrder}
          vets={props.vets}
          isSubmitting={isSubmittingOrder}
          activeSoapId={props.currentSoap?.id}
          draftOrder={{ patient_id: activePatient.id, patient_name: activePatient.name }}
        />
      )}

      {isResizing && (
        <div 
          className="fixed inset-0 z-[100] cursor-col-resize"
          onMouseMove={(e) => {
            const newWidth = e.clientX;
            if (newWidth >= 200 && newWidth <= 500) setSidebarWidth(newWidth);
          }}
          onMouseUp={() => setIsResizing(false)}
        />
      )}
    </div>
  );
};
