import ForceGraph2D from "react-force-graph-2d";
import { useEffect, useState } from "react";
import { supabase } from "../../supabaseClient"

interface Node {
  id: string;
  type: string;
  label: string;
}

interface Edge {
  source: string;
  target: string;
  interaction: string;
}

interface NetworkData {
  nodes: Node[];
  edges: Edge[];
  metadata: {
    dataset: string;
    version: string;
    description: string;
  };
}

export function useNetworkData(projectId?: string) {
  const [network, setNetwork] = useState<NetworkData | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        let data: any = null;
        let error: any = null;
        if (projectId) {
          const res = await supabase.from("projects").select("network_data").eq("id", projectId).single();
          data = res.data; error = res.error;
        } else {
          const res = await supabase.from("projects").select("network_data").single();
          data = res.data; error = res.error;
        }

        if (error) {
          console.error(error);
          setNetwork(null);
        } else {
          const payload = data?.network_data ?? (data || null);
          setNetwork(payload);
        }
      } catch (err) {
        console.error(err);
        setNetwork(null);
      }
    }
    fetchData();
  }, [projectId]);

  return network;
}

export default function NetworkGraph({ projectId }: { projectId?: string }) {
  const network = useNetworkData(projectId);

  if (!network) return <p>Loading network...</p>;

  const graphData = {
    nodes: (network.nodes || []).map(n => ({
      id: n.id,
      name: n.label,
      type: n.type,
    })),
    links: (network.edges || []).map(e => ({
      source: e.source,
      target: e.target,
      interaction: e.interaction,
    })),
  };

  return (
    <div style={{ width: "100%", height: "600px" }}>
      <ForceGraph2D
        graphData={graphData}
        nodeLabel={(node: any) => `${node.name} (${node.type})`}
        linkLabel={(link: any) => link.interaction}
        nodeAutoColorBy="type"
      />
    </div>
  );
}
