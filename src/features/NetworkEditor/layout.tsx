import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';

interface NetworkEditorLayoutProps {
  children: React.ReactNode;
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
  networkSidebar?: React.ReactNode;
}

type TabType = 'projects' | 'network' | 'therapeutics' | 'analysis' | 'results';

export default function NetworkEditorLayout({ 
  children, 
  activeTab, 
  onTabChange,
  networkSidebar,
}: NetworkEditorLayoutProps) {
  const tabs = [
    { id: 'projects' as TabType, label: 'All Networks', icon: '📊' },
    { id: 'network' as TabType, label: 'Network', icon: '🕸️' },
    { id: 'therapeutics' as TabType, label: 'Therapeutics', icon: '💊' },
    { id: 'analysis' as TabType, label: 'Analysis', icon: '📈' },
    { id: 'results' as TabType, label: 'Results', icon: '📋' },
  ];

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Top Tabs Navigation */}
      <div className="border-b bg-card/50 backdrop-blur-sm">
        <div className="px-6">
          <Tabs value={activeTab} onValueChange={(value) => onTabChange(value as TabType)} className="w-full">
            <TabsList className="w-full justify-start h-12 bg-transparent p-0">
              {tabs.map((tab) => (
                <TabsTrigger
                  key={tab.id}
                  value={tab.id}
                  className={cn(
                    "px-6 py-3 h-12 relative",
                    "data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:font-semibold data-[state=active]:shadow-sm",
                    "border-r border-border last:border-r-0",
                    "transition-all duration-200 hover:bg-muted/50"
                  )}
                >
                  <span className="flex items-center gap-2 text-sm font-medium">
                    <span>{tab.icon}</span>
                    {tab.label}
                  </span>
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar - Tab Specific Content */}
        <div className="w-80 border-r bg-muted/5 overflow-hidden flex flex-col">
          <ScrollArea className="flex-1">
            {renderTabContent(activeTab, networkSidebar)}
          </ScrollArea>
        </div>

        {/* Main Workspace - Canvas Area */}
        <div className="flex-1 overflow-auto bg-background">
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
    case 'therapeutics':
      return <TherapeuticsSidebar />;
    case 'analysis':
      return <AnalysisSidebar />;
    case 'results':
      return <ResultsSidebar />;
    default:
      return <ProjectsSidebar />;
  }
}

// Project Tab Sidebar
function ProjectsSidebar() {
  const [projects] = useState([
    { id: 1, name: 'Project Alpha', status: 'active', lastModified: '2 hours ago' },
    { id: 2, name: 'Project Beta', status: 'completed', lastModified: '1 day ago' },
    { id: 3, name: 'Project Gamma', status: 'draft', lastModified: '3 days ago' },
    { id: 4, name: 'Clinical Trial Analysis', status: 'active', lastModified: 'Just now' },
  ]);

  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'active': return 'default';
      case 'completed': return 'secondary';
      case 'draft': return 'outline';
      default: return 'outline';
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="space-y-2">
        <h2 className="text-2xl font-bold tracking-tight">Projects</h2>
        <p className="text-sm text-muted-foreground">
          Manage your network projects and analyses
        </p>
      </div>

      {/* Project Actions */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <Button className="w-full justify-start gap-2" variant="default">
            <PlusIcon className="w-4 h-4" />
            New Project
          </Button>
          <Button className="w-full justify-start gap-2" variant="outline">
            <FolderOpenIcon className="w-4 h-4" />
            Open Project
          </Button>
          <Button className="w-full justify-start gap-2" variant="outline">
            <SaveIcon className="w-4 h-4" />
            Save Project
          </Button>
        </CardContent>
      </Card>

      {/* Project List */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent Projects</CardTitle>
          <CardDescription>Your most recently accessed projects</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="space-y-1">
            {projects.map((project) => (
              <div
                key={project.id}
                className="flex items-center justify-between p-3 hover:bg-muted/50 cursor-pointer transition-colors border-b last:border-b-0"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{project.name}</p>
                  <p className="text-xs text-muted-foreground">{project.lastModified}</p>
                </div>
                <Badge variant={getStatusVariant(project.status) as any} className="shrink-0 ml-2">
                  {project.status}
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Network Tab Sidebar
function NetworkSidebar() {
  return (
    <div className="p-6 space-y-6">
      <div className="space-y-2">
        <h2 className="text-2xl font-bold tracking-tight">Network Tools</h2>
        <p className="text-sm text-muted-foreground">
          Build and customize your network
        </p>
      </div>

      {/* Network Elements */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Network Elements</CardTitle>
          <CardDescription>Drag elements to the canvas</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="p-3 border-2 border-dashed rounded-lg cursor-grab bg-card hover:bg-muted/50 transition-colors group">
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full bg-primary" />
              <span className="text-sm font-medium">Node</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">Biological entity</p>
          </div>
          <div className="p-3 border-2 border-dashed rounded-lg cursor-grab bg-card hover:bg-muted/50 transition-colors group">
            <div className="flex items-center gap-3">
              <div className="w-8 h-0.5 bg-primary" />
              <span className="text-sm font-medium">Edge</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">Interaction or relationship</p>
          </div>
        </CardContent>
      </Card>

      {/* Properties Panel */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Properties</CardTitle>
          <CardDescription>Customize network appearance</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="node-color" className="text-sm">Node Color</Label>
            <div className="flex gap-2">
              <Input type="color" id="node-color" className="w-12 h-8 p-1" defaultValue="#3b82f6" />
              <Input value="#3b82f6" className="flex-1 font-mono text-sm" readOnly />
            </div>
          </div>
          
          <Separator />
          
          <div className="space-y-2">
            <div className="flex justify-between">
              <Label htmlFor="edge-width" className="text-sm">Edge Width</Label>
              <span className="text-xs text-muted-foreground">3px</span>
            </div>
            <Slider id="edge-width" defaultValue={[3]} max={10} step={1} className="w-full" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Therapeutics Tab Sidebar
function TherapeuticsSidebar() {
  return (
    <div className="p-6 space-y-6">
      <div className="space-y-2">
        <h2 className="text-2xl font-bold tracking-tight">Therapeutics</h2>
        <p className="text-sm text-muted-foreground">
          Drug discovery and compound analysis
        </p>
      </div>

      <Card>
        <CardContent className="p-4 space-y-3">
          <Button className="w-full justify-start gap-2" variant="outline">
            <DatabaseIcon className="w-4 h-4" />
            Drug Database
          </Button>
          <Button className="w-full justify-start gap-2" variant="outline">
            <SearchIcon className="w-4 h-4" />
            Search Compounds
          </Button>
          <Button className="w-full justify-start gap-2" variant="outline">
            <ActivityIcon className="w-4 h-4" />
            Efficacy Analysis
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

// Analysis Tab Sidebar
function AnalysisSidebar() {
  return (
    <div className="p-6 space-y-6">
      <div className="space-y-2">
        <h2 className="text-2xl font-bold tracking-tight">Analysis</h2>
        <p className="text-sm text-muted-foreground">
          Network analysis and metrics
        </p>
      </div>

      <Card>
        <CardContent className="p-4 space-y-3">
          <Button className="w-full justify-start gap-2" variant="outline">
            <PlayIcon className="w-4 h-4" />
            Run Analysis
          </Button>
          <Button className="w-full justify-start gap-2" variant="outline">
            <BarChartIcon className="w-4 h-4" />
            View Metrics
          </Button>
          <Button className="w-full justify-start gap-2" variant="outline">
            <CompareIcon className="w-4 h-4" />
            Compare Results
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

// Results Tab Sidebar
function ResultsSidebar() {
  return (
    <div className="p-6 space-y-6">
      <div className="space-y-2">
        <h2 className="text-2xl font-bold tracking-tight">Results</h2>
        <p className="text-sm text-muted-foreground">
          Export and report generation
        </p>
      </div>

      <Card>
        <CardContent className="p-4 space-y-3">
          <Button className="w-full justify-start gap-2" variant="outline">
            <DownloadIcon className="w-4 h-4" />
            Export Data
          </Button>
          <Button className="w-full justify-start gap-2" variant="outline">
            <FileTextIcon className="w-4 h-4" />
            Generate Report
          </Button>
          <Button className="w-full justify-start gap-2" variant="outline">
            <ImageIcon className="w-4 h-4" />
            Save Visualization
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

// Icon Components
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