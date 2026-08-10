import type { ModuleElementJson } from "./moduleExtraction";

export type HeaderConfig = {
  enabled: boolean;
  brandName: string;
  tagline?: string;
  showSubjectClass?: boolean;
};

export type FooterConfig = {
  enabled: boolean;
  leftText?: string;
  centerText?: string;
  rightText?: string;
  showPageNumber?: boolean;
};

export type WatermarkConfig = {
  enabled: boolean;
  text: string;
  opacity?: number; // 0-1, default 0.12
  rotation?: number; // degrees, default -30
};

const MARGIN = 24; // points, matches the page margin the header/footer sit in

export function buildBrandingElements(params: {
  headerConfig: HeaderConfig;
  footerConfig: FooterConfig;
  watermarkConfig: WatermarkConfig;
  pageWidth: number;
  pageHeight: number;
  pageNumber: number;
  moduleSubject?: string | null;
  moduleClass?: string | null;
}): ModuleElementJson[] {
  const { headerConfig, footerConfig, watermarkConfig, pageWidth, pageHeight, pageNumber, moduleSubject, moduleClass } = params;
  const elements: ModuleElementJson[] = [];

  if (headerConfig?.enabled) {
    const right = headerConfig.showSubjectClass
      ? [moduleSubject, moduleClass ? `Class ${moduleClass}` : null].filter(Boolean).join(" | ")
      : "";
    const content = [headerConfig.brandName, headerConfig.tagline].filter(Boolean).join("   •   ") +
      (right ? `                    ${right}` : "");

    elements.push({
      id: "branding_header",
      type: "HEADER",
      x: MARGIN,
      y: 10,
      width: pageWidth - MARGIN * 2,
      height: 24,
      content,
      fontSize: 11,
      locked: true,
      confidence: "HIGH",
    });
  }

  if (footerConfig?.enabled) {
    const parts = [footerConfig.leftText, footerConfig.centerText, footerConfig.rightText].filter(Boolean);
    const pageNumText = footerConfig.showPageNumber ? `Page ${pageNumber}` : "";
    const content = [parts.join("   •   "), pageNumText].filter(Boolean).join("        ");

    elements.push({
      id: "branding_footer",
      type: "FOOTER",
      x: MARGIN,
      y: pageHeight - 30,
      width: pageWidth - MARGIN * 2,
      height: 20,
      content,
      fontSize: 9,
      locked: true,
      confidence: "HIGH",
    });
  }

  if (watermarkConfig?.enabled && watermarkConfig.text) {
    elements.push({
      id: "branding_watermark",
      type: "WATERMARK",
      x: pageWidth / 2 - 150,
      y: pageHeight / 2 - 30,
      width: 300,
      height: 60,
      content: watermarkConfig.text,
      fontSize: 32,
      rotation: watermarkConfig.rotation ?? -30,
      opacity: watermarkConfig.opacity ?? 0.12,
      locked: true,
      confidence: "HIGH",
    });
  }

  return elements;
}

// Reapplying branding must not duplicate or orphan old branding elements —
// strip anything previously stamped by this system before adding the new set.
export function stripBrandingElements(elements: ModuleElementJson[]): ModuleElementJson[] {
  return elements.filter((el) => el.type !== "HEADER" && el.type !== "FOOTER" && el.type !== "WATERMARK");
}
