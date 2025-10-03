import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "../../components/ui/card";
import { useRole } from "../../getRole";
import { useOutletContext } from "react-router-dom";
import { supabase } from "../../supabaseClient";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "../../components/ui/dialog";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Badge } from "../../components/ui/badge";
import { Skeleton } from "../../components/ui/skeleton";
import sampleNetwork from "../../sampleNetwork.js";
import { Search, Plus, Folder, Edit, Trash2, Users, AlertCircle, FileText, Calendar, UserCheck, Loader2, Filter, X, Eye } from "lucide-react";
import NetworkGraph from "./NetworkGraph"; 

type Project = {
  id: string;
  name?: string | null;
  assignees?: string[] | null;
  created_at?: string | null;
  created_by?: string | null;
  creator_email?: string | null;
};

type MinimalUser = {
  id: string;
  email: string | null;
  name?: string | null;
  roles?: string[] | null;
  is_locked?: boolean | null;
};

const useUsers = (enabled: boolean) => {
  const [users, setUsers] = useState<MinimalUser[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let mounted = true;
    setIsLoading(true);
    (async () => {
      try {
        const { data, error } = await supabase.rpc("get_users");
        if (!mounted) return;
        if (error) {
          setError(error.message || "Failed to load users");
          setUsers([]);
        } else {
          const list: MinimalUser[] = ((data || []) as any[]).map((u) => {
            const meta = (u.raw_user_meta_data || u.user_metadata || {}) as any;
            const name = meta.name ?? meta.full_name ?? null;
            const roles = Array.isArray(meta.roles) ? meta.roles : (typeof meta.roles === 'string' ? [meta.roles] : null);
            return {
              id: u.id,
              email: u.email ?? null,
              name,
              roles,
              is_locked: meta.isLocked ?? meta.is_locked ?? null,
            } as MinimalUser;
          });
          setUsers(list);
          setError(null);
        }
      } catch (e) {
        if (!mounted) return;
        setError("Unexpected error while loading users.");
        setUsers([]);
      } finally {
        if (mounted) setIsLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [enabled]);

  return { users, isLoading, error } as const;
};

const useProjects = (isAdmin: boolean | null, currentUserId: string | null) => {
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    if (isAdmin === null) return;
    if (!isAdmin && !currentUserId) return;
    setIsLoading(true);
    setError(null);
    try {
      let query = supabase
        .from("projects")
        .select("id, name, assignees, created_at, created_by, creator_email")
        .order("created_at", { ascending: false });

      if (!isAdmin && currentUserId) {
        query = query.contains("assignees", [currentUserId]);
      }

      const { data, error } = await query;
      if (error) {
        setError(error.message || "Failed to load projects.");
        setProjects(null);
      } else {
        setProjects((data || []) as Project[]);
      }
    } catch (e) {
      setError("Unexpected error while loading projects.");
      setProjects(null);
    } finally {
      setIsLoading(false);
    }
  }, [isAdmin, currentUserId]);

  useEffect(() => { fetch(); }, [fetch]);

  return { projects, isLoading, error, refetch: fetch } as const;
};

const HomePage: React.FC = () => {
  const { roles: userRolesArray, isLoading: areRolesLoading } = useRole();
  const { activeRole } = useOutletContext<{ activeRole: string | null }>();

  const isAdmin = useMemo(() => {
    if (areRolesLoading) return false;
    if (!userRolesArray) return false;
    return userRolesArray.includes("Admin") && activeRole === "Admin";
  }, [userRolesArray, areRolesLoading, activeRole]);

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [selectedAssigneeIds, setSelectedAssigneeIds] = useState<Set<string>>(new Set());
  const [isCreateLoading, setIsCreateLoading] = useState(false);

  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [editName, setEditName] = useState("");
  const [editSelectedAssigneeIds, setEditSelectedAssigneeIds] = useState<Set<string>>(new Set());
  const [isUpdateLoading, setIsUpdateLoading] = useState(false);

  const [isAssigneesOpen, setIsAssigneesOpen] = useState(false);
  const [assigneesProject, setAssigneesProject] = useState<Project | null>(null);
  const [visualizeProjectId, setVisualizeProjectId] = useState<string | null>(null);

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null);

  const [deleteCandidate, setDeleteCandidate] = useState<Project | null>(null);
  const [isDeleteLoading, setIsDeleteLoading] = useState(false);

  const [searchTerm] = useState("");
  const [sortBy] = useState<"recent" | "name">("recent");
  const [adminView, setAdminView] = useState<"all" | "mine">("all");

  const [banner, setBanner] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const [createTeamSearch, setCreateTeamSearch] = useState("");
  const [editTeamSearch, setEditTeamSearch] = useState("");

  const { users, isLoading: isUsersLoading, error: usersError } = useUsers(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      setCurrentUserId(data.user?.id ?? null);
      setCurrentUserEmail(data.user?.email ?? null);
    })();
  }, []);

  const { projects, isLoading: isProjectsLoading, error: projectsError, refetch: refetchProjects } = useProjects(isAdmin, currentUserId);

  const toggleAssignee = useCallback((userId: string, setter: React.Dispatch<React.SetStateAction<Set<string>>>) => {
    setter((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId); else next.add(userId);
      return next;
    });
  }, []);

  useEffect(() => {
    if (!isCreateOpen) return;
    if (!currentUserId) return;
    setSelectedAssigneeIds((prev) => {
      const next = new Set(prev);
      next.add(currentUserId);
      return next;
    });
  }, [isCreateOpen, currentUserId]);

  const resetCreateForm = useCallback(() => {
    setNewProjectName("");
    setSelectedAssigneeIds(new Set());
  }, []);

  const handleCreateProject = useCallback(async () => {
    if (!newProjectName.trim()) return;

    try {
      setIsCreateLoading(true);
      const assigneesSet = new Set(selectedAssigneeIds);
      if (currentUserId) assigneesSet.add(currentUserId);
      const assigneesArray = Array.from(assigneesSet);

      const { error } = await supabase.from("projects").insert([{
        name: newProjectName.trim(),
        assignees: assigneesArray,
        creator_email: currentUserEmail,
        created_by: currentUserId,
        network_data: sampleNetwork,
      }]);

      if (error) throw error;

      setIsCreateOpen(false);
      resetCreateForm();
      refetchProjects();
      setBanner({ type: "success", message: "Project created successfully." });
    } catch (err: any) {
      setBanner({ type: "error", message: err?.message || "Failed to create project." });
    }
    finally {
      setIsCreateLoading(false);
    }
  }, [newProjectName, selectedAssigneeIds, currentUserId, currentUserEmail, resetCreateForm, refetchProjects]);

  const openEditDialog = useCallback((project: Project) => {
    setEditingProject(project);
    setEditName(project.name || "");
    setEditSelectedAssigneeIds(new Set(project.assignees || []));
    const creator = users.find((a) => a.email === project.creator_email);
    if (creator?.id) {
      setEditSelectedAssigneeIds((prev) => {
        const next = new Set(prev);
        next.add(creator.id);
        return next;
      });
    }
    setIsEditOpen(true);
  }, [users]);

  const handleUpdateProject = useCallback(async () => {
    if (!editingProject) return;
    if (!editName.trim()) return;
    try {
      setIsUpdateLoading(true);
      const assigneesArray = Array.from(editSelectedAssigneeIds);
      const { error } = await supabase.from("projects").update({ name: editName.trim(), assignees: assigneesArray }).eq("id", editingProject.id);
      if (error) throw error;
      setIsEditOpen(false);
      setEditingProject(null);
      refetchProjects();
      setBanner({ type: "success", message: "Project updated." });
    } catch (err: any) {
      setBanner({ type: "error", message: err?.message || "Failed to update project." });
    } finally {
      setIsUpdateLoading(false);
    }
  }, [editingProject, editName, editSelectedAssigneeIds, refetchProjects]);

  const confirmDeleteProject = useCallback(async () => {
    if (!deleteCandidate) return;
    setIsDeleteLoading(true);
    try {
      const { error } = await supabase.from("projects").delete().eq("id", deleteCandidate.id);
      if (error) throw error;
      setDeleteCandidate(null);
      refetchProjects();
      setBanner({ type: "success", message: "Project deleted." });
    } catch (err: any) {
      setBanner({ type: "error", message: err?.message || "Failed to delete project." });
    } finally {
      setIsDeleteLoading(false);
    }
  }, [deleteCandidate, refetchProjects]);

  const openAssigneesDialog = useCallback((project: Project) => {
    setAssigneesProject(project);
    setIsAssigneesOpen(true);
  }, []);

  const userIdToLabel = useMemo(() => {
    const map: Record<string, string> = {};
    for (const u of users) map[u.id] = u.name || u.email || u.id;
    return map;
  }, [users]);

  const userIdToUser = useMemo(() => {
    const map: Record<string, MinimalUser> = {};
    for (const u of users) map[u.id] = u;
    return map;
  }, [users]);

  const emailToName = useMemo(() => {
    const map: Record<string, string> = {};
    for (const u of users) if (u.email) map[u.email] = u.name || u.email;
    return map;
  }, [users]);

  const displayedProjects = useMemo(() => {
    let list = (projects || []).slice();
    if (isAdmin && adminView === "mine" && currentUserId) {
      list = list.filter(p => (p.assignees || []).includes(currentUserId));
    }
    
    const q = searchTerm.trim().toLowerCase();
    if (q) {
      list = list.filter(p => {
        const name = (p.name || "").toLowerCase();
        const creator = (p.creator_email || "").toLowerCase();
        return name.includes(q) || creator.includes(q);
      });
    }
    if (sortBy === "name") {
      list.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
    } else {
      list.sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
    }
    return list;
  }, [projects, isAdmin, adminView, currentUserId, searchTerm, sortBy]);

  const filteredUsersForCreate = useMemo(() => {
    const q = createTeamSearch.trim().toLowerCase();
    if (!q) return users;
    return users.filter(u => (u.name || u.email || "").toLowerCase().includes(q));
  }, [users, createTeamSearch]);

  const filteredUsersForEdit = useMemo(() => {
    const q = editTeamSearch.trim().toLowerCase();
    if (!q) return users;
    return users.filter(u => (u.name || u.email || "").toLowerCase().includes(q));
  }, [users, editTeamSearch]);

  return (
    <main className="flex-grow container mx-auto px-4 py-8">
      {/* Header Section */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-2 h-8 bg-gradient-to-b from-[#2f5597] to-[#3b6bc9] rounded-full"></div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
            Project Dashboard
          </h1>
        </div>
        <p className="text-[#4b5563] text-lg">Manage and organize your projects with your team</p>
      </div>

      {/* Banner */}
      {banner && (
        <div 
          className={`mb-8 rounded-2xl border p-4 flex items-start justify-between backdrop-blur-sm animate-fade-in ${
            banner.type === 'success' 
              ? 'bg-green-50/80 border-green-200 text-green-800' 
              : 'bg-[#fee2e2]/80 border-[#fecaca] text-[#b91c1c]'
          }`}
        >
          <div className="flex items-start gap-3">
            <div className={`mt-0.5 rounded-full p-2 ${
              banner.type === 'success' ? 'bg-green-100' : 'bg-[#fee2e2]'
            }`}>
              {banner.type === 'success' ? <UserCheck size={16} /> : <AlertCircle size={16} />}
            </div>
            <p className="text-sm font-medium">{banner.message}</p>
          </div>
          <button 
            className="text-sm opacity-70 hover:opacity-100 transition-opacity"
            onClick={() => setBanner(null)}
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* Controls Section */}
      <section className="mb-8">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex items-center gap-4">
            {isAdmin && (
              <div className="flex rounded-xl border border-gray-200 bg-white overflow-hidden shadow-sm">
                <button 
                  className={`px-4 py-2 text-sm font-medium transition-all ${
                    adminView === 'all' 
                      ? 'bg-[#2f5597] text-white shadow-md' 
                      : 'text-[#4b5563] hover:text-gray-900'
                  }`}
                  onClick={() => setAdminView('all')}
                >
                  <Filter className="inline mr-2" size={14} />
                  All Projects
                </button>
                <button 
                  className={`px-4 py-2 text-sm font-medium transition-all border-l ${
                    adminView === 'mine' 
                      ? 'bg-[#2f5597] text-white shadow-md' 
                      : 'text-[#4b5563] hover:text-gray-900'
                  }`}
                  onClick={() => setAdminView('mine')}
                >
                  My Projects
                </button>
              </div>
            )}
          </div>

          <Button 
            onClick={() => setIsCreateOpen(true)}
            className="flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-white transition-all duration-300 hover:scale-105 active:scale-95 shadow-lg hover:shadow-xl"
            style={{
              background: 'linear-gradient(135deg, #2f5597 0%, #3b6bc9 100%)',
            }}
          >
            <Plus size={20} />
            New Project
          </Button>
        </div>
      </section>

      {/* Projects Grid */}
      <section>
        {isProjectsLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {[1,2,3,4,5,6].map(i => (
              <Card key={i} className="rounded-2xl border-0 bg-white/80 backdrop-blur-sm overflow-hidden shadow-lg">
                <CardContent className="p-6">
                  <div className="flex items-center gap-4 mb-4">
                    <Skeleton className="h-12 w-12 rounded-xl bg-gradient-to-br from-gray-200 to-gray-300" />
                    <Skeleton className="h-6 flex-1 bg-gradient-to-r from-gray-200 to-gray-300" />
                  </div>
                  <div className="space-y-3">
                    <Skeleton className="h-4 w-full bg-gradient-to-r from-gray-200 to-gray-300" />
                    <Skeleton className="h-4 w-5/6 bg-gradient-to-r from-gray-200 to-gray-300" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : projectsError ? (
          <Card className="rounded-2xl border-0 bg-gradient-to-br from-red-50 to-red-100/50 backdrop-blur-sm shadow-lg">
            <CardContent className="p-8 text-center">
              <div className="w-16 h-16 bg-red-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <AlertCircle size={32} className="text-red-600" />
              </div>
              <h3 className="text-xl font-semibold text-red-900 mb-2">Unable to load projects</h3>
              <p className="text-red-700 mb-6">{projectsError}</p>
              <Button 
                variant="outline" 
                onClick={() => refetchProjects()}
                className="border-red-300 text-red-700 hover:bg-red-50 rounded-xl"
              >
                Try Again
              </Button>
            </CardContent>
          </Card>
        ) : displayedProjects && displayedProjects.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {displayedProjects.map(project => (
              <Card 
                key={project.id}
                className="group rounded-2xl border border-gray-200/60 bg-white/80 backdrop-blur-sm overflow-hidden transition-all duration-500 hover:shadow-2xl hover:-translate-y-2 hover:border-blue-200/60 shadow-lg"
              >
                <CardContent className="p-6">
                  {/* Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#b1ceff] to-[#003db6] flex items-center justify-center text-white shadow-lg">
                        <Folder size={24} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="text-lg font-semibold text-gray-900 truncate">
                          {project.name || 'Untitled Project'}
                        </h3>
                        {project.created_at && (
                          <div className="flex items-center text-[#6b7280] text-sm mt-1">
                            <Calendar size={14} className="mr-1.5" />
                            {new Date(project.created_at).toLocaleDateString()}
                          </div>
                        )}
                      </div>
                    </div>
                    
                    {/* Actions */}
                    {(isAdmin || (currentUserId && project.assignees?.includes(currentUserId))) && (
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          className="p-2 text-gray-400 hover:text-[#2f5597] hover:bg-blue-50 rounded-lg transition-all"
                          onClick={() => openEditDialog(project)}
                        >
                          <Edit size={16} />
                        </button>
                        <button 
                          className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                          onClick={() => setDeleteCandidate(project)}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Creator Info */}
                  {(project.created_by || project.creator_email) && (
                    <div className="mb-4 text-sm text-[#6b7280]">
                      Created by: {(() => {
                        const creator = project.created_by ? userIdToUser[project.created_by] : users.find(u => u.email === project.creator_email);
                        const label = creator?.name || creator?.email || (project.creator_email ? emailToName[project.creator_email] : '') || project.creator_email || 'Unknown';
                        return (
                          <span className="font-medium text-gray-700" title={creator?.email || project.creator_email || undefined}>
                            {label}
                          </span>
                        );
                      })()}
                    </div>
                  )}

                  {/* Assignees */}
                  <div className="mb-6">
                    <div className="h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent my-4" />
                    {project.assignees && project.assignees.length > 0 ? (
                      <div className="flex items-center justify-between">
                        <button 
                          type="button" 
                          className="flex -space-x-2 group/avatars"
                          onClick={() => openAssigneesDialog(project)}
                        >
                          {project.assignees.slice(0, 4).map(id => {
                            const label = userIdToLabel[id] || id;
                            const initials = (label || "").split(/[\s@._-]+/).filter(Boolean).slice(0,2).map(s => s[0]?.toUpperCase()).join("") || "?";
                            return (
                              <div 
                                key={id}
                                className="w-8 h-8 rounded-full bg-gradient-to-br from-[#2f5597] to-[#3b6bc9] border-2 border-white flex items-center justify-center text-xs font-semibold text-white shadow-lg transition-transform group-hover/avatars:translate-y-[-2px]"
                                title={label}
                              >
                                {initials}
                              </div>
                            );
                          })}
                          {project.assignees.length > 4 && (
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-gray-500 to-gray-600 border-2 border-white flex items-center justify-center text-xs font-semibold text-white shadow-lg">
                              +{project.assignees.length - 4}
                            </div>
                          )}
                        </button>
                        <Badge 
                          variant="secondary" 
                          className="bg-blue-50 text-[#2f5597] border-blue-200 rounded-lg"
                        >
                          <UserCheck size={12} className="mr-1" />
                          {project.assignees.length}
                        </Badge>
                      </div>
                    ) : (
                      <div className="text-sm text-[#6b7280] flex items-center justify-center py-2">
                        <Users size={16} className="mr-2" />
                        No assignees yet
                      </div>
                    )}
                  </div>

                  {/* Action Button */}
                  <Button 
                    onClick={() => setVisualizeProjectId(project.id)}
                    className="w-full rounded-xl py-3 font-semibold transition-all duration-300 hover:scale-105 active:scale-95 shadow-lg hover:shadow-xl"
                    style={{
                      background: 'linear-gradient(135deg, #2f5597 0%, #3b6bc9 100%)',
                    }}
                  >
                    <Eye size={18} className="mr-2" />
                    Open Project
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="rounded-2xl border-0 bg-gradient-to-br from-gray-50 to-blue-50/30 backdrop-blur-sm text-center shadow-lg">
            <CardContent className="p-12">
              <div className="w-20 h-20 bg-gradient-to-br from-blue-100 to-blue-200 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <FileText size={32} className="text-[#2f5597]" />
              </div>
              <h3 className="text-2xl font-semibold text-gray-900 mb-3">No projects found</h3>
              <p className="text-[#6b7280] mb-8 max-w-md mx-auto">
                Create your first project to start collaborating with your team and organizing your work.
              </p>
              <Button 
                onClick={() => setIsCreateOpen(true)}
                className="px-8 py-3 rounded-xl font-semibold text-white transition-all duration-300 hover:scale-105 active:scale-95 shadow-lg hover:shadow-xl"
                style={{
                  background: 'linear-gradient(135deg, #2f5597 0%, #3b6bc9 100%)',
                }}
              >
                <Plus size={20} className="mr-2" />
                Create Your First Project
              </Button>
            </CardContent>
          </Card>
        )}
      </section>

      {/* Create Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={(open) => { setIsCreateOpen(open); if (!open) { resetCreateForm(); setCreateTeamSearch(""); } }}>
        <DialogContent className="sm:max-w-xl rounded-2xl border-0 bg-white/95 backdrop-blur-sm shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-[#2f5597] to-[#3b6bc9] rounded-xl flex items-center justify-center">
                <Folder size={20} className="text-white" />
              </div>
              Create New Project
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-5 py-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Project Name</label>
              <Input 
                value={newProjectName} 
                onChange={(e) => setNewProjectName(e.target.value)} 
                maxLength={80} 
                placeholder="e.g. Test Network"
                className="rounded-xl border-2 focus:border-[#2f5597] focus:ring-2 focus:ring-blue-100"
              />
              <div className="text-xs text-gray-400 mt-1">{newProjectName.length}/80</div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-700">Assign Team Members</label>
                <span className="text-xs text-gray-500">{selectedAssigneeIds.size} selected</span>
              </div>
              {isUsersLoading ? (
                <div className="flex items-center justify-center h-20 border rounded-xl bg-gray-50">Loading team members...</div>
              ) : (
                <>
                  <div className="mb-3 relative">
                    <Search size={18} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                    <Input 
                      placeholder="Search team members" 
                      className="pl-9 rounded-xl border-2 focus:border-[#2f5597] focus:ring-2 focus:ring-blue-100"
                      value={createTeamSearch} 
                      onChange={(e) => setCreateTeamSearch(e.target.value)} 
                    />
                  </div>
                  {(!usersError && filteredUsersForCreate.length > 0) ? (
                    <div className="max-h-60 overflow-auto border rounded-xl divide-y">
                      {filteredUsersForCreate.map(u => (
                        <label key={u.id} className={`flex items-center gap-3 py-3 px-4 hover:bg-gray-50 cursor-pointer`}>
                          <input 
                            type="checkbox" 
                            checked={selectedAssigneeIds.has(u.id)} 
                            onChange={() => toggleAssignee(u.id, setSelectedAssigneeIds)} 
                            className="rounded border-gray-300 text-[#2f5597] focus:ring-[#2f5597]"
                          />
                          <div className="h-8 w-8 rounded-full bg-gradient-to-br from-[#2f5597] to-[#3b6bc9] flex items-center justify-center text-white text-sm font-medium">
                            {(u.name || u.email || '?').charAt(0).toUpperCase()}
                          </div>
                          <div className="flex flex-col">
                            <span className="text-sm font-medium text-gray-900">{u.name || 'Unnamed User'}</span>
                            <span className="text-xs text-gray-500">{u.email || 'No email'}</span>
                          </div>
                        </label>
                      ))}
                    </div>
                  ) : (
                    <div className="p-4 text-sm text-gray-600 border rounded-xl bg-gray-50">
                      {usersError ? 'Unable to load other users. You can still create the project; you will be the sole assignee.' : 'No other users found. You will be the sole assignee.'}
                    </div>
                  )}
                </>
              )}
              {usersError && <div className="text-xs text-red-600 mt-2 flex items-center"><AlertCircle size={14} className="mr-1" />{usersError}</div>}
              {currentUserId && <p className="text-xs text-gray-500 mt-3 flex items-center"><UserCheck size={14} className="mr-1" />You will be added as Project Creator by default.</p>}
            </div>
          </div>

          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => { setIsCreateOpen(false); resetCreateForm(); }} 
              disabled={isCreateLoading}
              className="rounded-xl border-gray-300"
            >
              Cancel
            </Button>
            <Button 
              onClick={handleCreateProject} 
              disabled={!newProjectName.trim() || isCreateLoading}
              className="rounded-xl text-white transition-all duration-300 hover:scale-105 active:scale-95 shadow-lg hover:shadow-xl"
              style={{
                background: 'linear-gradient(135deg, #2f5597 0%, #3b6bc9 100%)',
              }}
            >
              {isCreateLoading ? (<><Loader2 className="animate-spin mr-2" size={16} /> Creating...</>) : 'Create Project'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Visualization Dialog */}
      <Dialog open={!!visualizeProjectId} onOpenChange={(open) => { if (!open) setVisualizeProjectId(null); }}>
        <DialogContent className="sm:max-w-6xl w-[95vw] max-h-[85vh] rounded-2xl p-0 overflow-hidden border-0 shadow-2xl">
          <div className="flex flex-col h-full">
            <DialogHeader className="px-6 pt-6">
              <DialogTitle className="text-xl flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-[#2f5597] to-[#3b6bc9] rounded-xl flex items-center justify-center">
                  <Folder size={20} className="text-white" />
                </div>
                Project Visualization
              </DialogTitle>
            </DialogHeader>
            <div className="flex-1 min-h-[360px] overflow-hidden px-6 pb-6">
              {visualizeProjectId ? <NetworkGraph projectId={visualizeProjectId} height="100%" /> : <p>No project selected.</p>}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Assignees Dialog */}
      <Dialog open={isAssigneesOpen} onOpenChange={(open) => { setIsAssigneesOpen(open); if (!open) setAssigneesProject(null); }}>
        <DialogContent className="sm:max-w-md rounded-2xl border-0 bg-white/95 backdrop-blur-sm shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-[#2f5597] to-[#3b6bc9] rounded-xl flex items-center justify-center">
                <Users size={20} className="text-white" />
              </div>
              Project Assignees {assigneesProject && `: ${assigneesProject.name || 'Untitled Project'}`}
            </DialogTitle>
          </DialogHeader>
          <div className="py-4 max-h-96 overflow-auto">
            {assigneesProject && assigneesProject.assignees && assigneesProject.assignees.length > 0 ? (
              <div className="space-y-3">
                {assigneesProject.assignees.map(id => {
                  const u = userIdToUser[id];
                  const label = u?.name || u?.email || id;
                  const initials = (label || "").split(/[\s@._-]+/).filter(Boolean).slice(0,2).map(s => s[0]?.toUpperCase()).join("") || "?";
                  return (
                    <div key={id} className="flex items-center gap-3 p-3 rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#2f5597] to-[#3b6bc9] flex items-center justify-center text-white text-sm font-medium">
                        {initials}
                      </div>
                      <div className="flex flex-col">
                        <span className="text-sm font-medium text-gray-900">{u?.name || 'Unnamed User'}</span>
                        <span className="text-xs text-gray-500">{u?.email || 'No email'}</span>
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
            <Button 
              onClick={() => setIsAssigneesOpen(false)}
              className="rounded-xl text-white transition-all duration-300 hover:scale-105 active:scale-95 shadow-lg hover:shadow-xl"
              style={{
                background: 'linear-gradient(135deg, #2f5597 0%, #3b6bc9 100%)',
              }}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={isEditOpen} onOpenChange={(open) => { setIsEditOpen(open); if (!open) { setEditingProject(null); setEditTeamSearch(""); } }}>
        <DialogContent className="sm:max-w-xl rounded-2xl border-0 bg-white/95 backdrop-blur-sm shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-[#2f5597] to-[#3b6bc9] rounded-xl flex items-center justify-center">
                <Edit size={20} className="text-white" />
              </div>
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
                maxLength={80}
                className="rounded-xl border-2 focus:border-[#2f5597] focus:ring-2 focus:ring-blue-100"
              />
              <div className="text-xs text-gray-400 mt-1">{editName.length}/80</div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-700">Assign Team Members</label>
                <span className="text-xs text-gray-500">{editSelectedAssigneeIds.size} selected</span>
              </div>
              {isUsersLoading ? (
                <div className="flex items-center justify-center h-20 border rounded-xl bg-gray-50">Loading team members...</div>
              ) : (
                <>
                  <div className="mb-3 relative">
                    <Search size={18} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                    <Input 
                      placeholder="Search team members" 
                      className="pl-9 rounded-xl border-2 focus:border-[#2f5597] focus:ring-2 focus:ring-blue-100"
                      value={editTeamSearch} 
                      onChange={(e) => setEditTeamSearch(e.target.value)} 
                    />
                  </div>
                  {(!usersError && filteredUsersForEdit.length > 0) ? (
                    <div className="max-h-60 overflow-auto border rounded-xl divide-y">
                      {filteredUsersForEdit.map(u => {
                        const isCreator = editingProject && editingProject.creator_email === u.email;
                        return (
                          <label key={u.id} className={`flex items-center gap-3 py-3 px-4 ${isCreator ? 'bg-gray-50 cursor-default' : 'hover:bg-gray-50 cursor-pointer'}`}>
                            <input 
                              type="checkbox" 
                              checked={editSelectedAssigneeIds.has(u.id)} 
                              onChange={() => toggleAssignee(u.id, setEditSelectedAssigneeIds)} 
                              disabled={!!isCreator}
                              className="rounded border-gray-300 text-[#2f5597] focus:ring-[#2f5597]"
                            />
                            <div className="h-8 w-8 rounded-full bg-gradient-to-br from-[#2f5597] to-[#3b6bc9] flex items-center justify-center text-white text-sm font-medium">
                              {(u.name || u.email || '?').charAt(0).toUpperCase()}
                            </div>
                            <div className="flex flex-col">
                              <span className="text-sm font-medium text-gray-900">{u.name || 'Unnamed User'}</span>
                              <span className="text-xs text-gray-500">{u.email || 'No email'}</span>
                            </div>
                            {isCreator && (
                              <div className="ml-auto">
                                <span className="inline-block bg-blue-100 text-[#2f5597] text-xs px-2 py-0.5 rounded-full">Creator</span>
                              </div>
                            )}
                          </label>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="p-4 text-sm text-gray-600 border rounded-xl bg-gray-50">
                      {usersError ? 'Unable to load other users. You can still update the project.' : 'No other users available.'}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => { setIsEditOpen(false); setEditingProject(null); }} 
              disabled={isUpdateLoading}
              className="rounded-xl border-gray-300"
            >
              Cancel
            </Button>
            <Button 
              onClick={handleUpdateProject} 
              disabled={!editName.trim() || isUpdateLoading}
              className="rounded-xl text-white transition-all duration-300 hover:scale-105 active:scale-95 shadow-lg hover:shadow-xl"
              style={{
                background: 'linear-gradient(135deg, #2f5597 0%, #3b6bc9 100%)',
              }}
            >
              {isUpdateLoading ? (<><Loader2 className="animate-spin mr-2" size={16} /> Saving...</>) : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteCandidate} onOpenChange={(open) => { if (!open) setDeleteCandidate(null); }}>
        <DialogContent className="sm:max-w-md rounded-2xl border-0 bg-white/95 backdrop-blur-sm shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-red-500 to-red-600 rounded-xl flex items-center justify-center">
                <Trash2 size={20} className="text-white" />
              </div>
              Delete Project
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-gray-700">
              Are you sure you want to delete <strong className="text-gray-900">{deleteCandidate?.name ?? 'this project'}</strong>? This action cannot be undone.
            </p>
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setDeleteCandidate(null)} 
              disabled={isDeleteLoading}
              className="rounded-xl border-gray-300"
            >
              Cancel
            </Button>
            <Button 
              onClick={confirmDeleteProject} 
              disabled={isDeleteLoading}
              className="rounded-xl bg-red-600 hover:bg-red-700 text-white transition-all duration-300 hover:scale-105 active:scale-95 shadow-lg hover:shadow-xl"
            >
              {isDeleteLoading ? 'Deleting...' : 'Delete Project'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in {
          animation: fadeIn 0.3s ease-out;
        }
      `}</style>
    </main>
  );
};

export default HomePage;