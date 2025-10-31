import React, { useState } from 'react';
import { cn } from '@/lib/utils';

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
    { id: 'projects' as TabType, label: 'All networks' },
    { id: 'network' as TabType, label: 'Network' },
    { id: 'therapeutics' as TabType, label: 'Therapeutics' },
    { id: 'analysis' as TabType, label: 'Analysis' },
    { id: 'results' as TabType, label: 'Results' },
  ];

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Top Tabs Navigation */}
      <div className="flex border-b bg-card">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={cn(
              "px-6 py-3 text-sm font-medium transition-colors relative",
              "hover:bg-muted focus:outline-none focus:bg-muted",
              activeTab === tab.id
                ? "text-primary border-b-2 border-primary"
                : "text-muted-foreground"
            )}
          >
            {tab.label}
            {activeTab === tab.id && (
              <div className="absolute inset-0 bg-primary/5 rounded-t-lg" />
            )}
          </button>
        ))}
      </div>

      {/* Main Content Area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar - Tab Specific Content */}
        <div className="w-80 border-r bg-muted/20 overflow-y-auto">
          {renderTabContent(activeTab, networkSidebar)}
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
    { id: 1, name: 'Project Alpha', status: 'active' },
    { id: 2, name: 'Project Beta', status: 'completed' },
    { id: 3, name: 'Project Gamma', status: 'draft' },
  ]);

  return (
    <div className="p-4 space-y-4">
      <h2 className="text-lg font-semibold">Projects</h2>
      
      {/* Project Actions */}
      <div className="space-y-2">
        <button className="w-full text-left p-3 rounded-lg border border-dashed hover:bg-muted transition-colors">
          + New Project
        </button>
        <button className="w-full text-left p-3 rounded-lg border hover:bg-muted transition-colors">
          📁 Open Project
        </button>
        <button className="w-full text-left p-3 rounded-lg border hover:bg-muted transition-colors">
          💾 Save Project
        </button>
      </div>

      {/* Project List */}
      <div className="space-y-2">
        <h3 className="text-sm font-medium text-muted-foreground">Recent Projects</h3>
        {projects.map((project) => (
          <div
            key={project.id}
            className="p-3 rounded-lg border hover:bg-muted cursor-pointer transition-colors"
          >
            <div className="flex justify-between items-start">
              <span className="font-medium">{project.name}</span>
              <span className={cn(
                "text-xs px-2 py-1 rounded-full",
                project.status === 'active' && "bg-green-100 text-green-800",
                project.status === 'completed' && "bg-blue-100 text-blue-800",
                project.status === 'draft' && "bg-gray-100 text-gray-800"
              )}>
                {project.status}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Network Tab Sidebar
function NetworkSidebar() {
  return (
    <div className="p-4 space-y-4">
      <h2 className="text-lg font-semibold">Network Tools</h2>
      
      <div className="space-y-3">
        <div className="p-3 border rounded-lg cursor-grab bg-white shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center gap-2">
            <span>Node</span>
          </div>
        </div>
        <div className="p-3 border rounded-lg cursor-grab bg-white shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center gap-2">
            <span>Edge</span>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <h3 className="text-sm font-medium text-muted-foreground">Properties</h3>
        <div className="space-y-2">
          <div>
            <label className="text-xs text-muted-foreground">Node Color</label>
            <input type="color" className="w-full h-8 rounded border" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Edge Width</label>
            <input type="range" min="1" max="10" className="w-full" />
          </div>
        </div>
      </div>
    </div>
  );
}

// Therapeutics Tab Sidebar
function TherapeuticsSidebar() {
  return (
    <div className="p-4 space-y-4">
      <h2 className="text-lg font-semibold">Therapeutics</h2>
      <div className="space-y-2">
        <button className="w-full text-left p-3 rounded-lg border hover:bg-muted transition-colors">
          Drug Database
        </button>
        <button className="w-full text-left p-3 rounded-lg border hover:bg-muted transition-colors">
          Search Compounds
        </button>
        <button className="w-full text-left p-3 rounded-lg border hover:bg-muted transition-colors">
        Efficacy Analysis
        </button>
      </div>
    </div>
  );
}

// Analysis Tab Sidebar
function AnalysisSidebar() {
  return (
    <div className="p-4 space-y-4">
      <h2 className="text-lg font-semibold">Analysis</h2>
      <div className="space-y-2">
        <button className="w-full text-left p-3 rounded-lg border hover:bg-muted transition-colors">
          Run Analysis
        </button>
        <button className="w-full text-left p-3 rounded-lg border hover:bg-muted transition-colors">
          View Metrics
        </button>
        <button className="w-full text-left p-3 rounded-lg border hover:bg-muted transition-colors">
          Compare Results
        </button>
      </div>
    </div>
  );
}

// Results Tab Sidebar
function ResultsSidebar() {
  return (
    <div className="p-4 space-y-4">
      <h2 className="text-lg font-semibold">Results</h2>
      <div className="space-y-2">
        <button className="w-full text-left p-3 rounded-lg border hover:bg-muted transition-colors">
          Export Data
        </button>
        <button className="w-full text-left p-3 rounded-lg border hover:bg-muted transition-colors">
          Generate Report
        </button>
        <button className="w-full text-left p-3 rounded-lg border hover:bg-muted transition-colors">
          Save Visualization
        </button>
      </div>
    </div>
  );
}