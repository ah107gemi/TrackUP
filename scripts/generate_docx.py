import os
import re
import html
import zipfile
from xml.sax.saxutils import escape

def markdown_to_docx(md_path, docx_path):
    with open(md_path, 'r', encoding='utf-8') as f:
        lines = f.readlines()

    body_elements = []

    def make_p(text, style="Normal", bold=False, italic=False, color=None, size=None, is_bullet=False, code=False):
        p_pr = ""
        r_pr = ""

        if is_bullet:
            p_pr += '<w:pPr><w:pStyle w:val="ListParagraph"/><w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr></w:pPr>'
        elif style.startswith("Heading"):
            p_pr += f'<w:pPr><w:pStyle w:val="{style}"/><w:spacing w:before="240" w:after="120"/></w:pPr>'
        elif code:
            p_pr += '<w:pPr><w:shd w:val="clear" w:color="auto" w:fill="F1F5F9"/><w:spacing w:before="60" w:after="60"/></w:pPr>'
        else:
            p_pr += '<w:pPr><w:spacing w:after="120" w:line="276" w:lineRule="auto"/></w:pPr>'

        r_pr_parts = []
        if bold or style.startswith("Heading") or style == "Title":
            r_pr_parts.append('<w:b/>')
        if italic:
            r_pr_parts.append('<w:i/>')
        if color:
            r_pr_parts.append(f'<w:color w:val="{color}"/>')
        if size:
            r_pr_parts.append(f'<w:sz w:val="{size}"/>')
        if code:
            r_pr_parts.append('<w:rFonts w:ascii="Consolas" w:hAnsi="Consolas"/>')
            r_pr_parts.append('<w:sz w:val="19"/>')
            r_pr_parts.append('<w:color w:val="0F172A"/>')
        else:
            r_pr_parts.append('<w:rFonts w:ascii="Segoe UI" w:hAnsi="Segoe UI"/>')

        if r_pr_parts:
            r_pr = f'<w:rPr>{"".join(r_pr_parts)}</w:rPr>'

        escaped_text = escape(text)
        return f'<w:p>{p_pr}<w:r>{r_pr}<w:t xml:space="preserve">{escaped_text}</w:t></w:r></w:p>'

    def make_table(rows):
        tbl_pr = '''<w:tblPr>
            <w:tblW w:w="0" w:type="auto"/>
            <w:tblBorders>
                <w:top w:val="single" w:sz="4" w:space="0" w:color="CBD5E1"/>
                <w:left w:val="none"/>
                <w:bottom w:val="single" w:sz="4" w:space="0" w:color="CBD5E1"/>
                <w:right w:val="none"/>
                <w:insideH w:val="single" w:sz="4" w:space="0" w:color="E2E8F0"/>
                <w:insideV w:val="none"/>
            </w:tblBorders>
        </w:tblPr>'''

        tbl_xml = [f'<w:tbl>{tbl_pr}']
        for r_idx, row in enumerate(rows):
            tbl_xml.append('<w:tr>')
            is_header = (r_idx == 0)
            for c_idx, cell in enumerate(row):
                cell_fill = '1F1F29' if is_header else ('F8FAFC' if r_idx % 2 == 1 else 'FFFFFF')
                cell_color = 'FFC400' if is_header else '1E293B'
                bold_attr = '<w:b/>' if is_header else ''
                escaped = escape(cell.strip())
                tc = f'''<w:tc>
                    <w:tcPr>
                        <w:shd w:val="clear" w:color="auto" w:fill="{cell_fill}"/>
                        <w:tcMar><w:top w:w="120" w:type="dxa"/><w:bottom w:w="120" w:type="dxa"/><w:left w:w="160" w:type="dxa"/><w:right w:w="160" w:type="dxa"/></w:tcMar>
                    </w:tcPr>
                    <w:p>
                        <w:pPr><w:spacing w:after="0"/></w:pPr>
                        <w:r>
                            <w:rPr><w:rFonts w:ascii="Segoe UI" w:hAnsi="Segoe UI"/>{bold_attr}<w:color w:val="{cell_color}"/><w:sz w:val="19"/></w:rPr>
                            <w:t xml:space="preserve">{escaped}</w:t>
                        </w:r>
                    </w:p>
                </w:tc>'''
                tbl_xml.append(tc)
            tbl_xml.append('</w:tr>')
        tbl_xml.append('</w:tbl>')
        return "".join(tbl_xml)

    in_code_block = False
    code_lines = []
    in_table = False
    table_rows = []

    for line in lines:
        stripped = line.rstrip('\r\n')

        # Code block handling
        if stripped.startswith('```'):
            if in_code_block:
                # Close code block
                full_code = "\n".join(code_lines)
                for cl in code_lines:
                    body_elements.append(make_p(cl if cl else " ", code=True))
                code_lines = []
                in_code_block = False
            else:
                in_code_block = True
                code_lines = []
            continue

        if in_code_block:
            code_lines.append(stripped)
            continue

        # Table handling
        if stripped.startswith('|') and stripped.endswith('|'):
            cells = [c for c in stripped.split('|')[1:-1]]
            # Check if this is the separator row like | :--- | :--- |
            if all(re.match(r'^[\s\-:]+$', c) for c in cells):
                continue
            table_rows.append(cells)
            in_table = True
            continue
        else:
            if in_table:
                body_elements.append(make_table(table_rows))
                table_rows = []
                in_table = False

        if not stripped:
            continue

        # Header 1
        if stripped.startswith('# '):
            text = stripped[2:].strip()
            body_elements.append(make_p(text, style="Heading1", color="D97706", size="36"))
        # Header 2
        elif stripped.startswith('## '):
            text = stripped[3:].strip()
            body_elements.append(make_p(text, style="Heading2", color="1E293B", size="28"))
        # Header 3
        elif stripped.startswith('### '):
            text = stripped[4:].strip()
            body_elements.append(make_p(text, style="Heading3", color="334155", size="24"))
        # Bullet list
        elif stripped.startswith('- ') or stripped.startswith('* '):
            text = stripped[2:].strip()
            # Clean bold markers for simplicity in bullet
            text = re.sub(r'\*\*(.*?)\*\*', r'\1', text)
            text = re.sub(r'`(.*?)`', r'\1', text)
            body_elements.append(make_p(f"•  {text}", is_bullet=True))
        # Numbered list
        elif re.match(r'^\d+\.\s', stripped):
            match = re.match(r'^(\d+\.\s)(.*)', stripped)
            num_prefix = match.group(1)
            text = match.group(2)
            text = re.sub(r'\*\*(.*?)\*\*', r'\1', text)
            text = re.sub(r'`(.*?)`', r'\1', text)
            body_elements.append(make_p(f"{num_prefix} {text}"))
        else:
            # Clean markdown bold/code markers
            text = re.sub(r'\*\*(.*?)\*\*', r'\1', stripped)
            text = re.sub(r'`(.*?)`', r'\1', text)
            text = re.sub(r'\[(.*?)\]\(.*?\)', r'\1', text)
            body_elements.append(make_p(text))

    if in_table and table_rows:
        body_elements.append(make_table(table_rows))

    content_types_xml = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
    <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
    <Default Extension="xml" ContentType="application/xml"/>
    <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
    <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
</Types>'''

    rels_xml = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
    <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>'''

    doc_rels_xml = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
    <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>'''

    styles_xml = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
    <w:docDefaults>
        <w:rPrDefault>
            <w:rPr>
                <w:rFonts w:ascii="Segoe UI" w:hAnsi="Segoe UI" w:eastAsia="Segoe UI" w:cs="Segoe UI"/>
                <w:sz w:val="21"/>
                <w:color w:val="16161D"/>
            </w:rPr>
        </w:rPrDefault>
    </w:docDefaults>
    <w:style w:type="paragraph" w:default="1" w:styleId="Normal">
        <w:name w:val="Normal"/>
    </w:style>
    <w:style w:type="paragraph" w:styleId="Heading1">
        <w:name w:val="heading 1"/>
        <w:basedOn w:val="Normal"/>
        <w:rPr><w:b/><w:sz w:val="36"/><w:color w:val="D97706"/></w:rPr>
    </w:style>
    <w:style w:type="paragraph" w:styleId="Heading2">
        <w:name w:val="heading 2"/>
        <w:basedOn w:val="Normal"/>
        <w:rPr><w:b/><w:sz w:val="28"/><w:color w:val="1E293B"/></w:rPr>
    </w:style>
    <w:style w:type="paragraph" w:styleId="Heading3">
        <w:name w:val="heading 3"/>
        <w:basedOn w:val="Normal"/>
        <w:rPr><w:b/><w:sz w:val="24"/><w:color w:val="334155"/></w:rPr>
    </w:style>
</w:styles>'''

    body_content = "".join(body_elements)
    document_xml = f'''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
    <w:body>
        {body_content}
        <w:sectPr>
            <w:pgSz w:w="12240" w:h="15840"/>
            <w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="720" w:footer="720" w:gutter="0"/>
        </w:sectPr>
    </w:body>
</w:document>'''

    with zipfile.ZipFile(docx_path, 'w', zipfile.ZIP_DEFLATED) as z:
        z.writestr('[Content_Types].xml', content_types_xml)
        z.writestr('_rels/.rels', rels_xml)
        z.writestr('word/_rels/document.xml.rels', doc_rels_xml)
        z.writestr('word/styles.xml', styles_xml)
        z.writestr('word/document.xml', document_xml)

    print(f"Successfully generated DOCX: {docx_path}")

if __name__ == '__main__':
    md_file = os.path.abspath(r'D:\Antigravity.google\TrackUP\docs\PROJECT_HANDOFF.md')
    docx_file = os.path.abspath(r'D:\Antigravity.google\TrackUP\docs\PROJECT_HANDOFF.docx')
    markdown_to_docx(md_file, docx_file)
