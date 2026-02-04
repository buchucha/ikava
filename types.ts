
export enum Species {
  DOG = 'Dog',
  CAT = 'Cat',
  RABBIT = 'Rabbit',
  BIRD = 'Bird',
  OTHER = 'Other'
}

export interface Breed {
  id: string;
  species: string;
  name: string;
}

export interface DiagnosisReference {
  id: string;
  name: string;
}

export interface Patient {
  id: string;
  chartNumber?: string; // New: PACS 연동을 위한 차트 번호 (MRN)
  name: string;
  species: Species;
  breed: string;
  age: string;
  birth_date?: string;
  gender: string;
  weight: number;
  owner: string;
  phone: string;
  address?: string;
  chipNumber?: string;
  lastVisit: string;
  avatar: string;
  notes?: string; 
  medical_memo?: string;
}

export interface PatientVaccination {
  id: string;
  patient_id: string;
  vaccine_name: string;
  current_round: number;
  last_date: string | null;
  next_date: string | null;
}

export interface PatientParasites {
  id: string;
  patient_id: string;
  last_heartworm_date: string | null;
  next_heartworm_date: string | null;
  last_internal_date: string | null;
  next_internal_date: string | null;
  last_external_date: string | null;
  next_external_date: string | null;
}

export interface PatientReminders {
  id: string;
  patient_id: string;
  last_scaling_date: string | null;
  next_scaling_date: string | null;
  last_antibody_date: string | null;
  next_antibody_date: string | null;
  long_term_med_info: string | null;
  last_med_date: string | null;
  next_med_date: string | null;
  med_interval_days: number;
}

export interface Appointment {
  id: string;
  vetId: string;
  patientId?: string;
  patientName?: string; 
  date: string; 
  startTime: string; 
  endTime: string;   
  reason: string;
  isRecurring: boolean;
  color: string;
}

export interface ClinicSettings {
  lunchStartTime: string;
  lunchEndTime: string;
  isLunchEnabled: boolean;
  imageServerUrl?: string; // 로컬 이미지 서버 주소
}

export type ReceptionStatus = 'Waiting' | 'Consulting' | 'Testing' | 'Billing Queue' | 'Completed' | 'Cancelled';

export interface WaitlistEntry {
  id: string;
  patientId: string;
  patientName: string;
  breed: string;
  ownerName: string;
  vetId: string;
  time: string;
  status: ReceptionStatus;
  memo: string;
  type: string; 
}

export interface SOAPRecord {
  id: string;
  patientId: string;
  date: string;
  cc: string;
  subjective: string;
  objective: string;
  assessmentProblems: string;
  assessmentDdx: string[];
  planTx: string;           
  planRx: string;           
  planSummary: string;
  images?: string[];
  labResults?: LabResults;
}

export interface LabResults {
  cbc?: { wbc?: string; rbc?: string; hgb?: string; hct?: string; plt?: string; };
  chemistry?: { glu?: string; bun?: string; crea?: string; alt?: string; alp?: string; tp?: string; };
}

export type SOAPField = 'cc'|'subjective'|'objective'|'assessmentProblems'|'assessmentDdx'|'planTx'|'planRx'|'planSummary'|'images'|'labResults';

export interface UserProfile { name: string; email: string; isAdmin: boolean; }
export interface Veterinarian { id: string; name: string; specialty: string; avatar: string; email?: string; }
export type AppView = 'Reception' | 'Consultation' | 'Examination' | 'Appointment' | 'Billing';

export interface PatientWeight {
  id: string;
  patient_id: string;
  weight: number;
  recorded_at: string;
}

// --- NEW BILLING TYPES ---

export type ServiceCategory = 'CONSULTATION' | 'LABORATORY' | 'PROCEDURE' | 'PHARMACY' | 'HOSPITALIZATION' | 'SUPPLIES' | 'PREVENTION' | 'FOOD' | 'IMAGING';

export interface ServiceCatalogItem {
  id: string;
  category: ServiceCategory;
  subcategory?: string;
  name: string;
  sku_code?: string;
  default_price: number;
  cost_price?: number;
}

export interface BillingItem {
  id: string; // UUID in DB, or temp ID in UI
  invoice_id?: string;
  linked_order_id?: string; // Links back to a department order
  service_id?: string;
  
  name: string; // item_name in DB
  category: string;
  
  unit_price: number;
  quantity: number;
  discount_amount?: number;
  total_price: number;
  
  performingVetId?: string; // performing_vet_id in DB
  performed_at?: string;
  order_index?: number; // 순서 저장용
}

export interface PaymentRecord {
  id: string;
  patientId: string;
  amount: number;
  method: string;
  date: string;
}

export interface Option {
  id: string;
  title: string;
  subtitle?: string;
  extra?: string;
  fullContent: string;
}

export type DepartmentType = 'Treatment' | 'Pharmacy' | 'X-ray' | 'Ultrasound';

export interface OrderImage {
  url: string;
  name: string;
}

export interface DepartmentOrder {
  id: string;
  patient_id: string;
  patient_name: string;
  soap_id: string; 
  department: DepartmentType;
  vet_name: string;
  request_details: string;
  status: 'Pending' | 'In Progress' | 'Completed';
  created_at: string;
  order_index: number;
  items?: BillingItem[]; 
  images?: OrderImage[]; // 검사/처치 시 첨부된 이미지 (이름 포함)
  attachment_url?: string | null;
}