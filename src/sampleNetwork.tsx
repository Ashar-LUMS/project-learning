// src/sampleNetwork.jsx
const sampleNetwork = {
  nodes: [
    { id: "geneA", type: "gene", label: "Gene A" },
    { id: "proteinB", type: "protein", label: "Protein B" },
    { id: "pathwayC", type: "pathway", label: "Pathway C" }
  ],
  edges: [
    { source: "geneA", target: "proteinB", interaction: "upregulates" },
    { source: "proteinB", target: "pathwayC", interaction: "activates" }
  ],
  metadata: {
    dataset: "Sample Study 2025",
    version: "1.0",
    description: "A small sample network showing interactions between a gene, protein, and pathway."
  }
};

export default sampleNetwork;