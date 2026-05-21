import copy
import html
import os
import re
import shutil
import zipfile
import xml.etree.ElementTree as ET


SRC = r"C:\Users\johnh\Downloads\Sales_Deck_Safety360Doc_TJ_Contracting_sales_refresh_updated.pptx"
OUT = r"C:\Users\johnh\OneDrive\Desktop\safety_docs_360\output\Sales_Deck_Safety360Doc_TJ_Contracting_focus_tabs.pptx"

P_NS = "http://schemas.openxmlformats.org/presentationml/2006/main"
A_NS = "http://schemas.openxmlformats.org/drawingml/2006/main"
R_NS = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"

ET.register_namespace("p", P_NS)
ET.register_namespace("a", A_NS)
ET.register_namespace("r", R_NS)

NS = {"p": P_NS, "a": A_NS, "r": R_NS}

SLIDE_W = 12_192_000
SLIDE_H = 6_858_000
RAIL_W = 1_150_000
CONTENT_W = SLIDE_W - RAIL_W
CONTENT_H = round(CONTENT_W * 9 / 16)
CONTENT_Y = round((SLIDE_H - CONTENT_H) / 2)

TOPICS = [
    ("01", "Product\noverview", "2D74DA"),
    ("02", "Documents /\nBuilder", "1FA97A"),
    ("03", "SOR / Field\nobservations", "F28C00"),
    ("04", "Compliance /\nAudits", "7252CB"),
    ("05", "Compliance /\nMatrix", "2D74DA"),
    ("06", "Predictive\nmodel", "1FA97A"),
    ("07", "Business impact\n& tiers", "F28C00"),
    ("08", "Pilot\npath", "7252CB"),
]

ACTIVE_BY_SLIDE = {
    5: 0,
    6: None,
    7: 0,
    8: 0,
    9: 3,
    10: 2,
    11: 2,
    12: 4,
    13: 4,
    14: 5,
    15: 1,
    16: 5,
    17: 6,
    18: 7,
}


def qn(ns, tag):
    return f"{{{ns}}}{tag}"


def emu(x):
    return str(int(round(x)))


def next_shape_id(root):
    max_id = 1
    for node in root.findall(".//p:cNvPr", NS):
        val = node.attrib.get("id")
        if val and val.isdigit():
            max_id = max(max_id, int(val))
    return max_id + 1


def tx_body(lines, font_size_pt, color, bold=False):
    body = ET.Element(qn(P_NS, "txBody"))
    ET.SubElement(body, qn(A_NS, "bodyPr"), {
        "anchor": "mid",
        "wrap": "square",
        "lIns": "20000",
        "rIns": "20000",
        "tIns": "10000",
        "bIns": "10000",
    })
    ET.SubElement(body, qn(A_NS, "lstStyle"))
    para = ET.SubElement(body, qn(A_NS, "p"))
    ET.SubElement(para, qn(A_NS, "pPr"), {"algn": "ctr"})
    for idx, line in enumerate(lines):
        if idx:
            ET.SubElement(para, qn(A_NS, "br"))
        run = ET.SubElement(para, qn(A_NS, "r"))
        rpr = ET.SubElement(run, qn(A_NS, "rPr"), {
            "lang": "en-US",
            "sz": str(int(font_size_pt * 100)),
            "b": "1" if bold else "0",
        })
        solid = ET.SubElement(rpr, qn(A_NS, "solidFill"))
        ET.SubElement(solid, qn(A_NS, "srgbClr"), {"val": color})
        ET.SubElement(run, qn(A_NS, "t")).text = line
    return body


def shape_xml(shape_id, name, x, y, w, h, fill, text_lines=None, font_size=7.0,
              text_color="FFFFFF", bold=False, line_color=None, radius=True):
    sp = ET.Element(qn(P_NS, "sp"))
    nv = ET.SubElement(sp, qn(P_NS, "nvSpPr"))
    ET.SubElement(nv, qn(P_NS, "cNvPr"), {"id": str(shape_id), "name": name})
    ET.SubElement(nv, qn(P_NS, "cNvSpPr"))
    ET.SubElement(nv, qn(P_NS, "nvPr"))

    sppr = ET.SubElement(sp, qn(P_NS, "spPr"))
    xfrm = ET.SubElement(sppr, qn(A_NS, "xfrm"))
    ET.SubElement(xfrm, qn(A_NS, "off"), {"x": emu(x), "y": emu(y)})
    ET.SubElement(xfrm, qn(A_NS, "ext"), {"cx": emu(w), "cy": emu(h)})
    ET.SubElement(sppr, qn(A_NS, "prstGeom"), {"prst": "roundRect" if radius else "rect"}).append(
        ET.Element(qn(A_NS, "avLst"))
    )
    solid = ET.SubElement(sppr, qn(A_NS, "solidFill"))
    ET.SubElement(solid, qn(A_NS, "srgbClr"), {"val": fill})
    if line_color:
        ln = ET.SubElement(sppr, qn(A_NS, "ln"), {"w": "9525"})
        ln_fill = ET.SubElement(ln, qn(A_NS, "solidFill"))
        ET.SubElement(ln_fill, qn(A_NS, "srgbClr"), {"val": line_color})
    else:
        ET.SubElement(sppr, qn(A_NS, "ln")).append(ET.Element(qn(A_NS, "noFill")))

    if text_lines is not None:
        sp.append(tx_body(text_lines, font_size, text_color, bold))
    return sp


def scale_slide_picture(root):
    pic = root.find(".//p:pic", NS)
    if pic is None:
        return
    xfrm = pic.find(".//a:xfrm", NS)
    if xfrm is None:
        return
    off = xfrm.find("a:off", NS)
    ext = xfrm.find("a:ext", NS)
    if off is None or ext is None:
        return
    off.attrib["x"] = emu(RAIL_W)
    off.attrib["y"] = emu(CONTENT_Y)
    ext.attrib["cx"] = emu(CONTENT_W)
    ext.attrib["cy"] = emu(CONTENT_H)


def add_focus_rail(root, slide_num):
    sp_tree = root.find(".//p:cSld/p:spTree", NS)
    if sp_tree is None:
        return

    sid = next_shape_id(root)
    active = ACTIVE_BY_SLIDE.get(slide_num)

    # Background rail and left accent.
    sp_tree.append(shape_xml(sid, "Focus rail background", 0, 0, RAIL_W, SLIDE_H, "F4FAFA", radius=False)); sid += 1
    sp_tree.append(shape_xml(sid, "Focus rail accent", 0, 0, 82_000, SLIDE_H, "008C95", radius=False)); sid += 1
    sp_tree.append(shape_xml(sid, "Focus rail divider", RAIL_W - 14_000, 0, 14_000, SLIDE_H, "D7EDEE", radius=False)); sid += 1

    sp_tree.append(shape_xml(
        sid, "Focus rail label", 128_000, 122_000, 900_000, 245_000, "F4FAFA",
        ["FOCUS", "TABS"], font_size=8.5, text_color="008C95", bold=True, radius=False
    )); sid += 1

    y = 520_000
    tab_h = 690_000
    gap = 48_000
    for idx, (num, label, color) in enumerate(TOPICS):
        is_active = active == idx
        fill = color if is_active else "FFFFFF"
        line = color if is_active else "D7E4E8"
        txt = "FFFFFF" if is_active else "243444"
        font = 7.7 if is_active else 6.4
        sp_tree.append(shape_xml(
            sid,
            f"Focus tab {num}",
            128_000,
            y,
            900_000 if is_active else 840_000,
            tab_h,
            fill,
            [num, *label.split("\n")],
            font_size=font,
            text_color=txt,
            bold=is_active,
            line_color=line,
            radius=True,
        ))
        sid += 1
        if is_active:
            sp_tree.append(shape_xml(
                sid,
                f"Focus tab {num} active marker",
                82_000,
                y + 74_000,
                38_000,
                tab_h - 148_000,
                color,
                radius=False,
            ))
            sid += 1
        y += tab_h + gap


def transform_slide_xml(xml_bytes, slide_num):
    root = ET.fromstring(xml_bytes)
    scale_slide_picture(root)
    add_focus_rail(root, slide_num)
    return ET.tostring(root, encoding="utf-8", xml_declaration=True)


def slide_number_from_name(name):
    m = re.fullmatch(r"ppt/slides/slide(\d+)\.xml", name)
    return int(m.group(1)) if m else None


def main():
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    tmp = OUT + ".tmp"
    with zipfile.ZipFile(SRC, "r") as zin, zipfile.ZipFile(tmp, "w", zipfile.ZIP_DEFLATED) as zout:
        for item in zin.infolist():
            data = zin.read(item.filename)
            slide_num = slide_number_from_name(item.filename)
            if slide_num in range(5, 19):
                data = transform_slide_xml(data, slide_num)
            info = copy.copy(item)
            info.compress_type = zipfile.ZIP_DEFLATED
            zout.writestr(info, data)
    shutil.move(tmp, OUT)
    print(OUT)


if __name__ == "__main__":
    main()
