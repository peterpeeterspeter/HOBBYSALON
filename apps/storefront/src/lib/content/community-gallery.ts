export type CommunityGalleryImageRow = {
  projectId: string;
  projectTitle: string;
  projectSlug: string;
  imageId: string;
  imageUrl: string;
  altText: string | null;
};

export type CommunityGalleryProject = {
  projectId: string;
  projectTitle: string;
  projectSlug: string;
  images: Array<{ id: string; url: string; altText: string | null }>;
};

export function groupCommunityGalleryImages(
  rows: CommunityGalleryImageRow[]
): CommunityGalleryProject[] {
  const projects = new Map<string, CommunityGalleryProject>();
  for (const row of rows) {
    const project = projects.get(row.projectId) ?? {
      projectId: row.projectId,
      projectTitle: row.projectTitle,
      projectSlug: row.projectSlug,
      images: [],
    };
    if (!project.images.some((image) => image.id === row.imageId)) {
      project.images.push({ id: row.imageId, url: row.imageUrl, altText: row.altText });
    }
    projects.set(row.projectId, project);
  }
  return [...projects.values()];
}
