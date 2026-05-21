import copy
import os
import re
import zipfile
import xml.etree.ElementTree as ET


BASE = r"C:\Users\johnh\OneDrive\Desktop\safety_docs_360\output\Sales_Deck_Safety360Doc_TJ_Contracting_with_focus_tabs.pptx"
OUT = r"C:\Users\johnh\OneDrive\Desktop\safety_docs_360\output\Sales_Deck_Safety360Doc_TJ_Contracting_with_focus_tabs_weather_final.pptx"
WEATHER_IMG = r"C:\Users\johnh\OneDrive\Desktop\safety_docs_360\scratch\ppt_refresh\assets\jobsite_weather_overview.png"

P_NS = "http://schemas.openxmlformats.org/presentationml/2006/main"
R_NS = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
REL_NS = "http://schemas.openxmlformats.org/package/2006/relationships"

ET.register_namespace("p", P_NS)
ET.register_namespace("r", R_NS)
ET.register_namespace("", REL_NS)


def qn(ns, tag):
    return f"{{{ns}}}{tag}"


def rel_num(rel_id):
    m = re.fullmatch(r"rId(\d+)", rel_id)
    return int(m.group(1)) if m else 0


def main():
    new_slide_num = 20
    new_media_name = "jobsite_weather_overview.png"
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    if os.path.exists(OUT):
        os.remove(OUT)

    with zipfile.ZipFile(BASE, "r") as zin, zipfile.ZipFile(OUT, "w", zipfile.ZIP_DEFLATED) as zout:
        pres = ET.fromstring(zin.read("ppt/presentation.xml"))
        pres_rels = ET.fromstring(zin.read("ppt/_rels/presentation.xml.rels"))
        content_types_xml = zin.read("[Content_Types].xml").decode("utf-8")

        sld_list = pres.find(qn(P_NS, "sldIdLst"))
        slide_ids = list(sld_list)
        max_slide_id = max(int(s.attrib["id"]) for s in slide_ids)
        max_rel_id = max(rel_num(r.attrib["Id"]) for r in pres_rels)
        new_pres_rid = f"rId{max_rel_id + 1}"

        new_sld = ET.Element(qn(P_NS, "sldId"), {
            "id": str(max_slide_id + 1),
            qn(R_NS, "id"): new_pres_rid,
        })
        # Insert after slide 5, keeping slides 1-4 protected and the thank-you slide last.
        sld_list.insert(5, new_sld)

        ET.SubElement(pres_rels, qn(REL_NS, "Relationship"), {
            "Id": new_pres_rid,
            "Type": "http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide",
            "Target": f"slides/slide{new_slide_num}.xml",
        })

        override = (
            f'<Override PartName="/ppt/slides/slide{new_slide_num}.xml" '
            'ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>'
        )
        content_types_xml = content_types_xml.replace("</Types>", f"{override}</Types>")

        skip = {
            "ppt/presentation.xml",
            "ppt/_rels/presentation.xml.rels",
            "[Content_Types].xml",
        }

        for item in zin.infolist():
            if item.filename in skip:
                continue
            info = copy.copy(item)
            info.compress_type = zipfile.ZIP_DEFLATED
            zout.writestr(info, zin.read(item.filename))

        slide_xml = zin.read("ppt/slides/slide5.xml")
        rels_xml = ET.fromstring(zin.read("ppt/slides/_rels/slide5.xml.rels"))
        for rel in rels_xml:
            if rel.attrib.get("Type", "").endswith("/image"):
                rel.attrib["Target"] = f"../media/{new_media_name}"
                break

        zout.writestr("ppt/slides/slide20.xml", slide_xml)
        zout.writestr(
            "ppt/slides/_rels/slide20.xml.rels",
            ET.tostring(rels_xml, encoding="utf-8", xml_declaration=True),
        )
        zout.writestr(f"ppt/media/{new_media_name}", open(WEATHER_IMG, "rb").read())
        zout.writestr("ppt/presentation.xml", ET.tostring(pres, encoding="utf-8", xml_declaration=True))
        zout.writestr("ppt/_rels/presentation.xml.rels", ET.tostring(pres_rels, encoding="utf-8", xml_declaration=True))
        zout.writestr("[Content_Types].xml", content_types_xml)

    print(OUT)


if __name__ == "__main__":
    main()
