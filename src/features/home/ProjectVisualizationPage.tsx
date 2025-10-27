import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AlertCircle, ArrowLeft, Calendar, CheckCircle2, FilePenLine, Folder, Loader2, RefreshCcw, Users, X } from "lucide-react";
import { Button } from "../../components/ui/button";
import NetworkGraph, { useNetworkData } from "./NetworkGraph";
import { supabase } from "../../supabaseClient";
import { Badge } from "../../components/ui/badge";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../../components/ui/dialog";
import { inferRulesFromBiomolecules } from "../../lib/openRouter";

type ProjectRecord = {
  id: string;
  name?: string | null;
  assignees?: string[] | null;
  created_at?: string | null;
  creator_email?: string | null;
};

const ProjectVisualizationPage: React.FC = () => {
  const navigate = useNavigate();
  const { projectId } = useParams<{ projectId: string }>();
  const [project, setProject] = useState<ProjectRecord | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [manualBiomolecules, setManualBiomolecules] = useState<string>("");
  const [manualRules, setManualRules] = useState<string>("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileInputKey, setFileInputKey] = useState(0);
  const [isInferring, setIsInferring] = useState(false);
  const [inferMessage, setInferMessage] = useState<string | null>(null);
  const [hasInferred, setHasInferred] = useState(false);
  const [isEditInferring, setIsEditInferring] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editNodesText, setEditNodesText] = useState<string>("");
  const [editRulesText, setEditRulesText] = useState<string>("");
  const [isSavingNetwork, setIsSavingNetwork] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [networkBanner, setNetworkBanner] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [networkRefreshToken, setNetworkRefreshToken] = useState(0);
  const [editNodesFileKey, setEditNodesFileKey] = useState(0);
  const [editRulesFileKey, setEditRulesFileKey] = useState(0);
  const [editNodesFileName, setEditNodesFileName] = useState<string | null>(null);
  const [editRulesFileName, setEditRulesFileName] = useState<string | null>(null);

  const { data: networkData, isLoading: isNetworkLoading, error: networkError } = useNetworkData(projectId ?? undefined, networkRefreshToken);

  useEffect(() => {
    let active = true;
    if (!projectId) {
      setError("Missing project identifier.");
      setIsLoading(false);
      return () => {
        active = false;
      };
    }

    const load = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const { data, error } = await supabase
          .from("projects")
          .select("id, name, assignees, created_at, creator_email")
          .eq("id", projectId)
          .maybeSingle();

        if (!active) return;

        if (error) {
          setError(error.message || "Failed to load project.");
          setProject(null);
        } else if (!data) {
          setError("Project not found.");
          setProject(null);
        } else {
          setProject(data as ProjectRecord);
          setError(null);
        }
      } catch (err: any) {
        if (!active) return;
        setError(err?.message || "Failed to load project.");
        setProject(null);
      } finally {
        if (active) setIsLoading(false);
      }
    };

    load();
    return () => {
      active = false;
    };
  }, [projectId]);

  const formattedDate = useMemo(() => {
    if (!project?.created_at) return null;
    try {
      return new Date(project.created_at).toLocaleString();
    } catch {
      return project.created_at;
    }
  }, [project?.created_at]);

  const assigneeCount = project?.assignees?.length ?? 0;
  const isInferDisabled = !selectedFile;

  const parseNodesList = useCallback((input: string) => {
    return input
      .replace(/\r\n/g, "\n")
      .split(/[\n,]/)
      .map((entry) => entry.trim())
      .filter(Boolean);
  }, []);

  const parseRulesList = useCallback((input: string) => {
    const normalized = input.replace(/\r\n/g, "\n").trim();
    if (!normalized) return [] as string[];
    const byLine = normalized.split("\n").map((line) => line.trim()).filter(Boolean);
    if (byLine.length > 1) return byLine;
    return normalized.split(",").map((entry) => entry.trim()).filter(Boolean);
  }, []);

  const resetCreateNetworkState = useCallback(() => {
    setSelectedFile(null);
    setManualBiomolecules("");
    setManualRules("");
    setInferMessage(null);
    setIsInferring(false);
    setFileInputKey((prev) => prev + 1);
    setHasInferred(false);
  }, []);

  useEffect(() => {
    if (networkError) {
      setNetworkBanner({ type: "error", message: networkError });
    }
  }, [networkError]);

  const existingNodesText = useMemo(() => {
    const nodes = Array.isArray(networkData?.nodes) ? (networkData?.nodes as Array<any>) : [];
    if (!nodes.length) return "";
    return nodes
      .map((node) => (node?.label || node?.id || "").toString())
      .filter(Boolean)
      .join(", ");
  }, [networkData]);

  const existingRulesList = useMemo(() => {
    if (Array.isArray((networkData as any)?.rules)) {
      return (networkData as any).rules as string[];
    }
    const metadataRules = (networkData as any)?.metadata?.rules;
    if (Array.isArray(metadataRules)) return metadataRules as string[];
    return [] as string[];
  }, [networkData]);

  const existingRulesText = useMemo(() => {
    if (!existingRulesList.length) return "";
    return existingRulesList.join("\n");
  }, [existingRulesList]);

  useEffect(() => {
    if (!isEditDialogOpen) return;
    setEditNodesText(existingNodesText);
    setEditRulesText(existingRulesText);
    setEditError(null);
    setEditNodesFileName(null);
    setEditRulesFileName(null);
  }, [existingNodesText, existingRulesText, isEditDialogOpen]);

  const resetEditDialog = useCallback(() => {
    setEditError(null);
    setEditNodesText("");
    setEditRulesText("");
    setIsSavingNetwork(false);
    setEditNodesFileName(null);
    setEditRulesFileName(null);
    setEditNodesFileKey((prev) => prev + 1);
    setEditRulesFileKey((prev) => prev + 1);
  }, []);

  const handleEditNodesFile = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      setEditNodesText(text.replace(/\r\n/g, "\n").trim());
      setEditNodesFileName(file.name);
      setEditError(null);
    } catch {
      setEditError("Unable to read nodes file.");
    }
  }, []);

  const handleEditRulesFile = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      setEditRulesText(text.replace(/\r\n/g, "\n").trim());
      setEditRulesFileName(file.name);
      setEditError(null);
    } catch {
      setEditError("Unable to read rules file.");
    }
  }, []);

  const buildNodesFromNames = useCallback((names: string[]) => {
    const existingNodes = Array.isArray(networkData?.nodes) ? (networkData?.nodes as Array<any>) : [];
    const usedIds = new Set<string>();
    const existingLookup = new Map<string, any>();

    existingNodes.forEach((node) => {
      const labelValue = (node?.label ?? "").toString().trim();
      const idValue = (node?.id ?? "").toString().trim();
      if (labelValue) existingLookup.set(labelValue.toLowerCase(), node);
      if (idValue) existingLookup.set(idValue.toLowerCase(), node);
      if (idValue) usedIds.add(idValue);
    });

    const slugify = (value: string) => {
      const base = value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
      return base || "node";
    };

    const allocateId = (base: string) => {
      let candidate = base;
      let index = 1;
      while (usedIds.has(candidate)) {
        candidate = `${base}-${index}`;
        index += 1;
      }
      usedIds.add(candidate);
      return candidate;
    };

    const seen = new Set<string>();
    const result: Array<{ id: string; label: string; type?: string }> = [];

    names.forEach((rawName) => {
      const name = rawName.trim();
      if (!name) return;
      const normalized = name.toLowerCase();
      if (seen.has(normalized)) return;
      seen.add(normalized);

      const existing = existingLookup.get(normalized);
      if (existing) {
        const existingId = existing.id ? String(existing.id) : allocateId(slugify(name));
        usedIds.add(existingId);
        result.push({
          ...existing,
          id: existingId,
          label: name,
          type: existing.type ?? "entity",
        });
      } else {
        const baseId = slugify(name);
        const idValue = allocateId(baseId);
        result.push({ id: idValue, label: name, type: "entity" });
      }
    });

    return result;
  }, [networkData]);

  const sanitizeEdges = useCallback((nodes: Array<{ id: string }>) => {
    const allowed = new Set(nodes.map((node) => String(node.id)));
    const edges = Array.isArray(networkData?.edges) ? (networkData?.edges as Array<any>) : [];

    const extractId = (value: any) => {
      if (typeof value === "string") return value;
      if (value && typeof value === "object" && "id" in value) return String((value as any).id);
      return value != null ? String(value) : "";
    };

    return edges
      .map((edge) => ({
        ...edge,
        source: extractId(edge?.source),
        target: extractId(edge?.target),
      }))
      .filter((edge) => allowed.has(String(edge.source)) && allowed.has(String(edge.target)));
  }, [networkData]);

  const buildEdgesFromRules = useCallback((rules: string[], nodes: Array<{ id: string; label: string }>) => {
    const nodeLookup = new Map<string, { id: string; label: string }>();

    nodes.forEach((node) => {
      const label = node.label?.toLowerCase();
      if (label) nodeLookup.set(label, node);
      nodeLookup.set(node.id.toLowerCase(), node);
    });

    const edges: Array<{ source: string; target: string; interaction: string }> = [];
    const edgeKeys = new Set<string>();

    const tokenRegex = /[A-Za-z0-9_]+/g;

    for (const rule of rules) {
      const [lhsRaw, rhsRaw] = rule.split("=");
      if (!lhsRaw || !rhsRaw) continue;

      const targetName = lhsRaw.trim();
      if (!targetName) continue;
      const targetNode = nodeLookup.get(targetName.toLowerCase());
      if (!targetNode) continue;

      const sources = new Set<string>();
      const matches = rhsRaw.match(tokenRegex) || [];
      for (const token of matches) {
        const normalized = token.trim().toLowerCase();
        if (!normalized || normalized === targetName.toLowerCase()) continue;
        if (nodeLookup.has(normalized)) sources.add(normalized);
      }

      sources.forEach((sourceName) => {
        const sourceNode = nodeLookup.get(sourceName);
        if (!sourceNode) return;
        const key = `${sourceNode.id}|${targetNode.id}`;
        if (edgeKeys.has(key)) return;
        edgeKeys.add(key);
        edges.push({ source: sourceNode.id, target: targetNode.id, interaction: "inferred" });
      });
    }

    return edges;
  }, []);

  const handleSaveNetwork = useCallback(async () => {
    if (!projectId) {
      setEditError("Missing project identifier.");
      return;
    }

    const parsedNames = parseNodesList(editNodesText);
    if (!parsedNames.length) {
      setEditError("Provide at least one node (comma- or newline-separated).");
      return;
    }

    const rules = parseRulesList(editRulesText);
    const nodes = buildNodesFromNames(parsedNames);
    const edges = rules.length ? buildEdgesFromRules(rules, nodes) : sanitizeEdges(nodes);
    const updatedNetwork = {
      ...(networkData ?? { nodes: [], edges: [] }),
      nodes,
      edges,
      rules,
    };

    try {
      setIsSavingNetwork(true);
      const { error: updateError } = await supabase
        .from("projects")
        .update({ network_data: updatedNetwork })
        .eq("id", projectId);

      if (updateError) throw updateError;

      setNetworkBanner({ type: "success", message: "Network updated successfully." });
      setIsEditDialogOpen(false);
      setNetworkRefreshToken((prev) => prev + 1);
    } catch (err: any) {
      const message = err?.message || "Failed to save network.";
      setEditError(message);
      setNetworkBanner({ type: "error", message });
    } finally {
      setIsSavingNetwork(false);
    }
  }, [
    buildEdgesFromRules,
    buildNodesFromNames,
    editNodesText,
    editRulesText,
    networkData,
    parseNodesList,
    parseRulesList,
    projectId,
    sanitizeEdges,
  ]);

  const handleEditInferRules = useCallback(async () => {
    if (!projectId) {
      setEditError("Missing project identifier; cannot infer rules.");
      return;
    }

    const biomolecules = parseNodesList(editNodesText);
    if (!biomolecules.length) {
      setEditError("Provide at least one node before inferring rules.");
      return;
    }

    try {
      setIsEditInferring(true);
      setEditError(null);

      const rules = await inferRulesFromBiomolecules(biomolecules);
      if (!rules.length) {
        setEditError("No rules inferred for the current nodes.");
        return;
      }

      const nodes = buildNodesFromNames(biomolecules);
      const edges = buildEdgesFromRules(rules, nodes);
      const updatedNetwork = {
        ...(networkData ?? { nodes: [], edges: [], rules: [] }),
        nodes,
        edges,
        rules,
      };

      const { error: updateError } = await supabase
        .from("projects")
        .update({ network_data: updatedNetwork })
        .eq("id", projectId);

      if (updateError) throw updateError;

      setEditNodesText(nodes.map((node) => node.label).join(", "));
      setEditRulesText(rules.join("\n"));
      setNetworkBanner({ type: "success", message: "Network updated from newly inferred rules." });
      setNetworkRefreshToken((prev) => prev + 1);
    } catch (err: any) {
      const message = err?.message || "Failed to infer rules for the edited network.";
      setEditError(message);
      setNetworkBanner({ type: "error", message });
    } finally {
      setIsEditInferring(false);
    }
  }, [
    buildEdgesFromRules,
    buildNodesFromNames,
    editNodesText,
    networkData,
    parseNodesList,
    projectId,
  ]);

  const handleFileChange = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    setSelectedFile(file);
    setInferMessage(null);

    if (!file) return;

    try {
      const text = await file.text();
      const parsed = parseNodesList(text);
      setManualBiomolecules(parsed.join(", "));
    } catch {
      setInferMessage("Unable to read biomolecules file. Please try a txt or csv formatted list.");
    }
  }, [parseNodesList]);

  const handleInferRules = useCallback(async () => {
    if (isInferDisabled) {
      setInferMessage("Upload a biomolecules file before inferring rules.");
      return;
    }

    if (!projectId) {
      setInferMessage("Missing project identifier; cannot save inferred rules.");
      return;
    }

    try {
      setInferMessage(null);
      setIsInferring(true);

      let biomolecules: string[] = [];
      if (selectedFile) {
        const fileText = await selectedFile.text();
        biomolecules = parseNodesList(fileText);
      }

      if (!biomolecules.length) {
        setInferMessage("The uploaded file did not contain any biomolecules. Ensure it lists entries like a, b, c, d.");
        return;
      }

      const rules = await inferRulesFromBiomolecules(biomolecules);
      if (!rules.length) {
        setInferMessage("No rules were inferred. Try refining the biomolecules list.");
        return;
      }

      const nodes = buildNodesFromNames(biomolecules);
      const edges = buildEdgesFromRules(rules, nodes);
      const updatedNetwork = {
        ...(networkData ?? { nodes: [], edges: [], rules: [] }),
        nodes,
        edges,
        rules,
      };

      const { error: updateError } = await supabase
        .from("projects")
        .update({ network_data: updatedNetwork })
        .eq("id", projectId);

      if (updateError) throw updateError;

      setManualBiomolecules(nodes.map((node) => node.label).join(", "));
      setManualRules(rules.join("\n"));
      setInferMessage(`Generated ${rules.length} rule${rules.length === 1 ? "" : "s"} from ${biomolecules.length} biomolecule${biomolecules.length === 1 ? "" : "s"}.`);
  setHasInferred(true);
      setNetworkBanner({ type: "success", message: "Network updated from inferred rules." });
      setNetworkRefreshToken((prev) => prev + 1);
    } catch (err: any) {
      const message = err?.message || "Failed to infer rules using OpenRouter.";
      setInferMessage(message);
      setNetworkBanner({ type: "error", message });
    } finally {
      setIsInferring(false);
    }
  }, [
    buildEdgesFromRules,
    buildNodesFromNames,
    isInferDisabled,
    networkData,
    parseNodesList,
    projectId,
    selectedFile,
  ]);

  return (
    <main className="flex flex-1 flex-col gap-6 px-6 py-8 w-full">
      <div className="w-full max-w-7xl mx-auto flex flex-col gap-6 flex-1">
        <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            onClick={() => navigate(-1)}
            className="rounded-xl border-gray-300"
          >
            <ArrowLeft size={16} className="mr-2" />
            Back
          </Button>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#b1ceff] to-[#003db6] flex items-center justify-center text-white shadow-lg">
              <Folder size={22} />
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-gray-900">
                {project?.name || "Project"}
              </h1>
              {formattedDate && (
                <div className="flex items-center text-sm text-gray-500 mt-1">
                  <Calendar size={14} className="mr-1.5" />
                  {formattedDate}
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="secondary" className="bg-blue-50 text-[#2f5597] border-blue-200 rounded-lg">
            <Users size={14} className="mr-1" />
            {assigneeCount} assignee{assigneeCount === 1 ? "" : "s"}
          </Badge>
          <Button
            onClick={() => setIsCreateDialogOpen(true)}
            disabled={isLoading}
            className="flex items-center gap-2 px-5 py-2 rounded-xl font-semibold text-white shadow-lg transition-transform duration-300 hover:scale-105 active:scale-95"
            style={{ background: "linear-gradient(135deg, #2f5597 0%, #3b6bc9 100%)" }}
          >
            Create Network
          </Button>
          <Button
            variant="outline"
            onClick={() => setIsEditDialogOpen(true)}
            disabled={isLoading || isNetworkLoading}
            className="flex items-center gap-2 rounded-xl border-gray-300"
          >
            <FilePenLine size={16} />
            Edit Network
          </Button>
        </div>
        </div>

        {networkBanner && (
          <div
            className={`rounded-2xl border p-4 flex items-start justify-between backdrop-blur-sm ${
              networkBanner.type === "success"
                ? "bg-green-50/80 border-green-200 text-green-800"
                : "bg-red-50/80 border-red-200 text-red-800"
            }`}
          >
            <div className="flex items-start gap-3">
              <div
                className={`mt-0.5 rounded-full p-2 ${
                  networkBanner.type === "success" ? "bg-green-100" : "bg-red-100"
                }`}
              >
                {networkBanner.type === "success" ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
              </div>
              <p className="text-sm font-medium">{networkBanner.message}</p>
            </div>
            <button
              type="button"
              className="text-sm opacity-70 hover:opacity-100 transition-opacity"
              onClick={() => setNetworkBanner(null)}
              aria-label="Dismiss network banner"
            >
              <X size={16} />
            </button>
          </div>
        )}

        {isLoading ? (
          <div className="flex flex-1 items-center justify-center rounded-2xl border border-gray-200 bg-white/80 shadow-inner min-h-[420px]">
            <Loader2 className="animate-spin text-[#2f5597]" size={32} />
          </div>
        ) : !project || error ? (
          <div className="flex flex-1 items-center justify-center rounded-2xl border border-red-200 bg-red-50/70 text-red-700 min-h-[420px]">
            {error || "Project details unavailable."}
          </div>
        ) : (
          <div
            className="relative flex-1 rounded-2xl border border-gray-200 bg-white/90 shadow-lg p-3"
            style={{ minHeight: "480px", height: "calc(100vh - 220px)" }}
          >
            <div className="h-full w-full">
              <NetworkGraph projectId={projectId || undefined} height="100%" refreshToken={networkRefreshToken} />
            </div>
          </div>
        )}
      </div>

      <Dialog
        open={isCreateDialogOpen}
        onOpenChange={(open) => {
          setIsCreateDialogOpen(open);
          if (!open) {
            resetCreateNetworkState();
          }
        }}
      >
        <DialogContent className="sm:max-w-xl rounded-2xl border-0 bg-white/95 backdrop-blur-sm shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl">Create Network</DialogTitle>
            <DialogDescription>
              Upload a biomolecules list or paste it manually, then infer connectivity rules (OpenRouter workflow coming soon).
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-2">
            <div className="space-y-2">
              <Label htmlFor="biomolecule-file" className="text-sm font-medium text-gray-700">
                Upload biomolecules list
              </Label>
              <Input
                key={fileInputKey}
                id="biomolecule-file"
                type="file"
                accept=".csv,.tsv,.txt"
                onChange={handleFileChange}
                disabled={isInferring}
                className="rounded-xl border-2 focus:border-[#2f5597] focus:ring-2 focus:ring-blue-100"
              />
              {selectedFile && (
                <p className="text-xs text-gray-500">Selected: {selectedFile.name}</p>
              )}
            </div>

            <div className="relative">
              <div className="absolute inset-x-0 top-[-14px] flex items-center justify-center">
                <span className="bg-white px-3 text-xs font-semibold uppercase tracking-wider text-gray-400">
                  or
                </span>
              </div>
              <div className="h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="biomolecule-text" className="text-sm font-medium text-gray-700">
                Paste biomolecules list
              </Label>
              <textarea
                id="biomolecule-text"
                rows={6}
                value={manualBiomolecules}
                onChange={(event) => setManualBiomolecules(event.target.value)}
                disabled={isInferring}
                placeholder="a, b, c, d"
                className="w-full rounded-xl border-2 border-gray-200 px-3 py-2 text-sm text-gray-800 focus:border-[#2f5597] focus:outline-none focus:ring-2 focus:ring-blue-100"
              />
              <p className="text-xs text-gray-500">Use comma-separated or newline-separated identifiers (txt or csv format, e.g., a, b, c, d).</p>
              <p className="text-xs text-gray-400">Inference currently uses only the uploaded file; this field is optional for review or manual edits.</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="rule-text" className="text-sm font-medium text-gray-700">
                Existing rules (optional)
              </Label>
              <textarea
                id="rule-text"
                rows={5}
                value={manualRules}
                onChange={(event) => setManualRules(event.target.value)}
                disabled={isInferring}
                placeholder={`rule 1\nrule 2`}
                className="w-full rounded-xl border-2 border-gray-200 px-3 py-2 text-sm text-gray-800 focus:border-[#2f5597] focus:outline-none focus:ring-2 focus:ring-blue-100"
              />
              <p className="text-xs text-gray-500">One rule per line (text or csv). For example: rule 1 \n rule 2.</p>
            </div>

            {inferMessage && (
              <div className="rounded-xl border border-blue-200 bg-blue-50/70 px-4 py-3 text-sm text-[#1e40af]">
                {inferMessage}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsCreateDialogOpen(false)}
              disabled={isInferring}
              className="rounded-xl border-gray-300"
            >
              Cancel
            </Button>
            <Button
              onClick={hasInferred ? () => setIsCreateDialogOpen(false) : handleInferRules}
              disabled={isInferring || (!hasInferred && isInferDisabled)}
              className="rounded-xl px-5 py-2 font-semibold text-white shadow-lg transition-transform duration-300 hover:scale-105 active:scale-95 disabled:opacity-70"
              style={{ background: "linear-gradient(135deg, #2f5597 0%, #3b6bc9 100%)" }}
            >
              {isInferring ? (
                <span className="flex items-center gap-2"><Loader2 className="animate-spin" size={16} /> Inferring...</span>
              ) : hasInferred ? (
                "Close"
              ) : (
                "Infer rules"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={isEditDialogOpen}
        onOpenChange={(open) => {
          setIsEditDialogOpen(open);
          if (!open) {
            resetEditDialog();
          }
        }}
      >
        <DialogContent className="sm:max-w-2xl rounded-2xl border-0 bg-white/95 backdrop-blur-sm shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl">Edit Network</DialogTitle>
            <DialogDescription>
              Update the node list and rules inferred by the LLM. Provide data in text or csv format to add or remove entries.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-2">
            <div className="space-y-2">
              <Label htmlFor="edit-nodes-file" className="text-sm font-medium text-gray-700">
                Upload nodes list
              </Label>
              <Input
                key={editNodesFileKey}
                id="edit-nodes-file"
                type="file"
                accept=".csv,.tsv,.txt"
                onChange={handleEditNodesFile}
                disabled={isSavingNetwork}
                className="rounded-xl border-2 focus:border-[#2f5597] focus:ring-2 focus:ring-blue-100"
              />
              {editNodesFileName && (
                <p className="text-xs text-gray-500">Loaded: {editNodesFileName}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-nodes-text" className="text-sm font-medium text-gray-700">
                Nodes list
              </Label>
              <textarea
                id="edit-nodes-text"
                rows={6}
                value={editNodesText}
                onChange={(event) => setEditNodesText(event.target.value)}
                disabled={isSavingNetwork}
                placeholder="a, b, c, d"
                className="w-full rounded-xl border-2 border-gray-200 px-3 py-2 text-sm text-gray-800 focus:border-[#2f5597] focus:outline-none focus:ring-2 focus:ring-blue-100"
              />
              <p className="text-xs text-gray-500">Comma-separated or newline-separated identifiers (txt or csv format).</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-rules-file" className="text-sm font-medium text-gray-700">
                Upload rules list
              </Label>
              <Input
                key={editRulesFileKey}
                id="edit-rules-file"
                type="file"
                accept=".csv,.tsv,.txt"
                onChange={handleEditRulesFile}
                disabled={isSavingNetwork}
                className="rounded-xl border-2 focus:border-[#2f5597] focus:ring-2 focus:ring-blue-100"
              />
              {editRulesFileName && (
                <p className="text-xs text-gray-500">Loaded: {editRulesFileName}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-rules-text" className="text-sm font-medium text-gray-700">
                Rules list
              </Label>
              <textarea
                id="edit-rules-text"
                rows={6}
                value={editRulesText}
                onChange={(event) => setEditRulesText(event.target.value)}
                disabled={isSavingNetwork}
                placeholder={`rule 1\nrule 2`}
                className="w-full rounded-xl border-2 border-gray-200 px-3 py-2 text-sm text-gray-800 focus:border-[#2f5597] focus:outline-none focus:ring-2 focus:ring-blue-100"
              />
              <p className="text-xs text-gray-500">One rule per line (text or csv). For example: rule 1 \n rule 2.</p>
            </div>

            {editError && (
              <div className="rounded-xl border border-red-200 bg-red-50/80 px-4 py-3 text-sm text-red-700">
                {editError}
              </div>
            )}
            <div className="flex justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={handleEditInferRules}
                disabled={isSavingNetwork || isEditInferring}
                className="flex items-center gap-2 rounded-xl border-gray-300"
              >
                {isEditInferring ? <Loader2 size={16} className="animate-spin" /> : <RefreshCcw size={16} />}
                Infer new rules
              </Button>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsEditDialogOpen(false)}
              disabled={isSavingNetwork}
              className="rounded-xl border-gray-300"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveNetwork}
              disabled={isSavingNetwork}
              className="rounded-xl px-5 py-2 font-semibold text-white shadow-lg transition-transform duration-300 hover:scale-105 active:scale-95 disabled:opacity-70"
              style={{ background: "linear-gradient(135deg, #2f5597 0%, #3b6bc9 100%)" }}
            >
              {isSavingNetwork ? <span className="flex items-center gap-2"><Loader2 className="animate-spin" size={16} /> Saving...</span> : "Save network"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
};

export default ProjectVisualizationPage;
