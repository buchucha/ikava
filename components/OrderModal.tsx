
import React, { useState, useEffect, useRef } from 'react';
import { Veterinarian, DepartmentOrder, DepartmentType, BillingItem, ServiceCatalogItem, OrderImage } from '../types';
import { supabase } from '../services/supabaseClient';

export const uploadToSupabase = async (file: File) => {
  const fileExt = file.name.split('.').pop();
  const safeFileName = `${Date.now()}_${Math.random().toString(36).substring(2, 7)}.${fileExt}`;
  const filePath = `orders/${safeFileName}`;
  const { data, error } = await supabase.storage.from('order_images').upload(filePath, file, { cacheControl: '3600', upsert: false });
  if (error) return null;
  const { data: urlData } = supabase.storage.from('order_images').getPublicUrl(filePath);
  return urlData.publicUrl;
};

export const deleteFromSupabase = async (url: string) => {
  try {
    const filePath = url.split('/order_images/')[1];
    if (!filePath) return false;
    
    const { error } = await supabase.storage.from('order_images').remove([filePath]);
    if (error) {
      console.error('Supabase storage delete error:', error);
      return false;
    }
    return true;
  } catch (error) {
    console.error('Supabase storage delete failed:', error);
    return false;
  }
};

export const deleteFromNAS = async (url: string): Promise<boolean> => {
  try {
    const urlObj = new URL(url);
    const filename = urlObj.pathname.split('/uploads/')[1];
    if (!filename) return false;

    const response = await fetch(`http://localhost:3000/delete/${filename}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      console.error('NAS delete error:', response.status, response.statusText);
      return false;
    }

    const result = await response.json();
    return result.success;
  } catch (error) {
    console.error('NAS delete failed:', error);
    return false;
  }
};

export const deleteImageFromAllStorage = async (url: string) => {
  const results = await Promise.allSettled([
    deleteFromSupabase(url),
    deleteFromNAS(url)
  ]);

  const supabaseResult = results[0];
  const nasResult = results[1];

  console.log('Image deletion results:', {
    supabase: supabaseResult.status === 'fulfilled' ? supabaseResult.value : false,
    nas: nasResult.status === 'fulfilled' ? nasResult.value : false
  });
};

const DEPARTMENTS: { value: DepartmentType; label: string; icon: string; color: string }[] = [
  { value: 'Treatment', label: '처치실', icon: 'fa-briefcase-medical', color: 'text-indigo-600' },
  { value: 'Pharmacy', label: '약제실', icon: 'fa-pills', color: 'text-emerald-600' },
  { value: 'X-ray', label: 'X-ray', icon: 'fa-radiation', color: 'text-slate-700' },
  { value: 'Ultrasound', label: '초음파', icon: 'fa-wave-square', color: 'text-blue-600' }
];

const QuantityCalculator = ({ item, onConfirm, onCancel }: { item: ServiceCatalogItem, onConfirm: (qty: number) => void, onCancel: () => void }) => {
  const [days, setDays] = useState(1); const [freq, setFreq] = useState(2); const [dose, setDose] = useState(1);
  const total = days * freq * dose;
  return (
    <div className="absolute top-0 left-0 right-0 z-20 bg-slate-800 text-white p-3 rounded-lg shadow-xl animate-in fade-in zoom-in-95 duration-200">
      <h4 className="text-[10px] font-black uppercase tracking-widest text-blue-400 mb-2">{item.name}</h4>
      <div className="grid grid-cols-3 gap-2 mb-2">
        <div><label className="text-[9px] font-bold text-slate-400 block">Days</label><input type="number" min="1" value={days} onChange={e => setDays(Number(e.target.value))} className="w-full bg-slate-700 rounded px-1 text-xs text-center outline-none" /></div>
        <div><label className="text-[9px] font-bold text-slate-400 block">Freq</label><input type="number" min="1" value={freq} onChange={e => setFreq(Number(e.target.value))} className="w-full bg-slate-700 rounded px-1 text-xs text-center outline-none" /></div>
        <div><label className="text-[9px] font-bold text-slate-400 block">Unit</label><input type="number" min="0.1" step="0.1" value={dose} onChange={e => setDose(Number(e.target.value))} className="w-full bg-slate-700 rounded px-1 text-xs text-center outline-none" /></div>
      </div>
      <div className="flex justify-between items-center mt-2"><span className="text-sm font-black text-emerald-400">Total: {total}</span><div className="flex gap-2"><button onClick={onCancel} className="text-[9px] uppercase font-bold text-slate-400">Cancel</button><button onClick={() => onConfirm(total)} className="px-3 py-1 bg-blue-600 rounded text-[9px] font-black">Confirm</button></div></div>
    </div>
  );
};

interface OrderModalProps { isOpen: boolean; onClose: () => void; onSave: (vetName: string, details: string, items: BillingItem[], vetId: string, soapId: string, department: DepartmentType, images: OrderImage[], status: 'Pending' | 'In Progress' | 'Completed') => void; onDelete?: () => void; draftOrder?: Partial<DepartmentOrder> | null; editingOrder?: DepartmentOrder | null; vets: Veterinarian[]; isSubmitting: boolean; activeSoapId?: string; }

export const OrderModal: React.FC<OrderModalProps> = ({ isOpen, onClose, onSave, onDelete, draftOrder, editingOrder, vets, isSubmitting, activeSoapId }) => {
  const [selectedDept, setSelectedDept] = useState<DepartmentType>('Treatment');
  const [vetId, setVetId] = useState(''); const [details, setDetails] = useState(''); const [selectedItems, setSelectedItems] = useState<BillingItem[]>([]); const [orderImages, setOrderImages] = useState<OrderImage[]>([]); const [isUploading, setIsUploading] = useState(false); const [searchTerm, setSearchTerm] = useState(''); const [catalog, setCatalog] = useState<ServiceCatalogItem[]>([]); const [calculatingItem, setCalculatingItem] = useState<ServiceCatalogItem | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      const fetchCatalog = async () => { const { data } = await supabase.from('service_catalog').select('*').eq('is_active', true).order('name'); if (data) setCatalog(data); }; fetchCatalog();
      if (editingOrder) { 
        setVetId(vets.find(v => v.name === editingOrder.vet_name)?.id || vets[0]?.id || ''); 
        setDetails(editingOrder.request_details); 
        setSelectedItems(editingOrder.items || []); 
        setSelectedDept(editingOrder.department); 
        setOrderImages(editingOrder.images || []); 
      }
      else { 
        setVetId(vets[0]?.id || ''); 
        setDetails(''); 
        setSelectedItems([]); 
        setOrderImages([]); 
        setSelectedDept(draftOrder?.department || 'Treatment'); 
      }
    }
  }, [isOpen, editingOrder, draftOrder, vets]);

  // Fix: Implemented handleImageUpload function
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    try {
      const uploaded: OrderImage[] = [];
      for (const file of Array.from(files)) {
        const url = await uploadToSupabase(file);
        if (url) uploaded.push({ url, name: file.name });
      }
      setOrderImages(prev => [...prev, ...uploaded]);
    } catch (err) {
      console.error("Image upload failed:", err);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  if (!isOpen) return null;
  const displayPatientName = editingOrder ? editingOrder.patient_name : draftOrder?.patient_name;
  
  // CRITICAL FIX: activeSoapId 유무와 상관없이 제출 가능하도록 수정
  const isSubmitDisabled = isSubmitting || isUploading || !vetId;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-xl w-full max-w-4xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center"><h3 className="font-black text-slate-900 text-base">Medical Order</h3><button onClick={onClose} className="w-6 h-6 rounded-full hover:bg-slate-200 text-slate-400 flex items-center justify-center"><i className="fas fa-times text-xs"></i></button></div>
        <div className="bg-white border-b border-slate-100 p-1.5 flex gap-1">
          {DEPARTMENTS.map(dept => (<button key={dept.value} onClick={() => setSelectedDept(dept.value)} className={`flex-1 py-2 px-2 rounded-lg flex items-center justify-center gap-2 border ${selectedDept === dept.value ? `bg-slate-900 border-slate-900 text-white` : `bg-slate-50 text-slate-400`}`}><i className={`fas ${dept.icon} text-[10px]`}></i><span className="text-[11px] font-black uppercase">{dept.label}</span></button>))}
        </div>
        <div className="flex flex-1 overflow-hidden">
           <div className="w-1/3 p-5 border-r border-slate-100 flex flex-col bg-slate-50/50">
             <div className="relative mb-3"><input type="text" placeholder="Search catalog..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full bg-white border border-slate-200 rounded-lg pl-8 pr-3 py-2 text-xs outline-none" /><i className="fas fa-search absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i></div>
             <div className="flex-1 overflow-y-auto custom-scrollbar bg-white border border-slate-200 rounded-lg relative">
                {catalog.filter(i => i.name.toLowerCase().includes(searchTerm.toLowerCase())).map(item => (<div key={item.id} onClick={() => { if(item.category==='PHARMACY') setCalculatingItem(item); else setSelectedItems(p => [...p, { id: Date.now().toString(), service_id: item.id, name: item.name, unit_price: item.default_price, quantity: 1, total_price: item.default_price, category: item.category, performingVetId: vetId }]); }} className="px-3 py-2 border-b border-slate-50 hover:bg-blue-50 cursor-pointer flex justify-between items-center"><span className="text-xs font-bold truncate">{item.name}</span><span className="text-[10px] text-slate-400 font-bold">₩{item.default_price.toLocaleString()}</span></div>))}
                {calculatingItem && <QuantityCalculator item={calculatingItem} onConfirm={q => { setSelectedItems(p => [...p, { id: Date.now().toString(), service_id: calculatingItem.id, name: calculatingItem.name, unit_price: calculatingItem.default_price, quantity: q, total_price: calculatingItem.default_price * q, category: calculatingItem.category, performingVetId: vetId }]); setCalculatingItem(null); }} onCancel={() => setCalculatingItem(null)} />}
             </div>
           </div>
           <div className="w-1/3 p-5 flex flex-col space-y-4 border-r border-slate-100 overflow-y-auto">
              <div className="bg-blue-50/50 p-2.5 rounded-lg border border-blue-100"><span className="text-sm font-black text-slate-900 truncate block">{displayPatientName}</span></div>
              <select value={vetId} onChange={e => setVetId(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-bold outline-none"><option value="">Select Vet</option>{vets.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}</select>
              <div className="flex-1 min-h-[200px] border border-slate-200 rounded-lg flex flex-col bg-white overflow-hidden">
                <div className="bg-slate-100 px-3 py-1.5 border-b border-slate-200 flex justify-between"><span className="text-[9px] font-black text-slate-500 uppercase">Items ({selectedItems.length})</span></div>
                <div className="flex-1 overflow-y-auto">{selectedItems.map((it, idx) => (<div key={it.id} className="flex justify-between items-center px-2 py-1.5 border-b border-slate-50 last:border-0 hover:bg-slate-50"><span className="text-[10px] font-bold text-slate-700 truncate flex-1">{it.name} x{it.quantity}</span><button onClick={() => setSelectedItems(p => p.filter((_,i)=>i!==idx))} className="text-slate-300 hover:text-rose-500 ml-2"><i className="fas fa-times"></i></button></div>))}</div>
              </div>
              <textarea value={details} onChange={e => setDetails(e.target.value)} placeholder="Instructions..." className="w-full h-24 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs outline-none resize-none" />
           </div>
           <div className="w-1/3 p-5 flex flex-col bg-slate-50/30">
              <div className="flex justify-between items-center mb-3"><h4 className="text-[10px] font-black uppercase text-slate-500">Clinical Media</h4><button onClick={() => fileInputRef.current?.click()} className="px-3 py-1 bg-slate-900 text-white rounded text-[9px] font-black uppercase">Add Media</button><input type="file" ref={fileInputRef} hidden multiple accept="image/*" onChange={handleImageUpload} /></div>
               <div className="flex-1 overflow-y-auto border-2 border-dashed border-slate-200 rounded-xl p-2 bg-white">{orderImages.map((img, idx) => (<div key={idx} className="relative group bg-slate-50 border border-slate-200 rounded-lg overflow-hidden mb-2"><img src={img.url} className="w-full aspect-square object-cover" alt="" /><button onClick={async () => {
                 await deleteImageFromAllStorage(img.url);
                 setOrderImages(p => p.filter((_,i)=>i!==idx));
               }} className="absolute top-1 right-1 w-5 h-5 bg-rose-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100"><i className="fas fa-times text-[10px]"></i></button></div>))}</div>
           </div>
        </div>
        <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-2">
          {editingOrder && onDelete && <button onClick={onDelete} className="px-4 py-2 bg-rose-50 text-rose-500 rounded-lg font-black text-[10px] uppercase">Delete</button>}
          <button onClick={onClose} className="px-4 py-2 text-slate-500 font-black text-[10px] uppercase">Cancel</button>
          {editingOrder && <button disabled={isSubmitDisabled} onClick={() => onSave(vets.find(v=>v.id===vetId)?.name || '', details, selectedItems, vetId, activeSoapId || editingOrder.soap_id, selectedDept, orderImages, 'Completed')} className="px-5 py-2 bg-emerald-600 text-white rounded-lg font-black text-[10px] uppercase">Complete</button>}
          <button disabled={isSubmitDisabled} onClick={() => onSave(vets.find(v=>v.id===vetId)?.name || '', details, selectedItems, vetId, activeSoapId || editingOrder?.soap_id || '', selectedDept, orderImages, editingOrder?.status || 'Pending')} className="px-5 py-2 bg-slate-900 text-white rounded-lg font-black text-[10px] uppercase">Save</button>
        </div>
      </div>
    </div>
  );
};
