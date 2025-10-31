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
};

type Network = {
  id: string;
  name: string;
  description?: string;
  created_at: string;
  data: any;
};

export default function ProjectVisualizationPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const [activeTab, setActiveTab] = useState<'projects' | 'network' | 'therapeutics' | 'analysis' | 'results'>('network');
  const [networks, setNetworks] = useState<Network[]>([]);
  const [selectedNetworkId, setSelectedNetworkId] = useState<string | null>(null);
  const [project, setProject] = useState<ProjectRecord | null>(null);

  useEffect(() => {
    if (projectId) {
      const fetchProject = async () => {
        const { data, error } = await supabase
          .from('projects')
          .select('*')
          .eq('id', projectId)
          .single();

        if (data && !error) {
          setProject(data);
        }
      };

      const fetchNetworks = async () => {
        const { data, error } = await supabase
          .from('networks')
          .select('*')
          .eq('project_id', projectId);
        
        if (data && !error) {
          setNetworks(data);
          if (data.length > 0) {
            setSelectedNetworkId(data[0].id);
          }
        }
      };

      fetchProject();
      fetchNetworks();
    }
  }, [projectId]);

  const renderMainContent = () => {
    switch (activeTab) {
      case 'network':
        return (
          <div className="h-full p-6">
            <div className="flex flex-col h-full">
              <div className="mb-4">
                <select 
                  className="w-64 p-2 border rounded-md bg-background"
                  value={selectedNetworkId || ''}
                  onChange={(e) => setSelectedNetworkId(e.target.value)}
                >
                  <option value="">Select a network</option>
                  {networks.map(network => (
                    <option key={network.id} value={network.id}>
                      {network.name}
                    </option>
                  ))}
                </select>
              </div>
              {selectedNetworkId ? (
                <div className="flex-1">
                  <NetworkGraph 
                    projectId={projectId} 
                    networkId={selectedNetworkId} 
                  />
                </div>
              ) : (
                <div className="flex items-center justify-center flex-1 text-muted-foreground">
                  Please select a network to view
                </div>
              )}
            </div>
          </div>
        );

      case 'projects':
      case 'therapeutics':
      case 'analysis':
      case 'results':
        return (
          <div className="h-full p-6">
            <div className="flex items-center justify-center h-full text-muted-foreground">
              {activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} workspace - Coming soon
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  if (!projectId || !project) {
    return (
      <div className="h-full flex items-center justify-center">
        <p className="text-muted-foreground">Loading project...</p>
      </div>
    );
  }

  return (
    <NetworkEditorLayout activeTab={activeTab} onTabChange={setActiveTab}>
      {renderMainContent()}
    </NetworkEditorLayout>
  );
}