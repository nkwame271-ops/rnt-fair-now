import { Helmet } from "react-helmet-async";

interface SeoProps {
  title: string;
  description: string;
  canonicalPath: string;
  ogType?: "website" | "article";
}

const SITE_URL = "https://www.rentcontrolghana.com";

/**
 * Per-route SEO head. Sets title (<60 chars recommended),
 * meta description (50–160 chars), canonical, and og:* tags.
 */
const Seo = ({ title, description, canonicalPath, ogType = "website" }: SeoProps) => {
  const url = `${SITE_URL}${canonicalPath}`;
  return (
    <Helmet>
      <title>{title}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={url} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={url} />
      <meta property="og:type" content={ogType} />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
    </Helmet>
  );
};

export default Seo;
