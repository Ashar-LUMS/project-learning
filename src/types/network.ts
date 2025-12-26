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

export interface TherapeuticIntervention {
  id: string;
  type: 'knock-in' | 'knock-out';
  nodeName: string;
  nodeRule: string | null;
  fixedValue: 0 | 1 | null;
  outwardRegulations: Array<{
    targetNode: string;
    operator: '&&' | '||';
    addition: string;
    originalRule?: string;
  }>;
  timestamp: number;
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
