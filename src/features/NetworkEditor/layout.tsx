import React, { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { formatDate } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '../../supabaseClient';
import { useRole } from '../../getRole';
import { 
  Folder,
  Network,
  Waypoints,
  Pill,
  Container,
  Cpu,
  Upload,
  Download,
  Play,
  BarChart3,
  Calendar,
  Users,
  User,
  PanelLeftClose,
  PanelLeft,
  FileText,
  Dna
} from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
//import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import type { DeterministicAnalysisResult } from '@/lib/analysis/types';


export interface NetworkEditorLayoutProps {
  children: React.ReactNode;
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
  networkSidebar?: React.ReactNode;
  inferenceSidebar?: React.ReactNode;
  therapeuticsSidebar?: React.ReactNode;
  seqAnalysisSidebar?: React.ReactNode;
  /** When true, disables tabs appearing after 'therapeutics' in the header */
  disableAfterTherapeutics?: boolean;
  inferenceActions?: {
    run?: () => void;
    runWeighted?: () => void;
    runProbabilistic?: () => void;
    download?: () => void;
    isRunning?: boolean;
    isWeightedRunning?: boolean;
    isProbabilisticRunning?: boolean;
      isRuleBased?: boolean;
    hasResult?: boolean;
    /* Optional weighted result to render attractor landscape in the sidebar */
    weightedResult?: DeterministicAnalysisResult | null;
  };
}

export type TabType =
  | 'projects'
  | 'rna-seq'
  | 'exome-seq'
  | 'network-inference'
  | 'network'
  | 'therapeutics'
  | 'env'
  | 'cell-circuits'
  | 'cell-lines'
  | 'simulation'
  | 'analysis'
  | 'results'
  | 'autonetcan';

export default function NetworkEditorLayout({
  children,
  activeTab,
  onTabChange,
  networkSidebar,
  inferenceSidebar,
  therapeuticsSidebar,
  seqAnalysisSidebar,
  disableAfterTherapeutics,
  inferenceActions,
}: NetworkEditorLayoutProps) {
  // Sidebar collapse state
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // ===== CACHED PROJECTS STATE (persists across tab switches) =====
  const [cachedProjects, setCachedProjects] = useState<SidebarProject[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(false);
  const [projectsError, setProjectsError] = useState<string | null>(null);
  const [projectsFetched, setProjectsFetched] = useState(false);

  // Fetch projects once and cache them
  useEffect(() => {
    // Only fetch if not already fetched
    if (projectsFetched) return;

    const controller = new AbortController();
    const signal = controller.signal;

    const fetchProjects = async () => {
      // Get current user
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id ?? null;
      const userEmail = userData.user?.email ?? null;

      if (!userId && !userEmail) return;
      if (signal.aborted) return;

      setProjectsLoading(true);
      setProjectsError(null);

      try {
        const selects = 'id, name, assignees, created_at, created_by, creator_email, networks';
        const [a, b, c] = await Promise.all([
          userId ? supabase.from('projects').select(selects).contains('assignees', [userId]).order('created_at', { ascending: false }) : Promise.resolve({ data: [], error: null } as { data: SidebarProject[]; error: null }),
          userId ? supabase.from('projects').select(selects).eq('created_by', userId).order('created_at', { ascending: false }) : Promise.resolve({ data: [], error: null } as { data: SidebarProject[]; error: null }),
          userEmail ? supabase.from('projects').select(selects).eq('creator_email', userEmail).order('created_at', { ascending: false }) : Promise.resolve({ data: [], error: null } as { data: SidebarProject[]; error: null }),
        ]);

        if (signal.aborted) return;

        if (a.error) throw a.error;
        if (b.error) throw b.error;
        if (c.error) throw c.error;

        const mergedMap = new Map<string, SidebarProject>();
        for (const row of ([...(a.data || []), ...(b.data || []), ...(c.data || [])] as SidebarProject[])) {
          if (row?.id) mergedMap.set(row.id, row);
        }
        const merged = Array.from(mergedMap.values()).sort((x, y) => (y.created_at || '').localeCompare(x.created_at || ''));

        if (!signal.aborted) {
          setCachedProjects(merged);
          setProjectsFetched(true);
        }
      } catch (e) {
        if (!signal.aborted) {
          const errorMessage = e instanceof Error ? e.message : 'Failed to load projects';
          setProjectsError(errorMessage);
          setCachedProjects([]);
        }
      } finally {
        if (!signal.aborted) {
          setProjectsLoading(false);
        }
      }
    };

    fetchProjects();
    return () => controller.abort();
  }, [projectsFetched]);

  // Separate enabled and disabled tabs
  const enabledTabs = [
    { id: 'projects' as TabType, label: 'Projects', icon: Folder, color: 'text-blue-600' },
    { id: 'exome-seq' as TabType, label: 'Exome-seq', icon: Dna, color: 'text-sky-600' },
    { id: 'rna-seq' as TabType, label: 'RNA-seq', icon: Dna, color: 'text-sky-600' },
    { id: 'network' as TabType, label: 'Network Editor', icon: Network, color: 'text-green-600' },
    { id: 'autonetcan' as TabType, label: 'AutoNetCan', icon: Cpu, color: 'text-teal-600' },
    { id: 'network-inference' as TabType, label: 'Network Analysis', icon: Waypoints, color: 'text-purple-600' },
    { id: 'therapeutics' as TabType, label: 'Therapeutics', icon: Pill, color: 'text-red-600' },
    // Previously hidden/future tabs — re-enabled
    { id: 'env' as TabType, label: 'Environment', icon: Container, color: 'text-amber-600' },
    { id: 'cell-circuits' as TabType, label: 'Cell Circuits', icon: Pill, color: 'text-indigo-600' },
    { id: 'cell-lines' as TabType, label: 'Cell Lines', icon: Users, color: 'text-emerald-600' },
    { id: 'simulation' as TabType, label: 'Simulation', icon: Play, color: 'text-orange-600' },
    { id: 'analysis' as TabType, label: 'Analysis', icon: BarChart3, color: 'text-sky-600' },
    { id: 'results' as TabType, label: 'Results', icon: FileText, color: 'text-violet-600' },
  ];

  // Optionally disable tabs that come after 'therapeutics' when viewing a project
  const allTabs = React.useMemo(() => {
    if (!disableAfterTherapeutics) return enabledTabs;
    const idx = enabledTabs.findIndex(t => t.id === 'therapeutics');
    if (idx < 0) return enabledTabs;
    return enabledTabs.map((t, i) => (i > idx ? { ...t, disabled: true } : t));
  }, [disableAfterTherapeutics, enabledTabs]);

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Enhanced Header with improved navigation */}
      <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        {/* Enhanced Tab Navigation - Showing all tabs, with future tabs disabled */}
        <div className="px-3 flex items-center">
          {/* Sidebar Toggle Button - at the start of the header for easy access */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="h-8 w-8 mr-2 flex-shrink-0 hover:bg-accent transition-colors"
            title={sidebarCollapsed ? "Show sidebar" : "Hide sidebar"}
          >
            {sidebarCollapsed ? <PanelLeft className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
          </Button>
          <Tabs value={activeTab} onValueChange={(value) => onTabChange(value as TabType)} className="w-full">
            <TabsList className="w-full justify-start bg-transparent p-0 gap-0 border-b h-auto">
              {allTabs.map((tab) => {
                const IconComponent = tab.icon;
                const isDisabled = 'disabled' in tab && tab.disabled === true;
                return (
                  <TabsTrigger
                    key={tab.id}
                    value={tab.id}
                    disabled={isDisabled}
                    className={cn(
                      "px-3 py-2 h-10 relative group text-xs",
                      "data-[state=active]:text-foreground data-[state=active]:font-semibold",
                      "data-[state=active]:border-b-2 data-[state=active]:border-b-primary",
                      "transition-all duration-200 hover:text-foreground/80",
                      "rounded-none border-b-2 border-b-transparent",
                      "flex items-center gap-2",
                      isDisabled ? "opacity-40 cursor-not-allowed hover:text-muted-foreground" : ""
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <IconComponent className={cn("w-3 h-3 transition-colors", isDisabled ? "text-muted-foreground" : tab.color)} />
                      <span className="text-xs font-medium tracking-tight">
                        {tab.label}
                      </span>
                    </div>
                  </TabsTrigger>
                );
              })}
            </TabsList>
          </Tabs>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Enhanced Sidebar */}
        <div className={cn(
          "border-r bg-background flex flex-col transition-all duration-300",
          sidebarCollapsed ? "w-0" : "w-80"
        )}>
          {!sidebarCollapsed && (
            <div className="flex-1 overflow-y-auto overflow-x-hidden">
              <div className="p-4">
                {renderTabContent(
                  activeTab,
                  networkSidebar,
                  inferenceSidebar,
                  therapeuticsSidebar,
                  seqAnalysisSidebar,
                  inferenceActions,
                  { projects: cachedProjects, isLoading: projectsLoading, error: projectsError }
                )}
              </div>
            </div>
          )}
        </div>

        {/* Main Workspace */}
        <div className="flex-1 min-h-0 flex flex-col overflow-hidden bg-gradient-to-br from-background to-muted/5 relative">
          <div className="absolute inset-0 bg-gradient-to-br from-background via-background to-muted/5 pointer-events-none" />
          <div className="relative flex-1 min-h-0 flex flex-col overflow-auto">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

function renderTabContent(
  activeTab: TabType,
  networkSidebar?: React.ReactNode,
  inferenceSidebar?: React.ReactNode,
  therapeuticsSidebar?: React.ReactNode,
  seqAnalysisSidebar?: React.ReactNode,
  inferenceActions?: NetworkEditorLayoutProps['inferenceActions'],
  projectsData?: { projects: SidebarProject[]; isLoading: boolean; error: string | null }
) {
  switch (activeTab) {
    case 'projects':
      return <ProjectsSidebar 
        projects={projectsData?.projects ?? []} 
        isLoading={projectsData?.isLoading ?? false} 
        error={projectsData?.error ?? null} 
      />;
    case 'network':
      return networkSidebar ?? <NetworkSidebar />;
    case 'network-inference':
      return inferenceSidebar ?? <NetworkAnalysisSidebar actions={inferenceActions} />;
    case 'therapeutics':
      return therapeuticsSidebar ?? <TherapeuticsSidebar />;
    case 'env':
      return <EnvironmentSidebar />;
    case 'cell-circuits':
      return <CellCircuitsSidebar />;
    case 'cell-lines':
      return <CellLinesSidebar />;
    case 'simulation':
      return <SimulationSidebar />;
    case 'analysis':
      return <AnalysisSidebar />;
    case 'results':
      return <ResultsSidebar />;
    case 'autonetcan':
      return <AutoNetCanSidebar />;
    case 'rna-seq':
    case 'exome-seq':
      return seqAnalysisSidebar ?? <SeqAnalysisSidebar />;
    default:
      return <ProjectsSidebar 
        projects={projectsData?.projects ?? []} 
        isLoading={projectsData?.isLoading ?? false} 
        error={projectsData?.error ?? null} 
      />;
  }
}

// Enhanced Project Tab Sidebar
type SidebarProject = {
  id: string;
  name?: string | null;
  assignees?: string[] | null;
  created_at?: string | null;
  created_by?: string | null;
  creator_email?: string | null;
  networks?: string[] | null;
};

interface ProjectsSidebarProps {
  projects: SidebarProject[];
  isLoading: boolean;
  error: string | null;
}

function ProjectsSidebar({ projects, isLoading, error }: ProjectsSidebarProps) {
  const { isLoading: rolesLoading } = useRole();

  // Using shared formatDate from @/lib/format
  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Folder className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-bold tracking-tight text-foreground">
                My Projects
              </h2>
              <p className="text-xs text-muted-foreground">
                {isLoading ? 'Loading...' : `${projects.length} ${projects.length === 1 ? 'project' : 'projects'}`}
              </p>
            </div>
          </div>
        </div>
      </div>

      <Separator className="bg-border/50" />

      {/* Project List */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Recent Projects
          </p>
          {!isLoading && projects.length > 0 && (
            <Badge variant="secondary" className="px-2 py-0.5 text-xs font-medium">
              {projects.length}
            </Badge>
          )}
        </div>

        {isLoading || rolesLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="p-3 rounded-lg border bg-card space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <div className="flex gap-2">
                  <Skeleton className="h-3 w-16" />
                  <Skeleton className="h-3 w-20" />
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="p-4 rounded-lg border border-destructive/20 bg-destructive/5">
            <p className="text-xs text-destructive">{error}</p>
          </div>
        ) : projects.length === 0 ? (
          <div className="p-6 rounded-lg border border-dashed border-muted-foreground/30 bg-muted/20 text-center space-y-2">
            <Folder className="w-8 h-8 mx-auto text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground font-medium">No projects yet</p>
            <p className="text-xs text-muted-foreground">Create your first project to get started</p>
          </div>
        ) : (
          <div className="space-y-2">
            {projects.map((project) => (
              <Card
                key={project.id}
                className="p-3 hover:bg-accent/50 cursor-pointer transition-all duration-200 hover:shadow-md border hover:border-primary/30 group relative overflow-hidden"
              >
                {/* Hover gradient effect */}
                <div className="absolute inset-0 bg-gradient-to-br from-primary/0 via-primary/0 to-primary/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
                
                <div className="relative space-y-2">
                  {/* Project Name */}
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-semibold text-sm truncate group-hover:text-primary transition-colors flex-1">
                      {project.name || 'Untitled Project'}
                    </h3>
                    <Badge variant="outline" className="shrink-0 text-xs font-medium px-1.5 py-0.5 border-primary/20 bg-primary/5 text-primary">
                      <Users className="w-2.5 h-2.5 mr-1" />
                      {(project.assignees || []).length}
                    </Badge>
                  </div>
                  
                  {/* Metadata */}
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Network className="w-3 h-3" />
                      {Array.isArray(project.networks) ? project.networks.length : 0}
                    </span>
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {formatDate(project.created_at)}
                    </span>
                  </div>
                  
                  {/* Owner */}
                  {project.creator_email && (
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <User className="w-3 h-3" />
                      <span className="truncate">{project.creator_email}</span>
                    </div>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// Enhanced Network Tab Sidebar
function NetworkSidebar() {
  const [autoLayout, setAutoLayout] = useState(true);
  const [showLabels, setShowLabels] = useState(true);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-green-500/10">
          <Network className="w-5 h-5 text-green-600" />
        </div>
        <div>
          <h2 className="text-sm font-semibold tracking-tight text-foreground">Network Editor</h2>
          <p className="text-xs text-muted-foreground">Build &amp; manage networks</p>
        </div>
      </div>

      <Separator className="bg-border/50" />

      {/* Display Settings */}
      <div className="space-y-1.5">
        <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider px-1">Display</p>
        <div className="space-y-3 px-1">
          <div className="flex items-center justify-between">
            <Label htmlFor="auto-layout" className="text-xs">Auto Layout</Label>
            <Switch
              id="auto-layout"
              checked={autoLayout}
              onCheckedChange={setAutoLayout}
            />
          </div>
          <div className="flex items-center justify-between">
            <Label htmlFor="show-labels" className="text-xs">Show Labels</Label>
            <Switch
              id="show-labels"
              checked={showLabels}
              onCheckedChange={setShowLabels}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// Enhanced Network Analysis Sidebar
function NetworkAnalysisSidebar({ actions }: { actions?: NetworkEditorLayoutProps['inferenceActions'] }) {
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-purple-500/10">
          <Waypoints className="w-5 h-5 text-purple-600" />
        </div>
        <div>
          <h2 className="text-sm font-semibold tracking-tight text-foreground">Network Analysis</h2>
          <p className="text-xs text-muted-foreground">Inference &amp; simulation</p>
        </div>
      </div>

      <Separator className="bg-border/50" />

      {/* Deterministic Analysis */}
      <div className="space-y-1.5">
        <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider px-1">Deterministic</p>
        <div className="flex gap-1.5">
          <Button
            className="h-8 text-xs px-3 gap-1.5"
            onClick={() => actions?.run?.()}
            disabled={Boolean(actions?.isRunning) || !Boolean(actions?.isRuleBased)}
            variant={actions?.isRuleBased ? "default" : "outline"}
            title={!actions?.isRuleBased ? 'Rule-based networks only' : 'Run rule-based analysis'}
            size="sm"
          >
            <FileText className="w-3 h-3" />
            Rule-based
          </Button>
          <Button
            className="h-8 text-xs px-3 gap-1.5"
            onClick={() => {
              if (actions?.isRuleBased) return;
              actions?.runWeighted?.();
            }}
            disabled={actions?.isWeightedRunning || actions?.isRuleBased}
            variant={!actions?.isRuleBased ? "default" : "outline"}
            title={actions?.isRuleBased ? 'Weight-based networks only' : 'Run weighted analysis'}
            size="sm"
          >
            <BarChart3 className="w-3 h-3" />
            Weighted
          </Button>
        </div>
      </div>

      {/* Probabilistic Analysis */}
      <div className="space-y-1.5">
        <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider px-1">Probabilistic</p>
        <Button
          className="h-8 text-xs px-3 gap-1.5"
          onClick={() => actions?.runProbabilistic?.()}
          disabled={Boolean(actions?.isProbabilisticRunning)}
          variant="secondary"
          size="sm"
        >
          <Play className="w-3 h-3" />
          Run Analysis
        </Button>
      </div>

      {/* ODE */}
      <div className="space-y-1.5">
        <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider px-1">ODE</p>
        <Button
          className="h-8 text-xs px-3 gap-1.5"
          variant="outline"
          disabled
          size="sm"
        >
          Coming Soon
        </Button>
      </div>

      <Separator className="bg-border/50" />

      {/* Download Results */}
      <div>
        <Button
          variant="outline"
          className="h-8 text-xs px-3 gap-1.5 w-full"
          onClick={() => actions?.download?.()}
          disabled={!actions?.hasResult}
        >
          <Download className="w-3 h-3" />
          Download
        </Button>
      </div>
    </div>
  );
}

// Default Therapeutics Sidebar (when no custom sidebar is passed)
function TherapeuticsSidebar() {
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-red-500/10">
          <Pill className="w-5 h-5 text-red-600" />
        </div>
        <div>
          <h2 className="text-sm font-semibold tracking-tight text-foreground">Therapeutics</h2>
          <p className="text-xs text-muted-foreground">Configure interventions</p>
        </div>
      </div>

      <Separator className="bg-border/50" />

      <div className="rounded-lg border border-dashed border-muted-foreground/30 p-4 text-center space-y-1.5">
        <Pill className="w-6 h-6 mx-auto text-muted-foreground/40" />
        <p className="text-xs text-muted-foreground">Select a network first</p>
      </div>
    </div>
  );
}

// Enhanced Environment Sidebar
function EnvironmentSidebar() {
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-amber-500/10">
          <Container className="w-5 h-5 text-amber-600" />
        </div>
        <div>
          <h2 className="text-sm font-semibold tracking-tight text-foreground">Environment</h2>
          <p className="text-xs text-muted-foreground">Conditions &amp; presets</p>
        </div>
      </div>

      <Separator className="bg-border/50" />

      <div className="space-y-1.5">
        <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider px-1">Controls</p>
        <Button className="w-full h-8 text-xs gap-1.5">
          <Container className="w-3.5 h-3.5" />
          Apply Preset
        </Button>
        <Button variant="outline" className="w-full h-8 text-xs gap-1.5">
          <Upload className="w-3.5 h-3.5" />
          Import Conditions
        </Button>
      </div>
    </div>
  );
}

// Seq Data Analysis Sidebar
function SeqAnalysisSidebar() {
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-sky-500/10">
          <Dna className="w-5 h-5 text-sky-600" />
        </div>
        <div>
          <h2 className="text-sm font-semibold tracking-tight text-foreground">Seq Analysis</h2>
          <p className="text-xs text-muted-foreground">Sequencing data processing</p>
        </div>
      </div>

      <Separator className="bg-border/50" />

      {/* Requirements */}
      <div className="space-y-1.5">
        <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider px-1">Required Files</p>
        <div className="space-y-1.5 text-xs px-1">
          <div className="flex items-start gap-2">
            <span className="font-medium text-sky-600 shrink-0">R1:</span>
            <span className="text-muted-foreground">Forward reads (.fastq.gz)</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="font-medium text-sky-600 shrink-0">R2:</span>
            <span className="text-muted-foreground">Reverse reads (.fastq.gz)</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="font-medium text-sky-600 shrink-0">Ref:</span>
            <span className="text-muted-foreground">Reference genome (.fa.gz)</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="font-medium text-sky-600 shrink-0">Ann:</span>
            <span className="text-muted-foreground">Gene annotation (.gff3.gz)</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// New specialized sidebars
function CellCircuitsSidebar() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-indigo-500/10">
          <Pill className="w-5 h-5 text-indigo-600" />
        </div>
        <div>
          <h2 className="text-sm font-semibold tracking-tight text-foreground">Cell Circuits</h2>
          <p className="text-xs text-muted-foreground">Genetic circuit design</p>
        </div>
      </div>
      <Separator className="bg-border/50" />
    </div>
  );
}

function CellLinesSidebar() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-emerald-500/10">
          <Users className="w-5 h-5 text-emerald-600" />
        </div>
        <div>
          <h2 className="text-sm font-semibold tracking-tight text-foreground">Cell Lines</h2>
          <p className="text-xs text-muted-foreground">Cell line data management</p>
        </div>
      </div>
      <Separator className="bg-border/50" />
    </div>
  );
}

function SimulationSidebar() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-orange-500/10">
          <Play className="w-5 h-5 text-orange-600" />
        </div>
        <div>
          <h2 className="text-sm font-semibold tracking-tight text-foreground">Simulation</h2>
          <p className="text-xs text-muted-foreground">Network simulations</p>
        </div>
      </div>
      <Separator className="bg-border/50" />
    </div>
  );
}

// AutoNetCan Integration Sidebar
function AutoNetCanSidebar() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-teal-500/10">
          <Cpu className="w-5 h-5 text-teal-600" />
        </div>
        <div>
          <h2 className="text-sm font-semibold tracking-tight text-foreground">AutoNetCan</h2>
          <p className="text-xs text-muted-foreground">Automated network construction</p>
        </div>
      </div>

      <Separator className="bg-border/50" />

      <div className="space-y-1.5">
        <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider px-1">Quick Actions</p>
        <Button
          variant="outline"
          className="w-full h-8 text-xs gap-1.5"
          onClick={() => window.open('https://autonetcan.lums.edu.pk/createNetwork', '_blank')}
        >
          <Upload className="w-3.5 h-3.5" />
          Open in New Tab
        </Button>
        <Button
          variant="outline"
          className="w-full h-8 text-xs gap-1.5"
          onClick={() => window.open('https://autonetcan.lums.edu.pk/manual/AutoNetCan%20User%20Manual%20-%20v4.pdf', '_blank')}
        >
          <Download className="w-3.5 h-3.5" />
          Download User Manual
        </Button>
      </div>
    </div>
  );
}

// Enhanced Analysis Sidebar
function AnalysisSidebar() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-sky-500/10">
          <BarChart3 className="w-5 h-5 text-sky-600" />
        </div>
        <div>
          <h2 className="text-sm font-semibold tracking-tight text-foreground">Analysis</h2>
          <p className="text-xs text-muted-foreground">Network metrics &amp; insights</p>
        </div>
      </div>

      <Separator className="bg-border/50" />

      <div className="space-y-1.5">
        <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider px-1">Tools</p>
        <Button className="w-full h-8 text-xs gap-1.5">
          <Play className="w-3.5 h-3.5" />
          Run Analysis
        </Button>
        <Button variant="outline" className="w-full h-8 text-xs gap-1.5">
          <BarChart3 className="w-3.5 h-3.5" />
          View Metrics
        </Button>
      </div>
    </div>
  );
}

// Enhanced Results Sidebar
function ResultsSidebar() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-violet-500/10">
          <FileText className="w-5 h-5 text-violet-600" />
        </div>
        <div>
          <h2 className="text-sm font-semibold tracking-tight text-foreground">Results</h2>
          <p className="text-xs text-muted-foreground">Export &amp; visualize</p>
        </div>
      </div>

      <Separator className="bg-border/50" />

      <div className="space-y-1.5">
        <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider px-1">Export</p>
        <Button className="w-full h-8 text-xs gap-1.5">
          <Download className="w-3.5 h-3.5" />
          Export Data
        </Button>
        <Button variant="outline" className="w-full h-8 text-xs gap-1.5">
          <FileText className="w-3.5 h-3.5" />
          Generate Report
        </Button>
      </div>
    </div>
  );
}