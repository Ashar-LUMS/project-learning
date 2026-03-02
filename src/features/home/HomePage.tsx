import React, { useCallback, useEffect, useMemo, useState } from "react";
import { formatDate } from '@/lib/format';
import { Card, CardContent } from "../../components/ui/card";
import { useRole } from "../../getRole";
import { useOutletContext, useNavigate } from "react-router-dom";
import { supabase } from "../../supabaseClient";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "../../components/ui/dialog";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Badge } from "../../components/ui/badge";
import { Skeleton } from "../../components/ui/skeleton";
import { Search, Plus, Folder, Edit, Trash2, Users, AlertCircle, Calendar, UserCheck, Loader2, Filter, X, Eye, Network } from "lucide-react";

type Project = {
  id: string;
  name?: string | null;
  assignees?: string[] | null;
  created_at?: string | null;
  created_by?: string | null;
  creator_email?: string | null;
  networks?: string[] | null;
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
        .select("id, name, assignees, created_at, created_by, creator_email, networks")
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
  const navigate = useNavigate();

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

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null);

  const [deleteCandidate, setDeleteCandidate] = useState<Project | null>(null);
  const [isDeleteLoading, setIsDeleteLoading] = useState(false);

  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy] = useState<"recent" | "name">("recent");
  const [projectTab, setProjectTab] = useState<"all" | "mine" | "other">("all");

  const [banner, setBanner] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const [createTeamSearch, setCreateTeamSearch] = useState("");
  const [editTeamSearch, setEditTeamSearch] = useState("");
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteMessage, setInviteMessage] = useState<string | null>(null);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [policyAttrs, setPolicyAttrs] = useState({
    onlyAdminsCreate: false,
    autoAddCreator: true,
    autoRemoveDeletedAssignees: true,
    maxAssignees: null as number | null,
    preventDuplicateNames: false,
    onlyAdminsEditAssignees: false,
    disallowEmptyAssignees: false,
  });

  // Note: formatDate from @/lib/format reads locale directly from document attributes

  const { users, isLoading: isUsersLoading, error: usersError } = useUsers(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      setCurrentUserId(data.user?.id ?? null);
      setCurrentUserEmail(data.user?.email ?? null);
    })();
  }, []);

  // Read admin policy attributes from root set by AppLayout
  useEffect(() => {
    const root = document.getElementById('app-root') || document.documentElement;
    const onlyAdminsCreate = root.hasAttribute('data-projects-only-admins-create');
    const autoAddCreator = root.hasAttribute('data-projects-auto-add-creator');
    const autoRemoveDeletedAssignees = root.hasAttribute('data-projects-auto-remove-deleted-assignees');
    const maxAssigneesAttr = root.getAttribute('data-projects-max-assignees');
    const maxAssignees = maxAssigneesAttr != null ? Number(maxAssigneesAttr) : null;
    const preventDuplicateNames = root.hasAttribute('data-projects-prevent-duplicate-names');
    const onlyAdminsEditAssignees = root.hasAttribute('data-projects-only-admins-edit-assignees');
    const disallowEmptyAssignees = root.hasAttribute('data-projects-disallow-empty-assignees');
    setPolicyAttrs({
      onlyAdminsCreate,
      autoAddCreator,
      autoRemoveDeletedAssignees,
      maxAssignees: Number.isFinite(maxAssignees) ? maxAssignees : null,
      preventDuplicateNames,
      onlyAdminsEditAssignees,
      disallowEmptyAssignees,
    });
    // General locale attributes are read directly by formatDate in @/lib/format
  }, []);

  const { projects, isLoading: isProjectsLoading, error: projectsError, refetch: refetchProjects } = useProjects(isAdmin, currentUserId);

  const INVITE_ENDPOINT = import.meta.env.VITE_INVITE_ENDPOINT ?? '';

  const isValidEmail = (s: string) => typeof s === 'string' && /\S+@\S+\.\S+/.test(s);

  const inviteEmail = async (email: string) => {
    setInviteMessage(null);
    setInviteError(null);
    if (!isValidEmail(email)) {
      setInviteError('Please provide a valid email address.');
      return;
    }
    if (!INVITE_ENDPOINT) {
      setInviteError('Invite endpoint not configured (VITE_INVITE_ENDPOINT).');
      return;
    }
    try {
      setInviteLoading(true);
      const res = await fetch(INVITE_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload?.message || 'Invite failed');
      setInviteMessage(payload?.message || 'Invitation sent');
    } catch (err: any) {
      setInviteError(err?.message || String(err));
    } finally {
      setInviteLoading(false);
    }
  };

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
    if (!policyAttrs.autoAddCreator) return;
    setSelectedAssigneeIds((prev) => {
      const next = new Set(prev);
      next.add(currentUserId);
      return next;
    });
  }, [isCreateOpen, currentUserId, policyAttrs.autoAddCreator]);

  const resetCreateForm = useCallback(() => {
    setNewProjectName("");
    setSelectedAssigneeIds(new Set());
  }, []);

  const handleCreateProject = useCallback(async () => {
    if (!newProjectName.trim()) return;

    try {
      setIsCreateLoading(true);
      // Duplicate name check
      if (policyAttrs.preventDuplicateNames) {
        const name = newProjectName.trim().toLowerCase();
        const exists = (projects || []).some(p => (p.name || '').trim().toLowerCase() === name);
        if (exists) throw new Error('A project with this name already exists.');
      }
      const assigneesSet = new Set(selectedAssigneeIds);
      if (policyAttrs.autoAddCreator && currentUserId) assigneesSet.add(currentUserId);
      if (policyAttrs.maxAssignees != null && assigneesSet.size > policyAttrs.maxAssignees) {
        throw new Error(`Too many assignees (max ${policyAttrs.maxAssignees}).`);
      }
      if (policyAttrs.disallowEmptyAssignees && assigneesSet.size === 0) {
        throw new Error('At least one assignee is required.');
      }
      const assigneesArray = Array.from(assigneesSet);

      const { error } = await supabase.from("projects").insert([{
        name: newProjectName.trim(),
        assignees: [...assigneesArray, currentUserId],
        creator_email: currentUserEmail,
        created_by: currentUserId,
        networks: [], // Initialize empty networks array
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
  }, [newProjectName, selectedAssigneeIds, currentUserId, currentUserEmail, resetCreateForm, refetchProjects, policyAttrs.autoAddCreator, policyAttrs.maxAssignees]);

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
      // Duplicate name check (exclude current project) - use server-side check to avoid
      // stale local state causing false positives when editing projects.
      if (policyAttrs.preventDuplicateNames) {
        const nameTrim = editName.trim();
        try {
          const { data: existing, error: fetchErr } = await supabase
            .from('projects')
            .select('id')
            .ilike('name', nameTrim);
          if (fetchErr) throw fetchErr;
          const exists = (existing || []).some((p: any) => p.id !== editingProject.id);
          if (exists) throw new Error('A project with this name already exists.');
        } catch (e) {
          throw e;
        }
      }
      // Optionally remove deleted assignees per policy
      const cleaned = new Set(editSelectedAssigneeIds);
      const known = new Set(users.map(u => u.id));
      if (policyAttrs.autoRemoveDeletedAssignees) {
        for (const id of Array.from(cleaned)) {
          if (!known.has(id)) cleaned.delete(id);
        }
      }
      if (policyAttrs.maxAssignees != null && cleaned.size > policyAttrs.maxAssignees) {
        throw new Error(`Too many assignees (max ${policyAttrs.maxAssignees}).`);
      }
      if (policyAttrs.disallowEmptyAssignees && cleaned.size === 0) {
        throw new Error('At least one assignee is required.');
      }
      const assigneesArray = Array.from(cleaned);
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
  }, [editingProject, editName, editSelectedAssigneeIds, refetchProjects, policyAttrs.autoRemoveDeletedAssignees, policyAttrs.maxAssignees, policyAttrs.preventDuplicateNames, policyAttrs.disallowEmptyAssignees, users, projects]);

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

  // Known user IDs set to detect deleted users (assignees not present in current users list)
  const knownUserIds = useMemo(() => new Set(users.map(u => u.id)), [users]);

  // Filtering for tabs
  const allProjects = useMemo(() => {
    // All projects assigned to or created by me
    if (!projects || !currentUserId) return [];
    return projects.filter(p => (p.assignees || []).includes(currentUserId) || p.created_by === currentUserId || (p.creator_email && p.creator_email === currentUserEmail));
  }, [projects, currentUserId, currentUserEmail]);

  const myProjects = useMemo(() => {
    if (!projects || !currentUserId) return [];
    return projects.filter(p => p.created_by === currentUserId || (p.creator_email && p.creator_email === currentUserEmail));
  }, [projects, currentUserId, currentUserEmail]);

  const otherProjects = useMemo(() => {
    if (!projects || !currentUserId) return [];
    return projects.filter(p => (p.assignees || []).includes(currentUserId) && p.created_by !== currentUserId && (!p.creator_email || p.creator_email !== currentUserEmail));
  }, [projects, currentUserId, currentUserEmail]);

  const displayedProjects = useMemo(() => {
    let list: Project[] = [];
    if (projectTab === "all") {
      list = allProjects;
    } else if (projectTab === "mine") {
      list = myProjects;
    } else if (projectTab === "other") {
      list = otherProjects;
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
  }, [projectTab, allProjects, myProjects, otherProjects, searchTerm, sortBy]);

  // Using shared formatDate from @/lib/format (reads locale from document attributes)

  const hasCreateSearch = useMemo(() => createTeamSearch.trim().length > 0, [createTeamSearch]);

  const filteredUsersForCreate = useMemo(() => {
    const q = createTeamSearch.trim().toLowerCase();
    if (!q) return [];
    return users.filter(u => {
      const name = (u.name || '').toLowerCase();
      const email = (u.email || '').toLowerCase();
      return name.includes(q) || email.includes(q);
    });
  }, [users, createTeamSearch]);

  const hasEditSearch = useMemo(() => editTeamSearch.trim().length > 0, [editTeamSearch]);

  // Users currently assigned to the project being edited
  const assignedUsersForEdit = useMemo(() => {
    return users.filter(u => editSelectedAssigneeIds.has(u.id));
  }, [users, editSelectedAssigneeIds]);

  // Search results: users matching search who are NOT already assigned
  const filteredUsersForEdit = useMemo(() => {
    const q = editTeamSearch.trim().toLowerCase();
    if (!q) return [];
    return users.filter(u => {
      if (editSelectedAssigneeIds.has(u.id)) return false; // exclude already assigned
      const name = (u.name || '').toLowerCase();
      const email = (u.email || '').toLowerCase();
      return name.includes(q) || email.includes(q);
    });
  }, [users, editTeamSearch, editSelectedAssigneeIds]);

  return (
    <main className="flex-1 overflow-y-auto bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-100/50 min-h-screen">
      {/* Background Pattern */}
      <div 
        className="absolute inset-0 pointer-events-none opacity-30"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%232f5597' fill-opacity='0.02'%3E%3Ccircle cx='30' cy='30' r='1'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
        }}
      />
      
      <div className="relative z-10">
        <div className="container mx-auto px-4 py-4">
          {/* Hero Header Section */}
          <section className="mb-6">
            <div className="bg-white/80 backdrop-blur-sm rounded-3xl border border-white/50 shadow-xl p-6 lg:p-8">
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-3 h-10 bg-gradient-to-b from-[#2f5597] to-blue-600 rounded-full shadow-lg"></div>
                    <h1 className="text-3xl lg:text-4xl font-bold bg-gradient-to-r from-[#2f5597] via-blue-600 to-indigo-600 bg-clip-text text-transparent">
                      Project Dashboard
                    </h1>
                  </div>
                  <p className="text-gray-600 text-base lg:text-lg leading-relaxed mb-4">
                    Manage and organize your research projects with collaborative network analysis tools
                  </p>
                  
                  {/* Quick Stats */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-3 border border-blue-100">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-gradient-to-br from-[#2f5597] to-blue-600 rounded-lg flex items-center justify-center shadow-lg">
                          <Folder className="w-4 h-4 text-white" />
                        </div>
                        <div>
                          <p className="text-xl font-bold text-gray-900">{displayedProjects.length}</p>
                          <p className="text-xs text-gray-600">Projects</p>
                        </div>
                      </div>
                    </div>
                    <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-xl p-3 border border-emerald-100">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-lg flex items-center justify-center shadow-lg">
                          <Network className="w-4 h-4 text-white" />
                        </div>
                        <div>
                          <p className="text-xl font-bold text-gray-900">{displayedProjects.reduce((acc, p) => acc + (p.networks?.length || 0), 0)}</p>
                          <p className="text-xs text-gray-600">Networks</p>
                        </div>
                      </div>
                    </div>
                    <div className="bg-gradient-to-br from-purple-50 to-violet-50 rounded-xl p-3 border border-purple-100">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-violet-600 rounded-lg flex items-center justify-center shadow-lg">
                          <Users className="w-4 h-4 text-white" />
                        </div>
                        <div>
                          <p className="text-xl font-bold text-gray-900">{new Set(displayedProjects.flatMap(p => p.assignees || [])).size}</p>
                          <p className="text-xs text-gray-600">Collaborators</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="lg:flex-shrink-0">
                  <Button
                    onClick={() => { if (!(policyAttrs.onlyAdminsCreate && !isAdmin)) setIsCreateOpen(true); }}
                    className="w-full lg:w-auto px-6 py-3 rounded-xl font-semibold text-white transition-all duration-300 hover:scale-105 active:scale-95 shadow-lg hover:shadow-xl text-base"
                    disabled={policyAttrs.onlyAdminsCreate && !isAdmin}
                    style={{
                      background: 'linear-gradient(135deg, #2f5597 0%, #3b6bc9 50%, #4f46e5 100%)',
                    }}
                  >
                    <Plus size={20} className="mr-2" />
                    {policyAttrs.onlyAdminsCreate && !isAdmin ? 'Admins Only' : 'Create New Project'}
                  </Button>
                </div>
              </div>
            </div>
          </section>

          {/* Banner */}
          {banner && (
            <div
              className={`mb-4 rounded-2xl border p-4 flex items-start justify-between backdrop-blur-sm animate-fade-in shadow-lg ${banner.type === 'success'
                ? 'bg-gradient-to-r from-emerald-50/90 to-teal-50/90 border-emerald-200 text-emerald-800'
                : 'bg-gradient-to-r from-red-50/90 to-rose-50/90 border-red-200 text-red-800'
                }`}
            >
              <div className="flex items-center gap-3">
                <div className={`rounded-xl p-2 shadow-lg ${banner.type === 'success' 
                  ? 'bg-gradient-to-br from-emerald-400 to-teal-500 text-white' 
                  : 'bg-gradient-to-br from-red-400 to-rose-500 text-white'
                  }`}>
                  {banner.type === 'success' ? <UserCheck size={16} /> : <AlertCircle size={16} />}
                </div>
                <p className="text-sm font-semibold">{banner.message}</p>
              </div>
              <button
                className="text-sm opacity-70 hover:opacity-100 transition-opacity p-1.5 rounded-lg hover:bg-white/50"
                onClick={() => setBanner(null)}
              >
                <X size={16} />
              </button>
            </div>
          )}

          {/* Controls Section */}
          <section className="mb-6">
            <div className="bg-white/70 backdrop-blur-sm rounded-2xl border border-white/50 shadow-lg p-4">
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="flex rounded-xl border border-gray-200 bg-white shadow-md overflow-hidden">
                    <button
                      className={`px-4 py-2 text-sm font-semibold transition-all duration-300 ${
                        projectTab === 'all' 
                          ? 'bg-gradient-to-r from-[#2f5597] to-blue-600 text-white shadow-lg' 
                          : 'text-gray-600 hover:text-[#2f5597] hover:bg-gray-50'
                      }`}
                      onClick={() => setProjectTab('all')}
                    >
                      <Filter className="inline mr-1.5" size={14} />
                      All Projects
                    </button>
                    <button
                      className={`px-4 py-2 text-sm font-semibold transition-all duration-300 border-l border-gray-200 ${
                        projectTab === 'mine' 
                          ? 'bg-gradient-to-r from-[#2f5597] to-blue-600 text-white shadow-lg' 
                          : 'text-gray-600 hover:text-[#2f5597] hover:bg-gray-50'
                      }`}
                      onClick={() => setProjectTab('mine')}
                    >
                      My Projects
                    </button>
                    <button
                      className={`px-4 py-2 text-sm font-semibold transition-all duration-300 border-l border-gray-200 ${
                        projectTab === 'other' 
                          ? 'bg-gradient-to-r from-[#2f5597] to-blue-600 text-white shadow-lg' 
                          : 'text-gray-600 hover:text-[#2f5597] hover:bg-gray-50'
                      }`}
                      onClick={() => setProjectTab('other')}
                    >
                      Shared With Me
                    </button>
                  </div>
                </div>
                
                <div className="flex-1 relative max-w-md">
                  <Input
                    type="text"
                    placeholder="Search projects..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="h-10 pl-10 pr-3 rounded-xl border-2 border-gray-200 bg-white/80 backdrop-blur-sm focus:border-[#2f5597] focus:ring-2 focus:ring-blue-100 shadow-md text-sm"
                  />
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                </div>
              </div>
            </div>
          </section>

      {/* Projects Grid */}
      <section>
        {isProjectsLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <Card key={i} className="rounded-2xl border-0 bg-white/70 backdrop-blur-sm overflow-hidden shadow-xl">
                <CardContent className="p-5">
                  <div className="flex items-center gap-3 mb-4">
                    <Skeleton className="h-10 w-10 rounded-xl bg-gradient-to-br from-gray-200 to-gray-300" />
                    <Skeleton className="h-5 flex-1 bg-gradient-to-r from-gray-200 to-gray-300 rounded-lg" />
                  </div>
                  <div className="space-y-3">
                    <Skeleton className="h-3 w-full bg-gradient-to-r from-gray-200 to-gray-300 rounded-lg" />
                    <Skeleton className="h-3 w-5/6 bg-gradient-to-r from-gray-200 to-gray-300 rounded-lg" />
                    <Skeleton className="h-8 w-full bg-gradient-to-r from-gray-200 to-gray-300 rounded-lg" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : projectsError ? (
          <Card className="rounded-2xl border-0 bg-gradient-to-br from-red-50/80 to-rose-50/80 backdrop-blur-sm shadow-xl border border-red-200/50">
            <CardContent className="p-8 text-center">
              <div className="w-16 h-16 bg-gradient-to-br from-red-400 to-rose-500 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
                <AlertCircle size={28} className="text-white" />
              </div>
              <h3 className="text-xl font-bold text-red-900 mb-2">Unable to load projects</h3>
              <p className="text-red-700 mb-6 text-base">{projectsError}</p>
              <Button
                onClick={() => refetchProjects()}
                className="px-6 py-2 rounded-xl font-semibold bg-gradient-to-r from-red-500 to-rose-600 text-white hover:from-red-600 hover:to-rose-700 shadow-lg hover:shadow-xl transition-all duration-300"
              >
                Try Again
              </Button>
            </CardContent>
          </Card>
        ) : displayedProjects.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {displayedProjects.map(project => (
              <Card
                key={project.id}
                className="group rounded-2xl border border-white/50 bg-white/80 backdrop-blur-sm overflow-hidden transition-all duration-500 hover:shadow-2xl hover:-translate-y-2 hover:border-[#2f5597]/30 shadow-xl hover:bg-white/90"
              >
                <CardContent className="p-6">
                  {/* Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#2f5597] to-blue-600 flex items-center justify-center text-white shadow-lg group-hover:shadow-xl transition-shadow duration-300">
                        <Folder size={20} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="text-lg font-bold text-gray-900 truncate">
                          {project.name || 'Untitled Project'}
                        </h3>
                        {project.created_at && (
                          <div className="flex items-center text-gray-600 text-xs mt-1">
                            <Calendar size={12} className="mr-1.5" />
                            {formatDate(project.created_at)}
                          </div>
                        )}
                      </div>
                    </div>
                    {/* Actions */}
                    {(isAdmin || project.created_by === currentUserId || (project.creator_email && project.creator_email === currentUserEmail)) && (
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                        <button
                          className="p-2 text-gray-500 hover:text-[#2f5597] hover:bg-blue-50 rounded-lg transition-all duration-200"
                          onClick={() => openEditDialog(project)}
                        >
                          <Edit size={16} />
                        </button>
                        <button
                          className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all duration-200"
                          onClick={() => setDeleteCandidate(project)}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    )}
                  </div>
                  {/* Creator Info */}
                  {(project.created_by || project.creator_email) && (
                    <div className="mb-4 p-3 bg-gradient-to-r from-blue-50/80 to-indigo-50/80 rounded-xl border border-blue-100">
                      <div className="text-xs text-gray-600">
                        Created by: {(() => {
                          const creator = project.created_by ? userIdToUser[project.created_by] : users.find(u => u.email === project.creator_email);
                          const label = creator?.name || creator?.email || (project.creator_email ? emailToName[project.creator_email] : '') || project.creator_email || 'Unknown';
                          return (
                            <span className="font-semibold text-[#2f5597]" title={creator?.email || project.creator_email || undefined}>
                              {label}
                            </span>
                          );
                        })()}
                      </div>
                    </div>
                  )}
                  {/* Network Count and Stats */}
                  <div className="mb-4 flex items-center gap-2">
                    <Badge
                      variant="secondary"
                      className="bg-gradient-to-r from-emerald-50 to-teal-50 text-emerald-700 border-emerald-200 rounded-lg px-3 py-1 font-semibold text-xs"
                    >
                      <Network size={12} className="mr-1.5" />
                      {project.networks?.length ?? 0} network{(project.networks?.length ?? 0) !== 1 ? 's' : ''}
                    </Badge>
                  </div>
                  {/* Assignees */}
                  <div className="mb-4">
                    <div className="h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent my-4" />
                    {project.assignees && project.assignees.length > 0 ? (
                      <div className="flex items-center justify-between">
                        <button
                          type="button"
                          className="flex -space-x-2 group/avatars"
                          onClick={() => openAssigneesDialog(project)}
                        >
                          {project.assignees.slice(0, 4).map(id => {
                            const isUnknown = !knownUserIds.has(id);
                            const label = isUnknown ? 'Deleted user' : (userIdToLabel[id] || id);
                            const initials = isUnknown
                              ? '?'
                              : ((label || "").split(/[/\s@._-]+/).filter(Boolean).slice(0, 2).map(s => s[0]?.toUpperCase()).join("") || "?");
                            return (
                              <div
                                key={id}
                                className={`w-8 h-8 rounded-full border-2 border-white flex items-center justify-center text-xs font-bold shadow-lg transition-transform group-hover/avatars:translate-y-[-2px] ${
                                  isUnknown 
                                    ? 'bg-gradient-to-br from-gray-400 to-gray-600 text-white' 
                                    : 'bg-gradient-to-br from-purple-400 to-violet-600 text-white'
                                }`}
                                title={label}
                              >
                                {initials}
                              </div>
                            );
                          })}
                          {project.assignees.length > 4 && (
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-gray-300 to-gray-500 border-2 border-white flex items-center justify-center text-xs font-bold text-white shadow-lg">
                              +{project.assignees.length - 4}
                            </div>
                          )}
                        </button>
                        <Badge
                          variant="secondary"
                          className="bg-gradient-to-r from-[#2f5597]/10 to-blue-600/10 text-[#2f5597] border-[#2f5597]/20 rounded-lg px-3 py-1 font-semibold text-xs"
                        >
                          <UserCheck size={12} className="mr-1.5" />
                          {project.assignees.length} member{project.assignees.length !== 1 ? 's' : ''}
                        </Badge>
                      </div>
                    ) : (
                      <div className="text-gray-500 flex items-center justify-center py-4 bg-gray-50/50 rounded-xl">
                        <Users size={16} className="mr-2" />
                        No collaborators yet
                      </div>
                    )}
                  </div>

                  {/* Action Button */}
                  <Button
                    onClick={() => navigate(`/app/projects/${project.id}`)}
                    className="w-full rounded-xl py-3 text-base font-bold transition-all duration-300 hover:scale-105 active:scale-95 shadow-lg hover:shadow-xl"
                    style={{
                      background: 'linear-gradient(135deg, #2f5597 0%, #3b6bc9 50%, #4f46e5 100%)',
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
          <Card className="rounded-2xl border-0 bg-gradient-to-br from-gray-50/80 to-slate-100/80 backdrop-blur-sm shadow-xl border border-gray-200/50">
            <CardContent className="p-8 text-center">
              <div className="w-16 h-16 bg-gradient-to-br from-gray-300 to-gray-500 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg">
                <Folder size={28} className="text-white" />
              </div>
              <h3 className="text-2xl font-bold text-gray-800 mb-3">No projects found</h3>
              <p className="text-gray-600 text-base mb-6">
                {projectTab === 'mine' ? "You haven't created any projects yet." :
                 projectTab === 'other' ? "No projects have been shared with you." :
                 searchTerm ? `No projects match "${searchTerm}".` : "Get started by creating your first project."}
              </p>
              {projectTab !== 'other' && (
                <Button
                  onClick={() => { if (!(policyAttrs.onlyAdminsCreate && !isAdmin)) setIsCreateOpen(true); }}
                  disabled={policyAttrs.onlyAdminsCreate && !isAdmin}
                  className="px-6 py-3 rounded-xl text-base font-bold shadow-lg hover:shadow-xl transition-all duration-300"
                  style={{
                    background: 'linear-gradient(135deg, #2f5597 0%, #3b6bc9 50%, #4f46e5 100%)',
                  }}
                >
                  <Plus size={18} className="mr-2" />
                  {policyAttrs.onlyAdminsCreate && !isAdmin ? 'Admins Only' : 'Create Your First Project'}
                </Button>
              )}
            </CardContent>
          </Card>
        )}
      </section>

      {/* Create Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={(open) => { setIsCreateOpen(open); if (!open) { resetCreateForm(); setCreateTeamSearch(""); } }}>
        <DialogContent className="sm:max-w-xl rounded-2xl border-0 bg-card/95 backdrop-blur-sm shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-primary to-primary/80 rounded-xl flex items-center justify-center">
                <Folder size={20} className="text-primary-foreground" />
              </div>
              Create New Project
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-5 py-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Project Name</label>
              <Input
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                maxLength={80}
                placeholder="e.g. Test Network"
                className="rounded-xl border-2 focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
              <div className="text-xs text-muted-foreground mt-1">{newProjectName.length}/80</div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-foreground">Assign Team Members</label>
                <span className="text-xs text-muted-foreground">{selectedAssigneeIds.size} selected</span>
              </div>
              {isUsersLoading ? (
                <div className="flex items-center justify-center h-20 border rounded-xl bg-muted">Loading team members...</div>
              ) : (
                <>
                  <div className="mb-3 relative">
                    <Search size={18} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder="Search team members"
                      className="pl-9 rounded-xl border-2 focus:border-primary focus:ring-2 focus:ring-primary/20"
                      value={createTeamSearch}
                      onChange={(e) => setCreateTeamSearch(e.target.value)}
                    />
                  </div>
                  {usersError ? (
                    <div className="p-4 text-sm text-muted-foreground border rounded-xl bg-muted">
                      Unable to load other users. You can still create the project; you will be the sole assignee.
                    </div>
                  ) : hasCreateSearch ? (
                    filteredUsersForCreate.length > 0 ? (
                      <div className="max-h-60 overflow-auto border rounded-xl divide-y">
                        {filteredUsersForCreate.map(u => (
                          <label key={u.id} className="flex items-center gap-3 py-3 px-4 hover:bg-muted cursor-pointer">
                            <input
                              type="checkbox"
                              checked={selectedAssigneeIds.has(u.id)}
                              onChange={() => toggleAssignee(u.id, setSelectedAssigneeIds)}
                              className="rounded border-border text-primary focus:ring-primary"
                            />
                            <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-muted-foreground text-sm font-medium">
                              {(u.name || u.email || '?').charAt(0).toUpperCase()}
                            </div>
                            <div className="flex flex-col">
                              <span className="text-sm font-medium text-foreground">{u.name || 'Unnamed User'}</span>
                              {/*<span className="text-xs text-muted-foreground">{u.email || 'No email'}</span>*/}
                            </div>
                          </label>
                        ))}
                      </div>
                    ) : (
                      <div className="p-4 text-sm text-muted-foreground border rounded-xl bg-muted">
                        No users found for "{createTeamSearch.trim()}".
                        {isValidEmail(createTeamSearch.trim()) && (
                          <div className="mt-3 flex items-center gap-3">
                            <Button
                              onClick={() => inviteEmail(createTeamSearch.trim())}
                              disabled={inviteLoading}
                              className="rounded-xl"
                            >
                              {inviteLoading ? 'Inviting...' : 'Invite by email'}
                            </Button>
                            {inviteMessage && <div className="text-sm text-emerald-700">{inviteMessage}</div>}
                            {inviteError && <div className="text-sm text-red-600">{inviteError}</div>}
                          </div>
                        )}
                      </div>
                    )
                  ) : (
                    <div className="p-4 text-sm text-muted-foreground border rounded-xl bg-muted">
                      Start typing a name or email to search for team members.
                    </div>
                  )}
                </>
              )}
              {usersError && <div className="text-xs text-red-600 mt-2 flex items-center"><AlertCircle size={14} className="mr-1" />{usersError}</div>}
              {currentUserId && <p className="text-xs text-muted-foreground mt-3 flex items-center"><UserCheck size={14} className="mr-1" />You will be added as Project Creator by default.</p>}
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => { setIsCreateOpen(false); resetCreateForm(); }}
              disabled={isCreateLoading}
              className="rounded-xl border-border"
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateProject}
              disabled={!newProjectName.trim() || isCreateLoading}
              className="rounded-xl text-primary-foreground transition-all duration-300 hover:scale-105 active:scale-95 shadow-lg hover:shadow-xl bg-primary"
            >
              {isCreateLoading ? (<><Loader2 className="animate-spin mr-2" size={16} /> Creating...</>) : 'Create Project'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Assignees Dialog */}
      <Dialog open={isAssigneesOpen} onOpenChange={(open) => { setIsAssigneesOpen(open); if (!open) setAssigneesProject(null); }}>
        <DialogContent className="sm:max-w-md rounded-2xl border-0 bg-card/95 backdrop-blur-sm shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-primary to-primary/80 rounded-xl flex items-center justify-center">
                <Users size={20} className="text-primary-foreground" />
              </div>
              Project Assignees {assigneesProject && `: ${assigneesProject.name || 'Untitled Project'}`}
            </DialogTitle>
          </DialogHeader>
          <div className="py-4 max-h-96 overflow-auto">
            {assigneesProject && assigneesProject.assignees && assigneesProject.assignees.length > 0 ? (
              <div className="space-y-3">
                {assigneesProject.assignees.map(id => {
                  const u = userIdToUser[id];
                  const isUnknown = !u;
                  const label = isUnknown ? 'Deleted user' : (u.name || u.email || id);
                  const initials = isUnknown ? '?' : ((label || "").split(/[\s@._-]+/).filter(Boolean).slice(0, 2).map(s => s[0]?.toUpperCase()).join("") || "?");
                  return (
                    <div key={id} className="flex items-center gap-3 p-3 rounded-xl border border-border hover:bg-muted transition-colors">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium ${isUnknown ? 'bg-gradient-to-br from-gray-400 to-gray-600 text-white' : 'bg-muted text-muted-foreground'}`}>
                        {initials}
                      </div>
                      <div className="flex flex-col">
                        <span className="text-sm font-medium text-foreground">{isUnknown ? 'Deleted user' : (u?.name || 'Unnamed User')}</span>
                        <span className="text-xs text-muted-foreground">{isUnknown ? '(email unavailable)' : (u?.email || 'No email')}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Users size={40} className="mx-auto mb-3 text-muted-foreground" />
                <p>No assignees for this project</p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              onClick={() => setIsAssigneesOpen(false)}
              className="rounded-xl text-primary-foreground transition-all duration-300 hover:scale-105 active:scale-95 shadow-lg hover:shadow-xl bg-primary"
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={isEditOpen} onOpenChange={(open) => { setIsEditOpen(open); if (!open) { setEditingProject(null); setEditTeamSearch(""); } }}>
        <DialogContent className="sm:max-w-xl rounded-2xl border-0 bg-card/95 backdrop-blur-sm shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-primary to-primary/80 rounded-xl flex items-center justify-center">
                <Edit size={20} className="text-primary-foreground" />
              </div>
              Edit Project
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-5 py-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Project Name</label>
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="Enter project name"
                maxLength={80}
                className="rounded-xl border-2 focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
              <div className="text-xs text-muted-foreground mt-1">{editName.length}/80</div>
            </div>
            {/* Assigned Team Members Section */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-foreground">Assigned Team Members</label>
                <span className="text-xs text-muted-foreground">{editSelectedAssigneeIds.size} assigned</span>
              </div>
              {isUsersLoading ? (
                <div className="flex items-center justify-center h-20 border rounded-xl bg-muted">Loading team members...</div>
              ) : assignedUsersForEdit.length > 0 ? (
                <div className="max-h-40 overflow-auto border rounded-xl divide-y">
                  {assignedUsersForEdit.map(u => {
                    const isCreator = editingProject && editingProject.creator_email === u.email;
                    const assigneeEditDisabled = policyAttrs.onlyAdminsEditAssignees && !isAdmin;
                    return (
                      <div key={u.id} className={`flex items-center gap-3 py-3 px-4 ${isCreator ? 'bg-muted' : ''}`}>
                        <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-muted-foreground text-sm font-medium">
                          {(u.name || u.email || '?').charAt(0).toUpperCase()}
                        </div>
                        <div className="flex flex-col flex-1">
                          <span className="text-sm font-medium text-foreground">{u.name || 'Unnamed User'}</span>
                          <span className="text-xs text-muted-foreground">{u.email || 'No email'}</span>
                        </div>
                        {isCreator ? (
                          <span className="inline-block bg-primary/10 text-primary text-xs px-2 py-0.5 rounded-full">Creator</span>
                        ) : (
                          <button
                            type="button"
                            className="text-muted-foreground hover:text-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            onClick={() => toggleAssignee(u.id, setEditSelectedAssigneeIds)}
                            disabled={assigneeEditDisabled}
                            aria-label="Remove from project"
                          >
                            <X size={16} />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="p-4 text-sm text-muted-foreground border rounded-xl bg-muted">
                  No team members assigned yet.
                </div>
              )}
              {/* Cleanup for deleted assignees */}
              {(() => {
                const unknownIds = Array.from(editSelectedAssigneeIds).filter(id => !knownUserIds.has(id));
                if (unknownIds.length === 0) return null;
                return (
                  <div className="mt-3 p-3 rounded-xl border border-amber-200 bg-amber-50">
                    <div className="text-sm font-medium text-amber-800 mb-2">Deleted users in assignees</div>
                    <div className="flex flex-wrap gap-2 mb-3">
                      {unknownIds.map(id => (
                        <span key={id} className="inline-flex items-center gap-1 text-xs bg-white border border-amber-200 text-amber-800 px-2 py-1 rounded-full">
                          Deleted user
                          <span className="opacity-60">(email unavailable)</span>
                          <button
                            type="button"
                            className="ml-1 text-amber-700 hover:text-amber-900"
                            onClick={() => setEditSelectedAssigneeIds(prev => { const next = new Set(prev); next.delete(id); return next; })}
                            disabled={policyAttrs.onlyAdminsEditAssignees && !isAdmin}
                            aria-label="Remove deleted user from assignees"
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      className="border-amber-300 text-amber-800 hover:bg-amber-100"
                      onClick={() => setEditSelectedAssigneeIds(prev => new Set(Array.from(prev).filter(id => knownUserIds.has(id))))}
                      disabled={policyAttrs.onlyAdminsEditAssignees && !isAdmin}
                    >
                      Remove all deleted users
                    </Button>
                  </div>
                );
              })()}
            </div>

            {/* Add Team Members Section */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Add Team Members</label>
              <div className="mb-3 relative">
                <Search size={18} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search by name or email to add members"
                  className="pl-9 rounded-xl border-2 focus:border-primary focus:ring-2 focus:ring-primary/20"
                  value={editTeamSearch}
                  onChange={(e) => setEditTeamSearch(e.target.value)}
                />
              </div>
              {usersError ? (
                <div className="p-4 text-sm text-muted-foreground border rounded-xl bg-muted">
                  Unable to load users. You can still update the project.
                </div>
              ) : hasEditSearch ? (
                filteredUsersForEdit.length > 0 ? (
                  <div className="max-h-40 overflow-auto border rounded-xl divide-y">
                    {filteredUsersForEdit.map(u => {
                      const assigneeEditDisabled = policyAttrs.onlyAdminsEditAssignees && !isAdmin;
                      return (
                        <label key={u.id} className={`flex items-center gap-3 py-3 px-4 ${assigneeEditDisabled ? 'bg-muted cursor-not-allowed opacity-60' : 'hover:bg-muted cursor-pointer'}`}>
                          <input
                            type="checkbox"
                            checked={editSelectedAssigneeIds.has(u.id)}
                            onChange={() => toggleAssignee(u.id, setEditSelectedAssigneeIds)}
                            disabled={assigneeEditDisabled}
                            className="rounded border-border text-primary focus:ring-primary"
                          />
                          <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-muted-foreground text-sm font-medium">
                            {(u.name || u.email || '?').charAt(0).toUpperCase()}
                          </div>
                          <div className="flex flex-col">
                            <span className="text-sm font-medium text-foreground">{u.name || 'Unnamed User'}</span>
                            <span className="text-xs text-muted-foreground">{u.email || 'No email'}</span>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                ) : (
                  <div className="p-4 text-sm text-muted-foreground border rounded-xl bg-muted">
                    No users found for "{editTeamSearch.trim()}".
                    {isValidEmail(editTeamSearch.trim()) && (
                      <div className="mt-3 flex items-center gap-3">
                        <Button
                          onClick={() => inviteEmail(editTeamSearch.trim())}
                          disabled={inviteLoading}
                          className="rounded-xl"
                        >
                          {inviteLoading ? 'Inviting...' : 'Invite by email'}
                        </Button>
                        {inviteMessage && <div className="text-sm text-emerald-700">{inviteMessage}</div>}
                        {inviteError && <div className="text-sm text-red-600">{inviteError}</div>}
                      </div>
                    )}
                  </div>
                )
              ) : (
                <div className="p-4 text-sm text-muted-foreground border rounded-xl bg-muted">
                  Start typing a name or email to search for team members to add.
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => { setIsEditOpen(false); setEditingProject(null); }}
              disabled={isUpdateLoading}
              className="rounded-xl border-border"
            >
              Cancel
            </Button>
            <Button
              onClick={handleUpdateProject}
              disabled={!editName.trim() || isUpdateLoading}
              className="rounded-xl text-primary-foreground transition-all duration-300 hover:scale-105 active:scale-95 shadow-lg hover:shadow-xl bg-primary"
            >
              {isUpdateLoading ? (<><Loader2 className="animate-spin mr-2" size={16} /> Saving...</>) : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteCandidate} onOpenChange={(open) => { if (!open) setDeleteCandidate(null); }}>
        <DialogContent className="sm:max-w-md rounded-2xl border-0 bg-card/95 backdrop-blur-sm shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-red-500 to-red-600 rounded-xl flex items-center justify-center">
                <Trash2 size={20} className="text-white" />
              </div>
              Delete Project
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-muted-foreground">
              Are you sure you want to delete <strong className="text-foreground">{deleteCandidate?.name ?? 'this project'}</strong>? This action cannot be undone.
            </p>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteCandidate(null)}
              disabled={isDeleteLoading}
              className="rounded-xl border-border"
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

        </div>
      </div>
    </main>
  );
};

export default HomePage;