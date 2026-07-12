import assert from "node:assert/strict";
import test from "node:test";
// @ts-expect-error Node's TypeScript test runner requires the extension.
import { groupCommunityGalleryImages } from "./community-gallery.ts";

test("groups approved community photos by project without duplicate images", () => {
  assert.deepEqual(
    groupCommunityGalleryImages([
      { projectId: "project-1", projectTitle: "Mijn sjaal", projectSlug: "mijn-sjaal", imageId: "image-1", imageUrl: "one.jpg", altText: null },
      { projectId: "project-1", projectTitle: "Mijn sjaal", projectSlug: "mijn-sjaal", imageId: "image-1", imageUrl: "one.jpg", altText: null },
      { projectId: "project-1", projectTitle: "Mijn sjaal", projectSlug: "mijn-sjaal", imageId: "image-2", imageUrl: "two.jpg", altText: "Details" },
    ]),
    [{ projectId: "project-1", projectTitle: "Mijn sjaal", projectSlug: "mijn-sjaal", images: [{ id: "image-1", url: "one.jpg", altText: null }, { id: "image-2", url: "two.jpg", altText: "Details" }] }]
  );
});
