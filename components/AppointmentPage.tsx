import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Veterinarian, Appointment, ClinicSettings, Patient } from '../types';
import { AppointmentModal } from './AppointmentModal';

interface AppointmentPageProps {
  vets: Veterinarian[];
  patients: Patient[];
  appointments: Appointment[];
  clinicSettings: ClinicSettings;
  activePatient: Patient | null;
  onAddAppointment: (appointment: Omit<Appointment, 'id'>) => Promise<boolean>;
  onUpdateAppointment: (id: string, appointment: Omit<Appointment, 'id'>) => Promise<boolean>;
  onDeleteAppointment: (id: string) => Promise<boolean>;
}

// Drag Interaction State Type
interface InteractionState {
  type: 'move' | 'resize';
  apptId: string;
  originalVetId: string;
  originalStartMinutes: number;
  originalEndMinutes: number;
  startX: number;
  startY: number;
  tempVetId: string;
  tempStartMinutes: number;
  tempEndMinutes: number;
}

export const AppointmentPage: React.FC<AppointmentPageProps> = ({ 
  vets, 
  patients,
  appointments, 
  clinicSettings,
  activePatient,
  onAddAppointment,
  onUpdateAppointment,
  onDeleteAppointment
}) => {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAppointment, setEditingAppointment] = useState<Appointment | null>(null);
  
  // Selection Drag State (New Creation)
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectStart, setSelectStart] = useState<{ vetId: string; time: string } | null>(null);
  const [selectEnd, setSelectEnd] = useState<{ vetId: string; time: string } | null>(null);

  // Interaction State (Move/Resize)
  const [interaction, setInteraction] = useState<InteractionState | null>(null);

  const [preSelectedTime, setPreSelectedTime] = useState<string | undefined>(undefined);
  const [preSelectedEndTime, setPreSelectedEndTime] = useState<string | undefined>(undefined);
  const [preSelectedVetId, setPreSelectedVetId] = useState<string | undefined>(undefined);

  const actualVets = useMemo(() => vets.filter(v => v.id !== 'ALL_VETS'), [vets]);

  const SLOT_HEIGHT = 64; 
  const VET_COLUMN_WIDTH = 240; 
  const TIME_COLUMN_WIDTH = 80; 
  const MIN_DURATION_MINUTES = 15;

  // Time Slot Generation
  const timeSlots = useMemo(() => {
    const slots = [];
    for (let h = 9; h <= 19; h++) {
      for (let m = 0; m < 60; m += 15) {
        slots.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
      }
    }
    slots.push("20:00");
    return slots;
  }, []);

  // Filter Appointments for Date
  const getDayOfWeek = (dateStr: string) => {
    if (!dateStr) return -1;
    const [y, m, d] = dateStr.split('-').map(Number);
    return new Date(y, m - 1, d).getDay();
  };

  const appointmentsForDate = useMemo(() => {
    const targetDay = getDayOfWeek(selectedDate);
    return appointments.filter(a => {
      const apptDay = getDayOfWeek(a.date);
      return a.date === selectedDate || (a.isRecurring && selectedDate >= a.date && apptDay === targetDay);
    });
  }, [appointments, selectedDate]);

  const individualAppts = useMemo(() => appointmentsForDate.filter(a => a.vetId !== 'ALL_VETS'), [appointmentsForDate]);

  // Helper Functions
  const parseMinutes = (time: string) => {
    const [h, m] = time.split(':').map(Number);
    return h * 60 + m;
  };

  const formatMinutes = (minutes: number) => {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  };

  const calculateDurationInSlots = (start: string, end: string) => {
    return (parseMinutes(end) - parseMinutes(start)) / 15;
  };

  const calculateOffsetInSlots = (startTime: string) => {
    return (parseMinutes(startTime) - 540) / 15; // 540 = 9:00 * 60
  };

  // --- Selection Handlers (Create New) ---
  const handleCellStart = (vetId: string, time: string) => {
    setIsSelecting(true);
    setSelectStart({ vetId, time });
    setSelectEnd({ vetId, time });
  };

  const handleCellMove = (e: React.MouseEvent | React.TouchEvent, vetId: string, time: string) => {
    // For touch, we need to calculate which element is under the finger
    if (e.type === 'touchmove') {
      // Touch logic handled in global listener or requires elementFromPoint
      // For grid selection, simple touchmove is tricky without custom logic.
      // Keeping it simple for now: Touch selection might just be single tap.
      return; 
    }
    
    if (isSelecting && selectStart && selectStart.vetId === vetId) {
      setSelectEnd({ vetId, time });
    }
  };

  const handleCellEnd = () => {
    if (isSelecting && selectStart && selectEnd) {
      const startIndex = timeSlots.indexOf(selectStart.time);
      const endIndex = timeSlots.indexOf(selectEnd.time);
      const realStart = timeSlots[Math.min(startIndex, endIndex)];
      const lastSlotTime = timeSlots[Math.max(startIndex, endIndex)];
      
      const totalMinutes = parseMinutes(lastSlotTime) + 15;
      const endH = Math.min(Math.floor(totalMinutes / 60), 20);
      const endM = endH === 20 ? 0 : totalMinutes % 60;
      const realEnd = `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;

      setPreSelectedVetId(selectStart.vetId);
      setPreSelectedTime(realStart);
      setPreSelectedEndTime(realEnd);
      setEditingAppointment(null);
      setIsModalOpen(true);
    }
    setIsSelecting(false);
    setSelectStart(null);
    setSelectEnd(null);
  };

  // --- Interaction Handlers (Move & Resize) ---
  const handleApptStart = (e: React.MouseEvent | React.TouchEvent, appt: Appointment, type: 'move' | 'resize') => {
    e.stopPropagation(); // Prevent cell selection
    // e.preventDefault();  // Removed to allow scrolling if needed, but handled carefully
    
    let clientX, clientY;
    if ('touches' in e) {
       clientX = e.touches[0].clientX;
       clientY = e.touches[0].clientY;
    } else {
       clientX = (e as React.MouseEvent).clientX;
       clientY = (e as React.MouseEvent).clientY;
    }

    setInteraction({
      type,
      apptId: appt.id,
      originalVetId: appt.vetId,
      originalStartMinutes: parseMinutes(appt.startTime),
      originalEndMinutes: parseMinutes(appt.endTime),
      startX: clientX,
      startY: clientY,
      tempVetId: appt.vetId,
      tempStartMinutes: parseMinutes(appt.startTime),
      tempEndMinutes: parseMinutes(appt.endTime)
    });
  };

  // Global Mouse/Touch Handlers for Smooth Dragging
  useEffect(() => {
    const handleWindowMove = (e: MouseEvent | TouchEvent) => {
      if (!interaction) return;
      
      // Prevent scrolling on touch while dragging an appointment
      if (e.type === 'touchmove') e.preventDefault();

      let clientX, clientY;
      if ('touches' in e) {
         clientX = e.touches[0].clientX;
         clientY = e.touches[0].clientY;
      } else {
         clientX = (e as MouseEvent).clientX;
         clientY = (e as MouseEvent).clientY;
      }

      const deltaX = clientX - interaction.startX;
      const deltaY = clientY - interaction.startY;
      
      const slotsMovedY = Math.round(deltaY / SLOT_HEIGHT);
      const colsMovedX = Math.round(deltaX / VET_COLUMN_WIDTH);

      if (interaction.type === 'move') {
        // Handle Vet Column Change
        const vetIndex = actualVets.findIndex(v => v.id === interaction.originalVetId);
        let newVetIndex = vetIndex + colsMovedX;
        newVetIndex = Math.max(0, Math.min(newVetIndex, actualVets.length - 1));
        const newVetId = actualVets[newVetIndex].id;

        // Handle Time Change
        const duration = interaction.originalEndMinutes - interaction.originalStartMinutes;
        let newStart = interaction.originalStartMinutes + (slotsMovedY * 15);
        
        // Bounds check (9:00 - 20:00)
        const minStart = parseMinutes("09:00");
        const maxStart = parseMinutes("20:00") - duration;
        newStart = Math.max(minStart, Math.min(newStart, maxStart));
        
        const newEnd = newStart + duration;

        setInteraction(prev => prev ? ({
          ...prev,
          tempVetId: newVetId,
          tempStartMinutes: newStart,
          tempEndMinutes: newEnd
        }) : null);

      } else if (interaction.type === 'resize') {
        // Handle Resize (Only Height)
        let newEnd = interaction.originalEndMinutes + (slotsMovedY * 15);
        
        // Min Duration Check
        if (newEnd - interaction.originalStartMinutes < MIN_DURATION_MINUTES) {
          newEnd = interaction.originalStartMinutes + MIN_DURATION_MINUTES;
        }
        
        // Max End Check
        const maxEnd = parseMinutes("20:00"); 
        newEnd = Math.min(newEnd, maxEnd);

        setInteraction(prev => prev ? ({
          ...prev,
          tempEndMinutes: newEnd
        }) : null);
      }
    };

    const handleWindowEnd = async (e: MouseEvent | TouchEvent) => {
      if (!interaction) return;

      const { apptId, tempVetId, tempStartMinutes, tempEndMinutes, originalVetId, originalStartMinutes, originalEndMinutes } = interaction;
      
      // Check if changed
      const hasChanged = tempVetId !== originalVetId || 
                         tempStartMinutes !== originalStartMinutes || 
                         tempEndMinutes !== originalEndMinutes;

      if (hasChanged) {
        const appointment = appointments.find(a => a.id === apptId);
        if (appointment) {
          const success = await onUpdateAppointment(apptId, {
            ...appointment,
            vetId: tempVetId,
            startTime: formatMinutes(tempStartMinutes),
            endTime: formatMinutes(tempEndMinutes)
          });
          if (!success) {
            alert("Failed to update appointment.");
          }
        }
      }
      
      setInteraction(null);
    };

    if (interaction) {
      window.addEventListener('mousemove', handleWindowMove);
      window.addEventListener('mouseup', handleWindowEnd);
      window.addEventListener('touchmove', handleWindowMove, { passive: false });
      window.addEventListener('touchend', handleWindowEnd);
    }

    return () => {
      window.removeEventListener('mousemove', handleWindowMove);
      window.removeEventListener('mouseup', handleWindowEnd);
      window.removeEventListener('touchmove', handleWindowMove);
      window.removeEventListener('touchend', handleWindowEnd);
    };
  }, [interaction, actualVets, appointments, onUpdateAppointment, SLOT_HEIGHT, VET_COLUMN_WIDTH]);


  const isSlotSelected = (vetId: string, time: string) => {
    if (!selectStart || !selectEnd || selectStart.vetId !== vetId) return false;
    const startIndex = timeSlots.indexOf(selectStart.time);
    const endIndex = timeSlots.indexOf(selectEnd.time);
    const currentIndex = timeSlots.indexOf(time);
    return currentIndex >= Math.min(startIndex, endIndex) && currentIndex <= Math.max(startIndex, endIndex);
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 font-['Inter'] select-none" onMouseUp={handleCellEnd} onTouchEnd={handleCellEnd}>
      <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8 flex-shrink-0 z-[60] shadow-sm">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center text-white shadow-md">
              <i className="fas fa-calendar-alt text-sm"></i>
            </div>
            <h1 className="text-lg font-black text-slate-900 tracking-tight uppercase">Reservation Scheduler</h1>
          </div>
          <div className="flex items-center bg-slate-100 rounded-xl p-0.5 border border-slate-200">
            <button onClick={() => {
              const d = new Date(selectedDate); d.setDate(d.getDate() - 1); setSelectedDate(d.toISOString().split('T')[0]);
            }} className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-slate-900 rounded-lg hover:bg-white">
              <i className="fas fa-chevron-left text-[10px]"></i>
            </button>
            <div className="px-4 flex flex-col items-center min-w-[100px]">
              <span className="text-[10px] font-black text-slate-900">{selectedDate}</span>
            </div>
            <button onClick={() => {
              const d = new Date(selectedDate); d.setDate(d.getDate() + 1); setSelectedDate(d.toISOString().split('T')[0]);
            }} className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-slate-900 rounded-lg hover:bg-white">
              <i className="fas fa-chevron-right text-[10px]"></i>
            </button>
          </div>
        </div>
        <button onClick={() => { setEditingAppointment(null); setIsModalOpen(true); }} className="px-6 py-2 bg-slate-900 hover:bg-black text-white rounded-xl font-black text-[11px] uppercase tracking-widest shadow-lg transition-all flex items-center gap-2">
          <i className="fas fa-plus"></i> New Appointment
        </button>
      </header>

      <div className="flex-1 overflow-auto custom-scrollbar relative bg-slate-50 flex flex-col">
        <div className="min-w-max relative flex flex-col">
          <div className="flex sticky top-0 z-[55] bg-white border-b border-slate-200 shadow-sm">
            <div style={{ width: `${TIME_COLUMN_WIDTH}px` }} className="flex-shrink-0 bg-slate-50 border-r border-slate-200 flex items-center justify-center sticky left-0 z-[56]">
              <i className="fas fa-clock text-slate-300 text-[10px]"></i>
            </div>
            {actualVets.map(vet => (
              <div key={vet.id} style={{ width: `${VET_COLUMN_WIDTH}px` }} className="flex-shrink-0 border-r border-slate-100 p-4 flex items-center gap-3 bg-white">
                <img src={vet.avatar} className="w-10 h-10 rounded-full object-cover border-2 border-slate-100" alt="" />
                <div className="min-w-0">
                  <p className="text-sm font-black text-slate-900 truncate">{vet.name}</p>
                  <p className="text-[9px] font-bold text-blue-600 uppercase tracking-tighter truncate">{vet.specialty}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="flex relative">
            <div className="flex flex-col sticky left-0 z-50 bg-white border-r border-slate-200 shadow-sm">
              {timeSlots.map((time, idx) => {
                const isHour = time.endsWith(':00');
                const isLast = idx === timeSlots.length - 1;
                return (
                  <div key={time} style={{ height: isLast ? '0px' : `${SLOT_HEIGHT}px`, width: `${TIME_COLUMN_WIDTH}px` }} className={`flex-shrink-0 relative border-b border-slate-100 transition-colors ${isHour ? 'bg-slate-50' : ''}`}>
                    <span className={`absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 px-2 py-0.5 rounded text-[10px] font-black tracking-tighter z-10 ${isHour ? 'text-slate-900 bg-white border border-slate-200 shadow-sm' : 'text-slate-300'}`}>
                      {time}
                    </span>
                  </div>
                );
              })}
            </div>

            <div className="flex relative flex-1">
              {actualVets.map((vet) => (
                <div key={vet.id} style={{ width: `${VET_COLUMN_WIDTH}px` }} className="flex-shrink-0 border-r border-slate-100 relative bg-white">
                  {timeSlots.slice(0, -1).map((time) => (
                    <div 
                      key={time} 
                      style={{ height: `${SLOT_HEIGHT}px` }} 
                      className={`border-b border-slate-50 cursor-pointer transition-colors flex items-center justify-center group/cell ${isSlotSelected(vet.id, time) ? 'bg-blue-50' : 'hover:bg-slate-50'}`} 
                      onMouseDown={() => handleCellStart(vet.id, time)} 
                      onTouchStart={() => handleCellStart(vet.id, time)}
                      onMouseEnter={(e) => handleCellMove(e, vet.id, time)}
                    >
                      <i className={`fas fa-plus text-[10px] ${isSlotSelected(vet.id, time) ? 'opacity-100' : 'opacity-0'} group-hover/cell:opacity-100 transition-opacity text-blue-400`}></i>
                    </div>
                  ))}

                  {individualAppts.filter(a => a.vetId === vet.id || (interaction?.apptId === a.id && interaction.tempVetId === vet.id)).map(appt => {
                    const isInteracting = interaction?.apptId === appt.id;
                    
                    // If interacting, use temporary values. Else use appointment values.
                    let startT = appt.startTime;
                    let endT = appt.endTime;
                    
                    if (isInteracting) {
                        if (vet.id !== interaction.tempVetId) return null; // Don't render in original column if moved
                        startT = formatMinutes(interaction.tempStartMinutes);
                        endT = formatMinutes(interaction.tempEndMinutes);
                    } else {
                        // Not interacting, standard render.
                        if (vet.id !== appt.vetId) return null; // Should be handled by filter but double check
                    }

                    const durationSlots = calculateDurationInSlots(startT, endT);
                    const topOffset = calculateOffsetInSlots(startT) * SLOT_HEIGHT;
                    const patient = patients.find(p => p.id === appt.patientId);
                    
                    // Check if short duration (1 slot = 15 mins)
                    const isShort = durationSlots <= 1.01; 

                    return (
                      <div 
                        key={appt.id} 
                        onMouseDown={(e) => handleApptStart(e, appt, 'move')}
                        onTouchStart={(e) => handleApptStart(e, appt, 'move')}
                        onDoubleClick={(e) => { e.stopPropagation(); setEditingAppointment(appt); setIsModalOpen(true); }}
                        className={`absolute left-1 right-1 rounded-lg border-l-4 shadow-sm transition-all flex group overflow-hidden ${isShort ? 'flex-row items-center px-2 py-1 gap-2' : 'flex-col p-3'} ${isInteracting ? 'z-50 opacity-90 shadow-xl scale-[1.02] cursor-grabbing' : 'cursor-grab hover:shadow-md hover:scale-[1.01] hover:z-40'}`} 
                        style={{ 
                          top: `${topOffset + 2}px`, 
                          height: `${Math.max(durationSlots * SLOT_HEIGHT - 4, 30)}px`, 
                          backgroundColor: `${appt.color}15`, 
                          borderLeftColor: appt.color,
                        }}
                      >
                        {/* Time Section */}
                        <div className={`flex-shrink-0 ${isShort ? '' : 'flex justify-between items-start mb-1 pointer-events-none'}`}>
                          <span className={`${isShort ? 'text-[10px]' : 'text-[9px] px-1.5 py-0.5 rounded bg-white/50 border border-white/80'} font-black uppercase tracking-tighter`} style={{ color: appt.color }}>
                            {startT}{!isShort && ` - ${endT}`}
                          </span>
                        </div>
                        
                        {/* Info Section */}
                        <div className={`min-w-0 pointer-events-none flex-1 ${isShort ? 'flex items-baseline gap-2' : ''}`}>
                            <p className={`font-black text-slate-950 truncate ${isShort ? 'text-[11px]' : 'text-[12px] mb-0.5'}`}>
                              {patient ? `[${patient.name}]` : '[미지정]'}
                            </p>
                            <p className={`${isShort ? 'text-[10px] truncate' : 'text-[10px] leading-snug line-clamp-2'} font-bold text-slate-600 italic`}>
                              {appt.reason}
                            </p>
                        </div>

                        {!isShort && (
                            <div className="mt-auto opacity-0 group-hover:opacity-100 transition-opacity text-right pointer-events-none absolute bottom-2 right-2">
                               <i className="fas fa-edit text-[9px] text-slate-400"></i>
                            </div>
                        )}

                        {/* Resize Handle */}
                        <div 
                          onMouseDown={(e) => handleApptStart(e, appt, 'resize')}
                          onTouchStart={(e) => handleApptStart(e, appt, 'resize')}
                          className="absolute bottom-0 left-0 right-0 h-6 cursor-ns-resize flex justify-center items-end pb-1 opacity-0 group-hover:opacity-100 transition-opacity z-10 touch-none"
                        >
                            <div className="w-8 h-1 bg-slate-400/50 rounded-full"></div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
              
              <div className="absolute top-0 bottom-0 left-0 right-0 pointer-events-none z-30">
                {clinicSettings.isLunchEnabled && (
                  <div className="absolute left-0 right-0 bg-amber-500/[0.03] border-y border-amber-500/10 flex items-center justify-center" style={{ top: `${calculateOffsetInSlots(clinicSettings.lunchStartTime) * SLOT_HEIGHT}px`, height: `${calculateDurationInSlots(clinicSettings.lunchStartTime, clinicSettings.lunchEndTime) * SLOT_HEIGHT}px` }}>
                    <div className="bg-white/90 backdrop-blur-sm border border-amber-200 px-6 py-1.5 rounded-full flex items-center gap-3 shadow-sm pointer-events-auto">
                      <i className="fas fa-utensils text-amber-500 text-[10px]"></i>
                      <span className="text-[9px] font-black text-amber-700 uppercase tracking-widest">Clinic Lunch Break</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <AppointmentModal 
        isOpen={isModalOpen}
        onClose={() => { setIsModalOpen(false); setEditingAppointment(null); setPreSelectedEndTime(undefined); }}
        vets={vets}
        patients={patients}
        onSave={async (data) => {
          const success = await (editingAppointment ? onUpdateAppointment(editingAppointment.id, data) : onAddAppointment(data));
          if (success) { setIsModalOpen(false); setEditingAppointment(null); setPreSelectedEndTime(undefined); }
        }}
        onDelete={async () => {
          if (editingAppointment && await onDeleteAppointment(editingAppointment.id)) { setIsModalOpen(false); setEditingAppointment(null); setPreSelectedEndTime(undefined); }
        }}
        initialAppointment={editingAppointment || undefined}
        initialDate={selectedDate}
        initialTime={preSelectedTime}
        initialEndTime={preSelectedEndTime}
        initialVetId={preSelectedVetId}
        activePatient={activePatient}
      />
    </div>
  );
};