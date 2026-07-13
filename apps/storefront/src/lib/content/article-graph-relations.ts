export const ARTICLE_GRAPH_RELATION_TYPES = [
  "required_material",
  "required_tool",
  "optional_material",
  "related_product",
  "next_step",
  "related_article",
] as const;

export type ArticleGraphRelationType = (typeof ARTICLE_GRAPH_RELATION_TYPES)[number];

export type ArticleGraphConnection = {
  entityType: string;
  entityId: string;
  direction: "outbound" | "inbound";
  relationType: string;
  weight: number | null;
  sortOrder: number | null;
};

export type OrderedArticleGraphItem = {
  id: string;
  weight: number | null;
  sortOrder: number | null;
};

export type ArticleGraphRelations = {
  requiredMaterials: OrderedArticleGraphItem[];
  requiredTools: OrderedArticleGraphItem[];
  optionalMaterials: OrderedArticleGraphItem[];
  relatedProducts: OrderedArticleGraphItem[];
  nextSteps: OrderedArticleGraphItem[];
  relatedArticles: OrderedArticleGraphItem[];
};

const emptyRelations = (): ArticleGraphRelations => ({
  requiredMaterials: [],
  requiredTools: [],
  optionalMaterials: [],
  relatedProducts: [],
  nextSteps: [],
  relatedArticles: [],
});

function orderAndDeduplicate(items: OrderedArticleGraphItem[]): OrderedArticleGraphItem[] {
  const byId = new Map<string, OrderedArticleGraphItem>();
  for (const item of items) {
    const current = byId.get(item.id);
    if (!current || (item.weight ?? 0) > (current.weight ?? 0)) {
      byId.set(item.id, item);
    }
  }

  return [...byId.values()].sort((first, second) => {
    const firstOrder = first.sortOrder ?? Number.MAX_SAFE_INTEGER;
    const secondOrder = second.sortOrder ?? Number.MAX_SAFE_INTEGER;
    return firstOrder - secondOrder || (second.weight ?? 0) - (first.weight ?? 0);
  });
}

export function normalizeArticleGraphRelations(
  connections: ArticleGraphConnection[]
): ArticleGraphRelations {
  const relations = emptyRelations();

  for (const connection of connections) {
    if (connection.direction !== "outbound") continue;

    const item = {
      id: connection.entityId,
      sortOrder: connection.sortOrder,
      weight: connection.weight,
    };

    if (connection.entityType === "product") {
      if (connection.relationType === "required_material") {
        relations.requiredMaterials.push(item);
      } else if (connection.relationType === "required_tool") {
        relations.requiredTools.push(item);
      } else if (connection.relationType === "optional_material") {
        relations.optionalMaterials.push(item);
      } else if (connection.relationType === "related_product") {
        relations.relatedProducts.push(item);
      }
    } else if (connection.entityType === "article") {
      if (connection.relationType === "next_step") {
        relations.nextSteps.push(item);
      } else if (connection.relationType === "related_article") {
        relations.relatedArticles.push(item);
      }
    }
  }

  return {
    requiredMaterials: orderAndDeduplicate(relations.requiredMaterials),
    requiredTools: orderAndDeduplicate(relations.requiredTools),
    optionalMaterials: orderAndDeduplicate(relations.optionalMaterials),
    relatedProducts: orderAndDeduplicate(relations.relatedProducts),
    nextSteps: orderAndDeduplicate(relations.nextSteps),
    relatedArticles: orderAndDeduplicate(relations.relatedArticles),
  };
}
