
import React from 'react';
import { SOAPRecord } from '../types';

interface HistoryCardProps {
  entry: SOAPRecord;
  isExpanded: boolean;
  onToggle: () => void;
  onLoadRecord: (record: SOAPRecord) => void;
  onImageDoubleClick: (src: string) => void;
  onDeleteImage?: (recordId: string, imgUrl: string) => void;
}

export const HistoryCard: React.FC<HistoryCardProps> = ({ 
  entry, 
  isExpanded, 
  onToggle, 
  onLoadRecord,
  onImageDoubleClick,
  onDeleteImage
}) => {
  return (
    <div className={`mb-3 transition-all duration-300 ${isExpanded ? 'scale-[1.01]' : ''}`}>
      <div 
        className={`bg-white border rounded-[20px] overflow-hidden transition-all duration-300 ${isExpanded ? 'border-blue-500 shadow-xl' : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'}`}
      >
        {/* Header */}
        <div 
          onClick={onToggle}
          className="p-4 cursor-pointer flex justify-between items-center group"
        >
          <div className="flex-1 min-w-0">
            <span className={`text-[10px] font-black uppercase tracking-widest ${isExpanded ? 'text-blue-600' : 'text-slate-400'}`}>
              {entry.date}
            </span>
            <h4 className={`font-black text-sm mt-1 leading-snug line-clamp-1 ${isExpanded ? 'text-slate-900' : 'text-slate-700'}`}>
              {entry.cc || 'No symptom recorded'}
            </h4>
          </div>
          <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300 ${isExpanded ? 'rotate-180 bg-blue-600 text-white' : 'bg-slate-100 text-slate-400'}`}>
            <i className="fas fa-chevron-down text-[10px]"></i>
          </div>
        </div>

        {/* Expanded Content */}
        {isExpanded && (
          <div 
            className="px-4 pb-5 space-y-4 animate-in fade-in slide-in-from-top-1 duration-300"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="pt-3 border-t border-slate-100 grid grid-cols-2 gap-2">
              {[
                { label: 'S', color: 'bg-blue-50 text-blue-700', val: entry.subjective },
                { label: 'O', color: 'bg-emerald-50 text-emerald-700', val: entry.objective },
                { label: 'A', color: 'bg-amber-50 text-amber-700', val: entry.assessmentProblems },
                { label: 'P', color: 'bg-purple-50 text-purple-700', val: entry.planSummary }
              ].map(d => (
                <div key={d.label} className={`p-2.5 rounded-xl border border-transparent ${d.color.split(' ')[0]}`}>
                  <span className={`font-black text-[9px] block mb-1 tracking-widest ${d.color.split(' ')[1]}`}>{d.label} SECTION</span>
                  <p className="text-[10px] font-bold text-slate-800 line-clamp-2 leading-relaxed">
                    {d.val || 'No record'}
                  </p>
                </div>
              ))}
            </div>

            {/* Media Assets with Delete Button */}
            {entry.images && entry.images.length > 0 && (
              <div className="space-y-2">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Clinical Media</p>
                <div className="flex flex-wrap gap-1.5">
                  {entry.images.map((img, idx) => (
                    <div 
                      key={idx} 
                      className="relative group w-12 h-12 rounded-lg overflow-hidden border border-slate-200 shadow-sm bg-slate-50 cursor-zoom-in hover:border-blue-500 transition-all"
                    >
                      <img 
                        src={img} 
                        className="w-full h-full object-cover" 
                        alt={`Clinical ${idx}`} 
                        onClick={() => onImageDoubleClick(img)}
                      />
                      {onDeleteImage && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteImage(entry.id, img);
                          }}
                          className="absolute top-0 right-0 w-4 h-4 bg-rose-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10 rounded-bl-lg"
                        >
                          <i className="fas fa-trash-alt text-[7px]"></i>
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <button 
              onClick={(e) => {
                e.stopPropagation();
                onLoadRecord(entry);
              }}
              className="w-full py-3 bg-slate-900 hover:bg-black text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all shadow-md active:scale-95"
            >
              Load to Chart Editor
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
