import { StateGraph, END } from "@langchain/langgraph";
import { ContentState } from "./state";
import { researcherNode } from "./agents/researcher";
import { writerNode } from "./agents/writer";
import { seoCheckerNode } from "./agents/seoChecker";
import { imagePromptNode } from "./agents/imagePrompt";

export function buildGraph() {
  const graph = new StateGraph(ContentState)
    .addNode("researcher", researcherNode)
    .addNode("writer", writerNode)
    .addNode("seo_checker", seoCheckerNode)
    .addNode("image_prompt", imagePromptNode)
    .addEdge("__start__", "researcher")
    .addEdge("researcher", "writer")
    .addEdge("writer", "seo_checker")
    .addEdge("seo_checker", "image_prompt")
    .addEdge("image_prompt", END);

  return graph.compile();
}
