// Render a react-icons component to an SVG markup string usable inside leaflet
// divIcon HTML. Keeps map markers visual and scannable at a glance.
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { IconType } from "react-icons";

export const iconSvg = (Icon: IconType, color: string, size = 16): string =>
  renderToStaticMarkup(
    createElement(Icon, {
      color,
      size,
      style: { display: "block" },
    }),
  );
