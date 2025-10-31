import { useEffect, useState } from 'react';
import NetworkEditorLayout from './layout';
import ProjectTabComponent from './tabs/ProjectTab';
import NetworkGraph from './NetworkGraph';
import { supabase } from '../../supabaseClient';

type Network = {
  id: string;
  name: string;
  data: any;
};

export default function NetworkEditorPage() {
  const [activeTab, setActiveTab] = useState<'projects' | 'network' | 'therapeutics' | 'analysis' | 'results'>('projects');
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [networks, setNetworks] = useState<Network[]>([]);
  const [selectedNetworkId, setSelectedNetworkId] = useState<string | null>(null);

  useEffect(() => {
    if (selectedProjectId) {
      const fetchNetworks = async () => {
        const { data, error } = await supabase
          .from('networks')
          .select('*')
          .eq('project_id', selectedProjectId);
        
        if (data && !error) {
          setNetworks(data);
          if (data.length > 0) {
            setSelectedNetworkId(data[0].id);
          }
        }
      };
      
      fetchNetworks();
    } else {
      setNetworks([]);
      setSelectedNetworkId(null);
    }
  }, [selectedProjectId]);

  const renderMainContent = () => {
    switch (activeTab) {
      case 'projects':
        return (
          <div className="h-full">
            <ProjectTabComponent onProjectSelect={setSelectedProjectId} />
          </div>
        );
        
      case 'network':
        return (
          <div className="h-full p-6">
            {selectedProjectId ? (
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
                      projectId={selectedProjectId} 
                      networkId={selectedNetworkId} 
                    />
                  </div>
                ) : (
                  <div className="flex items-center justify-center flex-1 text-muted-foreground">
                    Please select a network to view
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                Please select a project from the Projects tab to view networks
              </div>
            )}
          </div>
        );

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
        return (
          <div className="h-full">
            <ProjectTabComponent onProjectSelect={setSelectedProjectId} />
          </div>
        );
    }
  };

  return (
    <NetworkEditorLayout activeTab={activeTab} onTabChange={setActiveTab}>
      {renderMainContent()}
    </NetworkEditorLayout>
  );
}