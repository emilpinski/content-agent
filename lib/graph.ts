import { StateGraph, END } from "@langchain/langgraph";
import { ContentState } from "./state";
import { makeResearcherNode } from "./agents/researcher";
import { makeWriterNode } from "./agents/writer";
import { makeSeoCheckerNode } from "./agents/seoChecker";
import { makeImagePromptNode } from "./agents/imagePrompt";

export interface GraphKeys {
  anthropicKey: string;
  openrouterKey: string;
  searchProvider: string;
  searchKey: string;
}

export function buildGraph(keys: GraphKeys) {
  const graph = new StateGraph(ContentState)
    .addNode("researcher", makeResearcherNode(keys))
    .addNode("writer", makeWriterNode(keys))
    .addNode("seo_checker", makeSeoCheckerNode(keys))
    .addNode("image_prompt", makeImagePromptNode(keys))
    .addEdge("__start__", "researcher")
    .addEdge("researcher", "writer")
    .addEdge("writer", "seo_checker")
    .addEdge("seo_checker", "image_prompt")
    .addEdge("image_prompt", END);

  return graph.compile();
}
