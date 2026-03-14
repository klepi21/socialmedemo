import { useRef, useState } from 'react';
import { CheckCircle2, Download, X, Briefcase, Target, Clock, Wallet, ListChecks, Loader2, Mail, Phone } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

type LeadSummary = {
  client_name: string;
  project_title: string;
  client_goals: string[];
  scope: string;
  timeline: string;
  budget_estimation: string;
  email?: string;
  phone?: string;
  contact_info: string;
  key_tasks: { category: string; task: string }[];
  internal_tasks: { role: string; task: string }[];
  suggested_team_roles: string[];
};

export default function LeadSummaryCard({ data, onClose }: { data: LeadSummary, onClose: () => void }) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = useState(false);
  
  const generatePDF = async () => {
    if (!cardRef.current) return;
    setIsExporting(true);

    try {
      // Ensure the component is fully rendered
      await new Promise(r => setTimeout(r, 800));

      const canvas = await html2canvas(cardRef.current, {
        scale: 1.5,
        useCORS: true,
        backgroundColor: '#000000',
        logging: true,
        onclone: (clonedDoc) => {
          // Remove elements that might cause 'lab' color errors in html2canvas parsing
          const problematic = clonedDoc.querySelectorAll('.glow-on-hover, .animate-pulse, .animate-bounce');
          problematic.forEach(el => (el as HTMLElement).style.animation = 'none');
        }
      });

      const imgData = canvas.toDataURL('image/jpeg', 0.8);
      const pdf = new jsPDF({
        orientation: 'p',
        unit: 'mm',
        format: 'a4',
        compress: true
      });
      
      const imgWidth = 190;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      
      pdf.addImage(imgData, 'JPEG', 10, 10, imgWidth, imgHeight);
      pdf.save(`Proposal_${(data.client_name || 'Project').replace(/\s+/g, '_')}.pdf`);
      
    } catch (err: any) {
      console.error('PDF export error:', err);
      alert('Υπήρξε ένα πρόβλημα στη δημιουργία του PDF. Παρακαλώ δοκιμάστε ξανά.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-start sm:items-center justify-center p-0 sm:p-4 bg-black/90 backdrop-blur-md animate-in fade-in duration-300 overflow-y-auto pt-4 sm:pt-0">
      <div className="max-w-3xl w-full glass rounded-none sm:rounded-[40px] overflow-hidden shadow-2xl border-white/10 animate-in slide-in-from-bottom-5 duration-500 my-0 sm:my-8 relative">
        
        {/* Floating Close Button for Mobile/Desktop UI */}
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 z-[110] w-10 h-10 bg-black/50 hover:bg-black text-white rounded-full flex items-center justify-center border border-white/20 transition-all"
        >
          <X size={20} />
        </button>

        {/* Content to Capture (Card Ref) */}
        <div ref={cardRef} style={{ backgroundColor: '#000000', color: '#ffffff', minHeight: '100%' }}>
          {/* Header */}
          <div style={{ backgroundColor: '#2563eb', padding: '32px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '4px solid #1d4ed8' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', textAlign: 'left' }}>
              <div style={{ backgroundColor: 'rgba(255,255,255,0.2)', padding: '12px', borderRadius: '16px' }}>
                <CheckCircle2 color="#ffffff" size={36} />
              </div>
              <div>
                <h3 style={{ color: '#ffffff', fontWeight: '900', fontSize: '24px', lineHeight: '1.1', letterSpacing: '-0.02em' }}>
                  Επαγγελματική Πρόταση
                </h3>
                <p style={{ color: '#dbeafe', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.1em', opacity: 0.9, marginTop: '4px' }}>
                  {data.client_name || 'Project Overview'} • SocialMe Digital AI
                </p>
              </div>
            </div>
          </div>

          {/* Body content with improved responsiveness */}
          <div style={{ padding: '40px 24px', display: 'flex', flexDirection: 'column', gap: '48px' }}>
            
            {/* Title Section */}
            <div style={{ textAlign: 'left', borderLeft: '4px solid #3b82f6', paddingLeft: '20px' }}>
              <h4 style={{ color: '#60a5fa', fontSize: '11px', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '0.2em', marginBottom: '8px' }}>Τίτλος Έργου</h4>
              <p style={{ fontSize: '32px', fontWeight: '900', color: '#ffffff', lineHeight: '1.1', maxWidth: '90%' }}>
                {data.project_title}
              </p>
            </div>

            {/* Grid for key info */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '40px' }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '32px' }}>
                
                <div style={{ flex: '1 1 250px', display: 'flex', flexDirection: 'column', gap: '32px' }}>
                  <div style={{ display: 'flex', alignItems: 'start', gap: '16px', textAlign: 'left' }}>
                    <div style={{ backgroundColor: 'rgba(59,130,246,0.1)', padding: '8px', borderRadius: '12px' }}>
                      <Target color="#3b82f6" size={20} />
                    </div>
                    <div>
                      <p style={{ color: '#94a3b8', fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Στόχοι Πελάτη</p>
                      <ul style={{ fontSize: '15px', color: '#e2e8f0', marginTop: '10px', listStyleType: 'none', padding: 0 }}>
                        {data.client_goals.map((g, i) => (
                          <li key={i} style={{ marginBottom: '8px', display: 'flex', gap: '8px' }}>
                            <span style={{ color: '#3b82f6' }}>•</span> {g}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'start', gap: '16px', textAlign: 'left' }}>
                    <div style={{ backgroundColor: 'rgba(59,130,246,0.1)', padding: '8px', borderRadius: '12px' }}>
                      <Clock color="#3b82f6" size={20} />
                    </div>
                    <div>
                      <p style={{ color: '#94a3b8', fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Χρονοδιάγραμμα</p>
                      <p style={{ fontSize: '16px', color: '#ffffff', marginTop: '8px', fontWeight: '600' }}>{data.timeline}</p>
                    </div>
                  </div>
                </div>

                <div style={{ flex: '1 1 250px', display: 'flex', flexDirection: 'column', gap: '32px' }}>
                  <div style={{ display: 'flex', alignItems: 'start', gap: '16px', textAlign: 'left' }}>
                    <div style={{ backgroundColor: 'rgba(59,130,246,0.1)', padding: '8px', borderRadius: '12px' }}>
                      <Wallet color="#3b82f6" size={20} />
                    </div>
                    <div>
                      <p style={{ color: '#94a3b8', fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Προϋπολογισμός</p>
                      <p style={{ fontSize: '24px', color: '#60a5fa', marginTop: '8px', fontWeight: '900' }}>{data.budget_estimation}</p>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'start', gap: '16px', textAlign: 'left' }}>
                    <div style={{ backgroundColor: 'rgba(59,130,246,0.1)', padding: '8px', borderRadius: '12px' }}>
                      <Mail color="#3b82f6" size={20} />
                    </div>
                    <div>
                      <p style={{ color: '#94a3b8', fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Στοιχεία Επικοινωνίας</p>
                      <p style={{ fontSize: '16px', color: '#ffffff', marginTop: '8px', fontWeight: '600' }}>{data.email}</p>
                      <p style={{ fontSize: '14px', color: '#94a3b8', marginTop: '4px' }}>{data.phone}</p>
                    </div>
                  </div>
                </div>

              </div>
            </div>

            {/* Strategic Plan Section */}
            <div style={{ textAlign: 'left' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '12px', marginBottom: '24px' }}>
                <ListChecks color="#3b82f6" size={24} />
                <h5 style={{ fontSize: '12px', fontWeight: '900', textTransform: 'uppercase', color: '#ffffff', letterSpacing: '0.1em' }}>Στρατηγικό Πλάνο Υλοποίησης</h5>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {data.key_tasks.map((t, i) => (
                  <div key={i} style={{ backgroundColor: 'rgba(255,255,255,0.03)', padding: '20px', borderRadius: '24px', border: '1px solid rgba(255,255,255,0.05)', display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'center' }}>
                    <span style={{ fontSize: '10px', fontWeight: 'bold', color: '#ffffff', backgroundColor: '#2563eb', padding: '6px 14px', borderRadius: '9999px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      {t.category}
                    </span>
                    <p style={{ fontSize: '15px', color: '#d1d5db', lineHeight: '1.5', flex: 1 }}>{t.task}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Footer inside Ref */}
            <div style={{ paddingTop: '40px', marginTop: '20px', textAlign: 'center', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
              <p style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.3em', fontWeight: 'bold', color: '#475569' }}>
                SOCIALME DIGITAL STRATEGY BUREAU • {new Date().getFullYear()}
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="p-8 bg-white/5 border-t border-white/10 flex flex-col sm:flex-row gap-4">
          <Button 
            variant="primary" 
            className="flex-1 h-14 gap-3 text-lg font-bold shadow-xl" 
            onClick={generatePDF}
            disabled={isExporting}
          >
            {isExporting ? <Loader2 className="animate-spin" size={20} /> : <Download size={20} />}
            Λήψη Πλήρους Πρότασης (PDF)
          </Button>
          <Button variant="glass" className="h-14 px-8 font-bold" onClick={onClose}>
            Κλείσιμο
          </Button>
        </div>

      </div>
    </div>
  );
}
