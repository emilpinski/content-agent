import { Annotation } from "@langchain/langgraph";

export const ContentState = Annotation.Root({
  topic: Annotation<string>(),
  seoPhrase: Annotation<string>(),
  researchNotes: Annotation<string>({ default: () => "", reducer: (_, b) => b }),
  articleMd: Annotation<string>({ default: () => "", reducer: (_, b) => b }),
  seoReportMd: Annotation<string>({ default: () => "", reducer: (_, b) => b }),
  imagePrompt: Annotation<string>({ default: () => "", reducer: (_, b) => b }),
  dryRun: Annotation<boolean>({ default: () => false, reducer: (_, b) => b }),
});

export type ContentStateType = typeof ContentState.State;
