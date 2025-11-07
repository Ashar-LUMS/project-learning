import React, { useCallback, useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
  Pill,
  LineChart,
  Waypoints,
  Container,
  CircuitBoard,
  LineSquiggle,
  Cpu
} from 'lucide-react';

interface NetworkEditorLayoutProps {
  children: React.ReactNode;
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
  networkSidebar?: React.ReactNode;
}

type TabType = 'projects' | 'network-inference' | 'network' | 'therapeutics' | 'env' | 'cell-circuits' | 'cell-lines' | 'simulation' | 'analysis' | 'results';

export default function NetworkEditorLayout({
  children,
  activeTab,
  onTabChange,
  networkSidebar,
}: NetworkEditorLayoutProps) {
  const tabs = [
    { id: 'projects' as TabType, label: 'Projects', icon: <Folder color="#ff1f1f" strokeWidth={2.5} className="h-4 w-4" /> },
    { id: 'network' as TabType, label: 'Network', icon: <Network color="#ff1f1f" strokeWidth={2.5} className="h-4 w-4" /> },
    { id: 'network-inference' as TabType, label: 'Network Inference', icon: <Waypoints color="#ff1f1f" strokeWidth={2.5} /> },
    { id: 'therapeutics' as TabType, label: 'Therapeutics', icon: <Pill color="#ff1f1f" strokeWidth={2.5} className="h-4 w-4" /> },
    { id: 'env' as TabType, label: 'Environment', icon: <Container color="#ff1f1f" strokeWidth={2.5} /> },
    { id: 'cell-circuits' as TabType, label: 'Cell Circuits', icon: <CircuitBoard color="#ff1f1f" strokeWidth={2.5} />},
    { id: 'cell-lines' as TabType, label: 'Cell Lines', icon: <LineSquiggle color="#ff1f1f" strokeWidth={2.5} /> },
    {id: 'simulation' as TabType, label: 'Simulation', icon: <Cpu color="#ff1f1f" strokeWidth={2.5} />},
    { id: 'analysis' as TabType, label: 'Analysis', icon: <LineChart color="#ff1f1f" strokeWidth={2.5} className="h-4 w-4" /> },
  ];

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Enhanced Header with subtle gradient and better spacing */}
      <div className="border-b bg-gradient-to-r from-card/80 to-card/60 backdrop-blur-sm supports-[backdrop-filter]:bg-background/60">
        <div className="px-8">
          <Tabs value={activeTab} onValueChange={(value) => onTabChange(value as TabType)} className="w-full">
            <TabsList className="w-full justify-start h-14 bg-transparent p-0 gap-1">
              {tabs.map((tab) => (
                <TabsTrigger
                  key={tab.id}
                  value={tab.id}
                  className={cn(
                    "px-6 py-4 h-14 relative group",
                    "data-[state=active]:bg-primary/20 data-[state=active]:text-primary data-[state=active]:font-semibold data-[state=active]:shadow-sm",
                    "data-[state=active]:border-b-2 data-[state=active]:border-b-primary",
                    "transition-all duration-200 hover:bg-muted/50 hover:text-foreground",
                    "rounded-none border-b-2 border-b-transparent",
                    "flex items-center gap-3"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-lg group-data-[state=active]:scale-110 transition-transform duration-200">
                      {tab.icon}
                    </span>
                    <span className="text-sm font-medium tracking-wide">
                      {tab.label}
                    </span>
                  </div>
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Enhanced Sidebar with better styling */}
        <div className="w-80 border-r bg-gradient-to-b from-muted/10 to-background overflow-hidden flex flex-col shadow-sm">
          <ScrollArea className="flex-1">
            <div className="p-6">
              {renderTabContent(activeTab, networkSidebar)}
            </div>
          </ScrollArea>
        </div>

        {/* Main Workspace with subtle background pattern */}
        <div className="flex-1 overflow-auto bg-gradient-to-br from-background to-muted/20 relative">
          <div className="absolute inset-0 bg-grid-slate-100 [mask-image:linear-gradient(0deg,white,rgba(255,255,255,0.6))] -z-10" />
          {children}
        </div>
      </div>
    </div>
  );
}

function renderTabContent(activeTab: TabType, networkSidebar?: React.ReactNode) {
  switch (activeTab) {
    case 'projects':
      return <ProjectsSidebar />;
    case 'network':
      return networkSidebar ?? <NetworkSidebar />;
    case 'network-inference':
      return <NetworkAnalysisSidebar />;
    case 'therapeutics':
      return <TherapeuticsSidebar />;
    case 'env':
      return <EnvironmentSidebar />;
    case 'cell-circuits':
      return <AnalysisSidebar />;
    case 'cell-lines':
      return <AnalysisSidebar />;
    case 'simulation':
      return <AnalysisSidebar />;
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
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
            Projects
          </h2>
          <Badge variant="secondary" className="px-2 py-1 text-xs">
            {isLoading ? '...' : projects.length} total
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Manage your network projects and analyses in one place
        </p>
      </div>

      <Separator />

      {/* Enhanced Project Actions */}
      <Card className="bg-card/50 backdrop-blur-sm border-l-4 border-l-primary">
        <CardContent className="p-4 space-y-3">
          <Button className="w-full justify-start gap-3 h-11" variant="default">
            <PlusIcon className="w-4 h-4" />
            <span className="font-medium">New Project</span>
          </Button>
          <Button className="w-full justify-start gap-3 h-11" variant="outline">
            <FolderOpenIcon className="w-4 h-4" />
            <span className="font-medium">Open Project</span>
          </Button>
          <Button className="w-full justify-start gap-3 h-11" variant="outline">
            <SaveIcon className="w-4 h-4" />
            <span className="font-medium">Save Project</span>
          </Button>
        </CardContent>
      </Card>

      {/* Enhanced Project List */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <div className="w-1.5 h-1.5 bg-primary rounded-full" />
            Recent Projects
          </CardTitle>
          <CardDescription>Your most recently accessed projects</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading || rolesLoading ? (
            <div className="space-y-2 p-4">
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
  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <h2 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
          Network Tools
        </h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Manage and analyze your network structures
        </p>
      </div>

      <Separator />

      <Card className="bg-card/50 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="text-sm font-medium">Quick Actions</CardTitle>
        </CardHeader>
        <CardContent className="p-4 space-y-3">
          <Button className="w-full justify-start gap-3 h-11" variant="default">
            <SaveIcon className="w-4 h-4" />
            Save Network
          </Button>
          <Button className="w-full justify-start gap-3 h-11" variant="outline">
            <UploadIcon className="w-4 h-4" />
            Import Data
          </Button>
          <Button className="w-full justify-start gap-3 h-11" variant="outline">
            <SettingsIcon className="w-4 h-4" />
            Network Settings
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

// Network Analysis Sidebar (separate function for focused network analysis tools)
function NetworkAnalysisSidebar() {
  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <h2 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
          Network Analysis
        </h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Run focused network analyses: centrality, clustering, pathfinding and export results
        </p>
      </div>

      <Separator />

      <Card className="bg-card/50 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="text-sm font-medium">Analysis Tools</CardTitle>
        </CardHeader>
        <CardContent className="p-4 space-y-3">
          <Button className="w-full justify-start gap-3 h-11" variant="default">
            <PlayIcon className="w-4 h-4" />
            Run Network Analysis
          </Button>
          <Button className="w-full justify-start gap-3 h-11" variant="outline">
            <BarChartIcon className="w-4 h-4" />
            View Metrics
          </Button>
          <Button className="w-full justify-start gap-3 h-11" variant="outline">
            <DownloadIcon className="w-4 h-4" />
            Export Results
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Recent Analyses</CardTitle>
        </CardHeader>
        <CardContent className="p-4 space-y-3">
          <div className="text-center py-6 text-muted-foreground">
            <PlayIcon className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No recent analyses</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
  }

// Environment Sidebar
function EnvironmentSidebar() {
  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <h2 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
          Environment
        </h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Configure environment presets, media conditions and import/export environment files
        </p>
      </div>

      <Separator />

      <Card className="bg-card/50 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="text-sm font-medium">Environment Controls</CardTitle>
        </CardHeader>
        <CardContent className="p-4 space-y-3">
          <Button className="w-full justify-start gap-3 h-11" variant="default">
            <Container className="w-4 h-4" />
            Apply Preset
          </Button>
          <Button className="w-full justify-start gap-3 h-11" variant="outline">
            <UploadIcon className="w-4 h-4" />
            Import Conditions
          </Button>
          <Button className="w-full justify-start gap-3 h-11" variant="outline">
            <DownloadIcon className="w-4 h-4" />
            Export Environment
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Active Preset</CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          <div className="text-sm text-muted-foreground">No preset applied</div>
        </CardContent>
      </Card>
    </div>
  );
}

// Enhanced Therapeutics Tab Sidebar
function TherapeuticsSidebar() {
  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <h2 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
          Therapeutics
        </h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Drug discovery and compound analysis tools
        </p>
      </div>

      <Separator />

      <Card className="bg-card/50 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="text-sm font-medium">Analysis Tools</CardTitle>
        </CardHeader>
        <CardContent className="p-4 space-y-3">
          <Button className="w-full justify-start gap-3 h-11" variant="default">
            <DatabaseIcon className="w-4 h-4" />
            Drug Database
          </Button>
          <Button className="w-full justify-start gap-3 h-11" variant="outline">
            <SearchIcon className="w-4 h-4" />
            Search Compounds
          </Button>
          <Button className="w-full justify-start gap-3 h-11" variant="outline">
            <ActivityIcon className="w-4 h-4" />
            Efficacy Analysis
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Recent Compounds</CardTitle>
        </CardHeader>
        <CardContent className="p-4 space-y-3">
          <div className="text-center py-8 text-muted-foreground">
            <DatabaseIcon className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No recent compounds</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Enhanced Analysis Tab Sidebar
function AnalysisSidebar() {
  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <h2 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
          Analysis
        </h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Advanced network analysis and metrics
        </p>
      </div>

      <Separator />

      <Card className="bg-card/50 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="text-sm font-medium">Analysis Tools</CardTitle>
        </CardHeader>
        <CardContent className="p-4 space-y-3">
          <Button className="w-full justify-start gap-3 h-11" variant="default">
            <PlayIcon className="w-4 h-4" />
            Run Analysis
          </Button>
          <Button className="w-full justify-start gap-3 h-11" variant="outline">
            <BarChartIcon className="w-4 h-4" />
            View Metrics
          </Button>
          <Button className="w-full justify-start gap-3 h-11" variant="outline">
            <CompareIcon className="w-4 h-4" />
            Compare Results
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

// Enhanced Results Tab Sidebar
function ResultsSidebar() {
  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <h2 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
          Results
        </h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Export, visualize, and generate reports
        </p>
      </div>

      <Separator />

      <Card className="bg-card/50 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="text-sm font-medium">Export Options</CardTitle>
        </CardHeader>
        <CardContent className="p-4 space-y-3">
          <Button className="w-full justify-start gap-3 h-11" variant="default">
            <DownloadIcon className="w-4 h-4" />
            Export Data
          </Button>
          <Button className="w-full justify-start gap-3 h-11" variant="outline">
            <FileTextIcon className="w-4 h-4" />
            Generate Report
          </Button>
          <Button className="w-full justify-start gap-3 h-11" variant="outline">
            <ImageIcon className="w-4 h-4" />
            Save Visualization
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

// Additional Icon Components
const UploadIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
  </svg>
);

const SettingsIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);

// Keep all existing icon components from the original code...
const PlusIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
  </svg>
);

const FolderOpenIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z" />
  </svg>
);

const SaveIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
  </svg>
);

const DatabaseIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
  </svg>
);

const SearchIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
  </svg>
);

const ActivityIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
  </svg>
);

const PlayIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const BarChartIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
  </svg>
);

const CompareIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
  </svg>
);

const DownloadIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
  </svg>
);

const FileTextIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
  </svg>
);

const ImageIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
  </svg>
);