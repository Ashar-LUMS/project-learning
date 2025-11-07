import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Folder,
  Network,
  Pill,
  LineChart,
  Waypoints,
  Container,
  CircuitBoard,
  LineSquiggle,
  Cpu,
  Search,
  Filter,
  ChevronRight,
  Star,
  MoreHorizontal,
  Download,
  Upload,
  Settings,
  Play,
  BarChart3,
  Database,
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
              {renderTabContent(activeTab, networkSidebar)}
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
function ProjectsSidebar() {
  const [projects, setProjects] = useState([
    { 
      id: 1, 
      name: 'Project Alpha', 
      status: 'active', 
      lastModified: '2 hours ago', 
      nodes: 24, 
      edges: 48,
      favorite: true,
      tags: ['Clinical', 'RNA-seq']
    },
    { 
      id: 2, 
      name: 'Project Beta', 
      status: 'completed', 
      lastModified: '1 day ago', 
      nodes: 18, 
      edges: 32,
      favorite: false,
      tags: ['Metabolic']
    },
    { 
      id: 3, 
      name: 'Project Gamma', 
      status: 'draft', 
      lastModified: '3 days ago', 
      nodes: 12, 
      edges: 20,
      favorite: true,
      tags: ['Signaling']
    },
    { 
      id: 4, 
      name: 'Clinical Trial Analysis', 
      status: 'active', 
      lastModified: 'Just now', 
      nodes: 36, 
      edges: 72,
      favorite: false,
      tags: ['Clinical', 'Drug Response']
    },
  ]);

  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'active': return 'default';
      case 'completed': return 'secondary';
      case 'draft': return 'outline';
      default: return 'outline';
    }
  };

  const toggleFavorite = (projectId: number) => {
    setProjects(projects.map(project => 
      project.id === projectId 
        ? { ...project, favorite: !project.favorite }
        : project
    ));
  };

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-foreground">
              Projects
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Manage your network projects and analyses
            </p>
          </div>
          <Badge variant="secondary" className="px-2 py-1 text-xs">
            {projects.length}
          </Badge>
        </div>

        <div className="flex gap-2">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search projects..." className="pl-9" />
          </div>
          <Button variant="outline" size="icon">
            <Filter className="w-4 h-4" />
          </Button>
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

      {/* Project List */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">Recent Projects</h3>
          <Button variant="ghost" size="sm" className="h-8 text-xs">
            View All
            <ChevronRight className="w-3 h-3 ml-1" />
          </Button>
        </div>

        <div className="space-y-3">
          {projects.map((project) => (
            <Card
              key={project.id}
              className="p-4 hover:bg-muted/30 cursor-pointer transition-all duration-200 border group"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <h3 className="font-medium text-sm group-hover:text-primary transition-colors">
                    {project.name}
                  </h3>
                  <Badge
                    variant={getStatusVariant(project.status) as any}
                    className="shrink-0 text-xs"
                  >
                    {project.status}
                  </Badge>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleFavorite(project.id);
                    }}
                  >
                    <Star 
                      className={cn(
                        "w-3 h-3",
                        project.favorite ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground"
                      )} 
                    />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-6 w-6">
                    <MoreHorizontal className="w-3 h-3" />
                  </Button>
                </div>
              </div>

              <div className="flex items-center gap-4 text-xs text-muted-foreground mb-2">
                <span>{project.nodes} nodes</span>
                <span>{project.edges} edges</span>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex gap-1">
                  {project.tags.map((tag, index) => (
                    <Badge key={index} variant="outline" className="text-xs px-1.5 py-0">
                      {tag}
                    </Badge>
                  ))}
                </div>
                <span className="text-xs text-muted-foreground">{project.lastModified}</span>
              </div>
            </Card>
          ))}
        </div>
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
function NetworkAnalysisSidebar() {
  const [selectedAlgorithm, setSelectedAlgorithm] = useState('centrality');

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <h2 className="text-2xl font-bold tracking-tight text-foreground">
          Network Inference
        </h2>
        <p className="text-sm text-muted-foreground">
          Infer networks from omics data and run analyses
        </p>
      </div>

      <Separator />

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Analysis Type</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant={selectedAlgorithm === 'centrality' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedAlgorithm('centrality')}
            >
              Centrality
            </Button>
            <Button
              variant={selectedAlgorithm === 'clustering' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedAlgorithm('clustering')}
            >
              Clustering
            </Button>
            <Button
              variant={selectedAlgorithm === 'community' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedAlgorithm('community')}
            >
              Community
            </Button>
            <Button
              variant={selectedAlgorithm === 'pathway' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedAlgorithm('pathway')}
            >
              Pathway
            </Button>
          </div>
        </CardContent>
      </Card>

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