export type DocumentBuilderId = "csep" | "site_builder";

export type DocumentBuilderSectionReference = {
  builderId: DocumentBuilderId;
  key: string;
};

export type DocumentBuilderSectionTemplate = {
  key: string;
  label: string;
  title: string;
  paragraphs: string[];
  bullets: string[];
  children: DocumentBuilderSectionTemplate[];
  references?: DocumentBuilderSectionReference[];
};

export type DocumentBuilderTemplateGroup = {
  sections: DocumentBuilderSectionTemplate[];
};

export type DocumentBuilderTextConfig = {
  builders: Record<DocumentBuilderId, DocumentBuilderTemplateGroup>;
};
