import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';

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
      return networkSidebar ?? <NetworkSidebar />;
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

// Enhanced Project Tab Sidebar
function ProjectsSidebar() {
  const [projects] = useState([
    { id: 1, name: 'Project Alpha', status: 'active', lastModified: '2 hours ago', nodes: 24, edges: 48 },
    { id: 2, name: 'Project Beta', status: 'completed', lastModified: '1 day ago', nodes: 18, edges: 32 },
    { id: 3, name: 'Project Gamma', status: 'draft', lastModified: '3 days ago', nodes: 12, edges: 20 },
    { id: 4, name: 'Clinical Trial Analysis', status: 'active', lastModified: 'Just now', nodes: 36, edges: 72 },
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
    <div className="space-y-6">
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
            Projects
          </h2>
          <Badge variant="secondary" className="px-2 py-1 text-xs">
            {projects.length} total
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
                        {project.name}
                      </h3>
                      <Badge 
                        variant={getStatusVariant(project.status) as any} 
                        className="shrink-0 text-xs"
                      >
                        {project.status}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span>{project.nodes} nodes</span>
                      <span>{project.edges} edges</span>
                    </div>
                    <p className="text-xs text-muted-foreground">{project.lastModified}</p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
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