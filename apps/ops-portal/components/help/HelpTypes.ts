export interface HelpFieldDefinition {
  title?: string;
  summary: string;
}

export interface HelpTopicMetadata {
  id: string;
  title: string;
  category?: string;
  description?: string;
  order?: number;
  routes?: string[];
  resource?: string;
  action?: string;
  tags?: string[];
  fields?: Record<string, HelpFieldDefinition | string>;
  related?: string[];
}

export interface HelpTopic extends HelpTopicMetadata {
  content: string;
  filePath?: string;
}

export interface HelpContextResponse {
  topic: HelpTopic | null;
  matchedRoute?: string;
  relatedTopics: Array<{ id: string; title: string; category?: string }>;
}

export interface HelpTopicSummary {
  id: string;
  title: string;
  category: string;
  description?: string;
  order: number;
  routes: string[];
  tags: string[];
}

export interface HelpSearchResult {
  id: string;
  title: string;
  category: string;
  snippet: string;
  score: number;
}
