import { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "../../components/ui/card";
import { useRole } from "../../getRole";
import { useOutletContext } from "react-router-dom";
import { supabase } from "../../supabaseClient";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "../../components/ui/dialog";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Badge } from "../../components/ui/badge";
import { Skeleton } from "../../components/ui/skeleton";
import { Search, Plus, Folder, Edit, Trash2, Users, AlertCircle, FileText, Calendar, UserCheck } from "lucide-react";

type Project = {
  id: string;
  name?: string | null;
  assignees?: string[] | null;
  created_at?: string | null;
};

type MinimalUser = {
  id: string;
  email: string | null;
  name?: string | null;
};

const HomePage = () => {
  const { roles: userRolesArray, isLoading: areRolesLoading } = useRole();
  const { activeRole } = useOutletContext<{ activeRole: string | null }>();

  const isAdmin = useMemo(() => {
    if (areRolesLoading) return false;
    if (!userRolesArray) return false;
    return userRolesArray.includes("Admin") && activeRole === "Admin";
  }, [userRolesArray, areRolesLoading, activeRole]);

  const [projects, setProjects] = useState<Project[] | null>(null);
  const [isProjectsLoading, setIsProjectsLoading] = useState(false);
  const [projectsError, setProjectsError] = useState<string | null>(null);
  const [adminUsers, setAdminUsers] = useState<MinimalUser[]>([]);
  const [isAdminUsersLoading, setIsAdminUsersLoading] = useState(false);
  const [adminUsersError, setAdminUsersError] = useState<string | null>(null);

  // Create Project dialog state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  
  const [selectedAssigneeIds, setSelectedAssigneeIds] = useState<Set<string>>(new Set());
  const [createError, setCreateError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [assigneeQuery, setAssigneeQuery] = useState("");
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [editName, setEditName] = useState("");
  const [editSelectedAssigneeIds, setEditSelectedAssigneeIds] = useState<Set<string>>(new Set());
  const [editAssigneeQuery, setEditAssigneeQuery] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const [isAssigneesOpen, setIsAssigneesOpen] = useState(false);
  const [assigneesProject, setAssigneesProject] = useState<Project | null>(null);

  const userIdToEmail = useMemo(() => {
    const map: Record<string, string> = {};
    for (const u of adminUsers) {
      map[u.id] = u.email ?? u.name ?? u.id;
    }
    return map;
  }, [adminUsers]);

  const filteredAdminUsers = useMemo(() => {
    const q = assigneeQuery.trim().toLowerCase();
    if (!q) return adminUsers;
    return adminUsers.filter((u) => {
      const name = (u.name || "").toLowerCase();
      const email = (u.email || "").toLowerCase();
      return name.includes(q) || email.includes(q);
    });
  }, [adminUsers, assigneeQuery]);

  const filteredAdminUsersForEdit = useMemo(() => {
    const q = editAssigneeQuery.trim().toLowerCase();
    if (!q) return adminUsers;
    return adminUsers.filter((u) => {
      const name = (u.name || "").toLowerCase();
      const email = (u.email || "").toLowerCase();
      return name.includes(q) || email.includes(q);
    });
  }, [adminUsers, editAssigneeQuery]);

  const userIdToUser = useMemo(() => {
    const map: Record<string, MinimalUser> = {};
    for (const u of adminUsers) map[u.id] = u;
    return map;
  }, [adminUsers]);

  useEffect(() => {
    const fetchProjects = async () => {
      // For admins: fetch all projects
      // For non-admins: fetch only projects where current user is an assignee
      if (areRolesLoading) return;
      if (!isAdmin && !currentUserId) return;
      setIsProjectsLoading(true);
      setProjectsError(null);
      try {
        let query = supabase
          .from("projects")
          .select("id, name, assignees, created_at")
          .order("created_at", { ascending: false });

        if (!isAdmin && currentUserId) {
          query = query.contains("assignees", [currentUserId]);
        }

        const { data, error } = await query;

        if (error) {
          setProjectsError(error.message || "Failed to load projects.");
          setProjects(null);
        } else {
          const projectList = (data || []) as Project[];
          setProjects(projectList);
        }
      } catch (e) {
        setProjectsError("Unexpected error while loading projects.");
        setProjects(null);
      } finally {
        setIsProjectsLoading(false);
      }
    };
    fetchProjects();
  }, [isAdmin, areRolesLoading, currentUserId]);

  // Fetch admin users once when admin view is active
  useEffect(() => {
    const fetchAdminUsers = async () => {
      if (!isAdmin) return;
      setIsAdminUsersLoading(true);
      setAdminUsersError(null);
      try {
        const { data, error } = await supabase.rpc("get_users_as_admin");
        if (error) {
          setAdminUsers([]);
          setAdminUsersError(error.message || "Failed to load users.");
        } else {
          const mapped: MinimalUser[] = (data || []).map((u: any) => ({
            id: u.id,
            email: u.email ?? null,
            name: u.raw_user_meta_data?.name ?? null,
          }));
          setAdminUsers(mapped);
        }
      } catch (_e) {
        setAdminUsersError("Unexpected error while loading users.");
        setAdminUsers([]);
      } finally {
        setIsAdminUsersLoading(false);
      }
    };
    fetchAdminUsers();
  }, [isAdmin]);

  // Load current user id once (for including as default assignee)
  useEffect(() => {
    const getUser = async () => {
      const { data } = await supabase.auth.getUser();
      setCurrentUserId(data.user?.id ?? null);
    };
    getUser();
  }, []);

  // Users are fetched once for admins; no dialog-specific fetch needed

  const toggleAssignee = (userId: string) => {
    setSelectedAssigneeIds(prev => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId); else next.add(userId);
      return next;
    });
  };

  const resetCreateForm = () => {
    setNewProjectName("");
    setSelectedAssigneeIds(new Set());
    setCreateError(null);
    setAssigneeQuery("");
  };

  const openEditDialog = (project: Project) => {
    setEditingProject(project);
    setEditName(project.name || "");
    setEditSelectedAssigneeIds(new Set(project.assignees || []));
    setEditAssigneeQuery("");
    setUpdateError(null);
    setIsEditOpen(true);
  };

  const toggleEditAssignee = (userId: string) => {
    setEditSelectedAssigneeIds(prev => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId); else next.add(userId);
      return next;
    });
  };

  const handleCreateProject = async () => {
    if (!isAdmin) return;
    setIsCreating(true);
    setCreateError(null);

    try {
      if (!newProjectName.trim()) {
        setCreateError("Project name is required.");
        setIsCreating(false);
        return;
      }

      const assigneesSet = new Set(selectedAssigneeIds);
      if (currentUserId) assigneesSet.add(currentUserId);
      const assigneesArray = Array.from(assigneesSet);

      const { error } = await supabase
        .from("projects")
        .insert([{ name: newProjectName.trim(), assignees: assigneesArray }]);

      if (error) {
        setCreateError(error.message || "Failed to create project.");
        setIsCreating(false);
        return;
      }

      // Refresh list
      setIsCreateOpen(false);
      resetCreateForm();
      // Re-fetch projects
      setIsProjectsLoading(true);
      const { data, error: refetchError } = await supabase
        .from("projects")
        .select("id, name, assignees, created_at")
        .order("created_at", { ascending: false });
      if (refetchError) {
        setProjectsError(refetchError.message || "Failed to load projects.");
        setProjects(null);
      } else {
        const projectList = (data || []) as Project[];
        setProjects(projectList);
        setProjectsError(null);
      }
    } catch (_e) {
      setCreateError("Unexpected error while creating project.");
    } finally {
      setIsCreating(false);
      setIsProjectsLoading(false);
    }
  };

  const handleUpdateProject = async () => {
    if (!isAdmin || !editingProject) return;
    if (!editName.trim()) {
      setUpdateError("Project name is required.");
      return;
    }
    setIsUpdating(true);
    setUpdateError(null);
    try {
      const assigneesArray = Array.from(editSelectedAssigneeIds);
      const { error } = await supabase
        .from("projects")
        .update({ name: editName.trim(), assignees: assigneesArray })
        .eq("id", editingProject.id);
      if (error) {
        setUpdateError(error.message || "Failed to update project.");
        return;
      }
      // Re-fetch projects
      setIsProjectsLoading(true);
      const { data, error: refetchError } = await supabase
        .from("projects")
        .select("id, name, assignees, created_at")
        .order("created_at", { ascending: false });
      if (refetchError) {
        setProjectsError(refetchError.message || "Failed to load projects.");
        setProjects(null);
      } else {
        const projectList = (data || []) as Project[];
        setProjects(projectList);
        setProjectsError(null);
      }
      setIsEditOpen(false);
      setEditingProject(null);
    } catch (_e) {
      setUpdateError("Unexpected error while updating project.");
    } finally {
      setIsUpdating(false);
      setIsProjectsLoading(false);
    }
  };

  const handleDeleteProject = async (project: Project) => {
    if (!isAdmin) return;
    const ok = window.confirm(`Delete project "${project.name || "Untitled Project"}"? This cannot be undone.`);
    if (!ok) return;
    try {
      const { error } = await supabase
        .from("projects")
        .delete()
        .eq("id", project.id);
      if (error) {
        setProjectsError(error.message || "Failed to delete project.");
        return;
      }
      // Re-fetch projects
      setIsProjectsLoading(true);
      const { data, error: refetchError } = await supabase
        .from("projects")
        .select("id, name, assignees, created_at")
        .order("created_at", { ascending: false });
      if (refetchError) {
        setProjectsError(refetchError.message || "Failed to load projects.");
        setProjects(null);
      } else {
        const projectList = (data || []) as Project[];
        setProjects(projectList);
        setProjectsError(null);
      }
    } catch (_e) {
      setProjectsError("Unexpected error while deleting project.");
    } finally {
      setIsProjectsLoading(false);
    }
  };

  return (
    <main className="flex-grow container mx-auto px-4 py-8">
      {/* Header Section */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Project Dashboard</h1>
        <p className="text-gray-600 mt-2">Manage and organize your projects</p>
      </div>

      {/* Projects section is visible to all users; admin gets extra controls */}
      {(
        <section className="w-full max-w-6xl mx-auto">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 gap-4">
            <div>
              <h2 className="text-2xl font-semibold text-gray-800">Projects</h2>
              <p className="text-gray-500 text-sm mt-1">
                {projects && projects.length > 0 
                  ? `${projects.length} project${projects.length !== 1 ? 's' : ''} in total` 
                  : 'No projects yet'}
              </p>
            </div>
            {isAdmin && (
              <Button 
                onClick={() => setIsCreateOpen(true)} 
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center gap-2 shadow-md hover:shadow-lg"
              >
                <Plus size={18} />
                New Project
              </Button>
            )}
          </div>
          
          {isProjectsLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <Card key={i} className="overflow-hidden border border-gray-200 rounded-xl">
                  <CardContent className="p-5">
                    <div className="flex items-center gap-3 mb-4">
                      <Skeleton className="h-10 w-10 rounded-full" />
                      <Skeleton className="h-5 w-40" />
                    </div>
                    <div className="space-y-2 mb-4">
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-4 w-5/6" />
                    </div>
                    <div className="flex justify-between items-center">
                      <Skeleton className="h-6 w-24" />
                      <Skeleton className="h-3 w-16" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : projectsError ? (
            <Card className="p-6 border border-red-200 bg-red-50 rounded-xl">
              <CardContent className="text-red-800 flex flex-col items-center justify-center py-6">
                <div className="bg-red-100 p-3 rounded-full mb-4">
                  <AlertCircle size={24} className="text-red-600" />
                </div>
                <h3 className="font-medium text-lg mb-2">Unable to load projects</h3>
                <p className="text-center text-red-700 mb-4">{projectsError}</p>
                <Button 
                  onClick={() => window.location.reload()}
                  variant="outline"
                  className="border-red-300 text-red-700 hover:bg-red-100"
                >
                  Try Again
                </Button>
              </CardContent>
            </Card>
          ) : projects && projects.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {projects.map((project) => (
                <Card key={project.id} className="overflow-hidden border border-gray-200 rounded-xl hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
                          <Folder size={20} />
                        </div>
                        <div className="min-w-0">
                          <h3 className="text-base font-semibold text-gray-900 truncate">{project.name || "Untitled Project"}</h3>
                          {project.created_at && (
                            <div className="mt-1 flex items-center text-gray-500">
                              <Calendar size={12} className="mr-1" />
                              <span className="text-xs">
                                {new Date(project.created_at).toLocaleDateString()}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                      {isAdmin && (
                        <div className="flex items-center gap-1">
                          <button
                            className="text-gray-500 hover:text-blue-600 p-1 rounded-full hover:bg-blue-50 transition-colors"
                            title="Edit project"
                            onClick={() => openEditDialog(project)}
                          >
                            <Edit size={16} />
                          </button>
                          <button
                            className="text-gray-500 hover:text-red-600 p-1 rounded-full hover:bg-red-50 transition-colors"
                            title="Delete project"
                            onClick={() => handleDeleteProject(project)}
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="mb-4">
                      <div className="h-px bg-gray-100 my-4"></div>
                      {project.assignees && project.assignees.length > 0 ? (
                        <div className="flex items-center justify-between">
                          <button
                            type="button"
                            className="flex -space-x-2 group"
                            title="View assignees"
                            onClick={() => { setAssigneesProject(project); setIsAssigneesOpen(true); }}
                          >
                            {project.assignees.slice(0, 3).map((id) => {
                              const label = userIdToEmail[id] || id;
                              const initials = (label || "").split(/[\s@._-]+/).filter(Boolean).slice(0,2).map(s => s[0]?.toUpperCase()).join("") || "?";
                              return (
                                <div key={id} className="h-7 w-7 rounded-full bg-blue-100 border-2 border-white flex items-center justify-center text-xs font-medium text-blue-700 group-hover:ring-2 group-hover:ring-blue-100 transition-all" title={label}>
                                  {initials}
                                </div>
                              );
                            })}
                            {project.assignees.length > 3 && (
                              <div className="h-7 w-7 rounded-full bg-gray-100 border-2 border-white flex items-center justify-center text-xs font-medium text-gray-600 group-hover:ring-2 group-hover:ring-blue-100">
                                +{project.assignees.length - 3}
                              </div>
                            )}
                          </button>
                          <Badge variant="outline" className="text-xs">
                            <UserCheck size={12} className="mr-1" />
                            {project.assignees.length} {project.assignees.length === 1 ? 'assignee' : 'assignees'}
                          </Badge>
                        </div>
                      ) : (
                        <div className="text-sm text-gray-500 flex items-center">
                          <Users size={14} className="mr-2" />
                          No assignees yet
                        </div>
                      )}
                    </div>

                    <Button 
                      variant="outline" 
                      className="w-full border-gray-300 text-gray-700 hover:bg-gray-100"
                      onClick={() => { /* Add navigation to project detail */ }}
                    >
                      View Project
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="p-8 text-center border border-dashed border-gray-300 bg-gray-50 rounded-xl">
              <CardContent className="flex flex-col items-center">
                <div className="bg-gray-200 p-4 rounded-full mb-4">
                  <FileText size={32} className="text-gray-500" />
                </div>
                <h3 className="text-lg font-medium text-gray-700 mb-2">No projects found</h3>
                <p className="text-gray-500 mb-6 max-w-md">Only Admins can create projects. Organize tasks and collaborate with your team.</p>
                {isAdmin && (
                  <Button 
                    onClick={() => setIsCreateOpen(true)}
                    className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center gap-2"
                  >
                    <Plus size={18} />
                    Create Your First Project
                  </Button>
                )}
              </CardContent>
            </Card>
          )}
        </section>
      )}

      {/* Create Project Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={(open) => { setIsCreateOpen(open); if (!open) resetCreateForm(); }}>
        <DialogContent className="sm:max-w-xl rounded-xl">
          <DialogHeader className="pb-2">
            <DialogTitle className="text-xl flex items-center gap-2">
              <Folder size={20} />
              Create New Project
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-5 py-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Project Name</label>
              <Input
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                placeholder="e.g. Marketing Campaign Q3"
                className="py-2 px-3"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-700">Assign Team Members</label>
                <span className="text-xs text-gray-500">{selectedAssigneeIds.size} selected</span>
              </div>
              {isAdminUsersLoading ? (
                <div className="flex items-center justify-center h-20 border rounded-lg bg-gray-50">
                  <div className="flex items-center text-gray-500">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
                    Loading team members...
                  </div>
                </div>
              ) : (
                <>
                  <div className="mb-3 relative">
                    <Search size={18} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                    <Input
                      value={assigneeQuery}
                      onChange={(e) => setAssigneeQuery(e.target.value)}
                      placeholder="Search team members by name or email"
                      className="py-2 px-3 pl-9"
                    />
                  </div>
                  <div className="max-h-60 overflow-auto border rounded-lg divide-y">
                    {adminUsers.length === 0 ? (
                      <div className="text-sm text-gray-500 p-4 text-center">No team members available.</div>
                    ) : filteredAdminUsers.length === 0 ? (
                      <div className="text-sm text-gray-500 p-4 text-center">No matching team members found.</div>
                    ) : (
                      filteredAdminUsers.map((u) => (
                        <label key={u.id} className="flex items-center gap-3 py-3 px-4 hover:bg-gray-50 cursor-pointer transition-colors">
                          <input
                            type="checkbox"
                            className="h-4 w-4 text-blue-600 rounded focus:ring-blue-500"
                            checked={selectedAssigneeIds.has(u.id)}
                            onChange={() => toggleAssignee(u.id)}
                          />
                          <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 text-sm font-medium">
                            {(u.name || u.email || '?').charAt(0).toUpperCase()}
                          </div>
                          <div className="flex flex-col">
                            <span className="text-sm font-medium text-gray-900">{u.name || "Unnamed User"}</span>
                            <span className="text-xs text-gray-500">{u.email || "No email"}</span>
                          </div>
                        </label>
                      ))
                    )}
                  </div>
                </>
              )}
              {adminUsersError && (
                <div className="text-xs text-red-600 mt-2 flex items-center">
                  <AlertCircle size={14} className="mr-1" />
                  {adminUsersError}
                </div>
              )}
              {currentUserId && (
                <p className="text-xs text-gray-500 mt-3 flex items-center">
                  <UserCheck size={14} className="mr-1" />
                  You will be added as an Collaborator by default.
                </p>
              )}
            </div>

            {createError && (
              <div className="text-sm text-red-600 bg-red-50 p-3 rounded-lg flex items-center">
                <AlertCircle size={16} className="mr-2" />
                {createError}
              </div>
            )}
          </div>

          <DialogFooter className="mt-2">
            <Button 
              variant="outline" 
              onClick={() => { setIsCreateOpen(false); resetCreateForm(); }} 
              disabled={isCreating}
            >
              Cancel
            </Button>
            <Button 
              onClick={handleCreateProject} 
              disabled={isCreating || !newProjectName.trim()}
              className="min-w-24"
            >
              {isCreating ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Creating...
                </>
              ) : "Create Project"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assignees Dialog */}
      <Dialog open={isAssigneesOpen} onOpenChange={(open) => { setIsAssigneesOpen(open); if (!open) setAssigneesProject(null); }}>
        <DialogContent className="sm:max-w-md rounded-xl">
          <DialogHeader className="pb-2">
            <DialogTitle className="text-xl flex items-center gap-2">
              <Users size={20} />
              Project Assignees
              {assigneesProject && `: ${assigneesProject.name || "Untitled Project"}`}
            </DialogTitle>
          </DialogHeader>
          <div className="py-4 max-h-96 overflow-auto">
            {assigneesProject && assigneesProject.assignees && assigneesProject.assignees.length > 0 ? (
              <div className="space-y-3">
                {assigneesProject.assignees.map((id) => {
                  const u = userIdToUser[id];
                  const label = u?.name || u?.email || id;
                  const initials = (label || "").split(/[\s@._-]+/).filter(Boolean).slice(0,2).map(s => s[0]?.toUpperCase()).join("") || "?";
                  return (
                    <div key={id} className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors">
                      <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center text-sm font-medium text-blue-700">
                        {initials}
                      </div>
                      <div className="flex flex-col">
                        <span className="text-sm font-medium text-gray-900">{u?.name || "Unnamed User"}</span>
                        <span className="text-xs text-gray-500">{u?.email || "No email"}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <Users size={40} className="mx-auto mb-3 text-gray-400" />
                <p>No assignees for this project</p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAssigneesOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Project Dialog */}
      <Dialog open={isEditOpen} onOpenChange={(open) => { setIsEditOpen(open); if (!open) { setEditingProject(null); setUpdateError(null); } }}>
        <DialogContent className="sm:max-w-xl rounded-xl">
          <DialogHeader className="pb-2">
            <DialogTitle className="text-xl flex items-center gap-2">
              <Edit size={20} />
              Edit Project
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-5 py-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Project Name</label>
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="Enter project name"
                className="py-2 px-3"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-700">Assign Team Members</label>
                <span className="text-xs text-gray-500">{editSelectedAssigneeIds.size} selected</span>
              </div>
              {isAdminUsersLoading ? (
                <div className="flex items-center justify-center h-20 border rounded-lg bg-gray-50">
                  <div className="flex items-center text-gray-500">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
                    Loading team members...
                  </div>
                </div>
              ) : (
                <>
                  <div className="mb-3 relative">
                    <Search size={18} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                    <Input
                      value={editAssigneeQuery}
                      onChange={(e) => setEditAssigneeQuery(e.target.value)}
                      placeholder="Search team members by name or email"
                      className="py-2 px-3 pl-9"
                    />
                  </div>
                  <div className="max-h-60 overflow-auto border rounded-lg divide-y">
                    {adminUsers.length === 0 ? (
                      <div className="text-sm text-gray-500 p-4 text-center">No team members available.</div>
                    ) : filteredAdminUsersForEdit.length === 0 ? (
                      <div className="text-sm text-gray-500 p-4 text-center">No matching team members found.</div>
                    ) : (
                      filteredAdminUsersForEdit.map((u) => (
                        <label key={u.id} className="flex items-center gap-3 py-3 px-4 hover:bg-gray-50 cursor-pointer transition-colors">
                          <input
                            type="checkbox"
                            className="h-4 w-4 text-blue-600 rounded focus:ring-blue-500"
                            checked={editSelectedAssigneeIds.has(u.id)}
                            onChange={() => toggleEditAssignee(u.id)}
                          />
                          <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 text-sm font-medium">
                            {(u.name || u.email || '?').charAt(0).toUpperCase()}
                          </div>
                          <div className="flex flex-col">
                            <span className="text-sm font-medium text-gray-900">{u.name || "Unnamed User"}</span>
                            <span className="text-xs text-gray-500">{u.email || "No email"}</span>
                          </div>
                        </label>
                      ))
                    )}
                  </div>
                </>
              )}
              {adminUsersError && (
                <div className="text-xs text-red-600 mt-2 flex items-center">
                  <AlertCircle size={14} className="mr-1" />
                  {adminUsersError}
                </div>
              )}
            </div>

            {updateError && (
              <div className="text-sm text-red-600 bg-red-50 p-3 rounded-lg flex items-center">
                <AlertCircle size={16} className="mr-2" />
                {updateError}
              </div>
            )}
          </div>

          <DialogFooter className="mt-2">
            <Button 
              variant="outline" 
              onClick={() => { setIsEditOpen(false); setEditingProject(null); }} 
              disabled={isUpdating}
            >
              Cancel
            </Button>
            <Button 
              onClick={handleUpdateProject} 
              disabled={isUpdating || !editName.trim()}
              className="min-w-24"
            >
              {isUpdating ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Saving...
                </>
              ) : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
};

export default HomePage;