from pathlib import Path
from io import BytesIO
from fontTools.ttLib import TTFont as SourceFont
from fontTools.fontBuilder import FontBuilder
from fontTools.pens.ttGlyphPen import TTGlyphPen
from fontTools.pens.cu2quPen import Cu2QuPen
from reportlab.pdfgen import canvas
from reportlab.lib.colors import HexColor
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import Paragraph
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'public/cv/mubarak-marafa-cv.pdf'
FONTS = Path('/Users/moby/Library/Fonts')
for name, filename in [('Body', 'Geist-Regular.ttf'), ('Medium', 'Geist-Medium.ttf'), ('Bold', 'Geist-Bold.ttf')]:
    pdfmetrics.registerFont(TTFont(name, str(FONTS / filename)))
pdfmetrics.registerFontFamily('Body', normal='Body', bold='Bold', italic='Body', boldItalic='Bold')

# Convert the site's CFF outlines to embeddable TrueType, keeping text searchable.
source = SourceFont(ROOT / 'public/fonts/MontreuxJazz-Black.otf')
glyph_set = source.getGlyphSet()
order = source.getGlyphOrder()
builder = FontBuilder(source['head'].unitsPerEm, isTTF=True)
builder.setupGlyphOrder(order)
builder.setupCharacterMap(source.getBestCmap())
glyphs = {}
for name in order:
    pen = TTGlyphPen(glyph_set)
    glyph_set[name].draw(Cu2QuPen(pen, max_err=1, reverse_direction=True))
    glyphs[name] = pen.glyph()
builder.setupGlyf(glyphs)
builder.setupHorizontalMetrics(source['hmtx'].metrics)
builder.setupHorizontalHeader(ascent=source['hhea'].ascent, descent=source['hhea'].descent)
builder.setupNameTable({'familyName': 'Montreux Jazz', 'styleName': 'Black', 'uniqueFontIdentifier': 'MontreuxJazzBlackCV', 'fullName': 'Montreux Jazz Black', 'psName': 'MontreuxJazz-Black-CV'})
builder.setupOS2(sTypoAscender=source['OS/2'].sTypoAscender, sTypoDescender=source['OS/2'].sTypoDescender, usWinAscent=source['OS/2'].usWinAscent, usWinDescent=source['OS/2'].usWinDescent)
builder.setupPost()
font_buffer = BytesIO()
builder.save(font_buffer)
font_buffer.seek(0)
pdfmetrics.registerFont(TTFont('Montreux', font_buffer))

W, H = 595.276, 841.89
LEFT, RIGHT = 43, 552.276
WIDTH = RIGHT - LEFT
INK, MUTED, ACCENT, RULE = [HexColor(x) for x in ['#1b211f', '#58605b', '#f6c400', '#d9ded8']]
c = canvas.Canvas(str(OUT), pagesize=(W, H), pageCompression=1)
c.setTitle('Mubarak (Moby) Marafa | Staff Design Engineer')
c.setAuthor('Mubarak (Moby) Marafa')
c.setSubject('Product design, AI experiences and interaction craft')
style = ParagraphStyle('body', fontName='Body', fontSize=10.2, leading=14, textColor=INK)
y = 40

def text(s, size=10.2, leading=14, font='Body', color=INK, gap=6, indent=0):
    global y
    st = ParagraphStyle('p', parent=style, fontName=font, fontSize=size, leading=leading, textColor=color)
    p = Paragraph(s, st)
    _, h = p.wrap(WIDTH - indent, H)
    assert y + h < 800, f'Page overflow: {y+h}: {s[:60]}'
    p.drawOn(c, LEFT + indent, H - y - h)
    y += h + gap

def bullet(s):
    c.setFillColor(ACCENT)
    c.circle(LEFT + 3, H - y - 6, 1.5, fill=1, stroke=0)
    text(s, indent=13, gap=5)

def section(label):
    global y
    y += 6
    c.setStrokeColor(RULE)
    c.setLineWidth(.6)
    c.line(LEFT, H-y, RIGHT, H-y)
    y += 10
    text(label, size=9, leading=11, font='Bold', color=MUTED, gap=9)

def role(title, dates):
    c.setFillColor(MUTED)
    c.setFont('Body', 9)
    c.drawRightString(RIGHT, H-y-10, dates)
    text(title, size=11.8, leading=14, font='Bold', gap=4)

def link(url, label):
    return f'<a href="{url}" color="#374d45"><u>{label}</u></a>'

name = 'mubarak (moby) marafa'
name_size = 29
text(name, size=name_size, leading=35, font='Montreux', gap=5)
c.setFillColor(ACCENT)
c.circle(LEFT + pdfmetrics.stringWidth(name, 'Montreux', name_size) + 9, H-65, 4.5, fill=1, stroke=0)
text('Staff Design Engineer', size=13, leading=17, font='Medium', gap=7)
text('London, UK  ·  '+link('mailto:mubarakmarafa@gmail.com', 'mubarakmarafa@gmail.com')+'  ·  '+link('https://www.linkedin.com/in/mubarakmarafa/', 'LinkedIn'), size=9, leading=12, color=MUTED, gap=12)
text('Designer, tinkerer, curious by default. I turn early ideas into useful products, with a focus on AI, interaction craft and working prototypes. I care about giving people control over the tools they use.', size=10.7, leading=14.5, gap=3)
section('experience')
role('Good Systems', 'Aug 2026 - present')
text('Staff Design Engineer', size=9.5, leading=12, color=MUTED, gap=6)
bullet('Lead product and interaction design for an AI-native productivity product. Build working prototypes to explore how people and agents collaborate on a canvas.')
y += 5
role('Goodnotes', 'Aug 2021 - Aug 2026')
text('Product Designer → Senior Product Designer → Staff Product Designer (2025)', size=9.2, leading=12, color=MUTED, gap=7)
bullet('<b>Classroom, from zero to launch.</b> Founding designer of Goodnotes Classroom, now Goodnotes Education. Led design from teacher research through the August 2024 launch, connecting lesson setup, handwritten-answer review and grading.')
bullet('<b>AI with teachers in control.</b> Designed answer clustering and refined Generate Hints through research and prompt testing. Worked with Stanford professors on responsible AI in the classroom.')
bullet('<b>Interaction craft.</b> Created the original Apple Pencil Pro Palette design and partnered with design and engineering on contextual controls, motion and implementation.')
bullet('<b>Helping designers build.</b> Led AI adoption across the design function from 2025 through practical sessions and reusable prototypes. Hired and mentored two designers.')
bullet('<b>Four first-place Hackweek teams.</b> Contributions included handwriting reflow and Sync &amp; Swim, whose work grew into production integrations developed further by the team.')
y += 5
role('PALO IT · Senior Consultant', '2019 - 2021')
text('Partnered with founders on product strategy and prototypes. Designed a prototype and pitch deck supporting a US$2.5m fundraise within two months.', gap=8)
role('Entrepreneur First · Founder in Residence', '2018')
text('Took Allorux, a qualitative-research tool, from idea and validation to beta.', gap=8)
role('Oyalabs · UX/UI Designer', '2017 - 2018')
text('Founding designer for Oto, a childhood-development platform. Best of BabyTech, CES 2018.', gap=2)
section('speaking & writing')
text('<b>Figma Config 2026</b> · '+link('https://www.youtube.com/watch?v=fLF8dwbC74o', 'Human methods, new material: AI for the classroom')+'<br/>'+link('https://mdesign.substack.com/p/agentic-product-design-is-world-building', 'Agentic Product Design Is World-Building')+' · essay', size=9.7, leading=14, gap=2)
section('education')
text('<b>MDes, Interaction Design</b> · Hong Kong Polytechnic University, 2015<br/><b>BA, Creative Media, First Class Honours</b> · City University of Hong Kong, 2014', size=9.3, leading=13, gap=0)
c.save()
print(f'{OUT}\nContent bottom: {y:.1f} / {H:.1f} pt')
