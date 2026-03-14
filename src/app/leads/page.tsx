'use client';

import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/Button';
import { 
  ChevronLeft, 
  Users, 
  Mail, 
  Phone, 
  Wallet, 
  Clock, 
  Download, 
  Target, 
  Loader2,
  Search,
  Filter,
  Eye,
  X,
  CheckCircle2,
  ListChecks,
  Briefcase
} from 'lucide-react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

interface Lead {
  id: string;
  project_id: string;
  client_name: string;
  email: string;
  phone: string;
  data: any;
  created_at: string;
}

export default function LeadsDashboard() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const pdfRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchLeads();
  }, []);

  const fetchLeads = async () => {
    try {
      const res = await fetch('/api/leads');
      const data = await res.json();
      setLeads(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const filteredLeads = leads.filter(lead => 
    lead.client_name?.toLowerCase().includes(search.toLowerCase()) ||
    lead.email?.toLowerCase().includes(search.toLowerCase()) ||
    lead.phone?.includes(search)
  );

  const generatePDF = async (lead: Lead) => {
    setSelectedLead(lead);
    setIsExporting(true);

    // Wait for render
    await new Promise(r => setTimeout(r, 800));

    try {
      if (!pdfRef.current) return;
      const canvas = await html2canvas(pdfRef.current, {
        scale: 1.5,
        useCORS: true,
        backgroundColor: '#000000',
      });

      const imgData = canvas.toDataURL('image/jpeg', 0.8);
      const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4', compress: true });
      const imgWidth = 190;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      pdf.addImage(imgData, 'JPEG', 10, 10, imgWidth, imgHeight);
      pdf.save(`Proposal_${(lead.client_name || 'Lead').replace(/\s+/g, '_')}.pdf`);
    } catch (err) {
      console.error('PDF export error:', err);
      alert('PDF generation failed. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#030303] text-white">
      <div className="fixed top-0 left-0 w-full h-full pointer-events-none -z-10">
        <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] bg-emerald-900/10 rounded-full blur-[120px] animate-pulse" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-900/10 rounded-full blur-[120px] animate-pulse delay-700" />
      </div>

      <div className="max-w-7xl mx-auto p-8 lg:p-12">
        {/* Header */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12">
          <div className="flex items-center gap-6">
            <Button variant="glass" className="w-12 h-12 p-0 rounded-2xl" onClick={() => window.location.href = '/'}>
              <ChevronLeft size={20} />
            </Button>
            <div>
              <div className="flex items-center gap-3 mb-1">
                <Users size={28} className="text-emerald-500" />
                <h1 className="text-4xl font-black tracking-tighter">Lead Center</h1>
              </div>
              <p className="text-gray-500 text-sm">{leads.length} total leads captured</p>
            </div>
          </div>
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
            <input 
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by name, email, phone..."
              className="bg-white/5 border border-white/10 rounded-xl py-3 pl-11 pr-5 outline-none focus:border-emerald-500/50 transition-all w-80 text-sm"
            />
          </div>
        </header>

        {/* Lead List */}
        {loading ? (
          <div className="h-64 flex flex-col items-center justify-center gap-4">
            <Loader2 className="animate-spin text-emerald-500" size={40} />
            <p className="text-gray-500 animate-pulse">Loading leads...</p>
          </div>
        ) : filteredLeads.length === 0 ? (
          <div className="glass border-dashed border-white/10 p-20 rounded-[2rem] flex flex-col items-center text-center gap-6">
            <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center">
              <Users className="text-gray-600" size={32} />
            </div>
            <div>
              <h3 className="text-xl font-bold mb-2">No Leads Yet</h3>
              <p className="text-gray-500 max-w-sm mx-auto">When customers chat with your AI consultant and provide their details, they will appear here automatically.</p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredLeads.map((lead) => (
              <div 
                key={lead.id}
                className="glass rounded-2xl p-6 border border-white/5 hover:border-emerald-500/20 transition-all group"
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  {/* Lead Info */}
                  <div className="flex items-center gap-5 flex-1 min-w-0">
                    <div className="w-14 h-14 bg-gradient-to-br from-emerald-600 to-emerald-400 rounded-2xl flex items-center justify-center shadow-lg flex-shrink-0">
                      <span className="text-xl font-black text-white">
                        {(lead.client_name || '?')[0].toUpperCase()}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-lg font-black tracking-tight truncate">{lead.client_name || 'Unknown'}</h3>
                      <div className="flex flex-wrap items-center gap-4 text-sm text-gray-400 mt-1">
                        {lead.email && (
                          <span className="flex items-center gap-1.5 truncate">
                            <Mail size={12} className="text-emerald-500 flex-shrink-0" /> {lead.email}
                          </span>
                        )}
                        {lead.phone && (
                          <span className="flex items-center gap-1.5">
                            <Phone size={12} className="text-emerald-500 flex-shrink-0" /> {lead.phone}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Meta */}
                  <div className="flex items-center gap-3 flex-shrink-0">
                    {lead.data?.budget_estimation && (
                      <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-3 py-1 rounded-full text-xs font-bold">
                        {lead.data.budget_estimation}
                      </span>
                    )}
                    <span className="text-xs text-gray-500 flex items-center gap-1">
                      <Clock size={12} />
                      {new Date(lead.created_at).toLocaleDateString('el-GR', { day: 'numeric', month: 'short' })}
                    </span>
                    <Button 
                      variant="glass" 
                      className="h-10 px-4 gap-2 text-xs border-emerald-500/20 hover:bg-emerald-500/10"
                      onClick={() => setSelectedLead(selectedLead?.id === lead.id ? null : lead)}
                    >
                      <Eye size={14} /> View
                    </Button>
                    <Button 
                      variant="primary"
                      className="h-10 px-4 gap-2 text-xs bg-emerald-600 hover:bg-emerald-500 shadow-lg shadow-emerald-600/20"
                      onClick={() => generatePDF(lead)}
                      disabled={isExporting}
                    >
                      {isExporting ? <Loader2 className="animate-spin" size={14} /> : <Download size={14} />}
                      PDF
                    </Button>
                  </div>
                </div>

                {/* Expanded Detail */}
                {selectedLead?.id === lead.id && (
                  <div className="mt-6 pt-6 border-t border-white/5 animate-in slide-in-from-top-2 duration-300">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {lead.data?.project_title && (
                        <div className="bg-white/5 p-4 rounded-xl">
                          <p className="text-[10px] font-bold text-gray-500 uppercase mb-1">
                            <Briefcase size={10} className="inline mr-1" /> Project
                          </p>
                          <p className="text-sm font-medium">{lead.data.project_title}</p>
                        </div>
                      )}
                      {lead.data?.timeline && (
                        <div className="bg-white/5 p-4 rounded-xl">
                          <p className="text-[10px] font-bold text-gray-500 uppercase mb-1">
                            <Clock size={10} className="inline mr-1" /> Timeline
                          </p>
                          <p className="text-sm font-medium">{lead.data.timeline}</p>
                        </div>
                      )}
                      {lead.data?.scope && (
                        <div className="bg-white/5 p-4 rounded-xl">
                          <p className="text-[10px] font-bold text-gray-500 uppercase mb-1">
                            <Target size={10} className="inline mr-1" /> Scope
                          </p>
                          <p className="text-sm font-medium">{lead.data.scope}</p>
                        </div>
                      )}
                    </div>
                    {lead.data?.client_goals && lead.data.client_goals.length > 0 && (
                      <div className="mt-4 bg-white/5 p-4 rounded-xl">
                        <p className="text-[10px] font-bold text-gray-500 uppercase mb-2">
                          <Target size={10} className="inline mr-1" /> Client Goals
                        </p>
                        <ul className="space-y-1">
                          {lead.data.client_goals.map((g: string, i: number) => (
                            <li key={i} className="text-sm text-gray-300 flex gap-2">
                              <span className="text-emerald-500">•</span> {g}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {lead.data?.key_tasks && lead.data.key_tasks.length > 0 && (
                      <div className="mt-4 bg-white/5 p-4 rounded-xl">
                        <p className="text-[10px] font-bold text-gray-500 uppercase mb-2">
                          <ListChecks size={10} className="inline mr-1" /> Tasks
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {lead.data.key_tasks.map((t: any, i: number) => (
                            <span key={i} className="bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 px-3 py-1 rounded-full text-xs">
                              {t.category}: {t.task?.slice(0, 50)}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Hidden PDF Template */}
      {selectedLead && (
        <div style={{ position: 'absolute', left: '-9999px', top: 0 }}>
          <div ref={pdfRef} style={{ backgroundColor: '#000000', color: '#ffffff', width: '800px', padding: '40px', fontFamily: 'Arial, sans-serif' }}>
            {/* PDF Header */}
            <div style={{ backgroundColor: '#059669', padding: '32px 24px', borderRadius: '16px', marginBottom: '32px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div style={{ backgroundColor: 'rgba(255,255,255,0.2)', padding: '12px', borderRadius: '16px' }}>
                  <CheckCircle2 color="#ffffff" size={36} />
                </div>
                <div>
                  <h3 style={{ color: '#ffffff', fontWeight: '900', fontSize: '24px' }}>Επαγγελματική Πρόταση</h3>
                  <p style={{ color: '#d1fae5', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.1em', marginTop: '4px' }}>
                    {selectedLead.client_name} • SocialMe Digital AI
                  </p>
                </div>
              </div>
            </div>

            {/* Project Title */}
            {selectedLead.data?.project_title && (
              <div style={{ borderLeft: '4px solid #059669', paddingLeft: '20px', marginBottom: '32px' }}>
                <p style={{ color: '#34d399', fontSize: '11px', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '0.2em', marginBottom: '8px' }}>Τίτλος Έργου</p>
                <p style={{ fontSize: '28px', fontWeight: '900', lineHeight: '1.1' }}>{selectedLead.data.project_title}</p>
              </div>
            )}

            {/* Info Grid */}
            <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', marginBottom: '32px' }}>
              <div style={{ flex: '1 1 200px' }}>
                <p style={{ color: '#6b7280', fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase' }}>Επικοινωνία</p>
                <p style={{ fontSize: '15px', marginTop: '8px' }}>{selectedLead.email}</p>
                <p style={{ fontSize: '14px', color: '#9ca3af', marginTop: '4px' }}>{selectedLead.phone}</p>
              </div>
              {selectedLead.data?.budget_estimation && (
                <div style={{ flex: '1 1 200px' }}>
                  <p style={{ color: '#6b7280', fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase' }}>Προϋπολογισμός</p>
                  <p style={{ fontSize: '24px', color: '#34d399', marginTop: '8px', fontWeight: '900' }}>{selectedLead.data.budget_estimation}</p>
                </div>
              )}
              {selectedLead.data?.timeline && (
                <div style={{ flex: '1 1 200px' }}>
                  <p style={{ color: '#6b7280', fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase' }}>Χρονοδιάγραμμα</p>
                  <p style={{ fontSize: '16px', marginTop: '8px', fontWeight: '600' }}>{selectedLead.data.timeline}</p>
                </div>
              )}
            </div>

            {/* Goals */}
            {selectedLead.data?.client_goals?.length > 0 && (
              <div style={{ marginBottom: '32px' }}>
                <p style={{ color: '#6b7280', fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '12px' }}>Στόχοι Πελάτη</p>
                {selectedLead.data.client_goals.map((g: string, i: number) => (
                  <p key={i} style={{ fontSize: '14px', color: '#e5e7eb', marginBottom: '6px' }}>• {g}</p>
                ))}
              </div>
            )}

            {/* Tasks */}
            {selectedLead.data?.key_tasks?.length > 0 && (
              <div style={{ marginBottom: '32px' }}>
                <p style={{ color: '#6b7280', fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '12px' }}>Πλάνο Υλοποίησης</p>
                {selectedLead.data.key_tasks.map((t: any, i: number) => (
                  <div key={i} style={{ backgroundColor: 'rgba(255,255,255,0.03)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)', marginBottom: '8px', display: 'flex', gap: '12px', alignItems: 'center' }}>
                    <span style={{ fontSize: '10px', fontWeight: 'bold', backgroundColor: '#059669', padding: '4px 12px', borderRadius: '999px', textTransform: 'uppercase' }}>{t.category}</span>
                    <p style={{ fontSize: '14px', color: '#d1d5db' }}>{t.task}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Footer */}
            <div style={{ paddingTop: '20px', borderTop: '1px solid rgba(255,255,255,0.05)', textAlign: 'center' }}>
              <p style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.3em', fontWeight: 'bold', color: '#475569' }}>
                SOCIALME DIGITAL STRATEGY BUREAU • {new Date().getFullYear()}
              </p>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
