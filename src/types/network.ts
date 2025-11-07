export interface NetworkNode {
  id: string;
  label?: string;
  type?: string;
}

export interface NetworkEdge {
  source: string;
  target: string;
  interaction?: string;
}

export interface NetworkData {
  nodes: NetworkNode[];
  edges: NetworkEdge[];
  rules?: string[] | null;
  metadata?: Record<string, any>;
}
