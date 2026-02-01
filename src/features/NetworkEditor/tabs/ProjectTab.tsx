"use client";

import { useCallback, useEffect, useMemo, useState } from 'react';
import { formatDate } from '@/lib/format';
import { useRole } from '../../../getRole';
import { supabase } from '../../../supabaseClient';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Folder, Search } from 'lucide-react';

interface ProjectRecord {
  id: string;
  name?: string | null;
  assignees?: string[] | null;
  created_at?: string | null;
  created_by?: string | null;
  creator_email?: string | null;
  networks?: string[] | null;
}

interface ProjectTabProps {
  onProjectSelect: (projectId: string | null) => void;
}

export default function ProjectTab({ onProjectSelect }: ProjectTabProps) {
  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [refreshIndex, setRefreshIndex] = useState(0);
  const { roles: userRoles, isLoading: rolesLoading } = useRole();
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const isAdmin = useMemo(() => {
    if (rolesLoading) return null; // unknown yet
    return (userRoles || []).includes('Admin');
  }, [userRoles, rolesLoading]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      setCurrentUserId(data.user?.id ?? null);
    })();
  }, []);

  const fetchProjects = useCallback(async () => {
    if (isAdmin === null) return; // wait for roles resolution
    if (!isAdmin && !currentUserId) return; // need user id for filtering
    setIsLoading(true); setError(null);
    try {
      let query = supabase
        .from('projects')
        .select('id, name, assignees, created_at, created_by, creator_email, networks')
        .order('created_at', { ascending: false });
      if (!isAdmin && currentUserId) {
        query = query.contains('assignees', [currentUserId]);
      }
      const { data, error } = await query;
      if (error) throw error;
      setProjects((data || []) as ProjectRecord[]);
    } catch (e: any) {
      setError(e?.message || 'Failed to load projects');
      setProjects([]);
    } finally {
      setIsLoading(false);
    }
  }, [isAdmin, currentUserId]);

  useEffect(() => { fetchProjects(); }, [fetchProjects, refreshIndex]);

  const filteredProjects = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return projects;
    return projects.filter(p => (p.name || '').toLowerCase().includes(term) || (p.creator_email || '').toLowerCase().includes(term));
  }, [projects, searchTerm]);

  const onRefresh = () => setRefreshIndex(i => i + 1);

  // Using shared formatDate from @/lib/format

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Projects</h1>
          <p className="text-muted-foreground">All available projects (same as Home &ldquo;All&rdquo;)</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={onRefresh}>Refresh</Button>
        </div>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="p-4">
          <div className="flex gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search projects by name or creator..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Projects Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="p-4 space-y-4">
              <Skeleton className="h-6 w-40" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-10 w-full" />
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredProjects.map((project) => (
            <Card key={project.id} className="hover:shadow-lg transition-shadow cursor-pointer">
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-2">
                    <Folder className="h-5 w-5 text-blue-500" />
                    <CardTitle className="text-lg truncate" title={project.name || 'Untitled'}>{project.name || 'Untitled'}</CardTitle>
                  </div>
                  <div className="flex items-center gap-1">
                    <Badge variant="secondary" className="text-xs">
                      {(project.assignees || []).length} users
                    </Badge>
                  </div>
                </div>
                <CardDescription className="text-xs mt-1">
                  Created {formatDate(project.created_at)}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between items-center text-xs text-muted-foreground">
                  <span>{Array.isArray(project.networks) ? project.networks.length : 0} networks</span>
                  <span>{project.creator_email || project.created_by || 'Unknown owner'}</span>
                </div>
                <Button
                  variant="default"
                  size="sm"
                  className="w-full"
                  onClick={() => onProjectSelect(project.id)}
                >
                  Open Project
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Empty State */}
      {!isLoading && filteredProjects.length === 0 && (
        <Card>
          <CardContent className="p-8 text-center">
            <Folder className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No projects found</h3>
            <p className="text-muted-foreground mb-4">
              {searchTerm ? 'Try adjusting your search query.' : 'No projects are available.'}
            </p>
            {error && <p className="text-red-600 text-xs mt-2">{error}</p>}
          </CardContent>
        </Card>
      )}
      {error && (
        <div className="text-red-600 text-sm">{error}</div>
      )}
    </div>
  );
}