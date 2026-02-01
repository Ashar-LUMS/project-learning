import { useEffect, useState} from "react";
import { formatTimestamp } from '@/lib/format';
import { supabase } from "../../supabaseClient";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Card, CardContent, CardHeader, CardDescription } from "../../components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../../components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { Label } from "../../components/ui/label";
import { Search, MoreVertical, Trash2, Edit3, Plus, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, AlertCircle, Folder, Users, Network, User } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "../../components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "../../components/ui/avatar";

type Project = {
  id: string;
  name: string;
  assignees?: string[] | null;
  created_at?: string | null;
  created_by?: string | null;
  creator_email?: string | null;
  networks?: any[] | null;
};

interface UserData {
  id: string;
  email: string;
  raw_user_meta_data: {
    name?: string;
    roles?: string[];
    isLocked?: boolean;
    avatar_url?: string;
  };
  created_at?: string;
}

// Project Info Dialog Component
const ProjectInfoDialog = ({
  project,
  open,
  onOpenChange,
  userMap,
}: {
  project: Project;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userMap?: Record<string, UserData>;
}) => {
  // Using shared formatTimestamp from @/lib/format
  const formatDate = (v?: string | null) => formatTimestamp(v) || 'Never';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Folder className="h-5 w-5" />
            Project Details
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-2 p-2">
          {/* Project Basic Info */}
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
              <Folder className="w-8 h-8 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">
                {project.name}
              </h3>
              <p className="text-gray-600 flex items-center gap-2">
                <Users className="w-4 h-4" />
                {project.assignees?.length || 0} assignees
              </p>
            </div>
          </div>

          {/* Project Details Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label className="text-sm font-medium text-gray-500">Project ID</Label>
              <p className="text-sm font-mono bg-gray-50 p-2 rounded border break-all">
                {project.id}
              </p>
            </div>
            
            <div className="space-y-1">
              <Label className="text-sm font-medium text-gray-500">Networks</Label>
              <div>
                <Badge variant="default" className="bg-blue-100 text-blue-800 hover:bg-blue-100 gap-1.5">
                  <Network className="w-3 h-3" /> {Array.isArray(project.networks) ? project.networks.length : 0} networks
                </Badge>
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-sm font-medium text-gray-500">Creator</Label>
              <p className="text-sm">{project.creator_email || project.created_by || 'Unknown'}</p>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium text-gray-500">Assignees</Label>
              {Array.isArray(project.assignees) && project.assignees.length > 0 ? (
                <div className="space-y-3">
                  {project.assignees.map((uid) => {
                    const user = userMap?.[uid];
                    return (
                      <div key={uid} className="flex items-start gap-3 p-2 border rounded-lg">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={user?.raw_user_meta_data?.avatar_url || ''} />
                          <AvatarFallback>
                            {(user?.raw_user_meta_data?.name || user?.email || 'U').slice(0,1).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                          <div className="text-sm font-medium text-gray-900">
                            {user?.raw_user_meta_data?.name || user?.email || uid}
                          </div>
                          <div className="text-xs text-gray-600 mt-1">
                            {user?.email}
                          </div>
                          {user?.raw_user_meta_data?.roles && user.raw_user_meta_data.roles.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2">
                              {user.raw_user_meta_data.roles.map((role) => (
                                <Badge key={role} variant="secondary" className="px-2 py-0.5 text-xs">
                                  {role}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <span className="text-sm text-gray-500">No assignees</span>
              )}
            </div>

            <div className="space-y-1">
              <Label className="text-sm font-medium text-gray-500">Created At</Label>
              <p className="text-sm">{formatDate(project.created_at)}</p>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// Fixed Pagination Component
interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  pageSize: number;
  totalItems: number;
  onPageSizeChange: (size: number) => void;
}

const Pagination = ({
  currentPage,
  totalPages,
  onPageChange,
  pageSize,
  onPageSizeChange
}: PaginationProps) => {
  const handlePageSizeChange = (value: string) => {
    const newSize = Number(value);
    onPageSizeChange(newSize);
  };

  return (
    <div className="flex items-center justify-between px-6 py-4 border-t">
      <div className="flex items-center space-x-2">
        <Label htmlFor="page-size" className="text-sm text-gray-600">
          Rows per page
        </Label>
        <Select
          value={pageSize.toString()}
          onValueChange={handlePageSizeChange}
        >
          <SelectTrigger className="h-8 w-[70px]">
            <SelectValue>
              <span>{pageSize}</span>
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="10">10</SelectItem>
            <SelectItem value="20">20</SelectItem>
            <SelectItem value="50">50</SelectItem>
            <SelectItem value="100">100</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center space-x-6 lg:space-x-8">
        <div className="flex w-[100px] items-center justify-center text-sm font-medium">
          Page {currentPage} of {totalPages}
        </div>
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            className="hidden h-8 w-8 p-0 lg:flex"
            onClick={() => onPageChange(1)}
            disabled={currentPage === 1}
          >
            <span className="sr-only">Go to first page</span>
            <ChevronsLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            className="h-8 w-8 p-0"
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage === 1}
          >
            <span className="sr-only">Go to previous page</span>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            className="h-8 w-8 p-0"
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
          >
            <span className="sr-only">Go to next page</span>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            className="hidden h-8 w-8 p-0 lg:flex"
            onClick={() => onPageChange(totalPages)}
            disabled={currentPage === totalPages}
          >
            <span className="sr-only">Go to last page</span>
            <ChevronsRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default function AdminProjectManagement() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [filteredProjects, setFilteredProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [networkFilter, setNetworkFilter] = useState<string>("all");

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Dialog states
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isProjectInfoDialogOpen, setIsProjectInfoDialogOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [projectForInfo, setProjectForInfo] = useState<Project | null>(null);

  // Assignee management dialog
  const [isAssigneeDialogOpen, setIsAssigneeDialogOpen] = useState(false);
  const [assigneeProject, setAssigneeProject] = useState<Project | null>(null);
  const [users, setUsers] = useState<UserData[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [selectedAssignees, setSelectedAssignees] = useState<string[]>([]);
  const [userMap, setUserMap] = useState<Record<string, UserData>>({});

  // Form states
  const [newProject, setNewProject] = useState({
    name: "",
    description: "",
  });
  const [editProject, setEditProject] = useState({
    name: "",
    description: "",
  });

  // Delete state
  const [deletingProjectId, setDeletingProjectId] = useState<string | null>(null);

  // Calculate pagination
  const totalItems = filteredProjects.length;
  const totalPages = Math.ceil(totalItems / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const currentProjects = filteredProjects.slice(startIndex, endIndex);

  // Reset to first page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, networkFilter, pageSize]);

  // Clear messages after timeout
  useEffect(() => {
    if (errorMessage || successMessage) {
      const timer = setTimeout(() => {
        setErrorMessage(null);
        setSuccessMessage(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [errorMessage, successMessage]);

  useEffect(() => {
    let mounted = true;
    
    const getCurrentUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUserEmail(user?.email || null);
    };

    const fetchProjects = async () => {
      setLoading(true);
      setErrorMessage(null);
      try {
        const { data, error } = await supabase
          .from('projects')
          .select(`id, name, assignees, created_at, created_by, creator_email, networks`);
          
        if (!mounted) return;
        if (error) throw error;

        const allProjects = (data as Project[]) || [];
        if (mounted) {
          setProjects(allProjects);
          setFilteredProjects(allProjects);
        }
      } catch (err: any) {
        if (mounted) setErrorMessage(err?.message || "Failed to load projects");
      } finally {
        if (mounted) setLoading(false);
      }
    };

    getCurrentUser();
    fetchProjects();
    return () => { mounted = false };
  }, []);

  // Fetch users on mount to ensure details are available across views
  useEffect(() => {
    let mounted = true;
    const fetchUsersInitial = async () => {
      setUsersLoading(true);
      try {
        const { data, error } = await supabase.rpc("get_users_as_admin");
        if (error) throw error;
        const list = (data as UserData[]) || [];
        if (mounted) {
          setUsers(list);
          const map: Record<string, UserData> = {};
          for (const u of list) {
            map[u.id] = u;
            if (u.email) map[u.email] = u; // allow email-based lookup fallback
          }
          setUserMap(map);
        }
      } catch (err: any) {
        setErrorMessage(err?.message || "Failed to load users");
      } finally {
        setUsersLoading(false);
      }
    };
    fetchUsersInitial();
    return () => { mounted = false };
  }, []);

  // Fetch users for assignments when dialog opens
  useEffect(() => {
    let mounted = true;
    const fetchUsers = async () => {
      if (!isAssigneeDialogOpen) return;
      setUsersLoading(true);
      try {
        const { data, error } = await supabase.rpc("get_users_as_admin");
        if (error) throw error;
        const list = (data as UserData[]) || [];
        if (mounted) {
          setUsers(list);
          const map: Record<string, UserData> = {};
          for (const u of list) {
            map[u.id] = u;
            if (u.email) map[u.email] = u;
          }
          setUserMap(map);
        }
      } catch (err: any) {
        setErrorMessage(err?.message || "Failed to load users");
      } finally {
        setUsersLoading(false);
      }
    };
    fetchUsers();
    return () => { mounted = false };
  }, [isAssigneeDialogOpen]);

  // Ensure user details are available when opening project info
  useEffect(() => {
    const ensureUsersForInfo = async () => {
      if (!isProjectInfoDialogOpen) return;
      if (Object.keys(userMap).length > 0) return;
      try {
        const { data, error } = await supabase.rpc("get_users_as_admin");
        if (error) throw error;
        const list = (data as UserData[]) || [];
        const map: Record<string, UserData> = {};
        for (const u of list) {
          map[u.id] = u;
          if (u.email) map[u.email] = u;
        }
        setUserMap(map);
      } catch (err: any) {
        setErrorMessage(err?.message || "Failed to load users for project info");
      }
    };
    ensureUsersForInfo();
  }, [isProjectInfoDialogOpen, userMap]);

  // Filter projects based on search and filters
  useEffect(() => {
    let result = projects;

    // Search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(project =>
        project.name.toLowerCase().includes(term) ||
        (project.creator_email?.toLowerCase() || "").includes(term) ||
        (project.created_by?.toLowerCase() || "").includes(term)
      );
    }

    // Network count filter
    if (networkFilter !== "all") {
      result = result.filter(project => {
        const networkCount = Array.isArray(project.networks) ? project.networks.length : 0;
        if (networkFilter === "0") return networkCount === 0;
        if (networkFilter === "1-5") return networkCount >= 1 && networkCount <= 5;
        if (networkFilter === "6+") return networkCount >= 6;
        return true;
      });
    }

    setFilteredProjects(result);
  }, [projects, searchTerm, networkFilter]);

  const openProjectInfoDialog = (project: Project) => {
    setProjectForInfo(project);
    setIsProjectInfoDialogOpen(true);
  };

  const openAssigneeDialog = (project: Project) => {
    setAssigneeProject(project);
    setSelectedAssignees(Array.isArray(project.assignees) ? project.assignees : []);
    setIsAssigneeDialogOpen(true);
  };

  const handleCreateProject = async () => {
    try {
      if (!newProject.name) {
        setErrorMessage("Project name is required");
        return;
      }

      const { data: { user } } = await supabase.auth.getUser();
      
      const { error } = await supabase
        .from('projects')
        .insert([{
          name: newProject.name,
          created_by: user?.id,
          creator_email: user?.email,
          assignees: [],
          networks: []
        }])
        .select();

      if (error) throw error;

      setSuccessMessage("Project created successfully");
      setIsCreateDialogOpen(false);
      setNewProject({ name: "", description: "" });
      
      // Refresh projects list
      const { data: updatedProjects, error: fetchError } = await supabase
        .from('projects')
        .select(`id, name, assignees, created_at, created_by, creator_email, networks`);

      if (!fetchError && updatedProjects) {
        setProjects(updatedProjects as Project[]);
      }
    } catch (err: any) {
      setErrorMessage(err?.message || "Failed to create project");
    }
  };

  const handleUpdateProject = async () => {
    if (!selectedProject) return;

    try {
      const { error } = await supabase
        .from('projects')
        .update({
          name: editProject.name,
        })
        .eq('id', selectedProject.id);

      if (error) throw error;

      setSuccessMessage("Project updated successfully");
      setIsEditDialogOpen(false);
      setSelectedProject(null);
      
      // Refresh projects list
      const { data: updatedProjects, error: fetchError } = await supabase
        .from('projects')
        .select(`id, name, assignees, created_at, created_by, creator_email, networks`);

      if (!fetchError && updatedProjects) {
        setProjects(updatedProjects as Project[]);
      }
    } catch (err: any) {
      setErrorMessage(err?.message || "Failed to update project");
    }
  };

  const handleSaveAssignees = async () => {
    if (!assigneeProject) return;
    try {
      const { error } = await supabase
        .from('projects')
        .update({ assignees: selectedAssignees })
        .eq('id', assigneeProject.id);
      if (error) throw error;

      setSuccessMessage('Assignees updated successfully');
      setProjects(prev => prev.map(p => p.id === assigneeProject.id ? { ...p, assignees: selectedAssignees } : p));
      setFilteredProjects(prev => prev.map(p => p.id === assigneeProject.id ? { ...p, assignees: selectedAssignees } : p));
      setIsAssigneeDialogOpen(false);
      setAssigneeProject(null);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to update assignees');
    }
  };

  const handleDeleteProject = async () => {
    if (!selectedProject) return;

    try {
      setDeletingProjectId(selectedProject.id);
      
      // First, delete all networks linked via the project's networks uuid[] array (if desired)
      // Note: If networks can be shared across projects, consider skipping this delete.
      if (selectedProject.networks && selectedProject.networks.length > 0) {
        const ids = (selectedProject.networks as any[])
          .filter((id) => typeof id === 'string');
        if (ids.length > 0) {
          const { error: networksError } = await supabase
            .from('networks')
            .delete()
            .in('id', ids);
          if (networksError) throw networksError;
        }
      }

      // Then delete the project itself
      const { error: projectError } = await supabase
        .from('projects')
        .delete()
        .eq('id', selectedProject.id);

      if (projectError) throw projectError;

      setProjects(prev => prev.filter(project => project.id !== selectedProject.id));
      setSuccessMessage("Project deleted successfully");
      setIsDeleteDialogOpen(false);
      setSelectedProject(null);
    } catch (err: any) {
      setErrorMessage(err?.message || "Failed to delete project");
    } finally {
      setDeletingProjectId(null);
    }
  };

  const openEditDialog = (project: Project) => {
    setSelectedProject(project);
    setEditProject({
      name: project.name,
      description: "",
    });
    setIsEditDialogOpen(true);
  };

  const openDeleteDialog = (project: Project) => {
    setSelectedProject(project);
    setIsDeleteDialogOpen(true);
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handlePageSizeChange = (size: number) => {
    setPageSize(size);
    setCurrentPage(1);
  };

  return (
    <div className="space-y-6 p-6">
      {/* Messages */}
      {errorMessage && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          {errorMessage}
        </div>
      )}
      {successMessage && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-green-700">
          {successMessage}
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Project Management</h1>
          <p className="text-gray-600 mt-2">Manage projects, networks, and assignments</p>
        </div>
        <div className="flex items-center gap-4 mt-4 sm:mt-0">
          <Badge variant="secondary" className="px-3 py-1">
            {totalItems} {totalItems === 1 ? 'project' : 'projects'}
          </Badge>
          <Button onClick={() => setIsCreateDialogOpen(true)} className="gap-2">
            <Plus className="w-4 h-4" />
            Add Project
          </Button>
        </div>
      </div>

      {/* Filters Card */}
      <Card>
        <CardContent className="pt-2">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                type="text"
                placeholder="Search projects by name or creator..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex gap-2">
              <Select value={networkFilter} onValueChange={setNetworkFilter}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Networks" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Networks</SelectItem>
                  <SelectItem value="0">No Networks</SelectItem>
                  <SelectItem value="1-5">1-5 Networks</SelectItem>
                  <SelectItem value="6+">6+ Networks</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <Card>
          <CardContent className="p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="text-gray-600 mt-2">Loading projects...</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardDescription>
              Showing {Math.min(totalItems, startIndex + 1)}-{Math.min(endIndex, totalItems)} of {totalItems} projects
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Project</TableHead>
                    <TableHead>Creator</TableHead>
                    <TableHead>Networks</TableHead>
                    <TableHead>Assignees</TableHead>
                    <TableHead>Created At</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {currentProjects.map((project) => (
                    <TableRow key={project.id} className="hover:bg-gray-50/50">
                      <TableCell>
                        <div className="flex items-center">
                          <button
                            onClick={() => openProjectInfoDialog(project)}
                            className="flex-shrink-0 w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center hover:opacity-80 transition-opacity cursor-pointer"
                          >
                            <Folder className="w-5 h-5 text-white" />
                          </button>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900">
                              {project.name}
                              {currentUserEmail && (project.creator_email === currentUserEmail || project.created_by === currentUserEmail) && (
                                <span className="ml-2 text-s text-muted-foreground">(Yours)</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm text-gray-900">
                          {project.creator_email || project.created_by || 'Unknown'}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="default" className="bg-blue-100 text-blue-800 hover:bg-blue-100 gap-1.5">
                          <Network className="w-3 h-3" /> {Array.isArray(project.networks) ? project.networks.length : 0}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary" className="px-2 py-1">
                              {(project.assignees || []).length} users
                            </Badge>
                            <Button variant="outline" size="sm" onClick={() => openAssigneeDialog(project)}>
                              Manage Assignees
                            </Button>
                          </div>
                          {Array.isArray(project.assignees) && project.assignees.length > 0 && (
                            <div className="space-y-2">
                              {project.assignees.slice(0,3).map((uid) => {
                                const user = userMap[uid];
                                return (
                                  <div key={uid} className="flex items-start gap-2">
                                    <Avatar className="h-6 w-6">
                                      <AvatarImage src={user?.raw_user_meta_data?.avatar_url || ''} />
                                      <AvatarFallback>
                                        {(user?.raw_user_meta_data?.name || user?.email || 'U').slice(0,1).toUpperCase()}
                                      </AvatarFallback>
                                    </Avatar>
                                    <div>
                                      <div className="text-xs font-medium text-gray-900">
                                        {user?.raw_user_meta_data?.name || user?.email || uid}
                                      </div>
                                      <div className="text-[11px] text-gray-600">
                                        {user?.email}
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                              {project.assignees.length > 3 && (
                                <div className="text-xs text-gray-500">+{project.assignees.length - 3} more</div>
                              )}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-gray-500">
                        {project.created_at
                          ? new Date(project.created_at).toLocaleDateString()
                          : 'Unknown'
                        }
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <MoreVertical className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48">
                              <DropdownMenuItem onClick={() => openProjectInfoDialog(project)}>
                                <Folder className="w-4 h-4 mr-2" />
                                View Details
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => openEditDialog(project)}>
                                <Edit3 className="w-4 h-4 mr-2" />
                                Edit Project
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => openAssigneeDialog(project)}>
                                <User className="w-4 h-4 mr-2" />
                                Manage Assignees
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => openDeleteDialog(project)}
                                className="text-red-600 focus:text-red-600"
                              >
                                <Trash2 className="w-4 h-4 mr-2" />
                                Delete Project
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {filteredProjects.length === 0 && (
              <div className="text-center py-12">
                <div className="text-gray-400 mb-2">No projects found</div>
                <p className="text-gray-500 text-sm">Try adjusting your search or filters</p>
              </div>
            )}

            {/* Pagination */}
            {filteredProjects.length > 0 && (
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={handlePageChange}
                pageSize={pageSize}
                totalItems={totalItems}
                onPageSizeChange={handlePageSizeChange}
              />
            )}
          </CardContent>
        </Card>
      )}

      {/* Create Project Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create New Project</DialogTitle>
            <DialogDescription>
              Add a new project to the system.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="project-name">Project Name *</Label>
              <Input
                id="project-name"
                type="text"
                value={newProject.name}
                onChange={(e) => setNewProject(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Enter project name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="project-description">Description</Label>
              <Input
                id="project-description"
                type="text"
                value={newProject.description}
                onChange={(e) => setNewProject(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Enter project description"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateProject} disabled={!newProject.name}>
              Create Project
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Project Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Project</DialogTitle>
            <DialogDescription>
              Update project information.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-project-name">Project Name *</Label>
              <Input
                id="edit-project-name"
                type="text"
                value={editProject.name}
                onChange={(e) => setEditProject(prev => ({ ...prev, name: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-project-description">Description</Label>
              <Input
                id="edit-project-description"
                type="text"
                value={editProject.description}
                onChange={(e) => setEditProject(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Enter project description"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdateProject} disabled={!editProject.name}>
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Manage Assignees Dialog */}
      <Dialog open={isAssigneeDialogOpen} onOpenChange={setIsAssigneeDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Manage Assignees
            </DialogTitle>
            <DialogDescription>
              Select team members for the project "{assigneeProject?.name}". Profile details show beneath names.
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-[50vh] overflow-y-auto space-y-3">
            {usersLoading ? (
              <div className="text-sm text-gray-500">Loading users...</div>
            ) : (
              users.map((u) => {
                const checked = selectedAssignees.includes(u.id);
                return (
                  <div key={u.id} className={`p-3 border rounded-lg ${checked ? 'bg-gray-50' : ''}`}>
                    <div className="flex items-start gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={u.raw_user_meta_data?.avatar_url || ''} />
                        <AvatarFallback>
                          {(u.raw_user_meta_data?.name || u.email || 'U').slice(0,1).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <div className="text-sm font-medium text-gray-900">
                            {u.raw_user_meta_data?.name || u.email}
                          </div>
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) => {
                              const isChecked = e.target.checked;
                              setSelectedAssignees((prev) =>
                                isChecked ? [...prev, u.id] : prev.filter(id => id !== u.id)
                              );
                            }}
                          />
                        </div>
                        <div className="text-xs text-gray-600 mt-1">{u.email}</div>
                        {u.raw_user_meta_data?.roles && u.raw_user_meta_data.roles.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {u.raw_user_meta_data.roles.map((role) => (
                              <Badge key={role} variant="secondary" className="px-2 py-0.5 text-xs">
                                {role}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAssigneeDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveAssignees} disabled={!assigneeProject}>
              Save Assignees
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Project Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-red-500" />
              Delete Project
            </DialogTitle>
            <DialogDescription className="space-y-3">
              <p>
                Are you sure you want to delete the project &quot;{selectedProject?.name}&quot;?
              </p>
              <div className="bg-red-50 text-red-900 px-4 py-3 rounded-md space-y-2">
                <p className="font-semibold">Warning:</p>
                <ul className="list-disc list-inside text-sm space-y-1">
                  <li>This action cannot be undone</li>
                  <li>All networks associated with this project will be permanently deleted</li>
                  <li>All users will lose access to this project</li>
                </ul>
              </div>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsDeleteDialogOpen(false)}
              disabled={deletingProjectId === selectedProject?.id}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteProject}
              disabled={deletingProjectId === selectedProject?.id}
            >
              {deletingProjectId === selectedProject?.id ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete Project
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Project Info Dialog */}
      {projectForInfo && (
        <ProjectInfoDialog
          project={projectForInfo}
          open={isProjectInfoDialogOpen}
          onOpenChange={setIsProjectInfoDialogOpen}
          userMap={userMap}
        />
      )}
    </div>
  );
}