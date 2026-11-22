'use client';

import React, { useState, useRef, useCallback } from 'react';
import { useProfile } from '@/components/providers/ProfileProvider';
import {
  UserProfile,
  FieldMappingEntry,
  ForeignMappingResult,
  PortfolioExportSingle,
  PortfolioExportAll,
} from '@/types';
import {
  parseNativeExport,
  isNativePortfolioEnvelope,
  parseCsvToRecord,
  mapForeignPayloadHeuristic,
  getDefaultFallbackProfile,
} from '@/lib/portfolioTransfer';
import { sanitizeProfile } from '@/lib/stateUrl';
import {
  Upload,
  FileText,
  FileJson,
  Sparkles,
  Check,
  AlertCircle,
  X,
  ArrowRight,
  RotateCcw,
  Bot,
  Layers,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  FolderKanban,
  Edit3,
} from 'lucide-react';

interface ImportPortfolioModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (portfolioName: string) => void;
}

type ImportStep = 'input' | 'loading' | 'preview-native' | 'review-foreign';

export function ImportPortfolioModal({ isOpen, onClose, onSuccess }: ImportPortfolioModalProps) {
  const { currentUser, userPortfolios, createNewPortfolio, setProfile, showToast } = useProfile();

  const [step, setStep] = useState<ImportStep>('input');
  const [inputText, setInputText] = useState('');
  const [fileName, setFileName] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [loadingMessage, setLoadingMessage] = useState('Analyzing portfolio payload...');

  // Native preview state
  const [nativePortfolios, setNativePortfolios] = useState<{ name: string; profile: UserProfile }[]>([]);
  const [selectedPortfolioIdx, setSelectedPortfolioIdx] = useState<number>(0);
  const [customPortfolioName, setCustomPortfolioName] = useState<string>('');

  // Foreign review state
  const [foreignProfile, setForeignProfile] = useState<UserProfile>(getDefaultFallbackProfile());
  const [fieldMappings, setFieldMappings] = useState<FieldMappingEntry[]>([]);
  const [unmappedKeys, setUnmappedKeys] = useState<string[]>([]);
  const [mappingSource, setMappingSource] = useState<'ai' | 'heuristic'>('heuristic');
  const [aiModelUsed, setAiModelUsed] = useState<string | null>(null);
  const [showUnmapped, setShowUnmapped] = useState(false);
  const [busySubmitting, setBusySubmitting] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleReset = () => {
    setStep('input');
    setInputText('');
    setFileName(null);
    setErrorMessage(null);
    setNativePortfolios([]);
    setFieldMappings([]);
    setUnmappedKeys([]);
    setCustomPortfolioName('');
    setBusySubmitting(false);
  };

  const handleClose = () => {
    handleReset();
    onClose();
  };

  // Process text or uploaded file content
  const processPayload = async (rawContent: string, nameHint?: string) => {
    const trimmed = rawContent.trim();
    if (!trimmed) {
      setErrorMessage('Payload is empty. Please paste valid JSON/CSV or upload a file.');
      return;
    }

    setErrorMessage(null);

    // 1. Check if Native RizqFlow Envelope
    let isJson = false;
    let parsedJson: any = null;
    try {
      parsedJson = JSON.parse(trimmed);
      isJson = true;
    } catch {
      isJson = false;
    }

    if (isJson && isNativePortfolioEnvelope(parsedJson)) {
      const parseResult = parseNativeExport(parsedJson);
      if (parseResult.success) {
        setNativePortfolios(parseResult.portfolios);
        setSelectedPortfolioIdx(0);
        const initialName = parseResult.portfolios[0]?.name || nameHint || 'Imported Portfolio';
        setCustomPortfolioName(resolveUniqueName(initialName));
        setStep('preview-native');
        return;
      }
    }

    // 2. Foreign Payload: try AI first, fall back to heuristic
    setStep('loading');
    setLoadingMessage('Calling AI Mapping Assistant (Groq)...');

    let foreignRecord: Record<string, any> = {};
    if (isJson) {
      foreignRecord = parsedJson;
    } else {
      // Parse CSV
      foreignRecord = parseCsvToRecord(trimmed);
    }

    const defaultName = nameHint ? nameHint.replace(/\.[^/.]+$/, '') : 'Imported Portfolio';

    try {
      const res = await fetch('/api/ai/map-portfolio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payload: trimmed.slice(0, 30 * 1024) }), // Cap to 30 KB
      });

      if (res.ok) {
        const aiData = await res.json();
        if (aiData.profile && aiData.mapping) {
          const sanitized = sanitizeProfile(aiData.profile, getDefaultFallbackProfile());
          setForeignProfile(sanitized);
          setFieldMappings(aiData.mapping);
          setUnmappedKeys(aiData.unmapped || []);
          setMappingSource('ai');
          setAiModelUsed(aiData.model || 'Groq AI');
          setCustomPortfolioName(resolveUniqueName(defaultName));
          setStep('review-foreign');
          return;
        }
      }
    } catch (e) {
      // AI server or network failure -> Fall back smoothly to client heuristics
    }

    // Fallback: Local Heuristic Rule Mapper
    setLoadingMessage('AI mapping unavailable. Running local heuristic mapper...');
    const heuristicResult = mapForeignPayloadHeuristic(foreignRecord, getDefaultFallbackProfile());

    setForeignProfile(heuristicResult.profile);
    setFieldMappings(heuristicResult.mapping);
    setUnmappedKeys(heuristicResult.unmapped);
    setMappingSource('heuristic');
    setAiModelUsed(null);
    setCustomPortfolioName(resolveUniqueName(defaultName));
    setStep('review-foreign');
  };

  // Helper to ensure imported name doesn't overwrite existing portfolio
  const resolveUniqueName = (desiredName: string): string => {
    const existingNames = new Set(userPortfolios.map((p) => p.name.toLowerCase()));
    if (!existingNames.has(desiredName.toLowerCase())) {
      return desiredName;
    }
    // Append (imported)
    let candidate = `${desiredName} (imported)`;
    let counter = 2;
    while (existingNames.has(candidate.toLowerCase())) {
      candidate = `${desiredName} (imported ${counter})`;
      counter++;
    }
    return candidate;
  };

  // File drag & drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      handleFileSelected(files[0]);
    }
  };

  const handleFileSelected = (file: File) => {
    if (file.size > 15 * 1024 * 1024) {
      setErrorMessage('File exceeds maximum allowed size (15 MB)');
      return;
    }
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setInputText(content);
      void processPayload(content, file.name);
    };
    reader.onerror = () => {
      setErrorMessage('Could not read the uploaded file.');
    };
    reader.readAsText(file);
  };

  // Save / Commit handlers
  const handleSaveNative = async () => {
    if (nativePortfolios.length === 0) return;
    setBusySubmitting(true);

    try {
      if (nativePortfolios.length === 1) {
        const item = nativePortfolios[0];
        const finalName = customPortfolioName.trim() || item.name;
        const sanitized = sanitizeProfile(item.profile, getDefaultFallbackProfile());

        if (currentUser) {
          await createNewPortfolio(finalName, sanitized);
          showToast(`Imported portfolio "${finalName}" to your account!`);
        } else {
          setProfile(sanitized);
          showToast(`Imported portfolio "${finalName}" to local workspace!`);
        }
        onSuccess?.(finalName);
        handleClose();
      } else {
        // Multi-portfolio envelope
        let count = 0;
        for (const item of nativePortfolios) {
          const finalName = resolveUniqueName(item.name);
          const sanitized = sanitizeProfile(item.profile, getDefaultFallbackProfile());
          if (currentUser) {
            await createNewPortfolio(finalName, sanitized);
            count++;
          }
        }
        if (!currentUser && nativePortfolios.length > 0) {
          // Anonymous can load the first one
          const first = nativePortfolios[0];
          setProfile(sanitizeProfile(first.profile, getDefaultFallbackProfile()));
          showToast(`Loaded "${first.name}" into local workspace. Sign in to store all ${nativePortfolios.length} portfolios.`);
        } else {
          showToast(`Imported ${count} portfolios to your account!`);
        }
        handleClose();
      }
    } catch (err) {
      setErrorMessage('Failed to save portfolio. Please try again.');
    } finally {
      setBusySubmitting(false);
    }
  };

  const handleSaveForeign = async () => {
    setBusySubmitting(true);
    try {
      const finalName = customPortfolioName.trim() || 'Imported Portfolio';
      const sanitized = sanitizeProfile(foreignProfile, getDefaultFallbackProfile());

      if (currentUser) {
        await createNewPortfolio(finalName, sanitized);
        showToast(`Created portfolio "${finalName}" from foreign import!`);
      } else {
        setProfile(sanitized);
        showToast(`Loaded "${finalName}" into your local workspace!`);
      }

      onSuccess?.(finalName);
      handleClose();
    } catch (err) {
      setErrorMessage('Failed to save imported portfolio.');
    } finally {
      setBusySubmitting(false);
    }
  };

  // Inline edit helper for foreign profile
  const handleFieldChange = (targetPath: string, newValue: any) => {
    setForeignProfile((prev) => {
      const updated = JSON.parse(JSON.stringify(prev));
      if (targetPath.startsWith('expenses.')) {
        const expKey = targetPath.split('.')[1];
        if (!updated.expenses) updated.expenses = {};
        updated.expenses[expKey] = Number(newValue) || 0;
      } else if (typeof (prev as any)[targetPath] === 'number') {
        (updated as any)[targetPath] = Number(newValue) || 0;
      } else if (typeof (prev as any)[targetPath] === 'boolean') {
        (updated as any)[targetPath] = Boolean(newValue);
      } else {
        (updated as any)[targetPath] = newValue;
      }
      return updated;
    });
  };

  const getProfileValue = (targetPath: string): any => {
    if (targetPath.startsWith('expenses.')) {
      const expKey = targetPath.split('.')[1];
      return (foreignProfile.expenses as any)?.[expKey] ?? '';
    }
    return (foreignProfile as any)[targetPath] ?? '';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-2xl my-8 rounded-2xl bg-[#0C0C0F] border border-white/10 shadow-2xl shadow-emerald-500/10 flex flex-col overflow-hidden text-zinc-100">
        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-white/[0.08] bg-gradient-to-r from-emerald-500/10 via-[#0C0C0F] to-amber-500/10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500/20 to-amber-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <FolderKanban className="w-5 h-5 text-[#E8C15A]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base sm:text-lg text-white">Import Portfolio</h3>
                <span className="text-[10px] px-2 py-0.5 rounded bg-white/5 border border-white/10 text-zinc-300 font-mono">
                  JSON · CSV · Native
                </span>
              </div>
              <p className="text-xs text-zinc-400 mt-0.5">
                {step === 'input' && 'Upload a RizqFlow native backup or any foreign financial spreadsheet.'}
                {step === 'loading' && loadingMessage}
                {step === 'preview-native' && 'Verified native RizqFlow envelope detected.'}
                {step === 'review-foreign' && 'Human-in-the-Loop review: verify mapped fields before saving.'}
              </p>
            </div>
          </div>

          <button
            onClick={handleClose}
            className="p-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 space-y-5 max-h-[75vh] overflow-y-auto">
          {errorMessage && (
            <div className="p-3.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* 1. INPUT STEP */}
          {step === 'input' && (
            <div className="space-y-4">
              {/* Dropzone */}
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-6 sm:p-8 text-center cursor-pointer transition-all ${
                  isDragging
                    ? 'border-emerald-500 bg-emerald-500/10'
                    : 'border-white/15 bg-white/[0.02] hover:border-white/30 hover:bg-white/[0.04]'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json,.csv,.txt"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files && e.target.files.length > 0) {
                      handleFileSelected(e.target.files[0]);
                    }
                  }}
                />
                <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mx-auto text-zinc-400 mb-3">
                  <Upload className="w-6 h-6 text-emerald-400" />
                </div>
                <div className="text-sm font-semibold text-white">
                  Drop your file here, or <span className="text-[#E8C15A] underline">browse</span>
                </div>
                <p className="text-xs text-zinc-400 mt-1">
                  Supports <strong>.json</strong> (RizqFlow native envelope or arbitrary JSON) and <strong>.csv</strong> (spreadsheets)
                </p>
                {fileName && (
                  <div className="inline-flex items-center gap-1.5 mt-3 px-3 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-mono">
                    <FileText className="w-3.5 h-3.5" />
                    <span>{fileName}</span>
                  </div>
                )}
              </div>

              {/* Paste Text Area */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <label className="font-semibold text-zinc-300">Or Paste JSON / CSV Content Directly</label>
                  <span className="text-[11px] text-zinc-500 font-mono">Max 15 MB</span>
                </div>
                <textarea
                  rows={4}
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder='Paste JSON {"role": "salaried", "monthlyIncomePkr": 250000} or CSV "Salary,250000"...'
                  className="w-full px-3.5 py-2.5 rounded-xl bg-black border border-white/10 text-white font-mono text-xs focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={handleClose}
                  className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-300 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={!inputText.trim()}
                  onClick={() => processPayload(inputText)}
                  className="px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-black font-bold text-xs flex items-center gap-1.5 transition-all shadow-md shadow-emerald-500/20"
                >
                  <span>Inspect & Parse</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* 2. LOADING STATE */}
          {step === 'loading' && (
            <div className="py-12 flex flex-col items-center justify-center text-center space-y-3">
              <div className="w-10 h-10 rounded-full border-2 border-emerald-400 border-t-transparent animate-spin" />
              <div className="text-sm font-semibold text-white">{loadingMessage}</div>
              <p className="text-xs text-zinc-400 max-w-sm">
                Parsing foreign data keys, detecting currency units (Lac, Crore, k), and aligning schema boundaries.
              </p>
            </div>
          )}

          {/* 3. NATIVE ENVELOPE PREVIEW */}
          {step === 'preview-native' && (
            <div className="space-y-4">
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/25 flex items-center gap-2.5 text-xs text-emerald-300">
                <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>
                  <strong>Native RizqFlow Format:</strong> Guaranteed 100% round-trip fidelity. All calculations, vehicles, and goals are verified.
                </span>
              </div>

              {/* Portfolio Name Input */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-zinc-300">Portfolio Name</label>
                <input
                  type="text"
                  value={customPortfolioName}
                  onChange={(e) => setCustomPortfolioName(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-black border border-white/10 text-white text-xs focus:border-emerald-500 focus:outline-none"
                />
              </div>

              {/* Single Portfolio Details Bento */}
              {nativePortfolios.length === 1 && (
                <div className="rounded-xl bg-black/40 border border-white/10 p-4 space-y-3">
                  <div className="text-xs font-bold text-white flex items-center justify-between border-b border-white/5 pb-2">
                    <span>Summary Preview</span>
                    <span className="text-[10px] text-zinc-400 font-mono">
                      Exported: {new Date().toLocaleDateString('en-PK')}
                    </span>
                  </div>

                  {(() => {
                    const p = nativePortfolios[0].profile;
                    return (
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs font-mono">
                        <div className="p-2 rounded-lg bg-white/[0.02]">
                          <span className="text-zinc-500 block text-[10px]">Age</span>
                          <span className="text-white font-bold">{p.age} yrs</span>
                        </div>
                        <div className="p-2 rounded-lg bg-white/[0.02]">
                          <span className="text-zinc-500 block text-[10px]">Income</span>
                          <span className="text-white font-bold">Rs {(p.monthlyIncomePkr / 1000).toFixed(0)}k/mo</span>
                        </div>
                        <div className="p-2 rounded-lg bg-white/[0.02]">
                          <span className="text-zinc-500 block text-[10px]">Monthly Invest</span>
                          <span className="text-emerald-400 font-bold">Rs {(p.monthlyInvestPkr / 1000).toFixed(0)}k/mo</span>
                        </div>
                        <div className="p-2 rounded-lg bg-white/[0.02]">
                          <span className="text-zinc-500 block text-[10px]">Lump Sum</span>
                          <span className="text-amber-300 font-bold">Rs {(p.lumpSumPkr / 100000).toFixed(1)} Lac</span>
                        </div>
                        <div className="p-2 rounded-lg bg-white/[0.02]">
                          <span className="text-zinc-500 block text-[10px]">Tax Status</span>
                          <span className="text-white font-bold uppercase">{p.taxStatus}</span>
                        </div>
                        <div className="p-2 rounded-lg bg-white/[0.02]">
                          <span className="text-zinc-500 block text-[10px]">Shariah Only</span>
                          <span className="text-white font-bold">{p.shariahOnly ? 'Yes (Halal)' : 'No'}</span>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* Multi-Portfolio list if multi envelope */}
              {nativePortfolios.length > 1 && (
                <div className="space-y-2">
                  <div className="text-xs font-semibold text-zinc-300">
                    Enclosed Portfolios ({nativePortfolios.length})
                  </div>
                  <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                    {nativePortfolios.map((item, idx) => (
                      <div
                        key={idx}
                        className="p-2.5 rounded-xl bg-black/40 border border-white/5 flex items-center justify-between text-xs"
                      >
                        <div className="flex items-center gap-2">
                          <FolderKanban className="w-3.5 h-3.5 text-[#E8C15A]" />
                          <span className="font-semibold text-white">{item.name}</span>
                        </div>
                        <span className="text-[10px] text-zinc-400 font-mono">
                          Income: Rs {(item.profile.monthlyIncomePkr / 1000).toFixed(0)}k/mo
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex justify-between items-center pt-3 border-t border-white/10">
                <button
                  type="button"
                  onClick={handleReset}
                  className="px-3 py-1.5 rounded-xl text-xs text-zinc-400 hover:text-white flex items-center gap-1"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Choose Another</span>
                </button>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleClose}
                    className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-300 text-xs font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={busySubmitting}
                    onClick={handleSaveNative}
                    className="px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-60 text-black font-bold text-xs flex items-center gap-1.5 shadow-md shadow-emerald-500/20"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>{busySubmitting ? 'Importing…' : 'Import as New Portfolio'}</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 4. FOREIGN REVIEW (HUMAN-IN-THE-LOOP MAPPING) */}
          {step === 'review-foreign' && (
            <div className="space-y-4">
              {/* Mapping Status Badge */}
              <div className="p-3 rounded-xl bg-white/[0.03] border border-white/10 flex items-center justify-between flex-wrap gap-2 text-xs">
                <div className="flex items-center gap-2">
                  {mappingSource === 'ai' ? (
                    <Bot className="w-4 h-4 text-emerald-400 shrink-0" />
                  ) : (
                    <Sparkles className="w-4 h-4 text-[#E8C15A] shrink-0" />
                  )}
                  <span className="text-zinc-200">
                    Mapped using{' '}
                    <strong className="text-white">
                      {mappingSource === 'ai' ? `AI Assistant (${aiModelUsed})` : 'Local Heuristic Rules'}
                    </strong>
                  </span>
                </div>
                <span className="text-[11px] font-mono text-zinc-400">
                  {fieldMappings.length} fields mapped · {unmappedKeys.length} unmapped
                </span>
              </div>

              {/* Portfolio Name Input */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-zinc-300">Save Portfolio As</label>
                <input
                  type="text"
                  value={customPortfolioName}
                  onChange={(e) => setCustomPortfolioName(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-black border border-white/10 text-white text-xs focus:border-emerald-500 focus:outline-none"
                />
              </div>

              {/* Mapping Review Table */}
              <div className="space-y-1.5">
                <div className="text-xs font-semibold text-zinc-300 flex items-center justify-between">
                  <span>Mapped Profile Fields ({fieldMappings.length})</span>
                  <span className="text-[10px] text-zinc-500">Edit values inline if needed</span>
                </div>

                <div className="rounded-xl border border-white/10 overflow-hidden bg-black/40">
                  <div className="max-h-60 overflow-y-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-white/5 border-b border-white/10 text-[10px] uppercase font-mono text-zinc-400 sticky top-0">
                        <tr>
                          <th className="py-2 px-3">Source Field</th>
                          <th className="py-2 px-3">Target Field</th>
                          <th className="py-2 px-3">Mapped Value</th>
                          <th className="py-2 px-3">Confidence</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5 font-mono text-[11px]">
                        {fieldMappings.map((m, idx) => {
                          const currentVal = getProfileValue(m.target);
                          const isLow = m.confidence === 'low';
                          const isMed = m.confidence === 'medium';
                          return (
                            <tr
                              key={idx}
                              className={`hover:bg-white/[0.02] ${
                                isLow ? 'bg-rose-500/[0.04]' : isMed ? 'bg-amber-500/[0.02]' : ''
                              }`}
                            >
                              <td className="py-2 px-3 font-semibold text-zinc-300 max-w-[140px] truncate" title={m.source}>
                                {m.source}
                              </td>
                              <td className="py-2 px-3 text-emerald-400">
                                {m.target}
                              </td>
                              <td className="py-2 px-3">
                                <input
                                  type="text"
                                  value={currentVal}
                                  onChange={(e) => handleFieldChange(m.target, e.target.value)}
                                  className="w-24 px-1.5 py-0.5 rounded bg-black/60 border border-white/15 text-white font-mono text-[11px] focus:border-emerald-400 focus:outline-none"
                                />
                              </td>
                              <td className="py-2 px-3">
                                <span
                                  className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${
                                    m.confidence === 'high'
                                      ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                                      : m.confidence === 'medium'
                                      ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                                      : 'bg-rose-500/15 text-rose-300 border border-rose-500/30'
                                  }`}
                                >
                                  {m.confidence}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* Unmapped Source Fields (Collapsible) */}
              {unmappedKeys.length > 0 && (
                <div className="rounded-xl bg-white/[0.02] border border-white/5 p-3 space-y-2">
                  <button
                    type="button"
                    onClick={() => setShowUnmapped(!showUnmapped)}
                    className="w-full flex items-center justify-between text-xs text-zinc-400 hover:text-zinc-200"
                  >
                    <span className="flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                      <span>{unmappedKeys.length} Unmapped Source Keys</span>
                    </span>
                    {showUnmapped ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  </button>

                  {showUnmapped && (
                    <div className="pt-2 border-t border-white/5 flex flex-wrap gap-1.5">
                      {unmappedKeys.map((k) => (
                        <span
                          key={k}
                          className="px-2 py-0.5 rounded bg-black/60 border border-white/10 text-zinc-400 font-mono text-[10px]"
                        >
                          {k}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex justify-between items-center pt-3 border-t border-white/10">
                <button
                  type="button"
                  onClick={handleReset}
                  className="px-3 py-1.5 rounded-xl text-xs text-zinc-400 hover:text-white flex items-center gap-1"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Start Over</span>
                </button>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleClose}
                    className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-300 text-xs font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={busySubmitting}
                    onClick={handleSaveForeign}
                    className="px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-60 text-black font-bold text-xs flex items-center gap-1.5 shadow-md shadow-emerald-500/20"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>{busySubmitting ? 'Saving…' : 'Confirm & Create Portfolio'}</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
