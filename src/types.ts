export type ProjectStatus = "active" | "done";

export type Project = {
  id: string;
  name: string;
  status: ProjectStatus;
  createdAt: string;
  completedAt: string | null;
};

export type Entry = {
  projectId: string;
  note: string;
};

export type DailyReport = {
  oneLiner: string;
  entries: Entry[];
};

export type DataFile = {
  projects: Project[];
  reports: Record<string, DailyReport>;
};

export const emptyData: DataFile = {
  projects: [],
  reports: {},
};
