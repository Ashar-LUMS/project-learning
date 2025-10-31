"use client";

import {useState} from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Folder, 
  Search, 
  MoreHorizontal,
  Calendar,
  Download
} from 'lucide-react';

interface Network {
  id: string;
  name: string;
  description: string;
  type: 'protein' | 'metabolic' | 'regulatory' | 'signal';
  lastModified: string;
  nodes: number;
  edges: number;
  version: string;
}

interface ProjectTabProps {
  onProjectSelect: (projectId: string | null) => void;
}

export default function ProjectTab({ onProjectSelect }: ProjectTabProps) {
  const [networks] = useState<Network[]>([
    {
      id: '1',
      name: 'Baseline PPI Network',
      description: 'Initial protein-protein interaction network from experimental data',
      type: 'protein',
      lastModified: '2024-01-15',
      nodes: 156,
      edges: 342,
      version: 'v1.2'
    },
    {
      id: '2',
      name: 'Drug Response Network',
      description: 'Network showing protein interactions after drug treatment',
      type: 'signal',
      lastModified: '2024-01-14',
      nodes: 143,
      edges: 289,
      version: 'v1.0'
    },
    {
      id: '3',
      name: 'Gene Regulatory Network',
      description: 'Transcription factor and target gene interactions',
      type: 'regulatory',
      lastModified: '2024-01-12',
      nodes: 89,
      edges: 167,
      version: 'v2.1'
    },
    {
      id: '4',
      name: 'Metabolic Pathways',
      description: 'Core metabolic pathway interactions',
      type: 'metabolic',
      lastModified: '2024-01-10',
      nodes: 234,
      edges: 456,
      version: 'v1.5'
    }
  ]);

  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'protein' | 'metabolic' | 'regulatory' | 'signal'>('all');

  const filteredNetworks = networks.filter(network => {
    const matchesSearch = network.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         network.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = filterType === 'all' || network.type === filterType;
    return matchesSearch && matchesFilter;
  });

  const getTypeColor = (type: Network['type']) => {
    switch (type) {
      case 'protein': return 'bg-purple-100 text-purple-800';
      case 'metabolic': return 'bg-green-100 text-green-800';
      case 'regulatory': return 'bg-blue-100 text-blue-800';
      case 'signal': return 'bg-orange-100 text-orange-800';
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center">
        <div>
          <h1 className="text-3xl font-bold">Networks</h1>
          <p className="text-muted-foreground">View and analyze network models</p>
        </div>
      </div>

      {/* Search and Filter */}
      <Card>
        <CardContent className="p-4">
          <div className="flex gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search networks..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex gap-2">
              <Button
                variant={filterType === 'all' ? 'default' : 'outline'}
                onClick={() => setFilterType('all')}
              >
                All
              </Button>
              <Button
                variant={filterType === 'protein' ? 'default' : 'outline'}
                onClick={() => setFilterType('protein')}
              >
                Protein
              </Button>
              <Button
                variant={filterType === 'metabolic' ? 'default' : 'outline'}
                onClick={() => setFilterType('metabolic')}
              >
                Metabolic
              </Button>
              <Button
                variant={filterType === 'regulatory' ? 'default' : 'outline'}
                onClick={() => setFilterType('regulatory')}
              >
                Regulatory
              </Button>
              <Button
                variant={filterType === 'signal' ? 'default' : 'outline'}
                onClick={() => setFilterType('signal')}
              >
                Signal
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Networks Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredNetworks.map((network) => (
          <Card key={network.id} className="hover:shadow-lg transition-shadow cursor-pointer">
            <CardHeader className="pb-3">
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-2">
                  <Folder className="h-5 w-5 text-blue-500" />
                  <CardTitle className="text-lg">{network.name}</CardTitle>
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon">
                    <Download size={16} />
                  </Button>
                  <Button variant="ghost" size="icon">
                    <MoreHorizontal size={16} />
                  </Button>
                </div>
              </div>
              <CardDescription>{network.description}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between items-center">
                <Badge variant="secondary" className={getTypeColor(network.type)}>
                  {network.type}
                </Badge>
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Calendar size={14} />
                    {network.lastModified}
                  </div>
                </div>
              </div>
              
              <div className="flex justify-between text-sm">
                <div>
                  <Label className="text-xs text-muted-foreground">Nodes</Label>
                  <div className="font-medium">{network.nodes}</div>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Edges</Label>
                  <div className="font-medium">{network.edges}</div>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Version</Label>
                  <div className="font-medium">{network.version}</div>
                </div>
              </div>

              <Button 
                variant="default" 
                size="sm" 
                className="w-full"
                onClick={() => onProjectSelect(network.id)}
              >
                View Network
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Empty State */}
      {filteredNetworks.length === 0 && (
        <Card>
          <CardContent className="p-8 text-center">
            <Folder className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No networks found</h3>
            <p className="text-muted-foreground mb-4">
              {searchTerm || filterType !== 'all' 
                ? 'Try adjusting your search or filter criteria'
                : 'Select a project to view its networks'
              }
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}