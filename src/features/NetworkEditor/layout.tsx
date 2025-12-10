import React, { useCallback, useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
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
  Search,
  Settings,
  Upload,
  Download,
  Play,
  BarChart3,
  Database
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
//import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import AttractorGraph from './AttractorGraph';
import type { DeterministicAnalysisResult } from '@/lib/analysis/types';


interface NetworkEditorLayoutProps {
  children: React.ReactNode;
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
  networkSidebar?: React.ReactNode;
  inferenceSidebar?: React.ReactNode;
  weightedResult?: DeterministicAnalysisResult | null;
  inferenceActions?: {
    run?: () => void;
    runWeighted?: () => void;
    runProbabilistic?: () => void;
    download?: () => void;
    isRunning?: boolean;
    isWeightedRunning?: boolean;
    isProbabilisticRunning?: boolean;
    hasResult?: boolean;
    /* Optional weighted result to render attractor landscape in the sidebar */
    weightedResult?: DeterministicAnalysisResult | null;
  };
}

type TabType = 'projects' | 'network-inference' | 'network' | 'therapeutics' | 'env' | 'cell-circuits' | 'cell-lines' | 'simulation' | 'analysis' | 'results';

export default function NetworkEditorLayout({
  children,
  activeTab,
  onTabChange,
  networkSidebar,
  inferenceSidebar,
  weightedResult,
  inferenceActions,
}: NetworkEditorLayoutProps) {
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
  const tabs = [
    { id: 'projects' as TabType, label: 'Projects', icon: Folder, color: 'text-blue-600' },
    { id: 'network' as TabType, label: 'Network', icon: Network, color: 'text-green-600' },
    { id: 'network-inference' as TabType, label: 'Inference', icon: Waypoints, color: 'text-purple-600' },
    { id: 'therapeutics' as TabType, label: 'Therapeutics', icon: Pill, color: 'text-red-600' },
    { id: 'env' as TabType, label: 'Environment', icon: Container, color: 'text-amber-600' },
    { id: 'cell-circuits' as TabType, label: 'Circuits', icon: CircuitBoard, color: 'text-indigo-600' },
    { id: 'cell-lines' as TabType, label: 'Cell Lines', icon: LineSquiggle, color: 'text-pink-600' },
    { id: 'simulation' as TabType, label: 'Simulation', icon: Cpu, color: 'text-cyan-600' },
    { id: 'analysis' as TabType, label: 'Analysis', icon: LineChart, color: 'text-orange-600' },
  ];

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Enhanced Header with improved navigation */}
      <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="px-6">
          <div className="flex items-center justify-between py-3">
            <div className="flex items-center gap-4">
              <div className="relative w-64">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search projects, networks..."
                  className="pl-9 h-9 bg-muted/50 border-0 focus-visible:ring-1"
                />
              </div>
              <Button variant="outline" size="sm" className="h-9 gap-2">
                <Settings className="w-4 h-4" />
                Settings
              </Button>
            </div>
          </div>
        </div>

        {/* Enhanced Tab Navigation */}
        <div className="px-6">
          <Tabs value={activeTab} onValueChange={(value) => onTabChange(value as TabType)} className="w-full">
            <TabsList className="w-full justify-start h-12 bg-transparent p-0 gap-0 border-b">
              {tabs.map((tab) => {
                const IconComponent = tab.icon;
                return (
                  <TabsTrigger
                    key={tab.id}
                    value={tab.id}
                    className={cn(
                      "px-6 py-3 h-12 relative group",
                      "data-[state=active]:text-foreground data-[state=active]:font-semibold",
                      "data-[state=active]:border-b-2 data-[state=active]:border-b-primary",
                      "transition-all duration-200 hover:text-foreground/80",
                      "rounded-none border-b-2 border-b-transparent",
                      "flex items-center gap-3"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <IconComponent className={cn("w-4 h-4 transition-colors", tab.color)} />
                      <span className="text-sm font-medium tracking-wide">
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
        <div className="w-80 border-r bg-background overflow-hidden flex flex-col">
          <ScrollArea className="flex-1">
            <div className="p-6">
              {renderTabContent(activeTab, networkSidebar, inferenceSidebar, inferenceActions, weightedResult)}
            </div>
          </ScrollArea>
        </div>

        {/* Main Workspace */}
        <div className="flex-1 overflow-auto bg-gradient-to-br from-background to-muted/5 relative">
          <div className="absolute inset-0 bg-gradient-to-br from-background via-background to-muted/5" />
          <div className="relative">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

function renderTabContent(activeTab: TabType, networkSidebar?: React.ReactNode, inferenceSidebar?: React.ReactNode, inferenceActions?: NetworkEditorLayoutProps['inferenceActions'], weightedResult?: DeterministicAnalysisResult | null) {
  switch (activeTab) {
    case 'projects':
      return <ProjectsSidebar />;
    case 'network':
      return networkSidebar ?? <NetworkSidebar />;
    case 'network-inference':
      return inferenceSidebar ?? <NetworkAnalysisSidebar actions={inferenceActions} weightedResult={weightedResult} />;
    case 'therapeutics':
      return <TherapeuticsSidebar />;
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

  const fetchProjects = useCallback(async () => {
    // 'All' = assigned to me OR created by me. Requires current user id (and optional email fallback)
    if (!currentUserId && !currentUserEmail) return;
    setIsLoading(true); setError(null);
    try {
      const selects = 'id, name, assignees, created_at, created_by, creator_email, networks';
      const [a, b, c] = await Promise.all([
        currentUserId ? supabase.from('projects').select(selects).contains('assignees', [currentUserId]).order('created_at', { ascending: false }) : Promise.resolve({ data: [], error: null } as any),
        currentUserId ? supabase.from('projects').select(selects).eq('created_by', currentUserId).order('created_at', { ascending: false }) : Promise.resolve({ data: [], error: null } as any),
        currentUserEmail ? supabase.from('projects').select(selects).eq('creator_email', currentUserEmail).order('created_at', { ascending: false }) : Promise.resolve({ data: [], error: null } as any),
      ]);
      if (a.error) throw a.error;
      if (b.error) throw b.error;
      if (c.error) throw c.error;
      const mergedMap = new Map<string, SidebarProject>();
      for (const row of ([...(a.data || []), ...(b.data || []), ...(c.data || [])] as SidebarProject[])) {
        if (row?.id) mergedMap.set(row.id, row);
      }
      const merged = Array.from(mergedMap.values()).sort((x, y) => (y.created_at || '').localeCompare(x.created_at || ''));
      setProjects(merged);
    } catch (e: any) {
      setError(e?.message || 'Failed to load projects');
      setProjects([]);
    } finally {
      setIsLoading(false);
    }
  }, [currentUserId, currentUserEmail]);

  useEffect(() => { fetchProjects(); }, [fetchProjects]);

  const formatDate = (value?: string | null) => {
    if (!value) return 'Unknown';
    try { return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(value)); }
    catch { return value as string; }
  };
  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
            Projects
          </h2>
          <Badge variant="secondary" className="px-2 py-1 text-xs">
            {isLoading ? '...' : projects.length} total
          </Badge>
        </div>
      </div>

      <Separator />

      {/* Quick Actions */}
      <div className="grid grid-cols-2 gap-3">
        <Button className="h-11 gap-2" variant="default">
          <PlusIcon className="w-4 h-4" />
          New Project
        </Button>
        <Button className="h-11 gap-2" variant="outline">
          <Upload className="w-4 h-4" />
          Import
        </Button>
      </div>

      {/* Enhanced Project List */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <div className="w-1.5 h-1.5 bg-primary rounded-full" />
            Projects
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading || rolesLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="space-y-2">
                  <Skeleton className="h-4 w-48" />
                  <div className="flex gap-2">
                    <Skeleton className="h-3 w-20" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {projects.map((project) => (
                <Card
                  key={project.id}
                  className="p-4 hover:bg-muted/30 cursor-pointer transition-all duration-200 hover:shadow-sm border-l-2 border-l-transparent hover:border-l-primary group"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0 space-y-2">
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium text-sm truncate group-hover:text-primary transition-colors">
                          {project.name || 'Untitled'}
                        </h3>
                        <Badge variant="secondary" className="shrink-0 text-xs">
                          {(project.assignees || []).length} users
                        </Badge>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span>{Array.isArray(project.networks) ? project.networks.length : 0} networks</span>
                        <span>{formatDate(project.created_at)}</span>
                      </div>
                      <p className="text-xs text-muted-foreground truncate">
                        {project.creator_email || project.created_by || 'Unknown owner'}
                      </p>
                    </div>
                  </div>
                </Card>
              ))}
              {projects.length === 0 && (
                <div className="p-4 text-xs text-muted-foreground">No projects found.</div>
              )}
              {error && (
                <div className="p-4 text-xs text-red-600">{error}</div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
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
              <SaveIcon className="w-4 h-4" />
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
function NetworkAnalysisSidebar({ actions, weightedResult }: { actions?: NetworkEditorLayoutProps['inferenceActions']; weightedResult?: DeterministicAnalysisResult | null }) {
  const effectiveResult = actions?.weightedResult ?? weightedResult ?? null;
  // Log presence of weightedResult for debugging visibility issues
  React.useEffect(() => {
    // eslint-disable-next-line no-console
    console.log('[NetworkAnalysisSidebar] FULL DEBUG', {
      hasActions: !!actions,
      hasWeightedResult: !!effectiveResult,
      attractorCount: effectiveResult?.attractors?.length ?? 0,
      attractorData: JSON.stringify(effectiveResult?.attractors?.slice(0, 2)),
    });
  }, [actions?.weightedResult, effectiveResult]);

  // Log every render with timestamp to catch timing issues
  React.useEffect(() => {
    // eslint-disable-next-line no-console
    console.log('[NetworkAnalysisSidebar] RENDER EFFECT', {
      timestamp: new Date().toISOString(),
      hasWeightedResult: !!effectiveResult,
      attractorLength: effectiveResult?.attractors?.length ?? 0,
    });
  });
  return (
    <div className="flex flex-col h-full gap-4">
      {/* Header */}
      <div className="flex-shrink-0 space-y-2">
        <h2 className="text-2xl font-bold tracking-tight text-foreground">Network Inference</h2>
        <div className="text-xs">
          {effectiveResult ? (
            <span className="text-green-600 font-medium">✓ Weighted: {effectiveResult.attractors?.length ?? 0} attractors</span>
          ) : (
            <span className="text-muted-foreground">No weighted result</span>
          )}
        </div>
        <Separator />
      </div>

      {/* DEBUG: Show if condition is true */}

      {/* DEBUG: Always show status */}
      <div className={`text-[10px] p-1 rounded border ${effectiveResult ? 'bg-green-100 border-green-300' : 'bg-red-100 border-red-300'}`}>
        Result: {effectiveResult ? '✓ FOUND' : '✗ NOT FOUND'} | Attractors: {effectiveResult?.attractors?.length ?? 0}
      </div>
      <Separator />
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Actions</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="space-y-1">
            <Button
              className="w-full justify-start gap-3 h-11 px-4"
              onClick={() => actions?.run?.()}
              disabled={actions?.isRunning}
            >
              <Play className="w-4 h-4" />
              Perform DA
            </Button>
            <Button
              className="w-full justify-start gap-3 h-11 px-4"
              onClick={() => {
                console.log('[NetworkAnalysisSidebar] Weighted DA button clicked', {
                  hasRunWeighted: !!actions?.runWeighted,
                  isWeightedRunning: actions?.isWeightedRunning,
                  actions
                });
                actions?.runWeighted?.();
              }}
              disabled={actions?.isWeightedRunning}
              variant="secondary"
            >
              <Play className="w-4 h-4" />
              Perform Weighted DA
            </Button>
            <Button
              className="w-full justify-start gap-3 h-11 px-4"
              onClick={() => actions?.runProbabilistic?.()}
              disabled={actions?.isProbabilisticRunning}
              variant="secondary"
            >
              <Play className="w-4 h-4" />
              Perform Probabilistic Analysis
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start gap-3 h-11 px-4"
              onClick={() => actions?.download?.()}
              disabled={!actions?.hasResult}
            >
              <Download className="w-4 h-4" />
              Download Results
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Enhanced Therapeutics Sidebar
function TherapeuticsSidebar() {
  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <h2 className="text-2xl font-bold tracking-tight text-foreground">
          Therapeutics
        </h2>
        <p className="text-sm text-muted-foreground">
          Drug discovery and compound analysis
        </p>
      </div>

      <Separator />

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Drug Database</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button className="w-full gap-2">
            <Database className="w-4 h-4" />
            Browse Compounds
          </Button>
          <Button variant="outline" className="w-full gap-2">
            <Search className="w-4 h-4" />
            Search Database
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Recent Compounds</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6 text-muted-foreground">
            <Database className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No recent compounds</p>
          </div>
        </CardContent>
      </Card>
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
            <FileTextIcon className="w-4 h-4" />
            Generate Report
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

// Icon Components (keep the same as before)
const PlusIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
  </svg>
);

const SaveIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
  </svg>
);

const FileTextIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
  </svg>
);