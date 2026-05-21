import { HeadingLevel, Packer, Paragraph } from "docx";
import { describe, expect, it } from "vitest";
import { createSafetyPlanDocument } from "@/lib/safetyPlanDocxTheme";

// @ts-expect-error mammoth's internal unzip helper is untyped
import { openZip } from "mammoth/lib/unzip";

describe("createSafetyPlanDocument", () => {
  it("writes explicit document defaults and stable heading/list styles", async () => {
    const doc = createSafetyPlanDocument([
      new Paragraph({ text: "Heading", heading: HeadingLevel.HEADING_1 }),
      new Paragraph({ text: "Bullet item", bullet: { level: 0 } }),
      new Paragraph("Body copy"),
    ]);
    const buffer = await Packer.toBuffer(doc);
    const zip = await openZip({ buffer });
    const stylesXml = await zip.read("word/styles.xml", "utf-8");

    expect(stylesXml).toContain("<w:docDefaults>");
    expect(stylesXml).toContain('w:rFonts w:ascii="Aptos"');
    expect(stylesXml).toContain('<w:style w:type="paragraph" w:styleId="Heading1">');
    expect(stylesXml).toContain('<w:style w:type="paragraph" w:styleId="Heading2">');
    expect(stylesXml).toContain('<w:style w:type="paragraph" w:styleId="ListParagraph">');
    expect(stylesXml).toContain('w:basedOn w:val="Normal"');
    expect(stylesXml).toContain('w:line="276"');
  });
});
