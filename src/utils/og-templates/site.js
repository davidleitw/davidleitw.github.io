import satori from "satori";
import { SITE } from "@/config";
import loadGoogleFonts from "../loadGoogleFont";
import { MASCOT_AVATAR } from "./mascot-data.js";

export default async () => {
  const hostname = new URL(SITE.website).hostname;

  return satori(
    {
      type: "div",
      props: {
        style: {
          height: "100%",
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          backgroundColor: "#f6f5f4", // warm paper canvas
          color: "#191918",
          padding: "72px 80px",
          position: "relative",
        },
        children: [
          // Left: text column
          {
            type: "div",
            props: {
              style: {
                display: "flex",
                flexDirection: "column",
                maxWidth: "62%",
              },
              children: [
                {
                  type: "div",
                  props: {
                    style: {
                      display: "flex",
                      alignItems: "center",
                      fontSize: 26,
                      fontWeight: 600,
                      color: "#0075de",
                      marginBottom: "28px",
                    },
                    children: `<davidlei />`,
                  },
                },
                {
                  type: "h1",
                  props: {
                    style: {
                      fontSize: 84,
                      fontWeight: 700,
                      letterSpacing: "-3px",
                      margin: 0,
                      lineHeight: 1.05,
                    },
                    children: SITE.title,
                  },
                },
                {
                  type: "p",
                  props: {
                    style: {
                      fontSize: 34,
                      color: "#615d59",
                      marginTop: "24px",
                      lineHeight: 1.4,
                      fontWeight: 400,
                    },
                    children: SITE.desc,
                  },
                },
                {
                  type: "div",
                  props: {
                    style: {
                      display: "flex",
                      alignItems: "center",
                      marginTop: "40px",
                      padding: "10px 24px",
                      borderRadius: "9999px",
                      backgroundColor: "#ffffff",
                      border: "1px solid #e6e6e6",
                      fontSize: 22,
                      color: "#615d59",
                      fontWeight: 600,
                    },
                    children: hostname,
                  },
                },
              ],
            },
          },
          // Right: mascot on a soft halo
          {
            type: "div",
            props: {
              style: {
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: "360px",
                height: "360px",
                borderRadius: "9999px",
                backgroundColor: "#faf3d8",
              },
              children: {
                type: "img",
                props: {
                  src: MASCOT_AVATAR,
                  width: 320,
                  height: 320,
                  style: { objectFit: "contain" },
                },
              },
            },
          },
        ],
      },
    },
    {
      width: 1200,
      height: 630,
      embedFont: true,
      fonts: await loadGoogleFonts(SITE.title + SITE.desc + hostname + "<davidlei />"),
    }
  );
};
