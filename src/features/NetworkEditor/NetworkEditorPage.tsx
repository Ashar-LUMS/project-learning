"use client";

import React, { useState } from 'react';
import NetworkEditorLayout from './layout/NetworkEditorLayout';
import ProjectTab from './tabs/ProjectTab';
import NetworkGraph from './NetworkGraph'; // Your existing NetworkGraph component

export default function NetworkEditorPage() {
  const [activeTab, setActiveTab] = useState<'projects' | 'network' | 'therapeutics' | 'analysis' | 'results'>('projects');

  const renderMainContent = () => {
    switch (activeTab) {
      case 'projects':
        return <ProjectTab />;
      case 'network':
        return (
          <div className="h-full p-6">
            <NetworkGraph projectId={null} height="100%" />
          </div>
        );
      case 'therapeutics':
        return (
          <div className="h-full p-6">
            <div className="flex items-center justify-center h-full text-muted-foreground">
              Therapeutics workspace - Coming soon
            </div>
          </div>
        );
      case 'analysis':
        return (
          <div className="h-full p-6">
            <div className="flex items-center justify-center h-full text-muted-foreground">
              Analysis workspace - Coming soon
            </div>
          </div>
        );
      case 'results':
        return (
          <div className="h-full p-6">
            <div className="flex items-center justify-center h-full text-muted-foreground">
              Results workspace - Coming soon
            </div>
          </div>
        );
      default:
        return <ProjectTab />;
    }
  };

  return (
    <NetworkEditorLayout>
      {renderMainContent()}
    </NetworkEditorLayout>
  );
}