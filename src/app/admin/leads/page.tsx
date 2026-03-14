'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { Users, Calendar, Mail, Phone, ChevronRight, Loader2, Download, Briefcase, ChevronLeft } from 'lucide-react';
import LeadSummaryCard from '@/components/LeadSummaryCard';
import Link from 'next/link';

export default function LeadsDashboard() {
  const [leads, setLeads] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedLead, setSelectedLead] = useState<any | null>(null);

  useEffect(() => {
    fetch('/api/leads')
      .then(res => res.json())
      .then(data => {
        setLeads(data);
        setIsLoading(false);
      })
      .catch(err => {
        console.error(err);
        setIsLoading(false);
      });
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen pt-24 px-4 bg-black text-white flex flex-col items-center justify-center">
        <Loader2 className="animate-spin text-blue-500 mb-4" size={48} />
        <p className="text-gray-400">Φόρτωση εκδηλώσεων ενδιαφέροντος...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-24 px-4 bg-black text-white">
      <div className="max-w-5xl mx-auto space-y-8 pb-12">
        
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h1 className="text-4xl font-black gradient-text tracking-tight items-center flex gap-3">
              <Users size={32} />
              Leads Dashboard
            </h1>
            <p className="text-gray-500">
              Δείτε και κατεβάστε τις προτάσεις που δημιουργήθηκαν από το AI.
            </p>
          </div>
          <Link href="/admin">
            <Button variant="glass" className="gap-2">
              <ChevronLeft size={16} /> Admin
            </Button>
          </Link>
        </div>

        {leads.length === 0 ? (
          <div className="glass p-12 rounded-[40px] text-center space-y-4 border-white/5">
            <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mx-auto text-gray-600">
              <Users size={40} />
            </div>
            <p className="text-gray-400 uppercase tracking-widest font-bold text-xs">Δεν βρέθηκαν Leads</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {leads.map((lead) => (
              <div 
                key={lead.id}
                className="glass p-6 rounded-3xl border border-white/5 hover:border-blue-500/30 transition-all group flex items-center justify-between cursor-pointer"
                onClick={() => setSelectedLead(lead.data)}
              >
                <div className="flex items-center gap-6">
                  <div className="w-14 h-14 bg-blue-600/10 rounded-2xl flex items-center justify-center text-blue-500 group-hover:bg-blue-600 group-hover:text-white transition-all">
                    <Briefcase size={24} />
                  </div>
                  <div className="space-y-1">
                    <h3 className="font-bold text-lg">{lead.client_name}</h3>
                    <div className="flex gap-4 text-xs text-gray-500 font-medium tracking-tight">
                      <span className="flex items-center gap-1"><Mail size={12} /> {lead.email}</span>
                      <span className="flex items-center gap-1"><Phone size={12} /> {lead.phone}</span>
                      <span className="flex items-center gap-1"><Calendar size={12} /> {new Date(lead.created_at).toLocaleDateString('el-GR')}</span>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-4">
                  <div className="text-right hidden sm:block">
                    <p className="text-xs font-black text-blue-500 uppercase tracking-widest">{lead.data.project_title}</p>
                    <p className="text-[10px] text-gray-600 uppercase font-bold mt-1">Budget: {lead.data.budget_estimation}</p>
                  </div>
                  <Button variant="outline" className="w-10 h-10 p-0 rounded-full border-white/10 group-hover:border-blue-500/50">
                    <ChevronRight size={18} />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {selectedLead && (
        <LeadSummaryCard 
          data={selectedLead} 
          onClose={() => setSelectedLead(null)} 
        />
      )}
    </div>
  );
}
