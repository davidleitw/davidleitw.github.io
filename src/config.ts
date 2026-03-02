export const SITE = {
  website: "https://davidleitw.github.io/",
  author: "davidlei",
  profile: "https://github.com/davidleitw",
  desc: "一個紀錄心情，技術，人生的網站",
  title: "davidLei",
  ogImage: "devosfera-og.webp",
  lightAndDarkMode: true,
  postPerIndex: 6,
  postPerPage: 8,
  scheduledPostMargin: 15 * 60 * 1000, // 15 minutes
  showArchives: true,
  showGalleries: false,
  showBackButton: true, // show back button in post detail
  editPost: {
    enabled: true,
    text: "Edit this post",
    url: "https://github.com/davidleitw/davidleitw.github.io/edit/master/",
  },
  dynamicOgImage: true,
  dir: "ltr", // "rtl" | "auto"
  lang: "en", // html lang code. Set this empty and default will be "en"
  timezone: "Asia/Taipei", // Default global timezone (IANA format) https://en.wikipedia.org/wiki/List_of_tz_database_time_zones
  introAudio: {
    enabled: false,
    src: "",
    label: "",
    duration: 0,
  },
} as const;
