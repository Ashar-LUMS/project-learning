"use client";

import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Folder, Plus, Search, Users, Calendar, Download, Share } from 'lucide-react';

interface ProjectTabProps {
  onProjectSelect: (projectId: string) => void;
  onProjectOpen: (projectId: string) => void;
  selectedProjectId?: string;
}

export default function ProjectTab({ onProjectSelect, onProjectOpen, selectedProjectId }: ProjectTabProps) {
  const [projects, setProjects] = React.useState([...]); // your projects state
  const [searchTerm, setSearchTerm] = React.useState('');

  // In your project card click handler
  const handleProjectClick = (projectId: string) => {
    onProjectSelect(projectId);
  };

  const handleOpenProject = (projectId: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent card click
    onProjectOpen(projectId);
  };

  return (
    <div className="p-6 space-y-6">
      {/* ... your existing ProjectTab JSX ... */}
      
      {filteredProjects.map((project) => (
        <Card 
          key={project.id} 
          className={`hover:shadow-lg transition-shadow cursor-pointer ${
            selectedProjectId === project.id ? 'ring-2 ring-blue-500' : ''
          }`}
          onClick={() => handleProjectClick(project.id)}
        >
          <CardHeader className="pb-3">
            {/* ... card header ... */}
          </CardHeader>
          <CardContent className="space-y-3">
            {/* ... card content ... */}
            <div className="flex gap-2 pt-2">
              <Button 
                variant="outline" 
                size="sm" 
                className="flex-1"
                onClick={(e) => handleOpenProject(project.id, e)}
              >
                Open in Full View
              </Button>
              <Button variant="outline" size="sm">
                <Download size={14} />
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}