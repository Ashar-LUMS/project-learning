"use client";

import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import NetworkGraph from "./NetworkGraph";
import { supabase } from "../../supabaseClient";
import NetworkEditorLayout from "./layout";

type ProjectRecord = {
  id: string;
  name?: string | null;
  assignees?: string[] | null;
  created_at?: string | null;
//   creator_email?: string | null;
//   network_data?: any;
// };

// type Network = {
//   id: string;
//   name: string;
//   description?: string;
//   created_at: string;
//   nodes: any[];
//   edges: any[];
//   rules: string[];
//   is_active?: boolean;
// };

// const csvEscape = (value: string | number | boolean | null | undefined): string => {
//   const stringValue = value === null || value === undefined ? "" : String(value);
//   if (stringValue.includes('"') || stringValue.includes(",") || stringValue.includes("\n")) {
//     return '"' + stringValue.replace(/"/g, '""') + '"';
//   }
//   return stringValue;
// };

// const buildAnalysisCsv = (result: DeterministicAnalysisResult): string => {
//   const lines: string[] = [];
//   const newline = "\r\n";

//   lines.push(["Summary"].map(csvEscape).join(","));
//   lines.push(["Nodes", result.nodeOrder.length].map(csvEscape).join(","));
//   lines.push(["Explored states", result.exploredStateCount].map(csvEscape).join(","));
//   lines.push(["Total state space", result.totalStateSpace].map(csvEscape).join(","));
//   lines.push(["Attractors", result.attractors.length].map(csvEscape).join(","));
//   lines.push(["Truncated", result.truncated ? "yes" : "no"].map(csvEscape).join(","));

//   if (result.warnings.length > 0) {
//     lines.push("");
//     lines.push(["Warnings"].map(csvEscape).join(","));
//     result.warnings.forEach((warning) => {
//       lines.push([warning].map(csvEscape).join(","));
//     });
//   }

//   lines.push("");
//   const nodeHeaders = result.nodeOrder.map((nodeId) => result.nodeLabels[nodeId] ?? nodeId);
//   lines.push([
//     "Attractor",
//     "Type",
//     "Period",
//     "State",
//     "Binary",
//     ...nodeHeaders,
//     "Basin size",
//     "Basin share",
//   ].map(csvEscape).join(","));

//   result.attractors.forEach((attractor, attractorIndex) => {
//     attractor.states.forEach((state, stateIndex) => {
//       const row = [
//         `Attractor ${attractorIndex + 1}`,
//         attractor.type,
//         attractor.period,
//         stateIndex + 1,
//         state.binary,
//         ...result.nodeOrder.map((nodeId) => state.values[nodeId] ?? 0),
//         attractor.basinSize,
//         attractor.basinShare,
//       ];
//       lines.push(row.map(csvEscape).join(","));
//     });
//   });

//   return lines.join(newline);
// };

// const ProjectVisualizationPage: React.FC = () => {
//   const navigate = useNavigate();
//   const { projectId } = useParams<{ projectId: string }>();
//   const [activeTab, setActiveTab] = useState<'projects' | 'network' | 'therapeutics' | 'analysis' | 'results'>('network');
//   const [project, setProject] = useState<ProjectRecord | null>(null);
//   const [isLoading, setIsLoading] = useState(true);
//   const [error, setError] = useState<string | null>(null);
  
//   // Multi-network state
//   const [networks, setNetworks] = useState<Network[]>([]);
//   const [selectedNetworkId, setSelectedNetworkId] = useState<string | null>(null);
//   const [isCreateNetworkDialogOpen, setIsCreateNetworkDialogOpen] = useState(false);
//   const [newNetworkName, setNewNetworkName] = useState("");
  
//   // Existing state
//   const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
//   const [manualBiomolecules, setManualBiomolecules] = useState<string>("");
//   const [manualRules, setManualRules] = useState<string>("");
//   const [selectedFile, setSelectedFile] = useState<File | null>(null);
//   const [fileInputKey, setFileInputKey] = useState(0);
//   const [rulesFileKey, setRulesFileKey] = useState(0);
//   const [rulesFileName, setRulesFileName] = useState<string | null>(null);
//   const [isInferring, setIsInferring] = useState(false);
//   const [inferMessage, setInferMessage] = useState<string | null>(null);
//   const [isCreatingNetwork, setIsCreatingNetwork] = useState(false);
//   const [isEditInferring, setIsEditInferring] = useState(false);
//   const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
//   const [editNodesText, setEditNodesText] = useState<string>("");
//   const [editRulesText, setEditRulesText] = useState<string>("");
//   const [isSavingNetwork, setIsSavingNetwork] = useState(false);
//   const [editError, setEditError] = useState<string | null>(null);
//   const [networkBanner, setNetworkBanner] = useState<{ type: "success" | "error"; message: string } | null>(null);
//   const [networkRefreshToken, setNetworkRefreshToken] = useState(0);
//   const [editNodesFileKey, setEditNodesFileKey] = useState(0);
//   const [editRulesFileKey, setEditRulesFileKey] = useState(0);
//   const [editNodesFileName, setEditNodesFileName] = useState<string | null>(null);
//   const [editRulesFileName, setEditRulesFileName] = useState<string | null>(null);
//   const [isAnalyzing, setIsAnalyzing] = useState(false);
//   const [analysisResult, setAnalysisResult] = useState<DeterministicAnalysisResult | null>(null);
//   const [analysisError, setAnalysisError] = useState<string | null>(null);

//   // Get selected network data
//   const selectedNetwork = useMemo(() => 
//     networks.find(network => network.id === selectedNetworkId) || networks[0],
//     [networks, selectedNetworkId]
//   );

//   // Load project and networks
//   useEffect(() => {
//     let active = true;
//     if (!projectId) {
//       setError("Missing project identifier.");
//       setIsLoading(false);
//       return () => {
//         active = false;
//       };
//     }

//     const load = async () => {
//       setIsLoading(true);
//       setError(null);
//       try {
//         const { data, error } = await supabase
//           .from("projects")
//           .select("id, name, assignees, created_at, creator_email, network_data")
//           .eq("id", projectId)
//           .maybeSingle();

//         if (!active) return;

//         if (error) {
//           setError(error.message || "Failed to load project.");
//           setProject(null);
//         } else if (!data) {
//           setError("Project not found.");
//           setProject(null);
//         } else {
//           setProject(data as ProjectRecord);
          
//           // Parse networks from network_data
//           const projectData = data as ProjectRecord;
//           let loadedNetworks: Network[] = [];
          
//           if (projectData.network_data) {
//             if (Array.isArray(projectData.network_data)) {
//               // If network_data is already an array of networks
//               loadedNetworks = projectData.network_data;
//             } else if (projectData.network_data.networks && Array.isArray(projectData.network_data.networks)) {
//               // If network_data has a networks array
//               loadedNetworks = projectData.network_data.networks;
//             } else if (projectData.network_data.nodes || projectData.network_data.edges) {
//               // If it's a single network object, convert to array
//               loadedNetworks = [{
//                 id: 'default',
//                 name: 'Default Network',
//                 created_at: new Date().toISOString(),
//                 nodes: projectData.network_data.nodes || [],
//                 edges: projectData.network_data.edges || [],
//                 rules: projectData.network_data.rules || []
//               }];
//             }
//           }
          
//           setNetworks(loadedNetworks);
//           setError(null);
//         }
//       } catch (err: any) {
//         if (!active) return;
//         setError(err?.message || "Failed to load project.");
//         setProject(null);
//       } finally {
//         if (active) setIsLoading(false);
//       }
//     };

//     load();
//     return () => {
//       active = false;
//     };
//   }, [projectId]);

//   // Set first network as selected when networks load
//   useEffect(() => {
//     if (networks.length > 0 && !selectedNetworkId) {
//       setSelectedNetworkId(networks[0].id);
//     }
//   }, [networks, selectedNetworkId]);

//   const formattedDate = useMemo(() => {
//     if (!project?.created_at) return null;
//     try {
//       return new Date(project.created_at).toLocaleString();
//     } catch {
//       return project.created_at;
//     }
//   }, [project?.created_at]);

//   const assigneeCount = project?.assignees?.length ?? 0;

//   // Network management functions
//   const handleCreateNewNetwork = useCallback(async () => {
//     if (!projectId || !newNetworkName.trim()) return;

//     const newNetwork: Network = {
//       id: `network-${Date.now()}`,
//       name: newNetworkName.trim(),
//       created_at: new Date().toISOString(),
//       nodes: [],
//       edges: [],
//       rules: []
//     };

//     const updatedNetworks = [...networks, newNetwork];
//     setNetworks(updatedNetworks);
//     setSelectedNetworkId(newNetwork.id);

//     try {
//       const { error } = await supabase
//         .from("projects")
//         .update({ 
//           network_data: { networks: updatedNetworks }
//         })
//         .eq("id", projectId);

//       if (error) throw error;

//       setNetworkBanner({ type: "success", message: "New network created successfully." });
//       setIsCreateNetworkDialogOpen(false);
//       setNewNetworkName("");
//     } catch (err: any) {
//       setNetworkBanner({ type: "error", message: "Failed to create network." });
//     }
//   }, [projectId, newNetworkName, networks]);

//   const handleDeleteNetwork = useCallback(async (networkId: string) => {
//     if (!projectId || networks.length <= 1) return;

//     const updatedNetworks = networks.filter(network => network.id !== networkId);
//     setNetworks(updatedNetworks);
    
//     if (selectedNetworkId === networkId) {
//       setSelectedNetworkId(updatedNetworks[0]?.id || null);
//     }

//     try {
//       const { error } = await supabase
//         .from("projects")
//         .update({ 
//           network_data: { networks: updatedNetworks }
//         })
//         .eq("id", projectId);

//       if (error) throw error;

//       setNetworkBanner({ type: "success", message: "Network deleted successfully." });
//     } catch (err: any) {
//       setNetworkBanner({ type: "error", message: "Failed to delete network." });
//     }
//   }, [projectId, networks, selectedNetworkId]);

//   const handleSwitchNetwork = useCallback((networkId: string) => {
//     setSelectedNetworkId(networkId);
//     setNetworkRefreshToken(prev => prev + 1);
//   }, []);

//   // Helper functions
//   const parseNodesList = useCallback((input: string) => {
//     return input
//       .replace(/\r\n/g, "\n")
//       .split(/[\n,]/)
//       .map((entry) => entry.trim())
//       .filter(Boolean);
//   }, []);

//   const parseRulesList = useCallback((input: string) => {
//     const normalized = input.replace(/\r\n/g, "\n").trim();
//     if (!normalized) return [] as string[];
//     const byLine = normalized.split("\n").map((line) => line.trim()).filter(Boolean);
//     if (byLine.length > 1) return byLine;
//     return normalized.split(",").map((entry) => entry.trim()).filter(Boolean);
//   }, []);

//   const manualBiomoleculeEntries = useMemo(
//     () => parseNodesList(manualBiomolecules),
//     [manualBiomolecules, parseNodesList],
//   );
//   const hasManualBiomolecules = manualBiomoleculeEntries.length > 0;
//   const canCreateNetwork = manualBiomoleculeEntries.length > 0;
//   const isInferDisabled = !selectedFile && !hasManualBiomolecules;

//   const resetCreateNetworkState = useCallback(() => {
//     setSelectedFile(null);
//     setManualBiomolecules("");
//     setManualRules("");
//     setInferMessage(null);
//     setIsInferring(false);
//     setFileInputKey((prev) => prev + 1);
//     setRulesFileKey((prev) => prev + 1);
//     setRulesFileName(null);
//     setIsCreatingNetwork(false);
//   }, []);

//   const resetEditDialog = useCallback(() => {
//     setEditError(null);
//     setEditNodesText("");
//     setEditRulesText("");
//     setIsSavingNetwork(false);
//     setEditNodesFileName(null);
//     setEditRulesFileName(null);
//     setEditNodesFileKey((prev) => prev + 1);
//     setEditRulesFileKey((prev) => prev + 1);
//   }, []);

//   // Network data functions (updated for multi-network)
//   const buildNodesFromNames = useCallback((names: string[], currentNetwork: Network) => {
//     const existingNodes = Array.isArray(currentNetwork?.nodes) ? currentNetwork.nodes : [];
//     const usedIds = new Set<string>();
//     const existingLookup = new Map<string, any>();

//     existingNodes.forEach((node) => {
//       const labelValue = (node?.label ?? "").toString().trim();
//       const idValue = (node?.id ?? "").toString().trim();
//       if (labelValue) existingLookup.set(labelValue.toLowerCase(), node);
//       if (idValue) existingLookup.set(idValue.toLowerCase(), node);
//       if (idValue) usedIds.add(idValue);
//     });

//     const slugify = (value: string) => {
//       const base = value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
//       return base || "node";
//     };

//     const allocateId = (base: string) => {
//       let candidate = base;
//       let index = 1;
//       while (usedIds.has(candidate)) {
//         candidate = `${base}-${index}`;
//         index += 1;
//       }
//       usedIds.add(candidate);
//       return candidate;
//     };

//     const seen = new Set<string>();
//     const result: Array<{ id: string; label: string; type?: string }> = [];

//     names.forEach((rawName) => {
//       const name = rawName.trim();
//       if (!name) return;
//       const normalized = name.toLowerCase();
//       if (seen.has(normalized)) return;
//       seen.add(normalized);

//       const existing = existingLookup.get(normalized);
//       if (existing) {
//         const existingId = existing.id ? String(existing.id) : allocateId(slugify(name));
//         usedIds.add(existingId);
//         result.push({
//           ...existing,
//           id: existingId,
//           label: name,
//           type: existing.type ?? "entity",
//         });
//       } else {
//         const baseId = slugify(name);
//         const idValue = allocateId(baseId);
//         result.push({ id: idValue, label: name, type: "entity" });
//       }
//     });

//     return result;
//   }, []);

//   const sanitizeEdges = useCallback((nodes: Array<{ id: string }>, currentNetwork: Network) => {
//     const allowed = new Set(nodes.map((node) => String(node.id)));
//     const edges = Array.isArray(currentNetwork?.edges) ? currentNetwork.edges : [];

//     const extractId = (value: any) => {
//       if (typeof value === "string") return value;
//       if (value && typeof value === "object" && "id" in value) return String((value as any).id);
//       return value != null ? String(value) : "";
//     };

//     return edges
//       .map((edge) => ({
//         ...edge,
//         source: extractId(edge?.source),
//         target: extractId(edge?.target),
//       }))
//       .filter((edge) => allowed.has(String(edge.source)) && allowed.has(String(edge.target)));
//   }, []);

//   const buildEdgesFromRules = useCallback((rules: string[], nodes: Array<{ id: string; label: string }>) => {
//     const nodeLookup = new Map<string, { id: string; label: string }>();

//     nodes.forEach((node) => {
//       const label = node.label?.toLowerCase();
//       if (label) nodeLookup.set(label, node);
//       nodeLookup.set(node.id.toLowerCase(), node);
//     });

//     const edges: Array<{ source: string; target: string; interaction: string }> = [];
//     const edgeKeys = new Set<string>();

//     const tokenRegex = /[A-Za-z0-9_]+/g;

//     for (const rule of rules) {
//       const [lhsRaw, rhsRaw] = rule.split("=");
//       if (!lhsRaw || !rhsRaw) continue;

//       const targetName = lhsRaw.trim();
//       if (!targetName) continue;
//       const targetNode = nodeLookup.get(targetName.toLowerCase());
//       if (!targetNode) continue;

//       const sources = new Set<string>();
//       const matches = rhsRaw.match(tokenRegex) || [];
//       for (const token of matches) {
//         const normalized = token.trim().toLowerCase();
//         if (!normalized || normalized === targetName.toLowerCase()) continue;
//         if (nodeLookup.has(normalized)) sources.add(normalized);
//       }

//       sources.forEach((sourceName) => {
//         const sourceNode = nodeLookup.get(sourceName);
//         if (!sourceNode) return;
//         const key = `${sourceNode.id}|${targetNode.id}`;
//         if (edgeKeys.has(key)) return;
//         edgeKeys.add(key);
//         edges.push({ source: sourceNode.id, target: targetNode.id, interaction: "inferred" });
//       });
//     }

//     return edges;
//   }, []);

//   // Updated handlers for multi-network
//   const handleSaveNetwork = useCallback(async () => {
//     if (!projectId || !selectedNetwork) {
//       setEditError("Missing project identifier or no network selected.");
//       return;
//     }

//     const parsedNames = parseNodesList(editNodesText);
//     if (!parsedNames.length) {
//       setEditError("Provide at least one node (comma- or newline-separated).");
//       return;
//     }

//     const rules = parseRulesList(editRulesText);
//     const nodes = buildNodesFromNames(parsedNames, selectedNetwork);
//     const edges = rules.length ? buildEdgesFromRules(rules, nodes) : sanitizeEdges(nodes, selectedNetwork);
    
//     const updatedNetwork = {
//       ...selectedNetwork,
//       nodes,
//       edges,
//       rules,
//     };

//     const updatedNetworks = networks.map(network => 
//       network.id === selectedNetwork.id ? updatedNetwork : network
//     );

//     try {
//       setIsSavingNetwork(true);
//       const { error: updateError } = await supabase
//         .from("projects")
//         .update({ 
//           network_data: { networks: updatedNetworks }
//         })
//         .eq("id", projectId);

//       if (updateError) throw updateError;

//       setNetworks(updatedNetworks);
//       setNetworkBanner({ type: "success", message: "Network updated successfully." });
//       setIsEditDialogOpen(false);
//       setNetworkRefreshToken((prev) => prev + 1);
//     } catch (err: any) {
//       const message = err?.message || "Failed to save network.";
//       setEditError(message);
//       setNetworkBanner({ type: "error", message });
//     } finally {
//       setIsSavingNetwork(false);
//     }
//   }, [projectId, selectedNetwork, networks, editNodesText, editRulesText, parseNodesList, parseRulesList, buildNodesFromNames, buildEdgesFromRules, sanitizeEdges]);

//   const handleEditInferRules = useCallback(async () => {
//     if (!projectId || !selectedNetwork) {
//       setEditError("Missing project identifier or no network selected.");
//       return;
//     }

//     const biomolecules = parseNodesList(editNodesText);
//     if (!biomolecules.length) {
//       setEditError("Provide at least one node before inferring rules.");
//       return;
//     }

//     try {
//       setIsEditInferring(true);
//       setEditError(null);

//       const rules = await inferRulesFromBiomolecules(biomolecules);
//       if (!rules.length) {
//         setEditError("No rules inferred for the current nodes.");
//         return;
//       }

//       const nodes = buildNodesFromNames(biomolecules, selectedNetwork);
//       const edges = buildEdgesFromRules(rules, nodes);
//       const updatedNetwork = {
//         ...selectedNetwork,
//         nodes,
//         edges,
//         rules,
//       };

//       const updatedNetworks = networks.map(network => 
//         network.id === selectedNetwork.id ? updatedNetwork : network
//       );

//       const { error: updateError } = await supabase
//         .from("projects")
//         .update({ 
//           network_data: { networks: updatedNetworks }
//         })
//         .eq("id", projectId);

//       if (updateError) throw updateError;

//       setNetworks(updatedNetworks);
//       setEditNodesText(nodes.map((node) => node.label).join(", "));
//       setEditRulesText(rules.join("\n"));
//       setNetworkBanner({ type: "success", message: "Network updated from newly inferred rules." });
//       setNetworkRefreshToken((prev) => prev + 1);
//     } catch (err: any) {
//       const message = err?.message || "Failed to infer rules for the edited network.";
//       setEditError(message);
//       setNetworkBanner({ type: "error", message });
//     } finally {
//       setIsEditInferring(false);
//     }
//   }, [projectId, selectedNetwork, networks, editNodesText, parseNodesList, buildNodesFromNames, buildEdgesFromRules]);

//   const handleFileChange = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
//     const file = event.target.files?.[0] ?? null;
//     setSelectedFile(file);
//     setInferMessage(null);

//     if (!file) return;

//     try {
//       const text = await file.text();
//       const parsed = parseNodesList(text);
//       setManualBiomolecules(parsed.join(", "));
//     } catch {
//       setInferMessage("Unable to read biomolecules file. Please try a txt or csv formatted list.");
//     }
//   }, [parseNodesList]);

//   const handleRulesFileChange = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
//     const file = event.target.files?.[0] ?? null;
//     setRulesFileName(file?.name ?? null);
//     if (!file) return;
//     try {
//       const text = await file.text();
//       setManualRules(text.replace(/\r\n/g, "\n").trim());
//     } catch {
//       setInferMessage("Unable to read rules file. Please try a txt or csv formatted list.");
//     }
//   }, []);

//   const handleInferRules = useCallback(async () => {
//     if (isInferDisabled) {
//       setInferMessage("Provide biomolecules by uploading a file or pasting them before inferring rules.");
//       return;
//     }

//     if (!projectId || !selectedNetwork) {
//       setInferMessage("Missing project identifier or no network selected.");
//       return;
//     }

//     try {
//       setInferMessage(null);
//       setIsInferring(true);

//       let biomolecules: string[] = [];
//       if (hasManualBiomolecules) {
//         biomolecules = [...manualBiomoleculeEntries];
//       }

//       if (!biomolecules.length && selectedFile) {
//         const fileText = await selectedFile.text();
//         biomolecules = parseNodesList(fileText);
//       }

//       if (!biomolecules.length) {
//         setInferMessage("The uploaded file did not contain any biomolecules. Ensure it lists entries like a, b, c, d.");
//         return;
//       }

//       biomolecules = Array.from(new Set(biomolecules.map((entry) => entry.trim()).filter(Boolean)));

//       const rules = await inferRulesFromBiomolecules(biomolecules);
//       if (!rules.length) {
//         setInferMessage("No rules were inferred. Try refining the biomolecules list.");
//         return;
//       }

//       const nodes = buildNodesFromNames(biomolecules, selectedNetwork);
//       const edges = buildEdgesFromRules(rules, nodes);
//       const updatedNetwork = {
//         ...selectedNetwork,
//         nodes,
//         edges,
//         rules,
//       };

//       const updatedNetworks = networks.map(network => 
//         network.id === selectedNetwork.id ? updatedNetwork : network
//       );

//       const { error: updateError } = await supabase
//         .from("projects")
//         .update({ 
//           network_data: { networks: updatedNetworks }
//         })
//         .eq("id", projectId);

//       if (updateError) throw updateError;

//       setNetworks(updatedNetworks);
//       setManualBiomolecules(nodes.map((node) => node.label).join(", "));
//       setManualRules(rules.join("\n"));
//       setInferMessage(`Generated ${rules.length} rule${rules.length === 1 ? "" : "s"} from ${biomolecules.length} biomolecule${biomolecules.length === 1 ? "" : "s"}.`);
//       setNetworkBanner({ type: "success", message: "Network updated from inferred rules." });
//       setNetworkRefreshToken((prev) => prev + 1);
//     } catch (err: any) {
//       const message = err?.message || "Failed to infer rules using OpenRouter.";
//       setInferMessage(message);
//       setNetworkBanner({ type: "error", message });
//     } finally {
//       setIsInferring(false);
//     }
//   }, [
//     isInferDisabled,
//     projectId,
//     selectedNetwork,
//     networks,
//     hasManualBiomolecules,
//     manualBiomoleculeEntries,
//     selectedFile,
//     parseNodesList,
//     buildNodesFromNames,
//     buildEdgesFromRules,
//   ]);

//   const handleCreateNetwork = useCallback(async () => {
//     if (!projectId || !selectedNetwork) {
//       setInferMessage("Missing project identifier or no network selected.");
//       return;
//     }

//     const biomolecules = manualBiomoleculeEntries.length ? manualBiomoleculeEntries : [];
//     if (!biomolecules.length) {
//       setInferMessage("Add at least one biomolecule before creating a network.");
//       return;
//     }

//     const nodes = buildNodesFromNames(biomolecules, selectedNetwork);
//     const rules = parseRulesList(manualRules);
//     const edges = rules.length ? buildEdgesFromRules(rules, nodes) : sanitizeEdges(nodes, selectedNetwork);
//     const updatedNetwork = {
//       ...selectedNetwork,
//       nodes,
//       edges,
//       rules,
//     };

//     const updatedNetworks = networks.map(network => 
//       network.id === selectedNetwork.id ? updatedNetwork : network
//     );

//     try {
//       setIsCreatingNetwork(true);
//       setInferMessage(null);
//       const { error: updateError } = await supabase
//         .from("projects")
//         .update({ 
//           network_data: { networks: updatedNetworks }
//         })
//         .eq("id", projectId);

//       if (updateError) throw updateError;

//       setNetworks(updatedNetworks);
//       setNetworkBanner({ type: "success", message: "Network created successfully." });
//       setIsCreateDialogOpen(false);
//       resetCreateNetworkState();
//       setNetworkRefreshToken((prev) => prev + 1);
//     } catch (err: any) {
//       const message = err?.message || "Failed to create network.";
//       setInferMessage(message);
//       setNetworkBanner({ type: "error", message });
//     } finally {
//       setIsCreatingNetwork(false);
//     }
//   }, [
//     projectId,
//     selectedNetwork,
//     networks,
//     manualBiomoleculeEntries,
//     manualRules,
//     parseRulesList,
//     buildNodesFromNames,
//     buildEdgesFromRules,
//     sanitizeEdges,
//     resetCreateNetworkState,
//   ]);

//   const handlePerformAnalysis = useCallback(async () => {
//     if (!selectedNetwork) {
//       setAnalysisError("No network selected for analysis.");
//       setAnalysisResult(null);
//       return;
//     }

//     const rawNodes = Array.isArray(selectedNetwork?.nodes) ? selectedNetwork.nodes : [];

//     if (!rawNodes.length) {
//       setAnalysisError("Add nodes and rules before running analysis.");
//       setAnalysisResult(null);
//       return;
//     }

//     const analysisRules = selectedNetwork.rules || [];
//     if (!analysisRules.length) {
//       setAnalysisError("No rules available to analyze. Infer or add rules first.");
//       setAnalysisResult(null);
//       return;
//     }

//     const nodesForAnalysis = rawNodes.map((node: any, index: number) => {
//       const idSource = node?.id ?? node?.label ?? `node-${index}`;
//       return {
//         id: String(idSource),
//         label: typeof node?.label === "string" ? node.label : String(node?.label ?? idSource),
//       };
//     });

//     try {
//       setIsAnalyzing(true);
//       setAnalysisError(null);
//       const result = performDeterministicAnalysis({
//         nodes: nodesForAnalysis,
//         rules: analysisRules,
//       });
//       setAnalysisResult(result);
//       setNetworkBanner({
//         type: "success",
//         message: `Analysis completed: ${result.attractors.length} attractor${result.attractors.length === 1 ? "" : "s"} detected`,
//       });
//     } catch (err: any) {
//       const message = err?.message || "Failed to run deterministic analysis.";
//       setAnalysisError(message);
//       setAnalysisResult(null);
//       setNetworkBanner({ type: "error", message });
//     } finally {
//       setIsAnalyzing(false);
//     }
//   }, [selectedNetwork]);

//   const handleDownloadAnalysisCsv = useCallback(() => {
//     if (!analysisResult) return;
//     const csv = buildAnalysisCsv(analysisResult);
//     const defaultName = project?.name || projectId || "analysis";
//     const safeName = defaultName.replace(/[^a-z0-9-_]+/gi, "_").replace(/_+/g, "_");
//     const timestamp = new Date().toISOString().replace(/[:T]/g, "-").split(".")[0];
//     const fileName = `${safeName || "analysis"}-${timestamp}.csv`;
//     const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
//     const url = URL.createObjectURL(blob);
//     const link = document.createElement("a");
//     link.href = url;
//     link.setAttribute("download", fileName);
//     document.body.appendChild(link);
//     link.click();
//     document.body.removeChild(link);
//     URL.revokeObjectURL(url);
//   }, [analysisResult, project?.name, projectId]);

//   // Set edit dialog content when opening
//   useEffect(() => {
//     if (!isEditDialogOpen || !selectedNetwork) return;
    
//     const nodesText = Array.isArray(selectedNetwork?.nodes) 
//       ? selectedNetwork.nodes
//           .map((node) => (node?.label || node?.id || "").toString())
//           .filter(Boolean)
//           .join(", ")
//       : "";

//     const rulesText = Array.isArray(selectedNetwork?.rules) 
//       ? selectedNetwork.rules.join("\n")
//       : "";

//     setEditNodesText(nodesText);
//     setEditRulesText(rulesText);
//     setEditError(null);
//     setEditNodesFileName(null);
//     setEditRulesFileName(null);
//   }, [isEditDialogOpen, selectedNetwork]);

//   // Render main content for each tab
//   const renderMainContent = () => {
//     switch (activeTab) {
//       case 'projects':
//         return (
//           <div className="p-6">
//             <h1 className="text-2xl font-bold mb-6">Project Management</h1>
//             <div className="bg-white rounded-2xl border border-gray-200 p-6">
//               <p className="text-gray-600">Project management features coming soon...</p>
//             </div>
//           </div>
//         );
//       case 'network':
//         return (
//           <div className="flex-1 flex flex-col min-h-0">
//             {/* Network Selection Header */}
//             <div className="flex items-center justify-between p-4 border-b">
//               <div className="flex items-center gap-4">
//                 <h2 className="text-lg font-semibold">Networks</h2>
//                 <Button
//                   onClick={() => setIsCreateNetworkDialogOpen(true)}
//                   size="sm"
//                   className="flex items-center gap-2"
//                 >
//                   <Plus size={16} />
//                   New Network
//                 </Button>
//               </div>
              
//               {/* Network Switcher */}
//               {networks.length > 0 && (
//                 <div className="flex items-center gap-2">
//                   <select 
//                     value={selectedNetworkId || ''}
//                     onChange={(e) => handleSwitchNetwork(e.target.value)}
//                     className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
//                   >
//                     {networks.map(network => (
//                       <option key={network.id} value={network.id}>
//                         {network.name}
//                       </option>
//                     ))}
//                   </select>
                  
//                   {networks.length > 1 && (
//                     <Button
//                       variant="outline"
//                       size="sm"
//                       onClick={() => handleDeleteNetwork(selectedNetworkId!)}
//                       className="text-red-600 hover:text-red-700"
//                     >
//                       <Trash2 size={16} />
//                     </Button>
//                   )}
//                 </div>
//               )}
//             </div>

//             {/* Network Banner */}
//             {networkBanner && (
//               <div className={`flex items-center justify-between rounded-2xl border p-4 m-4 backdrop-blur-sm ${
//                 networkBanner.type === "success"
//                   ? "border-green-200 bg-green-50/80 text-green-800"
//                   : "border-red-200 bg-red-50/80 text-red-800"
//               }`}>
//                 <div className="flex items-center gap-3">
//                   <div className={`rounded-full p-2 ${
//                     networkBanner.type === "success" ? "bg-green-100" : "bg-red-100"
//                   }`}>
//                     {networkBanner.type === "success" ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
//                   </div>
//                   <p className="text-sm font-medium">{networkBanner.message}</p>
//                 </div>
//                 <button
//                   type="button"
//                   className="text-sm opacity-70 transition-opacity hover:opacity-100"
//                   onClick={() => setNetworkBanner(null)}
//                 >
//                   <X size={16} />
//                 </button>
//               </div>
//             )}

//             {/* Main Content Area */}
//             <div className="flex-1 flex flex-col min-h-0 p-4">
//               {isLoading ? (
//                 <div className="flex-1 flex items-center justify-center rounded-2xl border border-gray-200 bg-white shadow-inner">
//                   <Loader2 className="animate-spin text-[#2f5597]" size={32} />
//                 </div>
//               ) : !project || error ? (
//                 <div className="flex-1 flex items-center justify-center rounded-2xl border border-red-200 bg-red-50/70 text-red-700">
//                   {error || "Project details unavailable."}
//                 </div>
//               ) : networks.length === 0 ? (
//                 <div className="flex-1 flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-300 bg-white">
//                   <Folder size={48} className="text-gray-400 mb-4" />
//                   <h3 className="text-lg font-semibold text-gray-600 mb-2">No Networks Yet</h3>
//                   <p className="text-gray-500 mb-4">Create your first network to get started</p>
//                   <Button
//                     onClick={() => setIsCreateNetworkDialogOpen(true)}
//                     className="flex items-center gap-2"
//                   >
//                     <Plus size={16} />
//                     Create First Network
//                   </Button>
//                 </div>
//               ) : (
//                 <>
//                   {/* Network Visualization */}
//                   <div className="flex-1 relative rounded-2xl border border-gray-200 bg-white shadow-lg w-full h-full min-h-[500px]">
//                     <NetworkGraph
//                       networkData={selectedNetwork}
//                       height="100%"
//                       refreshToken={networkRefreshToken}
//                     />
//                   </div>
//                 </>
//               )}
//             </div>

//             {/* Analysis Results */}
//             {analysisError && (
//               <div className="rounded-2xl border border-slate-200 bg-white p-5 m-4 shadow-lg">
//                 <div className="text-sm text-red-700">{analysisError}</div>
//               </div>
//             )}
//           </div>
//         );

//       case 'therapeutics':
//         return (
//           <div className="h-full p-6">
//             <div className="flex items-center justify-center h-full text-muted-foreground">
//               <div className="text-center">
//                 <h2 className="text-xl font-semibold mb-2">Therapeutics Workspace</h2>
//                 <p>Coming soon - Drug discovery and therapeutic analysis tools</p>
//               </div>
//             </div>
//           </div>
//         );
//       case 'analysis':
//         return (
//           <div className="h-full p-6">
//             <div className="flex items-center justify-center h-full text-muted-foreground">
//               <div className="text-center">
//                 <h2 className="text-xl font-semibold mb-2">Analysis Workspace</h2>
//                 <p>Coming soon - Advanced network analysis tools</p>
//               </div>
//             </div>
//           </div>
//         );
//       case 'results':
//         return (
//           <div className="h-full p-6">
//             <div className="flex items-center justify-center h-full text-muted-foreground">
//               <div className="text-center">
//                 <h2 className="text-xl font-semibold mb-2">Results Workspace</h2>
//                 <p>Coming soon - Results visualization and export tools</p>
//               </div>
//             </div>
//           </div>
//         );
//       default:
//         return (
//           <div className="h-full p-6">
//             <div className="flex items-center justify-center h-full text-muted-foreground">
//               Workspace not found
//             </div>
//           </div>
//         );
//     }
//   };

//   return (
//     <NetworkEditorLayout activeTab={activeTab} onTabChange={setActiveTab}>
//       {renderMainContent()}
      
//       {/* Create Network Dialog */}
//       <Dialog open={isCreateNetworkDialogOpen} onOpenChange={setIsCreateNetworkDialogOpen}>
//         <DialogContent className="sm:max-w-md">
//           <DialogHeader>
//             <DialogTitle>Create New Network</DialogTitle>
//             <DialogDescription>
//               Create a new network within this project.
//             </DialogDescription>
//           </DialogHeader>
//           <div className="space-y-4">
//             <Label htmlFor="network-name">Network Name</Label>
//             <Input
//               id="network-name"
//               value={newNetworkName}
//               onChange={(e) => setNewNetworkName(e.target.value)}
//               placeholder="Enter network name"
//             />
//           </div>
//           <DialogFooter>
//             <Button variant="outline" onClick={() => setIsCreateNetworkDialogOpen(false)}>
//               Cancel
//             </Button>
//             <Button onClick={handleCreateNewNetwork} disabled={!newNetworkName.trim()}>
//               Create Network
//             </Button>
//           </DialogFooter>
//         </DialogContent>
//       </Dialog>

//       {/* Keep all your existing dialogs (Create Network, Edit Network, etc.) */}
//       {/* They will need similar updates to work with selectedNetwork */}
//       {/* ... */}

//     </NetworkEditorLayout>
//   );
// };

// export default ProjectVisualizationPage;

"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AlertCircle, ArrowLeft, Calendar, CheckCircle2, Download, FilePenLine, Folder, Loader2, RefreshCcw, Users, X, Plus, Trash2, Network, Play, Edit3 } from "lucide-react";
import { Button } from "../../components/ui/button";
import NetworkGraph from "./NetworkGraph";
import { supabase } from "../../supabaseClient";
import { Badge } from "../../components/ui/badge";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../../components/ui/dialog";
import NetworkEditorLayout from "./layout";

type ProjectRecord = {
  id: string;
  name?: string | null;
  assignees?: string[] | null;
  created_at?: string | null;
  creator_email?: string | null;
  network_data?: any;
};

type NetworkType = {
  id: string;
  name: string;
  description?: string;
  created_at: string;
  nodes: any[];
  edges: any[];
  rules: string[];
  is_active?: boolean;
};

const csvEscape = (value: string | number | boolean | null | undefined): string => {
  const stringValue = value === null || value === undefined ? "" : String(value);
  if (stringValue.includes('"') || stringValue.includes(",") || stringValue.includes("\n")) {
    return '"' + stringValue.replace(/"/g, '""') + '"';
  }
  return stringValue;
};

const buildAnalysisCsv = (result: DeterministicAnalysisResult): string => {
  const lines: string[] = [];
  const newline = "\r\n";

  lines.push(["Summary"].map(csvEscape).join(","));
  lines.push(["Nodes", result.nodeOrder.length].map(csvEscape).join(","));
  lines.push(["Explored states", result.exploredStateCount].map(csvEscape).join(","));
  lines.push(["Total state space", result.totalStateSpace].map(csvEscape).join(","));
  lines.push(["Attractors", result.attractors.length].map(csvEscape).join(","));
  lines.push(["Truncated", result.truncated ? "yes" : "no"].map(csvEscape).join(","));

  if (result.warnings.length > 0) {
    lines.push("");
    lines.push(["Warnings"].map(csvEscape).join(","));
    result.warnings.forEach((warning) => {
      lines.push([warning].map(csvEscape).join(","));
    });
  }

  lines.push("");
  const nodeHeaders = result.nodeOrder.map((nodeId) => result.nodeLabels[nodeId] ?? nodeId);
  lines.push([
    "Attractor",
    "Type",
    "Period",
    "State",
    "Binary",
    ...nodeHeaders,
    "Basin size",
    "Basin share",
  ].map(csvEscape).join(","));

  result.attractors.forEach((attractor, attractorIndex) => {
    attractor.states.forEach((state, stateIndex) => {
      const row = [
        `Attractor ${attractorIndex + 1}`,
        attractor.type,
        attractor.period,
        stateIndex + 1,
        state.binary,
        ...result.nodeOrder.map((nodeId) => state.values[nodeId] ?? 0),
        attractor.basinSize,
        attractor.basinShare,
      ];
      lines.push(row.map(csvEscape).join(","));
    });
  });

  return lines.join(newline);
};

// Mock networks for demonstration
const mockNetworks: NetworkType[] = [
  {
    id: "network-1",
    name: "Primary Signaling Network",
    description: "Main cellular signaling pathways",
    created_at: new Date().toISOString(),
    nodes: [
      { id: "egfr", label: "EGFR", type: "receptor" },
      { id: "ras", label: "RAS", type: "protein" },
      { id: "raf", label: "RAF", type: "kinase" },
      { id: "mek", label: "MEK", type: "kinase" },
      { id: "erk", label: "ERK", type: "kinase" }
    ],
    edges: [
      { source: "egfr", target: "ras", interaction: "activates" },
      { source: "ras", target: "raf", interaction: "activates" },
      { source: "raf", target: "mek", interaction: "activates" },
      { source: "mek", target: "erk", interaction: "activates" }
    ],
    rules: [
      "EGFR = growth_factor",
      "RAS = EGFR",
      "RAF = RAS",
      "MEK = RAF",
      "ERK = MEK"
    ]
  },
  {
    id: "network-2",
    name: "Metabolic Pathways",
    description: "Core metabolic regulation",
    created_at: new Date(Date.now() - 86400000).toISOString(),
    nodes: [
      { id: "glucose", label: "Glucose", type: "metabolite" },
      { id: "glycolysis", label: "Glycolysis", type: "pathway" },
      { id: "atp", label: "ATP", type: "metabolite" },
      { id: "mitochondria", label: "Mitochondria", type: "organelle" }
    ],
    edges: [
      { source: "glucose", target: "glycolysis", interaction: "consumes" },
      { source: "glycolysis", target: "atp", interaction: "produces" },
      { source: "glycolysis", target: "mitochondria", interaction: "feeds" }
    ],
    rules: [
      "Glycolysis = Glucose",
      "ATP = Glycolysis",
      "Mitochondria = Glycolysis"
    ]
  },
  {
    id: "network-3",
    name: "Gene Regulatory Network",
    description: "Transcription factor interactions",
    created_at: new Date(Date.now() - 172800000).toISOString(),
    nodes: [
      { id: "tf1", label: "TF1", type: "transcription_factor" },
      { id: "tf2", label: "TF2", type: "transcription_factor" },
      { id: "gene1", label: "Gene1", type: "gene" },
      { id: "gene2", label: "Gene2", type: "gene" }
    ],
    edges: [
      { source: "tf1", target: "gene1", interaction: "activates" },
      { source: "tf2", target: "gene2", interaction: "represses" },
      { source: "tf1", target: "tf2", interaction: "inhibits" }
    ],
    rules: [
      "Gene1 = TF1",
      "Gene2 = !TF2",
      "TF2 = !TF1"
    ]
  }
];

const ProjectVisualizationPage: React.FC = () => {
  const navigate = useNavigate();
  const { projectId } = useParams<{ projectId: string }>();
  const [activeTab, setActiveTab] = useState<'projects' | 'network' | 'therapeutics' | 'analysis' | 'results'>('projects');
  const [project, setProject] = useState<ProjectRecord | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Multi-network state
  const [networks, setNetworks] = useState<NetworkType[]>([]);
  const [selectedNetworkId, setSelectedNetworkId] = useState<string | null>(null);
  const [isCreateNetworkDialogOpen, setIsCreateNetworkDialogOpen] = useState(false);
  const [newNetworkName, setNewNetworkName] = useState("");
  
  // Existing state
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [manualBiomolecules, setManualBiomolecules] = useState<string>("");
  const [manualRules, setManualRules] = useState<string>("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isInferring, setIsInferring] = useState(false);
  const [inferMessage, setInferMessage] = useState<string | null>(null);
  const [isCreatingNetwork, setIsCreatingNetwork] = useState(false);
  const [isEditInferring, setIsEditInferring] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editNodesText, setEditNodesText] = useState<string>("");
  const [editRulesText, setEditRulesText] = useState<string>("");
  const [isSavingNetwork, setIsSavingNetwork] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [networkBanner, setNetworkBanner] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [networkRefreshToken, setNetworkRefreshToken] = useState(0);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<DeterministicAnalysisResult | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  // Get selected network data
  const selectedNetwork = useMemo(() => 
    networks.find(network => network.id === selectedNetworkId),
    [networks, selectedNetworkId]
  );

  // Load project and networks
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
          .select("id, name, assignees, created_at, creator_email, network_data")
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
          
          // Parse networks from network_data or use mock data
          const projectData = data as ProjectRecord;
          let loadedNetworks: NetworkType[] = [];
          
          if (projectData.network_data) {
            if (Array.isArray(projectData.network_data)) {
              loadedNetworks = projectData.network_data;
            } else if (projectData.network_data.networks && Array.isArray(projectData.network_data.networks)) {
              loadedNetworks = projectData.network_data.networks;
            } else if (projectData.network_data.nodes || projectData.network_data.edges) {
              loadedNetworks = [{
                id: 'default',
                name: 'Default Network',
                created_at: new Date().toISOString(),
                nodes: projectData.network_data.nodes || [],
                edges: projectData.network_data.edges || [],
                rules: projectData.network_data.rules || []
              }];
            }
          }
          
          // Use mock networks if no networks exist in database
          if (loadedNetworks.length === 0) {
            loadedNetworks = mockNetworks;
          }
          
          setNetworks(loadedNetworks);
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

  // Set first network as selected when networks load
  useEffect(() => {
    if (networks.length > 0 && !selectedNetworkId) {
      setSelectedNetworkId(networks[0].id);
    }
  }, [networks, selectedNetworkId]);

  const formattedDate = useMemo(() => {
    if (!project?.created_at) return null;
    try {
      return new Date(project.created_at).toLocaleString();
    } catch {
      return project.created_at;
    }
  }, [project?.created_at]);

  const assigneeCount = project?.assignees?.length ?? 0;

  // Network management functions
  const handleCreateNewNetwork = useCallback(async () => {
    if (!projectId || !newNetworkName.trim()) return;

    const newNetwork: NetworkType = {
      id: `network-${Date.now()}`,
      name: newNetworkName.trim(),
      created_at: new Date().toISOString(),
      nodes: [],
      edges: [],
      rules: []
    };

    const updatedNetworks = [...networks, newNetwork];
    setNetworks(updatedNetworks);
    setSelectedNetworkId(newNetwork.id);

    try {
      const { error } = await supabase
        .from("projects")
        .update({ 
          network_data: { networks: updatedNetworks }
        })
        .eq("id", projectId);

      if (error) throw error;

      setNetworkBanner({ type: "success", message: "New network created successfully." });
      setIsCreateNetworkDialogOpen(false);
      setNewNetworkName("");
    } catch (err: any) {
      setNetworkBanner({ type: "error", message: "Failed to create network." });
    }
  }, [projectId, newNetworkName, networks]);

  const handleDeleteNetwork = useCallback(async (networkId: string) => {
    if (!projectId || networks.length <= 1) return;

    const updatedNetworks = networks.filter(network => network.id !== networkId);
    setNetworks(updatedNetworks);
    
    if (selectedNetworkId === networkId) {
      setSelectedNetworkId(updatedNetworks[0]?.id || null);
    }

    try {
      const { error } = await supabase
        .from("projects")
        .update({ 
          network_data: { networks: updatedNetworks }
        })
        .eq("id", projectId);

      if (error) throw error;

      setNetworkBanner({ type: "success", message: "Network deleted successfully." });
    } catch (err: any) {
      setNetworkBanner({ type: "error", message: "Failed to delete network." });
    }
  }, [projectId, networks, selectedNetworkId]);

  const handleSwitchNetwork = useCallback((networkId: string) => {
    setSelectedNetworkId(networkId);
    setNetworkRefreshToken(prev => prev + 1);
    // Switch to network tab when selecting a network
    setActiveTab('network');
  }, []);

  const handleOpenNetwork = useCallback((networkId: string) => {
    setSelectedNetworkId(networkId);
    setActiveTab('network');
  }, []);

  // Render main content for each tab
  const renderMainContent = () => {
    switch (activeTab) {
      case 'projects':
        return (
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h1 className="text-2xl font-bold">Project Networks</h1>
              <Button
                onClick={() => setIsCreateNetworkDialogOpen(true)}
                className="flex items-center gap-2"
              >
                <Plus size={16} />
                New Network
              </Button>
            </div>

            {networks.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-300 bg-white p-12">
                <Network size={64} className="text-gray-400 mb-4" />
                <h3 className="text-lg font-semibold text-gray-600 mb-2">No Networks Yet</h3>
                <p className="text-gray-500 mb-6 text-center">Create your first network to start analyzing biological pathways</p>
                <Button
                  onClick={() => setIsCreateNetworkDialogOpen(true)}
                  className="flex items-center gap-2"
                >
                  <Plus size={16} />
                  Create First Network
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {networks.map((network) => (
                  <div
                    key={network.id}
                    className="bg-white rounded-2xl border border-gray-200 p-6 hover:shadow-lg transition-shadow cursor-pointer"
                    onClick={() => handleOpenNetwork(network.id)}
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-100 rounded-lg">
                          <Network size={20} className="text-blue-600" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-gray-900">{network.name}</h3>
                          {network.description && (
                            <p className="text-sm text-gray-500 mt-1">{network.description}</p>
                          )}
                        </div>
                      </div>
                      <Badge variant="secondary" className="text-xs">
                        {network.nodes.length} nodes
                      </Badge>
                    </div>
                    
                    <div className="space-y-2 mb-4">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">Rules:</span>
                        <span className="font-medium">{network.rules.length}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">Edges:</span>
                        <span className="font-medium">{network.edges.length}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">Created:</span>
                        <span className="font-medium">
                          {new Date(network.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenNetwork(network.id);
                        }}
                        className="flex-1 flex items-center gap-2"
                      >
                        <Play size={16} />
                        Open
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteNetwork(network.id);
                        }}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 size={16} />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );

      case 'network':
        return (
          <div className="flex-1 flex flex-col min-h-0">
            {/* Network Selection Header */}
            {selectedNetwork && (
              <div className="flex items-center justify-between p-4 border-b">
                <div className="flex items-center gap-4">
                  <Button
                    variant="outline"
                    onClick={() => setActiveTab('projects')}
                    className="flex items-center gap-2"
                  >
                    <ArrowLeft size={16} />
                    Back to Networks
                  </Button>
                  <div>
                    <h2 className="text-lg font-semibold">{selectedNetwork.name}</h2>
                    {selectedNetwork.description && (
                      <p className="text-sm text-gray-500">{selectedNetwork.description}</p>
                    )}
                  </div>
                </div>
                
                {/* Network Switcher */}
                {networks.length > 1 && (
                  <div className="flex items-center gap-2">
                    <select 
                      value={selectedNetworkId || ''}
                      onChange={(e) => handleSwitchNetwork(e.target.value)}
                      className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
                    >
                      {networks.map(network => (
                        <option key={network.id} value={network.id}>
                          {network.name}
                        </option>
                      ))}
                    </select>
                    
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDeleteNetwork(selectedNetworkId!)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 size={16} />
                    </Button>
                  </div>
                )}
              </div>
            )}

            {/* Network Banner */}
            {networkBanner && (
              <div className={`flex items-center justify-between rounded-2xl border p-4 m-4 backdrop-blur-sm ${
                networkBanner.type === "success"
                  ? "border-green-200 bg-green-50/80 text-green-800"
                  : "border-red-200 bg-red-50/80 text-red-800"
              }`}>
                <div className="flex items-center gap-3">
                  <div className={`rounded-full p-2 ${
                    networkBanner.type === "success" ? "bg-green-100" : "bg-red-100"
                  }`}>
                    {networkBanner.type === "success" ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                  </div>
                  <p className="text-sm font-medium">{networkBanner.message}</p>
                </div>
                <button
                  type="button"
                  className="text-sm opacity-70 transition-opacity hover:opacity-100"
                  onClick={() => setNetworkBanner(null)}
                >
                  <X size={16} />
                </button>
              </div>
            )}

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col min-h-0 p-4">
              {isLoading ? (
                <div className="flex-1 flex items-center justify-center rounded-2xl border border-gray-200 bg-white shadow-inner">
                  <Loader2 className="animate-spin text-[#2f5597]" size={32} />
                </div>
              ) : !project || error ? (
                <div className="flex-1 flex items-center justify-center rounded-2xl border border-red-200 bg-red-50/70 text-red-700">
                  {error || "Project details unavailable."}
                </div>
              ) : !selectedNetwork ? (
                <div className="flex-1 flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-300 bg-white">
                  <Network size={48} className="text-gray-400 mb-4" />
                  <h3 className="text-lg font-semibold text-gray-600 mb-2">No Network Selected</h3>
                  <p className="text-gray-500 mb-4">Please select a network to view</p>
                  <Button
                    onClick={() => setActiveTab('projects')}
                    className="flex items-center gap-2"
                  >
                    <ArrowLeft size={16} />
                    Choose Network
                  </Button>
                </div>
              ) : (
                <>
                  {/* Network Visualization */}
                  <div className="flex-1 relative rounded-2xl border border-gray-200 bg-white shadow-lg w-full h-full min-h-[500px]">
                    <NetworkGraph
                      networkData={selectedNetwork}
                      height="100%"
                      refreshToken={networkRefreshToken}
                    />
                  </div>
                </>
              )}
            </div>

            {/* Analysis Results */}
            {analysisError && (
              <div className="rounded-2xl border border-slate-200 bg-white p-5 m-4 shadow-lg">
                <div className="text-sm text-red-700">{analysisError}</div>
              </div>
            )}
          </div>
        );

      case 'therapeutics':
        return (
          <div className="h-full p-6">
            <div className="flex items-center justify-center h-full text-muted-foreground">
              <div className="text-center">
                <h2 className="text-xl font-semibold mb-2">Therapeutics Workspace</h2>
                <p>Coming soon - Drug discovery and therapeutic analysis tools</p>
              </div>
            </div>
          </div>
        );
      case 'analysis':
        return (
          <div className="h-full p-6">
            <div className="flex items-center justify-center h-full text-muted-foreground">
              <div className="text-center">
                <h2 className="text-xl font-semibold mb-2">Analysis Workspace</h2>
                <p>Coming soon - Advanced network analysis tools</p>
              </div>
            </div>
          </div>
        );
      case 'results':
        return (
          <div className="h-full p-6">
            <div className="flex items-center justify-center h-full text-muted-foreground">
              <div className="text-center">
                <h2 className="text-xl font-semibold mb-2">Results Workspace</h2>
                <p>Coming soon - Results visualization and export tools</p>
              </div>
            </div>
          </div>
        );
      default:
        return (
          <div className="h-full p-6">
            <div className="flex items-center justify-center h-full text-muted-foreground">
              Workspace not found
            </div>
          </div>
        );
    }
  };

  return (
    <NetworkEditorLayout activeTab={activeTab} onTabChange={setActiveTab}>
      {renderMainContent()}
      
      {/* Create Network Dialog */}
      <Dialog open={isCreateNetworkDialogOpen} onOpenChange={setIsCreateNetworkDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create New Network</DialogTitle>
            <DialogDescription>
              Create a new network within this project.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Label htmlFor="network-name">Network Name</Label>
            <Input
              id="network-name"
              value={newNetworkName}
              onChange={(e) => setNewNetworkName(e.target.value)}
              placeholder="Enter network name"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateNetworkDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateNewNetwork} disabled={!newNetworkName.trim()}>
              Create Network
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </NetworkEditorLayout>
  );
};

export default ProjectVisualizationPage;