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
import { Search, Plus, Folder, Edit, Trash2, Users, AlertCircle, FileText, Calendar, UserCheck } from "lucide-react";
import NetworkGraph from "./NetworkGraph"; 

type Project = {
  id: string;
  name?: string | null;
  assignees?: string[] | null;
  created_at?: string | null;
  creator_email?: string | null;
};

type MinimalUser = {
  id: string;
  email: string | null;
  name?: string | null;
};

const useAdminUsers = (isAdmin: boolean) => {
  const [adminUsers, setAdminUsers] = useState<MinimalUser[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
      if (!isAdmin) return;
      let mounted = true;
      setIsLoading(true);
      (async () => {
        try {
          const { data, error } = await supabase.rpc("get_users_as_admin");
          if (!mounted) return;
          if (error) {
            setError(error.message || "Failed to load users");
            setAdminUsers([]);
          } else {
            setAdminUsers(((data || []) as any[]).map((u) => ({ id: u.id, email: u.email ?? null, name: u.raw_user_meta_data?.name ?? null })));
            setError(null);
          }
        } catch {
          if (!mounted) return;
          setError("Unexpected error while loading users.");
          setAdminUsers([]);
        } finally {
          if (mounted) setIsLoading(false);
        }
      })();
  
      return () => { mounted = false; };
    }, [isAdmin]);

  return { adminUsers, isLoading, error } as const;
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
        .select("id, name, assignees, created_at, creator_email")
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

  // Basic UI state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [selectedAssigneeIds, setSelectedAssigneeIds] = useState<Set<string>>(new Set());

  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [editName, setEditName] = useState("");
  const [editSelectedAssigneeIds, setEditSelectedAssigneeIds] = useState<Set<string>>(new Set());

  const [isAssigneesOpen, setIsAssigneesOpen] = useState(false);
  const [assigneesProject, setAssigneesProject] = useState<Project | null>(null);
  const [visualizeProjectId, setVisualizeProjectId] = useState<string | null>(null);

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null);

  // Delete confirmation state (replaces window.confirm)
  const [deleteCandidate, setDeleteCandidate] = useState<Project | null>(null);
  const [isDeleteLoading, setIsDeleteLoading] = useState(false);

  // admin users hook
  const { adminUsers, isLoading: isAdminUsersLoading, error: adminUsersError } = useAdminUsers(isAdmin);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      setCurrentUserId(data.user?.id ?? null);
      setCurrentUserEmail(data.user?.email ?? null);
    })();
  }, []);

  const { projects, isLoading: isProjectsLoading, error: projectsError, refetch: refetchProjects } = useProjects(isAdmin, currentUserId);

  // helpers
  const toggleAssignee = useCallback((userId: string, setter: React.Dispatch<React.SetStateAction<Set<string>>>) => {
    setter((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId); else next.add(userId);
      return next;
    });
  }, []);

  useEffect(() => {
    // when opening Create dialog ensure current user is selected
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
    if (!isAdmin) return;
    if (!newProjectName.trim()) return; // UI already disables button, but double-check

    try {
      const assigneesSet = new Set(selectedAssigneeIds);
      if (currentUserId) assigneesSet.add(currentUserId);
      const assigneesArray = Array.from(assigneesSet);

      const { error } = await supabase.from("projects").insert([{
        name: newProjectName.trim(),
        assignees: assigneesArray,
        creator_email: currentUserEmail,
        network_data: sampleNetwork,
      }]);

      if (error) throw error;

      setIsCreateOpen(false);
      resetCreateForm();
      refetchProjects();
    } catch (err: any) {
      // TODO: wire into a toast system; fallback to alert for now
      alert(err?.message || "Failed to create project.");
    }
  }, [isAdmin, newProjectName, selectedAssigneeIds, currentUserId, currentUserEmail, resetCreateForm, refetchProjects]);

  const openEditDialog = useCallback((project: Project) => {
    setEditingProject(project);
    setEditName(project.name || "");
    setEditSelectedAssigneeIds(new Set(project.assignees || []));
    // ensure creator remains in set if found
    const creator = adminUsers.find((a) => a.email === project.creator_email);
    if (creator?.id) {
      setEditSelectedAssigneeIds((prev) => {
        const next = new Set(prev);
        next.add(creator.id);
        return next;
      });
    }
    setIsEditOpen(true);
  }, [adminUsers]);

  const handleUpdateProject = useCallback(async () => {
    if (!editingProject) return;
    if (!editName.trim()) return;
    try {
      const assigneesArray = Array.from(editSelectedAssigneeIds);
      const { error } = await supabase.from("projects").update({ name: editName.trim(), assignees: assigneesArray }).eq("id", editingProject.id);
      if (error) throw error;
      setIsEditOpen(false);
      setEditingProject(null);
      refetchProjects();
    } catch (err: any) {
      alert(err?.message || "Failed to update project.");
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
    } catch (err: any) {
      alert(err?.message || "Failed to delete project.");
    } finally {
      setIsDeleteLoading(false);
    }
  }, [deleteCandidate, refetchProjects]);

  const openAssigneesDialog = useCallback((project: Project) => {
    setAssigneesProject(project);
    setIsAssigneesOpen(true);
  }, []);

  // derived maps
  const userIdToEmail = useMemo(() => {
    const map: Record<string, string> = {};
    for (const u of adminUsers) map[u.id] = u.email ?? u.name ?? u.id;
    return map;
  }, [adminUsers]);

  const userIdToUser = useMemo(() => {
    const map: Record<string, MinimalUser> = {};
    for (const u of adminUsers) map[u.id] = u;
    return map;
  }, [adminUsers]);

  const emailToName = useMemo(() => {
    const map: Record<string, string> = {};
    for (const u of adminUsers) if (u.email) map[u.email] = u.name ?? u.email;
    return map;
  }, [adminUsers]);

  return (
    <main className="flex-grow container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Project Dashboard</h1>
        <p className="text-gray-600 mt-2">Manage and organize your projects</p>
      </div>

      <section className="w-full max-w-6xl mx-auto">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 gap-4">
          <div>
            <h2 className="text-2xl font-semibold text-gray-800">Projects</h2>
            <p className="text-gray-500 text-sm mt-1">{projects && projects.length > 0 ? `${projects.length} project${projects.length !== 1 ? 's' : ''} in total` : 'No projects yet'}</p>
          </div>
          {isAdmin && (
            <Button onClick={() => setIsCreateOpen(true)} className="flex items-center gap-2">
              <Plus size={18} /> New Project
            </Button>
          )}
        </div>

        {isProjectsLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1,2,3,4,5,6].map(i => (
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
                </CardContent>
              </Card>
            ))}
          </div>
        ) : projectsError ? (
          <Card className="p-6 border border-red-200 bg-red-50 rounded-xl">
            <CardContent className="text-red-800 flex flex-col items-center justify-center py-6">
              <div className="bg-red-100 p-3 rounded-full mb-4"><AlertCircle size={24} className="text-red-600" /></div>
              <h3 className="font-medium text-lg mb-2">Unable to load projects</h3>
              <p className="text-center text-red-700 mb-4">{projectsError}</p>
              <Button variant="outline" onClick={() => refetchProjects()}>Try Again</Button>
            </CardContent>
          </Card>
        ) : projects && projects.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {projects.map(project => (
              <Card key={project.id} className="overflow-hidden border border-gray-200 rounded-xl hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600"><Folder size={20} /></div>
                      <div className="min-w-0">
                        <h3 className="text-base font-semibold text-gray-900 truncate">{project.name || 'Untitled Project'}</h3>
                        {project.created_at && <div className="mt-1 flex items-center text-gray-500"><Calendar size={12} className="mr-1" /><span className="text-xs">{new Date(project.created_at).toLocaleDateString()}</span></div>}
                        {project.creator_email && <div className="mt-1 text-xs text-gray-500">Created by: <span title={project.creator_email} className="font-medium text-gray-700">{emailToName[project.creator_email] || project.creator_email}</span></div>}
                      </div>
                    </div>
                    {(isAdmin || (currentUserId && project.assignees?.includes(currentUserId))) && (
                      <div className="flex items-center gap-1">
                        <button className="text-gray-500 hover:text-blue-600 p-1 rounded-full hover:bg-blue-50" title="Edit project" onClick={() => openEditDialog(project)}><Edit size={16} /></button>
                        <button className="text-gray-500 hover:text-red-600 p-1 rounded-full hover:bg-red-50" title="Delete project" onClick={() => setDeleteCandidate(project)}><Trash2 size={16} /></button>
                      </div>
                    )}
                  </div>

                  <div className="mb-4">
                    <div className="h-px bg-gray-100 my-4" />
                    {project.assignees && project.assignees.length > 0 ? (
                      <div className="flex items-center justify-between">
                        <button type="button" className="flex -space-x-2 group" title="View assignees" onClick={() => openAssigneesDialog(project)}>
                          {project.assignees.slice(0,3).map(id => {
                            const label = userIdToEmail[id] || id;
                            const initials = (label || "").split(/[\s@._-]+/).filter(Boolean).slice(0,2).map(s => s[0]?.toUpperCase()).join("") || "?";
                            return <div key={id} className="h-7 w-7 rounded-full bg-blue-100 border-2 border-white flex items-center justify-center text-xs font-medium text-blue-700" title={label}>{initials}</div>;
                          })}
                          {project.assignees.length > 3 && <div className="h-7 w-7 rounded-full bg-gray-100 border-2 border-white flex items-center justify-center text-xs font-medium text-gray-600">+{project.assignees.length - 3}</div>}
                        </button>
                        <Badge variant="outline" className="text-xs"><UserCheck size={12} className="mr-1" />{project.assignees.length} {project.assignees.length === 1 ? 'assignee' : 'assignees'}</Badge>
                      </div>
                    ) : (
                      <div className="text-sm text-gray-500 flex items-center"><Users size={14} className="mr-2" />No assignees yet</div>
                    )}
                  </div>

                  <Button variant="outline" className="w-full" onClick={() => setVisualizeProjectId(project.id)}>View Project</Button>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="p-8 text-center border border-dashed border-gray-300 bg-gray-50 rounded-xl">
            <CardContent className="flex flex-col items-center">
              <div className="bg-gray-200 p-4 rounded-full mb-4"><FileText size={32} className="text-gray-500" /></div>
              <h3 className="text-lg font-medium text-gray-700 mb-2">No projects found</h3>
              <p className="text-gray-500 mb-6 max-w-md">Only Admins can create projects. Organize tasks and collaborate with your team.</p>
              {isAdmin && <Button onClick={() => setIsCreateOpen(true)}><Plus size={18} /> Create Your First Project</Button>}
            </CardContent>
          </Card>
        )}
      </section>

      {/* Create dialog (simple) */}
      <Dialog open={isCreateOpen} onOpenChange={(open) => { setIsCreateOpen(open); if (!open) resetCreateForm(); }}>
        <DialogContent className="sm:max-w-xl rounded-xl">
          <DialogHeader><DialogTitle className="text-xl flex items-center gap-2"><Folder size={20} /> Create New Project</DialogTitle></DialogHeader>
          <div className="space-y-5 py-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Project Name</label>
              <Input value={newProjectName} onChange={(e) => setNewProjectName(e.target.value)} placeholder="e.g. Test Network" />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2"><label className="block text-sm font-medium text-gray-700">Assign Team Members</label><span className="text-xs text-gray-500">{selectedAssigneeIds.size} selected</span></div>
              {isAdminUsersLoading ? (
                <div className="flex items-center justify-center h-20 border rounded-lg bg-gray-50">Loading team members...</div>
              ) : (
                <>
                  <div className="mb-3 relative"><Search size={18} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" /><Input placeholder="Search team members" className="pl-9" onChange={() => {}} /></div>
                  <div className="max-h-60 overflow-auto border rounded-lg divide-y">
                    {adminUsers.length === 0 ? <div className="text-sm text-gray-500 p-4 text-center">No team members available.</div> : adminUsers.map(u => (
                      <label key={u.id} className={`flex items-center gap-3 py-3 px-4`}>
                        <input type="checkbox" checked={selectedAssigneeIds.has(u.id)} onChange={() => toggleAssignee(u.id, setSelectedAssigneeIds)} />
                        <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center">{(u.name || u.email || '?').charAt(0).toUpperCase()}</div>
                        <div className="flex flex-col"><span className="text-sm font-medium text-gray-900">{u.name || 'Unnamed User'}</span><span className="text-xs text-gray-500">{u.email || 'No email'}</span></div>
                      </label>
                    ))}
                  </div>
                </>
              )}
              {adminUsersError && <div className="text-xs text-red-600 mt-2"><AlertCircle size={14} className="mr-1" />{adminUsersError}</div>}
              {currentUserId && <p className="text-xs text-gray-500 mt-3"><UserCheck size={14} className="mr-1" />You will be added as Project Creator by default.</p>}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setIsCreateOpen(false); resetCreateForm(); }}>Cancel</Button>
            <Button onClick={handleCreateProject} disabled={!newProjectName.trim()}>Create Project</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Visualization dialog */}
      <Dialog open={!!visualizeProjectId} onOpenChange={(open) => { if (!open) setVisualizeProjectId(null); }}>
        <DialogContent className="sm:max-w-4xl rounded-xl">
          <DialogHeader><DialogTitle className="text-xl flex items-center gap-2"><Folder size={20} /> Project Visualization</DialogTitle></DialogHeader>
          <div className="py-4">
            {visualizeProjectId ? <NetworkGraph projectId={visualizeProjectId} height={520} /> : <p>No project selected.</p>}
          </div>
          <DialogFooter>
            {/* <Button variant="outline" onClick={() => setVisualizeProjectId(null)}>Close</Button> */}
            </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assignees Dialog */}
      <Dialog open={isAssigneesOpen} onOpenChange={(open) => { setIsAssigneesOpen(open); if (!open) setAssigneesProject(null); }}>
        <DialogContent className="sm:max-w-md rounded-xl">
          <DialogHeader><DialogTitle className="text-xl flex items-center gap-2"><Users size={20} /> Project Assignees {assigneesProject && `: ${assigneesProject.name || 'Untitled Project'}`}</DialogTitle></DialogHeader>
          <div className="py-4 max-h-96 overflow-auto">
            {assigneesProject && assigneesProject.assignees && assigneesProject.assignees.length > 0 ? (
              <div className="space-y-3">{assigneesProject.assignees.map(id => {
                const u = userIdToUser[id];
                const label = u?.name || u?.email || id;
                const initials = (label || "").split(/[\s@._-]+/).filter(Boolean).slice(0,2).map(s => s[0]?.toUpperCase()).join("") || "?";
                return <div key={id} className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 hover:bg-gray-50"><div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">{initials}</div><div className="flex flex-col"><span className="text-sm font-medium text-gray-900">{u?.name || 'Unnamed User'}</span><span className="text-xs text-gray-500">{u?.email || 'No email'}</span></div></div>;
              })}</div>
            ) : (
              <div className="text-center py-8 text-gray-500"><Users size={40} className="mx-auto mb-3 text-gray-400" /><p>No assignees for this project</p></div>
            )}
          </div>
          <DialogFooter>
            {/* <Button variant="outline" onClick={() => setIsAssigneesOpen(false)}>Close</Button> */}
            </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit dialog (simplified) */}
      <Dialog open={isEditOpen} onOpenChange={(open) => { setIsEditOpen(open); if (!open) { setEditingProject(null); } }}>
        <DialogContent className="sm:max-w-xl rounded-xl">
          <DialogHeader><DialogTitle className="text-xl flex items-center gap-2"><Edit size={20} /> Edit Project</DialogTitle></DialogHeader>
          <div className="space-y-5 py-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Project Name</label>
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="Enter project name" />
            </div>
            <div>
              <div className="flex items-center justify-between mb-2"><label className="block text-sm font-medium text-gray-700">Assign Team Members</label><span className="text-xs text-gray-500">{editSelectedAssigneeIds.size} selected</span></div>
              {isAdminUsersLoading ? <div className="flex items-center justify-center h-20 border rounded-lg bg-gray-50">Loading team members...</div> : (
                <div className="max-h-60 overflow-auto border rounded-lg divide-y">{adminUsers.length === 0 ? <div className="text-sm text-gray-500 p-4 text-center">No team members available.</div> : adminUsers.map(u => {
                  const isCreator = editingProject && editingProject.creator_email === u.email;
                  return (
                    <label key={u.id} className={`flex items-center gap-3 py-3 px-4 ${isCreator ? 'bg-gray-50 cursor-default' : ''}`}>
                      <input type="checkbox" checked={editSelectedAssigneeIds.has(u.id)} onChange={() => toggleAssignee(u.id, setEditSelectedAssigneeIds)} disabled={!!isCreator} />
                      <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center">{(u.name || u.email || '?').charAt(0).toUpperCase()}</div>
                      <div className="flex flex-col"><span className="text-sm font-medium text-gray-900">{u.name || 'Unnamed User'}</span><span className="text-xs text-gray-500">{u.email || 'No email'}</span></div>
                      {isCreator && <div className="ml-auto"><span className="inline-block bg-blue-100 text-blue-700 text-xs px-2 py-0.5 rounded-full">Creator</span></div>}
                    </label>
                  );
                })}</div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setIsEditOpen(false); setEditingProject(null); }}>Cancel</Button>
            <Button onClick={handleUpdateProject} disabled={!editName.trim()}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm Delete Dialog */}
      <Dialog open={!!deleteCandidate} onOpenChange={(open) => { if (!open) setDeleteCandidate(null); }}>
        <DialogContent className="sm:max-w-md rounded-xl">
          <DialogHeader><DialogTitle className="text-xl flex items-center gap-2"><Trash2 size={20} /> Delete Project</DialogTitle></DialogHeader>
          <div className="py-4">
            <p>Are you sure you want to delete <strong>{deleteCandidate?.name ?? 'this project'}</strong>? This action cannot be undone.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteCandidate(null)} disabled={isDeleteLoading}>Cancel</Button>
            <Button onClick={confirmDeleteProject} disabled={isDeleteLoading}>{isDeleteLoading ? 'Deleting...' : 'Delete'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
};

export default HomePage;
