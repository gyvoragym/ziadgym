export const seo = (title: string, description: string) => ({
  meta: [
    { title: `${title} — GYVORA Gym OS` },
    { name: "description", content: description.replace(/ironhaus/gi, 'GYVORA') },
    { property: "og:title", content: `${title} — GYVORA Gym OS` },
    { property: "og:description", content: description.replace(/ironhaus/gi, 'GYVORA') },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ],
});
