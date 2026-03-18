export type PshsepFormData = {
  project_name?: string;
  title?: string;
  service_type?: string;
  customer_notes?: string;
};

export function compilePshsepDocument(formData: PshsepFormData) {
  return {
    cover: {
      title: "Project Safety & Health Execution Plan",
      project_name: formData.project_name ?? formData.title ?? "Untitled Project",
    },
    request_information: {
      request_title: formData.title ?? "",
      service_type: formData.service_type ?? "",
      customer_notes: formData.customer_notes ?? "",
    },
    sections: [
      {
        title: "Project Overview",
        content:
          formData.customer_notes ??
          "Project-specific details will be inserted here during completion and review.",
      },
      {
        title: "Standard Safety Requirements",
        content:
          "This document includes standard safety requirements, project controls, and administrative expectations.",
      },
    ],
  };
}