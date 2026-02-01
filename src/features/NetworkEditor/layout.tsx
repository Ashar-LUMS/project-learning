import React, { useCallback, useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { formatDate } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
  CircuitBoard,
  LineSquiggle,
  Cpu,
  LineChart,
  Upload,
  Download,
  Play,
  BarChart3,
  Calendar,
  Users,
  User,
  PanelLeftClose,
  PanelLeft,
  ChevronDown,
  Save,
  FileText
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
  weightedResult?: DeterministicAnalysisResult | null;
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
  | 'seq-data-analysis'
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
  weightedResult,
  inferenceActions,
}: NetworkEditorLayoutProps) {
  // EARLY DEBUG: Check what we received
  console.log('[NetworkEditorLayout] RECEIVED inferenceActions on props:', {
    keys: Object.keys(inferenceActions || {}),
    hasRunProbabilistic: 'runProbabilistic' in (inferenceActions || {}),
    hasIsProbabilisticRunning: 'isProbabilisticRunning' in (inferenceActions || {}),
  });

  // WORKAROUND: If runProbabilistic is missing, add it
  if (inferenceActions && !inferenceActions.runProbabilistic) {
    console.log('[NetworkEditorLayout] WARNING: runProbabilistic is missing! Adding stub.');
    inferenceActions.runProbabilistic = () => console.log('[NetworkEditorLayout] runProbabilistic stub called - this should not happen!');
  }
  if (inferenceActions && inferenceActions.isProbabilisticRunning === undefined) {
    console.log('[NetworkEditorLayout] WARNING: isProbabilisticRunning is missing! Adding false.');
    inferenceActions.isProbabilisticRunning = false;
  }

  // Debug: log inference actions when weighted result changes
  useEffect(() => {
    if (!inferenceActions) return;
    // eslint-disable-next-line no-console
    console.log('[NetworkEditorLayout] actions update', {
      hasWeightedResult: !!inferenceActions.weightedResult,
      attractorCount: inferenceActions.weightedResult?.attractors?.length ?? 0,
    });
  }, [inferenceActions?.weightedResult]);

  // Debug: log weightedResult prop
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.log('[NetworkEditorLayout] weightedResult prop', {
      hasWeightedResultProp: !!weightedResult,
      attractorCount: weightedResult?.attractors?.length ?? 0,
    });
  }, [weightedResult]);

  // Sidebar collapse state
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Separate enabled and disabled tabs
  const enabledTabs = [
    { id: 'projects' as TabType, label: 'Projects', icon: Folder, color: 'text-blue-600' },
    { id: 'seq-data-analysis' as TabType, label: 'Seq Analysis', icon: BarChart3, color: 'text-sky-600' },
    { id: 'network' as TabType, label: 'Manual Network Construction', icon: Network, color: 'text-green-600' },
    { id: 'autonetcan' as TabType, label: 'AutoNetCan', icon: Cpu, color: 'text-teal-600' },
    { id: 'network-inference' as TabType, label: 'Network Analysis', icon: Waypoints, color: 'text-purple-600' },
    { id: 'therapeutics' as TabType, label: 'Therapeutics', icon: Pill, color: 'text-red-600' },
  ];

  // Future tabs (kept for reference but not displayed in main nav)
  const _futureTabs = [
    { id: 'env' as TabType, label: 'Environment', icon: Container, color: 'text-amber-600', disabled: true },
    { id: 'cell-circuits' as TabType, label: 'Circuits', icon: CircuitBoard, color: 'text-indigo-600', disabled: true },
    { id: 'cell-lines' as TabType, label: 'Cell Lines', icon: LineSquiggle, color: 'text-pink-600', disabled: true },
    { id: 'simulation' as TabType, label: 'Simulation', icon: Cpu, color: 'text-cyan-600', disabled: true },
    { id: 'analysis' as TabType, label: 'Analysis', icon: LineChart, color: 'text-orange-600', disabled: true },
    { id: 'results' as TabType, label: 'Results', icon: Download, color: 'text-emerald-600', disabled: true },
  ];

  // Combined for sidebar rendering (maintains backward compatibility)
  const _tabs = [...enabledTabs, ..._futureTabs];
  void _tabs; // Preserve for future use

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Enhanced Header with improved navigation */}
      <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        {/* Enhanced Tab Navigation - Only showing enabled tabs */}
        <div className="px-3">
          <Tabs value={activeTab} onValueChange={(value) => onTabChange(value as TabType)} className="w-full">
            <TabsList className="w-full justify-start bg-transparent p-0 gap-0 border-b h-auto">
              {enabledTabs.map((tab) => {
                const IconComponent = tab.icon;
                return (
                  <TabsTrigger
                    key={tab.id}
                    value={tab.id}
                    className={cn(
                      "px-3 py-2 h-10 relative group text-xs",
                      "data-[state=active]:text-foreground data-[state=active]:font-semibold",
                      "data-[state=active]:border-b-2 data-[state=active]:border-b-primary",
                      "transition-all duration-200 hover:text-foreground/80",
                      "rounded-none border-b-2 border-b-transparent",
                      "flex items-center gap-2"
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <IconComponent className={cn("w-3 h-3 transition-colors", tab.color)} />
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
      <div className="flex flex-1 overflow-hidden">
        {/* Enhanced Sidebar */}
        <div className={cn(
          "border-r bg-background flex flex-col transition-all duration-300",
          sidebarCollapsed ? "w-0" : "w-80"
        )}>
          {!sidebarCollapsed && (
            <div className="flex-1 overflow-y-auto overflow-x-hidden">
              <div className="p-4">
                {renderTabContent(activeTab, networkSidebar, inferenceSidebar, therapeuticsSidebar, inferenceActions)}
              </div>
            </div>
          )}
        </div>

        {/* Main Workspace */}
        <div className="flex-1 overflow-auto bg-gradient-to-br from-background to-muted/5 relative">
          <div className="absolute inset-0 bg-gradient-to-br from-background via-background to-muted/5" />
          <div className="relative">
            {children}
          </div>
          {/* Sidebar Toggle Button - rendered after children so it's on top */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="fixed bottom-4 left-4 z-[100] h-6 w-6 bg-background/95 backdrop-blur-sm border-2 shadow-lg hover:bg-background hover:scale-110 transition-transform"
            title={sidebarCollapsed ? "Show sidebar" : "Hide sidebar"}
          >
            {sidebarCollapsed ? <PanelLeft className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
          </Button>
        </div>
      </div>
    </div>
  );
}

function renderTabContent(activeTab: TabType, networkSidebar?: React.ReactNode, inferenceSidebar?: React.ReactNode, therapeuticsSidebar?: React.ReactNode, inferenceActions?: NetworkEditorLayoutProps['inferenceActions']) {
  switch (activeTab) {
    case 'projects':
      return <ProjectsSidebar />;
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
    case 'seq-data-analysis':
      return <SeqAnalysisSidebar />;
    default:
      return <ProjectsSidebar />;
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

function ProjectsSidebar() {
  const { isLoading: rolesLoading } = useRole();
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null);
  const [projects, setProjects] = useState<SidebarProject[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      setCurrentUserId(data.user?.id ?? null);
      setCurrentUserEmail(data.user?.email ?? null);
    })();
  }, []);

  const fetchProjects = useCallback(async (signal?: AbortSignal) => {
    // 'All' = assigned to me OR created by me. Requires current user id (and optional email fallback)
    if (!currentUserId && !currentUserEmail) return;
    if (signal?.aborted) return;
    
    setIsLoading(true); setError(null);
    try {
      const selects = 'id, name, assignees, created_at, created_by, creator_email, networks';
      const [a, b, c] = await Promise.all([
        currentUserId ? supabase.from('projects').select(selects).contains('assignees', [currentUserId]).order('created_at', { ascending: false }) : Promise.resolve({ data: [], error: null } as any),
        currentUserId ? supabase.from('projects').select(selects).eq('created_by', currentUserId).order('created_at', { ascending: false }) : Promise.resolve({ data: [], error: null } as any),
        currentUserEmail ? supabase.from('projects').select(selects).eq('creator_email', currentUserEmail).order('created_at', { ascending: false }) : Promise.resolve({ data: [], error: null } as any),
      ]);
      
      if (signal?.aborted) return;
      
      if (a.error) throw a.error;
      if (b.error) throw b.error;
      if (c.error) throw c.error;
      
      const mergedMap = new Map<string, SidebarProject>();
      for (const row of ([...(a.data || []), ...(b.data || []), ...(c.data || [])] as SidebarProject[])) {
        if (row?.id) mergedMap.set(row.id, row);
      }
      const merged = Array.from(mergedMap.values()).sort((x, y) => (y.created_at || '').localeCompare(x.created_at || ''));
      
      if (!signal?.aborted) {
        setProjects(merged);
      }
    } catch (e) {
      if (!signal?.aborted) {
        const errorMessage = e instanceof Error ? e.message : 'Failed to load projects';
        setError(errorMessage);
        setProjects([]);
      }
    } finally {
      if (!signal?.aborted) {
        setIsLoading(false);
      }
    }
  }, [currentUserId, currentUserEmail]);

  useEffect(() => {
    const controller = new AbortController();
    fetchProjects(controller.signal);
    return () => controller.abort();
  }, [fetchProjects]);

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
            <Badge variant="secondary" className="px-2 py-0.5 text-[10px] font-medium">
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
                    <Badge variant="outline" className="shrink-0 text-[10px] font-medium px-1.5 py-0.5 border-primary/20 bg-primary/5 text-primary">
                      <Users className="w-2.5 h-2.5 mr-1" />
                      {(project.assignees || []).length}
                    </Badge>
                  </div>
                  
                  {/* Metadata */}
                  <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
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
                    <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
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
    <div className="space-y-6">
      <div className="space-y-3">
        <h2 className="text-2xl font-bold tracking-tight text-foreground">
          Network Tools
        </h2>
        <p className="text-sm text-muted-foreground">
          Manage and analyze your network structures
        </p>
      </div>

      <Separator />

      {/* Quick Actions */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Quick Actions</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="space-y-1">
            <Button variant="ghost" className="w-full justify-start gap-3 h-11 px-4">
              <Save className="w-4 h-4" />
              Save Network
            </Button>
            <Button variant="ghost" className="w-full justify-start gap-3 h-11 px-4">
              <Upload className="w-4 h-4" />
              Import Data
            </Button>
            <Button variant="ghost" className="w-full justify-start gap-3 h-11 px-4">
              <Download className="w-4 h-4" />
              Export Network
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Display Settings */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Display Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="auto-layout" className="text-sm">Auto Layout</Label>
            <Switch
              id="auto-layout"
              checked={autoLayout}
              onCheckedChange={setAutoLayout}
            />
          </div>
          <div className="flex items-center justify-between">
            <Label htmlFor="show-labels" className="text-sm">Show Labels</Label>
            <Switch
              id="show-labels"
              checked={showLabels}
              onCheckedChange={setShowLabels}
            />
          </div>
        </CardContent>
      </Card>

      {/* Network Statistics */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Network Stats</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Nodes</span>
            <span className="font-medium">24</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Edges</span>
            <span className="font-medium">48</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Density</span>
            <span className="font-medium">0.083</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Enhanced Network Analysis Sidebar
function NetworkAnalysisSidebar({ actions }: { actions?: NetworkEditorLayoutProps['inferenceActions'] }) {
  const [expandedSections, setExpandedSections] = React.useState<Set<string>>(new Set(['deterministic', 'probabilistic']));

  const toggleSection = (section: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(section)) {
      newExpanded.delete(section);
    } else {
      newExpanded.add(section);
    }
    setExpandedSections(newExpanded);
  };

  return (
    <div className="flex flex-col h-full gap-2">
      {/* Header */}
      <div className="flex-shrink-0">
        <h2 className="text-lg font-bold tracking-tight text-foreground">Network Inference</h2>
      </div>

      {/* Analysis Sections */}
      <div className="flex-1 space-y-1 overflow-y-auto">
        {/* Deterministic Analysis Section */}
        <Card className="border-0 bg-card/50">
          <div
            className="px-3 py-2 cursor-pointer hover:bg-accent/30 transition-colors flex items-center justify-between rounded-md"
            onClick={() => toggleSection('deterministic')}
          >
            <CardTitle className="text-xs font-semibold">Deterministic Analysis</CardTitle>
            <ChevronDown
              className={`w-3 h-3 transition-transform ${expandedSections.has('deterministic') ? 'rotate-180' : ''}`}
            />
          </div>
          {expandedSections.has('deterministic') && (
            <CardContent className="p-0 pt-1">
              <div className="space-y-1 px-3 pb-2">
                {/* Rule-based */}
                <div>
                  <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1">Rule-based</p>
                  <Button
                    className="w-full justify-start gap-2 h-8 px-2 text-xs"
                    onClick={() => actions?.run?.()}
                    disabled={Boolean(actions?.isRunning) || !Boolean(actions?.isRuleBased)}
                    variant="secondary"
                    title={!actions?.isRuleBased ? 'Rule-based deterministic analysis only' : undefined}
                    size="sm"
                  >
                    <Play className="w-3 h-3" />
                    Run Rule-based
                  </Button>
                </div>

                {/* Weight-based */}
                <div className="pt-1 border-t border-border/40">
                  <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1 pt-1">Weight-based</p>
                  <Button
                    className="w-full justify-start gap-2 h-8 px-2 text-xs"
                    onClick={() => {
                      console.log('[NetworkAnalysisSidebar] Weighted DA button clicked', {
                        hasRunWeighted: !!actions?.runWeighted,
                        isWeightedRunning: actions?.isWeightedRunning,
                        isRuleBased: actions?.isRuleBased,
                        actions
                      });
                      if (actions?.isRuleBased) return;
                      actions?.runWeighted?.();
                    }}
                    disabled={actions?.isWeightedRunning || actions?.isRuleBased}
                    variant="secondary"
                    title={actions?.isRuleBased ? 'Weighted analysis disabled for rule-based networks' : undefined}
                    size="sm"
                  >
                    <Play className="w-3 h-3" />
                    Run Weighted
                  </Button>
                </div>
              </div>
            </CardContent>
          )}
        </Card>

        {/* Probabilistic Analysis Section */}
        <Card className="border-0 bg-card/50">
          <div
            className="px-3 py-2 cursor-pointer hover:bg-accent/30 transition-colors flex items-center justify-between rounded-md"
            onClick={() => toggleSection('probabilistic')}
          >
            <CardTitle className="text-xs font-semibold">Probabilistic Analysis</CardTitle>
            <ChevronDown
              className={`w-3 h-3 transition-transform ${expandedSections.has('probabilistic') ? 'rotate-180' : ''}`}
            />
          </div>
          {expandedSections.has('probabilistic') && (
            <CardContent className="p-0 pt-1">
              <div className="space-y-1 px-3 pb-2">
                {/* Rules-based Network Analysis */}
                <div>
                  <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1">Rules-based Network</p>
                  <Button
                    className="w-full justify-start gap-2 h-8 px-2 text-xs"
                    onClick={() => {
                      if (!actions) {
                        console.error('[layout.tsx] actions is null/undefined!');
                        return;
                      }
                      console.log('[layout.tsx] === BUTTON CLICK DEBUG ===');
                      console.log('[layout.tsx] actions object keys:', Object.keys(actions));
                      console.log('[layout.tsx] Has runProbabilistic?', typeof actions.runProbabilistic);
                      console.log('[layout.tsx] Has isProbabilisticRunning?', typeof actions.isProbabilisticRunning);
                      console.log('[layout.tsx] Calling actions.runProbabilistic...');
                      actions?.runProbabilistic?.();
                    }}
                    disabled={Boolean(actions?.isProbabilisticRunning)}
                    variant="secondary"
                    size="sm"
                  >
                    <Play className="w-3 h-3" />
                    Run Probabilistic
                  </Button>
                </div>

                {/* Weight-based Network Analysis */}
                <div className="pt-1 border-t border-border/40">
                  <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1 pt-1">Weight-based Network</p>
                  <Button
                    className="w-full justify-start gap-2 h-8 px-2 text-xs"
                    variant="secondary"
                    disabled
                    title="Coming soon"
                    size="sm"
                  >
                    <Play className="w-3 h-3" />
                    Run Probabilistic
                  </Button>
                </div>
              </div>
            </CardContent>
          )}
        </Card>

        {/* ODE Section */}
        <Card className="border-0 bg-card/50">
          <div
            className="px-3 py-2 cursor-pointer hover:bg-accent/30 transition-colors flex items-center justify-between rounded-md"
            onClick={() => toggleSection('ode')}
          >
            <CardTitle className="text-xs font-semibold">ODE</CardTitle>
            <ChevronDown
              className={`w-3 h-3 transition-transform ${expandedSections.has('ode') ? 'rotate-180' : ''}`}
            />
          </div>
          {expandedSections.has('ode') && (
            <CardContent className="p-0 pt-1">
              <div className="space-y-1 px-3 pb-2">
                <Button
                  className="w-full justify-start gap-2 h-8 px-2 text-xs"
                  variant="secondary"
                  disabled
                  title="Coming soon"
                  size="sm"
                >
                  <Play className="w-3 h-3" />
                  Run ODE
                </Button>
              </div>
            </CardContent>
          )}
        </Card>
      </div>

      {/* Download Results Button */}
      <Button
        variant="outline"
        className="w-full justify-start gap-2 h-8 px-2 text-xs"
        onClick={() => actions?.download?.()}
        disabled={!actions?.hasResult}
      >
        <Download className="w-3 h-3" />
        Download Results
      </Button>
    </div>
  );
}

// Default Therapeutics Sidebar (when no custom sidebar is passed)
function TherapeuticsSidebar() {
  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <h2 className="text-2xl font-bold tracking-tight text-foreground">
          Therapeutics
        </h2>
        <p className="text-sm text-muted-foreground">
          Select a network to configure interventions
        </p>
      </div>
      <Separator />
    </div>
  );
}

// Enhanced Environment Sidebar
function EnvironmentSidebar() {
  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <h2 className="text-2xl font-bold tracking-tight text-foreground">
          Environment
        </h2>
        <p className="text-sm text-muted-foreground">
          Configure environment conditions and presets
        </p>
      </div>

      <Separator />

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Environment Controls</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button className="w-full gap-2">
            <Container className="w-4 h-4" />
            Apply Preset
          </Button>
          <Button variant="outline" className="w-full gap-2">
            <Upload className="w-4 h-4" />
            Import Conditions
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

// Seq Data Analysis Sidebar
function SeqAnalysisSidebar() {
  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-sky-500/10">
            <BarChart3 className="w-5 h-5 text-sky-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold tracking-tight text-foreground">
              Seq Analysis
            </h2>
            <p className="text-xs text-muted-foreground">
              RNA-seq data processing
            </p>
          </div>
        </div>
      </div>

      <Separator className="bg-border/50" />

      {/* Requirements */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Required Files</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="space-y-1.5 text-xs">
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
        </CardContent>
      </Card>

      
    </div>
  );
}

// New specialized sidebars
function CellCircuitsSidebar() {
  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <h2 className="text-2xl font-bold tracking-tight text-foreground">
          Cell Circuits
        </h2>
        <p className="text-sm text-muted-foreground">
          Design and analyze genetic circuits
        </p>
      </div>
      <Separator />
      {/* Add circuit-specific controls */}
    </div>
  );
}

function CellLinesSidebar() {
  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <h2 className="text-2xl font-bold tracking-tight text-foreground">
          Cell Lines
        </h2>
        <p className="text-sm text-muted-foreground">
          Manage and analyze cell line data
        </p>
      </div>
      <Separator />
      {/* Add cell line-specific controls */}
    </div>
  );
}

function SimulationSidebar() {
  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <h2 className="text-2xl font-bold tracking-tight text-foreground">
          Simulation
        </h2>
        <p className="text-sm text-muted-foreground">
          Configure and run network simulations
        </p>
      </div>
      <Separator />
      {/* Add simulation controls */}
    </div>
  );
}

// AutoNetCan Integration Sidebar
function AutoNetCanSidebar() {
  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <h2 className="text-2xl font-bold tracking-tight text-foreground">
          AutoNetCan
        </h2>
        <p className="text-sm text-muted-foreground">
          Automated Network Construction for Cancer Systems Biology
        </p>
      </div>

      <Separator />

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Quick Actions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button
            variant="outline"
            className="w-full gap-2"
            onClick={() => window.open('https://autonetcan.lums.edu.pk/createNetwork', '_blank')}
          >
            <Upload className="w-4 h-4" />
            Open in New Tab
          </Button>
          <Button
            variant="outline"
            className="w-full gap-2"
            onClick={() => window.open('https://autonetcan.lums.edu.pk/manual/AutoNetCan%20User%20Manual%20-%20v4.pdf', '_blank')}
          >
            <Download className="w-4 h-4" />
            Download User Manual
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

// Enhanced Analysis Sidebar
function AnalysisSidebar() {
  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <h2 className="text-2xl font-bold tracking-tight text-foreground">
          Analysis
        </h2>
        <p className="text-sm text-muted-foreground">
          Advanced network analysis and metrics
        </p>
      </div>

      <Separator />

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Analysis Tools</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button className="w-full gap-2">
            <Play className="w-4 h-4" />
            Run Analysis
          </Button>
          <Button variant="outline" className="w-full gap-2">
            <BarChart3 className="w-4 h-4" />
            View Metrics
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

// Enhanced Results Sidebar
function ResultsSidebar() {
  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <h2 className="text-2xl font-bold tracking-tight text-foreground">
          Results
        </h2>
        <p className="text-sm text-muted-foreground">
          Export and visualize analysis results
        </p>
      </div>

      <Separator />

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Export Options</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button className="w-full gap-2">
            <Download className="w-4 h-4" />
            Export Data
          </Button>
          <Button variant="outline" className="w-full gap-2">
            <FileText className="w-4 h-4" />
            Generate Report
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}