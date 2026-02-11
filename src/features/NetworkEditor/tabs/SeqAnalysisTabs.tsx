"use client";

import { useState } from "react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { Dna } from "lucide-react";
import SeqAnalysisTab from "./SeqAnalysisTab";
import ExomeSeqTab from "./ExomeSeqTab";
import type { ProjectNetworkRecord } from '@/hooks/useProjectNetworks';
import type { NetworkNode } from "@/types/network";

interface SeqAnalysisTabsProps {
  networkNodes?: NetworkNode[];
  networks?: ProjectNetworkRecord[];
  onNetworkSelect?: (id: string) => void;
  selectedNetworkId?: string | null;
  projectId?: string | null;
  networkId?: string | null;
  networkName?: string | null;
}

export function SeqAnalysisTabs(props: SeqAnalysisTabsProps) {
  const [subTab, setSubTab] = useState<'rna' | 'exome'>('rna');

  return (
    <div className="h-full flex flex-col">
      {/* Local sub-tabs header */}
      <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="px-3 flex items-center">
          <div className="p-2 rounded-lg bg-sky-500/10 mr-2">
            <Dna className="w-5 h-5 text-sky-600" />
          </div>
          <Tabs value={subTab} onValueChange={(value) => setSubTab(value as 'rna' | 'exome')} className="w-full">
            <TabsList className="w-full justify-start bg-transparent p-0 gap-0 border-b h-auto">
              <TabsTrigger
                value="rna"
                className={cn(
                  "px-3 py-2 h-10 relative group text-xs",
                  "data-[state=active]:text-foreground data-[state=active]:font-semibold",
                  "data-[state=active]:border-b-2 data-[state=active]:border-b-primary",
                  "transition-all duration-200 hover:text-foreground/80",
                  "rounded-none border-b-2 border-b-transparent",
                  "flex items-center gap-2",
                )}
              >
                RNA-seq
              </TabsTrigger>
              <TabsTrigger
                value="exome"
                className={cn(
                  "px-3 py-2 h-10 relative group text-xs",
                  "data-[state=active]:text-foreground data-[state=active]:font-semibold",
                  "data-[state=active]:border-b-2 data-[state=active]:border-b-primary",
                  "transition-all duration-200 hover:text-foreground/80",
                  "rounded-none border-b-2 border-b-transparent",
                  "flex items-center gap-2",
                )}
              >
                Exome-seq
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      {/* Content panels */}
      <div className="flex-1 min-h-0">
        {subTab === 'rna' ? (
          <SeqAnalysisTab {...props} />
        ) : (
          <ExomeSeqTab {...props} />
        )}
      </div>
    </div>
  );
}

export default SeqAnalysisTabs;
