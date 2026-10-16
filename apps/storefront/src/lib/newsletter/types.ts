export type NewsletterIssueListItem = {
  id: string;
  slug: string;
  title: string;
  subject: string;
  theme: string;
  published_at: string;
  excerpt: string | null;
};

export type NewsletterIssue = NewsletterIssueListItem & {
  html: string;
  created_at: string;
};
