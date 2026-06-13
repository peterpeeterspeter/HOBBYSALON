import { LANDING_IMAGES } from "@/components/ui/ai-generated-image";
import type { HeroSlide } from "@/components/home/hero-slider";
import type {
  Product,
  Workshop,
  Creator,
  Event,
  Article,
  Project,
} from "@/types/platform";

type ProductWithPrice = Product & {
  price?: { amount: number; currency_code: string } | null;
};

type HomeData = {
  featuredHandmade: ProductWithPrice[];
  featuredSupplies: ProductWithPrice[];
  upcomingWorkshops: Workshop[];
  upcomingEvents: Event[];
  latestArticles: Article[];
  creatorsOfTheMonth: Creator[];
  featuredProjects: Project[];
};

export function buildHeroSlides(data: HomeData): HeroSlide[] {
  const slides: HeroSlide[] = [];

  // 1. Featured product (handmade or supply)
  const featuredProduct = data.featuredHandmade[0] ?? data.featuredSupplies[0];
  if (featuredProduct) {
    slides.push({
      id: `product-${featuredProduct.id}`,
      type: "product",
      title: featuredProduct.title,
      description: featuredProduct.short_description,
      imageUrl:
        featuredProduct.featured_image_url ?? LANDING_IMAGES.placeholderProduct,
      href: `/product/${featuredProduct.slug}`,
      label: "Handgemaakt",
    });
  }

  // 2. Workshop
  const workshop = data.upcomingWorkshops[0];
  if (workshop) {
    slides.push({
      id: `workshop-${workshop.id}`,
      type: "workshop",
      title: workshop.title,
      description: workshop.short_description,
      imageUrl: workshop.featured_image_url ?? LANDING_IMAGES.placeholderWorkshop,
      href: `/workshop/${workshop.slug}`,
      label: "Workshop",
    });
  }

  // 3. Creator
  const creator = data.creatorsOfTheMonth[0];
  if (creator) {
    slides.push({
      id: `creator-${creator.id}`,
      type: "creator",
      title: creator.display_name,
      description: creator.business_name ?? creator.bio,
      imageUrl:
        creator.banner_url ?? creator.avatar_url ?? LANDING_IMAGES.placeholderCreator,
      href: `/creator/${creator.slug}`,
      label: "Maker",
    });
  }

  // 4. Event
  const event = data.upcomingEvents[0];
  if (event) {
    slides.push({
      id: `event-${event.id}`,
      type: "event",
      title: event.title,
      description: event.short_description,
      imageUrl: event.featured_image_url ?? LANDING_IMAGES.placeholderEvent,
      href: `/agenda/${event.slug}`,
      label: "Evenement",
    });
  }

  // 5. Article
  const article = data.latestArticles[0];
  if (article) {
    slides.push({
      id: `article-${article.id}`,
      type: "article",
      title: article.title,
      description: article.excerpt,
      imageUrl: article.featured_image_url ?? LANDING_IMAGES.placeholderArticle,
      href: `/artikel/${article.slug}`,
      label: "Patroon",
    });
  }

  // 6. Project
  const project = data.featuredProjects[0];
  if (project) {
    slides.push({
      id: `project-${project.id}`,
      type: "project",
      title: project.title,
      description: project.short_description,
      imageUrl: project.featured_image_url ?? LANDING_IMAGES.placeholderProject,
      href: `/project/${project.slug}`,
      label: "Aan de slag",
    });
  }

  // Fallback: welcome slide when no content
  if (slides.length === 0) {
    slides.push({
      id: "welcome",
      type: "project",
      title: "Welkom bij Hobbysalon",
      description: "Sinds de jaren '90 dé plek voor creatieve hobbyisten. Ontdek gratis patronen, workshops en een community van 50.000+ makers.",
      imageUrl: LANDING_IMAGES.hero,
      href: "/workshops",
      label: "Ontdek",
    });
  }

  return slides;
}
