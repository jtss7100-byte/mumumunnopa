import React, { useEffect, useState } from 'react';
import {
  BookOpen,
  Check,
  Download,
  FilePlus2,
  FolderOpen,
  Layers,
  Menu,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { SEED_MUNPIA_PROJECT, createBlankProject } from './data/seedProject';
import type { CharacterArchetype } from './data/munpiaReferences';
import type {
  EpisodeBlockGuide,
  EpisodeGuideRow,
  EpisodeNarrativeBlueprint,
  NovelProject,
  WorkflowPhase,
} from './types/novelPlanner';
import { STORAGE_KEY, migrateProjectToV2, parseProjectBackupJson } from './utils/munpiaEngine';
import {
  buildProjectFromBrainDump,
  clearEstimatedField,
  mergeBrainDumpIntoProject,
} from './utils/brainDumpEngine';
import {
  requestArcPlanAI,
  requestAssembleBlueprintFromMemoAI,
  requestBlockGuideAI,
  requestBlueprintAI,
  requestBrainDumpParseAI,
  requestPreReadAI,
  requestSettingBibleAI,
} from './services/aiClient';
import { PhaseBrainDumpView, type BrainDumpJumpTarget } from './components/PhaseBrainDump';
import { Phase0InputView } from './components/Phase0Input';
import { Phase1PreReadView } from './components/Phase1PreRead';
import { Phase2SettingBibleView } from './components/Phase2SettingBible';
import { Phase3ArcPlannerView } from './components/Phase3ArcPlanner';
import { Phase4NarrativeStudioView } from './components/Phase4NarrativeStudio';
import { MunpiaReferenceDrawer } from './components/MunpiaReferenceDrawer';

const PHASE_STEPS: Array<{ phase: WorkflowPhase; code: string; label: string; desc: string }> = [
  { phase: 'dump', code: '0.', label: '아이디어 덤프 (혼잣말 입력)', desc: '자유 메모 · 일괄 자동 파싱' },
  { phase: 0, code: 'Phase 0', label: '작품 입력', desc: '프롤로그 · 장르 · 훅' },
  { phase: 1, code: 'Phase 1', label: 'AI 선읽기', desc: '적합도 · 미확정 [?]' },
  { phase: 2, code: 'Phase 2', label: '세팅 바이블', desc: '엔진 · 세계관 · 인물표' },
  { phase: 3, code: 'Phase 3', label: '25화 아크', desc: '킥이벤트 · 3-Q 진단' },
  { phase: 4, code: 'Phase 4', label: '회차 설계도', desc: '5화 가이드 · JSON 빌더' },
];

function loadInitialProjects(): NovelProject[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map((proj) => migrateProjectToV2(proj));
      }
    }
  } catch {
    // Ignore corrupt localStorage and fall back to seed
  }
  return [migrateProjectToV2(SEED_MUNPIA_PROJECT)];
}

export default function App() {
  const [projects, setProjects] = useState<NovelProject[]>(loadInitialProjects);
  const [activeProjectId, setActiveProjectId] = useState<string>(() => loadInitialProjects()[0].id);
  const [activeBlockIndex, setActiveBlockIndex] = useState<number>(0);
  const [targetPhase4EpNum, setTargetPhase4EpNum] = useState<number | null>(null);
  const [refDrawerOpen, setRefDrawerOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [loadingTask, setLoadingTask] = useState<
    null | 'braindump' | 'preread' | 'setting' | 'arc' | 'block' | 'blueprint'
  >(null);
  const [brainDumpMode, setBrainDumpMode] = useState<'new' | 'merge' | null>(null);

  const activeProject =
    projects.find((p) => p.id === activeProjectId) ?? projects[0] ?? SEED_MUNPIA_PROJECT;

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
    } catch {
      // Ignore storage quota errors
    }
  }, [projects]);

  const showNotice = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((curr) => (curr === msg ? null : curr));
    }, 3000);
  };

  const updateActiveProject = (updater: (prev: NovelProject) => NovelProject) => {
    setProjects((prevList) =>
      prevList.map((proj) =>
        proj.id === activeProject.id
          ? { ...updater(proj), updatedAt: new Date().toISOString() }
          : proj
      )
    );
  };

  const setPhase = (phase: WorkflowPhase) => {
    setAiError(null);
    updateActiveProject((p) => ({ ...p, currentPhase: phase }));
    setMobileMenuOpen(false);
  };

  const handleCreateNewProject = () => {
    const fresh = createBlankProject(`신규 연재 기획 ${projects.length + 1}`);
    setProjects((prev) => [fresh, ...prev]);
    setActiveProjectId(fresh.id);
    setAiError(null);
    showNotice('새 작품 기획을 생성했습니다.');
  };

  const handleDeleteProject = (id: string) => {
    if (projects.length <= 1) {
      showNotice('최소 1개의 작품 프로젝트가 필요합니다.');
      return;
    }
    const remaining = projects.filter((p) => p.id !== id);
    setProjects(remaining);
    if (activeProjectId === id) {
      setActiveProjectId(remaining[0].id);
    }
    showNotice('작품 프로젝트를 삭제했습니다.');
  };

  const handleExportProject = () => {
    const blob = new Blob([JSON.stringify(activeProject, null, 2)], {
      type: 'application/json;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const safeName = (activeProject.phase2?.title || activeProject.phase0.workingTitle || 'munpia-project')
      .replace(/[^\w가-힣-]+/g, '_')
      .slice(0, 40);
    a.href = url;
    a.download = `munpia-forge-${safeName}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showNotice('전체 프로젝트 JSON 백업을 내려받았습니다.');
  };

  const handleImportProject = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const res = parseProjectBackupJson(String(reader.result ?? ''));
      if (!res.ok) {
        setAiError(res.error);
        return;
      }
      const imported = { ...res.data, id: `proj-${Date.now()}` };
      setProjects((prev) => [imported, ...prev]);
      setActiveProjectId(imported.id);
      setAiError(null);
      showNotice(`"${imported.phase0.workingTitle}" 프로젝트를 복원했습니다.`);
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleClearEstimatedField = (fieldKey: string) => {
    updateActiveProject((p) => ({
      ...p,
      aiEstimatedFields: clearEstimatedField(p.aiEstimatedFields, fieldKey),
    }));
  };

  const handleJumpFromBrainDump = (target: BrainDumpJumpTarget, epNum?: number) => {
    setAiError(null);
    if (target === 'setting') {
      setPhase(2);
      return;
    }
    if (target === 'characters') {
      setPhase(2);
      requestAnimationFrame(() => {
        document
          .getElementById('setting-characters-section')
          ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
      return;
    }
    if (target === 'arc') {
      setPhase(3);
      return;
    }
    if (target === 'blueprint') {
      const targetEp = Math.max(1, epNum ?? 1);
      setActiveBlockIndex(Math.floor((targetEp - 1) / 5));
      setTargetPhase4EpNum(targetEp);
      setPhase(4);
    }
  };

  // AI Orchestrators
  const handleRunBrainDump = async (mode: 'new' | 'merge') => {
    const memo = (activeProject.brainDumpText ?? '').trim();
    if (memo.length < 10) {
      setAiError('아이디어 메모를 최소 10자 이상 입력한 뒤 자동 파싱을 실행해 주세요.');
      return;
    }
    setAiError(null);
    setLoadingTask('braindump');
    setBrainDumpMode(mode);
    try {
      const parsed = await requestBrainDumpParseAI(
        memo,
        mode,
        mode === 'merge' ? activeProject : null
      );
      if (mode === 'new') {
        const created = buildProjectFromBrainDump(memo, parsed);
        setProjects((prev) => [created, ...prev]);
        setActiveProjectId(created.id);
        showNotice(`"${created.phase0.workingTitle}" 새 작품 전체 자동 세팅을 완료했습니다.`);
      } else {
        updateActiveProject((p) => mergeBrainDumpIntoProject(p, memo, parsed));
        showNotice('현재 작품에 메모 내용을 병합/추가했습니다.');
      }
    } catch (err) {
      setAiError(err instanceof Error ? err.message : '아이디어 덤프 자동 파싱 실패');
    } finally {
      setLoadingTask(null);
      setBrainDumpMode(null);
    }
  };

  const handleRunPreRead = async () => {
    setAiError(null);
    setLoadingTask('preread');
    try {
      const result = await requestPreReadAI(activeProject.phase0);
      updateActiveProject((p) => ({ ...p, phase1: result, currentPhase: 1 }));
      showNotice('Phase 1 선읽기 분석이 완료되었습니다.');
    } catch (err) {
      setAiError(err instanceof Error ? err.message : 'AI 선읽기 호출 실패');
    } finally {
      setLoadingTask(null);
    }
  };

  const handleGenerateSetting = async () => {
    if (!activeProject.phase1) return;
    setAiError(null);
    setLoadingTask('setting');
    try {
      const result = await requestSettingBibleAI(activeProject.phase0, activeProject.phase1);
      updateActiveProject((p) => ({
        ...p,
        phase1: p.phase1 ? { ...p.phase1, confirmed: true } : null,
        phase2: result,
        currentPhase: 2,
      }));
      showNotice('Phase 2 세팅 바이블을 생성했습니다.');
    } catch (err) {
      setAiError(err instanceof Error ? err.message : '세팅 바이블 생성 실패');
    } finally {
      setLoadingTask(null);
    }
  };

  const handleGenerateArc = async () => {
    if (!activeProject.phase2) return;
    setAiError(null);
    setLoadingTask('arc');
    try {
      const result = await requestArcPlanAI(activeProject.phase2);
      updateActiveProject((p) => ({
        ...p,
        phase2: p.phase2 ? { ...p.phase2, confirmed: true } : null,
        phase3: result,
        currentPhase: 3,
      }));
      showNotice('Phase 3 25화 아크와 킥이벤트를 설계했습니다.');
    } catch (err) {
      setAiError(err instanceof Error ? err.message : '25화 아크 생성 실패');
    } finally {
      setLoadingTask(null);
    }
  };

  const handleGenerateBlockGuide = async (blockIdx: number) => {
    if (!activeProject.phase2 || !activeProject.phase3) {
      setAiError('5화 블록 가이드를 생성하려면 Phase 2 세팅 바이블과 Phase 3 아크가 필요합니다.');
      return;
    }
    setAiError(null);
    setLoadingTask('block');
    try {
      const result = await requestBlockGuideAI(activeProject.phase2, activeProject.phase3, blockIdx);
      updateActiveProject((p) => {
        const filtered = p.phase4Blocks.filter((b) => b.blockIndex !== blockIdx);
        return { ...p, phase4Blocks: [...filtered, result].sort((a, b) => a.blockIndex - b.blockIndex) };
      });
      showNotice(`${blockIdx * 5 + 1}~${blockIdx * 5 + 5}화 블록 가이드를 생성했습니다.`);
    } catch (err) {
      setAiError(err instanceof Error ? err.message : '5화 블록 가이드 생성 실패');
    } finally {
      setLoadingTask(null);
    }
  };

  const handleGenerateBlueprint = async (epRow: EpisodeGuideRow) => {
    if (!activeProject.phase2) {
      setAiError('회차 설계도를 생성하려면 Phase 2 세팅 바이블이 필요합니다.');
      return;
    }
    setAiError(null);
    setLoadingTask('blueprint');
    try {
      const block = activeProject.phase4Blocks.find((b) =>
        b.episodes.some((e) => e.episodeNumber === epRow.episodeNumber)
      );
      const prevRow = block?.episodes.find((e) => e.episodeNumber === epRow.episodeNumber - 1);
      const prevSummary = epRow.episodeNumber === 1 ? null : prevRow?.coreIncident ?? null;
      const result = await requestBlueprintAI(activeProject.phase2, epRow, prevSummary);
      updateActiveProject((p) => ({
        ...p,
        blueprints: { ...p.blueprints, [epRow.episodeNumber]: result },
      }));
      showNotice(`${epRow.episodeNumber}화 서사 제어 설계도를 생성했습니다.`);
    } catch (err) {
      setAiError(err instanceof Error ? err.message : '회차 서사 설계도 생성 실패');
    } finally {
      setLoadingTask(null);
    }
  };

  const handleAssembleBlueprintFromMemo = async (epNum: number, memo: string) => {
    setAiError(null);
    setLoadingTask('blueprint');
    try {
      const block = activeProject.phase4Blocks.find((b) =>
        b.episodes.some((e) => e.episodeNumber === epNum)
      );
      const prevRow = block?.episodes.find((e) => e.episodeNumber === epNum - 1);
      const prevSummary = epNum === 1 ? null : prevRow?.coreIncident ?? null;
      const result = await requestAssembleBlueprintFromMemoAI(
        activeProject.phase2,
        epNum,
        memo,
        prevSummary
      );
      updateActiveProject((p) => ({
        ...p,
        blueprints: { ...p.blueprints, [epNum]: result },
      }));
      showNotice(`${epNum}화 설계도를 줄거리 메모로부터 자동 조립했습니다.`);
    } catch (err) {
      setAiError(err instanceof Error ? err.message : '메모 기반 AI 설계도 조립 실패');
    } finally {
      setLoadingTask(null);
    }
  };

  const handleAddArchetypeToSetting = (archetype: CharacterArchetype) => {
    if (!activeProject.phase2) {
      showNotice('Phase 2 세팅 바이블을 먼저 생성한 뒤 인물을 추가할 수 있습니다.');
      return;
    }
    updateActiveProject((p) => {
      if (!p.phase2) return p;
      return {
        ...p,
        phase2: {
          ...p.phase2,
          characters: [
            ...p.phase2.characters,
            {
              id: `char-${Date.now()}`,
              name: `${archetype.name} 신규`,
              role: archetype.category,
              archetypeNumber: archetype.number,
              archetypeName: archetype.name,
              outerPersonality: archetype.outerDefault,
              innerPersonality: archetype.innerDefault,
              ability: '',
              relationshipFlow: archetype.relationFlowDefault,
              speechNote: archetype.contrastTip,
            },
          ],
        },
      };
    });
    showNotice(`${archetype.symbol} ${archetype.name} 아키타입을 인물표에 추가했습니다.`);
  };

  const phaseCompletion = (phase: WorkflowPhase): boolean => {
    if (phase === 'dump') {
      return Boolean(activeProject.lastBrainDumpReport || activeProject.brainDumpText?.trim());
    }
    if (phase === 0) return activeProject.phase0.rawIdeaOrPrologue.trim().length > 0;
    if (phase === 1) return Boolean(activeProject.phase1);
    if (phase === 2) return Boolean(activeProject.phase2);
    if (phase === 3) return Boolean(activeProject.phase3);
    return Object.keys(activeProject.blueprints).length > 0;
  };

  const activePhaseMeta =
    PHASE_STEPS.find((s) => s.phase === activeProject.currentPhase) ?? PHASE_STEPS[0];

  return (
    <div className="min-h-screen bg-[#090b10] text-zinc-100 flex">
      {/* Desktop Sidebar (272px) */}
      <aside className="hidden lg:flex lg:flex-col w-[272px] shrink-0 bg-[#0d1017] border-r border-zinc-800/80 min-h-screen sticky top-0 h-screen">
        {/* Brand */}
        <div className="h-14 px-5 flex items-center border-b border-zinc-800/80">
          <span className="text-base font-bold tracking-tight text-zinc-100 whitespace-nowrap">
            MUNPIA <span className="text-amber-400">FORGE</span>
          </span>
        </div>

        {/* Phase Stepper */}
        <nav aria-label="기획 단계 워크플로우" className="p-3.5 space-y-1">
          <p className="px-2.5 pb-1.5 text-[11px] font-medium text-zinc-500">단계별 확정 워크플로우</p>
          {PHASE_STEPS.map((step) => {
            const active = activeProject.currentPhase === step.phase;
            const ready = phaseCompletion(step.phase);
            return (
              <button
                key={step.phase}
                type="button"
                onClick={() => setPhase(step.phase)}
                aria-current={active ? 'step' : undefined}
                className={`w-full px-3 py-2.5 rounded-lg text-left transition-colors flex items-center justify-between gap-2 ${
                  active
                    ? 'bg-amber-400/12 text-amber-200 border border-amber-400/40'
                    : 'text-zinc-300 hover:bg-zinc-900 border border-transparent'
                }`}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className={`text-[11px] font-mono shrink-0 ${active ? 'text-amber-400' : 'text-zinc-500'}`}>
                      {step.code}
                    </span>
                    <span className="text-[13px] font-medium truncate">{step.label}</span>
                  </div>
                  <p className="text-[11px] text-zinc-500 truncate mt-0.5">{step.desc}</p>
                </div>
                {ready && (
                  <Check className={`w-3.5 h-3.5 shrink-0 ${active ? 'text-amber-400' : 'text-emerald-500/80'}`} />
                )}
              </button>
            );
          })}
        </nav>

        <hr className="border-zinc-800/80 mx-4" />

        {/* Project Switcher */}
        <div className="p-4 flex-1 overflow-y-auto space-y-2.5">
          <div className="flex items-center justify-between px-2">
            <span className="text-[11px] font-medium text-zinc-500">작품 프로젝트 ({projects.length})</span>
            <button
              type="button"
              onClick={handleCreateNewProject}
              aria-label="새 작품 프로젝트 생성"
              className="text-xs text-amber-400 hover:text-amber-300 inline-flex items-center gap-1"
            >
              <FilePlus2 className="w-3.5 h-3.5" />
              <span>새 작품</span>
            </button>
          </div>
          <div className="space-y-1">
            {projects.map((proj) => {
              const isCurrent = proj.id === activeProject.id;
              const title = proj.phase2?.title || proj.phase0.workingTitle || '제목 미정';
              return (
                <div
                  key={proj.id}
                  className={`group flex items-center justify-between gap-1 px-2.5 py-2 rounded-lg text-xs transition-colors ${
                    isCurrent ? 'bg-zinc-800/90 text-zinc-100' : 'text-zinc-400 hover:bg-zinc-900/70'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => {
                      setActiveProjectId(proj.id);
                      setAiError(null);
                    }}
                    className="flex items-center gap-2 min-w-0 flex-1 text-left"
                  >
                    <FolderOpen className={`w-3.5 h-3.5 shrink-0 ${isCurrent ? 'text-amber-400' : 'text-zinc-500'}`} />
                    <span className="truncate font-medium">{title}</span>
                  </button>
                  {projects.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleDeleteProject(proj.id)}
                      aria-label={`${title} 프로젝트 삭제`}
                      className="p-1 text-zinc-600 hover:text-rose-400 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer backup actions */}
        <div className="p-4 border-t border-zinc-800/80 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={handleExportProject}
              className="px-2.5 py-2 text-xs font-medium text-zinc-300 bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 rounded-lg inline-flex items-center justify-center gap-1.5 whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5" />
              <span>백업</span>
            </button>
            <label className="px-2.5 py-2 text-xs font-medium text-zinc-300 bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 rounded-lg inline-flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap">
              <Upload className="w-3.5 h-3.5" />
              <span>복원</span>
              <input
                type="file"
                accept=".json,application/json"
                onChange={handleImportProject}
                className="sr-only"
              />
            </label>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Clean 3-Zone Top Bar */}
        <header className="h-14 px-4 lg:px-8 border-b border-zinc-800/80 bg-[#090b10]/95 backdrop-blur sticky top-0 z-30 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <button
              type="button"
              onClick={() => setMobileMenuOpen((v) => !v)}
              aria-label="메뉴 열기"
              className="lg:hidden p-2 -ml-2 text-zinc-400 hover:text-zinc-100 shrink-0"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
            <div className="flex items-center gap-2 text-xs sm:text-sm min-w-0 flex-1">
              <span className="lg:hidden font-bold text-zinc-100 whitespace-nowrap shrink-0">
                MUNPIA <span className="text-amber-400">FORGE</span>
              </span>
              <span className="hidden lg:inline text-zinc-400 truncate max-w-[260px]">
                {activeProject.phase2?.title || activeProject.phase0.workingTitle || '제목 미정'}
              </span>
              <span className="text-zinc-700 shrink-0" aria-hidden="true">/</span>
              <span className="font-medium text-zinc-100 truncate">
                {activePhaseMeta.code.endsWith('.')
                  ? `${activePhaseMeta.code} ${activePhaseMeta.label}`
                  : `${activePhaseMeta.code} · ${activePhaseMeta.label}`}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {toastMessage && (
              <span className="hidden md:inline text-xs text-emerald-400 whitespace-nowrap">
                {toastMessage}
              </span>
            )}
            <button
              type="button"
              onClick={() => setRefDrawerOpen(true)}
              aria-label="문피아 레퍼런스 DB"
              className="px-3 sm:px-3.5 py-2 text-xs font-medium text-zinc-200 bg-zinc-900 border border-zinc-800 hover:border-zinc-700 rounded-lg transition-colors whitespace-nowrap shrink-0 inline-flex items-center gap-1.5"
            >
              <BookOpen className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span className="sm:hidden">레퍼런스</span>
              <span className="hidden sm:inline">문피아 레퍼런스 DB</span>
            </button>
          </div>
        </header>

        {/* Mobile Phase Menu */}
        {mobileMenuOpen && (
          <div className="lg:hidden bg-[#0d1017] border-b border-zinc-800 p-4 space-y-3">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {PHASE_STEPS.map((step) => (
                <button
                  key={step.phase}
                  type="button"
                  onClick={() => setPhase(step.phase)}
                  className={`px-3 py-2 text-xs rounded-lg border text-left ${
                    activeProject.currentPhase === step.phase
                      ? 'bg-amber-400/15 border-amber-400/60 text-amber-200 font-semibold'
                      : 'bg-zinc-900 border-zinc-800 text-zinc-300'
                  }`}
                >
                  {step.code} · {step.label}
                </button>
              ))}
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-zinc-800">
              <button
                type="button"
                onClick={handleCreateNewProject}
                className="text-xs text-amber-400 inline-flex items-center gap-1"
              >
                <FilePlus2 className="w-3.5 h-3.5" />
                <span>새 작품</span>
              </button>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleExportProject}
                  className="px-2.5 py-1.5 text-xs text-zinc-300 bg-zinc-900 border border-zinc-800 rounded"
                >
                  백업
                </button>
                <label className="px-2.5 py-1.5 text-xs text-zinc-300 bg-zinc-900 border border-zinc-800 rounded cursor-pointer">
                  복원
                  <input
                    type="file"
                    accept=".json,application/json"
                    onChange={handleImportProject}
                    className="sr-only"
                  />
                </label>
              </div>
            </div>
          </div>
        )}

        {/* Active Phase Workspace */}
        <main className="flex-1 w-full max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-10 py-8">
          {activeProject.currentPhase === 'dump' && (
            <PhaseBrainDumpView
              value={activeProject.brainDumpText ?? ''}
              currentProjectTitle={
                activeProject.phase2?.title || activeProject.phase0.workingTitle || '제목 미정'
              }
              report={activeProject.lastBrainDumpReport ?? null}
              remainingEstimatedCount={(activeProject.aiEstimatedFields ?? []).length}
              isParsing={loadingTask === 'braindump'}
              parsingMode={brainDumpMode}
              errorMessage={aiError}
              onChange={(nextText) =>
                updateActiveProject((p) => ({ ...p, brainDumpText: nextText }))
              }
              onRunParse={handleRunBrainDump}
              onJumpToTarget={handleJumpFromBrainDump}
            />
          )}

          {activeProject.currentPhase === 0 && (
            <Phase0InputView
              value={activeProject.phase0}
              hasPhase1={Boolean(activeProject.phase1)}
              isGenerating={loadingTask === 'preread'}
              errorMessage={aiError}
              onChange={(phase0) => updateActiveProject((p) => ({ ...p, phase0 }))}
              onRunPreRead={handleRunPreRead}
              onGoToPhase1={() => setPhase(1)}
            />
          )}

          {activeProject.currentPhase === 1 && (
            <Phase1PreReadView
              analysis={activeProject.phase1}
              hasPhase2={Boolean(activeProject.phase2)}
              isGeneratingPreRead={loadingTask === 'preread'}
              isGeneratingSetting={loadingTask === 'setting'}
              errorMessage={aiError}
              onChange={(phase1) => updateActiveProject((p) => ({ ...p, phase1 }))}
              onReRunPreRead={handleRunPreRead}
              onGenerateSettingBible={handleGenerateSetting}
              onGoToPhase2={() => setPhase(2)}
            />
          )}

          {activeProject.currentPhase === 2 && (
            <Phase2SettingBibleView
              bible={activeProject.phase2}
              hasPhase3={Boolean(activeProject.phase3)}
              isGeneratingSetting={loadingTask === 'setting'}
              isGeneratingArc={loadingTask === 'arc'}
              errorMessage={aiError}
              aiEstimatedFields={activeProject.aiEstimatedFields}
              onClearEstimatedField={handleClearEstimatedField}
              onChange={(phase2) => updateActiveProject((p) => ({ ...p, phase2 }))}
              onGenerateSettingBible={handleGenerateSetting}
              onGenerateArcPlan={handleGenerateArc}
              onGoToPhase3={() => setPhase(3)}
            />
          )}

          {activeProject.currentPhase === 3 && (
            <Phase3ArcPlannerView
              arcPlan={activeProject.phase3}
              settingBible={activeProject.phase2}
              isGeneratingArc={loadingTask === 'arc'}
              errorMessage={aiError}
              aiEstimatedFields={activeProject.aiEstimatedFields}
              onClearEstimatedField={handleClearEstimatedField}
              onChange={(phase3) => updateActiveProject((p) => ({ ...p, phase3 }))}
              onGenerateArcPlan={handleGenerateArc}
              onOpenBlockInPhase4={(blkIdx) => {
                setActiveBlockIndex(blkIdx);
                setTargetPhase4EpNum(blkIdx * 5 + 1);
                setPhase(4);
              }}
            />
          )}

          {activeProject.currentPhase === 4 && (
            <Phase4NarrativeStudioView
              activeBlockIndex={activeBlockIndex}
              targetEpNum={targetPhase4EpNum}
              blocks={activeProject.phase4Blocks}
              blueprints={activeProject.blueprints}
              settingBible={activeProject.phase2}
              isGeneratingBlock={loadingTask === 'block'}
              isGeneratingBlueprint={loadingTask === 'blueprint'}
              errorMessage={aiError}
              aiEstimatedFields={activeProject.aiEstimatedFields}
              onClearEstimatedField={handleClearEstimatedField}
              onSelectBlock={(blkIdx) => {
                setActiveBlockIndex(blkIdx);
                setTargetPhase4EpNum(blkIdx * 5 + 1);
              }}
              onUpdateBlock={(nextBlock: EpisodeBlockGuide) =>
                updateActiveProject((p) => ({
                  ...p,
                  phase4Blocks: [
                    ...p.phase4Blocks.filter((b) => b.blockIndex !== nextBlock.blockIndex),
                    nextBlock,
                  ].sort((a, b) => a.blockIndex - b.blockIndex),
                }))
              }
              onUpdateBlueprint={(epNum: number, bp: EpisodeNarrativeBlueprint) =>
                updateActiveProject((p) => ({
                  ...p,
                  blueprints: { ...p.blueprints, [epNum]: bp },
                }))
              }
              onGenerateBlockGuide={handleGenerateBlockGuide}
              onGenerateBlueprint={handleGenerateBlueprint}
              onAssembleFromMemo={handleAssembleBlueprintFromMemo}
            />
          )}
        </main>

        {/* Quiet Studio Footer */}
        <footer className="px-6 lg:px-10 py-4 border-t border-zinc-800/60 text-xs text-zinc-500 flex flex-wrap items-center justify-between gap-2">
          <div className="inline-flex items-center gap-2">
            <Layers className="w-3.5 h-3.5 text-zinc-600" />
            <span>MUNPIA FORGE · 브라우저 자동 저장 활성</span>
          </div>
          <span className="font-mono tabular-nums">
            편당결제 100원 가치 · N마크 3,000자 · 표준 5,000자 · 25화 유료화 전환
          </span>
        </footer>
      </div>

      {/* Built-in Reference Library Drawer */}
      <MunpiaReferenceDrawer
        open={refDrawerOpen}
        onClose={() => setRefDrawerOpen(false)}
        onAddArchetypeToSetting={activeProject.phase2 ? handleAddArchetypeToSetting : undefined}
      />
    </div>
  );
}
