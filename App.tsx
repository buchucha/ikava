
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Patient, SOAPRecord, UserProfile, AppView, Veterinarian, ClinicSettings, WaitlistEntry, Species, Appointment, Option, ReceptionStatus } from './types';
import { ImageModal } from './components/ImageModal';
import { SelectionModal } from './components/SelectionModal';
import { TopNavigation } from './components/TopNavigation';
import { LoginPage } from './components/LoginPage';
import { SettingsModal } from './components/SettingsModal';
import { ReceptionPage } from './components/ReceptionPage';
import { BillingPage } from './components/BillingPage';
import { AppointmentPage } from './components/AppointmentPage';
import { ExaminationPage } from './components/ExaminationPage';
import { ConsultationPage } from './components/ConsultationPage';
import { supabase } from './services/supabaseClient';
import { getDiagnosticSuggestions, getDifferentialDiagnoses, getTxSuggestions, getRxSuggestions, getSummarySuggestions } from './services/geminiService';

const ADMIN_EMAIL = "mindonesia0000@gmail.com";

const calculateAgeString = (birthDateStr?: string): string => {
  if (!birthDateStr) return '-';
  const [bYear, bMonth, bDay] = birthDateStr.split('-').map(Number);
  const birthDate = new Date(bYear, bMonth - 1, bDay);
  const now = new Date(); now.setHours(0,0,0,0);
  let years = now.getFullYear() - birthDate.getFullYear();
  let months = now.getMonth() - birthDate.getMonth();
  if (months < 0 || (months === 0 && now.getDate() < birthDate.getDate())) { years--; months += 12; }
  return years === 0 ? (months === 0 ? 'Newborn' : `${months}m`) : (months === 0 ? `${years}y` : `${years}y ${months}m`);
};

const App: React.FC = () => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [vets, setVets] = useState<Veterinarian[]>([]);
  const [clinicSettings, setClinicSettings] = useState<ClinicSettings>(() => {
    const saved = localStorage.getItem('ikava_clinic_settings');
    return saved ? JSON.parse(saved) : { lunchStartTime: "13:00", lunchEndTime: "14:00", isLunchEnabled: true, imageServerUrl: '' };
  });
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [activeView, setActiveView] = useState<AppView>('Reception');
  const [selectedPatientId, setSelectedPatientId] = useState('');
  const [showDashboard, setShowDashboard] = useState(false); 
  const [soapStep, setSoapStep] = useState<'S' | 'O' | 'A' | 'P'>('S');
  const [viewingImage, setViewingImage] = useState<string | null>(null);
  const [isSelectionModalOpen, setIsSelectionModalOpen] = useState(false);
  const [selectionModalConfig, setSelectionModalConfig] = useState<{title: string; icon: string; options: Option[]; isLoading: boolean; onConfirm: (selected: string[]) => void;}>({ title: '', icon: '', options: [], isLoading: false, onConfirm: () => {} });
  const [realPatients, setRealPatients] = useState<Patient[]>([]);
  const [waitlist, setWaitlist] = useState<WaitlistEntry[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [history, setHistory] = useState<SOAPRecord[]>([]);
  const [isLoadingInitial, setIsLoadingInitial] = useState(false);
  const [isSavingSoap, setIsSavingSoap] = useState(false);
  const [currentSoap, setCurrentSoap] = useState<Partial<SOAPRecord>>({ assessmentDdx: [], images: [], labResults: { cbc: {}, chemistry: {} } });

  const mapDbPatient = useCallback((p: any): Patient => ({ id: String(p.id), chartNumber: p.chart_number || '', name: p.name || 'Unknown', species: (p.species as Species) || Species.DOG, breed: p.breed || '-', birth_date: p.birth_date, age: calculateAgeString(p.birth_date), gender: p.gender || '-', weight: Number(p.weight || 0), owner: p.owner || 'Unknown Owner', phone: p.phone || '-', lastVisit: p.last_visit || p.created_at || new Date().toISOString(), avatar: p.avatar || `https://i.pravatar.cc/150?u=${p.id}`, notes: p.notes || '', chipNumber: p.chip_number || '', medical_memo: p.medical_memo }), []);
  const mapDbSoap = useCallback((db: any): SOAPRecord => ({ id: String(db.id), patientId: String(db.patient_id), date: db.date || new Date(db.created_at).toISOString().split('T')[0], cc: db.cc || '', subjective: db.subjective || '', objective: db.objective || '', assessmentProblems: db.assessment_problems || '', assessmentDdx: db.assessment_ddx || [], planTx: db.plan_tx || '', planRx: db.plan_rx || '', planSummary: db.plan_summary || '', images: db.images || [], labResults: db.lab_results || { cbc: {}, chemistry: {} } }), []);
  const mapDbWaitlist = useCallback((db: any): WaitlistEntry => ({ id: String(db.id), patientId: String(db.patient_id), patientName: db.patient_name, breed: db.breed, ownerName: db.owner_name, vetId: db.vet_id || '', time: new Date(db.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }), status: (db.status || 'Waiting') as ReceptionStatus, memo: db.memo, type: db.type }), []);
  const mapDbAppointment = useCallback((db: any): Appointment => ({ id: String(db.id), vetId: db.vet_id, patientId: db.patient_id, date: db.date, startTime: db.start_time.substring(0, 5), endTime: db.end_time.substring(0, 5), reason: db.reason || '', isRecurring: db.is_recurring || false, color: db.color || '#3b82f6' }), []);

  const fetchPatients = async () => { const { data } = await supabase.from('patients').select('*').order('created_at', { ascending: false }); if (data) setRealPatients(data.map(mapDbPatient)); };
  const fetchWaitlist = async () => { const { data } = await supabase.from('waitlist').select('*').order('created_at', { ascending: true }); if (data) setWaitlist(data.map(mapDbWaitlist)); };
  const fetchAppointments = async () => { const { data } = await supabase.from('appointments').select('*'); if (data) setAppointments(data.map(mapDbAppointment)); };
  const fetchVets = async () => { const { data } = await supabase.from('veterinarians').select('*').order('name', { ascending: true }); if (data) setVets(data.map(db => ({ id: db.id, name: db.name, specialty: db.specialty, email: db.email, avatar: db.avatar || `https://i.pravatar.cc/150?u=${db.id}` }))); };
  const fetchPatientHistory = async (pId: string) => { if (!pId) return; const { data } = await supabase.from('soap_records').select('*').eq('patient_id', pId).order('created_at', { ascending: false }); if (data) { let mapped = data.map(mapDbSoap); setHistory(mapped); const today = new Date().toISOString().split('T')[0]; const todayR = mapped.find(r => r.date === today); if (todayR) setCurrentSoap(todayR); else handleNewChart(pId); } };
  const handleNewChart = (pId: string) => { setCurrentSoap({ id: undefined, patientId: pId, date: new Date().toISOString().split('T')[0], cc: '', subjective: '', objective: '', assessmentProblems: '', assessmentDdx: [], planTx: '', planRx: '', planSummary: '', images: [], labResults: { cbc: {}, chemistry: {} } }); setSoapStep('S'); };

  useEffect(() => { fetchVets(); if (!isLoggedIn) return; setIsLoadingInitial(true); Promise.all([fetchPatients(), fetchWaitlist(), fetchAppointments()]).finally(() => setIsLoadingInitial(false)); const channel = supabase.channel('global-sync-v10').on('postgres_changes', { event: '*', table: 'veterinarians', schema: 'public' }, () => fetchVets()).on('postgres_changes', { event: '*', table: 'patients', schema: 'public' }, () => fetchPatients()).on('postgres_changes', { event: '*', table: 'waitlist', schema: 'public' }, () => fetchWaitlist()).on('postgres_changes', { event: '*', table: 'appointments', schema: 'public' }, () => fetchAppointments()).on('postgres_changes', { event: '*', table: 'soap_records', schema: 'public' }, (p) => { if(selectedPatientId && (p.new as any).patient_id === selectedPatientId) fetchPatientHistory(selectedPatientId); }).subscribe(); return () => { supabase.removeChannel(channel); }; }, [isLoggedIn, selectedPatientId]);
  useEffect(() => { if (selectedPatientId) fetchPatientHistory(selectedPatientId); }, [selectedPatientId]);

  const handleSaveSoap = async () => {
    const pId = selectedPatientId || currentSoap.patientId; if (!pId) return;
    setIsSavingSoap(true);
    try {
      const payload: any = { patient_id: pId, date: currentSoap.date || new Date().toISOString().split('T')[0], cc: currentSoap.cc, subjective: currentSoap.subjective, objective: currentSoap.objective, assessment_problems: currentSoap.assessmentProblems, assessment_ddx: currentSoap.assessmentDdx, plan_tx: currentSoap.planTx, plan_rx: currentSoap.planRx, plan_summary: currentSoap.planSummary, images: currentSoap.images, lab_results: currentSoap.labResults };
      const q = currentSoap.id ? supabase.from('soap_records').update(payload).eq('id', currentSoap.id) : supabase.from('soap_records').insert([payload]);
      const { data, error } = await q.select();
      if (error) throw error;
      if (data && data[0]) setCurrentSoap(mapDbSoap(data[0]));
      fetchPatientHistory(pId);
    } catch (e: any) { console.error('Save failed:', e.message); } finally { setIsSavingSoap(false); }
  };

  const activePatient = useMemo(() => realPatients.find(p => p.id === selectedPatientId) || null, [selectedPatientId, realPatients]);
  if (!isLoggedIn) return <LoginPage onLogin={u => { if (u.email === ADMIN_EMAIL || vets.some(v => v.email?.toLowerCase() === u.email.toLowerCase())) { setUser({ ...u, isAdmin: u.email === ADMIN_EMAIL }); setIsLoggedIn(true); } }} />;
  if (isLoadingInitial) return <div className="h-screen w-screen flex items-center justify-center bg-slate-950 text-white font-black animate-pulse">VETPULSE INITIALIZING...</div>;

  return (
    <div className="flex flex-col h-screen bg-slate-100 overflow-hidden">
      <TopNavigation activeView={activeView} onViewChange={setActiveView} onLogout={() => setIsLoggedIn(false)} userName={user?.name} isAdmin={user?.isAdmin} onOpenSettings={() => setIsSettingsOpen(true)} activePatient={activePatient} onClearPatient={() => { setSelectedPatientId(''); setShowDashboard(false); }} />
      <div className="flex-1 overflow-hidden relative">
        {activeView === 'Reception' && <ReceptionPage patients={realPatients} vets={vets} waitlist={waitlist} selectedPatientId={selectedPatientId} showDashboard={showDashboard} onRegisterPatient={async p => { const { data } = await supabase.from('patients').insert([p]).select(); return data ? mapDbPatient(data[0]) : null; }} onUpdatePatient={async (id, p) => { const { data } = await supabase.from('patients').update(p).eq('id', id).select(); return data ? mapDbPatient(data[0]) : null; }} onUpdateWaitlist={async (id, up) => { await supabase.from('waitlist').update({ vet_id: up.vetId || null, status: up.status, memo: up.memo }).eq('id', id); fetchWaitlist(); }} onAddToWaitlist={async e => { await supabase.from('waitlist').insert([{ ...e, status: 'Waiting' }]); fetchWaitlist(); }} onRemoveFromWaitlist={async id => { await supabase.from('waitlist').delete().eq('id', id); fetchWaitlist(); }} onSelectPatient={id => { setSelectedPatientId(id); setShowDashboard(true); }} />}
        {activeView === 'Consultation' && <ConsultationPage patients={realPatients} vets={vets} waitlist={waitlist} selectedPatientId={selectedPatientId} onSelectPatient={setSelectedPatientId} onUpdateWaitlist={async (id, up) => { await supabase.from('waitlist').update({ vet_id: up.vetId || null }).eq('id', id); fetchWaitlist(); }} onAddToWaitlist={async e => { await supabase.from('waitlist').insert([e]); fetchWaitlist(); }} onRemoveFromWaitlist={async id => { await supabase.from('waitlist').delete().eq('id', id); fetchWaitlist(); }} soapStep={soapStep} setSoapStep={setSoapStep} currentSoap={currentSoap} onUpdateSoap={(f, v) => setCurrentSoap(p => ({ ...p, [f]: v }))} isSavingSoap={isSavingSoap} onSaveSoap={handleSaveSoap} history={history} onLoadHistory={setCurrentSoap} setViewingImage={setViewingImage} onNewChart={handleNewChart} onSuggestTests={() => {}} onSuggestDdx={() => {}} onSuggestTx={() => {}} onSuggestRx={() => {}} onSuggestSummary={() => {}} clinicSettings={clinicSettings} />}
        {activeView === 'Examination' && <ExaminationPage patients={realPatients} selectedPatientId={selectedPatientId} activeSoapId={currentSoap.id} onSelectPatient={setSelectedPatientId} vets={vets} waitlist={waitlist} onAddToWaitlist={async e => { await supabase.from('waitlist').insert([e]); fetchWaitlist(); }} onUpdateWaitlist={async (id, up) => { await supabase.from('waitlist').update(up).eq('id', id); fetchWaitlist(); }} onRemoveFromWaitlist={async id => { await supabase.from('waitlist').delete().eq('id', id); fetchWaitlist(); }} />}
        {activeView === 'Billing' && <BillingPage patients={realPatients} vets={vets} waitlist={waitlist} onAddToWaitlist={async e => { await supabase.from('waitlist').insert([e]); fetchWaitlist(); }} onUpdateWaitlist={async (id, up) => { await supabase.from('waitlist').update(up).eq('id', id); fetchWaitlist(); }} onRemoveFromWaitlist={async id => { await supabase.from('waitlist').delete().eq('id', id); fetchWaitlist(); }} selectedPatientId={selectedPatientId} onSelectPatient={setSelectedPatientId} />}
        {activeView === 'Appointment' && <AppointmentPage vets={vets} patients={realPatients} appointments={appointments} clinicSettings={clinicSettings} activePatient={activePatient} onAddAppointment={async a => { await supabase.from('appointments').insert([a]); fetchAppointments(); return true; }} onUpdateAppointment={async (id, a) => { await supabase.from('appointments').update(a).eq('id', id); fetchAppointments(); return true; }} onDeleteAppointment={async id => { await supabase.from('appointments').delete().eq('id', id); fetchAppointments(); return true; }} />}
      </div>
      {isSettingsOpen && <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} vets={vets} clinicSettings={clinicSettings} onUpdateClinicSettings={s => { setClinicSettings(s); localStorage.setItem('ikava_clinic_settings', JSON.stringify(s)); }} onAddVet={async v => { await supabase.from('veterinarians').insert([v]); fetchVets(); }} onRemoveVet={async id => { await supabase.from('veterinarians').delete().eq('id', id); fetchVets(); }} />}
      {viewingImage && <ImageModal src={viewingImage} onClose={() => setViewingImage(null)} />}
    </div>
  );
};

export default App;
