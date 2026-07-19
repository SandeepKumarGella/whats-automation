import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useStore } from '../store/useStore';
import { api } from '../services/api';
import { 
  Search, 
  UploadCloud, 
  Check, 
  X, 
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Download
} from 'lucide-react';
import { Contact } from '../types/index';

export function ContactsTable() {
  const contactsReport = useStore((state) => state.contactsReport);
  const setContactsReport = useStore((state) => state.setContactsReport);
  const updateContactStatus = useStore((state) => state.updateContactStatus);
  const addToast = useStore((state) => state.addToast);
  const wizardStep = useStore((state) => state.wizardStep);
  const setWizardStep = useStore((state) => state.setWizardStep);
  const setActiveTab = useStore((state) => state.setActiveTab);
  const queryClient = useQueryClient();

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dragActive, setDragActive] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  // Table pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  // Selected contacts multi-select list
  const [selectedContactIds, setSelectedContactIds] = useState<string[]>([]);

  const downloadSampleCSV = () => {
    const sampleData = `Name,Phone\nSandeep,+919398415617\nRajesh,+916303596229\nRohit,+919550387071\nPraveen,+919160706277\nSubbu,+916302455406`;
    const blob = new Blob([sampleData], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'sample_whatsapp_contacts.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    addToast('Sample CSV downloaded! Open in Notepad or Excel text format.', 'info');
  };

  // Drag and Drop Upload Handlers
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const processFile = async (file: File) => {
    if (!file) return;
    if (file.type !== 'text/csv' && !file.name.endsWith('.csv')) {
      addToast('Only CSV files are supported!', 'error');
      return;
    }

    setIsUploading(true);
    try {
      const report = await api.uploadCSV(file);
      setContactsReport(report);
      queryClient.invalidateQueries({ queryKey: ['campaignHistory'] });
      addToast(`CSV loaded successfully. ${report.validCount} valid contacts found.`, 'success');
      // Go directly to Step 2
      setWizardStep(2);
    } catch (err: any) {
      addToast(err.response?.data?.error || 'Failed to upload and validate CSV.', 'error');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      await processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      await processFile(e.target.files[0]);
    }
  };

  // Skip / include handlers
  const handleToggleSkip = (contact: Contact) => {
    const nextStatus = contact.status === 'skipped' ? 'pending' : 'skipped';
    updateContactStatus(contact.id, nextStatus);
  };

  // Filter contacts
  const filteredContacts = contactsReport
    ? contactsReport.contacts.filter((c) => {
        const matchesSearch = 
          c.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
          c.phone.includes(searchQuery);
        
        if (statusFilter === 'all') return matchesSearch;
        if (statusFilter === 'valid') return matchesSearch && c.status !== 'failed' && c.status !== 'skipped';
        if (statusFilter === 'invalid') return matchesSearch && c.status === 'failed';
        if (statusFilter === 'duplicate') return matchesSearch && c.status === 'skipped' && c.errorReason?.includes('Duplicate');
        return matchesSearch && c.status === statusFilter;
      })
    : [];

  // Multi-select toggle handlers
  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      const allIds = filteredContacts.map(c => c.id);
      setSelectedContactIds(allIds);
    } else {
      setSelectedContactIds([]);
    }
  };

  const handleSelectRow = (contactId: string) => {
    if (selectedContactIds.includes(contactId)) {
      setSelectedContactIds(selectedContactIds.filter(id => id !== contactId));
    } else {
      setSelectedContactIds([...selectedContactIds, contactId]);
    }
  };

  // Bulk actions on selected
  const handleBulkSkip = () => {
    selectedContactIds.forEach(id => {
      const match = contactsReport?.contacts.find(c => c.id === id);
      if (match && match.status !== 'skipped') {
        updateContactStatus(id, 'skipped');
      }
    });
    addToast(`Skipped ${selectedContactIds.length} selected contacts`, 'info');
    setSelectedContactIds([]);
  };

  const handleBulkInclude = () => {
    selectedContactIds.forEach(id => {
      const match = contactsReport?.contacts.find(c => c.id === id);
      if (match && match.status === 'skipped') {
        updateContactStatus(id, 'pending');
      }
    });
    addToast(`Included ${selectedContactIds.length} selected contacts`, 'info');
    setSelectedContactIds([]);
  };

  const exportInvalidContacts = () => {
    const invalidList = contactsReport?.contacts.filter(c => c.status === 'failed') || [];
    if (invalidList.length === 0) {
      addToast('No invalid contacts to export!', 'info');
      return;
    }
    const csvContent = "data:text/csv;charset=utf-8," 
      + ["Name,Phone,Error"].concat(invalidList.map(c => `"${c.name}","${c.phone}","${c.errorReason || ''}"`)).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `invalid_contacts_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Pagination calculation
  const totalPages = Math.ceil(filteredContacts.length / itemsPerPage) || 1;
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedContacts = filteredContacts.slice(startIndex, startIndex + itemsPerPage);

  // Auto-correct page bound if filtered list changes
  if (currentPage > totalPages) {
    setCurrentPage(totalPages);
  }

  // Count metrics
  const totalCount = contactsReport?.totalRows || 0;
  const readyCount = contactsReport?.contacts.filter(c => c.status === 'pending' || c.status === 'sent').length || 0;
  const invalidCount = contactsReport?.contacts.filter(c => c.status === 'failed').length || 0;
  const duplicateCount = contactsReport?.contacts.filter(c => c.errorReason?.includes('Duplicate') || (c.status === 'skipped' && c.errorReason?.includes('duplicate'))).length || 0;

  return (
    <div className="space-y-6">
      {/* -------------------- STEP 1: IMPORT CSV SCREEN -------------------- */}
      {wizardStep === 1 && (
        <div className="max-w-3xl mx-auto bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl shadow-sm overflow-hidden transition-all">
          <div className="p-6 border-b border-slate-100 dark:border-slate-800/60 flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Import Your Contacts
              </h3>
              <p className="text-xs text-slate-455 mt-1">
                Upload a CSV file with your contacts details.
              </p>
            </div>
            <a href="#" className="text-xs text-emerald-500 hover:underline font-semibold">
              Need Help?
            </a>
          </div>

          <div className="p-10 flex flex-col items-center justify-center">
            <div
              onDragEnter={handleDrag}
              onDragOver={handleDrag}
              onDragLeave={handleDrag}
              onDrop={handleDrop}
              className={`w-full max-w-xl border-2 border-dashed rounded-2xl p-12 text-center transition-all duration-200 flex flex-col items-center justify-center gap-4 ${
                dragActive
                  ? 'border-emerald-500 bg-emerald-500/[0.02] dark:bg-emerald-500/[0.01]'
                  : 'border-slate-300 dark:border-slate-800 hover:border-slate-400 dark:hover:border-slate-700 bg-slate-50/50 dark:bg-slate-950/20'
              }`}
            >
              <div className="p-4 bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 rounded-full group-hover:scale-105 transition-transform">
                <UploadCloud size={32} />
              </div>
              <div className="space-y-1">
                <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  Drag & Drop your CSV file here
                </p>
                <p className="text-[11px] text-slate-400">or</p>
              </div>
              
              <label className="px-5 py-2 bg-emerald-555 hover:bg-emerald-600 active:scale-95 text-white text-xs font-bold rounded-lg cursor-pointer transition-all shadow-sm">
                {isUploading ? 'Validating headers...' : 'Browse Files'}
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleFileInput}
                  className="hidden"
                  disabled={isUploading}
                />
              </label>
            </div>

            {/* Checklist details under upload zone */}
            <div className="flex flex-wrap items-center gap-6 mt-8 text-xs text-slate-500 dark:text-slate-400 font-semibold border-t border-slate-100 dark:border-slate-800 pt-6 w-full max-w-xl justify-between">
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 size={14} className="text-emerald-500" />
                  CSV Format: Name, Phone
                </span>
              </div>
              <button
                type="button"
                onClick={downloadSampleCSV}
                className="px-3 py-1 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-500 border border-emerald-500/20 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all active:scale-95"
              >
                <Download size={14} /> Download Sample CSV
              </button>
            </div>
          </div>

          {/* Nav controller inside card footer */}
          <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex justify-end">
            <button
              onClick={() => {
                if (contactsReport) setWizardStep(2);
                else addToast('Please upload a CSV file to validate', 'warning');
              }}
              disabled={!contactsReport}
              className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-40 active:scale-95 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 transition-all shadow-sm"
            >
              Next: Validate Contacts →
            </button>
          </div>
        </div>
      )}

      {/* -------------------- STEP 2: VALIDATE CONTACTS SCREEN -------------------- */}
      {wizardStep === 2 && contactsReport && (
        <div className="space-y-6">
          {/* Stats Cards Row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/60 rounded-xl shadow-sm">
              <p className="text-[10px] text-slate-450 dark:text-slate-500 font-bold uppercase tracking-wider">Total Contacts</p>
              <h3 className="text-2xl font-bold mt-1 text-slate-900 dark:text-white font-mono leading-none">{totalCount}</h3>
            </div>
            <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/60 rounded-xl shadow-sm">
              <p className="text-[10px] text-emerald-500 font-bold uppercase tracking-wider">Ready to Send</p>
              <h3 className="text-2xl font-bold mt-1 text-emerald-500 font-mono leading-none">{readyCount}</h3>
            </div>
            <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/60 rounded-xl shadow-sm">
              <p className="text-[10px] text-amber-500 font-bold uppercase tracking-wider">Invalid</p>
              <h3 className="text-2xl font-bold mt-1 text-amber-550 font-mono leading-none">{invalidCount}</h3>
            </div>
            <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/60 rounded-xl shadow-sm">
              <p className="text-[10px] text-rose-500 font-bold uppercase tracking-wider">Duplicates</p>
              <h3 className="text-2xl font-bold mt-1 text-rose-550 dark:text-rose-400 font-mono leading-none">{duplicateCount}</h3>
            </div>
          </div>

          {/* Table Container card */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/60 rounded-xl shadow-sm overflow-hidden">
            
            {/* Table Filters & Actions Header */}
            <div className="p-4 border-b border-slate-200/50 dark:border-slate-800/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/40 dark:bg-slate-900/20">
              <div className="relative flex-1 max-w-md w-full">
                <Search size={13} className="absolute left-3 top-2.5 text-slate-450" />
                <input
                  type="text"
                  placeholder="Search contacts..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 bg-white dark:bg-slate-850 text-xs border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:border-emerald-500 text-slate-800 dark:text-white"
                />
              </div>

              <div className="flex items-center gap-2 flex-wrap shrink-0">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="px-2.5 py-1.5 bg-white dark:bg-slate-850 text-xs border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:border-emerald-500 text-slate-800 dark:text-white"
                >
                  <option value="all">All Status</option>
                  <option value="valid">Valid (Pending/Sent)</option>
                  <option value="invalid">Invalid Format</option>
                  <option value="duplicate">Duplicates</option>
                  <option value="skipped">Skipped List</option>
                </select>

                <button
                  type="button"
                  onClick={exportInvalidContacts}
                  className="px-3 py-1.5 bg-white dark:bg-slate-850 border border-slate-200 dark:border-slate-700 hover:border-rose-500 text-slate-750 dark:text-slate-350 hover:text-rose-500 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors active:scale-95"
                >
                  Export Invalid
                </button>
              </div>
            </div>

            {/* Bulk Selection Actions row if rows are checked */}
            {selectedContactIds.length > 0 && (
              <div className="px-5 py-2.5 bg-emerald-500/5 dark:bg-emerald-950/10 border-b border-emerald-500/10 flex items-center justify-between text-xs">
                <span className="font-semibold text-emerald-600 dark:text-emerald-450">
                  {selectedContactIds.length} contact nodes selected
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleBulkInclude}
                    className="px-2.5 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-emerald-500 rounded-md text-[10px] font-bold transition-all"
                  >
                    Include Selected
                  </button>
                  <button
                    onClick={handleBulkSkip}
                    className="px-2.5 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-rose-550 rounded-md text-[10px] font-bold transition-all"
                  >
                    Skip Selected
                  </button>
                </div>
              </div>
            )}

            {/* Data Grid table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/50 dark:bg-slate-900 text-slate-450 text-[10px] font-bold uppercase border-b border-slate-200/80 dark:border-slate-800/80 select-none">
                    <th className="px-5 py-3 w-10">
                      <input
                        type="checkbox"
                        onChange={handleSelectAll}
                        checked={selectedContactIds.length > 0 && selectedContactIds.length === filteredContacts.map(c=>c.id).length}
                        className="rounded border-slate-300 text-emerald-555 focus:ring-emerald-500/40"
                      />
                    </th>
                    <th className="px-5 py-3 w-12 text-slate-400">#</th>
                    <th className="px-5 py-3">Name</th>
                    <th className="px-5 py-3">Phone</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-850/60">
                  {paginatedContacts.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-12 text-xs text-slate-400 italic font-medium bg-slate-50/20 dark:bg-slate-900/10">
                        No contacts found matching search filters
                      </td>
                    </tr>
                  ) : (
                    paginatedContacts.map((contact, index) => {
                      const isError = contact.status === 'failed' || contact.errorReason;
                      const isSkipped = contact.status === 'skipped';
                      const isSuccess = contact.status === 'sent';
                      const isDuplicate = contact.errorReason?.includes('Duplicate') || (contact.status === 'skipped' && contact.errorReason?.includes('duplicate'));
                      const globalIdx = startIndex + index + 1;

                      return (
                        <tr
                          key={contact.id}
                          className="text-xs transition-colors duration-150 hover:bg-slate-50/50 dark:hover:bg-slate-850/30"
                        >
                          <td className="px-5 py-3 w-10">
                            <input
                              type="checkbox"
                              checked={selectedContactIds.includes(contact.id)}
                              onChange={() => handleSelectRow(contact.id)}
                              className="rounded border-slate-300 text-emerald-555 focus:ring-emerald-500/40"
                            />
                          </td>
                          <td className="px-5 py-3 font-mono text-[10px] text-slate-400">{globalIdx}</td>
                          <td className="px-5 py-3 font-semibold text-slate-800 dark:text-slate-200">
                            {contact.name}
                          </td>
                          <td className="px-5 py-3 font-mono text-[11px] text-slate-550 dark:text-slate-400">
                            {contact.phone}
                          </td>
                          <td className="px-5 py-3">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[9px] font-bold capitalize tracking-wider ${
                                isDuplicate
                                  ? 'bg-amber-500/10 border border-amber-550/20 text-amber-500 dark:text-amber-400'
                                  : isSuccess || (contact.status === 'pending' && !isError)
                                  ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-500'
                                  : isSkipped
                                  ? 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400 border border-transparent'
                                  : 'bg-rose-500/10 border border-rose-500/20 text-rose-500 dark:text-rose-450'
                              }`}
                            >
                              {isDuplicate ? 'Duplicate' : isSuccess || (contact.status === 'pending' && !isError) ? 'Valid' : contact.status === 'failed' ? 'Invalid' : contact.status}
                            </span>
                          </td>
                          <td className="px-5 py-3 text-right">
                            <button
                              onClick={() => handleToggleSkip(contact)}
                              className={`p-1 border rounded-md transition-all active:scale-95 ${
                                isSkipped
                                  ? 'border-slate-200 dark:border-slate-750 text-emerald-500 hover:bg-slate-50 dark:hover:bg-slate-800'
                                  : 'border-slate-200 dark:border-slate-750 text-rose-500 hover:bg-slate-50 dark:hover:bg-slate-800'
                              }`}
                              title={isSkipped ? 'Include contact' : 'Skip contact'}
                            >
                              {isSkipped ? <Check size={12} /> : <X size={12} />}
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination and showing count line */}
            <div className="p-4 border-t border-slate-100 dark:border-slate-850 flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-slate-400 bg-slate-50/30 dark:bg-slate-900/10">
              <span>
                Showing {startIndex + 1} to {Math.min(startIndex + itemsPerPage, filteredContacts.length)} of {filteredContacts.length}
              </span>
              
              <div className="flex items-center gap-1 font-mono">
                <button
                  type="button"
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                  className="p-1 border border-slate-200 dark:border-slate-750 rounded hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-45"
                >
                  <ChevronLeft size={13} />
                </button>
                
                {Array.from({ length: totalPages }).map((_, i) => {
                  const pNum = i + 1;
                  const isCurrent = pNum === currentPage;
                  return (
                    <button
                      key={pNum}
                      type="button"
                      onClick={() => setCurrentPage(pNum)}
                      className={`px-2 py-1 rounded border text-[10px] ${
                        isCurrent
                          ? 'bg-slate-950 dark:bg-white text-white dark:text-slate-950 border-transparent'
                          : 'border-slate-200 dark:border-slate-750 hover:bg-slate-50 dark:hover:bg-slate-805'
                      }`}
                    >
                      {pNum}
                    </button>
                  );
                })}

                <button
                  type="button"
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                  disabled={currentPage === totalPages}
                  className="p-1 border border-slate-200 dark:border-slate-750 rounded hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-45"
                >
                  <ChevronRight size={13} />
                </button>
              </div>
            </div>

          </div>

          {/* Stepper Wizard navigator bar */}
          <div className="flex items-center justify-between border-t border-slate-200/50 dark:border-slate-800/50 pt-4">
            <button
              onClick={() => {
                setContactsReport(null);
                setWizardStep(1);
              }}
              className="px-4 py-2 border border-slate-250 dark:border-slate-800 text-slate-700 dark:text-slate-350 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-bold rounded-lg flex items-center gap-1.5 transition-colors active:scale-95"
            >
              ← Back
            </button>

            <button
              onClick={() => {
                setWizardStep(3);
                setActiveTab('templates');
              }}
              className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold rounded-lg flex items-center gap-1 transition-all active:scale-95 shadow-sm"
            >
              Next: Compose Message →
            </button>
          </div>

        </div>
      )}
    </div>
  );
}

export default ContactsTable;
