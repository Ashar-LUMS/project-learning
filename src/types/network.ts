export interface NetworkNode {
  id: string;
  label?: string;
  type?: string;
  weight?: number;
  properties?: Record<string, any>;
}

export interface NetworkEdge {
  source: string;
  target: string;
  interaction?: string;
  weight?: number;
  properties?: Record<string, any>;
}

export interface Rule {
  name: string;
  enabled?: boolean;
  priority?: number;
  target?: 'nodes' | 'edges' | 'both';
  condition?: string;
  action?: string;
}

export interface CellFate {
  name: string;
  color: string;
  markers?: string[];
  confidence?: number;
  description?: string;
}

export interface NetworkData {
  nodes: NetworkNode[];
  edges: NetworkEdge[];
  rules?: Rule[];
  metadata?: {
    cellFates?: Record<string, CellFate>;
    [key: string]: any;
  };
}
