
import React from 'react';
import { AppView, Patient } from '../types';

interface TopNavigationProps {
  activeView: AppView;
  onViewChange: (view: AppView) => void;
  onLogout: () => void;
  onOpenSettings: () => void;
  userName?: string;
  isAdmin?: boolean;
  activePatient: Patient | null;
  onClearPatient: () => void;
}

export const TopNavigation: React.FC<TopNavigationProps> = ({ 
  activeView, 
  onViewChange, 
  onLogout, 
  onOpenSettings, 
  userName, 
  isAdmin,
  activePatient,
  onClearPatient
}) => {
  const tabs: AppView[] = ['Reception', 'Consultation', 'Examination', 'Appointment', 'Billing'];

  return (
    <nav className="flex flex-col w-full flex-shrink-0 z-50 select-none border-b border-slate-300 shadow-sm">
      {/* Top Bar - Slimmer version */}
      <div className="bg-slate-800 h-9 px-4 flex items-center justify-between border-b border-slate-700">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <div className="w-5 h-5 bg-blue-600 rounded flex items-center justify-center">
              <i className="fas fa-plus text-white text-[9px]"></i>
            </div>
            <span className="text-white font-bold tracking-tight text-base uppercase">IKAVA</span>
          </div>
          <div className="h-3 w-px bg-slate-600 mx-1"></div>
          <span className="text-slate-400 text-[9px] font-bold uppercase tracking-wider">Veterinary Medical Center</span>
        </div>
        <div className="flex items-center gap-4 text-slate-300 text-[10px] font-bold">
          {isAdmin && (
            <button 
              onClick={onOpenSettings}
              className="hover:text-white transition-colors flex items-center gap-1.5 px-2 py-1 rounded hover:bg-slate-700"
            >
              <i className="fas fa-cog text-[11px]"></i>
              Settings
            </button>
          )}
          <div className="flex items-center gap-3 ml-1 pl-4 border-l border-slate-700">
            <span className="text-slate-300">
              {userName || 'Dr. Guest'}
              {isAdmin && <span className="ml-1.5 text-[7px] bg-blue-600 text-white px-1 py-0.5 rounded leading-none">ADMIN</span>}
            </span>
            <button 
              onClick={onLogout}
              className="text-slate-400 hover:text-rose-400 transition-colors text-[9px] font-bold uppercase"
            >
              Log Out
            </button>
          </div>
        </div>
      </div>

      {/* Main Nav & Patient Info Bar - Integrated and Dense */}
      <div className="bg-slate-100 h-10 px-2 flex items-center gap-2">
        <div className="flex h-full">
          {tabs.map((tabLabel) => {
            const isActive = activeView === tabLabel;
            return (
              <button 
                key={tabLabel}
                onClick={() => onViewChange(tabLabel)}
                className={`relative h-full px-5 flex items-center justify-center transition-colors border-r border-slate-200 ${
                  isActive 
                  ? 'bg-white text-blue-600 font-bold border-b-2 border-b-blue-600' 
                  : 'text-slate-600 hover:bg-slate-200 font-medium'
                }`}
              >
                {tabLabel === 'Examination' ? (
                  <div className="flex flex-col items-center justify-center leading-none">
                    <span className="text-[10px] uppercase tracking-tighter">Examination</span>
                    <span className="text-[8px] uppercase tracking-widest opacity-80 mt-0.5">& Order</span>
                  </div>
                ) : (
                  <span className="text-xs uppercase tracking-tight">{tabLabel}</span>
                )}
              </button>
            );
          })}
        </div>
        
        {activePatient && (
          <div className="flex-1 flex items-center px-4">
            <div className="bg-white border border-slate-300 rounded px-3 h-7 flex items-center gap-4 shadow-sm text-[11px]">
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-900">{activePatient.name}</span>
                <span className="text-slate-500">({activePatient.breed})</span>
              </div>
              <div className="h-3 w-px bg-slate-200"></div>
              <div className="flex gap-3 text-slate-600 items-center">
                <span>Guardian: <b className="text-slate-900">{activePatient.owner}</b></span>
                <div className="h-2 w-px bg-slate-200"></div>
                <span>Gender: <b className="text-slate-900">{activePatient.gender}</b></span>
                <div className="h-2 w-px bg-slate-200"></div>
                <span>Age: <b className="text-slate-900">{activePatient.age}</b></span>
                <div className="h-2 w-px bg-slate-200"></div>
                <span>Weight: <b className="text-blue-600">{activePatient.weight}kg</b></span>
              </div>
              <button 
                onClick={onClearPatient}
                className="ml-1 text-slate-400 hover:text-rose-500"
              >
                <i className="fas fa-times text-[10px]"></i>
              </button>
            </div>
          </div>
        )}

        <div className="ml-auto flex items-center gap-3">
           <div className="flex items-center bg-white border border-slate-300 rounded px-2 h-7">
             <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full mr-2"></div>
             <span className="text-slate-600 text-[9px] font-bold uppercase">Online</span>
           </div>
        </div>
      </div>
    </nav>
  );
};
