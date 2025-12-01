declare module 'cytoscape-edgehandles' {
  import cytoscape from 'cytoscape';

  // Define the extension function
  function edgehandles(cytoscape: cytoscape): void;

  export = edgehandles;
}

// Extend cytoscape type definitions
declare global {
  namespace cytoscape {
    interface Core {
      edgehandles: (options?: any) => any;
    }
  }
}